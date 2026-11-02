// Hair strands: a chestnut ponytail of 14,000 strands, each a 48-segment line. The strands are gathered from out of
// frame into a gold cuff and fall in a long S, grouped in 180 clumps that tighten toward the tips, each strand with
// its own small wave and length. A soft wind swings the tail (the swing travels down it, so the tips lag), worked out
// in the vertex shader, so nothing is stored between frames. Shading follows Marschner's three lobes along the
// strand tangent: R, the white reflection off the cuticle; TRT, the light that bounces once inside the fibre and
// leaves tinted and shifted toward the tips; and TT, the light that passes through and glows on the edges against
// the rim light. Every frame is drawn 8 times with sub-pixel offsets at twice the size and averaged (32 samples per
// pixel), so strands far thinner than a pixel stay smooth instead of shimmering.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { rng, FONT } from '../lib/util.js';

const STRANDS = 14000, SEGS = 48, CLUMPS = 180;
const JITTER = [[1, -3], [-1, 3], [5, 1], [-3, -5], [-5, 5], [-7, -1], [3, 7], [7, -7]].map(([x, y]) => [x / 16, y / 16]);

// the ponytail's centre line, from the head above the frame, through the cuff, down in an S
const spine = new THREE.CatmullRomCurve3([
  [-1.3, 5.6, -0.9], [-0.75, 4.1, -0.25], [-0.45, 3.05, 0], [0.35, 2.15, 0.2], [0.85, 0.75, 0.1],
  [0.45, -0.75, 0.05], [-0.45, -2.1, 0.15], [-0.6, -3.0, 0.05], [-0.35, -3.75, 0]].map(p => new THREE.Vector3(...p)), false, 'centripetal');
const LEN = spine.getLengths(800), U_CUFF = LEN[200] / LEN[800];   // the cuff sits on the third control point
// bundle radius along the line: wide at the head, pinched in the cuff, full below it, thinning to the tips
const radius = u => (u < U_CUFF ? 0.13 + 0.55 * (1 - u / U_CUFF) ** 1.6 : 0.13 + 0.36 * Math.sin(Math.min(1, (u - U_CUFF) / 0.3) * Math.PI / 2) - 0.2 * Math.max(0, (u - 0.72) / 0.28) ** 1.5);

const vertexShader = `
attribute vec3 aTan, aVar; attribute float aU;   // aVar: strand random, clump random, self-shadow
uniform float uPhase;
varying vec3 vT, vW, vVar; varying float vU;
const float TAU = 6.28318530718;
vec3 sway(float u) {                                   // the wind: zero above the cuff, growing to the tips, lagging down the tail
  float w = pow(clamp((u - ${U_CUFF.toFixed(4)}) / ${(1 - U_CUFF).toFixed(4)}, 0.0, 1.0), 1.5), a = uPhase * TAU + aVar.y * 0.4;
  return w * vec3(0.2 * sin(a - 2.2 * u), 0.02 * sin(2.0 * a - 3.0 * u), 0.15 * cos(a - 2.0 * u + 0.6));
}
void main() {
  vec3 p = position + sway(aU);
  vT = normalize(aTan + (sway(aU + 0.002) - sway(aU - 0.002)) / 0.004);
  vec4 w = modelMatrix * vec4(p, 1.0);
  vW = w.xyz; vVar = aVar; vU = aU;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const fragmentShader = `
