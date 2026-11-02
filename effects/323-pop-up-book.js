// Pop-up book: a red cloth book opens to a right angle, the back page standing up as a dusk sky, the front page lying
// as a meadow. Paper structures rise from the fold with parallel folds: every crease runs parallel to the spine, so each
// piece is a chain of panels that alternately follow the floor page and the back page. Two towers and two tree rows
// are single box folds, the gate and the keep are one stepped fold, and the cut-outs above them (roofs, trees and a
// dragon on the keep) are carried up by the panels they grow from. Closing the book folds every chain flat again.
// A side view below draws the stepped fold's chain of parallelograms as the book turns.
import * as THREE from 'three';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { TAU, FONT, canvas, rng, span } from '../lib/util.js';

const PW = 3.2, D = 3.0, PX = 360;          // page width (x) and depth, texture px per unit
const O = { y: 0.104, z: 0 };               // the spine line where the pieces are hinged
const T0 = 0.3;                             // the loop starts just after the cover begins to lift
const SUB = 24;                              // renders averaged over each frame's 1/30 s (a film shutter)
const BG = '#2C2420';
let diagram = null, diagramSum = null;        // the side view is drawn here, several instants averaged
// the paper pieces: boxes { x0, x1, a (depth on the floor page), b (height on the back page), e (cut-out above) }
const BOXES = [
  { x0: -1.52, x1: -1.04, a: 1.3, b: 0.16, e: 0.95, kind: 'trees' },
  { x0: 1.04, x1: 1.52, a: 1.3, b: 0.16, e: 0.95, kind: 'trees', flip: true },
  { x0: -0.98, x1: -0.64, a: 1.0, b: 1.12, e: 0.46, kind: 'tower' },
  { x0: 0.64, x1: 0.98, a: 1.0, b: 1.12, e: 0.46, kind: 'tower' },
];
const STEP = { x0: -0.6, x1: 0.6, a1: 0.78, h1: 0.55, a2: 0.4, h2: 1.02, e: 0.88 }; // gate wall, then the keep, dragon on top

// openness 0 (closed) .. 1 (back page upright) at local time u
const sine = k => (1 - Math.cos(Math.PI * k)) / 2;  // gentler at its fastest than a cubic ease
const openAt = u => sine(span(u, 0, 1.8)) * (1 - sine(span(u, 2.9, 4.7)));
// the fold angle at time t: 0 shut .. pi/2 with the back page upright
const thAt = t => Math.max(0.004, openAt((t + T0) % 5) * Math.PI / 2);

function tex(w, h, draw) {
  const c = canvas(Math.round(w * PX), Math.round(h * PX)), g = c.getContext('2d');
  draw(g, c.width, c.height);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
// printed stone: a pale wash with soft, large mottling (no fine lines, so nothing crawls when the panels swing)
function stone(g, w, h, base = '#BDB5C9') {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  const r = rng(Math.round(w + h));
  for (let i = 0; i < 18; i++) {
    const x = r() * w, y = r() * h, rr = 40 + r() * 70, gr = g.createRadialGradient(x, y, 0, x, y, rr);
    gr.addColorStop(0, r() < 0.4 ? 'rgba(90, 80, 120, 0.06)' : 'rgba(255, 255, 255, 0.1)'); gr.addColorStop(1, 'rgba(255, 255, 255, 0)');
    g.fillStyle = gr; g.fillRect(x - rr, y - rr, 2 * rr, 2 * rr);
  }
}
const windowLit = (g, x, y, w, h) => {
  g.fillStyle = '#2E2A4A'; g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y + w / 2); g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); g.lineTo(x + w, y + h); g.fill();
  g.fillStyle = '#FFD36A'; g.beginPath(); g.moveTo(x + 4, y + h - 4); g.lineTo(x + 4, y + w / 2); g.arc(x + w / 2, y + w / 2, w / 2 - 4, Math.PI, 0); g.lineTo(x + w - 4, y + h - 4); g.fill();
};

