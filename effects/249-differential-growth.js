// Differential growth: a closed loop of nodes. Every step each node is pulled to the midpoint of its two
// neighbours (keeps the line smooth), pushed away from any other node closer than R (keeps the folds apart),
// edges longer than MAX split in two, and a few random edges split as well (growth). A longer line in the
// same space has to buckle, so a ring folds into brain-coral meanders. The simulation runs once in setup
// with a fixed seed and saves a snapshot every 8 steps; frames blend between snapshots (a node born
// between two snapshots starts on the edge it split). Each node keeps the colour of the spot on the first
// ring it grew from. The camera pulls back as the loop grows; at the end the maze dissolves into the ring.
import { TAU, rng, clamp, span, smoothstep, fract, canvas } from '../lib/util.js';

const CX = 540, CY = 1100, AX = 450, AY = 740, R = 26, MAX = 10, CAP = 16000, STEPS = 2000, SNAP = 8;
const GROW = 4.3, START = 1.4, ZOOM = 0.8;           // seconds of growth (then a dissolve), video offset, camera pull-back
const snaps = [], clock = [];
let layer;
const wrapped = d => d - Math.round(d);              // shortest step between two u values on the ring

function grow() {
  const r = rng(249), GX = Math.ceil(1080 / R) + 2, GY = Math.ceil(1920 / R) + 2;
  let x = [], y = [], id = [], u = [], born = 0;      // u: where along the first ring a node's material came from
  for (let i = 0; i < 64; i++) { x.push(CX + 70 * Math.cos(i / 64 * TAU)); y.push(CY + 70 * Math.sin(i / 64 * TAU)); id.push(born++); u.push(i / 64); }
  for (let s = 0; s <= STEPS; s++) {
    if (s % SNAP === 0) snaps.push({ x: Float32Array.from(x), y: Float32Array.from(y), id: Int32Array.from(id), u: Float32Array.from(u) });
    const n = x.length, head = new Int32Array(GX * GY).fill(-1), link = new Int32Array(n);
    const cell = i => (Math.floor(y[i] / R) + 1) * GX + Math.floor(x[i] / R) + 1;
    for (let i = 0; i < n; i++) { const c = cell(i); link[i] = head[c]; head[c] = i; }   // grid of linked lists
    const fx = new Float32Array(n), fy = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = (i + n - 1) % n, b = (i + 1) % n;
      fx[i] = ((x[a] + x[b]) / 2 - x[i]) * 0.4;       // smoothing pull
      fy[i] = ((y[a] + y[b]) / 2 - y[i]) * 0.4;
      const ox = (x[i] - CX) / AX, oy = (y[i] - CY) / AY, out = Math.hypot(ox, oy) - 1;
      if (out > 0) { fx[i] -= ox * out * 60; fy[i] -= oy * out * 60; }   // a soft oval wall
      const c = cell(i);
      for (const d of [-GX - 1, -GX, -GX + 1, -1, 0, 1, GX - 1, GX, GX + 1]) {
        for (let j = head[c + d]; j >= 0; j = link[j]) {
          if (j === i || j === a || j === b) continue;
          const ex = x[i] - x[j], ey = y[i] - y[j], d2 = ex * ex + ey * ey;
          if (d2 > R * R || d2 < 1e-6) continue;
          const dist = Math.sqrt(d2), f = (R - dist) / R * 0.6;   // repulsion
          fx[i] += ex / dist * f; fy[i] += ey / dist * f;
        }
      }
    }
    for (let i = 0; i < n; i++) { x[i] += fx[i]; y[i] += fy[i]; }
    const nx = [], ny = [], nid = [], nu = [];
    for (let i = 0; i < n; i++) {
      nx.push(x[i]); ny.push(y[i]); nid.push(id[i]); nu.push(u[i]);
      const b = (i + 1) % n, ex = x[b] - x[i], ey = y[b] - y[i];
      if (ex * ex + ey * ey > MAX * MAX || (n < CAP && r() < 0.004)) {   // split: a new node in the middle
        nx.push(x[i] + ex / 2); ny.push(y[i] + ey / 2); nid.push(born++); nu.push(fract(u[i] + wrapped(u[b] - u[i]) / 2));
      }
    }
    x = nx; y = ny; id = nid; u = nu;
  }
  // camera: pull back as the loop grows (zoom from its rms radius); replay clock: how far the lines move on
  // screen, in fold widths, times how much of the screen the loop covers, so the picture changes at one pace
  for (const p of snaps) {
    let sum = 0;
    for (let i = 0; i < p.x.length; i++) sum += (p.x[i] - CX) ** 2 + (p.y[i] - CY) ** 2;
    p.size = Math.sqrt(sum / p.x.length);
  }
  const last = snaps[snaps.length - 1].size;
  for (const p of snaps) p.zoom = (last / p.size) ** ZOOM;
  clock.push(0);
  for (let k = 1; k < snaps.length; k++) {
    const A = snaps[k - 1], B = snaps[k], where = new Map();
    for (let i = 0; i < A.id.length; i++) where.set(A.id[i], i);
    let move = 0, cnt = 0;
    for (let i = 0; i < B.id.length; i += 4) {
      const j = where.get(B.id[i]);
      if (j === undefined) continue;
      move += Math.hypot((B.x[i] - CX) * B.zoom - (A.x[j] - CX) * A.zoom, (B.y[i] - CY) * B.zoom - (A.y[j] - CY) * A.zoom);
      cnt++;
    }
    const cover = 0.15 + (B.size * B.zoom / last) ** 2;
    clock.push(clock[k - 1] + move / cnt / (R * B.zoom) * cover);
  }
  for (let k = 0; k < clock.length; k++) clock[k] /= clock[clock.length - 1];
}

