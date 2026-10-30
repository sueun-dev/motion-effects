// Granular sand in an hourglass: 1,300 grains (circles of mixed sizes in the glass's middle plane) with a small
// position-based solver: overlaps pushed apart on a hash grid (solved from the bottom of the sand up), walls of the
// glass profile, and friction that cancels most sliding at every contact. The grains pour through the neck in a
// thin stream and build a cone. Resting grains sleep: a grain that has stopped and is cradled freezes exactly and
// is immovable for the others until a grain under it moves away, the glass turns gravity past 15 degrees, or it is
// hit hard, so the settled pile is perfectly still while the surface keeps sliding. Then the glass turns over and
// the next pour begins. Two cycles are simulated in setup; the video plays the second, and late in the turn, while
// every grain is falling, each glides onto its nearest partner in the first cycle, so frame 150 meets frame 0.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { span, ease, smoothstep, rng } from '../lib/util.js';

const GRAINS = 1300, RMIN = 0.0105, RMAX = 0.0145, NECK = 0.074, HALF = 1.35; // HALF: half the inner height
const SEGS = 80; // wall pieces per side
const FLIP0 = 3.15, FLIP1 = 4.75, BLEND0 = 4.05, BLEND1 = 4.45;               // seconds in each cycle
const FPS = 30, SUB = 10, DT = 1 / FPS / SUB, GRAV = -18, PRE = 1.0;            // PRE: settle time before t = 0
const SLEEP_DRIFT = 0.003, SLEEP_STEPS = 12, VMAX = 4;                          // units, steps (0.04 s), units/s

// inner half-width of the glass at height y (-HALF..HALF): two round bulbs and a narrow neck
const profile = y => {
  const u = Math.abs(y) / HALF;                    // 0 at the neck, 1 at the caps
  return NECK + 0.62 * Math.sin(Math.min(1, u * 1.08) * Math.PI / 2) ** 1.6 * (u < 0.85 ? 1 : 1 - ((u - 0.85) / 0.15) ** 2 * 0.35); // steep funnel near the neck
};
// angle of the glass: half a turn in each cycle (upside down looks the same), adding up over the two cycles;
// a smoothstep turn, whose top speed is only 1.5 x its average
const angle = t => Math.PI * (smoothstep(FLIP0, FLIP1, t) + smoothstep(FLIP0 + 5, FLIP1 + 5, t));
// from 100 to 176 degrees into a turn the sand hangs over the neck and falls: no grain may rest then
const tumbling = t => { const k = (angle(t) % Math.PI) / Math.PI; return k > 0.55 && k < 0.98; };

// wall segments of the glass in its own frame: SEGS up the left side, SEGS up the right, then the two caps
function walls() {
  const segs = [];
  for (const side of [-1, 1]) {
    for (let k = 0; k < SEGS; k++) {
      const y0 = -HALF + (2 * HALF * k) / SEGS, y1 = -HALF + (2 * HALF * (k + 1)) / SEGS;
      segs.push([side * profile(y0), y0, side * profile(y1), y1]);
    }
  }
  const w = profile(HALF);
  segs.push([-w, HALF, w, HALF], [-w, -HALF, w, -HALF]);
  return segs;
}

