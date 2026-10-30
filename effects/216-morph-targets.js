// Morph targets (blend shapes): every part of the face keeps a few extra copies of its vertex positions, one per
// expression, in geometry.morphAttributes, and the GPU mixes them by morphTargetInfluences. The head, mouth, lips,
// brows and eyelids all read the same four weights (smile, surprise, wink, pout), which the sliders show; the
// weights cross-fade round a 5-second cycle.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TAU, phase, smoothstep, FONT } from '../lib/util.js';

const NAMES = ['smile', 'surprise', 'wink', 'pout'];
const COLORS = ['#FF8A5B', '#5BC0EB', '#9B5DE5', '#F15BB5'];
// the four weights at time t: each expression holds for 0.8 s and cross-fades for 0.45 s into the next
function weights(t) {
  return NAMES.map((_, i) => {
    let x = t - (0.625 + 1.25 * i);
    x -= 5 * Math.round(x / 5);                                // wrap round the loop
    return smoothstep(0.85, 0.4, Math.abs(x));
  });
}

const R = 3;                                                   // head radius
// how far shape k pushes the head out at v: smile rounds both cheeks, wink squeezes the left one up
function cheeks(v, k) {
  const bump = (cx, cy, h, w) => h * Math.exp(-((v.x - cx) ** 2 + (v.y - cy) ** 2 + (v.z - 2.4) ** 2) * w);
  if (k === 1) return bump(-1.4, -0.45, 0.28, 1.6) + bump(1.4, -0.45, 0.28, 1.6);
  if (k === 3) return bump(-1.4, -0.4, 0.3, 1.8);
  return 0;
}
// a point on the front of the head at (x, y), lifted off the surface; for a mouth shape k it rides the cheek bulge too
function onFace(x, y, lift = 0.06, k = 0) {
  const v = new THREE.Vector3(x, y, Math.sqrt(Math.max(R * R - x * x - y * y, 0)));
  return v.addScaledVector(v.clone().normalize(), lift + cheeks(v, k));
}

// the mouth outline for each shape, as a closed curve of 64 points: [neutral, smile, surprise, wink, pout]
// the upper and lower lip heights blend smoothly at the corners, which are also opened up a little, so every corner
// is rounder than the lip tube is thick (a tight corner pinches the tube)
const lip = (a, up, down) => {
  const s = Math.sin(a);
  return (down + (up - down) * smoothstep(-0.5, 0.5, s) + 0.2 * (1 - smoothstep(0, 0.6, Math.abs(s)))) * s;
};
const MOUTHS = [
  a => [0.55 * Math.cos(a), -1.0 + lip(a, 0.06, 0.06)],
  a => [0.95 * Math.cos(a), -0.9 + lip(a, 0.08, 0.55) + 0.28 * Math.cos(a) ** 2],
  a => [0.42 * Math.cos(a), -1.15 + 0.55 * Math.sin(a)],
  a => [0.7 * Math.cos(a) + 0.15, -0.95 + lip(a, 0.06, 0.3) + 0.32 * Math.max(Math.cos(a), 0) ** 2],
  a => [0.2 * Math.cos(a), -1.0 + 0.2 * Math.sin(a)],
];
const LIFT = [0.06, 0.06, 0.22, 0.06, 0.3];                  // how far the lips stand off the head (the pout pushes them out)
function mouthPoints(k, lift = LIFT[k]) {
  return Array.from({ length: 64 }, (_, i) => {
    const [x, y] = MOUTHS[k]((i / 64) * TAU);
    return onFace(x, y, lift, k);
  });
}

