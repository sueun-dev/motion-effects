// Lightning grown by the dielectric breakdown model (Laplacian growth): on a 120 x 160 grid the cloud base and the
// channel are held at potential φ = 0 and the ground at φ = 1; Laplace's equation ∇²φ = 0 is relaxed (SOR) and one
// cell next to the channel is added at a time, picked with chance ∝ φ^2.4, until the channel touches the ground.
// That runs once in setup with a fixed seed and is replayed by t: the faint stepped leader creeps down and branches
// while the equipotential lines (contours of φ, kept at 24 stages and blended) bend round its tips; when it touches
// down, the path back to the cloud brightens smoothly over 0.6 s (the return stroke), lights the cloud base and the
// ground, holds, and fades; the branches go first. No flashes: every brightness is a smooth ease of t.
import { TAU, rng, clamp, span, smoothstep, canvas, FONT } from '../lib/util.js';

const GW = 120, GH = 160, ETA = 2.4, SEED = 2;          // grid, growth exponent, seed
const CS = 6.6, X0 = 540 - (GW / 2) * CS, Y0 = 598;       // cell size and grid origin on screen (px)
const LEAD0 = 0.05, LEAD1 = 2.0;                         // the leader grows from 0.05 s to 2.0 s
const STROKE = 2.0, PEAK = 2.6, HOLD = 2.95, GONE = 4.7;  // return stroke: brighten, hold, fade out
const STAGES = 24, START = 1.0;                          // field snapshots; the video starts mid-leader
let cells, par, born, main, sub, fields, sky, clouds, layer, lines, mask;

function grow() {
  const r = rng(SEED), phi = new Float32Array(GW * GH), on = new Uint8Array(GW * GH);
  par = new Int32Array(GW * GH).fill(-1); cells = [];
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) phi[y * GW + x] = y / (GH - 1);
  const add = (i, p) => { on[i] = 1; phi[i] = 0; par[i] = p; cells.push(i); };
  for (let x = 0; x < GW; x++) { phi[x] = 0; phi[(GH - 1) * GW + x] = 1; }
  add(GW >> 1, -1);
  const sor = n => {                                      // relax ∇²φ = 0 (sides mirror, so no current leaves)
    for (let it = 0; it < n; it++) for (let y = 1; y < GH - 1; y++) for (let x = 0; x < GW; x++) {
      const i = y * GW + x;
      if (on[i]) continue;
      const l = x > 0 ? phi[i - 1] : phi[i + 1], rr = x < GW - 1 ? phi[i + 1] : phi[i - 1];
      phi[i] += 1.85 * ((l + rr + phi[i - GW] + phi[i + GW]) / 4 - phi[i]);
    }
  };
  sor(400);
  const snaps = [Float32Array.from(phi)];
  for (;;) {
    const cand = new Map();                               // empty 8-neighbours of the channel
    for (const i of cells) {
      const x = i % GW, y = (i / GW) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 1 || nx >= GW || ny >= GH - 1) continue;
        const j = ny * GW + nx;
        if (!on[j] && !cand.has(j)) cand.set(j, i);
      }
    }
    let sum = 0;
    const list = [];
    for (const [j, p] of cand) { const w = Math.max(0, phi[j]) ** ETA; sum += w; list.push([j, p, w]); }
    let pick = r() * sum, k = 0;
    while (k < list.length - 1 && (pick -= list[k][2]) > 0) k++;
    add(list[k][0], list[k][1]);
    if (((list[k][0] / GW) | 0) >= GH - 2) break;
    sor(8);
    snaps.push(Float32Array.from(phi));
  }
  // replay clock: mostly how far down the front is, a little the cell count, so the leader creeps down steadily
  const n = cells.length;
  born = new Float32Array(n);
  let low = 0;
  for (let k = 0; k < n; k++) {
    low = Math.max(low, (cells[k] / GW) | 0);
    born[k] = LEAD0 + (LEAD1 - LEAD0) * (0.8 * low / (GH - 2) + 0.2 * k / (n - 1));
  }
  // the potential at 24 moments of the growth, for the equipotential lines
  fields = [];
  for (let s = 0; s < STAGES; s++) fields.push(snaps[Math.min(snaps.length - 1, Math.round((s / (STAGES - 1)) * (snaps.length - 1)))]);
  // the main channel: from the cell that touched the ground back to the cloud; sub: cells below each one (current)
  main = new Uint8Array(GW * GH);
  for (let i = cells[n - 1]; i >= 0; i = par[i]) main[i] = 1;
  sub = new Float32Array(GW * GH);
  for (let k = n - 1; k >= 0; k--) { const i = cells[k]; sub[i] += 1; if (par[i] >= 0) sub[par[i]] += sub[i]; }
}

