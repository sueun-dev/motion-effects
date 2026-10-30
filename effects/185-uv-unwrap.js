// UV unwrap: a textured mushroom made of three parts (cap, gills, stem), each with its own island in one texture
// atlas. Every vertex has two places: its 3D position on the model and its (u, v) in the atlas. Blending between the
// two lays the islands flat on the UV square, over a faint copy of the texture they sample, and folds them back.
import * as THREE from 'three';
import { TAU, FONT, rng, span, ease } from '../lib/util.js';

const S = 3.5, CY = 0.15; // the UV square's size and centre height in the scene
const CAP = { c: [0.3, 0.7], r: 0.25 }, GILL = { c: [0.76, 0.71], r: 0.19, r0: 0.055 }, STEM = { u: [0.07, 0.93], v: [0.07, 0.38] };
const TH = 1.9, RC = 1.6, HC = 1.1, YC = 0.55; // the cap dome: angle, radius, height, centre

// the atlas the model samples: three islands with their artwork, a light check grid and island outlines
function atlas(size, margin) {
  const full = size + 2 * margin, c = document.createElement('canvas');
  c.width = c.height = full;
  const g = c.getContext('2d');
  const X = u => margin + u * size, Y = v => margin + (1 - v) * size, R = r => r * size;
  g.fillStyle = '#1E2130'; g.fillRect(0, 0, full, full);
  g.fillStyle = '#272B3D'; g.fillRect(X(0), Y(1), size, size);
  // cap: red dome with white spots
  const cg = g.createRadialGradient(X(CAP.c[0]), Y(CAP.c[1]), 0, X(CAP.c[0]), Y(CAP.c[1]), R(CAP.r));
  cg.addColorStop(0, '#FF5A4F'); cg.addColorStop(0.75, '#E83A3F'); cg.addColorStop(1, '#B9233A');
  g.fillStyle = cg; g.beginPath(); g.arc(X(CAP.c[0]), Y(CAP.c[1]), R(CAP.r), 0, TAU); g.fill();
  const r = rng(11), spots = [];
  g.fillStyle = '#FFF6EC';
  for (let k = 0; k < 400 && spots.length < 16; k++) { // spots that do not touch
    const a = r() * TAU, d = Math.sqrt(r()) * 0.86 * CAP.r, s = 0.016 + 0.02 * r();
    const x = CAP.c[0] + d * Math.cos(a), y = CAP.c[1] + d * Math.sin(a);
    if (spots.some(([x2, y2, s2]) => Math.hypot(x - x2, y - y2) < s + s2 + 0.022)) continue;
    spots.push([x, y, s]);
    g.beginPath(); g.arc(X(x), Y(y), R(s), 0, TAU); g.fill();
  }
  // gills: a cream ring with radial lines
  g.fillStyle = '#F4E3C8'; g.beginPath(); g.arc(X(GILL.c[0]), Y(GILL.c[1]), R(GILL.r), 0, TAU); g.fill();
  g.strokeStyle = 'rgba(150, 105, 70, 0.55)'; g.lineWidth = 3;
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * TAU;
    g.beginPath(); g.moveTo(X(GILL.c[0] + GILL.r0 * 1.3 * Math.cos(a)), Y(GILL.c[1] + GILL.r0 * 1.3 * Math.sin(a)));
    g.lineTo(X(GILL.c[0] + GILL.r * 0.97 * Math.cos(a)), Y(GILL.c[1] + GILL.r * 0.97 * Math.sin(a))); g.stroke();
  }
  g.fillStyle = '#272B3D'; g.beginPath(); g.arc(X(GILL.c[0]), Y(GILL.c[1]), R(GILL.r0), 0, TAU); g.fill();
  // stem: cream with a face in the middle of its front
  const sg = g.createLinearGradient(0, Y(STEM.v[0]), 0, Y(STEM.v[1]));
  sg.addColorStop(0, '#E9D6B8'); sg.addColorStop(1, '#FFF4E2');
  g.fillStyle = sg; g.fillRect(X(STEM.u[0]), Y(STEM.v[1]), R(STEM.u[1] - STEM.u[0]), R(STEM.v[1] - STEM.v[0]));
  const fx = X(0.5), fy = Y(STEM.v[0] + 0.6 * (STEM.v[1] - STEM.v[0]));
  g.fillStyle = '#3A2A2A';
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(fx + s * R(0.045), fy, R(0.012), R(0.018), 0, 0, TAU); g.fill(); }
  g.strokeStyle = '#3A2A2A'; g.lineWidth = R(0.007); g.lineCap = 'round';
  g.beginPath(); g.arc(fx, fy + R(0.02), R(0.022), 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
  g.fillStyle = 'rgba(255, 120, 120, 0.45)';
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(fx + s * R(0.075), fy + R(0.02), R(0.02), R(0.012), 0, 0, TAU); g.fill(); }
  // a light check grid over everything (shows how the texture stretches), and white island outlines
  g.strokeStyle = 'rgba(255, 255, 255, 0.13)'; g.lineWidth = 2;
  for (let k = 0; k <= 16; k++) {
    g.beginPath(); g.moveTo(X(k / 16), Y(0)); g.lineTo(X(k / 16), Y(1)); g.stroke();
    g.beginPath(); g.moveTo(X(0), Y(k / 16)); g.lineTo(X(1), Y(k / 16)); g.stroke();
  }
  g.strokeStyle = 'rgba(255, 255, 255, 0.85)'; g.lineWidth = 4;
  g.beginPath(); g.arc(X(CAP.c[0]), Y(CAP.c[1]), R(CAP.r) - 2, 0, TAU); g.stroke();
  g.beginPath(); g.arc(X(GILL.c[0]), Y(GILL.c[1]), R(GILL.r) - 2, 0, TAU); g.stroke();
  g.beginPath(); g.arc(X(GILL.c[0]), Y(GILL.c[1]), R(GILL.r0) + 2, 0, TAU); g.stroke();
  g.strokeRect(X(STEM.u[0]) + 2, Y(STEM.v[1]) + 2, R(STEM.u[1] - STEM.u[0]) - 4, R(STEM.v[1] - STEM.v[0]) - 4);
  return { c, X, Y, R, g };
}

