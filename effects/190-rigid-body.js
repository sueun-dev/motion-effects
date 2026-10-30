// Rigid-body Galton board with a small 2D solver: 70 steel balls (circles in the board's plane) fall through
// 10 staggered rows of pegs and stack up in 11 bins, colliding with pegs, walls and each other (position correction with
// a spatial grid, a small bounce and friction at each peg hit, rolling drag). The pile fills the bell curve drawn
// behind the bins. Then the trapdoor floor swings open, the balls drop out, it closes, and the next stream starts.
// Simulated in setup at 600 steps a second; the next cycle's first balls start falling before the old ones
// have left (they never meet), so frame 150 meets frame 0.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { rng, span, ease } from '../lib/util.js';

const BALLS = 70, R = 0.1, PEG = 0.04, ROWS = 10, DX = 0.44, DY = DX * Math.sqrt(3) / 2;
const TOP = 3.4, BIN_TOP = TOP - (ROWS - 1) * DY - 0.45, FLOOR = BIN_TOP - 2.5, HALF = ((ROWS + 1) * DX) / 2;
const GRAV = -60, SUB = 20, DT = 1 / 30 / SUB, LEAD = 0.6;  // the stream starts LEAD s before the loop starts
const EMIT_END = 1.0, GATE_OPEN = 3.85, GATE_SHUT = 4.7;       // seconds in the cycle

const pegs = [];
for (let row = 0; row < ROWS; row++) { // a staggered lattice across the whole board, one peg right under the stream
  for (let k = -7; k <= 7; k++) { const px = (k + (row % 2) / 2) * DX; if (Math.abs(px) < HALF - 0.3) pegs.push([px, TOP - row * DY]); }
}
// wall segments [x1, y1, x2, y2]: the board sides, and the bin dividers
const walls = [[-HALF, FLOOR, -HALF, TOP + 3], [HALF, FLOOR, HALF, TOP + 3]];
for (let i = 1; i <= ROWS; i++) walls.push([-HALF + i * DX, FLOOR, -HALF + i * DX, BIN_TOP]);
// the floor is a trapdoor hinged at its left end: 0 shut .. 1 hanging straight down
const gateOpen = t => ease.in(span(t, GATE_OPEN, GATE_OPEN + 0.18)) * (1 - ease.inOut(span(t, GATE_SHUT - 0.3, GATE_SHUT)));

