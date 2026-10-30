// Procedural walk: a six-legged robot crosses bumpy ground with a tripod gait. Each foot stays planted while the
// body moves on, then swings in an arc to the next foothold, which is placed one stride ahead on the ground's
// own height (the glowing rings). The knees come from two-bone inverse kinematics (law of cosines) solved every
// frame, and the body tilts with the ground under it. The ground repeats every 12 units and the robot walks
// exactly 12 per loop, with 4 steps per leg.
import * as THREE from 'three';
import { TAU, phase, smoothstep } from '../lib/util.js';

const SPEED = 2.4, P = 12, T = 1.25, STRIDE = SPEED * T;     // P = SPEED * 5: one ground period per loop
const L1 = 2.0, L2 = 2.4;                                   // thigh and shin
// [hip x, hip z, foot x, foot z, gait offset]: two tripods half a step apart
const LEGS = [
  [0.8, 0.5, 2.6, 2.6, 0], [0, 0.6, 0.1, 3.3, 0.5], [-0.8, 0.5, -2.5, 2.6, 0],
  [0.8, -0.5, 2.6, -2.6, 0.5], [0, -0.6, 0.1, -3.3, 0], [-0.8, -0.5, -2.5, -2.6, 0.5],
];
// ground height: sines whose x periods divide P, so the ground repeats every P
const ground = (x, z) => 0.38 * Math.sin((TAU * x) / 6 + 0.8 * Math.sin(0.5 * z)) + 0.22 * Math.sin((TAU * x) / 4 + 1.3 + 0.7 * z)
  + 0.12 * Math.cos((TAU * 5 * x) / P - 0.9 * z);

// where foot i is at time t: planted on the ground, or swinging in an arc to the next foothold
function foot(i, t) {
  const [, , fx, fz, off] = LEGS[i];
  const c = t / T + off, n = Math.floor(c), u = c - n;
  const plant = k => SPEED * (k + 0.25 - off) * T + fx;      // under the hip's reach at mid-stance
  const x0 = plant(n);
  if (u < 0.5) return { p: new THREE.Vector3(x0, ground(x0, fz), fz), swing: 0, next: x0 };
  const s = smoothstep(0.5, 1, u), x1 = plant(n + 1);
  const x = x0 + (x1 - x0) * s;
  return { p: new THREE.Vector3(x, ground(x, fz) + 0.7 * Math.sin(Math.PI * s), fz), swing: Math.sin(Math.PI * s), next: x1 };
}

