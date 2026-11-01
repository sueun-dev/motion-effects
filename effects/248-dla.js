// Diffusion-limited aggregation from a seabed line: random walkers drop in from above the cluster, wander
// (Brownian steps, longer where nothing is near) until they touch a stuck particle, and stick there. About
// 15,000 particles are aggregated once in setup with a fixed seed; each remembers the particle it touched,
// so the cluster is a tree, and every 16th one keeps the last 40 steps of its walk. It is replayed by t:
// walkers wander in, branches grow tip by tip with a glowing front and thicken as the branches above them
// fill in, then everything but the seedlings dissolves and the cycle starts again.
import { TAU, rng, clamp, span, canvas } from '../lib/util.js';

const WU = 540, HU = 760, SCALE = 2, BASE = 1840;   // strip in units (periodic in x), px per unit, seabed y in px
const FRONT = 600, SPROUT = 0.03, GROW = 4.2, START = 1.4;   // glowing front (particles), seedlings, growth time, video offset
const REC = 40, EVERY = 16, WALK = 0.6;             // walk steps kept, which particles keep them, seconds on screen
let xs, ys, par, walks, clock, N, glow, cold, layer;

function aggregate() {
  const r = rng(248), MAX = 40000;
  xs = new Float32Array(MAX); ys = new Float32Array(MAX); par = new Int32Array(MAX); walks = new Map();
  const CS = 2, GX = WU / CS, GY = Math.ceil(HU / CS) + 30, grid = Array.from({ length: GX * GY }, () => []);
  const CC = 8, CX = WU / CC, coarse = new Uint16Array(CX * (Math.ceil(HU / CC) + 8));
  const wrap = x => ((x % WU) + WU) % WU, dxw = d => (d > WU / 2 ? d - WU : d < -WU / 2 ? d + WU : d);
  let n = 0, top = 0;
  const stick = (x, y, p, trail) => {
    xs[n] = x; ys[n] = y; par[n] = p;
    if (n % EVERY === 0 && trail.length === REC * 2) {   // the walk's last steps, unwrapped to end at the particle
      const w = new Float32Array(REC * 2);
      for (let k = 0; k < REC; k++) { w[k * 2] = x + dxw(trail[k * 2] - x); w[k * 2 + 1] = trail[k * 2 + 1]; }
      w[REC * 2 - 2] = x; w[REC * 2 - 1] = y;
      walks.set(n, w);
    }
    grid[Math.floor(y / CS) * GX + Math.floor(x / CS)].push(n);
    coarse[Math.floor(y / CC) * CX + Math.floor(x / CC)]++;
    top = Math.max(top, y); n++;
  };
  while (top < HU && n < MAX) {
    let x = r() * WU, y = top + 6;                    // launch just above the highest particle
    const trail = [];
    for (;;) {
      let step = 1;
      if (y - top > 3) step = y - top - 2;             // nothing can be closer than the top of the cluster
      else {
        const cx = Math.floor(x / CC), cy = Math.floor(y / CC);
        let empty = y > 8;
        for (let j = -1; j <= 1 && empty; j++) for (let i = -1; i <= 1; i++) if (cy + j >= 0 && coarse[(cy + j) * CX + (cx + i + CX) % CX]) { empty = false; break; }
        if (empty) step = 5;                           // no particle within 8 units: a longer step is safe
      }
      const a = r() * TAU;
      x = wrap(x + Math.cos(a) * step); y += Math.sin(a) * step;
      if (y > top + 40) { x = r() * WU; y = top + 6; trail.length = 0; continue; }   // wandered off: it would come back anywhere
      trail.push(x, y);
      if (trail.length > REC * 2) trail.splice(0, 2);
      if (y < 1) { stick(x, 1, -1, trail); break; }    // landed on the seabed
      const gx = Math.floor(x / CS), gy = Math.floor(y / CS);
      let hit = -1, hd = 4;                            // touching = centres closer than 2 units
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        if (gy + j < 0 || gy + j >= GY) continue;
        for (const k of grid[(gy + j) * GX + (gx + i + GX) % GX]) {
          const dx = dxw(x - xs[k]), dy = y - ys[k], d = dx * dx + dy * dy;
          if (d < hd) { hd = d; hit = k; }
        }
      }
      if (hit >= 0) {                                  // stick at exactly one diameter from the particle it hit
        const dx = dxw(x - xs[hit]), dy = y - ys[hit], d = Math.sqrt(dx * dx + dy * dy) || 1;
        stick(wrap(xs[hit] + dx / d * 2), ys[hit] + dy / d * 2, hit, trail);
        break;
      }
    }
  }
  N = n;
  clock = new Float32Array(N);                         // replay clock: mostly front height, partly particle count,
  let high = 0;                                        // so the front climbs steadily and nothing bursts
  for (let i = 0; i < N; i++) { high = Math.max(high, ys[i]); clock[i] = 0.3 * i / N + 0.7 * high / top; }
  for (const [i, w] of walks) {                        // soften the steps (9-point average, end pinned)
    const s = w.slice();
    for (let k = 0; k < REC - 1; k++) for (const c of [0, 1]) {
      let sum = 0, cnt = 0;
      for (let d = -4; d <= 4; d++) if (k + d >= 0 && k + d < REC) { sum += w[(k + d) * 2 + c]; cnt++; }
      s[k * 2 + c] = sum / cnt;
    }
    let lo = 0, hi = 1;                                // when it sticks: invert the growth curve below
    for (let it = 0; it < 30; it++) { const m = (lo + hi) / 2; if (shown(m * GROW) < i) lo = m; else hi = m; }
    walks.set(i, { path: s, at: lo * GROW });
  }
}

