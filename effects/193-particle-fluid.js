// Particle fluid by position-based fluids (Macklin & Mueller 2013): 2,400 particles, each step pushed so the SPH
// density around every particle stays at rest density (poly6 / spiky kernels on a hash grid, artificial pressure
// against clumping, XSPH viscosity). A wide stream pours into a glass tank from above, splashes and sloshes while
// the tank rocks, then the tank tips and pours it all out below the frame and rights itself. Simulated in setup at 120 steps
// a second and played back; the tank is empty at 0 s and 5 s, so the loop closes.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TAU, phase, span, ease, rng } from '../lib/util.js';

const NX = 12, NY = 40, NZ = 5, SPACING = 0.1;               // the stream: 40 layers of 12 x 5 = 2,400 particles
const POUR = 3.5;                                             // stream speed at the spout (m/s)
const H = 2 * SPACING, REST = 1 / SPACING ** 3, ITER = 3;     // kernel radius, rest density (one particle per cell)
const FRAMES = 150, SUB = 4, DT = 1 / 30 / SUB, GRAV = -9.8;
const TW = 1.6, TD = 0.32, RIM = 1.8;                         // tank inner half-width, half-depth, wall height
const PIVOT = new THREE.Vector3(0, -0.5, 0);                  // the tank turns about its bottom centre

// tank angle (radians, + tips the right rim down) over the 5 s
const tilt = t => 0.12 * Math.sin((t - 1.3) * 5) * span(t, 1.3, 1.6) * (1 - span(t, 2.2, 2.5))
  - 2.4 * ease.inOut(span(t, 2.5, 3.4)) * (1 - ease.inOut(span(t, 4.0, 4.8)));

