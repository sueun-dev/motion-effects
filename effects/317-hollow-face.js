// Hollow-face illusion: a painted plaster mask turns once on a rod. The inside of the mask is painted like the outside,
// so when its hollow side faces us the brain still reads a face bulging out, and that false face seems to turn the
// other way. The mask is one height field (forehead, brow, eye sockets, nose, cheeks, lips, chin) drawn twice: the
// front surface and, 0.05 behind it, the inside with the same paint. No shadows (they would give the hollow away);
// one soft light from just above the camera. A plan view in the corner shows what really happens.
import * as THREE from 'three';
import { TAU, FONT, clamp, smoothstep } from '../lib/util.js';

const RX = 0.92, RY = 1.22, NR = 90, NA = 220;             // face outline (an ellipse), grid resolution
const taper = y => 1 - 0.24 * smoothstep(0.1, -1.0, y);   // the outline narrows toward the chin
const g2 = (x, y, cx, cy, sx, sy) => Math.exp(-((x - cx) ** 2) / (2 * sx * sx) - ((y - cy) ** 2) / (2 * sy * sy));
// height of the face at (x, y): a dome with the features added
function face(x, y) {
  const r2 = (x / (RX * taper(y))) ** 2 + (y / RY) ** 2;
  let z = 0.62 * Math.sqrt(Math.max(0, 1 - 0.78 * r2)) - 0.3;
  const tn = clamp((0.3 - y) / 0.62);                       // 0 at the bridge, 1 at the tip of the nose
  const nose = (0.06 + 0.24 * tn ** 1.3) * (y < -0.32 ? Math.exp(-(((y + 0.32) / 0.12) ** 2)) : y > 0.3 ? Math.exp(-(((y - 0.3) / 0.1) ** 2)) : 1);
  z += nose * Math.exp(-(x * x) / (2 * (0.07 + 0.07 * tn) ** 2));
  z += 0.035 * (g2(x, y, -0.12, -0.3, 0.06, 0.05) + g2(x, y, 0.12, -0.3, 0.06, 0.05));   // nostril wings
  for (const s of [-1, 1]) {
    z -= 0.13 * g2(x, y, 0.36 * s, 0.2, 0.15, 0.1);       // eye socket
    z += 0.075 * g2(x, y, 0.36 * s, 0.19, 0.09, 0.055);   // the eyeball under the lid
    z += 0.05 * g2(x, y, 0.42 * s, -0.16, 0.18, 0.16);    // cheekbone
  }
  z += 0.06 * g2(x, y, 0, 0.39, 0.5, 0.06);               // brow ridge
  z += 0.045 * g2(x, y, 0, -0.55, 0.2, 0.045) + 0.055 * g2(x, y, 0, -0.67, 0.18, 0.05);  // upper and lower lip
  z -= 0.03 * g2(x, y, 0, -0.605, 0.17, 0.014);            // the line between the lips
  z += 0.07 * g2(x, y, 0, -0.93, 0.22, 0.12);              // chin
  return z;
}

