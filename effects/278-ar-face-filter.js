// AR face filter, imitated with deterministic code (no tracking network): a selfie head turns, nods and smiles while
// a face-landmark mesh (about 300 points on the face, triangulated, with brighter eye, brow, lip and jaw contours)
// rides on its surface. The filter is anchored to that tracked face: heart glasses sit on the nose bridge, bunny ears
// spring from the crown, blush fades in on the cheeks with the smile, and sparkles hang beside the eyes. Each frame
// the landmarks are computed on the deformed head and projected to the screen, exactly as a tracker would report them.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TAU, FONT, ease, span, smoothstep, rng } from '../lib/util.js';

const g2 = (x, y, sx, sy) => Math.exp(-((x / sx) ** 2 + (y / sy) ** 2));
// the head surface: a unit-sphere direction v -> a point on the face (head space), with smile weight s
function shape(vx, vy, vz, s) {
  const front = smoothstep(0.15, 0.75, vz), ax = Math.abs(vx);
  let x = vx * 0.86, y = vy * 0.98, z = vz * 0.9;
  x *= 1 - 0.16 * smoothstep(-0.2, -1, vy);                         // jaw narrows to a soft chin
  z += front * (0.08 * g2(vx, vy + 0.1, 0.07, 0.16) + 0.07 * g2(vx, vy + 0.27, 0.1, 0.07));  // small nose
  z -= front * 0.04 * g2(ax - 0.3, vy - 0.08, 0.15, 0.09);         // eye sockets
  z += front * 0.025 * g2(ax - 0.3, vy - 0.27, 0.22, 0.06);        // brow ridge
  const cheek = g2(ax - 0.4, vy + 0.18 - 0.05 * s, 0.19, 0.17);
  z += front * (0.05 + 0.035 * s) * cheek; y += front * 0.035 * s * cheek;   // the smile lifts the cheeks
  z += front * (0.05 * g2(vx, vy + 0.55, 0.24, 0.1) + 0.06 * g2(vx, vy + 0.86, 0.22, 0.12));   // lips, chin
  return new THREE.Vector3(x, y, z);
}
const onFace = (x, y, s, lift = 0) => {                              // the face point in front of (x, y)
  const p = shape(x, y, Math.sqrt(Math.max(0, 1 - x * x - y * y)), s);
  return lift ? p.add(p.clone().normalize().multiplyScalar(lift)) : p;
};
// the mouth outline at smile s: a closed curve of 48 points
const mouth = s => Array.from({ length: 48 }, (_, i) => {
  const a = (i / 48) * TAU, c = Math.cos(a), sn = Math.sin(a);
  const w = 0.15 + 0.05 * s, up = 0.03, down = 0.045 + 0.02 * s;
  const y = -0.5 + (sn > 0 ? up : down) * sn + (0.04 * s) * c * c - 0.012;
  return onFace(w * c, y, s, 0.01);
});

// the landmark mesh: a grid over the face oval, split into triangles, plus contours for eyes, brows, lips and jaw
const GRID = [], TRIS = [];
{
  const idx = {}, N = 22;
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const x = -0.72 + 1.44 * i / N, y = -0.98 + 1.78 * j / N + 0.02 * Math.sin(i * 1.7);
    if ((x / 0.7) ** 2 + ((y + 0.12) / 0.86) ** 2 < 1) { idx[`${i},${j}`] = GRID.length; GRID.push([x, y]); }
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = idx[`${i},${j}`], b = idx[`${i + 1},${j}`], c = idx[`${i},${j + 1}`], d = idx[`${i + 1},${j + 1}`];
    if (a !== undefined && b !== undefined && d !== undefined) TRIS.push([a, b, d]);
    if (a !== undefined && d !== undefined && c !== undefined) TRIS.push([a, d, c]);
  }
}
const ring = (cx, cy, rx, ry, n = 16) => Array.from({ length: n }, (_, i) => [cx + rx * Math.cos(i / n * TAU), cy + ry * Math.sin(i / n * TAU)]);
const CONTOURS = [ring(-0.3, 0.08, 0.16, 0.08), ring(0.3, 0.08, 0.16, 0.08), ring(0, -0.12, 0.7, 0.86, 40),
  Array.from({ length: 7 }, (_, i) => [-0.47 + i * 0.05, 0.27 + 0.03 * Math.sin(i / 6 * Math.PI)]),
  Array.from({ length: 7 }, (_, i) => [0.17 + i * 0.05, 0.27 + 0.03 * Math.sin(i / 6 * Math.PI)])];
const SPARKS = [[-0.62, 0.32, 1.0], [0.66, 0.42, 0.8], [-0.7, -0.15, 0.7], [0.72, -0.08, 1.0], [0.5, 0.75, 0.6]];

