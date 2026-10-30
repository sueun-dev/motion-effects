// Wave function collapse: every cell of an 11 x 17 board starts as a superposition of all 46 terrain tiles (each tile
// is defined by the levels of its four corners: sea, sand, grass, forest), drawn as a glass column whose height is its
// entropy. Each step collapses the cell with the fewest options left (weighted towards an island shape) and
// propagates: neighbours keep only the tiles whose shared edge matches, so nearby columns shrink. A collapsed cell's
// tile drops into place. The whole run is solved once in setup with a fixed seed and replayed by t, then rewinds.
import * as THREE from 'three';
import { TAU, rng, clamp, ease, span } from '../lib/util.js';

const NX = 11, NZ = 17, LEVEL = [-0.05, 0.16, 0.42, 0.8];
const COLOR = ['#2A86C8', '#F0CF7E', '#6DC25A', '#2F7F45'];

// the tile set: corner levels [nw, ne, se, sw], neighbouring corners at most one level apart
const TILES = [];
for (let k = 0; k < 3; k++) for (let m = 0; m < 16; m++) {
  const c = [0, 1, 2, 3].map(b => k + ((m >> b) & 1));
  if (!TILES.some(t => t.join() === c.join())) TILES.push(c);
}
const fitsRight = (a, b) => a[1] === b[0] && a[2] === b[3];   // b sits east of a
const fitsDown = (a, b) => a[3] === b[0] && a[2] === b[1];    // b sits south of a

function solve(seed) {
  const r = rng(seed), all = TILES.map((_, i) => i);
  const dom = Array.from({ length: NX * NZ }, (_, c) => {
    const x = c % NX, z = Math.floor(c / NX);
    return x === 0 || z === 0 || x === NX - 1 || z === NZ - 1 ? [0] : all.slice();   // tile 0 is open sea
  });
  const weight = (c, t) => {
    const x = c % NX - (NX - 1) / 2, z = Math.floor(c / NX) - (NZ - 1) / 2;
    const want = 4.4 * (1 - Math.hypot(x / 5.4, z / 8.4)) + 0.2;                  // high in the middle, sea at the rim
    const lv = TILES[t].reduce((s, v) => s + v, 0) / 4, flat = new Set(TILES[t]).size === 1;
    return Math.exp(-((lv - want) ** 2) / 0.35) * (flat ? 3 : 1);
  };
  const neighbours = c => {
    const x = c % NX, z = Math.floor(c / NX), out = [];
    if (x > 0) out.push([c - 1, (a, b) => fitsRight(b, a)]);
    if (x < NX - 1) out.push([c + 1, fitsRight]);
    if (z > 0) out.push([c - NX, (a, b) => fitsDown(b, a)]);
    if (z < NZ - 1) out.push([c + NX, fitsDown]);
    return out;
  };
  const propagate = start => {
    const queue = [...start];
    while (queue.length) {
      const c = queue.pop();
      for (const [n, fits] of neighbours(c)) {
        const keep = dom[n].filter(b => dom[c].some(a => fits(TILES[a], TILES[b])));
        if (!keep.length) return false;
        if (keep.length < dom[n].length) { dom[n] = keep; queue.push(n); }
      }
    }
    return true;
  };
  propagate(dom.map((_, c) => c));
  const sizes = [dom.map(d => d.length)], picks = [];
  const forest = TILES.findIndex(t => t.every(v => v === 3)), hills = [5 * NX + 5, 11 * NX + 5];
  for (;;) {
    let best = -1, bestE = Infinity;
    dom.forEach((d, c) => { if (d.length > 1) { const e = d.length + r() * 0.5; if (e < bestE) { bestE = e; best = c; } } });
    if (best < 0) break;
    if (picks.length < hills.length) best = hills[picks.length];   // the first two picks plant a forest on each hill
    const ws = dom[best].map(t => (picks.length < hills.length ? (t === forest ? 1 : 0) : weight(best, t)));
    const total = ws.reduce((a, b) => a + b, 0);
    let x = r() * total, k = 0;
    while (x > ws[k]) x -= ws[k++];
    dom[best] = [dom[best][Math.min(k, ws.length - 1)]];
    if (!propagate([best])) return null;                       // contradiction: try the next seed
    picks.push(best);
    sizes.push(dom.map(d => d.length));
  }
  return { tile: dom.map(d => d[0]), sizes, picks };
}

// a tile as a little block of land: its top bends between the four corner heights, flat-shaded
function tileGeometry(t) {
  const [nw, ne, se, sw] = TILES[t].map(v => LEVEL[v]), S = 4, g = new THREE.PlaneGeometry(1, 1, S, S).rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) + 0.5, v = p.getZ(i) + 0.5;
    p.setY(i, (nw * (1 - u) + ne * u) * (1 - v) + (sw * (1 - u) + se * u) * v);
  }
  const top = g.toNonIndexed(), pos = top.attributes.position, col = [];
  for (let i = 0; i < pos.count; i += 3) {
    const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    const lv = y < 0.0 ? 0 : y < 0.17 ? 1 : y < 0.4 ? 2 : 3;
    const c = new THREE.Color(COLOR[lv]);
    for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
  }
  top.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  top.computeVertexNormals();
  return top;
}