// geometry whose base shape is shapes[0] and whose morph targets are shapes[1..]
function morphing(geos) {
  const base = geos[0];
  base.morphAttributes.position = geos.slice(1).map(g => g.attributes.position);
  base.morphAttributes.normal = geos.slice(1).map(g => g.attributes.normal);
  return base;
}
const lipsGeo = k => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mouthPoints(k), true), 128, 0.09, 10, true);
// the inside of the mouth: a ladder of rungs, each from a point on the upper lip (angle a) straight down to the
// matching point on the lower lip (angle -a), 6 rows per rung. The upper point is above the lower one in every
// shape, so the ladder fills the whole opening and never folds, even halfway between two shapes
const RUNGS = 33, ROWS = 6;
function fillGeo(k) {
  const pos = [], index = [];
  const ring = Array.from({ length: 64 }, (_, i) => MOUTHS[k]((i / 64) * TAU));
  const cx = ring.reduce((s, p) => s + p[0], 0) / 64, cy = ring.reduce((s, p) => s + p[1], 0) / 64;
  const IN = 0.93;                                             // 7 % smaller, so the sharp corners stay under the round lips
  for (let j = 0; j < RUNGS; j++) {
    const a = (j / (RUNGS - 1)) * Math.PI, [ux, uy] = MOUTHS[k](a), [lx, ly] = MOUTHS[k](-a);
    for (let r = 0; r < ROWS; r++) {
      const f = r / (ROWS - 1), x = ux + (lx - ux) * f, y = uy + (ly - uy) * f;
      const p = onFace(cx + (x - cx) * IN, cy + (y - cy) * IN, LIFT[k] - 0.02, k);
      pos.push(p.x, p.y, p.z);
    }
  }
  for (let j = 0; j < RUNGS - 1; j++) for (let r = 0; r < ROWS - 1; r++) {
    const v = j * ROWS + r;
    index.push(v, v + ROWS, v + 1, v + 1, v + ROWS, v + ROWS + 1);   // counter-clockwise seen from the front
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}
// cavity colour by row: dark at the top, a soft tongue towards the bottom (the same for every shape)
function fillColors() {
  const top = new THREE.Color('#3A0A1C'), tongue = new THREE.Color('#A8394C'), col = [];
  for (let j = 0; j < RUNGS; j++) for (let r = 0; r < ROWS; r++) {
    const c = top.clone().lerp(tongue, smoothstep(0.45, 1.0, r / (ROWS - 1)) * 0.8);
    col.push(c.r, c.g, c.b);
  }
  return new THREE.Float32BufferAttribute(col, 3);
}
// a brow: a short arc over one eye; side = -1 left, 1 right
function browGeo(side, lift, tilt, arch) {
  const pts = Array.from({ length: 9 }, (_, i) => {
    const u = i / 8 - 0.5;
    return onFace(side * (0.95 + 0.75 * u), 1.45 + lift + arch * (0.25 - u * u) + side * tilt * u, 0.08);
  });
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.08, 8, false);
}
// the head: base sphere plus displaced copies for each expression
function headGeo(k) {
  const g = new THREE.SphereGeometry(R, 96, 64), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const front = Math.max(v.z / R, 0);
    v.addScaledVector(v.clone().normalize(), cheeks(v, k));    // smile and wink: the cheeks round out
    if (k === 2) { v.y *= 1.06; v.x *= 0.97; }                                               // surprise: a longer face
    if (k === 4) { v.x *= 1 - 0.07 * front * Math.max(-v.y / R + 0.2, 0); }               // pout: the lower face draws in
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
// an eyelid: the top part of a shell round the eye, open (a thin cap) or shut (covering the front)
const lidGeo = shut => new THREE.SphereGeometry(0.52, 32, 16, 0, TAU, 0, shut ? Math.PI * 0.8 : Math.PI * 0.22);

export default {
  name: 'Morph Targets',
  ko: '모프 타깃',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    const sky = document.createElement('canvas');
    sky.width = 2; sky.height = 512;
    const g = sky.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#FFE5EC'); grd.addColorStop(0.6, '#FFC2D1'); grd.addColorStop(1, '#FB9EBB');
    g.fillStyle = grd; g.fillRect(0, 0, 2, 512);
    scene.background = new THREE.CanvasTexture(sky);
    scene.background.colorSpace = THREE.SRGBColorSpace;
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.45;
    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
    camera.position.set(0, 0.4, 21);
    camera.lookAt(0, -1.4, 0);
    const key = new THREE.DirectionalLight('#FFF1E0', 2.4);
    key.position.set(-5, 8, 9);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
    key.shadow.radius = 8;
    scene.add(key, new THREE.HemisphereLight('#FFFFFF', '#E58FA8', 1.1));
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.18 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -3.9;
    floor.receiveShadow = true;
    scene.add(floor);

    const face = new THREE.Group();
    const parts = [];                                          // meshes and which weights drive their targets
    const add = (geo, mat, drivers, parent = face) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      parent.add(m);
      parts.push({ m, drivers });
      return m;
    };
    const skin = new THREE.MeshPhysicalMaterial({ color: '#FFC857', roughness: 0.45, sheen: 0.6, sheenColor: new THREE.Color('#FFE2A8'), clearcoat: 0.3 });
    const lidMat = new THREE.MeshPhysicalMaterial({ color: '#F4B740', roughness: 0.45, sheen: 0.6, sheenColor: new THREE.Color('#FFE2A8') });
    add(morphing([0, 1, 2, 3, 4].map(headGeo)), skin, [0, 1, 2, 3]);
    // the mouth cavity is drawn after the head and ignores its depth, so the bulging cheeks can never poke through
    // it; the lips are drawn after that, over its edge
    const cavity = morphing([0, 1, 2, 3, 4].map(fillGeo));
    cavity.setAttribute('color', fillColors());
    add(cavity, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, depthTest: false, depthWrite: false }), [0, 1, 2, 3]).renderOrder = 1;
    add(morphing([0, 1, 2, 3, 4].map(lipsGeo)), new THREE.MeshStandardMaterial({ color: '#E04F6B', roughness: 0.35 }), [0, 1, 2, 3]).renderOrder = 2;
    for (const s of [-1, 1]) {
      // brows: neutral, smile (relaxed, a touch up), surprise (high, arched), wink (the winking side pulls down), pout (knit)
      const brow = morphing([browGeo(s, 0, 0, 0.15), browGeo(s, 0.08, 0, 0.2), browGeo(s, 0.38, 0, 0.4),
        browGeo(s, s < 0 ? -0.15 : 0.15, s < 0 ? -0.2 : 0.1, 0.1), browGeo(s, 0.05, 0.25, 0.05)]);
      add(brow, new THREE.MeshStandardMaterial({ color: '#5A3A22', roughness: 0.6 }), [0, 1, 2, 3]);
      const eye = new THREE.Group();
      eye.position.copy(onFace(s * 0.95, 0.65, -0.18));
      face.add(eye);
      const white = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 24), new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.15 }));
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 24), new THREE.MeshStandardMaterial({ color: '#1B1B2F', roughness: 0.1 }));
      pupil.position.set(0, 0, 0.25);                            // stays inside the shut lid (radius 0.52)
      eye.add(white, pupil);
      // the lid: shut is a morph target; the winking (left) eye also shuts for the wink, both squint a little for the smile
      const lid = morphing([lidGeo(false), lidGeo(true)]);
      const lm = add(lid, lidMat, null, eye);
      lm.rotation.x = 0.15;
      lm.userData.side = s;
    }
    face.position.y = -0.6;
    scene.add(face);

    return {
      scene, camera,
      update(t) {
        const w = weights(t), a = phase(t) * TAU;
        for (const { m, drivers } of parts) {
          if (drivers) drivers.forEach((d, i) => (m.morphTargetInfluences[i] = w[d]));
          else m.morphTargetInfluences[0] = Math.min(1, (m.userData.side < 0 ? w[2] : 0) + 0.3 * w[0]);   // the lids follow wink and smile
        }
        face.rotation.y = 0.22 * Math.sin(a);
        face.rotation.z = 0.05 * Math.sin(2 * a);
        face.position.y = -0.6 + 0.12 * Math.sin(2 * a);
      },
    };
  },
  // the four sliders under the face, with each weight
  overlay(ctx, t, W, H) {
    const w = weights(t), x0 = 230, x1 = 880, y0 = 1540;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath(); ctx.roundRect(110, y0 - 70, 860, 330, 36); ctx.fill();
    ctx.font = `600 32px ${FONT.mono}`;
    ctx.textBaseline = 'middle';
    NAMES.forEach((n, i) => {
      const y = y0 + i * 66;
      ctx.fillStyle = '#5B2A3D'; ctx.textAlign = 'left';
      ctx.fillText(n, 150, y);
      ctx.fillStyle = 'rgba(91, 42, 61, 0.15)';
      ctx.beginPath(); ctx.roundRect(x0 + 120, y - 9, x1 - x0 - 200, 18, 9); ctx.fill();
      ctx.fillStyle = COLORS[i];
      ctx.beginPath(); ctx.roundRect(x0 + 120, y - 9, Math.max((x1 - x0 - 200) * w[i], 18), 18, 9); ctx.fill();
      ctx.beginPath(); ctx.arc(x0 + 120 + (x1 - x0 - 200) * w[i], y, 17, 0, TAU); ctx.fill();
      ctx.fillStyle = '#5B2A3D'; ctx.textAlign = 'right';
      ctx.fillText(w[i].toFixed(2), 930, y);
    });
  },
};
