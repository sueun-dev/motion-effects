// Digital sculpting: a grey clay sphere (an icosphere of 42,000 vertices) is shaped into a face by brush strokes, the
// way a sculpting app works: Clay Buildup lays on the brow, nose and chin, Inflate swells the cheeks and eyeballs,
// Crease cuts the mouth, Smooth relaxes the planes. Every stroke is a line of dabs over the surface; each dab moves the
// vertices inside the brush radius with a soft falloff. All strokes are applied once at load and each one's vertex
// offsets are stored with the point along the stroke that reached them, so a frame can replay a stroke as the brush
// travels. The brush circle rides on the surface; at the end the clay relaxes back into the sphere.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { TAU, FONT, phase, span, ease, clamp } from '../lib/util.js';

const BRUSHES = [['CLAY BUILDUP', 'CB'], ['INFLATE', 'IN'], ['CREASE', 'CR'], ['SMOOTH', 'SM']];
// a point on the front of the sphere from face coordinates (x right, y up)
const front = (x, y) => new THREE.Vector3(x, y, Math.sqrt(Math.max(0.01, 1 - x * x - y * y))).normalize();
// the strokes: brush, start time, duration, radius, strength per dab, path(u) -> direction
const STROKES = [
  [0, 0.25, 0.45, 0.22, 0.018, u => front(-0.46 + 0.92 * u, 0.27 + 0.03 * Math.sin(u * Math.PI))], // brow
  [0, 0.8, 0.38, 0.15, 0.018, u => front(0, 0.18 - 0.3 * u)],                                     // nose bridge
  [0, 1.22, 0.16, 0.13, 0.026, u => front(0.03 * Math.sin(u * TAU), -0.12 + 0.03 * Math.cos(u * TAU))], // nose tip
  [0, 1.45, 0.36, 0.22, 0.022, u => front(-0.25 + 0.5 * u, -0.6 + 0.03 * Math.sin(u * Math.PI))], // chin
  [1, 1.9, 0.26, 0.2, 0.007, u => front(-0.42 + 0.07 * Math.cos(u * TAU), -0.12 + 0.07 * Math.sin(u * TAU))], // cheeks
  [1, 2.2, 0.26, 0.2, 0.007, u => front(0.42 + 0.07 * Math.cos(u * TAU), -0.12 + 0.07 * Math.sin(u * TAU))],
  [1, 2.52, 0.14, 0.105, 0.036, u => front(-0.25 + 0.02 * Math.cos(u * TAU), 0.1 + 0.02 * Math.sin(u * TAU))], // eyeballs
  [1, 2.72, 0.14, 0.105, 0.036, u => front(0.25 + 0.02 * Math.cos(u * TAU), 0.1 + 0.02 * Math.sin(u * TAU))],
  [2, 2.95, 0.4, 0.1, 0.021, u => { const x = -0.27 + 0.54 * u; return front(x, -0.33 + 0.08 * (x / 0.27) ** 2); }], // mouth
  [3, 3.45, 0.5, 0.28, 0.25, u => front(-0.45 + 0.9 * u, -0.25 + 0.22 * Math.sin(u * TAU * 1.5))], // smooth
];
const RESET = [4.3, 4.97];

