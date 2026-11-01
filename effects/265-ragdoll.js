// Ragdoll: a crash-test dummy made of 16 Verlet particles is dropped onto the top of a flight of 12 steps and tumbles
// to the bottom. Its torso is a rigid cluster (every pair held at its distance), the limbs are bones of fixed length,
// and the joint limits are distance ranges between non-neighbours (the knee cannot fold past 30 cm hip-to-foot, an
// elbow cannot cross to the other shoulder) plus a hinge rule that keeps each knee bending one way. Particles collide
// with the steps, the bones with each step's nosing, with friction. Once nothing moves faster than 3 cm/s for 0.3 s
// the body is put to sleep, so it rests exactly still. Then the conveyor at the bottom carries it away and the next
// drop arrives. Simulated in setup at 600 steps a second and drawn as capsules.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { canvas } from '../lib/util.js';

const N = 12, RISE = 0.17, RUN = 0.3, HTOP = N * RISE, LAND = N * RUN, SIDE = 1.15;  // the stairs descend along +x
const SUB = 20, DT = 1 / 30 / SUB, GRAV = -9.8, LEAD = 1.0, BELT_ON = 3.5;           // the drop starts LEAD s before the loop
const V = 3.6, ramp = k => Math.min(1, Math.max(0, k)) ** 2;                     // conveyor top speed, m/s
const belt = t => V * ramp((t - BELT_ON) / 0.4) * ramp((5 - t) / 0.4);                // it runs from 3.5 to 5 s
const beltTravel = t => V * (t < BELT_ON ? 0 : t < BELT_ON + 0.4 ? (t - BELT_ON) ** 3 / 0.48 : t < 4.6 ? 0.4 / 3 + (t - BELT_ON - 0.4)
  : 0.8 / 3 + (4.2 - BELT_ON) - (5 - t) ** 3 / 0.48);                                  // its integral: 3.48 m in all

// particles: [name, forward, up, side, radius], standing pose in metres
const P = [
  ['head', 0, 1.62, 0, 0.11], ['neck', 0, 1.44, 0, 0.06], ['shL', 0, 1.40, -0.19, 0.065], ['shR', 0, 1.40, 0.19, 0.065],
  ['elL', 0, 1.13, -0.23, 0.055], ['elR', 0, 1.13, 0.23, 0.055], ['haL', 0.03, 0.87, -0.23, 0.05], ['haR', 0.03, 0.87, 0.23, 0.05],
  ['hiL', 0, 0.93, -0.1, 0.08], ['hiR', 0, 0.93, 0.1, 0.08], ['knL', 0.02, 0.5, -0.1, 0.065], ['knR', 0.02, 0.5, 0.1, 0.065],
  ['ftL', 0, 0.08, -0.1, 0.06], ['ftR', 0, 0.08, 0.1, 0.06], ['belly', 0.1, 1.17, 0, 0.1], ['back', -0.08, 1.17, 0, 0.1],
];
const I = Object.fromEntries(P.map(([n], i) => [n, i]));
const TORSO = ['neck', 'shL', 'shR', 'hiL', 'hiR', 'belly', 'back'].map(n => I[n]);
const BONES = [['head', 'neck'], ['shL', 'elL'], ['elL', 'haL'], ['shR', 'elR'], ['elR', 'haR'], ['hiL', 'knL'], ['knL', 'ftL'], ['hiR', 'knR'], ['knR', 'ftR']].map(([a, b]) => [I[a], I[b]]);
// joint limits: the head stays within -5 .. +3 cm of its rest distance to the chest; [a, b, min distance] elsewhere
const NECK = [['head', 'shL'], ['head', 'shR'], ['head', 'belly'], ['head', 'back']];
const LIMITS = [
  ['shL', 'haL', 0.16], ['shR', 'haR', 0.16], ['elL', 'shR', 0.3], ['elR', 'shL', 0.3],                      // elbows, shoulders
  ['haL', 'belly', 0.15], ['haR', 'belly', 0.15], ['haL', 'back', 0.15], ['haR', 'back', 0.15],
  ['hiL', 'ftL', 0.3], ['hiR', 'ftR', 0.3], ['knL', 'shL', 0.32], ['knR', 'shR', 0.32],                        // knees, hips
  ['knL', 'knR', 0.14], ['ftL', 'ftR', 0.12], ['knL', 'hiR', 0.16], ['knR', 'hiL', 0.16], ['knL', 'belly', 0.14], ['knR', 'belly', 0.14],
];

