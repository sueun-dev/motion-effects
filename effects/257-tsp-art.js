// TSP art: a shaded apple becomes 14,000 stipple points (more points where it is darker, spread evenly by weighted
// Lloyd relaxation), and one closed travelling-salesman tour joins them all (nearest-neighbour start, 2-opt until no
// move helps, then every crossing removed). All of it is computed once at load with fixed seeds; the video draws the
// dots, runs a pen along the tour by arc length, holds the finished one-line drawing, and fades it back to paper.
import { TAU, clamp, smoothstep, span, ease, rng, noise3, canvas, FONT } from '../lib/util.js';

const N = 14000, GX = 360, GY = 400, CELL = 3, X0 = 0, Y0 = 380; // density grid (3 px cells) over x 0..1080, y 380..1580

// the picture as darkness 0..1 at (x, y) px: an apple lit from the upper left, its stem, a leaf and a cast shadow
const AC = [540, 1010];
const appleR = th => 335 * (1 + 0.1 * Math.cos(th) + 0.04 * Math.cos(2 * th)) - 46 * Math.exp(-((th / 0.32) ** 2)); // th = 0 is up
function darkness(x, y) {
  const dx = x - AC[0], dy = AC[1] - y, th = Math.atan2(dx, dy), r = Math.hypot(dx, dy), rho = r / appleR(th);
  let ink = 0;
  // cast shadow: darkest at the contact, soft toward the lower right
  const sx = (x - 600) / 360, sy = (y - 1352) / 52, sh = sx * sx + sy * sy;
  ink = Math.max(ink, 0.85 * (1 - smoothstep(0.1, 1, sh)) * (1 - 0.4 * smoothstep(-0.2, 1, sx)));
  if (rho < 1) {
    const z = Math.sqrt(1 - rho * rho), nx = (dx / (r || 1)) * rho, ny = (dy / (r || 1)) * rho;
    const L = [-0.6, 0.55, 0.58], lam = Math.max(0, nx * L[0] + ny * L[1] + z * L[2]);
    const H = [-0.3, 0.32, 0.9], spec = Math.max(0, nx * H[0] + ny * H[1] + z * H[2]) ** 320;
    const bounce = 0.25 * smoothstep(0.75, 1, rho) * Math.max(0, nx * 0.4 - ny * 0.9); // light bounced up from the table
    const cavity = Math.exp(-(((x - 548) / 70) ** 2 + ((y - (AC[1] - 300)) / 46) ** 2));
    const streak = 0.09 * noise3(nx / Math.sqrt(Math.max(0.05, 1 - ny * ny)) * 7, ny * 1.6, 2); // streaks run stem to base
    ink = clamp(0.16 + 0.84 * (1 - lam) ** 1.2 + 0.4 * cavity + streak - bounce - 1.1 * spec);
  }
  for (let k = 0; k <= 12; k++) { // stem: a curved stroke rising out of the hollow
    const u = k / 12, sx2 = 548 + 30 * u * u, sy2 = AC[1] - 296 - 120 * u;
    if (Math.hypot(x - sx2, y - sy2) < 12 - 4 * u) ink = 1;
  }
  // leaf: an almond tilted up to the right, one half darker, with a light vein
  const lx = x - 690, ly = y - 540, a = -0.45, u = lx * Math.cos(a) + ly * Math.sin(a), v = -lx * Math.sin(a) + ly * Math.cos(a);
  const half = 62 * Math.sqrt(Math.max(0, 1 - (u / 130) ** 2)) * (1 - 0.25 * u / 130);
  if (Math.abs(v) < half) ink = Math.max(ink, Math.abs(v) < 4 ? 0.04 : v < 0 ? 0.3 : 0.62);
  return ink;
}

// stipple: rejection-sample N points by darkness, then weighted Lloyd relaxation on the density grid
function stipple() {
  const D = new Float32Array(GX * GY);
  for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) D[j * GX + i] = darkness(X0 + (i + 0.5) * CELL, Y0 + (j + 0.5) * CELL);
  const r = rng(257), P = [];
  while (P.length < N) {
    const i = Math.floor(r() * GX), j = Math.floor(r() * GY);
    if (r() < D[j * GX + i]) P.push([X0 + (i + r()) * CELL, Y0 + (j + r()) * CELL]);
  }
  for (let it = 0; it < 10; it++) {
    const hash = bucket(P), sx = new Float64Array(N), sy = new Float64Array(N), sw = new Float64Array(N);
    for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
      const w = D[j * GX + i];
      if (w < 0.02) continue;
      const x = X0 + (i + 0.5) * CELL, y = Y0 + (j + 0.5) * CELL, k = hash.nearest(x, y);
      sx[k] += w * x; sy[k] += w * y; sw[k] += w;
    }
    for (let k = 0; k < N; k++) if (sw[k] > 0) P[k] = [sx[k] / sw[k], sy[k] / sw[k]];
  }
  return P;
}