export default {
  name: 'Digital Sculpting',
  ko: '디지털 스컬핑',
  three(renderer, W, H) {
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas'); bg.width = 270; bg.height = 480;
    const b = bg.getContext('2d'), grd = b.createRadialGradient(135, 200, 10, 135, 220, 330);
    grd.addColorStop(0, '#3A3D46'); grd.addColorStop(1, '#121318');
    b.fillStyle = grd; b.fillRect(0, 0, 270, 480);
    scene.background = new THREE.CanvasTexture(bg); scene.background.colorSpace = THREE.SRGBColorSpace;
    const camera = new THREE.PerspectiveCamera(28, W / H, 0.1, 50);
    camera.position.set(0, 0.15, 10.1);
    camera.lookAt(0, -0.63, 0);

    // the clay: an indexed icosphere, plus who-neighbours-whom for the smooth brush
    const geo = mergeVertices(new THREE.IcosahedronGeometry(1, 64).deleteAttribute('normal').deleteAttribute('uv'));
    const pos = geo.attributes.position.array, n = pos.length / 3, idx = geo.index.array;
    const base = Float32Array.from(pos);
    const nbr = Array.from({ length: n }, () => new Set());
    for (let i = 0; i < idx.length; i += 3) for (let k = 0; k < 3; k++) { nbr[idx[i + k]].add(idx[i + (k + 1) % 3]); nbr[idx[i + k]].add(idx[i + (k + 2) % 3]); }
    const nb = nbr.map(s => Int32Array.from(s));
    const normals = p => {
      const out = new Float32Array(p.length);
      for (let i = 0; i < idx.length; i += 3) {
        const a = idx[i] * 3, b2 = idx[i + 1] * 3, c = idx[i + 2] * 3;
        const ux = p[b2] - p[a], uy = p[b2 + 1] - p[a + 1], uz = p[b2 + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        for (const o of [a, b2, c]) { out[o] += nx; out[o + 1] += ny; out[o + 2] += nz; }
      }
      for (let i = 0; i < out.length; i += 3) { const l = Math.hypot(out[i], out[i + 1], out[i + 2]) || 1; out[i] /= l; out[i + 1] /= l; out[i + 2] /= l; }
      return out;
    };
    // the vertex whose rest direction is closest to d (the clay started as a unit sphere)
    const nearest = d => { let best = 0, bd = -2; for (let i = 0; i < n; i++) { const v = base[i * 3] * d.x + base[i * 3 + 1] * d.y + base[i * 3 + 2] * d.z; if (v > bd) { bd = v; best = i; } } return best; };

    // sculpt every stroke once and keep its offsets: { ids, delta, at } (at = how far along the stroke each vertex was reached)
    const work = Float32Array.from(base), strokes = [];
    for (const [brush, , , R, str, path] of STROKES) {
      const before = Float32Array.from(work), nor = normals(work);
      const reach = new Float32Array(n), weight = new Float32Array(n);
      const len = (() => { let l = 0; for (let k = 1; k <= 40; k++) l += path(k / 40).distanceTo(path((k - 1) / 40)); return l; })();
      const dabs = Math.max(6, Math.ceil(len / (R * 0.18)));
      for (let k = 0; k < dabs; k++) {
        const u = k / (dabs - 1), c = nearest(path(u)), cx = work[c * 3], cy = work[c * 3 + 1], cz = work[c * 3 + 2];
        const ids = [], fall = [];
        for (let i = 0; i < n; i++) {
          const dx = work[i * 3] - cx, dy = work[i * 3 + 1] - cy, dz = work[i * 3 + 2] - cz, d = Math.sqrt(dx * dx + dy * dy + dz * dz) / R;
          if (d < 1) { ids.push(i); fall.push((1 - d * d) ** 2); }
        }
        let ax = 0, ay = 0, az = 0;                                       // the area normal under the brush
        ids.forEach((i, j) => { ax += nor[i * 3] * fall[j]; ay += nor[i * 3 + 1] * fall[j]; az += nor[i * 3 + 2] * fall[j]; });
        const al = Math.hypot(ax, ay, az) || 1; ax /= al; ay /= al; az /= al;
        const smoothed = brush === 3 ? ids.map(i => { let sx = 0, sy = 0, sz = 0; for (const j of nb[i]) { sx += work[j * 3]; sy += work[j * 3 + 1]; sz += work[j * 3 + 2]; } return [sx / nb[i].length, sy / nb[i].length, sz / nb[i].length]; }) : null;
        ids.forEach((i, j) => {
          const f = fall[j], o = i * 3;
          if (brush === 0) { work[o] += ax * str * f; work[o + 1] += ay * str * f; work[o + 2] += az * str * f; }        // clay: along the area normal
          else if (brush === 1) { work[o] += nor[o] * str * f; work[o + 1] += nor[o + 1] * str * f; work[o + 2] += nor[o + 2] * str * f; } // inflate
          else if (brush === 2) {                                                                                      // crease: in, and pinched together
            const sharp = f * f;
            work[o] += -nor[o] * str * sharp + (cx - work[o]) * 0.12 * f;
            work[o + 1] += -nor[o + 1] * str * sharp + (cy - work[o + 1]) * 0.12 * f;
            work[o + 2] += -nor[o + 2] * str * sharp + (cz - work[o + 2]) * 0.12 * f;
          } else for (let a = 0; a < 3; a++) work[o + a] += (smoothed[j][a] - work[o + a]) * str * f;                  // smooth
          reach[i] += f * u; weight[i] += f;                       // where along the stroke: falloff-weighted mean
        });
      }
      const ids = [], delta = [], at = [];
      for (let i = 0; i < n; i++) {
        const dx = work[i * 3] - before[i * 3], dy = work[i * 3 + 1] - before[i * 3 + 1], dz = work[i * 3 + 2] - before[i * 3 + 2];
        if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 1e-7) { ids.push(i); delta.push(dx, dy, dz); at.push(reach[i] / (weight[i] || 1)); }
      }
      strokes.push({ ids: Int32Array.from(ids), delta: Float32Array.from(delta), at: Float32Array.from(at), soft: Math.min(0.4, 0.6 * R / len) });
    }

    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const uBrush = { value: new THREE.Vector3() }, uR = { value: 0.2 }, uOn = { value: 0 };
    const mat = new THREE.ShaderMaterial({
      uniforms: { uBrush, uR, uOn },
      vertexShader: `varying vec3 vP, vN; void main() { vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform vec3 uBrush; uniform float uR, uOn; varying vec3 vP, vN;
        void main() {
          vec3 n = normalize(vN), v = normalize(cameraPosition - vP);
          vec3 l = normalize(vec3(-0.55, 0.75, 0.6)), h = normalize(l + v);
          float dif = max(dot(n, l), 0.0), wrap = 0.5 + 0.5 * dot(n, l);
          vec3 clay = vec3(0.6, 0.585, 0.57);
          vec3 col = clay * (0.16 + 0.62 * dif + 0.22 * wrap) + vec3(0.42, 0.48, 0.6) * max(dot(n, normalize(vec3(0.6, -0.1, -0.6))), 0.0) * 0.35;
          col += vec3(1.0) * pow(max(dot(n, h), 0.0), 30.0) * 0.12;
          col += vec3(0.55, 0.62, 0.8) * pow(1.0 - max(dot(n, v), 0.0), 4.0) * 0.3;
          // the brush: a ring at the radius, a faint falloff disc, a dot in the middle
          float d = length(vP - uBrush), w = fwidth(d);
          float ring = 1.0 - smoothstep(0.0, 1.6 * w + 0.004, abs(d - uR));
          float disc = (1.0 - smoothstep(0.0, uR, d)) * 0.13, dot = 1.0 - smoothstep(0.012, 0.012 + 1.5 * w, d);
          col = mix(col, vec3(1.0, 0.36, 0.3), (max(ring, dot) * 0.95 + disc) * uOn);
          gl_FragColor = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);
        }`,
    });
    const clay = new THREE.Mesh(geo, mat);
    const turn = new THREE.Group(); turn.add(clay); scene.add(turn);
    turn.position.y = -0.42;
    // a soft round shadow under the clay
    const sc = document.createElement('canvas'); sc.width = sc.height = 128;
    const sx = sc.getContext('2d'), sg = sx.createRadialGradient(64, 64, 4, 64, 64, 62);
    sg.addColorStop(0, 'rgba(0,0,0,0.55)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
    sx.fillStyle = sg; sx.fillRect(0, 0, 128, 128);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = -1.48; scene.add(shadow);

    const tmp = new THREE.Vector3();
    return {
      scene, camera,
      update(t) {
        const relax = 1 - ease.inOut(span(t, ...RESET));
        pos.set(base);
        strokes.forEach((s, k) => {
          const [, t0, dur] = STROKES[k], p = span(t, t0, dur + t0);
          if (p <= 0) return;
          const soft = s.soft;                                         // a vertex fills in as the brush passes over it
          for (let j = 0; j < s.ids.length; j++) {
            const f = p >= 1 ? relax : clamp((p * (1 + 2 * soft) - soft - s.at[j]) / (2 * soft) + 0.5) * relax;
            if (f <= 0) continue;
            const o = s.ids[j] * 3;
            pos[o] += s.delta[j * 3] * f; pos[o + 1] += s.delta[j * 3 + 1] * f; pos[o + 2] += s.delta[j * 3 + 2] * f;
          }
        });
        geo.attributes.position.needsUpdate = true;
        geo.attributes.normal.array.set(normals(pos));
        geo.attributes.normal.needsUpdate = true;
        // the brush: on its stroke, or gliding to the next one (fading while it travels)
        let k = STROKES.findIndex(s => t < s[1] + s[2]);
        if (k < 0) k = STROKES.length - 1;
        const [, t0, dur, R, , path] = STROKES[k];
        let dir, on;
        if (t >= t0) { dir = path(span(t, t0, t0 + dur)); on = 1; }
        else {
          const prev = k > 0 ? STROKES[k - 1] : null, from = prev ? prev[5](1) : path(0), tA = prev ? prev[1] + prev[2] : 0;
          const g = ease.inOut(span(t, tA, t0));
          dir = from.clone().lerp(path(0), g).normalize();
          on = prev ? 0.35 + 0.65 * Math.abs(2 * g - 1) : ease.inOut(span(t, 0.05, t0));
        }
        on *= 1 - ease.inOut(span(t, STROKES.at(-1)[1] + STROKES.at(-1)[2], STROKES.at(-1)[1] + STROKES.at(-1)[2] + 0.25));
        const c = nearest(dir);
        uR.value = THREE.MathUtils.lerp(k > 0 ? STROKES[k - 1][3] : R, R, t >= t0 ? 1 : ease.inOut(span(t, k > 0 ? STROKES[k - 1][1] + STROKES[k - 1][2] : 0, t0)));
        uOn.value = on;
        const a = phase(t) * TAU;
        turn.rotation.y = 0.34 + 0.24 * Math.sin(a) + 0.05 * Math.sin(2 * a);
        turn.rotation.x = 0.08 + 0.04 * Math.sin(a + 1);
        turn.updateMatrixWorld(true);
        uBrush.value.copy(tmp.set(pos[c * 3], pos[c * 3 + 1], pos[c * 3 + 2]).applyMatrix4(clay.matrixWorld));
      },
    };
  },
  // the brush palette on the left and the active brush under the clay
  overlay(ctx, t, W, H) {
    let k = STROKES.findIndex(s => t < s[1] + s[2]);
    if (k < 0) k = STROKES.length - 1;
    const active = STROKES[k][0], prev = k > 0 ? STROKES[k - 1][0] : active;
    const tA = k > 0 ? STROKES[k - 1][1] + STROKES[k - 1][2] : 0, t0 = STROKES[k][1];
    const g = prev === active ? 1 : span(t, tA, t0);                   // a brush change: old name out, then new name in
    const shown = g < 0.5 ? prev : active, swap = prev === active ? 1 : Math.abs(2 * g - 1);
    // after the last stroke the brush name fades out, then a summary fades in (and out again before the loop)
    const end = STROKES.at(-1)[1] + STROKES.at(-1)[2];
    const done = ease.inOut(span(t, end, end + 0.3)) * (1 - ease.inOut(span(t, 4.75, 4.97)));
    const nameA = swap * ease.inOut(span(t, 0, 0.2)) * (1 - ease.inOut(span(t, end, end + 0.15)));
    const sumA = ease.inOut(span(t, end + 0.15, end + 0.3)) * (1 - ease.inOut(span(t, 4.75, 4.97)));
    BRUSHES.forEach(([name, ab], i) => {
      const x = 76, y = 600 + i * 140;
      const on = i === active ? (prev === active ? 1 : ease.inOut(g)) : i === prev ? 1 - ease.inOut(g) : 0;
      // after the last stroke its button goes dark; Clay Buildup lights again just before the loop starts over
      const lit = t < end ? on : (i === active ? 1 - ease.inOut(span(t, end, end + 0.3)) : 0) + (i === 0 ? ease.inOut(span(t, 4.75, 4.97)) : 0);
      ctx.fillStyle = `rgba(${40 + 200 * lit}, ${42 + 50 * lit}, ${48 + 30 * lit}, 0.9)`;
      ctx.beginPath(); ctx.roundRect(x - 50, y - 50, 100, 100, 22); ctx.fill();
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.16 + 0.6 * lit})`; ctx.lineWidth = 3; ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `700 34px ${FONT.sans}`; ctx.fillStyle = `rgba(255, 255, 255, ${0.55 + 0.45 * lit})`;
      ctx.fillText(ab, x, y + 1);
    });
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = nameA;
    ctx.font = `700 46px ${FONT.sans}`; ctx.fillStyle = '#FFFFFF';
    ctx.fillText(BRUSHES[shown][0], W / 2, 1660);
    ctx.font = `500 30px ${FONT.mono}`; ctx.fillStyle = 'rgba(255, 210, 200, 0.85)';
    ctx.fillText(`radius ${STROKES[g < 0.5 && k > 0 ? k - 1 : k][3].toFixed(2)}`, W / 2, 1720);
    ctx.globalAlpha = sumA;
    ctx.font = `700 46px ${FONT.sans}`; ctx.fillStyle = '#FFFFFF';
    ctx.fillText('10 STROKES', W / 2, 1660);
    ctx.font = `500 30px ${FONT.mono}`; ctx.fillStyle = 'rgba(255, 210, 200, 0.85)';
    ctx.fillText('42,000 vertices', W / 2, 1720);
    ctx.globalAlpha = 1;
  },
};