// the paint, on a canvas mapped over the face's bounding box: skin, blush, brows, open eyes, lips
function paint() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1360;
  const g = c.getContext('2d'), X = x => (x / RX + 1) / 2 * 1024, Y = y => (1 - (y / RY + 1) / 2) * 1360, S = 1024 / (2 * RX);
  const sk = g.createRadialGradient(512, 620, 80, 512, 680, 700);
  sk.addColorStop(0, '#F0CDB0'); sk.addColorStop(1, '#D9A887');
  g.fillStyle = sk; g.fillRect(0, 0, 1024, 1360);
  for (const s of [-1, 1]) {
    const b = g.createRadialGradient(X(0.42 * s), Y(-0.24), 10, X(0.42 * s), Y(-0.24), 0.26 * S);
    b.addColorStop(0, 'rgba(225, 110, 100, 0.45)'); b.addColorStop(1, 'rgba(225, 110, 100, 0)');
    g.fillStyle = b; g.fillRect(0, 0, 1024, 1360);
    g.strokeStyle = '#5A3A2A'; g.lineWidth = 0.05 * S; g.lineCap = 'round';      // brow
    g.beginPath(); g.moveTo(X(0.16 * s), Y(0.35)); g.quadraticCurveTo(X(0.36 * s), Y(0.45), X(0.56 * s), Y(0.36)); g.stroke();
    const ex = X(0.36 * s), ey = Y(0.19), ew = 0.16 * S, eh = 0.075 * S;       // almond eye
    g.save();
    g.beginPath(); g.moveTo(ex - ew, ey); g.quadraticCurveTo(ex, ey - 2 * eh, ex + ew, ey); g.quadraticCurveTo(ex, ey + 1.6 * eh, ex - ew, ey); g.closePath();
    g.fillStyle = '#F6F0E8'; g.fill();
    g.clip();
    g.fillStyle = '#4C7A93'; g.beginPath(); g.arc(ex, ey, 0.062 * S, 0, TAU); g.fill();
    g.fillStyle = '#16141A'; g.beginPath(); g.arc(ex, ey, 0.028 * S, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255, 255, 255, 0.85)'; g.beginPath(); g.arc(ex - 0.018 * S, ey - 0.018 * S, 0.011 * S, 0, TAU); g.fill();
    g.restore();
    g.strokeStyle = '#3A2620'; g.lineWidth = 0.016 * S;    // upper lid line
    g.beginPath(); g.moveTo(ex - ew, ey); g.quadraticCurveTo(ex, ey - 2 * eh, ex + ew, ey); g.stroke();
  }
  g.fillStyle = '#B9584A';                                 // lips
  g.beginPath(); g.moveTo(X(-0.21), Y(-0.6)); g.quadraticCurveTo(X(-0.1), Y(-0.5), X(0), Y(-0.545)); g.quadraticCurveTo(X(0.1), Y(-0.5), X(0.21), Y(-0.6));
  g.quadraticCurveTo(X(0), Y(-0.75), X(-0.21), Y(-0.6)); g.fill();
  g.strokeStyle = '#7A3229'; g.lineWidth = 0.012 * S;
  g.beginPath(); g.moveTo(X(-0.2), Y(-0.6)); g.quadraticCurveTo(X(0), Y(-0.625), X(0.2), Y(-0.6)); g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// the mask: front surface, inside surface 0.05 behind it (same paint), and the plaster rim between them
function mask() {
  const pos = (dz) => {
    const p = [], uv = [];
    for (let i = 0; i <= NR; i++) for (let j = 0; j <= NA; j++) {
      const r = i / NR, a = j / NA * TAU, y = RY * r * Math.sin(a), x = RX * taper(y) * r * Math.cos(a);
      p.push(x, y, face(x, y) + dz);
      uv.push((x / RX + 1) / 2, (y / RY + 1) / 2);
    }
    return [p, uv];
  };
  const idx = (flip) => {
    const ix = [];
    for (let i = 0; i < NR; i++) for (let j = 0; j < NA; j++) {
      const a = i * (NA + 1) + j, b = a + NA + 1;
      if (flip) ix.push(a, a + 1, b, b, a + 1, b + 1); else ix.push(a, b, a + 1, b, b + 1, a + 1);
    }
    return ix;
  };
  const surface = (dz, flip, mat) => {
    const [p, uv] = pos(dz), geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx(flip));
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, mat);
  };
  const mat = new THREE.MeshStandardMaterial({ map: paint(), roughness: 0.62 });
  const g = new THREE.Group();
  g.add(surface(0, false, mat), surface(-0.05, true, mat));
  const rp = [];                                           // the rim: a strip round the edge between the two surfaces
  for (let j = 0; j <= NA; j++) {
    const a = j / NA * TAU, y = RY * Math.sin(a), x = RX * taper(y) * Math.cos(a), z = face(x, y);
    rp.push(x, y, z, x, y, z - 0.05);
  }
  const rim = new THREE.BufferGeometry();
  rim.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
  const ri = [];
  for (let j = 0; j < NA; j++) { const a = 2 * j; ri.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
  rim.setIndex(ri);
  rim.computeVertexNormals();
  g.add(new THREE.Mesh(rim, new THREE.MeshStandardMaterial({ color: '#EDE4D8', roughness: 0.8, side: THREE.DoubleSide })));
  return g;
}

const spin = t => -TAU * t / 5;                            // one steady turn, clockwise seen from above

