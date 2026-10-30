// Gaussian splatting: a still life (wooden board, blue bowl, orange, apple, lemon, grapes) stored only as 3D Gaussians:
// position, 3x3 covariance, colour (lighting baked in) and opacity. Each frame the Gaussians are projected to 2D
// ellipses (the EWA Jacobian), sorted back to front and alpha-blended. The scene first appears as ~220 big blobs,
// which split into ~2,500 and then ~33,000 thin surface splats (each coarse blob is the moment-matched fit of its
// children, grouped round random seeds), the way training refines a capture; then it melts back. The camera sways.
import * as THREE from 'three';
import { TAU, FONT, rng, phase, span, ease } from '../lib/util.js';

const BOWL = [0, 1.45, 0], RIM = 1.0, ORANGE = [-0.45, 0.97, 0.25, 0.55], APPLE = [0.5, 0.95, 0.22, 0.5];
const LEMON = [0.05, 1.02, -0.52], LEMON_R = [0.46, 0.3, 0.3], LIGHT = new THREE.Vector3(-0.6, 1.0, 0.55).normalize();
const DENSITY = 640, SEEDS = [220, 2600], GROW = [2.0, 1.4]; // sharp splats per unit area; blobs per coarse level, and how much they swell
// training schedule: level 0 (blobs) -> 1 -> 2 (sharp), hold, melt back 2 -> 1 -> 0; every step eases in and out,
// so nothing changes direction while it moves
const levelAt = t => ease.inOut(span(t, 0.4, 1.35)) + ease.inOut(span(t, 1.35, 2.3)) - ease.inOut(span(t, 3.3, 4.08)) - ease.inOut(span(t, 4.08, 4.86));
const counts = [1, 1, 1]; // distinct Gaussians per level (filled in setup, read by the overlay)

function grapes() {
  const r = rng(187), out = [];
  for (let i = 0; i < 13; i++) {
    const a = r() * TAU, h = r(), rad = 0.24 * (1 - h * 0.6);
    out.push([-0.32 + rad * Math.cos(a), 1.32 + h * 0.42, -0.12 + rad * Math.sin(a), 0.14 + 0.02 * r()]);
  }
  return out;
}
const GRAPES = grapes();
const lemonLocal = p => { const x = p[0] - LEMON[0], z = p[2] - LEMON[2], c = Math.cos(0.5), s = Math.sin(0.5); return [c * x - s * z, p[1] - LEMON[1], s * x + c * z]; };
const sphere = (p, c) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) - c[3];
// the solids as signed distances (for hiding buried samples, baked shadows and occlusion)
const parts = {
  board: p => Math.max(Math.hypot(p[0], p[2]) - 2.5, Math.abs(p[1] + 0.08) - 0.08),
  bowl: p => Math.max(Math.abs(Math.hypot(p[0] - BOWL[0], p[1] - BOWL[1], p[2] - BOWL[2]) - 1.4) - 0.05, p[1] - RIM),
  orange: p => sphere(p, ORANGE),
  apple: p => sphere(p, APPLE),
  lemon: p => { const q = lemonLocal(p), k = Math.hypot(q[0] / LEMON_R[0], q[1] / LEMON_R[1], q[2] / LEMON_R[2]); return (k - 1) * 0.3; },
  grapes: p => Math.min(...GRAPES.map(g => sphere(p, g))),
};
const sdf = (p, skip) => { let d = 1e9; for (const k in parts) if (k !== skip) d = Math.min(d, parts[k](p)); return d; };