// cut-out art above the folds: transparent round the shapes, so the paper is cut to their outline
function drawTrees(g, w, h, flip) {
  const r = rng(flip ? 8 : 3);
  if (flip) { g.translate(w, 0); g.scale(-1, 1); }
  const pine = (x, s, c) => {
    g.fillStyle = '#5A3A22'; g.fillRect(x - 6 * s, h - 40 * s, 12 * s, 40 * s);
    g.fillStyle = c; g.strokeStyle = '#1F3324'; g.lineWidth = 4;
    for (let k = 0; k < 3; k++) {
      const y0 = h - 30 * s - k * 70 * s, half = (62 - k * 14) * s;
      g.beginPath(); g.moveTo(x - half, y0); g.lineTo(x, y0 - 110 * s); g.lineTo(x + half, y0); g.closePath(); g.fill(); g.stroke();
    }
  };
  const round = (x, s) => {
    g.fillStyle = '#5A3A22'; g.fillRect(x - 7 * s, h - 90 * s, 14 * s, 90 * s);
    g.fillStyle = '#4E9A4A'; g.strokeStyle = '#1F3324'; g.lineWidth = 4;
    for (const [dx, dy, rr] of [[0, -150, 58], [-34, -120, 44], [36, -116, 46]]) { g.beginPath(); g.arc(x + dx * s, h + dy * s, rr * s, 0, TAU); g.fill(); g.stroke(); }
    g.fillStyle = '#E2584A'; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(x + (r() - 0.5) * 90 * s, h - (110 + r() * 70) * s, 6 * s, 0, TAU); g.fill(); }
  };
  pine(w * 0.28, 1.05, '#2F7A4E'); round(w * 0.66, 0.95); pine(w * 0.9, 0.7, '#3C8A58');
  g.fillStyle = '#6DB25A'; g.strokeStyle = '#1F3324'; g.lineWidth = 4; // a hedge along the fold
  g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 20) g.lineTo(x, h - 22 - 8 * Math.sin(x / 9)); g.lineTo(w, h); g.fill(); g.stroke();
}
function drawRoof(g, w, h) {
  g.strokeStyle = '#2B2238'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(w / 2, 6); g.lineTo(w / 2, h * 0.3); g.stroke();       // flag pole
  g.fillStyle = '#F2C14E'; g.beginPath(); g.moveTo(w / 2, 8); g.lineTo(w / 2 + 52, 22); g.lineTo(w / 2, 36); g.fill(); g.stroke();
  g.fillStyle = '#C8463D';
  g.beginPath(); g.moveTo(0, h); g.lineTo(w / 2, h * 0.3); g.lineTo(w, h); g.closePath(); g.fill(); g.stroke();
  g.strokeStyle = 'rgba(80, 20, 20, 0.5)'; g.lineWidth = 3;
  for (let k = 1; k < 5; k++) { const y = h * 0.3 + (h * 0.7) * k / 5, hw = (w / 2) * k / 5; g.beginPath(); g.moveTo(w / 2 - hw, y); g.lineTo(w / 2 + hw, y); g.stroke(); }
}
function drawDragon(g, w, h) {
  g.lineJoin = 'round'; g.lineCap = 'round';
  const ink = '#1E3324';
  const shape = (pts, fill) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x * w, y * h) : g.moveTo(x * w, y * h))); g.closePath(); g.fillStyle = fill; g.fill(); g.strokeStyle = ink; g.lineWidth = 5; g.stroke(); };
  // wings: bat wings from the shoulders, scalloped trailing edges
  shape([[0.48, 0.55], [0.3, 0.12], [0.08, 0.02], [0.14, 0.2], [0.12, 0.33], [0.2, 0.36], [0.22, 0.5], [0.32, 0.5], [0.4, 0.62]], '#2F6D46');
  shape([[0.56, 0.55], [0.72, 0.1], [0.95, 0.0], [0.9, 0.2], [0.94, 0.33], [0.84, 0.36], [0.83, 0.5], [0.72, 0.5], [0.64, 0.62]], '#2F6D46');
  g.strokeStyle = '#7BC48A'; g.lineWidth = 3;
  for (const [a, b] of [[[0.46, 0.55], [0.14, 0.2]], [[0.46, 0.55], [0.2, 0.36]], [[0.58, 0.55], [0.9, 0.2]], [[0.58, 0.55], [0.84, 0.36]]]) { g.beginPath(); g.moveTo(a[0] * w, a[1] * h); g.lineTo(b[0] * w, b[1] * h); g.stroke(); }
  // tail curling off to the right, body, neck and head to the left, belly scales, legs standing on the fold
  g.strokeStyle = ink; g.lineWidth = 34; g.beginPath(); g.moveTo(0.62 * w, 0.82 * h); g.bezierCurveTo(0.85 * w, 0.95 * h, 0.98 * w, 0.75 * h, 0.9 * w, 0.62 * h); g.stroke();
  g.strokeStyle = '#3F9152'; g.lineWidth = 24; g.stroke();
  g.fillStyle = '#3F9152'; g.strokeStyle = ink; g.lineWidth = 5;
  g.beginPath(); g.ellipse(0.52 * w, 0.76 * h, 0.17 * w, 0.13 * h, -0.1, 0, TAU); g.fill(); g.stroke();
  g.strokeStyle = ink; g.lineWidth = 40; g.beginPath(); g.moveTo(0.42 * w, 0.72 * h); g.quadraticCurveTo(0.3 * w, 0.62 * h, 0.27 * w, 0.42 * h); g.stroke();
  g.strokeStyle = '#3F9152'; g.lineWidth = 30; g.stroke();
  g.fillStyle = '#3F9152'; g.beginPath(); g.ellipse(0.24 * w, 0.37 * h, 0.08 * w, 0.06 * h, -0.3, 0, TAU); g.fill(); g.strokeStyle = ink; g.lineWidth = 5; g.stroke();
  shape([[0.19, 0.34], [0.07, 0.38], [0.07, 0.42], [0.2, 0.43]], '#3F9152');                              // snout
  shape([[0.27, 0.32], [0.32, 0.2], [0.3, 0.33]], '#E8C35A'); shape([[0.23, 0.31], [0.25, 0.19], [0.27, 0.31]], '#E8C35A'); // horns
  g.fillStyle = '#F4E06A'; g.beginPath(); g.arc(0.23 * w, 0.36 * h, 7, 0, TAU); g.fill(); g.fillStyle = ink; g.beginPath(); g.arc(0.235 * w, 0.36 * h, 3, 0, TAU); g.fill();
  shape([[0.07, 0.4], [0.0, 0.33], [0.03, 0.4], [0.0, 0.47]], '#F28C38');                                 // a puff of flame
  g.fillStyle = '#E8C35A'; g.beginPath(); g.ellipse(0.5 * w, 0.8 * h, 0.1 * w, 0.06 * h, -0.1, 0, TAU); g.fill();
  for (const x of [0.42, 0.6]) { g.strokeStyle = ink; g.lineWidth = 26; g.beginPath(); g.moveTo(x * w, 0.8 * h); g.lineTo(x * w, h - 6); g.stroke(); g.strokeStyle = '#3F9152'; g.lineWidth = 16; g.stroke(); }
  g.fillStyle = '#E8C35A'; for (let k = 0; k < 6; k++) shape([[0.42 + k * 0.035, 0.66 - Math.sin(k / 5 * Math.PI) * 0.02], [0.435 + k * 0.035, 0.6 - Math.sin(k / 5 * Math.PI) * 0.03], [0.45 + k * 0.035, 0.66 - Math.sin(k / 5 * Math.PI) * 0.02]], '#E8C35A');
}