// x, y of every ball at every frame from -LEAD s to 5 s (balls not yet dropped wait far above)
function simulate() {
  const r = rng(190), x = new Float64Array(BALLS), y = new Float64Array(BALLS), vx = new Float64Array(BALLS), vy = new Float64Array(BALLS);
  const born = Array.from({ length: BALLS }, (_, i) => -LEAD + (i / BALLS) * (EMIT_END + LEAD));
  const lane = Array.from({ length: BALLS }, (_, i) => (i % 2 ? 0.1 : -0.1) + (r() - 0.5) * 0.02); // a stream down the middle
  const alive = new Uint8Array(BALLS), frames = [];
  const nFrames = Math.round((5 + LEAD) * 30);
  const cell = 2 * R, grid = new Map(), hitX = new Float64Array(BALLS), hitY = new Float64Array(BALLS);
  for (let f = 0; f <= nFrames; f++) {
    const out = new Float32Array(BALLS * 2);
    for (let i = 0; i < BALLS; i++) { out[i * 2] = alive[i] ? x[i] : 0; out[i * 2 + 1] = alive[i] ? y[i] : 99; }
    frames.push(out);
    for (let s = 0; s < SUB; s++) {
      const t = -LEAD + (f * SUB + s) * DT, gateGone = gateOpen(t) > 0.01;
      for (let i = 0; i < BALLS; i++) {
        if (!alive[i] && t >= born[i]) { alive[i] = 1; x[i] = lane[i]; y[i] = TOP + 2.5; vx[i] = 0; vy[i] = -9; } // 0.25 apart
        if (!alive[i]) continue;
        vy[i] += GRAV * DT;
        x[i] += vx[i] * DT; y[i] += vy[i] * DT;
      }
      const px = Float64Array.from(x), py = Float64Array.from(y); // positions before the corrections
      grid.clear();
      for (let i = 0; i < BALLS; i++) {
        if (!alive[i] || y[i] < FLOOR - 4) continue;
        const key = Math.floor(x[i] / cell) * 4096 + Math.floor(y[i] / cell);
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(i);
      }
      hitX.fill(0); hitY.fill(0);
      for (let it = 0; it < 3; it++) { // three passes of position corrections, so piles stack firmly
        for (let i = 0; i < BALLS; i++) {
          if (!alive[i] || y[i] < FLOOR - 4) continue;
          const gx = Math.floor(px[i] / cell), gy = Math.floor(py[i] / cell);
          for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) { // balls: push overlapping pairs apart
            for (const j of grid.get((gx + ox) * 4096 + gy + oy) || []) {
              if (j <= i) continue;
              const dx = x[j] - x[i], dy = y[j] - y[i], d = Math.hypot(dx, dy);
              if (d < 2 * R && d > 1e-9) { const c = (2 * R - d) / d / 2; x[i] -= dx * c; y[i] -= dy * c; x[j] += dx * c; y[j] += dy * c; }
            }
          }
          for (const [qx, qy] of pegs) { // pegs
            const dx = x[i] - qx, dy = y[i] - qy;
            if (Math.abs(dx) > R + PEG || Math.abs(dy) > R + PEG) continue;
            const d = Math.hypot(dx, dy);
            if (d < R + PEG) { x[i] = qx + (dx / d) * (R + PEG); y[i] = qy + (dy / d) * (R + PEG); hitX[i] = dx / d; hitY[i] = dy / d; }
          }
          for (const [x1, y1, x2, y2] of walls) { // walls and dividers
            const ex = x2 - x1, ey = y2 - y1, k = Math.max(0, Math.min(1, ((x[i] - x1) * ex + (y[i] - y1) * ey) / (ex * ex + ey * ey)));
            const dx = x[i] - (x1 + ex * k), dy = y[i] - (y1 + ey * k), d = Math.hypot(dx, dy);
            if (d < R && d > 1e-9) { x[i] += (dx / d) * (R - d); y[i] += (dy / d) * (R - d); }
          }
          if (!gateGone && y[i] < FLOOR + R && py[i] > FLOOR - R && Math.abs(x[i]) < HALF) y[i] = FLOOR + R; // the closed floor
        }
      }
      for (let i = 0; i < BALLS; i++) { // new velocity from the corrected motion; a small bounce off pegs, with friction
        if (!alive[i]) continue;
        const ux = vx[i], uy = vy[i];
        vx[i] = (x[i] - px[i]) / DT + ux; vy[i] = (y[i] - py[i]) / DT + uy;
        const sp = Math.hypot(vx[i], vy[i]); if (sp > 14) { vx[i] *= 14 / sp; vy[i] *= 14 / sp; } // a hard cap keeps big pushes calm
        vx[i] *= 0.992; vy[i] *= 0.992; // rolling drag on the board
        if (hitX[i] || hitY[i]) {
          const nx = hitX[i], ny = hitY[i], vn = ux * nx + uy * ny, tn = vx[i] * nx + vy[i] * ny;
          const impact = vn < -0.5, bounce = impact ? -0.05 * vn : 0, keep = impact ? 0.3 : 1; // impacts bounce and lose
          vx[i] = (vx[i] - tn * nx) * keep + nx * Math.max(tn, bounce); vy[i] = (vy[i] - tn * ny) * keep + ny * Math.max(tn, bounce); // some slide
        }
      }
    }
  }
  return frames;
}

