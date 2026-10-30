// Subdivision surface: a quad cage (a square ring of 8 cubes) is refined with Catmull-Clark, level 0 -> 4.
// Every level is computed once in setup; each one is also subdivided linearly up to level 4, so all five share one
// mesh and the surface can glide from level to level. The lines on the surface are the edges of the current
// level (drawn from each cage face's grid coordinates); the cage stays on as a cyan wire.
import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { TAU, FONT, phase, span, ease } from '../lib/util.js';

const LEVELS = 4;
// up one level every 0.7 s (each step glides in 0.45 s), hold, then glide straight back to the cage
function levelAt(t) {
  let level = 0;
  for (let k = 0; k < LEVELS; k++) level += ease.inOut(span(t, 0.35 + k * 0.7, 0.8 + k * 0.7));
  return level * (1 - ease.inOut(span(t, 3.6, 4.7)));
}

// the cage: the outside faces of a 3 x 3 ring of unit cubes (the middle one left out), as shared vertices + quads
function cage() {
  const cells = new Set();
  for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) if (x !== 1 || y !== 1) cells.add(`${x},${y},0`);
  const verts = [], keys = new Map(), faces = [];
  const vid = (x, y, z) => {
    const k = `${x},${y},${z}`;
    if (!keys.has(k)) { keys.set(k, verts.length); verts.push(new THREE.Vector3(x - 1.5, y - 1.5, (z - 0.5) * 1.1)); }
    return keys.get(k);
  };
  const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  for (const c of cells) {
    const [x, y, z] = c.split(',').map(Number);
    for (const [dx, dy, dz] of dirs) {
      if (cells.has(`${x + dx},${y + dy},${z + dz}`)) continue;
      // the face on side (dx, dy, dz), corners counter-clockwise seen from outside
      const o = [x + (dx > 0), y + (dy > 0), z + (dz > 0)];
      const u = dx ? [0, 1, 0] : [1, 0, 0], v = dz ? [0, 1, 0] : [0, 0, 1]; // the two axes in the face's plane
      let q = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([a, b]) => vid(o[0] + u[0] * a + v[0] * b, o[1] + u[1] * a + v[1] * b, o[2] + u[2] * a + v[2] * b));
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      if (n[0] * dx + n[1] * dy + n[2] * dz < 0) q = q.reverse();
      faces.push({ q, uv: [[0, 0], [1, 0], [1, 1], [0, 1]] });
    }
  }
  return { verts, faces };
}

// one subdivision step. smooth: Catmull-Clark; otherwise linear (same new vertices, just midpoints and centroids)
function subdivide(mesh, smooth) {
  const { verts, faces } = mesh, nv = verts.length;
  const out = verts.map(v => v.clone());
  const edges = new Map(), edgeKey = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  const facePts = faces.map(f => f.q.reduce((s, i) => s.add(verts[i]), new THREE.Vector3()).multiplyScalar(0.25));
  faces.forEach((f, fi) => f.q.forEach((a, k) => {
    const b = f.q[(k + 1) % 4], key = edgeKey(a, b);
    if (!edges.has(key)) edges.set(key, { a, b, faces: [] });
    edges.get(key).faces.push(fi);
  }));
  const fBase = nv, eBase = nv + faces.length;
  facePts.forEach(p => out.push(p.clone()));
  const eIndex = new Map();
  let k = 0;
  for (const [key, e] of edges) {
    const mid = verts[e.a].clone().add(verts[e.b]).multiplyScalar(0.5);
    out.push(smooth ? mid.multiplyScalar(2).add(facePts[e.faces[0]]).add(facePts[e.faces[1]]).multiplyScalar(0.25) : mid);
    eIndex.set(key, eBase + k++);
  }
  if (smooth) { // old vertices move to (F + 2R + (n - 3) P) / n
    const F = verts.map(() => new THREE.Vector3()), R = verts.map(() => new THREE.Vector3()), nF = new Array(nv).fill(0), nE = new Array(nv).fill(0);
    faces.forEach((f, fi) => f.q.forEach(i => { F[i].add(facePts[fi]); nF[i]++; }));
    for (const e of edges.values()) {
      const mid = verts[e.a].clone().add(verts[e.b]).multiplyScalar(0.5);
      R[e.a].add(mid); R[e.b].add(mid); nE[e.a]++; nE[e.b]++;
    }
    for (let i = 0; i < nv; i++) {
      const n = nE[i];
      out[i] = F[i].divideScalar(nF[i]).add(R[i].divideScalar(n).multiplyScalar(2)).add(verts[i].clone().multiplyScalar(n - 3)).divideScalar(n);
    }
  }
  const nf = [];
  faces.forEach((f, fi) => {
    const c = fBase + fi, uvc = f.uv.reduce((s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4], [0, 0]);
    for (let j = 0; j < 4; j++) {
      const a = f.q[j], prev = f.q[(j + 3) % 4], next = f.q[(j + 1) % 4];
      const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      nf.push({
        q: [a, eIndex.get(edgeKey(a, next)), c, eIndex.get(edgeKey(prev, a))],
        uv: [f.uv[j], mid(f.uv[j], f.uv[(j + 1) % 4]), uvc, mid(f.uv[j], f.uv[(j + 3) % 4])],
        parent: fi,
      });
    }
  });
  return { verts: out, faces: nf };
}

