// Bounding volume hierarchy: the 1,560 triangles of a teapot are sorted into a binary tree of axis-aligned boxes,
// built level by level (each box split at the median triangle along its longest axis) down to 32 leaves. The
// boxes grow out of their parents one level at a time, and the tree below fills in with them. Then three rays are
// cast from the eye at the upper left: each walks the tree nearest box first, and only the boxes it actually tests
// light up (blue = the ray enters it, red = the ray misses it), with the triangles of each leaf it opens tinted, so
// a few dozen box tests and triangle tests replace 1,560. The last ray slips through the handle and hits nothing.
// The boxes fold back into the root and the loop starts again.
import * as THREE from 'three';
import { TeapotGeometry } from 'three/addons/geometries/TeapotGeometry.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TAU, phase, FONT, clamp, smoothstep, ease } from '../lib/util.js';

const DEPTH = 5;                                                  // levels 0..5: 63 boxes, 32 leaves
const LEVEL_COL = ['#FFFFFF', '#C3A6FF', '#7FA8FF', '#56D4E8', '#7CE39A', '#FFD166'];
const BUILD0 = 0, STEP = 0.3;                                  // level L grows in [BUILD0 + (L-1)·STEP, + STEP]
const RAY0 = 1.95, RAYLEN = 0.75, FOLD0 = 4.35, FOLDSTEP = 0.13;  // three rays, then the boxes fold back by 5 s
const EYE = new THREE.Vector3(-1.85, 2.1, 1.45);                 // above and in front, to the left
const TARGETS = [new THREE.Vector3(0.3, 0.3, 0.4), new THREE.Vector3(1.9, 0.5, 0), new THREE.Vector3(-1.65, 0, 0)];   // body, spout tip, handle hole

// --- the tree, built once ---------------------------------------------------------------------------------------
const teapot = new TeapotGeometry(1, 5);
teapot.translate(-0.14, 0, 0);
const pos = teapot.attributes.position, idx = teapot.index.array;
const tris = [];
for (let i = 0; i < idx.length; i += 3) {
  const v = [0, 1, 2].map(k => new THREE.Vector3().fromBufferAttribute(pos, idx[i + k]));
  tris.push({ v, c: v[0].clone().add(v[1]).add(v[2]).divideScalar(3) });
}
const nodes = [];
function build(list, level, slot) {
  const box = new THREE.Box3();
  for (const t of list) for (const v of t.v) box.expandByPoint(v);
  const n = { box, level, slot, tris: list, kids: null, id: nodes.length };
  nodes.push(n);
  if (level < DEPTH) {
    const cb = new THREE.Box3();
    for (const t of list) cb.expandByPoint(t.c);
    const size = cb.getSize(new THREE.Vector3()), ax = size.x > size.y ? (size.x > size.z ? 'x' : 'z') : (size.y > size.z ? 'y' : 'z');
    const sorted = [...list].sort((a, b) => a.c[ax] - b.c[ax]), half = sorted.length >> 1;
    n.kids = [build(sorted.slice(0, half), level + 1, slot * 2), build(sorted.slice(half), level + 1, slot * 2 + 1)];
  }
  return n;
}
const root = build(tris, 0, 0);

// --- each ray walks the tree: nearest child first, skipping boxes that start beyond the closest hit so far ------
function rayBox(o, d, b, exit = false) {                         // slab test: where the ray enters (or leaves) box b
  let t0 = 0, t1 = Infinity;
  for (const a of ['x', 'y', 'z']) {
    const inv = 1 / d[a]; let ta = (b.min[a] - o[a]) * inv, tb = (b.max[a] - o[a]) * inv;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
  }
  return t0 <= t1 ? (exit ? t1 : t0) : null;
}
function rayTri(o, d, [a, b, c]) {                                // Möller–Trumbore
  const e1 = b.clone().sub(a), e2 = c.clone().sub(a), p = d.clone().cross(e2), det = e1.dot(p);
  if (Math.abs(det) < 1e-9) return null;
  const s = o.clone().sub(a), u = s.dot(p) / det; if (u < 0 || u > 1) return null;
  const q = s.cross(e1), v = d.dot(q) / det; if (v < 0 || u + v > 1) return null;
  const t = e2.dot(q) / det;
  return t > 1e-6 ? t : null;
}
const rays = TARGETS.map(target => {
  const d = target.clone().sub(EYE).normalize();
  const tested = [], opened = [];
  let best = Infinity, hitTri = null, triTests = 0;
  const stack = [root];
  while (stack.length) {
    const n = stack.pop(), t = rayBox(EYE, d, n.box), enter = t !== null && t < best;
    tested.push({ n, enter });
    if (!enter) continue;
    if (!n.kids) {
      opened.push(n);
      for (const tr of n.tris) { triTests++; const h = rayTri(EYE, d, tr.v); if (h !== null && h < best) { best = h; hitTri = tr; } }
    } else {
      const ta = rayBox(EYE, d, n.kids[0].box) ?? Infinity, tb = rayBox(EYE, d, n.kids[1].box) ?? Infinity;
      if (ta <= tb) stack.push(n.kids[1], n.kids[0]); else stack.push(n.kids[0], n.kids[1]);
    }
  }
  const end = EYE.clone().addScaledVector(d, best < Infinity ? best : rayBox(EYE, d, root.box, true) + 0.4);   // a miss runs out of the root box
  return { d, tested, opened, hitTri, end, triTests };
});