// every particle's position at every frame from -LEAD to 5 s
function simulate() {
  const n = P.length, x = new Float64Array(n * 3), prev = new Float64Array(n * 3), rad = P.map(p => p[4]);
  const w = P.map((_, i) => (TORSO.includes(i) ? 0.6 : 1));                          // inverse masses: the torso is heavier
  // start: 1.8 m above the top landing, pitched forward 0.25 rad and falling, the upper body moving faster so it goes
  // over head first, with a slight twist
  const tilt = 0.25;
  P.forEach(([, f, u, s], i) => {
    const X = -0.6 + f * Math.cos(tilt) + u * Math.sin(tilt), Y = HTOP + 1.8 + u * Math.cos(tilt) - f * Math.sin(tilt);
    const vx = 1.2 + 1.5 * u, vy = -0.5, vz = 0.3 * s - 0.6 * f;
    x.set([X, Y, s], i * 3); prev.set([X - vx * DT, Y - vy * DT, s - vz * DT], i * 3);
  });
  const dist = (a, b) => Math.hypot(x[a * 3] - x[b * 3], x[a * 3 + 1] - x[b * 3 + 1], x[a * 3 + 2] - x[b * 3 + 2]);
  const rest = new Map(), sticks = [], limits = LIMITS.map(([a, b, lo]) => [I[a], I[b], lo, 0]);
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) rest.set(a * n + b, dist(a, b));
  const L0 = (a, b) => rest.get(Math.min(a, b) * n + Math.max(a, b));
  TORSO.forEach((a, i) => TORSO.slice(i + 1).forEach(b => sticks.push([a, b])));
  sticks.push(...BONES);
  NECK.forEach(([a, b]) => limits.push([I[a], I[b], L0(I[a], I[b]) - 0.05, L0(I[a], I[b]) + 0.03]));

  // move a and b along their line until they are d apart (shared by inverse mass)
  const project = (a, b, d) => {
    const dx = x[b * 3] - x[a * 3], dy = x[b * 3 + 1] - x[a * 3 + 1], dz = x[b * 3 + 2] - x[a * 3 + 2], l = Math.hypot(dx, dy, dz) || 1e-9;
    const k = (l - d) / l / (w[a] + w[b]);
    x[a * 3] += dx * k * w[a]; x[a * 3 + 1] += dy * k * w[a]; x[a * 3 + 2] += dz * k * w[a];
    x[b * 3] -= dx * k * w[b]; x[b * 3 + 1] -= dy * k * w[b]; x[b * 3 + 2] -= dz * k * w[b];
  };
  const contact = new Float64Array(n), nrm = new Float64Array(n * 2);          // deepest push this step, and its normal
  const push = (i, depth, nx, ny) => {
    x[i * 3] += nx * depth; x[i * 3 + 1] += ny * depth;
    if (depth > contact[i]) { contact[i] = depth; nrm[i * 2] = nx; nrm[i * 2 + 1] = ny; }
  };
  // the solid under the stairs is a union of quadrants {x <= qx, y <= qy}: push particle i out of one
  const quadrant = (i, qx, qy) => {
    const px = x[i * 3], py = x[i * 3 + 1], r = rad[i];
    if (px <= qx && py <= qy) { if (qx - px < qy - py) push(i, qx - px + r, 1, 0); else push(i, qy - py + r, 0, 1); return; }
    const dx = px - Math.min(px, qx), dy = py - Math.min(py, qy), d = Math.hypot(dx, dy);
    if (d < r) push(i, r - d, dx / d, dy / d);
  };

  const frames = [];
  let calm = 0, asleep = false;
  for (let f = 0; f <= Math.round((5 + LEAD) * 30); f++) {
    frames.push(Float32Array.from(x));
    for (let s = 0; s < SUB; s++) {
      const t = -LEAD + (f * SUB + s) * DT, bv = belt(t) * DT;
      if (asleep && !bv) continue;
      asleep = false;
      for (let i = 0; i < n * 3; i++) {                                         // Verlet step, a little air drag
        const v = (x[i] - prev[i]) * 0.9995;
        prev[i] = x[i];
        x[i] += v + (i % 3 === 1 ? GRAV * DT * DT : 0);
      }
      contact.fill(0);
      for (let it = 0; it < 8; it++) {
        for (const [a, b] of sticks) project(a, b, L0(a, b));
        for (const [a, b, lo, hi] of limits) { const d = dist(a, b); if (d < lo) project(a, b, lo); else if (hi && d > hi) project(a, b, hi); }
        // hinge: each knee stays in front of the hip-foot line (forward = towards the belly)
        const f3 = [0, 1, 2].map(a => x[I.belly * 3 + a] - (x[I.neck * 3 + a] + x[I.hiL * 3 + a] + x[I.hiR * 3 + a]) / 3), fl = Math.hypot(...f3);
        for (const [h, k, ft] of [[I.hiL, I.knL, I.ftL], [I.hiR, I.knR, I.ftR]]) {
          const dot = [0, 1, 2].reduce((sum, a) => sum + (x[k * 3 + a] - (x[h * 3 + a] + x[ft * 3 + a]) / 2) * f3[a] / fl, 0);
          if (dot < 0) for (let a = 0; a < 3; a++) { const c = (f3[a] / fl) * dot; x[k * 3 + a] -= c * 0.6; x[h * 3 + a] += c * 0.2; x[ft * 3 + a] += c * 0.2; }
        }
        for (let i = 0; i < n; i++) {                                           // steps, floor, side walls
          for (let k = 0; k <= N; k++) quadrant(i, k * RUN, HTOP - k * RISE);
          quadrant(i, 1e9, 0);
          x[i * 3 + 2] = Math.max(-SIDE + rad[i], Math.min(SIDE - rad[i], x[i * 3 + 2]));
        }
        for (const [a, b] of BONES) for (let k = 0; k <= N; k++) {               // a bone must not cut a step's nosing
          const qx = k * RUN, qy = HTOP - k * RISE, ax = x[a * 3], ay = x[a * 3 + 1], ex = x[b * 3] - ax, ey = x[b * 3 + 1] - ay;
          const u = Math.max(0, Math.min(1, ((qx - ax) * ex + (qy - ay) * ey) / (ex * ex + ey * ey + 1e-12)));
          if (u <= 0.01 || u >= 0.99) continue;
          const dx = ax + ex * u - qx, dy = ay + ey * u - qy, d = Math.hypot(dx, dy), r = Math.min(rad[a], rad[b]), inside = dx <= 0 && dy <= 0;
          if (d >= r && !inside) continue;
          const nx = inside ? Math.SQRT1_2 : dx / d, ny = inside ? Math.SQRT1_2 : dy / d;
          const depth = (inside ? r + Math.min(-dx, -dy) : r - d) / (u * u + (1 - u) * (1 - u));
          x[a * 3] += nx * depth * (1 - u); x[a * 3 + 1] += ny * depth * (1 - u); x[b * 3] += nx * depth * u; x[b * 3 + 1] += ny * depth * u;
        }
      }
      // friction: cancel sliding (relative to the belt on the landing) up to 1.2 x the push depth
      let move = 0;
      for (let i = 0; i < n; i++) {
        const vx = x[i * 3] - prev[i * 3], vy = x[i * 3 + 1] - prev[i * 3 + 1], vz = x[i * 3 + 2] - prev[i * 3 + 2];
        move = Math.max(move, Math.hypot(vx, vy, vz));
        if (!contact[i]) continue;
        const nx = nrm[i * 2], ny = nrm[i * 2 + 1], vn = vx * nx + vy * ny, onBelt = ny > 0.9 && x[i * 3] > LAND;
        const tx = vx - vn * nx - (onBelt ? bv : 0), ty = vy - vn * ny, tl = Math.hypot(tx, ty, vz), cut = tl > 0 ? Math.min(1, (1.2 * contact[i]) / tl) : 0;
        prev[i * 3] += tx * cut; prev[i * 3 + 1] += ty * cut; prev[i * 3 + 2] += vz * cut;
      }
      // sleep: nothing faster than 3 cm/s for 0.3 s -> freeze exactly until the belt starts
      calm = move < 5e-5 ? calm + 1 : 0;
      if (calm > 0.3 / DT && !bv) { asleep = true; prev.set(x); }
    }
  }
  return frames;
}