// grain positions at every frame from -PRE s to 10 s
function simulate() {
  const r = rng(197), n = GRAINS, rad = new Float64Array(n);
  const x = new Float64Array(n), y = new Float64Array(n), px = new Float64Array(n), py = new Float64Array(n);
  const asleep = new Uint8Array(n), still = new Uint16Array(n), ax = new Float64Array(n), ay = new Float64Array(n);
  const order = [...Array(n).keys()], ex = Float64Array.from(x), ey = Float64Array.from(y); // ex, ey: smoothed positions
  const held = Array.from({ length: n }, () => []), sgx = new Float64Array(n), sgy = new Float64Array(n); // a sleeper's contacts and gravity
  for (let i = 0; i < n; i++) { // scattered through the top bulb, settling during PRE with the neck plugged
    rad[i] = RMIN + (RMAX - RMIN) * r();
    let gx, gy;
    do { gy = 0.15 + r() * (HALF - 0.2); gx = (r() * 2 - 1) * (profile(gy) - 0.02); } while (Math.abs(gx) > profile(gy) - 0.02);
    x[i] = gx; y[i] = gy; px[i] = gx; py[i] = gy;
  }
  const segs = walls(), cell = 2 * RMAX, grid = new Map(), frames = [];
  // the wall pieces near grain i: calls fn(dx, dy, d) with the vector from the closest wall point to the grain
  const nearWalls = (i, fn) => {
    const near = Math.floor(((y[i] + HALF) / (2 * HALF)) * SEGS);
    const cand = [2 * SEGS, 2 * SEGS + 1]; // the caps, and the side pieces next to this height
    for (let k = Math.max(0, near - 1); k <= Math.min(SEGS - 1, near + 1); k++) cand.push(k, SEGS + k);
    for (const k of cand) {
      const [x1, y1, x2, y2] = segs[k], ex = x2 - x1, ey = y2 - y1;
      const kk = Math.max(0, Math.min(1, ((x[i] - x1) * ex + (y[i] - y1) * ey) / (ex * ex + ey * ey)));
      const dx = x[i] - (x1 + ex * kk), dy = y[i] - (y1 + ey * kk);
      fn(dx, dy, Math.hypot(dx, dy));
    }
  };
  // may grain i come to rest here? Only if something touches it from nearly straight below, or it is cradled by
  // contacts on both sides of the line of gravity (gdx, gdy); otherwise it is on a slope it must roll down
  const cradled = (i, gdx, gdy, plugged) => {
    let under = false, left = false, right = false;
    const look = (nx, ny) => {
      const c = nx * gdx + ny * gdy;
      if (c > 0.8) under = true;
      else if (c > 0.2) { if (nx * gdy - ny * gdx > 0) left = true; else right = true; }
    };
    const cx = Math.floor(x[i] / cell), cy = Math.floor(y[i] / cell);
    for (let o = 0; o < 9; o++) for (const j of grid.get((cx + (o % 3) - 1) * 4096 + cy + Math.floor(o / 3) - 1) || []) {
      const dx = x[j] - x[i], dy = y[j] - y[i], d = Math.hypot(dx, dy);
      if (j !== i && d < (rad[i] + rad[j]) * 1.05) look(dx / d, dy / d);
    }
    nearWalls(i, (dx, dy, d) => { if (d < rad[i] * 1.1 && d > 1e-12) look(-dx / d, -dy / d); });
    if (plugged && y[i] - rad[i] < 0.043) look(0, -1);
    return under || (left && right);
  };
  const total = Math.round((PRE + 10) * FPS);
  for (let f = 0; f <= total; f++) {
    const out = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { out[i * 2] = x[i]; out[i * 2 + 1] = y[i]; } // stored in the glass's frame
    frames.push(out);
    for (let s = 0; s < SUB; s++) {
      const t = -PRE + (f * SUB + s + 1) * DT, ca = Math.cos(angle(t)), sa = Math.sin(angle(t)), plugged = t < 0, falling = tumbling(t);
      const gLx = GRAV * sa, gLy = GRAV * ca, gl = Math.hypot(gLx, gLy), gdx = gLx / gl, gdy = gLy / gl; // gravity seen from the glass
      const ox = Float64Array.from(x), oy = Float64Array.from(y);
      for (let i = 0; i < n; i++) { // Verlet step in the glass frame (the slow turn's own forces are ignored)
        if (asleep[i]) continue;
        let vx = (x[i] - px[i]) * 0.999, vy = (y[i] - py[i]) * 0.999;
        const v = Math.hypot(vx, vy) / DT;
        if (v > VMAX) { vx *= VMAX / v; vy *= VMAX / v; } // air drag caps the falling speed, so no grain jumps a whole grain in one step
        px[i] = x[i]; py[i] = y[i];
        x[i] += vx + gLx * DT * DT; y[i] += vy + gLy * DT * DT;
      }
      grid.clear();
      for (let i = 0; i < n; i++) {
        const key = Math.floor(x[i] / cell) * 4096 + Math.floor(y[i] / cell);
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(i);
      }
      // solve from the bottom of the sand upward, so each grain is pushed up by grains already set below it
      order.sort((a, b) => (x[b] * gdx + y[b] * gdy) - (x[a] * gdx + y[a] * gdy));
      for (let it = 0; it < 3; it++) {
        for (const i of order) {
          const cx = Math.floor(x[i] / cell), cy = Math.floor(y[i] / cell);
          for (let ox2 = -1; ox2 <= 1; ox2++) for (let oy2 = -1; oy2 <= 1; oy2++) {
            for (const j of grid.get((cx + ox2) * 4096 + cy + oy2) || []) {
              if (j === i || (asleep[i] && asleep[j])) continue;
              const dx = x[j] - x[i], dy = y[j] - y[i], d = Math.hypot(dx, dy), min = rad[i] + rad[j];
              if (d >= min || d < 1e-12) continue;
              // a sleeping grain is immovable for the others, unless a grain flying in (moving over a third of a
              // radius this step) digs more than 10 % into it
              if (min - d > 0.1 * min && (asleep[i] || asleep[j])) {
                const mover = asleep[i] ? j : i;
                if (Math.hypot(x[mover] - ox[mover], y[mover] - oy[mover]) > rad[mover] / 3) for (const k of [i, j]) if (asleep[k]) { asleep[k] = 0; still[k] = 0; px[k] = x[k]; py[k] = y[k]; }
              }
              const wi = asleep[i] ? 0 : 1, wj = asleep[j] ? 0 : 1;
              const nx = dx / d, ny = dy / d, c = (min - d) / (wi + wj);
              x[i] -= nx * c * wi; y[i] -= ny * c * wi; x[j] += nx * c * wj; y[j] += ny * c * wj;
              // friction: cancel 70 % of the relative sliding along the contact this step
              const rvx = (x[j] - ox[j]) - (x[i] - ox[i]), rvy = (y[j] - oy[j]) - (y[i] - oy[i]);
              const fr = (0.7 * (rvx * -ny + rvy * nx)) / (wi + wj);
              x[i] += -ny * fr * wi; y[i] += nx * fr * wi; x[j] -= -ny * fr * wj; y[j] -= nx * fr * wj;
            }
          }
          if (asleep[i]) continue;
          nearWalls(i, (dx, dy, d) => {
            if (d < rad[i] && d > 1e-12) {
              x[i] += (dx / d) * (rad[i] - d); y[i] += (dy / d) * (rad[i] - d);
              px[i] += (x[i] - px[i]) * 0.06; py[i] += (y[i] - py[i]) * 0.06; // a little wall friction
            }
          });
          // stay inside the profile (catches anything that slipped between wall segments)
          const w = profile(Math.max(-HALF, Math.min(HALF, y[i]))) - rad[i];
          if (x[i] > w) x[i] = w; if (x[i] < -w) x[i] = -w;
          y[i] = Math.max(-HALF + rad[i], Math.min(HALF - rad[i], y[i]));
          if (plugged && y[i] < 0.04 + rad[i]) y[i] = 0.04 + rad[i]; // the plug in the neck while settling
        }
      }
      // sleeping: a grain that has stayed within SLEEP_DRIFT of one spot for SLEEP_STEPS steps and is cradled
      // there stops dead (the solver's tiny settling jitter ends there) and remembers what it touches.
      // It wakes, from rest, as soon as one of those grains moves away (the sand under it pours out), the glass has
      // turned gravity by more than 15 degrees since, the plug is pulled, or the sand tumbles late in a turn.
      // Grains in the neck never sleep, nor do grains in the funnel above it (so no rigid arch can jam the neck).
      const unplug = t >= 0 && t - DT < 0;
      for (let i = 0; i < n; i++) {
        ex[i] += (x[i] - ex[i]) * 0.05; ey[i] += (y[i] - ey[i]) * 0.05; // the drift test reads a smoothed position, so jitter does not count
        if (asleep[i]) {
          const lost = held[i].some(j => Math.hypot(x[j] - x[i], y[j] - y[i]) > (rad[i] + rad[j]) * 1.08);
          if (falling || unplug || lost || sgx[i] * gdx + sgy[i] * gdy < 0.966) { asleep[i] = 0; still[i] = 0; px[i] = ax[i] = ex[i] = x[i]; py[i] = ay[i] = ey[i] = y[i]; }
        } else if (!falling && Math.hypot(ex[i] - ax[i], ey[i] - ay[i]) < SLEEP_DRIFT && Math.abs(y[i]) > (x[i] * gdx + y[i] * gdy < 0 ? 0.6 : 0.2)) {
          if (++still[i] >= SLEEP_STEPS && cradled(i, gdx, gdy, plugged)) {
            asleep[i] = 1; px[i] = x[i]; py[i] = y[i]; sgx[i] = gdx; sgy[i] = gdy;
            const cx = Math.floor(x[i] / cell), cy = Math.floor(y[i] / cell);
            held[i] = [];
            for (let o = 0; o < 9; o++) for (const j of grid.get((cx + (o % 3) - 1) * 4096 + cy + Math.floor(o / 3) - 1) || []) {
              if (j !== i && Math.hypot(x[j] - x[i], y[j] - y[i]) < (rad[i] + rad[j]) * 1.05) held[i].push(j);
            }
          }
        } else { still[i] = 0; ax[i] = ex[i]; ay[i] = ey[i]; }
      }
    }
  }
  return { frames, rad };
}