// --- timing -----------------------------------------------------------------------------------------------------
// how far level L has grown out of its parent (0..1)
const grown = (t, L) => (L === 0 ? 1 : t < FOLD0 ? ease.out(clamp((t - BUILD0 - (L - 1) * STEP) / STEP)) : 1 - ease.in(clamp((t - FOLD0 - (DEPTH - L) * FOLDSTEP) / FOLDSTEP)));
const rayAt = t => { const k = Math.floor((t - RAY0) / RAYLEN); return k >= 0 && k < 3 ? { k, u: t - RAY0 - k * RAYLEN } : null; };
const dimAll = t => smoothstep(RAY0 - 0.25, RAY0, t) - smoothstep(FOLD0 - 0.12, FOLD0, t);   // 1 while rays fly
// a node lights up when the ray's walk reaches it: the walk takes 0.06..0.5 s of each ray's slot
const testTime = (ray, i) => 0.06 + 0.44 * i / ray.tested.length;

export default {
  name: 'Bounding Volume Hierarchy',
  ko: '경계 볼륨 계층',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas'); bg.width = 4; bg.height = 512;
    const g = bg.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#0B1024'); grd.addColorStop(0.55, '#16204A'); grd.addColorStop(1, '#0A0E1E');
    g.fillStyle = grd; g.fillRect(0, 0, 4, 512);
    scene.background = new THREE.CanvasTexture(bg); scene.background.colorSpace = THREE.SRGBColorSpace;
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
    const key = new THREE.DirectionalLight('#FFF0DD', 2.2); key.position.set(-3, 5, 4); scene.add(key);

    const camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 100);
    const pivot = new THREE.Group(); scene.add(pivot);       // everything turns together: the camera stays put
    pivot.add(new THREE.Mesh(teapot, new THREE.MeshStandardMaterial({ color: '#D9B48F', roughness: 0.42, metalness: 0.05 })));

    // one fat-line box per node: drawn once depth-tested, once faintly through the teapot
    const edges = new LineSegmentsGeometry().setPositions([
      -1, -1, -1, 1, -1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, -1, 1, -1, -1, 1, -1, -1, -1, -1,
      -1, -1, 1, 1, -1, 1, 1, -1, 1, 1, 1, 1, 1, 1, 1, -1, 1, 1, -1, 1, 1, -1, -1, 1,
      -1, -1, -1, -1, -1, 1, 1, -1, -1, 1, -1, 1, 1, 1, -1, 1, 1, 1, -1, 1, -1, -1, 1, 1].map(v => v / 2));
    const res = new THREE.Vector2(W, H);
    const boxes = nodes.map(n => {
      const mk = ghost => new LineMaterial({ color: LEVEL_COL[n.level], linewidth: ghost ? 2 : 3.2, resolution: res, transparent: true, depthTest: !ghost, depthWrite: false });
      const front = new LineSegments2(edges, mk(false)), back = new LineSegments2(edges, mk(true));
      pivot.add(back, front);
      return { n, front, back };
    });
    // the triangles of each leaf, to tint when a ray opens it (pulled a hair forward so they never z-fight)
    const tint = new Map();
    for (const n of nodes) if (!n.kids) {
      const g2 = new THREE.BufferGeometry().setFromPoints(n.tris.flatMap(t => t.v));
      const m = new THREE.Mesh(g2, new THREE.MeshBasicMaterial({ color: '#FF9A3D', transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }));
      pivot.add(m); tint.set(n, m);
    }
    const rayLine = new LineSegments2(new LineSegmentsGeometry().setPositions([0, 0, 0, 0, 0, 1]), new LineMaterial({ color: '#FFE08A', linewidth: 4, resolution: res, transparent: true }));
    pivot.add(rayLine);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.07, 24, 16), new THREE.MeshBasicMaterial({ color: '#FFF4C8', transparent: true }));
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 24, 16), new THREE.MeshBasicMaterial({ color: '#FFF4C8' }));
    const hc = document.createElement('canvas'); hc.width = hc.height = 128;
    const hg = hc.getContext('2d'), rg = hg.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg.addColorStop(0, 'rgba(255, 220, 140, 0.9)'); rg.addColorStop(0.35, 'rgba(255, 200, 100, 0.25)'); rg.addColorStop(1, 'rgba(255, 200, 100, 0)');
    hg.fillStyle = rg; hg.fillRect(0, 0, 128, 128);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(hc), blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.setScalar(0.7);
    eye.position.copy(EYE); halo.position.copy(EYE);
    pivot.add(glow, eye, halo);

    const tmp = new THREE.Box3(), c = new THREE.Vector3(), s = new THREE.Vector3(), pc = new THREE.Vector3(), ps = new THREE.Vector3();
    return {
      scene, camera,
      update(t) {
        const a = phase(t) * TAU;
        pivot.rotation.y = 0.55 + 0.22 * Math.sin(a);              // a slow sway, spout to the back right
        camera.position.set(0, 1.6, 13.5); camera.lookAt(0, -0.55, 0);

        const deepest = t < FOLD0 ? clamp(Math.floor((t - BUILD0) / STEP) + 1, 0, DEPTH) : DEPTH;
        const dim = dimAll(t), r = rayAt(t), ray = r && rays[r.k];
        const lit = new Map();                                    // node -> { enter, age } for the current ray
        if (ray) ray.tested.forEach((e, i) => { const at = testTime(ray, i); if (r.u >= at) lit.set(e.n, { enter: e.enter, age: r.u - at }); });
        const out = r ? 1 - smoothstep(RAYLEN - 0.12, RAYLEN, r.u) : 0;   // the current ray's marks fade at its end

        for (const { n, front, back } of boxes) {
          const k = grown(t, n.level);
          const parent = n.level ? nodes.find(p => p.kids && p.kids.includes(n)) : null;
          tmp.copy(n.box);
          if (parent && k < 1) { tmp.min.lerpVectors(parent.box.min, n.box.min, k); tmp.max.lerpVectors(parent.box.max, n.box.max, k); }
          tmp.getCenter(c); tmp.getSize(s);
          for (const o of [front, back]) { o.position.copy(c); o.scale.copy(s).max(pc.setScalar(1e-4)); }
          // resting brightness: the newest level bright, older ones faint; while rays fly everything is faint
          let op = n.level === 0 ? 0.55 : n.level === deepest ? 1 : 0.32;
          op *= k > 0 ? Math.min(1, k * 1.6) : 0;
          op = op * (1 - dim) + 0.1 * dim * (k > 0 ? 1 : 0);
          let col = LEVEL_COL[n.level];
          const l = lit.get(n);
          if (l) { op = Math.max(op, (l.enter ? 1 : 0.95) * out); col = l.enter ? '#7FD3FF' : '#FF5D6E'; }
          front.material.color.set(col); back.material.color.set(col);
          front.material.opacity = op; back.material.opacity = op * 0.28;
          front.visible = back.visible = op > 0.004;
        }
        for (const [n, m] of tint) {
          const l = lit.get(n);
          m.material.opacity = l ? 0.42 * smoothstep(0, 0.08, l.age) * out : 0;
          m.visible = m.material.opacity > 0.004;
        }
        if (ray) {
          const grow = ease.out(clamp(r.u / 0.3));
          ps.copy(EYE).lerp(ray.end, grow);
          rayLine.geometry.setPositions([EYE.x, EYE.y, EYE.z, ps.x, ps.y, ps.z]);
          rayLine.material.opacity = out * smoothstep(0, 0.05, r.u);
          rayLine.visible = true;
          glow.visible = !!ray.hitTri && r.u > 0.3;
          glow.position.copy(ray.end);
          glow.scale.setScalar(0.6 + 0.6 * smoothstep(0.3, 0.42, r.u));
          glow.material.opacity = out;
        } else { rayLine.visible = false; glow.visible = false; }
      },
    };
  },
  // the tree diagram and the counters
  overlay(ctx, t, W, H) {
    const TOP = 1500, ROWH = 64, X0 = 70, X1 = W - 70;
    const at = n => [X0 + (X1 - X0) * (n.slot + 0.5) / 2 ** n.level, TOP + n.level * ROWH];
    const r = rayAt(t), ray = r && rays[r.k], dim = dimAll(t);
    const out = r ? 1 - smoothstep(RAYLEN - 0.12, RAYLEN, r.u) : 0;
    const lit = new Map();
    if (ray) ray.tested.forEach((e, i) => { const tt = testTime(ray, i); if (r.u >= tt) lit.set(e.n, e.enter); });

    ctx.fillStyle = 'rgba(8, 11, 26, 0.7)'; ctx.beginPath(); ctx.roundRect(32, 1330, W - 64, 560, 28); ctx.fill();
    ctx.lineCap = 'round';
    for (const n of nodes) {
      const k = grown(t, n.level);
      if (k <= 0 || !n.kids) continue;
      const [x, y] = at(n);
      for (const kid of n.kids) {
        const kk = grown(t, kid.level);
        if (kk <= 0) continue;
        const [x2, y2] = at(kid), on = lit.get(kid) !== undefined && lit.get(n);
        ctx.strokeStyle = on ? `rgba(127, 211, 255, ${0.25 + 0.75 * out})` : `rgba(255, 255, 255, ${0.22 * (1 - 0.4 * dim)})`;
        ctx.lineWidth = on ? 3.5 : 2;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (x2 - x) * kk, y + (y2 - y) * kk); ctx.stroke();
      }
    }
    for (const n of nodes) {
      const k = grown(t, n.level);
      if (k <= 0) continue;
      const [x, y] = at(n), p = n.level ? nodes.find(q => q.kids && q.kids.includes(n)) : null;
      const [px, py] = p ? at(p) : [x, y], cx = px + (x - px) * k, cy = py + (y - py) * k;
      const l = lit.get(n), rad = n.level < 4 ? 11 : n.level === 4 ? 9 : 7;
      ctx.globalAlpha = Math.min(1, k * 1.5) * (l === undefined ? 1 - 0.55 * dim : 1);
      ctx.fillStyle = l === undefined ? LEVEL_COL[n.level] : l ? '#7FD3FF' : '#FF5D6E';
      ctx.beginPath(); ctx.arc(cx, cy, rad, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // counters: the build, then each ray's tests against the brute-force 1,560
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    const deepest = t < FOLD0 ? clamp(Math.floor((t - BUILD0) / STEP) + 1, 0, DEPTH) : DEPTH;
    let boxesTested = 0, triTests = 0;
    if (ray) ray.tested.forEach((e, i) => { if (r.u >= testTime(ray, i)) { boxesTested++; if (!e.n.kids && e.enter) triTests += e.n.tris.length; } });
    const items = ray
      ? [['RAY', `${r.k + 1} / 3`], ['BOXES TESTED', `${boxesTested}`], ['TRIANGLES TESTED', `${triTests} / ${tris.length}`]]
      : [['LEVEL', `${deepest}`], ['BOXES', `${2 ** (deepest + 1) - 1}`], ['TRIANGLES PER LEAF', `≈ ${Math.round(tris.length / 2 ** deepest)}`]];
    const xs = [72, 300, 610];
    items.forEach(([label, v], i) => {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'; ctx.font = `600 22px ${FONT.sans}`; ctx.fillText(label, xs[i], 1380);
      ctx.fillStyle = i === 0 && ray ? '#FFE08A' : '#FFFFFF'; ctx.font = `700 40px ${FONT.mono}`; ctx.fillText(v, xs[i], 1430);
    });
    if (ray && r.u > 0.5) {
      ctx.globalAlpha = out * smoothstep(0.5, 0.58, r.u);
      ctx.fillStyle = ray.hitTri ? '#FFE08A' : '#FF8A96'; ctx.font = `700 24px ${FONT.sans}`; ctx.textAlign = 'right';
      ctx.fillText(ray.hitTri ? 'HIT' : 'MISS', W - 72, 1380);
      ctx.globalAlpha = 1;
    }
  },
};