function simulate() {
  const n = NX * NY * NZ, r = rng(193);
  const x = new Float32Array(n * 3), v = new Float32Array(n * 3), p = new Float32Array(n * 3);
  const lam = new Float32Array(n), dp = new Float32Array(n * 3), inTank = new Uint8Array(n);
  // each layer leaves the spout (just above the frame) one spacing after the last; until then a particle waits far away
  const born = new Float32Array(n), spawn = new Float32Array(n * 3), alive = new Uint8Array(n);
  let k = 0;
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) for (let l = 0; l < NZ; l++, k++) {
    born[k] = ((j + r()) * SPACING) / POUR; // staggered within the layer, so the stream is continuous
    spawn[k * 3] = -0.7 + (i - (NX - 1) / 2) * SPACING + (r() - 0.5) * 0.02;
    spawn[k * 3 + 1] = 4.3 + (r() - 0.5) * 0.02;
    spawn[k * 3 + 2] = (l - (NZ - 1) / 2) * SPACING + (r() - 0.5) * 0.02;
    x[k * 3 + 1] = 99;
  }
  const poly6 = 315 / (64 * Math.PI * H ** 9), spiky = -45 / (Math.PI * H ** 6);
  const W = r2 => (r2 < H * H ? poly6 * (H * H - r2) ** 3 : 0);
  const Wq = W((0.2 * H) ** 2); // for the artificial pressure term
  const cell = H, grid = new Map(), nbr = Array.from({ length: n }, () => []);
  const cellKey = (a, b, c) => ((a + 512) * 1024 + (b + 512)) * 1024 + (c + 512);
  const frames = [];
  const local = new THREE.Vector3(), q = new THREE.Quaternion(), qi = new THREE.Quaternion(), zAxis = new THREE.Vector3(0, 0, 1);
  // keep a particle inside the tank (if it is in the tank's box) in the tank's own frame
  const collide = (i, t) => {
    q.setFromAxisAngle(zAxis, -tilt(t)); qi.copy(q).invert();
    local.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]).sub(PIVOT).applyQuaternion(qi);
    if (local.y > RIM) inTank[i] = 0;                                           // over the rim: free
    else if (Math.abs(local.x) < TW && Math.abs(local.z) < TD && local.y > 0) inTank[i] = 1; // in the box: held by the walls
    if (!inTank[i]) return;
    const m = 0.02;
    local.x = Math.max(-TW + m, Math.min(TW - m, local.x));
    local.y = Math.max(m, local.y);
    local.z = Math.max(-TD + m, Math.min(TD - m, local.z));
    local.applyQuaternion(q).add(PIVOT);
    p[i * 3] = local.x; p[i * 3 + 1] = local.y; p[i * 3 + 2] = local.z;
  };
  for (let f = 0; f < FRAMES; f++) {
    frames.push(x.slice());
    for (let s = 0; s < SUB; s++) {
      const t = (f * SUB + s + 1) * DT;
      for (let i = 0; i < n; i++) {
        if (!alive[i] && t >= born[i]) { alive[i] = 1; for (let c = 0; c < 3; c++) { x[i * 3 + c] = spawn[i * 3 + c]; v[i * 3 + c] = 0; } v[i * 3 + 1] = -POUR; }
        if (alive[i]) v[i * 3 + 1] += GRAV * DT;
        for (let c = 0; c < 3; c++) p[i * 3 + c] = x[i * 3 + c] + v[i * 3 + c] * DT;
      }
      grid.clear();
      for (let i = 0; i < n; i++) {
        if (!alive[i]) continue;
        const key = cellKey(Math.floor(p[i * 3] / cell), Math.floor(p[i * 3 + 1] / cell), Math.floor(p[i * 3 + 2] / cell));
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(i);
      }
      for (let i = 0; i < n; i++) {
        const list = nbr[i]; list.length = 0;
        if (!alive[i]) continue;
        const gx = Math.floor(p[i * 3] / cell), gy = Math.floor(p[i * 3 + 1] / cell), gz = Math.floor(p[i * 3 + 2] / cell);
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
          for (const j of grid.get(cellKey(gx + a, gy + b, gz + c)) || []) {
            const dx = p[i * 3] - p[j * 3], dy = p[i * 3 + 1] - p[j * 3 + 1], dz = p[i * 3 + 2] - p[j * 3 + 2];
            if (dx * dx + dy * dy + dz * dz < H * H) list.push(j);
          }
        }
      }
      for (let it = 0; it < ITER; it++) {
        for (let i = 0; i < n; i++) { // lambda: how far density is from rest, scaled by its gradient
          let rho = 0, sg = 0, gx = 0, gy = 0, gz = 0;
          for (const j of nbr[i]) {
            const dx = p[i * 3] - p[j * 3], dy = p[i * 3 + 1] - p[j * 3 + 1], dz = p[i * 3 + 2] - p[j * 3 + 2], r2 = dx * dx + dy * dy + dz * dz;
            rho += W(r2);
            if (j === i || r2 < 1e-12) continue;
            const rr = Math.sqrt(r2), g = (spiky * (H - rr) ** 2) / rr / REST;
            gx += g * dx; gy += g * dy; gz += g * dz;
            sg += g * g * r2;
          }
          const C = Math.max(0, rho / REST - 1); // only push apart (no tension pulling the surface)
          lam[i] = -C / (sg + gx * gx + gy * gy + gz * gz + 600);
        }
        for (let i = 0; i < n; i++) {
          let ax = 0, ay = 0, az = 0;
          for (const j of nbr[i]) {
            if (j === i) continue;
            const dx = p[i * 3] - p[j * 3], dy = p[i * 3 + 1] - p[j * 3 + 1], dz = p[i * 3 + 2] - p[j * 3 + 2], r2 = dx * dx + dy * dy + dz * dz;
            if (r2 < 1e-12) continue;
            const rr = Math.sqrt(r2), scorr = -0.0001 * (W(r2) / Wq) ** 4, g = ((lam[i] + lam[j] + scorr) * spiky * (H - rr) ** 2) / rr / REST;
            ax += g * dx; ay += g * dy; az += g * dz;
          }
          dp[i * 3] = ax; dp[i * 3 + 1] = ay; dp[i * 3 + 2] = az;
        }
        for (let i = 0; i < n; i++) {
          const d = Math.hypot(dp[i * 3], dp[i * 3 + 1], dp[i * 3 + 2]), k = d > 0.3 * SPACING ? (0.3 * SPACING) / d : 1; // no single big jump
          for (let c = 0; c < 3; c++) p[i * 3 + c] += dp[i * 3 + c] * k;
          collide(i, t);
        }
      }
      for (let i = 0; i < n; i++) {
        for (let c = 0; c < 3; c++) v[i * 3 + c] = (p[i * 3 + c] - x[i * 3 + c]) / DT;
        const sp = Math.hypot(v[i * 3], v[i * 3 + 1], v[i * 3 + 2]);
        if (sp > 8) for (let c = 0; c < 3; c++) v[i * 3 + c] *= 8 / sp;
      }
      for (let i = 0; i < n; i++) { // XSPH viscosity: nudge each velocity toward its neighbours'
        let ax = 0, ay = 0, az = 0;
        for (const j of nbr[i]) {
          const dx = p[i * 3] - p[j * 3], dy = p[i * 3 + 1] - p[j * 3 + 1], dz = p[i * 3 + 2] - p[j * 3 + 2], w = W(dx * dx + dy * dy + dz * dz) / REST;
          ax += (v[j * 3] - v[i * 3]) * w; ay += (v[j * 3 + 1] - v[i * 3 + 1]) * w; az += (v[j * 3 + 2] - v[i * 3 + 2]) * w;
        }
        dp[i * 3] = ax; dp[i * 3 + 1] = ay; dp[i * 3 + 2] = az;
      }
      for (let i = 0; i < n * 3; i++) { v[i] += 0.25 * dp[i]; x[i] = p[i]; }
    }
  }
  return frames;
}