// every cell as a screen point, nudged off the grid, and each link as two pieces with a kinked middle
let pts;
function shape() {
  const r = rng(77);
  pts = new Float32Array(GW * GH * 4);
  for (const i of cells) {
    const x = i % GW, y = (i / GW) | 0;
    pts[i * 4] = X0 + (x + 0.5 + (r() - 0.5) * 0.7) * CS; pts[i * 4 + 1] = Y0 + (y + (r() - 0.5) * 0.5) * CS;
    pts[i * 4 + 2] = (r() - 0.5) * 0.5; pts[i * 4 + 3] = 0;   // kink of the link into this cell
  }
  pts[cells[0] * 4 + 1] = Y0 - 30;                        // the root sits inside the cloud
}

// draw the links whose brightness light(i) > 0 into g, width(i) wide; grown(i): how much of a new link is out (0..1)
function links(g, light, width, color, grown) {
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const i of cells) {
    const p = par[i];
    if (p < 0) continue;
    const a = light(i);
    if (a <= 0.003) continue;
    const x0 = pts[p * 4], y0 = pts[p * 4 + 1], x1 = pts[i * 4], y1 = pts[i * 4 + 1];
    const mx = (x0 + x1) / 2 - (y1 - y0) * pts[i * 4 + 2], my = (y0 + y1) / 2 + (x1 - x0) * pts[i * 4 + 2];
    const k = grown(i);
    const ex = k < 0.5 ? x0 + (mx - x0) * k * 2 : mx + (x1 - mx) * (k * 2 - 1), ey = k < 0.5 ? y0 + (my - y0) * k * 2 : my + (y1 - my) * (k * 2 - 1);
    g.strokeStyle = color(i, Math.min(1, a)); g.lineWidth = width(i);
    g.beginPath(); g.moveTo(x0, y0);
    if (k < 0.5) g.lineTo(ex, ey); else { g.lineTo(mx, my); g.lineTo(ex, ey); }
    g.stroke();
  }
}

