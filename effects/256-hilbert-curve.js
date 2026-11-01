// Hilbert curve: the order-6 curve (4096 points on a 64 x 64 grid) drawn at a continuous "level" L. At level n every
// point sits on the centre of its order-n cell, so the line is exactly the order-n curve; between n and n + 1 each
// point slides from its order-n cell centre to its order-(n + 1) one, and the curve unfolds one order. Orders 1 -> 6
// step up with a hold on each, the colour gradient flows along the line (by arc length), then it folds back to 1.
import { TAU, clamp, lerp, span, ease, FONT } from '../lib/util.js';

const K = 6, N = 1 << (2 * K), S = 920, X0 = 80, Y0 = 400; // final order, points, square size and corner
const STEPS = [0, 0.48, 0.96, 1.44, 1.92], STEP = 0.42;      // refine n -> n + 1 starting at these times
const FOLD = [3.3, 4.75];                                    // fold 6 -> 1 in one move
const OFFSET = 0.12; // the loop starts a little way into the first step, so frame 0 follows frame 149 in motion

// Hilbert index d -> cell (x, y) on a 2^K grid (the classic d2xy)
function d2xy(d) {
  let x = 0, y = 0;
  for (let s = 1; s < 1 << K; s *= 2) {
    const rx = 1 & (d >> 1), ry = 1 & (d ^ rx);
    if (ry === 0) { if (rx === 1) { x = s - 1 - x; y = s - 1 - y; } [x, y] = [y, x]; }
    x += s * rx; y += s * ry; d >>= 2;
  }
  return [x, y];
}
const CELL = Array.from({ length: N }, (_, d) => d2xy(d));
// centre of point d's cell at order m, in px (y flipped so the curve opens downward: enters bottom left, leaves bottom right)
const centre = (d, m) => {
  const sh = K - m, size = S / (1 << m);
  return [X0 + ((CELL[d][0] >> sh) + 0.5) * size, Y0 + S - ((CELL[d][1] >> sh) + 0.5) * size];
};
const AT = Array.from({ length: K + 1 }, (_, m) => (m ? Array.from({ length: N }, (_, d) => centre(d, m)) : null));

// continuous level 1..6 and whether the in-between move is eased (refining) or linear (the one-move fold)
function level(t) {
  t = (t + OFFSET) % 5;
  if (t >= FOLD[0]) return [lerp(K, 1, (1 - Math.cos(Math.PI * span(t, FOLD[0], FOLD[1]))) / 2), false];
  let L = 1;
  for (const a of STEPS) L += span(t, a, a + STEP);
  return [L, true];
}

// the order titles on screen, [order, opacity, -1 leaving / +1 arriving], one at a time: while refining, the old title fades out over the first
// 0.15 s of a step and the new one fades in over the last 0.15 s; during the fold the order-6 title fades out at once
// and the order-1 title only comes back as the fold ends
function titles(t) {
  const u = (t + OFFSET) % 5, [L, refining] = level(t), fade = k => k * k * (3 - 2 * k);
  if (!refining) return [[K, 1 - fade(span(u, FOLD[0], FOLD[0] + 0.15)), -1], [1, fade(span(u, FOLD[1] - 0.15, FOLD[1])), 1]];
  const n = Math.floor(L), k = L - n, f = 0.15 / STEP;
  return [[n, 1 - fade(span(k, 0, f)), -1], [n + 1, fade(span(k, 1 - f, 1)), 1]].filter(([m]) => m <= K);
}

// the gradient: five colours, twice along the line, sliding one cycle per loop
const PAL = [[255, 107, 107], [255, 209, 102], [6, 214, 160], [76, 201, 240], [155, 93, 229]];
function colour(u) {
  const x = (((u % 1) + 1) % 1) * PAL.length, i = Math.floor(x), k = x - i, a = PAL[i], b = PAL[(i + 1) % PAL.length];
  const s = k * k * (3 - 2 * k);
  return `rgb(${lerp(a[0], b[0], s) | 0}, ${lerp(a[1], b[1], s) | 0}, ${lerp(a[2], b[2], s) | 0})`;
}