export default {
  name: 'Granular Sand',
  ko: '모래 입자',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas');
    bg.width = 4; bg.height = 512;
    const g = bg.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#2B1E3A'); grd.addColorStop(0.55, '#5A3A4E'); grd.addColorStop(1, '#C7865E');
    g.fillStyle = grd; g.fillRect(0, 0, 4, 512);
    scene.background = new THREE.CanvasTexture(bg);
    scene.background.colorSpace = THREE.SRGBColorSpace;
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.8;
    const key = new THREE.DirectionalLight('#FFE9CC', 2.4);
    key.position.set(-3, 4, 5);
    scene.add(key);

    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
    camera.position.set(0, 0.25, 9.6); // a still camera, so resting sand is truly still on screen
    camera.lookAt(0, -0.05, 0);

    // the hourglass: a round glass (lathe of the same profile) between two wooden caps (no pillars: thin bars
    // sweeping round in the turn would strobe)
    const glassPts = [];
    for (let k = 0; k <= 120; k++) { const yy = -HALF + (2 * HALF * k) / 120; glassPts.push(new THREE.Vector2(profile(yy) + 0.012, yy)); }
    const glass = new THREE.Mesh(new THREE.LatheGeometry(glassPts, 96), new THREE.MeshPhysicalMaterial({
      color: '#FFFFFF', roughness: 0.1, metalness: 0, transparent: true, opacity: 0.16, envMapIntensity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    const wood = new THREE.MeshStandardMaterial({ color: '#7A4A2A', roughness: 0.45, metalness: 0.05 });
    const hourglass = new THREE.Group();
    hourglass.add(glass);
    for (const sy of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.7, 0.16, 64), wood);
      cap.position.y = sy * (HALF + 0.07);
      hourglass.add(cap);
    }
    scene.add(hourglass);

    const { frames, rad } = simulate();
    const at = t => { // grain positions at time t, between the two stored frames around it
      const f = Math.min(frames.length - 1.001, (t + PRE) * FPS), i = Math.floor(f), w = f - i, A = frames[i], B = frames[i + 1];
      return A.map((v, k) => v + (B[k] - v) * w);
    };
    // pair every grain of the second cycle with its nearest free grain of the first, at the start of the blend
    // (late in the turn, when every grain is falling). The first cycle's glass has turned half a turn less, so its
    // grains are compared turned by half a turn (-x, -y).
    const A = at(BLEND0 + 5), B = at(BLEND0).map(v => -v), used = new Uint8Array(GRAINS), partner = new Int32Array(GRAINS);
    const order = [...Array(GRAINS).keys()].sort((i, j) => A[i * 2 + 1] - A[j * 2 + 1]);
    for (const i of order) {
      let best = -1, bd = 1e9;
      for (let j = 0; j < GRAINS; j++) {
        if (used[j]) continue;
        const d = (A[i * 2] - B[j * 2]) ** 2 + (A[i * 2 + 1] - B[j * 2 + 1]) ** 2;
        if (d < bd) { bd = d; best = j; }
      }
      used[best] = 1; partner[i] = best;
    }

    const grains = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshStandardMaterial({ roughness: 0.9 }), GRAINS);
    grains.frustumCulled = false;
    const r = rng(7), sand = ['#E9C38B', '#DDB070', '#F2D3A0', '#C99A5E', '#E4BA7E'].map(c => new THREE.Color(c));
    const colors = Array.from({ length: GRAINS }, () => sand[Math.floor(r() * sand.length)]);
    hourglass.add(grains);

    const m = new THREE.Matrix4(), col = new THREE.Color();
    const pose = t => {
        hourglass.rotation.z = angle(t + 5);
        // the second cycle; while the sand falls late in the turn each grain glides onto its partner in the first
        // cycle (turned half a turn), and from BLEND1 to 5 s the first cycle plays, which runs on into the second
        const P = at(t + 5), Q = at(t), w = ease.inOut(span(t, BLEND0, BLEND1));
        for (let i = 0; i < GRAINS; i++) {
          const j = partner[i], gx = P[i * 2] + (-Q[j * 2] - P[i * 2]) * w, gy = P[i * 2 + 1] + (-Q[j * 2 + 1] - P[i * 2 + 1]) * w;
          const rr = (rad[i] + (rad[j] - rad[i]) * w) * 1.25;
          grains.setMatrixAt(i, m.makeScale(rr, rr, rr).setPosition(gx, gy, 0));
          grains.setColorAt(i, col.copy(colors[i]).lerp(colors[j], w));
        }
        grains.instanceMatrix.needsUpdate = true;
        grains.instanceColor.needsUpdate = true;
    };

    return { scene, camera, update: pose };
  },
};