uniform vec3 uBase;
varying vec3 vT, vW, vVar; varying float vU;
const float PI = 3.14159265;
float g(float b, float x) { return exp(-0.5 * x * x / (b * b)) / (2.5066 * b); }
// Marschner hair (R, TT, TRT) for one light, after the real-time form of Karis (2016)
vec3 hair(vec3 T, vec3 V, vec3 L, vec3 base, float shift) {
  float sL = dot(T, L), sV = dot(T, V);
  float cosD = cos(0.5 * abs(asin(clamp(sV, -1.0, 1.0)) - asin(clamp(sL, -1.0, 1.0))));
  vec3 Lp = L - sL * T, Vp = V - sV * T;
  float cosPhi = dot(Lp, Vp) / sqrt(max(dot(Lp, Lp) * dot(Vp, Vp), 1e-4)), cosHalf = sqrt(clamp(0.5 + 0.5 * cosPhi, 0.0, 1.0));
  float B = 0.075;
  float R = g(B, sL + sV - 2.0 * shift) * 0.25 * cosHalf * (0.04 + 0.96 * pow(1.0 - sqrt(clamp(0.5 + 0.5 * dot(L, V), 0.0, 1.0)), 5.0) + 0.05);
  vec3 TT = g(B * 0.5, sL + sV + shift) * exp(-3.65 * cosPhi - 3.98) * pow(base, vec3(0.5 / max(cosD, 0.2)));
  vec3 TRT = g(B * 2.0, sL + sV + 3.0 * shift) * exp(17.0 * cosPhi - 16.78) * pow(base, vec3(0.8 / max(cosD, 0.2)));
  vec3 diffuse = base * sqrt(max(1.0 - sL * sL, 0.0)) * 0.12;
  return vec3(R) * 1.2 + TT * 2.0 + TRT * 2.6 + diffuse;
}
void main() {
  vec3 T = normalize(vT), V = normalize(cameraPosition - vW);
  vec3 base = uBase * (0.75 + 0.5 * vVar.y) * (0.94 + 0.12 * vVar.x);   // clumps differ, strands a little
  float shift = 0.045 + 0.03 * (vVar.y - 0.5);
  vec3 key = normalize(vec3(2.2, 3.0, 4.0)), rim = normalize(vec3(-3.0, 1.2, -2.6));
  vec3 col = hair(T, V, key, base, shift) * vec3(1.0, 0.95, 0.88) * 2.6 * vVar.z + hair(T, V, rim, base, shift) * vec3(1.0, 0.93, 0.85) * 1.5;
  col += base * 0.05;                                  // a little ambient
  col *= mix(0.55, 1.0, smoothstep(0.0, 0.12, vU));    // the roots near the head sit in shadow
  gl_FragColor = vec4(col, 1.0);
}`;

export default {
  name: 'Hair Strands',
  ko: '헤어 스트랜드',
  three(renderer, W, H) {
    // strands: clumps tighten toward the tips, each strand waves a little and has its own length
    const r = rng(290), frames = spine.computeFrenetFrames(400, false);
    const clumps = Array.from({ length: CLUMPS }, () => { const rr = Math.sqrt(r()) * 0.82, a = r() * Math.PI * 2; return [rr * Math.cos(a), rr * Math.sin(a), r()]; });
    const verts = STRANDS * (SEGS + 1);
    const pos = new Float32Array(verts * 3), tan = new Float32Array(verts * 3), uu = new Float32Array(verts), vars = new Float32Array(verts * 3);
    const index = new Uint32Array(STRANDS * SEGS * 2);
    const P = new THREE.Vector3(), Q = new THREE.Vector3(), O = new THREE.Vector3(), KEY = new THREE.Vector3(2.2, 3, 4).normalize();
    const at = (u, ox, oy, out) => {
      const k = Math.min(400, Math.round(u * 400));
      spine.getPointAt(u, out);
      const rad = radius(u);
      return out.addScaledVector(frames.normals[k], ox * rad).addScaledVector(frames.binormals[k], oy * rad);
    };
    let v = 0, e = 0;
    for (let s = 0; s < STRANDS; s++) {
      const c = clumps[s % CLUMPS], len = 0.8 + 0.2 * Math.sqrt(r());
      const sr = Math.sqrt(r()) * 0.3, sa = r() * Math.PI * 2, ph = r() * 6.28, ra = r();
      const stray = r() < 0.02 ? 1 : 0, wave = stray ? 0.13 : 0.035;          // a few flyaway strands
      const off = u => {
        const tight = 1 - 0.65 * Math.max(0, (u - U_CUFF) / (1 - U_CUFF)) ** 1.2;   // strands close in on their clump
        const g = 1 + 0.15 * stray;
        return [g * (c[0] + sr * Math.cos(sa) * tight) + wave * Math.sin(u * 23 + ph), g * (c[1] + sr * Math.sin(sa) * tight) + wave * Math.cos(u * 19 + ph)];
      };
      for (let i = 0; i <= SEGS; i++) {
        const u = Math.min(1, (i / SEGS) * Math.min(1, len));
        const [ox, oy] = off(u), u2 = Math.min(1, u + 0.002), [qx, qy] = off(u2);
        at(u, ox, oy, P); at(u2, qx, qy, Q);
        pos.set([P.x, P.y, P.z], v * 3);
        tan.set([(Q.x - P.x) / 0.002, (Q.y - P.y) / 0.002, (Q.z - P.z) / 0.002], v * 3);
        // self-shadow: strands on the far side of the bundle from the key light, and deep inside it, are darker
        const k = Math.min(400, Math.round(u * 400)), side = O.copy(frames.normals[k]).multiplyScalar(ox).addScaledVector(frames.binormals[k], oy).dot(KEY);
        const shade = (0.3 + 0.7 * Math.min(1, Math.max(0, 0.55 + 0.6 * side))) * (0.75 + 0.25 * Math.min(1, Math.hypot(ox, oy)));
        uu[v] = u; vars.set([ra, c[2], shade], v * 3);
        if (i < SEGS) { index[e++] = v; index[e++] = v + 1; }
        v++;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aTan', new THREE.BufferAttribute(tan, 3));
    geo.setAttribute('aU', new THREE.BufferAttribute(uu, 1));
    geo.setAttribute('aVar', new THREE.BufferAttribute(vars, 3));
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    const mat = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms: { uPhase: { value: 0 }, uBase: { value: new THREE.Color('#4E2410') } } });
    const hair = new THREE.LineSegments(geo, mat);
    hair.frustumCulled = false;

    const scene = new THREE.Scene();
    const bg = document.createElement('canvas'); bg.width = 512; bg.height = 912;
    const b = bg.getContext('2d');
    const lin = b.createLinearGradient(0, 0, 0, 912);
    lin.addColorStop(0, '#1E2B30'); lin.addColorStop(1, '#0B1114');
    b.fillStyle = lin; b.fillRect(0, 0, 512, 912);
    const spot = b.createRadialGradient(300, 420, 0, 300, 420, 420);
    spot.addColorStop(0, 'rgba(120, 150, 150, 0.35)'); spot.addColorStop(1, 'rgba(120, 150, 150, 0)');
    b.fillStyle = spot; b.fillRect(0, 0, 512, 912);
    scene.background = new THREE.CanvasTexture(bg); scene.background.colorSpace = THREE.SRGBColorSpace;
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.add(hair);

    // the gold cuff around the gathered hair
    const k = Math.round(U_CUFF * 400), cuffAt = spine.getPointAt(U_CUFF);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.42, 64, 1, true), new THREE.MeshStandardMaterial({ color: '#E2B860', metalness: 1, roughness: 0.22, side: THREE.DoubleSide }));
    cuff.position.copy(cuffAt);
    cuff.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), frames.tangents[k]);
    scene.add(cuff);
    const sun = new THREE.DirectionalLight('#FFF1DC', 2.5); sun.position.set(2.2, 3, 4); scene.add(sun);

    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
    camera.position.set(0, 0.45, 16); camera.lookAt(0, 0.45, 0);

    // 8 jittered passes at 2x, each averaged 2x2 down and added into one accumulation target
    const big = new THREE.WebGLRenderTarget(W * 2, H * 2, { type: THREE.HalfFloatType });
    const acc = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
    const quad = (fragment, uniforms, blend) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
        uniforms, depthTest: false, depthWrite: false,
        ...(blend ? { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, transparent: true } : {}),
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: fragment,
      }));
      m.frustumCulled = false;
      const s = new THREE.Scene(); s.add(m);
      return s;
    };
    const down = quad(`uniform sampler2D uSrc; uniform vec2 uTexel; varying vec2 vUv;
      void main() {
        vec3 c = vec3(0.0);
        for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) c += texture2D(uSrc, vUv + (vec2(i, j) - 0.5) * uTexel).rgb;
        gl_FragColor = vec4(c / 32.0, 1.0);                // 4 taps x 8 passes
      }`, { uSrc: { value: big.texture }, uTexel: { value: new THREE.Vector2(1 / (W * 2), 1 / (H * 2)) } }, true);
    const show = quad(`uniform sampler2D uSrc; varying vec2 vUv;
      void main() {
        vec3 c = texture2D(uSrc, vUv).rgb;
        c = c * (2.51 * c + 0.03) / (c * (2.43 * c + 0.59) + 0.14);   // ACES-style tone curve
        gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
        #include <colorspace_fragment>
      }`, { uSrc: { value: acc.texture } }, false);
    const flat = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    return {
      scene, camera,
      update(t) { mat.uniforms.uPhase.value = t / 5; },
      render() {
        renderer.setRenderTarget(acc); renderer.setClearColor(0x000000, 1); renderer.clear();
        for (const [jx, jy] of JITTER) {
          camera.setViewOffset(W * 2, H * 2, jx, jy, W * 2, H * 2);
          renderer.setRenderTarget(big); renderer.render(scene, camera);
          renderer.setRenderTarget(acc); renderer.autoClear = false; renderer.render(down, flat); renderer.autoClear = true;
        }
        camera.clearViewOffset();
        renderer.setRenderTarget(null); renderer.render(show, flat);
      },
    };
  },
  // a cross-section of one fibre: the three paths the lobes are named after
  overlay(ctx, t, W, H) {
    const x = 596, y = 1536, cx = x + 112, cy = y + 192, R = 60;
    ctx.fillStyle = 'rgba(8, 14, 16, 0.72)'; ctx.beginPath(); ctx.roundRect(x, y, 452, 340, 26); ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; ctx.font = `600 21px ${FONT.sans}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('ONE FIBRE, CUT ACROSS', x + 28, y + 44);
    const fib = ctx.createRadialGradient(cx - 18, cy - 18, 4, cx, cy, R);
    fib.addColorStop(0, '#8A4A26'); fib.addColorStop(1, '#3E1A0A');
    ctx.fillStyle = fib; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    const path = (pts, col, w) => {
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke();
      const [ax, ay] = pts[pts.length - 2], [bx, by] = pts[pts.length - 1], a = Math.atan2(by - ay, bx - ax);
      ctx.fillStyle = col; ctx.beginPath();
      ctx.moveTo(bx, by); ctx.lineTo(bx - 13 * Math.cos(a - 0.45), by - 13 * Math.sin(a - 0.45)); ctx.lineTo(bx - 13 * Math.cos(a + 0.45), by - 13 * Math.sin(a + 0.45)); ctx.fill();
    };
    const e = a => [cx + R * Math.cos(a), cy + R * Math.sin(a)], IN = e(-2.75);
    path([[cx - 96, cy - 22], IN], 'rgba(255, 255, 255, 0.5)', 3);                    // incoming light
    path([IN, [cx - 92, cy - 92]], '#FFFFFF', 4);                                        // R: off the surface
    path([IN, e(0.2), [cx + 100, cy + 34]], '#FF8A4C', 4);                               // TT: in and out the far side
    path([IN, e(0.3), e(2.3), [cx - 90, cy + 98]], '#FFC857', 4);                        // TRT: one bounce inside
    const rows = [['R', '#FFFFFF', 'white glint off the surface'], ['TRT', '#FFC857', 'one bounce inside, tinted'], ['TT', '#FF8A4C', 'through: the backlit glow']];
    rows.forEach(([k, col, txt], i) => {
      const ty = y + 112 + i * 72;
      ctx.fillStyle = col; ctx.font = `700 26px ${FONT.sans}`; ctx.fillText(k, x + 210, ty);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.72)'; ctx.font = `500 19px ${FONT.sans}`; ctx.fillText(txt, x + 210, ty + 27);
    });
  },
};