// the crash-test target decal: black and yellow quarters in a ring
function targetTexture() {
  const c = canvas(256, 128), g = c.getContext('2d');
  g.fillStyle = '#F2C230'; g.fillRect(0, 0, 256, 128);
  for (const cx of [64, 192]) {                                   // one decal on each side of the head
    for (let q = 0; q < 4; q++) {
      g.fillStyle = q % 2 ? '#F2C230' : '#15161A';
      g.beginPath(); g.moveTo(cx, 64); g.arc(cx, 64, 22, (q * Math.PI) / 2, ((q + 1) * Math.PI) / 2); g.fill();
    }
    g.strokeStyle = '#15161A'; g.lineWidth = 3; g.beginPath(); g.arc(cx, 64, 22, 0, Math.PI * 2); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// the lab wall: white panels with a 25 cm measuring grid
function gridTexture() {
  const c = canvas(1024, 512), g = c.getContext('2d');
  g.fillStyle = '#B4BAC4'; g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i <= 32; i++) {
    g.fillStyle = i % 4 ? 'rgba(40, 44, 52, 0.22)' : 'rgba(40, 44, 52, 0.5)';
    const wpx = i % 4 ? 2 : 4;
    g.fillRect(i * 32 - wpx / 2, 0, wpx, 512);
    if (i <= 16) g.fillRect(0, i * 32 - wpx / 2, 1024, wpx);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export default {
  name: 'Ragdoll',
  ko: '래그돌',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#2B2F38');
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.4;
    const key = new THREE.DirectionalLight('#FFF4E6', 3.0);
    key.position.set(7, 9, 5);
    key.target.position.set(2.2, 0.5, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 30 });
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4;
    scene.add(key, key.target, new THREE.HemisphereLight('#DDE6FF', '#5A4E44', 0.6));

    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);   // at the foot of the stairs, looking up them
    camera.position.set(11.8, 4.5, 1.9);
    camera.lookAt(2.5, 0.8, -0.2);

    const concrete = new THREE.MeshStandardMaterial({ color: '#CFCAC2', roughness: 0.85 });
    const shade = (m, cast = true) => { m.castShadow = cast; m.receiveShadow = true; scene.add(m); return m; };
    // the stairs: a top landing, then one block per step with a yellow strip on its nosing
    const landing = shade(new THREE.Mesh(new THREE.BoxGeometry(3, HTOP, 2 * SIDE), concrete));
    landing.position.set(-1.5, HTOP / 2, 0);
    const yellow = new THREE.MeshStandardMaterial({ color: '#F2C230', roughness: 0.6 });
    for (let k = 0; k < N - 1; k++) {                                   // tread k: x from k RUN to (k+1) RUN
      const y = HTOP - (k + 1) * RISE;
      shade(new THREE.Mesh(new THREE.BoxGeometry(RUN, y, 2 * SIDE), concrete)).position.set(k * RUN + RUN / 2, y / 2, 0);
      scene.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 2 * SIDE), yellow)).children.at(-1).position.set(k * RUN + 0.025, y + 0.006, 0);
    }
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 2 * SIDE), yellow)).children.at(-1).position.set(-0.025, HTOP + 0.006, 0);
    const floor = shade(new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: '#8C8A86', roughness: 0.9 })), false);
    floor.rotation.x = -Math.PI / 2;
    const grid = new THREE.MeshStandardMaterial({ map: gridTexture(), roughness: 0.9 });
    shade(new THREE.Mesh(new THREE.PlaneGeometry(18, 9), grid), false).position.set(2, 3.5, -SIDE);     // side wall
    const end = shade(new THREE.Mesh(new THREE.PlaneGeometry(18, 9), grid), false);                    // end wall above the top landing
    end.position.set(-3, 3.5, 0); end.rotation.y = Math.PI / 2;

    // the conveyor on the landing: a ribbed rubber belt between yellow rails; it moves 6 rib spacings per loop
    const RIB = beltTravel(5) / 6;
    const ribs = canvas(64, 64), rg = ribs.getContext('2d');
    rg.fillStyle = '#26282D'; rg.fillRect(0, 0, 64, 64); rg.fillStyle = '#3A3D44'; rg.fillRect(0, 0, 12, 64);
    const beltTex = new THREE.CanvasTexture(ribs);
    beltTex.wrapS = beltTex.wrapT = THREE.RepeatWrapping; beltTex.colorSpace = THREE.SRGBColorSpace; beltTex.anisotropy = 8;
    beltTex.repeat.set(8 / RIB, 1);
    const beltMesh = shade(new THREE.Mesh(new THREE.BoxGeometry(8, 0.06, 2 * SIDE - 0.1), new THREE.MeshStandardMaterial({ map: beltTex, roughness: 0.75 })), false);
    beltMesh.position.set(LAND + 4, -0.028, 0);
    for (const z of [-SIDE + 0.03, SIDE - 0.03]) shade(new THREE.Mesh(new THREE.BoxGeometry(8, 0.1, 0.06), yellow)).position.set(LAND + 4, 0.0, z);

    // the dummy, twice: this drop, and the next one already falling in at the end of the loop
    const skin = new THREE.MeshStandardMaterial({ color: '#EDBE45', roughness: 0.45 });
    const black = new THREE.MeshStandardMaterial({ color: '#1B1C20', roughness: 0.5 });
    const headMat = new THREE.MeshStandardMaterial({ map: targetTexture(), roughness: 0.45 });
    const makeDummy = () => {
      const group = scene.add(new THREE.Group()).children.at(-1);
      const part = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; group.add(m); return m; };
      const bone = (a, b) => Math.hypot(P[I[a]][1] - P[I[b]][1], P[I[a]][2] - P[I[b]][2], P[I[a]][3] - P[I[b]][3]);
      const cap = (r, a, b) => ({ m: part(new THREE.CapsuleGeometry(r, bone(a, b), 6, 16), skin), a: I[a], b: I[b] });
      return {
        group,
        chest: part(new RoundedBoxGeometry(0.24, 0.44, 0.4, 4, 0.08), skin), pelvis: part(new RoundedBoxGeometry(0.22, 0.17, 0.34, 4, 0.06), black),
        head: part(new THREE.SphereGeometry(0.12, 32, 20), headMat), neck: cap(0.04, 'neck', 'head'),
        limbs: [cap(0.05, 'shL', 'elL'), cap(0.05, 'shR', 'elR'), cap(0.045, 'elL', 'haL'), cap(0.045, 'elR', 'haR'),
          cap(0.075, 'hiL', 'knL'), cap(0.075, 'hiR', 'knR'), cap(0.06, 'knL', 'ftL'), cap(0.06, 'knR', 'ftR')],
        joints: ['shL', 'shR', 'elL', 'elR', 'hiL', 'hiR', 'knL', 'knR'].map(j => ({ m: part(new THREE.SphereGeometry(j[0] === 'e' ? 0.055 : 0.072, 20, 12), black), i: I[j] })),
        hands: ['haL', 'haR'].map(j => ({ m: part(new THREE.SphereGeometry(0.055, 20, 12), skin), i: I[j] })),
        feet: [['ftL', 'knL'], ['ftR', 'knR']].map(([f, k]) => ({ m: part(new RoundedBoxGeometry(0.25, 0.08, 0.11, 3, 0.03), black), f: I[f], k: I[k] })),
      };
    };
    const dummies = [makeDummy(), makeDummy()];
    const v = (F, i) => new THREE.Vector3(F[i * 3], F[i * 3 + 1], F[i * 3 + 2]);
    const basis = new THREE.Matrix4(), Y = new THREE.Vector3(0, 1, 0);
    const pose = (d, F) => {
      const neck = v(F, I.neck), hip = v(F, I.hiL).add(v(F, I.hiR)).multiplyScalar(0.5);
      const up = neck.clone().sub(hip).normalize(), right = v(F, I.shR).sub(v(F, I.shL)).add(v(F, I.hiR).sub(v(F, I.hiL)));
      right.addScaledVector(up, -right.dot(up)).normalize();
      const fwd = new THREE.Vector3().crossVectors(up, right);
      basis.makeBasis(fwd, up, right);
      d.chest.quaternion.setFromRotationMatrix(basis); d.pelvis.quaternion.copy(d.chest.quaternion);
      d.chest.position.copy(hip).lerp(neck, 0.58); d.pelvis.position.copy(hip).addScaledVector(up, 0.02);
      const head = v(F, I.head), hu = head.clone().sub(neck).normalize(), hr = right.clone().addScaledVector(hu, -right.dot(hu)).normalize();
      d.head.quaternion.setFromRotationMatrix(basis.makeBasis(new THREE.Vector3().crossVectors(hu, hr), hu, hr).multiply(new THREE.Matrix4().makeRotationY(-Math.PI / 2)));
      d.head.position.copy(head).addScaledVector(hu, 0.02);
      for (const c of [d.neck, ...d.limbs]) {                       // a capsule from joint to joint
        const a = v(F, c.a), b = v(F, c.b), dir = b.clone().sub(a);
        c.m.position.copy(a).addScaledVector(dir, 0.5);
        c.m.quaternion.setFromUnitVectors(Y, dir.normalize());
      }
      d.joints.forEach(j => j.m.position.copy(v(F, j.i)));
      d.hands.forEach(j => j.m.position.copy(v(F, j.i)));
      d.feet.forEach(({ m, f, k }) => {                              // the foot points forward, square to the shin
        const shin = v(F, f).sub(v(F, k)).normalize(), toe = fwd.clone().addScaledVector(shin, -fwd.dot(shin)).normalize();
        m.quaternion.setFromRotationMatrix(basis.makeBasis(toe, shin.clone().negate(), new THREE.Vector3().crossVectors(toe, shin.clone().negate())));
        m.position.copy(v(F, f)).addScaledVector(toe, 0.06);
      });
    };

    const frames = simulate(), last = frames.length - 1;
    return {
      scene, camera,
      update(t) {
        pose(dummies[0], frames[Math.min(last, Math.round((t + LEAD) * 30))]);
        dummies[1].group.visible = t > 5 - LEAD;                       // the next drop, still above the frame until then
        if (dummies[1].group.visible) pose(dummies[1], frames[Math.round((t - 5 + LEAD) * 30)]);
        beltTex.offset.x = -beltTravel(t) / RIB;
      },
    };
  },
};