export default {
  name: 'Particle Fluid',
  ko: '입자 유체',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas');
    bg.width = 4; bg.height = 512;
    const g = bg.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#0E2238'); grd.addColorStop(0.6, '#173A57'); grd.addColorStop(1, '#0B1726');
    g.fillStyle = grd; g.fillRect(0, 0, 4, 512);
    scene.background = new THREE.CanvasTexture(bg);
    scene.background.colorSpace = THREE.SRGBColorSpace;
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 1.0;
    const key = new THREE.DirectionalLight('#FFFFFF', 2.0);
    key.position.set(-3, 6, 5);
    scene.add(key);

    const camera = new THREE.PerspectiveCamera(36, W / H, 0.1, 100);
    camera.position.set(0, 0.6, 12.5);
    camera.lookAt(0, -0.6, 0);

    // the tank: a glass box open at the top, on an axle; it turns about PIVOT
    const tank = new THREE.Group();
    tank.position.copy(PIVOT);
    scene.add(tank);
    const glass = new THREE.MeshPhysicalMaterial({ color: '#DFF3FF', roughness: 0.05, transmission: 1, thickness: 0.05, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
    const frame = new THREE.MeshStandardMaterial({ color: '#E7EBF0', metalness: 0.9, roughness: 0.25 });
    const panel = (w, h, x, y, z, ry = 0, rx = 0) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glass);
      m.position.set(x, y, z); m.rotation.set(rx, ry, 0);
      tank.add(m);
    };
    panel(2 * TW, RIM, 0, RIM / 2, TD); panel(2 * TW, RIM, 0, RIM / 2, -TD);
    panel(2 * TD, RIM, -TW, RIM / 2, 0, Math.PI / 2); panel(2 * TD, RIM, TW, RIM / 2, 0, Math.PI / 2);
    panel(2 * TW, 2 * TD, 0, 0, 0, 0, Math.PI / 2);
    for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) { // edges
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, RIM, 0.05), frame);
      post.position.set(sx * TW, RIM / 2, sz * TD);
      tank.add(post);
    }
    for (const y of [0, RIM]) for (const sz of [-1, 1]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(2 * TW + 0.05, 0.05, 0.05), frame);
      bar.position.set(0, y, sz * TD);
      tank.add(bar);
    }
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 6, 16), frame);
    stand.position.set(0, PIVOT.y - 3.1, -TD - 0.12);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 32).rotateX(Math.PI / 2), frame);
    hub.position.set(0, PIVOT.y, -TD - 0.08);
    scene.add(stand, hub);

    const frames = simulate();
    const n = NX * NY * NZ;
    const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(SPACING * 0.72, 16, 12), new THREE.MeshPhysicalMaterial({ color: '#2E9BFF', roughness: 0.3, metalness: 0, sheen: 0.5, sheenColor: new THREE.Color('#BFE6FF') }), n);
    drops.frustumCulled = false;
    scene.add(drops);
    const m = new THREE.Matrix4(), col = new THREE.Color(), deep = new THREE.Color('#1260D8'), foam = new THREE.Color('#BFEAFF');
    return {
      scene, camera,
      update(t) {
        camera.position.set(0.7 * Math.sin(phase(t) * TAU), 0.6, 12.5); // a slow sway
        camera.lookAt(0, -0.6, 0);
        tank.rotation.z = -tilt(t);
        const f = Math.round(t * 30) % FRAMES, P = frames[f], Q = frames[Math.max(0, f - 1)];
        for (let i = 0; i < n; i++) {
          drops.setMatrixAt(i, m.makeTranslation(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]));
          const speed = Math.hypot(P[i * 3] - Q[i * 3], P[i * 3 + 1] - Q[i * 3 + 1], P[i * 3 + 2] - Q[i * 3 + 2]) * 30;
          drops.setColorAt(i, col.copy(deep).lerp(foam, Math.min(1, speed / 6)));
        }
        drops.instanceMatrix.needsUpdate = true;
        drops.instanceColor.needsUpdate = true;
      },
    };
  },
};
