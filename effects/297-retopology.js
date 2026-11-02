// Retopology: a dense sculpt (100,820 jittered triangles, like a dynamic-topology mesh) gets a clean quad net drawn
// over it. The edge loops are the level sets of one field F: a soft minimum of the distances to the eyes, the nose
// (bridge to tip) and the mouth, so the first loops ring each feature on its own and the outer ones merge into loops
// round the whole face. The edges across them are gradient lines of F, each running from a feature's first loop to the
// outermost one. Where the loops of two features merge F has a saddle, and that is where the poles go (the inner eye
// corners and above the lip). Loops are drawn in the shader; edges and vertices are traced once at load.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { TAU, FONT, span, ease, clamp, smoothstep } from '../lib/util.js';

// the head: radius along a unit direction d (face toward +z)
const g2 = (x, y, sx, sy) => Math.exp(-((x / sx) ** 2) - ((y / sy) ** 2));
function radius(d) {
  const { x, y, z } = d, f = Math.max(0, z) ** 2;
  let r = 1 + 0.08 * y - 0.06 * y * y + 0.04 * Math.max(0, -y) * z;  // a slightly egg-shaped skull, fuller jaw
  r += f * (0.07 * g2(x, y - 0.28, 0.42, 0.07)                       // brow
    - 0.07 * g2(Math.abs(x) - 0.29, y - 0.13, 0.12, 0.08)              // eye sockets
    + 0.05 * g2(Math.abs(x) - 0.29, y - 0.12, 0.08, 0.055)             // eyeballs / lids
    + 0.2 * g2(x, y + 0.12, 0.06 + 0.06 * clamp((0.18 - y) / 0.3), 0.18) * smoothstep(-0.3, -0.12, y) // nose
    + 0.04 * g2(Math.abs(x) - 0.4, y + 0.1, 0.14, 0.12)                // cheekbones
    + 0.045 * g2(x, y + 0.35, 0.18, 0.035) - 0.03 * g2(x, y + 0.4, 0.2, 0.012) + 0.04 * g2(x, y + 0.45, 0.16, 0.035) // lips
    + 0.06 * g2(x, y + 0.68, 0.2, 0.1));                               // chin
  return r;
}
// the field: a soft minimum of the distances to four segments (left eye, right eye, nose from bridge to tip, mouth),
// measured in a face space squeezed 1.4x across. The nose runs up between the eyes, so F has no peak anywhere on the
// face, only three saddles (eye-nose twice, nose-mouth), and every gradient line runs from a feature out to the edge.
const SX = 1.4, K = 0.05;
const FEATS = [[-0.29 / SX - 0.025, 0.125, -0.29 / SX + 0.025, 0.125, 0.06], [0.29 / SX - 0.025, 0.125, 0.29 / SX + 0.025, 0.125, 0.06],
  [0, -0.03, 0, -0.16, 0.02], [-0.12, -0.4, 0.12, -0.4, 0.05]];  // segment ends (squeezed space) and radius
function field(x, y) {
  let s = 0;
  for (const [ax, ay, bx, by, r] of FEATS) {
    const dx = bx - ax, dy = by - ay, qx = x / SX - ax, qy = y - ay, h = clamp((qx * dx + qy * dy) / (dx * dx + dy * dy));
    s += Math.exp(-(Math.hypot(qx - dx * h, qy - dy * h) - r) / K);
  }
  return -K * Math.log(s);
}
// the loops, closer together near the features
const LEVELS = Array.from({ length: 11 }, (_, j) => 0.004 + 0.012 * j + 0.0022 * j * j);
const GLSL_FIELD = `
float field(vec2 p) {
  vec4 ab[4] = vec4[4](${FEATS.map(f => `vec4(${f.slice(0, 4).map(v => v.toFixed(5)).join(', ')})`).join(', ')});
  float rr[4] = float[4](${FEATS.map(f => f[4].toFixed(4)).join(', ')});
  float s = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 q = vec2(p.x / ${SX.toFixed(2)}, p.y) - ab[i].xy, d = ab[i].zw - ab[i].xy;
    float h = clamp(dot(q, d) / dot(d, d), 0.0, 1.0);
    s += exp(-(length(q - d * h) - rr[i]) / ${K.toFixed(3)});
  }
  return -${K.toFixed(3)} * log(s);
}
const float LV[11] = float[11](${LEVELS.map(v => v.toFixed(5)).join(', ')});`;
// when loop j is drawn, and the cross edges
const loopAt = j => 0.6 + j * 0.13, SPOKES = [1.95, 3.0], OUT = [4.42, 4.97], TURN = [3.5, 4.4];
// once the net is done the head turns away and back, to show the net wraps the surface
const turnAt = t => 0.38 - 0.3 * Math.sin(Math.PI * span(t, ...TURN)) ** 2;