// how many particles are shown (fractional) at cycle time t: the clock eases from the seedlings to the end
function shown(t) {
  const c0 = clock[Math.floor(SPROUT * N)];
  const k = span(t, 0, GROW), c = c0 + (1 - c0) * (0.75 * k - 0.25 * Math.cos(Math.PI * k) + 0.25);
  let lo = 0, hi = N - 1;                              // last particle whose clock is <= c
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (clock[m] <= c) lo = m; else hi = m; }
  return lo + clamp((c - clock[lo]) / (clock[lo + 1] - clock[lo] || 1));
}
const BODY = ['#5E0B2E', '#86133A', '#B02145', '#D9374F', '#F2575A', '#FF7A66', '#FF9C78', '#FFBC90', '#FFD7AE', '#FFEBD0'];
const SHEEN = ['#8A2A4C', '#B03A5A', '#D25068', '#F06A78', '#FF8A86', '#FFA48E', '#FFBE9E', '#FFD4B4', '#FFE6CC', '#FFF5E6'];
const px = i => xs[i] * SCALE, py = i => BASE - ys[i] * SCALE;

// the first n particles as branches: width from the load each one carries, colour from its age
function coral(ctx, n, W) {
  const last = Math.min(N, Math.ceil(n));
  const load = new Float32Array(last);                 // live weight (new ones fade in), summed down the tree
  for (let i = last - 1; i >= 0; i--) {
    load[i] += clamp((n - i) / 60);
    if (par[i] >= 0) load[par[i]] += load[i];
  }
  const buckets = new Map();                           // segments grouped by width (quarter px) and colour
  for (let i = 0; i < last; i++) {
    const grow = clamp((n - i) / 25);                  // the newest segment extends out of its parent
    if (grow <= 0) continue;
    const x1 = px(i), y1 = py(i);
    let x0 = x1, y0 = BASE;
    if (par[i] >= 0) { x0 = px(par[i]); y0 = py(par[i]); }
    const key = Math.round((1.7 + 0.6 * load[i] ** 0.42) * 4) * 10 + Math.min(9, Math.floor((i / N) * 10));
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = []));
    const xe = x0 + (x1 - x0) * grow, ye = y0 + (y1 - y0) * grow;
    if (Math.abs(x1 - x0) < W / 2) b.push(x0, y0, xe, ye);
    else {                                             // crosses the wrap seam: draw it on both edges
      const s = x1 > x0 ? W : -W;
      b.push(x0 + s, y0, xe + s * (1 - grow), ye, x0, y0, xe - s * grow, ye);
    }
  }
  const keys = [...buckets.keys()].sort((a, b) => b - a);   // thick first, so twigs lie on top
  ctx.lineCap = 'round';
  const pass = (dx, dy, k, add, color) => {
    for (const key of keys) {
      const b = buckets.get(key);
      ctx.lineWidth = Math.floor(key / 10) / 4 * k + add;
      ctx.strokeStyle = color[key % 10];
      ctx.beginPath();
      for (let j = 0; j < b.length; j += 4) { ctx.moveTo(b[j] + dx, b[j + 1] + dy); ctx.lineTo(b[j + 2] + dx, b[j + 3] + dy); }
      ctx.stroke();
    }
  };
  pass(0, 4, 1, 3, Array(10).fill('#050D1A'));        // contact shadow
  pass(0, 0, 1, 0, BODY);
  pass(-0.6, -0.8, 0.36, 0, SHEEN);                    // a lighter ridge along each branch
  ctx.globalCompositeOperation = 'lighter';
  for (let i = Math.max(0, Math.floor(n - FRONT)); i < last; i++) {   // the growth front glows
    const a = (1 - (n - i) / FRONT) ** 2 * clamp((n - i) / 25);
    if (a <= 0) continue;
    ctx.globalAlpha = a * 0.55;
    ctx.drawImage(glow, px(i) - 13, py(i) - 13, 26, 26);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

export default {
  name: 'Diffusion-Limited Aggregation',
  ko: '확산 응집',
  setup() {
    aggregate();
    const sprite = (core, mid, edge) => {             // a soft round glow
      const c = canvas(64, 64), g = c.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, core); grd.addColorStop(0.3, mid); grd.addColorStop(1, edge);
      g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
      return c;
    };
    glow = sprite('rgba(255, 236, 200, 1)', 'rgba(255, 170, 110, 0.45)', 'rgba(255, 120, 80, 0)');
    cold = sprite('rgba(225, 250, 255, 1)', 'rgba(120, 210, 255, 0.5)', 'rgba(80, 160, 255, 0)');
    layer = canvas();
  },
  draw(ctx, time, W, H) {
    const t = (time + START) % 5;                      // the video starts mid-growth, so the loop seam is in motion
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#040A18'); bg.addColorStop(0.55, '#08182A'); bg.addColorStop(1, '#0E2636');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const halo = ctx.createRadialGradient(W / 2, BASE - 500, 50, W / 2, BASE - 500, 1100);
    halo.addColorStop(0, 'rgba(60, 110, 150, 0.28)'); halo.addColorStop(1, 'rgba(60, 110, 150, 0)');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);

    const fade = span(t, GROW + 0.05, 4.95);            // after growing, the grown coral dissolves into the seedlings
    if (fade > 0) {
      coral(ctx, shown(0), W);
      const g = layer.getContext('2d');
      g.clearRect(0, 0, W, H);
      coral(g, N, W);
      ctx.globalAlpha = 1 - fade * fade * (3 - 2 * fade);
      ctx.drawImage(layer, 0, 0);
      ctx.globalAlpha = 1;
    } else coral(ctx, shown(t), W);

    // walkers still wandering: each shows its last steps as a fading trail and sticks when its turn comes
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.strokeStyle = '#9FE3FF';
    for (const { path: w, at } of walks.values()) {
      const f = 1 - (at - t) / WALK;
      if (f <= 0 || f >= 1) continue;
      const p = f * (REC - 1), k = Math.floor(p), u = p - k;
      const hx = (w[k * 2] + (w[k * 2 + 2] - w[k * 2]) * u) * SCALE;
      const hy = BASE - (w[k * 2 + 1] + (w[k * 2 + 3] - w[k * 2 + 1]) * u) * SCALE;
      const a = clamp(f / 0.25) * clamp(t / 0.3);
      ctx.globalAlpha = 0.16 * a;
      ctx.beginPath();
      for (let s = Math.max(0, k - 16); s <= k; s++) ctx.lineTo(w[s * 2] * SCALE, BASE - w[s * 2 + 1] * SCALE);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      ctx.globalAlpha = a;
      ctx.drawImage(cold, hx - 7, hy - 7, 14, 14);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

    const sand = ctx.createLinearGradient(0, BASE - 6, 0, H);
    sand.addColorStop(0, '#1B2C36'); sand.addColorStop(1, '#0A141B');
    ctx.fillStyle = sand; ctx.fillRect(0, BASE - 2, W, H - BASE + 2);
  },
};