export default {
  name: 'Hilbert Curve',
  ko: '힐베르트 곡선',
  draw(ctx, t, W, H) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0A0C1C'); bg.addColorStop(1, '#161A36');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    const [L, eased] = level(t), n = Math.min(K - 1, Math.floor(L)), k = L - n, kk = eased ? ease.inOut(k) : k;
    const cell = S / 2 ** L;

    // the grid of the current order, the next one fading in while the curve unfolds
    ctx.lineWidth = 2;
    for (const [m, a] of [[n, 1 - kk], [n + 1, kk]]) {
      if (a < 0.01) continue;
      ctx.strokeStyle = `rgba(150, 165, 255, ${0.09 * a})`;
      ctx.beginPath();
      for (let i = 0; i <= 1 << m; i++) {
        const v = Math.round(i * S / (1 << m));
        ctx.moveTo(X0 + v, Y0); ctx.lineTo(X0 + v, Y0 + S);
        ctx.moveTo(X0, Y0 + v); ctx.lineTo(X0 + S, Y0 + v);
      }
      ctx.stroke();
    }

    // every point between its order-n and order-(n + 1) cell centres, and the running length along the line
    const P = new Float32Array(N * 2), len = new Float32Array(N);
    for (let d = 0; d < N; d++) {
      const a = AT[n][d], b = AT[n + 1][d];
      P[2 * d] = lerp(a[0], b[0], kk); P[2 * d + 1] = lerp(a[1], b[1], kk);
      if (d) len[d] = len[d - 1] + Math.hypot(P[2 * d] - P[2 * d - 2], P[2 * d + 1] - P[2 * d - 1]);
    }
    const total = len[N - 1], flow = -t / 5; // the gradient slides one colour cycle per loop
    const u = d => 2 * len[d] / total + flow;

    const width = Math.min(34, 0.38 * cell);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(170, 160, 255, 0.13)'; ctx.lineWidth = width * 2.6; // a soft halo: one path, so overlaps do not add up
    ctx.beginPath(); ctx.moveTo(P[0], P[1]);
    for (let d = 1; d < N; d++) ctx.lineTo(P[2 * d], P[2 * d + 1]);
    ctx.stroke();
    ctx.lineWidth = width; // the line itself, segment by segment in its gradient colours
    for (let d = 1; d < N; d++) {
      const x0 = P[2 * d - 2], y0 = P[2 * d - 1], x1 = P[2 * d], y1 = P[2 * d + 1], l = len[d] - len[d - 1];
      if (l < 0.01) continue;
      if (l > 30) { // long segments (low orders) get a gradient with a stop every 30 px
        const g = ctx.createLinearGradient(x0, y0, x1, y1), m = Math.ceil(l / 30);
        for (let i = 0; i <= m; i++) g.addColorStop(i / m, colour(2 * (len[d - 1] + l * i / m) / total + flow));
        ctx.strokeStyle = g;
      } else ctx.strokeStyle = colour((u(d - 1) + u(d)) / 2);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }

    // entry and exit
    for (const [d, label] of [[0, 'IN'], [N - 1, 'OUT']]) {
      const x = P[2 * d], y = P[2 * d + 1];
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(x, Y0 + S + 34, 7, 0, TAU); ctx.fill();
      ctx.font = `700 24px ${FONT.mono}`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText(label, x, Y0 + S + 76);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, Y0 + S + 26); ctx.lineTo(x, y + Math.min(width, 34) / 2 + 6); ctx.stroke();
    }

    // the order: one title at a time (the old one leaves upward before the new one rises in), and six pips that fill
    const cy = 1560;
    ctx.textAlign = 'center';
    for (const [m, a, dir] of titles(t)) {
      if (a <= 0.004) continue;
      const dy = 24 * (1 - a) * dir; // a title coming in rises from below, one going out leaves upward
      ctx.globalAlpha = a;
      ctx.fillStyle = '#FFFFFF'; ctx.font = `700 92px ${FONT.display}`;
      ctx.fillText(`ORDER ${m}`, W / 2, cy + dy);
      ctx.fillStyle = 'rgba(200, 210, 255, 0.75)'; ctx.font = `500 34px ${FONT.mono}`;
      ctx.fillText(`${(4 ** m).toLocaleString('en-US')} cells · one line`, W / 2, cy + 64 + dy);
    }
    ctx.globalAlpha = 1;
    for (let m = 1; m <= K; m++) {
      const x = W / 2 + (m - 3.5) * 64, y = cy + 140, f = clamp(L - m + 1);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, 13, 0, TAU); ctx.stroke();
      if (f > 0) { ctx.fillStyle = colour((m - 1) / 6); ctx.beginPath(); ctx.arc(x, y, 13 * f, 0, TAU); ctx.fill(); }
    }
  },
};