export default {
  name: 'Lightning',
  ko: '번개',
  setup(c, W, H) {
    grow(); shape();
    // the night sky and the ground, drawn once
    sky = canvas(W, H);
    const g = sky.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#0E1230'); grd.addColorStop(0.55, '#262C56'); grd.addColorStop(0.86, '#3D3866'); grd.addColorStop(1, '#3D3866');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    const r = rng(5);
    g.fillStyle = '#0A0C1A';                              // hills
    g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 12) g.lineTo(x, 1648 - 26 * Math.sin(x / 170) - 14 * Math.sin(x / 61 + 1) - (x > 700 ? (x - 700) * 0.08 : 0));
    g.lineTo(W, H); g.fill();
    for (let k = 0; k < 70; k++) {                        // a few far lights
      const x = r() * W, y = 1668 + r() * 30;
      g.fillStyle = `rgba(255, ${190 + r() * 50}, 140, ${0.35 + r() * 0.4})`; g.beginPath(); g.arc(x, y, 1.6 + r() * 1.2, 0, TAU); g.fill();
    }
    // the storm cloud: many soft dark puffs, lighter on top
    clouds = canvas(W, H);
    const cg = clouds.getContext('2d');
    for (let k = 0; k < 260; k++) {
      const x = -100 + r() * (W + 200), y = 260 + r() ** 0.7 * 330, rad = 70 + r() * 150;
      const puff = cg.createRadialGradient(x, y - rad * 0.3, rad * 0.1, x, y, rad);
      const l = 18 + r() * 14 + (600 - y) * 0.03;
      puff.addColorStop(0, `hsla(232, 22%, ${l + 8}%, 0.55)`); puff.addColorStop(0.6, `hsla(232, 24%, ${l}%, 0.35)`); puff.addColorStop(1, `hsla(232, 24%, ${l}%, 0)`);
      cg.fillStyle = puff; cg.beginPath(); cg.arc(x, y, rad, 0, TAU); cg.fill();
    }
    layer = canvas(W, H); lines = canvas(W, H);
    mask = canvas(W, H);                                  // the field lines fade out towards the grid's sides and top
    const m = mask.getContext('2d'), mx = m.createLinearGradient(X0, 0, X0 + GW * CS, 0);
    mx.addColorStop(0, 'rgba(0,0,0,0)'); mx.addColorStop(0.25, '#000'); mx.addColorStop(0.75, '#000'); mx.addColorStop(1, 'rgba(0,0,0,0)');
    m.fillStyle = mx; m.fillRect(0, 0, W, H);
    m.globalCompositeOperation = 'destination-in';
    const my = m.createLinearGradient(0, Y0, 0, Y0 + 220);
    my.addColorStop(0, 'rgba(0,0,0,0)'); my.addColorStop(1, '#000');
    m.fillStyle = my; m.fillRect(0, 0, W, H);
  },
  draw(ctx, time, W, H) {
    const t = (time + START) % 5;
    const up = smoothstep(STROKE, PEAK, t), down = 1 - smoothstep(HOLD, GONE, t);
    const bright = up * down;                              // the main channel: 0 .. 1 .. 0, smooth
    const twig = up * (1 - smoothstep(HOLD - 0.15, 3.7, t));          // branches, gone sooner
    const lead = 1 - smoothstep(STROKE, STROKE + 0.6, t);             // the faint leader gives way to the stroke
    const charge = 0.3 * (t > 4 ? smoothstep(4.2, 5, t) : 1 - smoothstep(0, 1.1, t)); // the cloud charging up

    ctx.drawImage(sky, 0, 0);
    // the cloud, lit from inside before the leader and from below by the stroke
    ctx.drawImage(clouds, 0, 0);
    const rx = pts[cells[0] * 4], lit = (cx, cy, rad, a, col) => {
      if (a <= 0.002) return;
      const gl = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      gl.addColorStop(0, `rgba(${col}, ${a})`); gl.addColorStop(1, `rgba(${col}, 0)`);
      ctx.fillStyle = gl; ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    };
    ctx.globalCompositeOperation = 'lighter';
    lit(rx, 560, 360, 0.22 * charge, '170, 160, 255');
    lit(rx, 600, 900, 0.5 * bright, '190, 200, 255');
    const gx = pts[cells[cells.length - 1] * 4];
    lit(gx, 1660, 520, 0.42 * bright, '200, 210, 255');
    ctx.globalCompositeOperation = 'source-over';

    // equipotential lines of φ while the leader grows (marching squares on the blended field)
    const fieldA = span(t, 0.0, 0.25) * (1 - span(t, STROKE - 0.1, STROKE + 0.4));
    if (fieldA > 0) {
      const s = clamp((t - LEAD0) / (LEAD1 - LEAD0)) * (STAGES - 1), s0 = Math.min(STAGES - 2, Math.floor(s)), w = s - s0;
      const A = fields[s0], B = fields[s0 + 1], v = i => A[i] + (B[i] - A[i]) * w;
      const lg = lines.getContext('2d');
      lg.clearRect(0, 0, W, H);
      lg.lineWidth = 2.2; lg.strokeStyle = `rgba(120, 220, 255, ${0.26 * fieldA})`;
      lg.beginPath();
      for (const lv of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]) {
        for (let y = 0; y < GH - 1; y++) for (let x = 0; x < GW - 1; x++) {
          const i = y * GW + x, a = v(i), b = v(i + 1), c = v(i + GW + 1), d = v(i + GW);
          const e = [];
          const cut = (p, q, x0, y0, x1, y1) => { if ((p < lv) !== (q < lv)) { const u = (lv - p) / (q - p); e.push(X0 + (x0 + (x1 - x0) * u + 0.5) * CS, Y0 + (y0 + (y1 - y0) * u) * CS); } };
          cut(a, b, x, y, x + 1, y); cut(b, c, x + 1, y, x + 1, y + 1); cut(d, c, x, y + 1, x + 1, y + 1); cut(a, d, x, y, x, y + 1);
          for (let k = 0; k + 3 < e.length; k += 4) { lg.moveTo(e[k], e[k + 1]); lg.lineTo(e[k + 2], e[k + 3]); }
        }
      }
      lg.stroke();
      lg.globalCompositeOperation = 'destination-in'; lg.drawImage(mask, 0, 0); lg.globalCompositeOperation = 'source-over';
      ctx.drawImage(lines, 0, 0);
    }

    // the channel: leader links appear in growth order; the newest ones extend out of their parent
    const n = cells.length, index = new Map(cells.map((c, k) => [c, k]));
    const age = i => t - born[index.get(i)];
    const g = layer.getContext('2d');
    g.clearRect(0, 0, W, H);
    const leaderLight = i => (age(i) > 0 ? lead * (0.45 + 0.55 * clamp(1 - age(i) / 0.3)) : 0);
    const strokeLight = i => (main[i] ? bright : twig * clamp(0.25 + Math.sqrt(sub[i]) / 6, 0, 0.8));
    links(g, i => Math.max(leaderLight(i), strokeLight(i)), i => (main[i] ? 1.6 + 3.2 * bright : 1.2 + 0.25 * Math.sqrt(sub[i]) * twig),
      (i, a) => `rgba(${main[i] ? 235 : 205}, ${main[i] ? 240 : 215}, 255, ${a})`, i => clamp(age(i) / 0.07));
    // glow: a wide soft pass and a closer one, then the sharp core on top
    ctx.globalCompositeOperation = 'lighter';
    ctx.filter = 'blur(22px)'; ctx.globalAlpha = 0.9; ctx.drawImage(layer, 0, 0);
    ctx.filter = 'blur(6px)'; ctx.globalAlpha = 0.8; ctx.drawImage(layer, 0, 0);
    ctx.filter = 'none'; ctx.globalAlpha = 1; ctx.drawImage(layer, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    // the leader's growing tips glow
    for (let k = 0; k < n; k++) {
      const a = t - born[k];
      if (a < 0 || a > 0.3 || lead <= 0) continue;
      const i = cells[k], x = pts[i * 4], y = pts[i * 4 + 1], q = (1 - a / 0.3) * lead;
      const tip = ctx.createRadialGradient(x, y, 0, x, y, 14);
      tip.addColorStop(0, `rgba(200, 220, 255, ${0.5 * q})`); tip.addColorStop(1, 'rgba(160, 180, 255, 0)');
      ctx.fillStyle = tip; ctx.fillRect(x - 14, y - 14, 28, 28);
    }

    // caption on the ground
    ctx.textAlign = 'center';
    ctx.font = `700 34px ${FONT.sans}`; ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.fillText('Dielectric breakdown model', W / 2, 1772);
    ctx.font = `500 27px ${FONT.sans}`; ctx.fillStyle = 'rgba(205, 212, 255, 0.7)';
    ctx.fillText('∇²φ = 0 · next step chosen with chance ∝ φ^2.4', W / 2, 1816);
  },
};