export default {
  name: 'Pop-up Book',
  ko: '팝업북',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 60);
    const sun = new THREE.DirectionalLight('#FFF1DC', 2.6);
    sun.position.set(-3.5, 7, 6); sun.target.position.set(0, 0.6, 1);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 20 });
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02; sun.shadow.radius = 5;
    scene.add(sun, sun.target, new THREE.HemisphereLight('#FFF4E6', '#5A4636', 1.0));

    // the desk
    const desk = tex(4, 4, (g, w, h) => {
      g.fillStyle = '#5B3A26'; g.fillRect(0, 0, w, h);
      const r = rng(5);
      for (let i = 0; i < 120; i++) { const y = r() * h; g.strokeStyle = `rgba(${r() < 0.5 ? '30, 15, 8' : '140, 95, 60'}, ${0.04 + 0.05 * r()})`; g.lineWidth = 1 + r() * 4; g.beginPath(); for (let x = 0; x <= w; x += 40) g.lineTo(x, y + 8 * Math.sin(x / 200 + i)); g.stroke(); }
    });
    desk.wrapS = desk.wrapT = THREE.RepeatWrapping; desk.repeat.set(10, 10);
    const table = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ map: desk, roughness: 0.7 }));
    table.rotation.x = -Math.PI / 2; table.position.y = -0.045; table.receiveShadow = true; scene.add(table);

    // the printed pages and the covers
    const edge = tex(1, 0.1, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#F2EBDA'); gr.addColorStop(1, '#DCD0B6'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    const meadow = tex(PW, D, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#6FA85A'); gr.addColorStop(1, '#8CC06C');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = '#5E93C8'; g.beginPath(); g.ellipse(w / 2, h * 0.3, w * 0.36, h * 0.12, 0, 0, TAU); g.fill();       // the moat
      g.fillStyle = '#8CC06C'; g.beginPath(); g.ellipse(w / 2, h * 0.27, w * 0.31, h * 0.09, 0, 0, TAU); g.fill();
      g.fillStyle = '#E3C78E'; g.beginPath(); g.moveTo(w * 0.44, h * 0.26); g.lineTo(w * 0.56, h * 0.26); g.lineTo(w * 0.66, h); g.lineTo(w * 0.34, h); g.fill(); // the road
      g.fillStyle = '#A0784A'; g.fillRect(w * 0.44, h * 0.36, w * 0.12, h * 0.05);                                         // the bridge
      const r = rng(4);
      for (let i = 0; i < 70; i++) { g.fillStyle = ['#E8D97A', '#E7A9B6', '#EDEBD8'][i % 3]; g.beginPath(); g.arc(r() * w, h * 0.45 + r() * h * 0.55, 5 + r() * 4, 0, TAU); g.fill(); }
      g.strokeStyle = '#2B2238'; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28);
    });
    const sky = tex(PW, D, (g, w, h) => {      // drawn as the back page stands: its top edge is the far edge of the page
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2C3A78'); gr.addColorStop(0.55, '#8A6AA8'); gr.addColorStop(1, '#F6B27A');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      const r = rng(6); g.fillStyle = 'rgba(255, 244, 200, 0.7)';
      for (let i = 0; i < 14; i++) { const x = r() * w, y = r() * h * 0.5, s = 3 + r() * 4; g.beginPath(); g.moveTo(x, y - s * 2); g.lineTo(x + s * 0.6, y); g.lineTo(x, y + s * 2); g.lineTo(x - s * 0.6, y); g.fill(); }
      const moon = g.createRadialGradient(w * 0.78, h * 0.18, 30, w * 0.78, h * 0.18, 110);
      moon.addColorStop(0, 'rgba(255, 236, 190, 0.75)'); moon.addColorStop(0.5, 'rgba(255, 236, 190, 0.55)'); moon.addColorStop(1, 'rgba(255, 236, 190, 0)');
      g.fillStyle = moon; g.beginPath(); g.arc(w * 0.78, h * 0.18, 110, 0, TAU); g.fill();
      g.fillStyle = '#8E6E9A';
      g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 30) g.lineTo(x, h * 0.8 - 90 * Math.abs(Math.sin(x / 260)) - 40 * Math.sin(x / 90)); g.lineTo(w, h); g.fill();
      g.strokeStyle = '#2B2238'; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28);
    });
    const cloth = tex(PW + 0.16, D + 0.1, (g, w, h) => {
      g.fillStyle = '#8E2B2B'; g.fillRect(0, 0, w, h);
      const sheen = g.createLinearGradient(0, 0, w, h); sheen.addColorStop(0, 'rgba(255, 255, 255, 0.06)'); sheen.addColorStop(1, 'rgba(0, 0, 0, 0.12)');
      g.fillStyle = sheen; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#E2B65A'; g.lineWidth = 8; g.strokeRect(50, 50, w - 100, h - 100); g.lineWidth = 3; g.strokeRect(70, 70, w - 140, h - 140);
      g.fillStyle = '#E2B65A'; g.textAlign = 'center'; g.font = `700 112px ${FONT.serif}`;
      g.fillText('The Dragon', w / 2, h * 0.42); g.fillText('Castle', w / 2, h * 0.42 + 130);
      g.font = `500 54px ${FONT.ko}`; g.fillText('용의 성 · 팝업북', w / 2, h * 0.42 + 230);
    });
    const plain = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
    const paper = (map, extra = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.9, ...extra });
    const shadowy = m => { m.castShadow = m.receiveShadow = true; return m; };
    const coverMat = paper(cloth), boardEdge = plain('#7A2424');
    const slab = (mats, w, h, d, x, y, z, parent) => {
      const m = shadowy(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats)); m.position.set(x, y, z); parent.add(m); return m;
    };
    // the front half lies on the desk: a page block printed with the meadow, on its cover board
    slab([paper(edge), paper(edge), paper(meadow), boardEdge, paper(edge), paper(edge)], PW, 0.1, D, 0, 0.05, D / 2, scene);
    slab(boardEdge, PW + 0.16, 0.04, D + 0.1, 0, -0.02, D / 2 + 0.03, scene);
    // the back half turns on the spine: its page faces down (the sky) and its cover faces up (the title)
    const back = new THREE.Group(); back.position.set(0, O.y, 0); scene.add(back);
    slab([paper(edge), paper(edge), boardEdge, paper(sky), paper(edge), paper(edge)], PW, 0.1, D, 0, 0.054, D / 2, back);
    slab([boardEdge, boardEdge, coverMat, boardEdge, boardEdge, boardEdge], PW + 0.16, 0.04, D + 0.1, 0, 0.124, D / 2 + 0.03, back);

    // the paper pieces: each panel is a quad whose corners are set every frame from the fold angle
    const quads = [];
    const quad = (map, x0, x1) => {
      const geo = new THREE.PlaneGeometry(1, 1);
      const m = shadowy(new THREE.Mesh(geo, paper(map, { side: THREE.DoubleSide, alphaTest: 0.5 })));
      scene.add(m); quads.push(m); m.userData = { x0, x1 };
      return m;
    };
    const setQuad = (m, p, q) => { // p: bottom edge (y, z), q: top edge
      const a = m.geometry.attributes.position, { x0, x1 } = m.userData;
      a.setXYZ(0, x0, q[0], q[1]); a.setXYZ(1, x1, q[0], q[1]); a.setXYZ(2, x0, p[0], p[1]); a.setXYZ(3, x1, p[0], p[1]);
      a.needsUpdate = true; m.geometry.computeVertexNormals(); m.geometry.computeBoundingSphere();
    };
    const pieces = BOXES.map(b => {
      const w = b.x1 - b.x0;
      const frontTex = b.kind === 'trees' ? tex(w, b.b, (g, W2, H2) => { g.fillStyle = '#6DB25A'; g.fillRect(0, 0, W2, H2); })
        : tex(w, b.b, (g, W2, H2) => { stone(g, W2, H2); windowLit(g, W2 / 2 - 22, H2 * 0.2, 44, 80); windowLit(g, W2 / 2 - 16, H2 * 0.55, 32, 56); });
      const topTex = tex(w, b.a, (g, W2, H2) => { if (b.kind === 'trees') { g.fillStyle = '#7DBB62'; g.fillRect(0, 0, W2, H2); } else stone(g, W2, H2, '#CFC8DA'); });
      const extTex = tex(w, b.e, (g, W2, H2) => (b.kind === 'trees' ? drawTrees(g, W2, H2, b.flip) : drawRoof(g, W2, H2)));
      return { ...b, front: quad(frontTex, b.x0, b.x1), top: quad(topTex, b.x0, b.x1), ext: quad(extTex, b.x0, b.x1) };
    });
    const s = STEP, sw = s.x1 - s.x0;
    const step = {
      gate: quad(tex(sw, s.h1, (g, w, h) => { stone(g, w, h); g.fillStyle = '#3A2A1E'; g.beginPath(); g.moveTo(w / 2 - 60, h); g.lineTo(w / 2 - 60, h * 0.4); g.arc(w / 2, h * 0.4, 60, Math.PI, 0); g.lineTo(w / 2 + 60, h); g.fill();
        g.strokeStyle = '#8A6A3A'; g.lineWidth = 4; for (let x = w / 2 - 48; x < w / 2 + 60; x += 24) { g.beginPath(); g.moveTo(x, h * 0.3); g.lineTo(x, h); g.stroke(); }
        windowLit(g, 50, h * 0.3, 34, 60); windowLit(g, w - 84, h * 0.3, 34, 60); }), s.x0, s.x1),
      ledge: quad(tex(sw, s.a1 - s.a2, (g, w, h) => { stone(g, w, h, '#CFC8DA'); }), s.x0, s.x1),
      keep: quad(tex(sw, s.h2, (g, w, h) => { stone(g, w, h); windowLit(g, w * 0.25 - 24, h * 0.18, 48, 90); windowLit(g, w * 0.75 - 24, h * 0.18, 48, 90); windowLit(g, w / 2 - 30, h * 0.52, 60, 110);
        g.fillStyle = '#B33A3A'; g.fillRect(w / 2 - 34, h * 0.06, 68, 34); }), s.x0, s.x1),
      roof: quad(tex(sw, s.a2, (g, w, h) => { stone(g, w, h, '#CFC8DA'); }), s.x0, s.x1),
      dragon: quad(tex(sw, s.e, drawDragon), s.x0, s.x1),
    };
    // a point on the pop-up plane: f along the floor page, b up the back page (uB at angle th from the floor)
    const P = (th, f, b) => [O.y + 0.004 + b * Math.sin(th), O.z + f + b * Math.cos(th)];
    const pose = th => {
      back.rotation.x = -th;
      for (const b of pieces) {
        const p0 = P(th, b.a, 0), p1 = P(th, b.a, b.b), p2 = P(th, 0, b.b);
        setQuad(b.front, p0, p1); setQuad(b.top, p2, p1); setQuad(b.ext, p1, P(th, b.a, b.b + b.e));
      }
      const q0 = P(th, s.a1, 0), q1 = P(th, s.a1, s.h1), q2 = P(th, s.a2, s.h1), q3 = P(th, s.a2, s.h1 + s.h2), q4 = P(th, 0, s.h1 + s.h2);
      setQuad(step.gate, q0, q1); setQuad(step.ledge, q2, q1); setQuad(step.keep, q2, q3); setQuad(step.roof, q4, q3);
      setQuad(step.dragon, q3, P(th, s.a2, s.h1 + s.h2 + s.e));
    };

    const at = t => { // pose the book and the camera for time t
      pose(thAt(t));
      const a = TAU * t / 5; // the camera only drifts slowly from side to side
      camera.position.set(0.3 * Math.sin(a), 6.6, 10.2);
      camera.lookAt(0, 0.85, 1.0);
    };
    const frame = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
    const sum = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
    const addScene = new THREE.Scene(), flat = new THREE.Camera();
    addScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: { tex: { value: frame.texture } }, depthTest: false, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D tex; varying vec2 vUv; void main() { gl_FragColor = texture2D(tex, vUv) / ${SUB}.0; }`,
    })));
    const output = new OutputPass();
    renderer.autoClear = false;
    const bg = new THREE.Color(BG).convertSRGBToLinear();
    return {
      render(t) {
        renderer.setRenderTarget(sum); renderer.setClearColor(0x000000, 0); renderer.clear();
        for (let k = SUB - 1; k >= 0; k--) {
          at(t - (k + 0.5) / SUB / 30);
          renderer.setRenderTarget(frame); renderer.setClearColor(bg, 1); renderer.clear();
          renderer.render(scene, camera);
          renderer.setRenderTarget(sum); renderer.render(addScene, flat);
        }
        output.render(renderer, null, sum);
      },
    };
  },
  // a side view of the stepped fold: floor page, back page and the chain of panels between them, blurred over the
  // frame's 1/30 s like the picture above (12 instants averaged)
  overlay(ctx, t, W, H) {
    if (!diagram) { diagram = canvas(480, 300); diagramSum = canvas(480, 300); }
    const g = diagram.getContext('2d'), acc = diagramSum.getContext('2d'), N = 12;
    for (let k = 0; k < N; k++) {
      const th = thAt(t - (k + 0.5) / N / 30), pt = (f, b) => [60 + (f + b * Math.cos(th)) * 95, 262 - b * Math.sin(th) * 95];
      g.fillStyle = '#1C1411'; g.fillRect(0, 0, 480, 300);
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = '#C9A57A'; g.lineWidth = 6;                                                // the two pages
      g.beginPath(); g.moveTo(...pt(D * 0.62, 0)); g.lineTo(...pt(0, 0)); g.lineTo(...pt(0, D * 0.62)); g.stroke();
      const s = STEP, chain = [pt(s.a1, 0), pt(s.a1, s.h1), pt(s.a2, s.h1), pt(s.a2, s.h1 + s.h2), pt(0, s.h1 + s.h2)];
      g.strokeStyle = '#E8E2F2'; g.lineWidth = 5;
      g.beginPath(); chain.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p))); g.stroke();
      g.strokeStyle = '#7BC48A'; g.beginPath(); g.moveTo(...chain[3]); g.lineTo(...pt(s.a2, s.h1 + s.h2 + s.e)); g.stroke(); // the dragon
      g.fillStyle = '#F2C14E'; for (const p of [pt(0, 0), ...chain]) { g.beginPath(); g.arc(p[0], p[1], 7, 0, TAU); g.fill(); }
      acc.globalAlpha = 1 / (k + 1); acc.drawImage(diagram, 0, 0);
    }
    acc.globalAlpha = 1;
    ctx.save();
    ctx.fillStyle = '#1C1411'; ctx.beginPath(); ctx.roundRect(60, 1560, 960, 300, 26); ctx.fill();
    ctx.beginPath(); ctx.roundRect(60, 1560, 960, 300, 26); ctx.clip();
    ctx.drawImage(diagramSum, 60, 1560);
    ctx.font = `700 30px ${FONT.sans}`; ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'left';
    ctx.fillText('Parallel folds', 560, 1640);
    ctx.font = `500 25px ${FONT.ko}`; ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.fillText('every crease parallel to the spine', 560, 1690);
    ctx.fillText('모든 접는 선이 책등과 평행', 560, 1728);
    ctx.fillText('side view of the gate and keep', 560, 1782);
    ctx.fillText('성문과 탑을 옆에서 본 접힘', 560, 1820);
    ctx.restore();
  },
};