// the filter state at time t: on (0..1, with a spring), smile weight
const filterOn = t => ease.outBack(span(t, 1.05, 1.6)) * (1 - ease.inOut(span(t, 4.15, 4.6)));
const smile = t => smoothstep(1.9, 2.5, t) * (1 - smoothstep(3.5, 4.1, t));
const state = { pts: [], contours: [], sparks: [], on: 0, t: 0 };

export default {
  name: 'AR Face Filter',
  ko: 'AR 얼굴 필터',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas');                   // an out-of-focus room behind the selfie
    bg.width = 540; bg.height = 960;
    const g = bg.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 960);
    grd.addColorStop(0, '#F6D6C8'); grd.addColorStop(0.5, '#E9B7C4'); grd.addColorStop(1, '#B9A4D8');
    g.fillStyle = grd; g.fillRect(0, 0, 540, 960);
    const r = rng(8);
    for (let i = 0; i < 26; i++) {
      const x = r() * 540, y = r() * 700, rad = 18 + r() * 50, c = g.createRadialGradient(x, y, 0, x, y, rad);
      c.addColorStop(0, `rgba(255, 250, 235, ${0.25 + r() * 0.3})`); c.addColorStop(1, 'rgba(255, 250, 235, 0)');
      g.fillStyle = c; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    scene.background = new THREE.CanvasTexture(bg);
    scene.background.colorSpace = THREE.SRGBColorSpace;
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.5;
    const key = new THREE.DirectionalLight('#FFF0E2', 2.2);
    key.position.set(-2, 3, 5);
    scene.add(key, new THREE.HemisphereLight('#FFE8F0', '#8A6A80', 1.1));
    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
    camera.position.set(0, 0.2, 10.5);
    camera.lookAt(0, 0.1, 0);

    // ---- the head ----
    const head = new THREE.Group();
    const skin = new THREE.MeshPhysicalMaterial({ color: '#F2C4A8', roughness: 0.55, sheen: 0.5, sheenColor: new THREE.Color('#FFD8C8') });
    const faceGeo = s => {
      const geo = new THREE.SphereGeometry(1, 160, 120), p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const v = shape(p.getX(i), p.getY(i), p.getZ(i), s); p.setXYZ(i, v.x, v.y, v.z); }
      geo.computeVertexNormals();
      return geo;
    };
    const faceBase = faceGeo(0), faceSmile = faceGeo(1);
    faceBase.morphAttributes.position = [faceSmile.attributes.position];
    faceBase.morphAttributes.normal = [faceSmile.attributes.normal];
    const faceMesh = new THREE.Mesh(faceBase, skin);
    head.add(faceMesh);
    const lipGeo = s => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mouth(s), true), 96, 0.028, 10, true);
    const lips = lipGeo(0); lips.morphAttributes.position = [lipGeo(1).attributes.position];
    const lipMesh = new THREE.Mesh(lips, new THREE.MeshPhysicalMaterial({ color: '#D9737B', roughness: 0.35, clearcoat: 0.4 }));
    head.add(lipMesh);
    for (const sx of [-1, 1]) {                                       // eyes, brows, ears
      const eye = new THREE.Group();
      eye.position.copy(onFace(sx * 0.3, 0.08, 0, -0.1));
      eye.add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 32, 24), new THREE.MeshPhysicalMaterial({ color: '#FFFFFF', roughness: 0.15, clearcoat: 1 })));
      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.1, 32, 24), new THREE.MeshPhysicalMaterial({ color: '#4A2E22', roughness: 0.2, clearcoat: 1 }));
      iris.position.z = 0.106; iris.scale.z = 0.5;           // just proud of the eyeball
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 16), new THREE.MeshBasicMaterial({ color: '#100808' }));
      pupil.position.z = 0.142; pupil.scale.z = 0.4;
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), new THREE.MeshBasicMaterial({ color: '#FFFFFF' }));
      glint.position.set(-0.03, 0.035, 0.158);
      eye.add(iris, pupil, glint);
      head.add(eye);
      const brow = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 7 }, (_, i) => onFace(sx * (0.17 + i * 0.045), 0.29 + 0.03 * Math.sin(i / 6 * Math.PI), 0, 0.015))), 24, 0.016, 8);
      head.add(new THREE.Mesh(brow, new THREE.MeshStandardMaterial({ color: '#4A2E22', roughness: 0.8 })));
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 16), skin);
      ear.position.set(sx * 0.8, 0.02, -0.05); ear.scale.set(0.45, 1, 0.8);
      head.add(ear);
    }
    const hairMat = new THREE.MeshStandardMaterial({ color: '#3A2418', roughness: 0.6, envMapIntensity: 0.6 });
    const crown = new THREE.Mesh(new THREE.SphereGeometry(1.06, 96, 64, 0, TAU, 0, 1.3), hairMat);
    crown.scale.set(0.9, 0.98, 0.95); crown.rotation.x = -0.3; crown.position.set(0, 0.05, -0.04);
    const bangs = new THREE.Mesh(new THREE.SphereGeometry(1.05, 96, 64, 0, TAU, 0, 0.82), hairMat);   // fringe over the forehead
    bangs.scale.set(0.9, 0.98, 0.94); bangs.rotation.x = 0.42; bangs.position.set(0, 0.03, 0.0);
    const bob = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), hairMat);
    bob.scale.set(0.98, 1.0, 0.86); bob.position.set(0, -0.15, -0.22);
    head.add(crown, bangs, bob);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.32, 1.0, 48), skin);
    neck.position.set(0, -1.2, -0.12);
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 48), new THREE.MeshStandardMaterial({ color: '#8EC6E8', roughness: 0.9 }));
    body.position.set(0, -2.65, -0.3); body.scale.set(1.9, 1.05, 0.9);   // rounded shoulders
    scene.add(neck, body, head);

    // ---- the filter, all of it parented to the tracked head ----
    const filter = new THREE.Group();
    head.add(filter);
    const heart = new THREE.Shape();                                  // heart glasses
    heart.moveTo(0, -0.13);
    heart.bezierCurveTo(-0.08, -0.07, -0.19, 0.0, -0.17, 0.09); heart.bezierCurveTo(-0.15, 0.17, -0.04, 0.17, 0, 0.09);
    heart.bezierCurveTo(0.04, 0.17, 0.15, 0.17, 0.17, 0.09); heart.bezierCurveTo(0.19, 0.0, 0.08, -0.07, 0, -0.13);
    const lensMat = new THREE.MeshPhysicalMaterial({ color: '#FF5C9A', transparent: true, opacity: 0.55, roughness: 0.1, clearcoat: 1 });
    const rimMat = new THREE.MeshStandardMaterial({ color: '#FF2E7E', roughness: 0.3, metalness: 0.2 });
    const glasses = new THREE.Group();
    for (const sx of [-1, 1]) {
      const lens = new THREE.Mesh(new THREE.ShapeGeometry(heart, 32), lensMat);
      lens.position.set(sx * 0.3, 0.12, 0); lens.scale.setScalar(1.25);
      const rim = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(heart.getSpacedPoints(64).map(p => new THREE.Vector3(p.x * 1.25 + sx * 0.3, p.y * 1.25 + 0.12, 0)), true), 128, 0.018, 8, true), rimMat);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.75, 8), rimMat);
      arm.rotation.x = Math.PI / 2; arm.position.set(sx * 0.53, 0.2, -0.38);
      glasses.add(lens, rim, arm);
    }
    const bridge = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.016, 8, 24, Math.PI), rimMat);
    bridge.position.set(0, 0.17, 0);
    glasses.add(bridge);
    glasses.position.set(0, -0.04, onFace(0, 0.1, 0).z + 0.1);
    filter.add(glasses);
    const earMat = new THREE.MeshPhysicalMaterial({ color: '#FFFFFF', roughness: 0.6, sheen: 1, sheenColor: new THREE.Color('#FFE4EE') });
    const innerMat = new THREE.MeshStandardMaterial({ color: '#FF9EC0', roughness: 0.6 });
    const bunny = [-1, 1].map(sx => {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 0.32, 0.82, -0.1); pivot.rotation.z = -sx * 0.2;
      const outer = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.55, 12, 24), earMat);
      outer.position.y = 0.4; outer.scale.z = 0.45;
      const inner = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.42, 12, 24), innerMat);
      inner.position.set(0, 0.4, 0.05); inner.scale.z = 0.3;
      pivot.add(outer, inner);
      filter.add(pivot);
      return pivot;
    });
    const blushMat = new THREE.MeshBasicMaterial({ color: '#FF6F9A', transparent: true, opacity: 0, depthWrite: false });
    const blushTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
    blushMat.alphaMap = blushTex;
    const blush = [-1, 1].map(sx => {
      const m = new THREE.Mesh(new THREE.CircleGeometry(0.17, 32), blushMat);
      const p = onFace(sx * 0.42, -0.2, 1, 0.025);
      m.position.copy(p); m.lookAt(p.clone().multiplyScalar(2)); m.scale.y = 0.75;
      filter.add(m);
      return m;
    });

    const v = new THREE.Vector3();
    const project = (p) => { v.copy(p).applyMatrix4(head.matrixWorld).project(camera); return [(v.x * 0.5 + 0.5) * W, (0.5 - v.y * 0.5) * H]; };
    return {
      scene, camera,
      update(t) {
        const a = TAU * t / 5, s = smile(t), on = filterOn(t);
        head.rotation.set(0.07 * Math.sin(2 * a + 0.5), 0.42 * Math.sin(a), 0.09 * Math.sin(a + 1));
        head.position.y = 0.05 * Math.sin(2 * a);
        faceMesh.morphTargetInfluences[0] = s; lipMesh.morphTargetInfluences[0] = s;
        filter.visible = on > 0.001;
        glasses.position.y = 0.6 * (1 - Math.min(on, 1)); glasses.scale.setScalar(Math.max(on, 0.001));
        bunny.forEach((b, i) => { b.scale.setScalar(Math.max(on, 0.001)); b.rotation.x = 0.12 * Math.sin(2 * a + i) - 0.1; });
        blushMat.opacity = 0.5 * s * Math.min(on, 1);
        head.updateMatrixWorld();
        state.pts = GRID.map(([x, y]) => project(onFace(x, y, s, 0.01)));
        state.contours = CONTOURS.map(c => c.map(([x, y]) => project(onFace(x, y, s, 0.012))));
        state.sparks = SPARKS.map(([x, y, k]) => [...project(new THREE.Vector3(x * 1.25, y + 0.1, 0.55)), k]);
        state.on = Math.min(on, 1); state.s = s; state.t = t;
      },
    };
  },
  // the landmark mesh, the sparkles and the camera-app controls
  overlay(ctx, t, W, H) {
    const { pts, contours, sparks, on, s } = state;
    const mesh = 0.85 - 0.6 * on;
    ctx.lineWidth = 1.4; ctx.strokeStyle = `rgba(120, 255, 230, ${0.55 * mesh})`;
    ctx.beginPath();
    for (const [a, b, c] of TRIS) {
      const A = pts[a], B = pts[b], C = pts[c];
      if ((B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]) > 0) continue;   // facing away
      ctx.moveTo(...A); ctx.lineTo(...B); ctx.lineTo(...C); ctx.lineTo(...A);
    }
    ctx.stroke();
    ctx.fillStyle = `rgba(200, 255, 245, ${0.8 * mesh})`;
    for (const p of pts) { ctx.beginPath(); ctx.arc(p[0], p[1], 2.2, 0, TAU); ctx.fill(); }
    ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255, 255, 255, ${0.9 * mesh})`;
    contours.forEach((c, i) => { ctx.beginPath(); c.forEach((p, k) => (k ? ctx.lineTo(...p) : ctx.moveTo(...p))); if (i < 3) ctx.closePath(); ctx.stroke(); });
    sparks.forEach(([x, y, k], i) => {                              // sparkles: grow in with the smile, pulse gently
      const r = (22 + 10 * Math.sin(TAU * t / 5 * 2 + i * 1.3)) * k * on * (0.35 + 0.65 * s);
      if (r < 0.5) return;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.beginPath();
      for (let j = 0; j < 8; j++) { const rr = j % 2 ? r * 0.22 : r, an = j / 8 * TAU; ctx.lineTo(x + rr * Math.cos(an), y + rr * Math.sin(an)); }
      ctx.fill();
    });
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';         // tracking badge and filter carousel
    ctx.fillStyle = 'rgba(20, 16, 30, 0.45)'; ctx.beginPath(); ctx.roundRect(W / 2 - 170, 1610, 340, 56, 28); ctx.fill();
    ctx.font = `700 26px ${FONT.sans}`;
    ctx.fillStyle = `rgba(156, 255, 234, ${1 - on})`; ctx.fillText('● TRACKING · 300 POINTS', W / 2, 1639);
    ctx.fillStyle = `rgba(255, 179, 209, ${on})`; ctx.fillText('● FILTER ON', W / 2, 1639);
    [-2, -1, 0, 1, 2].forEach((k, i) => {
      const x = W / 2 + k * 150, y = 1760, big = k === 0;
      ctx.fillStyle = big ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.35)';
      ctx.beginPath(); ctx.arc(x, y, big ? 62 : 44, 0, TAU); ctx.fill();
      if (big) { ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, y, 76, 0, TAU); ctx.stroke(); }
      ctx.fillStyle = ['#9CFFEA', '#FFB3D1', '#FF5C9A', '#FFD36E', '#B9A4D8'][i];
      ctx.beginPath(); ctx.arc(x, y, big ? 40 : 28, 0, TAU); ctx.fill();
    });
  },
};