export default {
  name: 'Rigid Body',
  ko: '강체 물리',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#14213A');
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.9;
    const key = new THREE.DirectionalLight('#FFF3E2', 1.8);
    key.position.set(-3, 5, 8);
    scene.add(key);

    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
    camera.position.set(0, 0.6, 18.5);
    camera.lookAt(0, 0.6, 0);

    // the board: a dark panel with the expected bell curve painted faintly behind the bins
    const board = document.createElement('canvas');
    board.width = 512; board.height = 1024;
    const g = board.getContext('2d');
    g.fillStyle = '#1D2C4D'; g.fillRect(0, 0, 512, 1024);
    const toPx = (wx, wy) => [256 + (wx / (HALF + 0.4)) * 256, 512 - ((wy - 0.6) / 6) * 512]; // board spans x +-(HALF+0.4), y 0.6 +- 6
    g.strokeStyle = 'rgba(255, 207, 120, 0.55)'; g.lineWidth = 4; g.setLineDash([10, 8]);
    g.beginPath();
    for (let k = 0; k <= 200; k++) {
      const wx = -HALF + (k / 200) * 2 * HALF, b = wx / DX, sigma = 2; // in bins; the bell this board settles into
      const count = BALLS * Math.exp(-(b * b) / (2 * sigma * sigma)) / (sigma * Math.sqrt(2 * Math.PI));
      const [px, py] = toPx(wx, FLOOR + count * 0.085); // two balls per layer, layers 0.17 high
      if (k) g.lineTo(px, py); else g.moveTo(px, py);
    }
    g.stroke();
    const boardTex = new THREE.CanvasTexture(board);
    boardTex.colorSpace = THREE.SRGBColorSpace;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(2 * (HALF + 0.4), 12), new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.9 }));
    back.position.set(0, 0.6, -R - 0.02);
    scene.add(back);

    const steel = new THREE.MeshStandardMaterial({ color: '#D9DEE6', metalness: 0.95, roughness: 0.18 });
    const pegMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(PEG, PEG, 0.32, 20).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#F2C66D', metalness: 0.8, roughness: 0.3 }), pegs.length);
    const m = new THREE.Matrix4();
    pegs.forEach(([px, py], i) => pegMesh.setMatrixAt(i, m.makeTranslation(px, py, 0.06)));
    scene.add(pegMesh);
    const wallMat = new THREE.MeshPhysicalMaterial({ color: '#FFFFFF', roughness: 0.1, transmission: 0.6, thickness: 0.1, transparent: true, opacity: 0.85 });
    for (const [x1, y1, x2, y2] of walls) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.035, Math.hypot(x2 - x1, y2 - y1), 0.34), wallMat);
      w.position.set((x1 + x2) / 2, (y1 + y2) / 2, 0.06);
      w.rotation.z = Math.atan2(x1 - x2, y2 - y1);
      scene.add(w);
    }
    const gate = new THREE.Group(), door = new THREE.Mesh(new THREE.BoxGeometry(2 * HALF, 0.06, 0.34), steel);
    door.position.x = HALF; // hinge at the left end
    gate.add(door);
    gate.position.set(-HALF, FLOOR - 0.03, 0.06);
    scene.add(gate);

    // two sets of balls: this cycle's, and the next cycle's first ones while they overlap at the end
    const balls = new THREE.InstancedMesh(new THREE.SphereGeometry(R, 24, 16), steel, 2 * BALLS);
    balls.frustumCulled = false;
    const r = rng(7), palette = ['#E8EDF5', '#FF6B6B', '#FFD166', '#4ECDC4', '#8E9BFF'];
    for (let i = 0; i < BALLS; i++) {
      const c = new THREE.Color(r() < 0.75 ? palette[0] : palette[1 + Math.floor(r() * 4)]);
      balls.setColorAt(i, c); balls.setColorAt(BALLS + i, c);
    }
    scene.add(balls);

    const frames = simulate();
    return {
      scene, camera,
      update(t) {
        gate.rotation.z = -(Math.PI / 2) * gateOpen(t);
        const show = (P, base) => {
          for (let i = 0; i < BALLS; i++) balls.setMatrixAt(base + i, m.makeTranslation(P[i * 2], P[i * 2 + 1], 0));
        };
        show(frames[Math.round((t + LEAD) * 30)], 0);
        // the next cycle's first balls are already falling in the last LEAD seconds (before that: all still above)
        show(frames[Math.max(0, Math.round((t - 5 + LEAD) * 30))], BALLS);
        balls.instanceMatrix.needsUpdate = true;
      },
    };
  },
};