export default {
  name: 'Subdivision Surface',
  ko: '서브디비전 서피스',
  three(renderer, W, H) {
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas'); bg.width = bg.height = 512;
    const b = bg.getContext('2d'), grd = b.createRadialGradient(256, 230, 20, 256, 256, 380);
    grd.addColorStop(0, '#2B2E5C'); grd.addColorStop(1, '#0C0D1F');
    b.fillStyle = grd; b.fillRect(0, 0, 512, 512);
    scene.background = new THREE.CanvasTexture(bg); scene.background.colorSpace = THREE.SRGBColorSpace;
    const camera = new THREE.PerspectiveCamera(32, W / H, 0.1, 100);
    camera.position.set(0, 0.4, 13.6);
    camera.lookAt(0, -0.05, 0);

    // all levels: P[L] = level L, then linearly subdivided up to the final topology
    const levels = [cage()];
    for (let L = 1; L <= LEVELS; L++) levels.push(subdivide(levels[L - 1], true));
    const P = levels.map((m, L) => { let x = m; for (let k = L; k < LEVELS; k++) x = subdivide(x, false); return x.verts; });
    const fin = levels[LEVELS];
    // normals: level L < 4 shows its own flat faces (each final corner takes the normal of its level-L ancestor face),
    // the last level is shaded smooth
    const quadNormal = (m, f) => {
      const [a, b1, c, d] = f.q.map(i => m.verts[i]);
      return new THREE.Vector3().subVectors(c, a).cross(new THREE.Vector3().subVectors(d, b1)).normalize();
    };
    const vn = fin.verts.map(() => new THREE.Vector3());
    for (const f of fin.faces) { const n = quadNormal(fin, f); f.q.forEach(i => vn[i].add(n)); }
    vn.forEach(n => n.normalize());

    // the mesh, unshared (each corner carries its cage-face grid coordinate for the edge lines)
    const tri = [0, 1, 2, 0, 2, 3], count = fin.faces.length * 6;
    const pos = new Float32Array(count * 3), uv = new Float32Array(count * 2), nor = new Float32Array(count * 3), src = new Uint32Array(count);
    const N = levels.map(() => new Float32Array(count * 3));
    fin.faces.forEach((f, fi) => {
      const anc = [fi]; // ancestor face index at each level, from the finest up
      for (let L = LEVELS; L > 0; L--) anc.unshift(levels[L].faces[anc[0]].parent);
      const flat = anc.map((a, L) => quadNormal(levels[L], levels[L].faces[a]));
      tri.forEach((c, k) => {
        const o = fi * 6 + k;
        src[o] = f.q[c];
        uv.set(f.uv[c], o * 2);
        for (let L = 0; L < LEVELS; L++) N[L].set(flat[L].toArray(), o * 3);
        N[LEVELS].set(vn[f.q[c]].toArray(), o * 3);
      });
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uLevel: { value: 0 } },
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, // the cage wire stays in front at level 0
      vertexShader: `varying vec3 vP, vN; varying vec2 vUv;
        void main() { vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform float uLevel; varying vec3 vP, vN; varying vec2 vUv;
        float grid(float s, float w) { vec2 g = vUv * s, d = abs(fract(g - 0.5) - 0.5) / fwidth(g); return 1.0 - clamp(min(d.x, d.y) / w, 0.0, 1.0); }
        void main() {
          vec3 n = normalize(vN);
          vec3 v = normalize(cameraPosition - vP);
          if (dot(n, v) < 0.0) n = -n;
          vec3 l = normalize(vec3(-0.45, 0.75, 0.5)), h = normalize(l + v);
          float dif = max(dot(n, l), 0.0), back = max(dot(n, normalize(vec3(0.7, -0.2, -0.6))), 0.0);
          vec3 clay = vec3(0.96, 0.66, 0.5);
          vec3 col = clay * (0.3 + 0.8 * dif) + vec3(0.35, 0.55, 1.0) * back * 0.35 + pow(max(dot(n, h), 0.0), 36.0) * 0.28;
          col += vec3(0.5, 0.75, 1.0) * pow(1.0 - max(dot(n, v), 0.0), 3.0) * 0.35;
          // the edges of the current level: level k lines come in as uLevel passes k - 1 -> k
          float line = 0.0;
          for (int k = 0; k <= 3; k++) {
            float on = clamp(uLevel - float(k) + 1.0, 0.0, 1.0) * (k == 3 ? 0.55 : 1.0);
            line = max(line, on * grid(exp2(float(k)), k == 0 ? 1.6 : 1.1));
          }
          col = mix(col, vec3(0.32, 0.12, 0.22), line * 0.75);
          gl_FragColor = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);
        }`,
    });
    const surf = new THREE.Mesh(geo, mat);

    // the cage: level-0 edges as fat cyan lines, bright where seen, faint where hidden behind the surface
    const cg = levels[0], seg = [], seen = new Set();
    for (const f of cg.faces) f.q.forEach((a, k) => {
      const bb = f.q[(k + 1) % 4], key = a < bb ? `${a}_${bb}` : `${bb}_${a}`;
      if (!seen.has(key)) { seen.add(key); seg.push(...cg.verts[a].toArray(), ...cg.verts[bb].toArray()); }
    });
    const res = new THREE.Vector2(W, H);
    const cageGeo = new LineSegmentsGeometry().setPositions(seg);
    const wire = new LineSegments2(cageGeo, new LineMaterial({ color: '#5CE1FF', linewidth: 4, resolution: res }));
    const xray = new LineSegments2(cageGeo, new LineMaterial({ color: '#5CE1FF', linewidth: 3, resolution: res, transparent: true, opacity: 0.3, depthTest: false }));
    const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 16, 10), new THREE.MeshBasicMaterial({ color: '#BFF3FF' }), cg.verts.length);
    cg.verts.forEach((v, i) => dots.setMatrixAt(i, new THREE.Matrix4().makeTranslation(v.x, v.y, v.z)));
    const spin = new THREE.Group(), tilt = new THREE.Group();
    spin.add(surf, wire, xray, dots);
    tilt.add(spin);
    scene.add(tilt);

    return {
      scene, camera,
      update(t) {
        const level = levelAt(t);
        const L = Math.min(LEVELS - 1, Math.floor(level)), f = level - L, A = P[L], B = P[L + 1], NA = N[L], NB = N[L + 1];
        for (let i = 0; i < count; i++) {
          const a = A[src[i]], c = B[src[i]];
          pos[i * 3] = a.x + (c.x - a.x) * f; pos[i * 3 + 1] = a.y + (c.y - a.y) * f; pos[i * 3 + 2] = a.z + (c.z - a.z) * f;
          for (let j = i * 3; j < i * 3 + 3; j++) nor[j] = NA[j] + (NB[j] - NA[j]) * f; // the shader normalises
        }
        geo.attributes.position.needsUpdate = true;
        geo.attributes.normal.needsUpdate = true;
        geo.computeBoundingSphere();
        mat.uniforms.uLevel.value = level;
        const a = phase(t) * TAU;
        tilt.rotation.x = 0.5 + 0.08 * Math.sin(a);
        spin.rotation.y = 0.55 + 0.42 * Math.sin(a);
      },
    };
  },
  // the level counter under the shape
  overlay(ctx, t, W, H) {
    const level = levelAt(t);
    const y = 1730, n = Math.round(level);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `600 34px ${FONT.sans}`; ctx.fillStyle = 'rgba(190, 240, 255, 0.75)';
    ctx.fillText('CATMULL–CLARK', W / 2, y - 100);
    for (let k = 0; k <= LEVELS; k++) {
      const x = W / 2 + (k - 2) * 120, on = Math.max(0, 1 - Math.abs(level - k));
      ctx.beginPath(); ctx.arc(x, y, 40, 0, TAU);
      ctx.fillStyle = `rgba(92, 225, 255, ${0.08 + 0.55 * on})`; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(92, 225, 255, 0.6)'; ctx.stroke();
      ctx.font = `700 40px ${FONT.sans}`; ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + 0.5 * on})`;
      ctx.fillText(String(k), x, y + 2);
    }
    ctx.font = `500 34px ${FONT.sans}`; ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillText(`${32 * 4 ** n} faces`, W / 2, y + 92);
  },
};