export default {
  name: 'Retopology',
  ko: '리토폴로지',
  three(renderer, W, H) {
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas'); bg.width = 270; bg.height = 480;
    const b = bg.getContext('2d'), grd = b.createRadialGradient(135, 190, 10, 135, 220, 330);
    grd.addColorStop(0, '#2C3340'); grd.addColorStop(1, '#0D1016');
    b.fillStyle = grd; b.fillRect(0, 0, 270, 480);
    scene.background = new THREE.CanvasTexture(bg); scene.background.colorSpace = THREE.SRGBColorSpace;
    const camera = new THREE.PerspectiveCamera(26, W / H, 0.1, 50);
    camera.position.set(0, 0.4, 10.2);
    camera.lookAt(0, -0.13, 0);
    const head = new THREE.Group();
    head.rotation.set(0.04, 0.38, 0);
    head.position.y = 0.05;
    scene.add(head);

    // the sculpt: an icosphere whose vertices are nudged sideways at random (same nudge for shared corners)
    const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
    let geo = mergeVertices(new THREE.IcosahedronGeometry(1, 70).deleteAttribute('normal').deleteAttribute('uv'));
    const p = geo.attributes.position, d = new THREE.Vector3(), tx = new THREE.Vector3(), ty = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      d.fromBufferAttribute(p, i).normalize();
      tx.set(-d.z, 0, d.x).normalize(); if (!isFinite(tx.x) || tx.lengthSq() < 0.5) tx.set(1, 0, 0);
      ty.crossVectors(d, tx);
      const a = hash(d.x, d.y, d.z) * TAU, m = 0.009 * hash(d.y, d.z, d.x);
      d.addScaledVector(tx, Math.cos(a) * m).addScaledVector(ty, Math.sin(a) * m).normalize();
      d.multiplyScalar(radius(d));
      p.setXYZ(i, d.x, d.y, d.z);
    }
    geo.computeVertexNormals();
    geo = geo.toNonIndexed();
    const bary = new Float32Array(geo.attributes.position.count * 3);
    for (let i = 0; i < bary.length / 3; i++) bary[i * 3 + (i % 3)] = 1;
    geo.setAttribute('bary', new THREE.BufferAttribute(bary, 3));
    const triCount = geo.attributes.position.count / 3;

    const uDense = { value: 1 }, uLoops = { value: new Float32Array(LEVELS.length) }, uNet = { value: 1 };
    const mat = new THREE.ShaderMaterial({
      uniforms: { uDense, uLoops, uNet },
      vertexShader: `attribute vec3 bary; varying vec3 vB, vN, vP, vO;
        void main() { vB = bary; vO = position; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform float uDense, uNet; uniform float uLoops[${LEVELS.length}]; varying vec3 vB, vN, vP, vO;
        ${GLSL_FIELD}
        void main() {
          vec3 n = normalize(vN), v = normalize(cameraPosition - vP), l = normalize(vec3(-0.5, 0.7, 0.6));
          float dif = max(dot(n, l), 0.0), wrap = 0.5 + 0.5 * dot(n, l);
          vec3 col = vec3(0.56, 0.6, 0.68) * (0.18 + 0.6 * dif + 0.25 * wrap) + pow(max(dot(n, normalize(l + v)), 0.0), 40.0) * 0.12;
          col += vec3(0.4, 0.5, 0.7) * pow(1.0 - max(dot(n, v), 0.0), 3.0) * 0.25;
          // the dense triangles: thin dark lines
          vec3 e = vB / fwidth(vB);
          float tri = 1.0 - smoothstep(0.0, 0.9, min(min(e.x, e.y), e.z));
          col = mix(col, col * 0.45, tri * 0.75 * uDense);
          // the edge loops: level sets of the field, each drawn round its own centre as it appears
          if (vO.z > 0.0) {
            float F = field(vO.xy), w = fwidth(F);
            for (int j = 0; j < ${LEVELS.length}; j++) {
              float c = LV[j];
              float line = 1.0 - smoothstep(0.7 * w, 1.9 * w, abs(F - c));
              col = mix(col, vec3(0.3, 1.0, 0.72), line * uLoops[j] * uNet);
            }
          }
          gl_FragColor = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);
        }`,
    });
    head.add(new THREE.Mesh(geo, mat));

    // a point of the face plane (x, y) on the surface: march along +z to the head
    const onSurface = (x, y, lift = 0.004) => {
      let lo = 0, hi = 1.4;
      for (let k = 0; k < 30; k++) {
        const z = (lo + hi) / 2, v = new THREE.Vector3(x, y, z), r = v.length();
        if (r < radius(v.clone().normalize())) lo = z; else hi = z;
      }
      const v = new THREE.Vector3(x, y, lo); return v.multiplyScalar(1 + lift / v.length());
    };
    const grad = (x, y) => { const h = 1e-4; return [(field(x + h, y) - field(x - h, y)) / (2 * h), (field(x, y + h) - field(x, y - h)) / (2 * h)]; };
    // poles: saddles of F (gradient zero, Hessian negative)
    const poles = [];
    for (let i = 0; i < 160; i++) for (let j = 0; j < 160; j++) {
      const x = -0.6 + 1.2 * i / 159, y = -0.75 + 1.1 * j / 159, gm = Math.hypot(...grad(x, y));
      if (gm > 0.08) continue;
      const h = 1e-3, fxx = (field(x + h, y) - 2 * field(x, y) + field(x - h, y)) / h / h, fyy = (field(x, y + h) - 2 * field(x, y) + field(x, y - h)) / h / h;
      const fxy = (field(x + h, y + h) - field(x + h, y - h) - field(x - h, y + h) + field(x - h, y - h)) / (4 * h * h);
      if (fxx * fyy - fxy * fxy >= 0) continue;
      const near = poles.find(q => Math.hypot(q[0] - x, q[1] - y) < 0.1);   // keep the flattest point of each saddle
      if (!near) poles.push([x, y, gm]); else if (gm < near[2]) near.splice(0, 3, x, y, gm);
    }

    // the cross edges are gradient lines of F. Each runs from a feature's first loop to the outermost loop, so it
    // crosses every loop once and never stops in the middle of the face. Seeds: evenly along the outermost loop (traced
    // down), evenly round each feature's first loop (traced up), then through the widest remaining gap on any loop
    // (traced both ways) until no loop has a stretch longer than about 0.14 without a vertex. A line that comes within
    // DELTA of an edge already placed joins it at that loop's vertex (edge flow merging, as it does near a pole).
    const N = LEVELS.length, cMax = LEVELS[N - 1], DELTA = 0.03, GAP = 0.07;
    // a level set c as a closed polyline: along rays from (cx, cy), the first point where F rises past c
    // (rays measured in the squeezed space; step out, then bisect)
    const contour = (cx, cy, c, n = 720) => Array.from({ length: n }, (_, i) => {
      const a = TAU * i / n, at = m => field(cx + SX * m * Math.cos(a), cy + m * Math.sin(a));
      let lo = 0, hi = 0.004;
      while (at(hi) < c && hi < 1.5) { lo = hi; hi += 0.004; }
      for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (at(m) < c) lo = m; else hi = m; }
      return [cx + SX * lo * Math.cos(a), cy + lo * Math.sin(a)];
    });
    // n points evenly spaced by length along a closed polyline, starting a fraction `off` of a spacing in
    const evenly = (pts, n, off) => {
      const acc = [0];
      for (let i = 1; i <= pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i % pts.length][0] - pts[i - 1][0], pts[i % pts.length][1] - pts[i - 1][1]));
      const L = acc.at(-1), out = [];
      for (let k = 0; k < n; k++) {
        const d = L * (k + off) / n; let i = 1; while (acc[i] < d) i++;
        const f = (d - acc[i - 1]) / (acc[i] - acc[i - 1]), p = pts[i - 1], q = pts[i % pts.length];
        out.push([p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]);
      }
      return out;
    };
    // follow the gradient (in the squeezed space) up past the outermost loop or down past the innermost one;
    // returns the path from p, or null if it runs into a saddle
    const trace = ([x, y], dir) => {
      const line = [[x, y]];
      for (let k = 0; k < 4000; k++) {
        const f = field(x, y);
        if (dir > 0 ? f > cMax + 0.004 : f < LEVELS[0] - 0.002) return line;
        const [gx, gy] = grad(x, y), sx = gx * SX * SX, gl = Math.hypot(sx, gy);
        if (gl < 0.03) return null;
        x += dir * 0.0025 * sx / gl; y += dir * 0.0025 * gy / gl;
        line.push([x, y]);
      }
      return null;
    };
    const full = p => { const up = trace(p, 1), down = trace(p, -1); return up && down ? [...down.reverse(), ...up.slice(1)] : null; };
    const verts = [], segs = [], vertsAt = LEVELS.map(() => []);
    const vertex = (j, x, y) => { const v = { j, x, y }; verts.push(v); vertsAt[j].push(v); return v; };
    const nearAt = (j, x, y, d) => vertsAt[j].find(v => Math.hypot(v.x - x, v.y - y) < d);
    // add a line (inner -> outer); it is laid from loop `from` outward both ways, each way stopping where it merges
    const addLine = (line, from) => {
      if (!line) return false;
      const cr = new Array(N).fill(null);                              // where it crosses each loop
      for (let k = 1; k < line.length; k++) {
        const f0 = field(...line[k - 1]), f1 = field(...line[k]);
        LEVELS.forEach((c, j) => { if (!cr[j] && f0 < c && f1 >= c) { const u = (c - f0) / (f1 - f0); cr[j] = { k, x: line[k - 1][0] + (line[k][0] - line[k - 1][0]) * u, y: line[k - 1][1] + (line[k][1] - line[k - 1][1]) * u }; } });
      }
      if (cr.some(c => !c) || nearAt(from, cr[from].x, cr[from].y, DELTA)) return false;
      const start = vertex(from, cr[from].x, cr[from].y);
      for (const step of [1, -1]) {
        let prev = start;
        for (let j = from + step; j >= 0 && j < N; j += step) {
          const hit = nearAt(j, cr[j].x, cr[j].y, DELTA), v = hit || vertex(j, cr[j].x, cr[j].y);
          const lo = Math.min(j, j - step), inner = step > 0 ? prev : v, outer = step > 0 ? v : prev;
          segs.push({ band: lo, pts: [[inner.x, inner.y], ...line.slice(cr[lo].k, cr[lo + 1].k), [outer.x, outer.y]], inner, outer });
          if (hit) break;
          prev = v;
        }
      }
      return true;
    };
    evenly(contour(0, -0.1, cMax + 0.004), 60, 0.5).forEach(p => { const d = trace(p, -1); addLine(d && d.reverse(), N - 1); });
    FEATS.forEach(([ax, ay, bx, by], i) => evenly(contour((ax + bx) / 2 * SX, (ay + by) / 2, LEVELS[0] - 0.002, 360), [16, 16, 14, 24][i], 0.25).forEach(p => addLine(trace(p, 1), 0)));
    // fill the gaps: points of each loop (from a grid) farther than GAP from every vertex on that loop
    const samples = LEVELS.map(() => []);
    for (let x = -0.9; x <= 0.9; x += 0.005) for (let y = -0.98; y <= 0.68; y += 0.005) {
      const f = field(x, y), band = 0.003 * Math.hypot(...grad(x, y));   // within about half a grid step of the loop
      LEVELS.forEach((c, j) => { if (Math.abs(f - c) < band) samples[j].push([x, y]); });
    }
    const dead = new Set();
    for (let it = 0; it < 300; it++) {
      let best = null, bd = GAP;
      samples.forEach((pts, j) => pts.forEach((q, qi) => {
        if (dead.has(j * 1e6 + qi)) return;
        let d = 9; for (const v of vertsAt[j]) d = Math.min(d, Math.hypot(v.x - q[0], v.y - q[1]));
        if (d > bd) { bd = d; best = [j, qi]; }
      }));
      if (!best) break;
      const [j, qi] = best;
      if (!addLine(full(samples[j][qi]), j)) dead.add(j * 1e6 + qi);  // runs into a saddle: leave that point
    }
    this.quads = segs.length;
    // when each piece draws: bands from the outside in, staggered round the face; a vertex shows when an edge reaches it
    segs.forEach(sg => {
      const m = sg.pts[sg.pts.length >> 1], ang = (Math.atan2(m[1] + 0.1, m[0]) + TAU) % TAU;
      sg.r = ((N - 2 - sg.band) / (N - 1)) * 0.5 + (ang / TAU) * 0.38;
      sg.outer.r = Math.min(sg.outer.r ?? 9, sg.r); sg.inner.r = Math.min(sg.inner.r ?? 9, sg.r + 0.12);
    });
    // draw objects
    const res = new THREE.Vector2(W, H);
    const spokeMat = new LineMaterial({ color: '#4DFFB8', linewidth: 2.4, resolution: res, transparent: true });
    const spokeLines = new LineSegments2(new LineSegmentsGeometry(), spokeMat); head.add(spokeLines);
    const seg3 = segs.map(sg => sg.pts.filter((_, k) => k % 3 === 0 || k === sg.pts.length - 1).map(([x, y]) => onSurface(x, y)).reverse()); // outer -> inner
    const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0095, 10, 6), new THREE.MeshBasicMaterial({ color: '#E9FFF6' }), verts.length);
    const vert3 = verts.map(v => onSurface(v.x, v.y, 0.008));
    head.add(dots);
    const poleMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.026, 16, 10), new THREE.MeshBasicMaterial({ color: '#FF8A3D' }), Math.max(1, poles.length));
    const pole3 = poles.map(([x, y]) => onSurface(x, y, 0.01));
    head.add(poleMesh);
    this.poleCount = poles.length;
    const m4 = new THREE.Matrix4();

    return {
      scene, camera,
      update(t) {
        const out = ease.inOut(span(t, ...OUT));                        // the net leaves, the sculpt's wire comes back
        uDense.value = 1 - 0.75 * ease.inOut(span(t, 0.5, 1.0)) - 0.25 * ease.inOut(span(t, 3.0, 3.45)) + out;
        head.rotation.y = turnAt(t);
        uNet.value = 1 - out;
        LEVELS.forEach((_, j) => (uLoops.value[j] = ease.inOut(span(t, loopAt(j), loopAt(j) + 0.3))));
        const seg = [], p = span(t, SPOKES[0], SPOKES[1]);
        seg3.forEach((pts, si) => {
          const k = clamp((p - segs[si].r) / 0.12);                    // drawn from its outer end inward
          if (k <= 0) return;
          const n = Math.floor(k * (pts.length - 1));
          for (let i = 0; i < n; i++) seg.push(...pts[i].toArray(), ...pts[i + 1].toArray());
          if (n < pts.length - 1) { const f = k * (pts.length - 1) - n; seg.push(...pts[n].toArray(), ...pts[n].clone().lerp(pts[n + 1], f).toArray()); }
        });
        const g = new LineSegmentsGeometry(); if (seg.length) g.setPositions(seg);
        spokeLines.geometry.dispose(); spokeLines.geometry = g; spokeLines.visible = seg.length > 0;
        spokeMat.opacity = 1 - out;
        verts.forEach((v, i) => {
          const s = clamp((p - v.r) / 0.04) * (1 - out);
          dots.setMatrixAt(i, m4.makeScale(s, s, s).setPosition(vert3[i]));
        });
        dots.instanceMatrix.needsUpdate = true;
        pole3.forEach((q, i) => { const s = ease.outBack(span(t, 2.95 + i * 0.1, 3.25 + i * 0.1)) * (1 - out); poleMesh.setMatrixAt(i, m4.makeScale(s, s, s).setPosition(q)); });
        poleMesh.instanceMatrix.needsUpdate = true;
      },
    };
  },
  // the counters and the legend
  overlay(ctx, t, W, H) {
    const out = ease.inOut(span(t, ...OUT));
    const dense = 1 - ease.inOut(span(t, 3.0, 3.45)) + out;
    const quads = Math.round(this.quads * clamp(span(t, SPOKES[0], SPOKES[1]) * 1.1) * (1 - out));
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const box = (x, label, value, color, a) => {
      ctx.globalAlpha = a;
      ctx.font = `600 26px ${FONT.sans}`; ctx.fillStyle = 'rgba(220, 230, 245, 0.75)'; ctx.fillText(label, x, 1500);
      ctx.font = `700 52px ${FONT.mono}`; ctx.fillStyle = color; ctx.fillText(value, x, 1560);
      ctx.globalAlpha = 1;
    };
    box(W / 2 - 230, 'SCULPT · triangles', '100,820', '#C9D2E2', 0.35 + 0.65 * clamp(dense));
    box(W / 2 + 230, 'RETOPO · quads', quads.toLocaleString('en-US'), '#4DFFB8', 0.35 + 0.65 * clamp(quads / this.quads * 3));
    ctx.font = `500 30px ${FONT.sans}`; ctx.fillStyle = 'rgba(220, 230, 245, 0.55)'; ctx.fillText('→', W / 2, 1560);
    // legend
    const items = [['#4DFFB8', 'edge loops round eyes, nose and mouth'], ['#FF8A3D', 'poles where loops merge']];
    items.forEach(([c, label], i) => {
      const y = 1680 + i * 52;
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(250, y, 11, 0, TAU); ctx.fill();
      ctx.textAlign = 'left'; ctx.font = `500 30px ${FONT.sans}`; ctx.fillStyle = 'rgba(230, 236, 248, 0.85)';
      ctx.fillText(label, 280, y + 1);
    });
  },
};