// an island: an na x nb grid of points, each with a 3D position (model space) and a UV position
function island(na, nb, f) {
  const n = (na + 1) * (nb + 1), p3 = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = [];
  for (let i = 0; i <= na; i++) for (let j = 0; j <= nb; j++) {
    const [p, q] = f(i / na, j / nb), o = i * (nb + 1) + j;
    p3.set(p, o * 3); uv.set(q, o * 2);
    if (i < na && j < nb) idx.push(o, o + 1, o + nb + 1, o + 1, o + nb + 2, o + nb + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setIndex(idx);
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return { geo, p3, uv, n };
}

export default {
  name: 'UV Unwrap',
  ko: 'UV 펼치기',
  three(renderer, W, H) {
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas'); bg.width = bg.height = 512;
    const b = bg.getContext('2d'), grd = b.createRadialGradient(256, 240, 20, 256, 256, 380);
    grd.addColorStop(0, '#2E3350'); grd.addColorStop(1, '#10121C');
    b.fillStyle = grd; b.fillRect(0, 0, 512, 512);
    scene.background = new THREE.CanvasTexture(bg); scene.background.colorSpace = THREE.SRGBColorSpace;
    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
    camera.position.set(0, CY + 1.2, 13.4);
    camera.lookAt(0, CY, 0);
    scene.add(new THREE.HemisphereLight('#FFFFFF', '#5A4A6A', 1.6));
    const key = new THREE.DirectionalLight('#FFF1E2', 1.6);
    key.position.set(-3, 5, 6);
    scene.add(key);

    const A = atlas(1024, 0), tex = new THREE.CanvasTexture(A.c);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, side: THREE.DoubleSide });

    // the parts: (a, b) grid parameters -> [3D point, uv]
    const islands = [
      island(40, 96, (a, b) => { // cap dome, apex to rim; flattened as a disc (front edge at the bottom)
        const th = a * TH, rho = RC * Math.sin(th), ang = TAU * b;
        return [[rho * Math.sin(ang), YC + HC * Math.cos(th), rho * Math.cos(ang)],
          [CAP.c[0] + CAP.r * a * Math.sin(ang), CAP.c[1] - CAP.r * a * Math.cos(ang)]];
      }),
      island(16, 96, (a, b) => { // gills, rim to stem, under the cap; flattened as a ring (front edge at the top)
        const rho = RC * Math.sin(TH) * (1 - a) + 0.42 * a, ang = TAU * b;
        const y = YC + HC * Math.cos(TH) + 0.26 * a - 0.06 * Math.sin(Math.PI * a), rr = GILL.r - (GILL.r - GILL.r0) * a;
        return [[rho * Math.sin(ang), y, rho * Math.cos(ang)], [GILL.c[0] + rr * Math.sin(ang), GILL.c[1] + rr * Math.cos(ang)]];
      }),
      island(30, 96, (a, b) => { // stem, bottom to top, cut down the back; flattened as a strip
        const rho = 0.56 - 0.14 * a + 0.1 * Math.sin(Math.PI * a), ang = TAU * b;
        return [[-rho * Math.sin(ang), -1.55 + 2.05 * a, -rho * Math.cos(ang)],
          [STEM.u[0] + (STEM.u[1] - STEM.u[0]) * b, STEM.v[0] + (STEM.v[1] - STEM.v[0]) * a]];
      }),
    ];
    const model = new THREE.Group();
    for (const is of islands) model.add(new THREE.Mesh(is.geo, mat));
    scene.add(model);

    // the UV square behind the flat islands: a faint copy of the atlas, its border and axis labels
    const M = 120, B = atlas(1024, M);
    const lab = B.g;
    lab.fillStyle = 'rgba(255, 255, 255, 0.9)'; lab.font = `500 54px ${FONT.sans}`; lab.textBaseline = 'middle';
    lab.strokeStyle = 'rgba(255, 255, 255, 0.9)'; lab.lineWidth = 5; lab.strokeRect(M, M, 1024, 1024);
    lab.textAlign = 'center';
    lab.fillText('0', M - 34, M + 1024 + 40); lab.fillText('1', M + 1024, M + 1024 + 56); lab.fillText('1', M - 40, M);
    lab.font = `italic 600 60px ${FONT.serif}`;
    lab.fillText('u', M + 512, M + 1024 + 66); lab.fillText('v', M - 60, M + 512);
    const backTex = new THREE.CanvasTexture(B.c); backTex.colorSpace = THREE.SRGBColorSpace; backTex.anisotropy = 8;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(S * (1024 + 2 * M) / 1024, S * (1024 + 2 * M) / 1024),
      new THREE.MeshBasicMaterial({ map: backTex, transparent: true, depthWrite: false }));
    back.position.set(0, CY, -0.02);
    scene.add(back);

    const v3 = new THREE.Vector3(), lift = [0.9, 0.5, 0.0]; // islands bow towards the camera on the way
    return {
      scene, camera,
      update(t) {
        // turn half a turn into the front pose, unwrap, hold, fold, turn on (it is symmetric, so the loop joins)
        const sine = k => Math.sin(k * Math.PI / 2);
        const turn = TAU * (0.5 + 0.5 * sine(span(t, 0, 1.0)) + 0.5 * (1 - sine(1 - span(t, 4.0, 5.0))));
        const rot = new THREE.Matrix4().makeRotationY(turn);
        islands.forEach((is, k) => {
          const f = ease.inOut(span(t, 1.1 + 0.15 * k, 1.9 + 0.15 * k)) - ease.inOut(span(t, 3.2 - 0.15 * k, 4.0 - 0.15 * k));
          const pos = is.geo.attributes.position.array;
          for (let i = 0; i < is.n; i++) {
            v3.fromArray(is.p3, i * 3).applyMatrix4(rot);
            const fx = (is.uv[i * 2] - 0.5) * S, fy = (is.uv[i * 2 + 1] - 0.5) * S + CY;
            pos[i * 3] = v3.x + (fx - v3.x) * f;
            pos[i * 3 + 1] = v3.y + (fy - v3.y) * f;
            pos[i * 3 + 2] = v3.z * (1 - f) + lift[k] * Math.sin(Math.PI * f) + 0.01 * k * f;
          }
          is.geo.attributes.position.needsUpdate = true;
          is.geo.computeVertexNormals();
          is.geo.computeBoundingSphere();
        });
        back.material.opacity = 0.32 * ease.inOut(span(t, 1.6, 2.2)) * (1 - ease.inOut(span(t, 2.9, 3.4)));
        back.visible = back.material.opacity > 0.001;
      },
    };
  },
};