// a grid of buckets for nearest-point and k-nearest queries
function bucket(P, size = 24) {
  const cols = Math.ceil(1080 / size) + 1, rows = Math.ceil(1920 / size) + 1, cells = Array.from({ length: cols * rows }, () => []);
  const at = (x, y) => [clamp(Math.floor(x / size), 0, cols - 1), clamp(Math.floor(y / size), 0, rows - 1)];
  P.forEach(([x, y], k) => { const [c, r] = at(x, y); cells[r * cols + c].push(k); });
  const near = (x, y, want, skip) => { // the `want` closest points, searching rings of buckets outward
    const [c, r] = at(x, y), found = [];
    for (let ring = 0; ring < Math.max(cols, rows); ring++) {
      for (let rr = r - ring; rr <= r + ring; rr++) for (let cc = c - ring; cc <= c + ring; cc++) {
        if (Math.max(Math.abs(rr - r), Math.abs(cc - c)) !== ring || rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
        for (const k of cells[rr * cols + cc]) if (!skip || !skip(k)) found.push([(P[k][0] - x) ** 2 + (P[k][1] - y) ** 2, k]);
      }
      if (found.length >= want && ring > 0) { // everything within ring * size is found; stop once that covers the worst kept
        found.sort((a, b) => a[0] - b[0]);
        if (Math.sqrt(found[want - 1][0]) <= (ring - 0.5) * size || ring > 6) return found.slice(0, want).map(f => f[1]);
      }
    }
    found.sort((a, b) => a[0] - b[0]);
    return found.slice(0, want).map(f => f[1]);
  };
  const nearest = (x, y) => { // the closest point: rings of buckets until nothing nearer can be outside them
    const [c, r] = at(x, y);
    let best = -1, bd = Infinity;
    for (let ring = 0; ring < cols + rows; ring++) {
      for (let rr = r - ring; rr <= r + ring; rr++) for (let cc = c - ring; cc <= c + ring; cc++) {
        if (Math.max(Math.abs(rr - r), Math.abs(cc - c)) !== ring || rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
        for (const k of cells[rr * cols + cc]) { const d = (P[k][0] - x) ** 2 + (P[k][1] - y) ** 2; if (d < bd) { bd = d; best = k; } }
      }
      if (best >= 0 && Math.sqrt(bd) <= ring * size) return best;
    }
    return best;
  };
  return { nearest, near, remove(k) { const [c, r] = at(...P[k]); const a = cells[r * cols + c]; a.splice(a.indexOf(k), 1); } };
}

// the tour: nearest neighbour, then 2-opt over 10 nearest neighbours, then remove any crossing that is left
function solve(P) {
  const dist = (a, b) => Math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1]);
  const hash = bucket(P), nbr = P.map(([x, y], k) => hash.near(x, y, 11).filter(j => j !== k).slice(0, 10));
  const free = bucket(P), tour = [0];
  free.remove(0);
  for (let s = 1; s < N; s++) { const k = free.nearest(...P[tour[s - 1]]); tour.push(k); free.remove(k); }
  const pos = new Int32Array(N);
  const index = () => tour.forEach((k, i) => (pos[k] = i));
  const reverse = (i, j) => { // reverse tour[i..j] (cyclic), the shorter way round
    let len = ((j - i + N) % N) + 1;
    if (len * 2 > N) { [i, j] = [(j + 1) % N, (i - 1 + N) % N]; len = N - len; }
    for (let s = 0; s < len >> 1; s++) {
      const a = (i + s) % N, b = (j - s + N) % N;
      [tour[a], tour[b]] = [tour[b], tour[a]]; pos[tour[a]] = a; pos[tour[b]] = b;
    }
  };
  index();
  for (let improved = true; improved;) {
    improved = false;
    for (let i = 0; i < N; i++) {
      const a = tour[i], b = tour[(i + 1) % N];
      for (const c of nbr[a]) {
        const j = pos[c], d = tour[(j + 1) % N];
        if (c === b || d === a) continue;
        if (dist(a, b) + dist(c, d) - dist(a, c) - dist(b, d) > 1e-6) { reverse((i + 1) % N, j); improved = true; break; }
      }
    }
  }
  const cross = (p, q, r, s) => { // proper intersection of segments pq and rs
    const o = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    return o(p, q, r) * o(p, q, s) < 0 && o(r, s, p) * o(r, s, q) < 0;
  };
  for (;;) { // sweep the edges by x to find crossings, uncross them (that always shortens the tour), until none are left
    const E = tour.map((a, i) => [a, tour[(i + 1) % N]]).map(([a, b]) => [a, b, Math.min(P[a][0], P[b][0]), Math.max(P[a][0], P[b][0])]);
    E.sort((e, f) => e[2] - f[2]);
    const found = [];
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N && E[j][2] <= E[i][3]; j++) {
      const [a, b] = E[i], [c, d] = E[j];
      if (a !== c && a !== d && b !== c && b !== d && cross(P[a], P[b], P[c], P[d])) found.push([a, b, c, d]);
    }
    if (!found.length) break;
    for (const [a, b, c, d] of found) { // skip any whose edges an earlier fix already changed
      const edge = (u, v) => tour[(pos[u] + 1) % N] === v ? u : tour[(pos[v] + 1) % N] === u ? v : -1; // the edge's first city
      const u = edge(a, b), v = edge(c, d);
      if (u >= 0 && v >= 0) reverse((pos[u] + 1) % N, pos[v]);
    }
  }
  return tour;
}

