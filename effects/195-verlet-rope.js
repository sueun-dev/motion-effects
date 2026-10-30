// Rope & chain by Verlet integration: each line is 48 particles joined by distance constraints, its two ends held
// by cranks that turn four times per loop, the pair in opposite directions (double dutch). Gravity, a little air
// drag and the floor (with friction) do the rest: the ropes swing out, sag and slap the floor on every turn. The
// solver warms up for 24 turns in setup until the motion repeats (to about 1 cm), then one 5 s cycle is played.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TAU } from '../lib/util.js';

const N = 48, LENGTH = 5.9, SPAN = 5.2, CRANK = 0.8, AXLE = 1.25, GAP = 0.32; // AXLE: crank height, GAP: half the hand spacing
const FRAMES = 150, SUB = 24, DT = 1 / 30 / SUB, TURNS = 4, GRAV = -9.8;
const ROPES = [{ dir: 1, z: -GAP, phase: 0 }, { dir: -1, z: GAP, phase: Math.PI }];

// where the crank handle of rope k is at time t (both ends of a rope turn together)
function handle(k, side, t, out) {
  const { dir, z, phase } = ROPES[k], a = dir * (TAU * TURNS * t) / 5 + phase;
  return out.set(side * SPAN / 2, AXLE + CRANK * Math.sin(a), z + CRANK * Math.cos(a));
}

// positions of both ropes at every frame of one loop, after warming up
function simulate() {
  const seg = LENGTH / (N - 1), h = new THREE.Vector3();
  const ropes = ROPES.map((_, k) => {
    const x = [], prev = [];
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      x.push(new THREE.Vector3((u - 0.5) * SPAN, AXLE - 1.2 * Math.sin(Math.PI * u), ROPES[k].z));
      prev.push(x[i].clone());
    }
    return { x, prev };
  });
  const all = [], WARM = 6 * FRAMES; // 30 s = 24 turns of warm-up, then two loops are kept
  for (let f = 0; f < WARM + 2 * FRAMES; f++) {
    if (f >= WARM) all.push(ropes.map(r => Float32Array.from(r.x.flatMap(p => p.toArray()))));
    for (let s = 0; s < SUB; s++) {
      const t = (f * SUB + s + 1) * DT;
      ropes.forEach(({ x, prev }, k) => {
        for (let i = 1; i < N - 1; i++) { // Verlet step with air drag
          const p = x[i], v = p.clone().sub(prev[i]).multiplyScalar(0.995);
          prev[i].copy(p);
          p.add(v).y += GRAV * DT * DT;
        }
        x[0].copy(handle(k, -1, t, h)); x[N - 1].copy(handle(k, 1, t, h));
        for (let it = 0; it < 6; it++) {
          for (let i = 0; i < N - 1; i++) { // keep each link its length; the handles do not give
            const a = x[i], b = x[i + 1], d = b.clone().sub(a), len = d.length(), err = (len - seg) / len;
            const wa = i === 0 ? 0 : 1, wb = i + 1 === N - 1 ? 0 : 1;
            if (wa + wb === 0) continue;
            a.addScaledVector(d, (err * wa) / (wa + wb)); b.addScaledVector(d, (-err * wb) / (wa + wb));
          }
          for (let i = 1; i < N - 1; i++) { // the floor, with friction
            const p = x[i];
            if (p.y < 0.03) { p.y = 0.03; p.x += (prev[i].x - p.x) * 0.1; p.z += (prev[i].z - p.z) * 0.1; }
          }
        }
      });
    }
  }
  // the two loops differ by a few millimetres; blend from the second into the first so the end meets the start
  return all.slice(0, FRAMES).map((A, f) => A.map((a, r) => a.map((v, i) => v * (f / FRAMES) + all[FRAMES + f][r][i] * (1 - f / FRAMES))));
}

function floorTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d');
  for (let i = 0; i < 16; i++) { // light wooden boards
    g.fillStyle = ['#D9B48A', '#D2AC80', '#DDBA92', '#CFA87D'][i % 4];
    g.fillRect(i * 64, 0, 64, 1024);
    g.fillStyle = 'rgba(80, 50, 20, 0.25)'; g.fillRect(i * 64, 0, 2, 1024);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = 8;
  return tex;
}

export default {
  name: 'Rope & Chain',
  ko: '로프·체인',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#2C3E63');
    scene.fog = new THREE.Fog('#2C3E63', 14, 30);
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.9;
    const sun = new THREE.DirectionalLight('#FFF1DE', 1.7); // soft, faint shadows
    sun.position.set(-1, 10, 1.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 });
    sun.shadow.bias = -0.0004;
    sun.shadow.radius = 4;
    scene.add(sun, new THREE.HemisphereLight('#CFE0FF', '#5A4630', 0.6));

    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 100);
    camera.position.set(8.0, 5.6, 1.0); // looking down the span: near crank at the bottom, far crank at the top
    camera.lookAt(-0.6, 0.7, 0);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.6 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // two posts with a crank wheel for each rope
    const metal = new THREE.MeshStandardMaterial({ color: '#E8ECF2', metalness: 0.85, roughness: 0.25 });
    const red = new THREE.MeshStandardMaterial({ color: '#E2483D', roughness: 0.4 });
    const cranks = [];
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, AXLE + 0.2, 24), metal);
      post.position.set(side * (SPAN / 2 + 0.35), (AXLE + 0.2) / 2, 0);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.08, 40), metal);
      base.position.set(side * (SPAN / 2 + 0.35), 0.04, 0);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 2 * GAP + 0.3), metal);
      bar.position.set(side * (SPAN / 2 + 0.35), AXLE, 0);
      for (const m of [post, base, bar]) { m.castShadow = m.receiveShadow = true; scene.add(m); }
      ROPES.forEach((r, k) => {
        // a crank: hub, arm out to the handle where the rope is tied
        const wheel = new THREE.Group(), hub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 32).rotateZ(Math.PI / 2), red);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, CRANK), red), knob = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), metal);
        hub.position.x = arm.position.x = side * 0.12; arm.position.z = CRANK / 2; knob.position.z = CRANK; // knob at the rope's end
        wheel.add(hub, arm, knob);
        for (const m of [hub, arm, knob]) m.castShadow = true;
        wheel.position.set(side * SPAN / 2, AXLE, r.z);
        scene.add(wheel);
        cranks.push({ wheel, k });
      });
    }

    const frames = simulate();
    // rope 0: a braided rope (tube); rope 1: a steel ball chain (beads along the same kind of curve)
    const ropeMat = new THREE.MeshStandardMaterial({ color: '#FFB020', roughness: 0.55 });
    const rope = new THREE.Mesh(new THREE.BufferGeometry(), ropeMat);
    rope.castShadow = false; // a fast rope's sweeping shadow reads as flicker; the posts keep theirs
    scene.add(rope);
    const BEADS = 140, beads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 14, 10), metal, BEADS);
    beads.castShadow = false;
    beads.frustumCulled = false;
    scene.add(beads);
    const pts = [...Array(N)].map(() => new THREE.Vector3()), m = new THREE.Matrix4();
    return {
      scene, camera,
      update(t) {
        for (const { wheel, k } of cranks) wheel.rotation.x = -(ROPES[k].dir * (TAU * TURNS * t) / 5 + ROPES[k].phase);
        const [A, B] = frames[Math.round(t * 30) % FRAMES];
        pts.forEach((p, i) => p.fromArray(A, i * 3));
        rope.geometry.dispose();
        rope.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.042, 10, false);
        pts.forEach((p, i) => p.fromArray(B, i * 3));
        const curve = new THREE.CatmullRomCurve3(pts);
        for (let i = 0; i < BEADS; i++) beads.setMatrixAt(i, m.makeTranslation(curve.getPointAt(i / (BEADS - 1))));
        beads.instanceMatrix.needsUpdate = true;
      },
    };
  },
};