// surface samples: [position, normal, albedo, part]
function samples() {
  const out = [];
  const fib = (n, f) => { for (let i = 0; i < n; i++) { const y = 1 - 2 * (i + 0.5) / n, rr = Math.sqrt(1 - y * y), a = i * 2.39996323; f([rr * Math.cos(a), y, rr * Math.sin(a)]); } };
  const C = h => new THREE.Color(h);
  const ball = (c, name, color) => fib(Math.round(4 * Math.PI * c[3] ** 2 * DENSITY), d => out.push([[c[0] + c[3] * d[0], c[1] + c[3] * d[1], c[2] + c[3] * d[2]], d, color(d), name]));
  // board: the top disc (wood grain) and its edge
  const nTop = Math.round(Math.PI * 2.5 ** 2 * DENSITY);
  for (let i = 0; i < nTop; i++) {
    const rr = 2.5 * Math.sqrt((i + 0.5) / nTop), a = i * 2.39996323, x = rr * Math.cos(a), z = rr * Math.sin(a);
    const g = 0.5 + 0.5 * Math.sin(x * 5 + 2.5 * Math.sin(z * 1.3));
    out.push([[x, 0, z], [0, 1, 0], C('#C89464').lerp(C('#9A6640'), 0.5 * g), 'board']);
  }
  for (let i = 0; i < 1400; i++) { // the edge: one row of small splats
    const a = (i / 1400) * TAU;
    out.push([[2.5 * Math.cos(a), -0.08, 2.5 * Math.sin(a)], [Math.cos(a), 0, Math.sin(a)], C('#7A4A28'), 'board', 0.55]);
  }
  // bowl: outside (blue with a cream band), inside (cream), all below the rim
  fib(Math.round(4 * Math.PI * 1.45 ** 2 * DENSITY), d => {
    const p = [BOWL[0] + 1.45 * d[0], BOWL[1] + 1.45 * d[1], BOWL[2] + 1.45 * d[2]];
    if (p[1] > RIM - 0.02) return; // the rim ring covers the last bit
    const band = Math.abs(p[1] - 0.78) < 0.06 || Math.abs(p[1] - 0.6) < 0.025;
    out.push([p, d, band ? C('#F3ECDD') : C('#2D5BAE').lerp(C('#1B3A78'), Math.max(0, -d[1])), 'bowl', RIM - p[1] < 0.08 ? 0.4 : 1]);
  });
  fib(Math.round(4 * Math.PI * 1.35 ** 2 * DENSITY), d => {
    const p = [BOWL[0] + 1.35 * d[0], BOWL[1] + 1.35 * d[1], BOWL[2] + 1.35 * d[2]];
    if (p[1] < RIM - 0.02) out.push([p, d.map(v => -v), C('#EFE7DA'), 'bowl', RIM - p[1] < 0.08 ? 0.4 : 1]);
  });
  for (let i = 0; i < 1500; i++) { // the rim
    const a = (i / 1500) * TAU, rr = Math.sqrt(1.4 ** 2 - (RIM - BOWL[1]) ** 2);
    out.push([[rr * Math.cos(a), RIM, rr * Math.sin(a)], [0, 1, 0], C('#F7F1E6'), 'bowl', 0.6]);
  }
  ball(ORANGE, 'orange', d => C('#F08A1C').lerp(C('#F5A640'), 0.5 + 0.5 * Math.sin(d[0] * 40) * Math.sin(d[2] * 40)));
  ball(APPLE, 'apple', d => C('#C61F37').lerp(C('#E2C24A'), Math.max(0, d[0] * 0.8 - d[2] * 0.3) ** 1.5));
  fib(Math.round(4 * Math.PI * 0.35 ** 2 * DENSITY), d => { // lemon: an ellipsoid, normal from its gradient
    const q = [d[0] * LEMON_R[0], d[1] * LEMON_R[1], d[2] * LEMON_R[2]], c = Math.cos(0.5), s = Math.sin(0.5);
    const n = new THREE.Vector3(d[0] / LEMON_R[0], d[1] / LEMON_R[1], d[2] / LEMON_R[2]).normalize();
    out.push([[LEMON[0] + c * q[0] + s * q[2], LEMON[1] + q[1], LEMON[2] - s * q[0] + c * q[2]], [c * n.x + s * n.z, n.y, -s * n.x + c * n.z], C('#F4D23C'), 'lemon']);
  });
  GRAPES.forEach((g, i) => ball(g, 'grapes', d => C('#5A2370').lerp(C('#8E4BA8'), 0.3 + 0.3 * Math.sin(i * 2.1) + 0.3 * d[1])));
  // keep what is not buried in another solid
  return out.filter(([p, , , name]) => sdf(p, name) > 0.01);
}