export default {
  name: 'Hollow-Face Illusion',
  ko: '할로 페이스 착시',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas');
    bg.width = 540; bg.height = 960;
    const b = bg.getContext('2d'), grd = b.createRadialGradient(270, 420, 30, 270, 480, 620);
    grd.addColorStop(0, '#3B2F45'); grd.addColorStop(0.6, '#1C1626'); grd.addColorStop(1, '#0D0B12');
    b.fillStyle = grd; b.fillRect(0, 0, 540, 960);
    scene.background = new THREE.CanvasTexture(bg);
    scene.background.colorSpace = THREE.SRGBColorSpace;

    const camera = new THREE.PerspectiveCamera(20, W / H, 0.5, 60);
    camera.position.set(0, 0.35, 15);
    camera.lookAt(0, -0.35, 0);
    const key = new THREE.DirectionalLight('#FFF3E6', 2.6);
    key.position.set(0.6, 2.2, 10);                          // just above the camera: almost no shading cue
    scene.add(key, new THREE.HemisphereLight('#FFE9D6', '#2A2030', 0.9));

    const turner = new THREE.Group();
    const m = mask();
    m.position.set(0, 0.25, -0.12);                          // turn about a line just behind the cheeks
    turner.add(m);
    const brass = new THREE.MeshStandardMaterial({ color: '#B8935A', roughness: 0.35, metalness: 0.8 });
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.8, 20), brass);
    rod.position.set(0, -1.36, -0.15);                       // from the base up to the rim under the chin
    turner.add(rod);
    scene.add(turner);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.16, 64), new THREE.MeshStandardMaterial({ color: '#2A2233', roughness: 0.5 }));
    base.position.set(0, -1.82, -0.15);
    scene.add(base);
    return {
      scene, camera,
      update(t) { turner.rotation.y = spin(t); },
    };
  },
  // which side faces us, and a plan view: the mask's cross-section turning steadily one way, its hollow side marked
  overlay(ctx, t, W, H) {
    const a = spin(t), front = Math.cos(a);                 // 1: the convex front faces the camera, -1: the hollow
    const on = [Math.max(0, front), Math.max(0, -front)];
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    [['FRONT · CONVEX 볼록', '#FFD9A8', 0], ['BACK · HOLLOW 오목', '#8FE3FF', 1]].forEach(([txt, col, i]) => {
      const y = 1612 + i * 112, k = on[i];
      ctx.fillStyle = `rgba(14, 10, 20, ${0.55 + 0.3 * k})`;
      ctx.beginPath(); ctx.roundRect(70, y - 42, 520, 84, 42); ctx.fill();
      ctx.globalAlpha = 0.3 + 0.7 * k;
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = col; ctx.font = `700 34px ${FONT.sans}`; ctx.fillText(txt, 330, y + 1);
      ctx.globalAlpha = 1;
    });
    // plan view, seen from above: camera at the bottom, the mask's horizontal section through the nose
    const cx = 850, cy = 1668, R = 112;
    ctx.fillStyle = 'rgba(14, 10, 20, 0.75)';
    ctx.beginPath(); ctx.roundRect(cx - 160, cy - 172, 320, 344, 28); ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy - 10, R, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';               // the camera
    ctx.beginPath(); ctx.moveTo(cx, cy + 128); ctx.lineTo(cx - 16, cy + 152); ctx.lineTo(cx + 16, cy + 152); ctx.fill();
    const sec = [];                                          // section of the front surface at eye height, plan scale
    for (let i = 0; i <= 40; i++) { const x = -RX + 2 * RX * i / 40; sec.push([x, face(x, -0.05) + 0.12]); }
    const P = ([x, z], off) => {                              // mask coords -> plan (rotated by the turn)
      const zz = z + off, c = Math.cos(a), s = Math.sin(a);
      const X = x * c + zz * s, Z = -x * s + zz * c;
      return [cx + X * 88, cy - 10 + Z * 88];
    };
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = '#FFD9A8'; ctx.lineWidth = 7;          // convex face
    ctx.beginPath(); sec.forEach((p, i) => (i ? ctx.lineTo(...P(p, 0)) : ctx.moveTo(...P(p, 0)))); ctx.stroke();
    ctx.strokeStyle = '#8FE3FF'; ctx.lineWidth = 4;          // hollow side
    ctx.beginPath(); sec.forEach((p, i) => (i ? ctx.lineTo(...P(p, -0.09)) : ctx.moveTo(...P(p, -0.09)))); ctx.stroke();
    const arr = TAU * 0.62;                                  // the real direction of turn: an arrow on the circle
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, cy - 10, R + 18, arr - 0.9, arr, false); ctx.stroke();
    const ax = cx + (R + 18) * Math.cos(arr), ay = cy - 10 + (R + 18) * Math.sin(arr);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.beginPath(); ctx.moveTo(ax + 14 * Math.cos(arr + 1.57), ay + 14 * Math.sin(arr + 1.57));
    ctx.lineTo(ax + 11 * Math.cos(arr), ay + 11 * Math.sin(arr)); ctx.lineTo(ax - 11 * Math.cos(arr), ay - 11 * Math.sin(arr)); ctx.fill();
    ctx.font = `600 24px ${FONT.sans}`; ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fillText('TOP VIEW · 위에서', cx, cy - 150);
  },
};