export default {
  name: 'Procedural Walk',
  ko: '절차적 보행',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    const sky = document.createElement('canvas');
    sky.width = 2; sky.height = 512;
    const g = sky.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#2B2D5C'); grd.addColorStop(0.5, '#B06AB3'); grd.addColorStop(1, '#FFB677');
    g.fillStyle = grd; g.fillRect(0, 0, 2, 512);
    scene.background = new THREE.CanvasTexture(sky);
    scene.background.colorSpace = THREE.SRGBColorSpace;
    scene.fog = new THREE.Fog('#E9967A', 18, 45);

    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 200);
    const sun = new THREE.DirectionalLight('#FFD6A5', 3.0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 });
    sun.shadow.radius = 4;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    scene.add(sun, sun.target, new THREE.HemisphereLight('#9FB4FF', '#5A3A4A', 1.1));

    // the ground: 4 periods long, and moved by whole periods to stay under the robot (it repeats every P)
    const gg = new THREE.PlaneGeometry(4 * P, 40, 240, 160);
    gg.rotateX(-Math.PI / 2);
    const gp = gg.attributes.position;
    const gc = [], lo = new THREE.Color('#9C4A3C'), hi = new THREE.Color('#E8A27A');
    for (let i = 0; i < gp.count; i++) {
      const h = ground(gp.getX(i), gp.getZ(i));
      gp.setY(i, h);
      const c = lo.clone().lerp(hi, smoothstep(-0.6, 0.6, h));  // darker in the hollows, sunlit sand on the crests
      gc.push(c.r, c.g, c.b);
    }
    gg.setAttribute('color', new THREE.Float32BufferAttribute(gc, 3));
    gg.computeVertexNormals();
    const land = new THREE.Mesh(gg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    land.receiveShadow = true;
    scene.add(land);

    const metal = new THREE.MeshStandardMaterial({ color: '#E8ECF2', metalness: 0.6, roughness: 0.3 });
    const dark = new THREE.MeshStandardMaterial({ color: '#2E3440', metalness: 0.5, roughness: 0.4 });
    const glow = new THREE.MeshStandardMaterial({ color: '#7DF9FF', emissive: '#3DE8FF', emissiveIntensity: 1.6 });
    const body = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), metal);
    shell.scale.set(1.35, 0.55, 0.9);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), dark);
    belly.scale.set(1.2, 0.45, 0.8); belly.position.y = -0.15;
    body.add(shell, belly);
    for (const z of [-0.28, 0.28]) {                          // two glowing eyes at the front
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 14), glow);
      e.position.set(1.25, 0.12, z);
      body.add(e);
    }
    body.traverse(m => (m.castShadow = true));
    scene.add(body);

    const rod = new THREE.CylinderGeometry(1, 1, 1, 14), ball = new THREE.SphereGeometry(1, 20, 14);
    const legs = LEGS.map(() => {
      const parts = { thigh: new THREE.Mesh(rod, metal), shin: new THREE.Mesh(rod, dark), knee: new THREE.Mesh(ball, metal), toe: new THREE.Mesh(ball, glow) };
      parts.knee.scale.setScalar(0.17); parts.toe.scale.setScalar(0.12);
      for (const m of Object.values(parts)) { m.castShadow = true; scene.add(m); }
      parts.ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 48), new THREE.MeshBasicMaterial({ color: '#7DF9FF', transparent: true, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -60 }));
      scene.add(parts.ring);
      return parts;
    });
    const up = new THREE.Vector3(0, 1, 0);
    const place = (m, a, b, r) => {                           // a rod of radius r from a to b
      const d = b.clone().sub(a);
      m.position.copy(a).addScaledVector(d, 0.5);
      m.scale.set(r, d.length(), r);
      m.quaternion.setFromUnitVectors(up, d.normalize());
    };

    return {
      scene, camera,
      update(t) {
        const a = phase(t) * TAU, bx = SPEED * t;
        land.position.x = P * Math.floor(bx / P);
        // body: above the mean ground under it, bobbing twice per step, tilted with the slope
        const gy = (ground(bx + 1, 0) + ground(bx - 1, 0) + ground(bx, 1.5) + ground(bx, -1.5)) / 4;
        body.position.set(bx, gy + 1.25 + 0.06 * Math.sin((2 * TAU * t) / T), 0);
        body.rotation.set(Math.atan2(ground(bx, -1.5) - ground(bx, 1.5), 3) * 0.8, 0,
          Math.atan2(ground(bx + 1, 0) - ground(bx - 1, 0), 2) * 0.8);
        body.updateMatrixWorld();
        LEGS.forEach(([hx, hz], i) => {
          const hip = new THREE.Vector3(hx, -0.05, hz).applyMatrix4(body.matrixWorld);
          const f = foot(i, t), toe = f.p;
          // two-bone IK in the vertical plane through hip and foot: the knee goes up and out
          const d = toe.clone().sub(hip), flat = new THREE.Vector3(d.x, 0, d.z);
          const r = flat.length(), D = Math.min(Math.hypot(r, d.y), L1 + L2 - 1e-3);
          const elev = Math.atan2(d.y, r) + Math.acos((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D));
          const knee = hip.clone().addScaledVector(flat.normalize(), L1 * Math.cos(elev)).add(new THREE.Vector3(0, L1 * Math.sin(elev), 0));
          const p = legs[i];
          place(p.thigh, hip, knee, 0.11);
          place(p.shin, knee, toe, 0.075);
          p.knee.position.copy(knee);
          p.toe.position.copy(toe);
          // the next foothold, shown while the foot is in the air
          const nx = f.next, nz = LEGS[i][3], e = 0.05;
          p.ring.position.set(nx, ground(nx, nz) + 0.1, nz);
          p.ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1),     // lying on the slope
            new THREE.Vector3(ground(nx - e, nz) - ground(nx + e, nz), 2 * e, ground(nx, nz - e) - ground(nx, nz + e)).normalize());
          p.ring.material.opacity = 0.9 * f.swing;
          p.ring.visible = f.swing > 0.01;
        });
        camera.position.set(bx + 9.5 + 0.8 * Math.sin(a), 6.6, 16.5);
        camera.lookAt(bx + 0.3, 2.0, 0);
        sun.position.set(bx - 8, 10, 6);
        sun.target.position.set(bx, 0, 0);
      },
    };
  },
};