// fractional snapshot index at cycle time t (0 .. GROW s), eased gently at both ends
function snapAt(t) {
  const k = span(t, 0, GROW), c = 0.7 * k + 0.3 * (0.5 - 0.5 * Math.cos(Math.PI * k));
  let i = 0;
  while (i < clock.length - 2 && clock[i + 1] <= c) i++;
  return i + clamp((c - clock[i]) / (clock[i + 1] - clock[i]));
}

// the loop at fractional snapshot s: nodes of the later snapshot, each eased from where it was in the earlier
function curve(s) {
  const k = Math.min(snaps.length - 2, Math.floor(s)), f = s - k, A = snaps[k], B = snaps[k + 1];
  const where = new Map();
  for (let i = 0; i < A.id.length; i++) where.set(A.id[i], i);
  const n = B.id.length, ax = new Float32Array(n), ay = new Float32Array(n), old = new Int8Array(n);
  for (let i = 0; i < n; i++) { const j = where.get(B.id[i]); if (j !== undefined) { ax[i] = A.x[j]; ay[i] = A.y[j]; old[i] = 1; } }
  for (let i = 0; i < n; i++) {
    if (old[i]) continue;                              // new node: on the line between the old nodes around it
    let p = i, q = i, dp = 0, dq = 0;
    while (!old[p]) { p = (p + n - 1) % n; dp++; }
    while (!old[q]) { q = (q + 1) % n; dq++; }
    const u = dp / (dp + dq);
    ax[i] = ax[p] + (ax[q] - ax[p]) * u; ay[i] = ay[p] + (ay[q] - ay[p]) * u;
  }
  const px = new Float32Array(n), py = new Float32Array(n);
  for (let i = 0; i < n; i++) { px[i] = ax[i] + (B.x[i] - ax[i]) * f; py[i] = ay[i] + (B.y[i] - ay[i]) * f; }
  return { px, py, u: B.u, n, zoom: A.zoom + (B.zoom - A.zoom) * f };
}

// draw the loop at fractional snapshot s: zoomed about the centre, lines keep their screen width
function picture(ctx, s) {
  const { px, py, u, n, zoom } = curve(s);
  const X = i => CX + (px[i] - CX) * zoom, Y = i => CY + (py[i] - CY) * zoom;
  const mid = i => { const j = (i + 1) % n; return [(X(i) + X(j)) / 2, (Y(i) + Y(j)) / 2]; };
  const loop = new Path2D();                           // smooth closed curve through the edge midpoints
  loop.moveTo(...mid(n - 1));
  for (let i = 0; i < n; i++) loop.quadraticCurveTo(X(i), Y(i), ...mid(i));
  ctx.fillStyle = 'rgba(255, 190, 150, 0.07)'; ctx.fill(loop);   // the inside of the loop, faintly
  // the line in runs of one colour: hue from u, so the material of the first ring keeps its colour as it stretches
  const runs = new Map(), bucket = i => Math.floor(u[i] * 96) % 96;
  let start = 0;
  for (let i = 1; i <= n; i++) {
    if (i < n && bucket(i) === bucket(start)) continue;
    const p = runs.get(bucket(start)) || new Path2D();
    p.moveTo(...mid((start + n - 1) % n));
    for (let k = start; k < i; k++) p.quadraticCurveTo(X(k), Y(k), ...mid(k));
    runs.set(bucket(start), p);
    start = i;
  }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [b, p] of runs) {
    const h = (b + 0.5) / 96 * 2;                      // twice round a cosine palette along the loop
    const c = k => Math.round(255 * (0.62 + 0.38 * Math.cos(TAU * (h + k))));
    ctx.strokeStyle = `rgb(${c(0)}, ${c(0.3)}, ${c(0.62)})`;
    ctx.globalAlpha = 0.22; ctx.lineWidth = 15; ctx.stroke(p);   // glow
    ctx.globalAlpha = 1; ctx.lineWidth = 6.5; ctx.stroke(p);
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'; ctx.lineWidth = 1.6;   // a thin bright core
  ctx.stroke(loop);
}

export default {
  name: 'Differential Growth',
  ko: '차등 성장',
  setup() { grow(); layer = canvas(); },
  draw(ctx, time, W, H) {
    const t = (time + START) % 5;                      // the video starts mid-growth, so the loop seam is in motion
    const bg = ctx.createRadialGradient(CX, CY, 100, CX, CY, 1150);
    bg.addColorStop(0, '#1B1838'); bg.addColorStop(1, '#090814');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    if (t < GROW) { picture(ctx, snapAt(t)); return; }
    const k = smoothstep(GROW, 5, t);                  // the grown maze dissolves into the ring it started from
    picture(ctx, 0);
    const g = layer.getContext('2d');
    g.clearRect(0, 0, W, H);
    picture(g, snaps.length - 1.001);
    ctx.globalAlpha = 1 - k; ctx.drawImage(layer, 0, 0); ctx.globalAlpha = 1;
  },
};