export default {
  name: 'Wave Function Collapse',
  ko: '파동 함수 붕괴',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas'); bg.width = 4; bg.height = 256;
    const g = bg.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#1B2A4A'); grd.addColorStop(0.55, '#3C5E8C'); grd.addColorStop(1, '#8FB7D6');
    g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
    scene.background = new THREE.CanvasTexture(bg); scene.background.colorSpace = THREE.SRGBColorSpace;
    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 100);
    scene.add(new THREE.HemisphereLight('#EAF2FF', '#2A3B55', 1.5));
    const sun = new THREE.DirectionalLight('#FFF0D8', 2.2);
    sun.position.set(-7, 6, 2);
    scene.add(sun);

    let run = null;
    for (let seed = 204; !run; seed++) run = solve(seed);
    const { tile, sizes, picks } = run, STEPS = picks.length;
    const landed = tile.map((_, c) => sizes.findIndex(s => s[c] === 1));   // the step at which each cell was decided

    const board = new THREE.Group();
    scene.add(board);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(NX + 0.6, NZ + 0.6).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#2A86C8', roughness: 0.3, transparent: true, opacity: 0.6 }));
    sea.position.y = 0.0;
    board.add(sea);
    const base = new THREE.Mesh(new THREE.BoxGeometry(NX + 0.6, 0.5, NZ + 0.6), new THREE.MeshStandardMaterial({ color: '#2B3E5E', roughness: 0.8 }));
    base.position.y = -0.33;
    board.add(base);

    const geos = new Map(), land = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 });
    const trunkM = new THREE.MeshStandardMaterial({ color: '#6B4A33' }), pineM = new THREE.MeshStandardMaterial({ color: '#2E6E44', flatShading: true });
    const wallM = new THREE.MeshStandardMaterial({ color: '#F4EDE2' }), roofM = new THREE.MeshStandardMaterial({ color: '#D9644A', flatShading: true });
    const r = rng(42);
    const cells = tile.map((t, c) => {
      if (!geos.has(t)) geos.set(t, tileGeometry(t));
      const m = new THREE.Group();
      m.add(new THREE.Mesh(geos.get(t), land));
      const lv = TILES[t];
      const forestCorners = lv.filter(v => v === 3).length, low = Math.min(...lv);
      for (let k = 0; k < (forestCorners === 4 ? 4 : forestCorners >= 2 ? 1 : 0); k++) {   // pines where the forest is
        const tree = new THREE.Group(), h = 0.34 + 0.18 * r();
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.12, h, 6), pineM); cone.position.y = 0.08 + h / 2;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.1), trunkM); stem.position.y = 0.05;
        tree.add(cone, stem);
        const u = 0.15 + 0.7 * r(), v = 0.15 + 0.7 * r();
        const [nw, ne, se, sw] = lv.map(x => LEVEL[x]);                        // stand on the tile's surface
        tree.position.set(u - 0.5, (nw * (1 - u) + ne * u) * (1 - v) + (sw * (1 - u) + se * u) * v, v - 0.5);
        m.add(tree);
      }
      if (low === 2 && forestCorners === 0 && r() < 0.6) {                    // a cottage on flat grass
        const house = new THREE.Group();
        const walls = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.22), wallM); walls.position.y = 0.09;
        const roof = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.16, 4), roofM); roof.position.y = 0.26; roof.rotation.y = Math.PI / 4;
        house.add(walls, roof);
        house.position.set((r() - 0.5) * 0.3, LEVEL[2], (r() - 0.5) * 0.3);
        house.rotation.y = r() * TAU;
        m.add(house);
      }
      m.position.set(c % NX - (NX - 1) / 2, 0, Math.floor(c / NX) - (NZ - 1) / 2);
      board.add(m);
      return m;
    });

    // superposition columns: height = log(options) / log(46), violet when undecided, cyan as options run out
    const glass = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.55, roughness: 0.2, depthWrite: false, emissive: '#4A33B0', emissiveIntensity: 0.6 });
    const cols = new THREE.InstancedMesh(new THREE.BoxGeometry(0.84, 1, 0.84).translate(0, 0.5, 0), glass, NX * NZ);
    cols.renderOrder = 2;
    board.add(cols);
    const violet = new THREE.Color('#9C86FF'), cyan = new THREE.Color('#7FE7FF'), tmp = new THREE.Color();
    const mtx = new THREE.Matrix4();

    return {
      scene, camera,
      update(t) {
        board.rotation.y = 0.2 * Math.sin(t / 5 * TAU);              // the board turns gently to and fro
        camera.position.set(0, 21, 18.5);
        camera.lookAt(0, 0, 0.9);
        // the solver's clock in steps (+6 so the last tiles land): forward over 0.3-3.7 s, rewound over 4.25-4.9 s
        const s = (STEPS + 6) * (t < 4 ? ease.inOut(span(t, 0.3, 3.7)) : 1 - ease.inOut(span(t, 4.25, 4.9)));
        const i0 = Math.floor(s), f = s - i0;
        cells.forEach((m, c) => {
          const p = clamp((s - landed[c]) / 6);                       // drop in over 6 steps after being decided
          const show = landed[c] === 0 ? 1 : p;
          m.visible = show > 0;
          m.position.y = 0.9 * (1 - ease.outBounce(show));
          m.scale.setScalar(0.4 + 0.6 * ease.out(Math.min(1, show * 1.6)));
          const sz = sizes[Math.min(i0, STEPS)][c], sz1 = sizes[Math.min(i0 + 1, STEPS)][c];
          const opts = sz + (sz1 - sz) * f;
          const h = opts > 1 ? 0.06 + 1.6 * Math.log(opts) / Math.log(TILES.length) : 0;
          mtx.makeScale(h > 0 ? 1 : 0, Math.max(h, 1e-4), h > 0 ? 1 : 0).setPosition(m.position.x, 0.02, m.position.z);
          cols.setMatrixAt(c, mtx);
          cols.setColorAt(c, tmp.copy(cyan).lerp(violet, clamp(h / 1.66)));
        });
        cols.instanceMatrix.needsUpdate = true;
        cols.instanceColor.needsUpdate = true;
      },
    };
  },
};