const POINTS = stipple(), TOUR = solve(POINTS);
const PATH = TOUR.map(k => POINTS[k]).concat([POINTS[TOUR[0]]]); // closed
const LEN = [0];
for (let i = 1; i < PATH.length; i++) LEN.push(LEN[i - 1] + Math.hypot(PATH[i][0] - PATH[i - 1][0], PATH[i][1] - PATH[i - 1][1]));
const TOTAL = LEN[LEN.length - 1];
const VISIT = new Float32Array(N); // the arc length at which the pen reaches each point
TOUR.forEach((k, i) => (VISIT[k] = LEN[i]));

const paper = canvas();
{
  const g = paper.getContext('2d'), r = rng(9);
  g.fillStyle = '#F4EDE1'; g.fillRect(0, 0, 1080, 1920);
  for (let i = 0; i < 14000; i++) { g.fillStyle = `rgba(110, 80, 50, ${0.015 + r() * 0.035})`; g.fillRect(r() * 1080, r() * 1920, 1 + r() * 2, 1 + r() * 2); }
}

// the drawn part of the path, from arc length 0 to s
function trace(ctx, s) {
  ctx.beginPath(); ctx.moveTo(PATH[0][0], PATH[0][1]);
  for (let i = 1; i < PATH.length; i++) {
    if (LEN[i] <= s) { ctx.lineTo(PATH[i][0], PATH[i][1]); continue; }
    const k = (s - LEN[i - 1]) / (LEN[i] - LEN[i - 1]);
    ctx.lineTo(PATH[i - 1][0] + (PATH[i][0] - PATH[i - 1][0]) * k, PATH[i - 1][1] + (PATH[i][1] - PATH[i - 1][1]) * k);
    break;
  }
  ctx.stroke();
}

export default {
  name: 'TSP Art',
  ko: 'TSP 한붓그리기',
  draw(ctx, t, W, H) {
    ctx.drawImage(paper, 0, 0);
    const s = TOTAL * ease.inOut(span(t, 0, 3.2)); // the pen runs the whole tour ...
    const back = span(t, 3.9, 5);                     // ... the line holds, then hands back to the dots (frame 150 = frame 0)

    ctx.fillStyle = '#D9734E';
    for (let k = 0; k < N; k++) {
      const a = Math.max(back, 1 - smoothstep(VISIT[k] - 60, VISIT[k], s)); // a dot goes as the line reaches it
      if (a < 0.02) continue;
      ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(POINTS[k][0], POINTS[k][1], 2.4, 0, TAU); ctx.fill();
    }
    const ink = 1 - back;
    ctx.globalAlpha = ink;
    ctx.lineCap = ctx.lineJoin = 'round';
    if (s > 0) { ctx.strokeStyle = '#1F2238'; ctx.lineWidth = 1.8; trace(ctx, s); }
    if (s > 0 && s < TOTAL) { // the last stretch the pen drew glows coral
      const tail = 5000;
      for (let q = 0; q < 6; q++) {
        const from = s - tail * (1 - q / 6);
        if (from + tail / 6 < 0) continue;
        ctx.globalAlpha = (q + 1) / 6 * 0.9; ctx.strokeStyle = '#E8603C'; ctx.lineWidth = 2.2;
        ctx.save(); ctx.lineCap = 'butt'; ctx.setLineDash([tail / 6, 1e9]); ctx.lineDashOffset = -from; // only from .. from + tail / 6
        trace(ctx, Math.min(s, from + tail / 6)); ctx.restore();
      }
    }
    ctx.globalAlpha = 1;

    // caption and a progress rule
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1F2238'; ctx.font = `600 38px ${FONT.sans}`;
    ctx.fillText(`${N.toLocaleString('en-US')} points · one closed line · no crossings`, W / 2, 1640);
    ctx.fillStyle = 'rgba(31, 34, 56, 0.55)'; ctx.font = `500 28px ${FONT.mono}`;
    ctx.fillText('stipple  →  travelling-salesman tour', W / 2, 1688);
    ctx.fillStyle = 'rgba(31, 34, 56, 0.12)'; ctx.fillRect(240, 1730, 600, 6);
    ctx.fillStyle = '#E8603C'; ctx.fillRect(240, 1730, 600 * (s / TOTAL) * ink, 6);
  },
};