// baked light: sun with a soft SDF shadow, sky fill, ambient occlusion, a little sheen
function bake([p, n, albedo]) {
  const at = k => [p[0] + n[0] * k, p[1] + n[1] * k, p[2] + n[2] * k];
  let sh = 1, t = 0.04;
  for (let i = 0; i < 26 && t < 4; i++) {
    const q = [p[0] + LIGHT.x * t + n[0] * 0.02, p[1] + LIGHT.y * t + n[1] * 0.02, p[2] + LIGHT.z * t + n[2] * 0.02], h = sdf(q);
    sh = Math.min(sh, 7 * h / t); t += Math.max(0.03, h);
  }
  sh = Math.max(0, Math.min(1, sh));
  let ao = 1;
  for (const k of [0.06, 0.14, 0.26]) ao -= Math.max(0, k - sdf(at(k))) * 1.1;
  const dif = Math.max(0, n[0] * LIGHT.x + n[1] * LIGHT.y + n[2] * LIGHT.z) * sh;
  const lit = albedo.clone().multiplyScalar((0.32 + 0.14 * n[1]) * Math.max(0.25, ao) + 0.95 * dif);
  return lit.add(new THREE.Color(1, 1, 1).multiplyScalar(0.12 * dif ** 8));
}

export default {
  name: 'Gaussian Splatting',
  ko: '가우시안 스플래팅',
  three(renderer, W, H) {
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas'); bg.width = bg.height = 512;
    const b = bg.getContext('2d'), grd = b.createRadialGradient(256, 210, 30, 256, 256, 400);
    grd.addColorStop(0, '#F2ECE3'); grd.addColorStop(1, '#BDB2A4');
    b.fillStyle = grd; b.fillRect(0, 0, 512, 512);
    scene.background = new THREE.CanvasTexture(bg); scene.background.colorSpace = THREE.SRGBColorSpace;
    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);

    // sharp splats: flat discs in the surface (two long axes in the tangent plane, a thin one along the normal)
    const S = samples(), N = S.length, st = 0.8 / Math.sqrt(DENSITY), sn = 0.004;
    const L = [0, 1, 2].map(() => ({ mu: new Float32Array(N * 3), cov: new Float32Array(N * 6), col: new Float32Array(N * 3), a: new Float32Array(N) }));
    const tan = new THREE.Vector3(), bit = new THREE.Vector3(), nv = new THREE.Vector3();
    S.forEach((s, i) => {
      const [p, n] = s, c = bake(s);
      nv.fromArray(n).normalize();
      tan.set(Math.abs(nv.y) < 0.9 ? 0 : 1, Math.abs(nv.y) < 0.9 ? 1 : 0, 0).cross(nv).normalize();
      bit.crossVectors(nv, tan);
      const v = [tan, bit, nv], sc = [st, st * (s[4] || 1), sn]; // s[4] squeezes the up-down axis (edges, rim)
      const cov = [[0, 0], [0, 1], [0, 2], [1, 1], [1, 2], [2, 2]].map(([r, q]) => v.reduce((acc, e, k) => acc + sc[k] ** 2 * e.getComponent(r) * e.getComponent(q), 0));
      L[2].mu.set(p, i * 3); L[2].cov.set(cov, i * 6); L[2].col.set([c.r, c.g, c.b], i * 3); L[2].a[i] = 0.95;
    });
    // coarse levels: every sharp splat joins its nearest random seed; each child takes its group's moment-matched
    // Gaussian (swollen a little, as early training blobs are)
    const r = rng(5);
    SEEDS.forEach((m, lv) => {
      const seeds = Array.from({ length: m }, () => Math.floor(r() * N)), groups = seeds.map(() => []);
      for (let i = 0; i < N; i++) {
        let best = 0, bd = Infinity;
        for (let k = 0; k < m; k++) {
          const j = seeds[k], dx = L[2].mu[i * 3] - L[2].mu[j * 3], dy = L[2].mu[i * 3 + 1] - L[2].mu[j * 3 + 1], dz = L[2].mu[i * 3 + 2] - L[2].mu[j * 3 + 2];
          const d = dx * dx + dy * dy + dz * dz;
          if (d < bd) { bd = d; best = k; }
        }
        groups[best].push(i);
      }
      counts[lv] = groups.filter(g => g.length).length;
      for (const ids of groups) {
        const n = ids.length, mu = [0, 0, 0], col = [0, 0, 0], cov = [0, 0, 0, 0, 0, 0];
        if (!n) continue;
        for (const i of ids) for (let j = 0; j < 3; j++) { mu[j] += L[2].mu[i * 3 + j] / n; col[j] += L[2].col[i * 3 + j] / n; }
        for (const i of ids) {
          const d = [0, 1, 2].map(j => L[2].mu[i * 3 + j] - mu[j]);
          [[0, 0], [0, 1], [0, 2], [1, 1], [1, 2], [2, 2]].forEach(([a, b2], k) => { cov[k] += GROW[lv] * (L[2].cov[i * 6 + k] + d[a] * d[b2]) / n; });
        }
        cov[0] += 0.0004; cov[3] += 0.0004; cov[5] += 0.0004;
        const a = 1 - (1 - (lv === 0 ? 0.85 : 0.9)) ** (1 / n); // n stacked copies add up to one blob of that opacity
        for (const i of ids) { L[lv].mu.set(mu, i * 3); L[lv].cov.set(cov, i * 6); L[lv].col.set(col, i * 3); L[lv].a[i] = a; }
      }
    });
    counts[2] = N;

    // one instanced quad per splat; the vertex shader projects the 3D covariance to a screen ellipse
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-3, -3, 0, 3, -3, 0, 3, 3, 0, -3, 3, 0], 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    const center = new Float32Array(N * 3), covA = new Float32Array(N * 3), covB = new Float32Array(N * 3), rgba = new Float32Array(N * 4);
    geo.setAttribute('center', new THREE.InstancedBufferAttribute(center, 3));
    geo.setAttribute('covA', new THREE.InstancedBufferAttribute(covA, 3));
    geo.setAttribute('covB', new THREE.InstancedBufferAttribute(covB, 3));
    geo.setAttribute('rgba', new THREE.InstancedBufferAttribute(rgba, 4));
    geo.instanceCount = N;
    const fy = (H / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), fx = fy;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uFocal: { value: new THREE.Vector2(fx, fy) }, uView: { value: new THREE.Vector2(W, H) } },
      transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, // premultiplied, back to front
      vertexShader: `attribute vec3 center, covA, covB; attribute vec4 rgba; uniform vec2 uFocal, uView;
        varying vec2 vP; varying vec4 vC;
        void main() {
          vec4 cam = viewMatrix * vec4(center, 1.0);
          vec4 clip = projectionMatrix * cam;
          mat3 Wv = mat3(viewMatrix);
          mat3 S = mat3(covA.x, covA.y, covA.z, covA.y, covB.x, covB.y, covA.z, covB.y, covB.z);
          mat3 Sc = Wv * S * transpose(Wv);                       // covariance in camera space
          float z = cam.z;                                          // negative in front of the camera
          vec3 j1 = vec3(uFocal.x / -z, 0.0, uFocal.x * cam.x / (z * z)), j2 = vec3(0.0, uFocal.y / -z, uFocal.y * cam.y / (z * z));
          float a = dot(j1, Sc * j1) + 0.3, b = dot(j1, Sc * j2), c = dot(j2, Sc * j2) + 0.3; // 2D covariance, pixels
          float mid = 0.5 * (a + c), rad = length(vec2(0.5 * (a - c), b));
          float l1 = mid + rad, l2 = max(mid - rad, 0.05);
          vec2 e1 = abs(b) > 1e-7 ? normalize(vec2(b, l1 - a)) : (a >= c ? vec2(1.0, 0.0) : vec2(0.0, 1.0));
          vec2 e2 = vec2(-e1.y, e1.x);
          vec2 off = position.x * sqrt(l1) * e1 + position.y * sqrt(l2) * e2; // quad corner, in pixels
          vP = position.xy; vC = rgba;
          gl_Position = vec4(clip.xy + off * 2.0 / uView * clip.w, clip.z, clip.w);
          if (-z < 0.2) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
        }`,
      fragmentShader: `varying vec2 vP; varying vec4 vC;
        void main() {
          float g = exp(-0.5 * dot(vP, vP));
          if (g < 0.011) discard;
          float a = vC.a * g;
          gl_FragColor = vec4(vC.rgb * a, a);
        }`,
    });
    const splats = new THREE.Mesh(geo, mat);
    splats.frustumCulled = false;
    scene.add(splats);

    // per frame: blend the levels, sort far to near, write the instance buffers in that order
    const cur = { mu: new Float32Array(N * 3), cov: new Float32Array(N * 6), col: new Float32Array(N * 3), a: new Float32Array(N) };
    const depth = new Float32Array(N), order = new Uint32Array(N).map((_, i) => i);
    const mix = (A, B, w) => { for (const k of ['mu', 'cov', 'col', 'a']) { const x = A[k], y = B[k], o = cur[k]; for (let i = 0; i < o.length; i++) o[i] = x[i] + (y[i] - x[i]) * w; } };
    return {
      scene, camera,
      update(t) {
        const a = phase(t) * TAU, ang = 0.32 * Math.sin(a) + 0.25;
        camera.position.set(10.4 * Math.sin(ang), 4.9 + 0.3 * Math.cos(a), 10.4 * Math.cos(ang));
        camera.lookAt(0, 0.75, 0);
        camera.updateMatrixWorld();
        const lv = levelAt(t), k = Math.min(1, Math.floor(lv));
        mix(L[k], L[k + 1], lv - k);
        const m = camera.matrixWorldInverse.elements;
        for (let i = 0; i < N; i++) depth[i] = m[2] * cur.mu[i * 3] + m[6] * cur.mu[i * 3 + 1] + m[10] * cur.mu[i * 3 + 2];
        order.sort((x, y) => depth[x] - depth[y]); // most negative (farthest) first
        for (let j = 0; j < N; j++) {
          const i = order[j];
          center[j * 3] = cur.mu[i * 3]; center[j * 3 + 1] = cur.mu[i * 3 + 1]; center[j * 3 + 2] = cur.mu[i * 3 + 2];
          covA[j * 3] = cur.cov[i * 6]; covA[j * 3 + 1] = cur.cov[i * 6 + 1]; covA[j * 3 + 2] = cur.cov[i * 6 + 2];
          covB[j * 3] = cur.cov[i * 6 + 3]; covB[j * 3 + 1] = cur.cov[i * 6 + 4]; covB[j * 3 + 2] = cur.cov[i * 6 + 5];
          rgba[j * 4] = cur.col[i * 3]; rgba[j * 4 + 1] = cur.col[i * 3 + 1]; rgba[j * 4 + 2] = cur.col[i * 3 + 2]; rgba[j * 4 + 3] = cur.a[i];
        }
        for (const n of ['center', 'covA', 'covB', 'rgba']) geo.attributes[n].needsUpdate = true;
      },
    };
  },
  // a training read-out: how many distinct Gaussians there are right now
  overlay(ctx, t, W, H) {
    const lv = levelAt(t), k = Math.min(1, Math.floor(lv)), w = lv - k;
    const n = Math.round(Math.exp(Math.log(counts[k]) * (1 - w) + Math.log(counts[k + 1]) * w));
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(40, 34, 30, 0.72)'; ctx.beginPath(); ctx.roundRect(W / 2 - 250, 1650, 500, 110, 26); ctx.fill();
    ctx.font = `700 46px ${FONT.mono}`; ctx.fillStyle = '#FFFFFF';
    ctx.fillText(n.toLocaleString('en-US'), W / 2, 1690);
    ctx.font = `500 28px ${FONT.sans}`; ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fillText('3D Gaussians', W / 2, 1734);
  },
};
