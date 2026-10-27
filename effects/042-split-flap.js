// Split-flap (Solari) board: each cell flips through a few letters to its new one. A flip = the old top half
// folding down on its hinge (scaleY = cos) and then the new bottom half falling into place.
import { rng, FONT } from '../lib/util.js';

const A = ['SEOUL', 'TOKYO', 'PARIS', 'LONDON'], B = ['BERLIN', 'SYDNEY', 'MADRID', 'BUSAN'];
const COLS = 7, CW = 120, CH = 176, GAP = 10, ROWGAP = 30;
const X0 = (1080 - (COLS * CW + (COLS - 1) * GAP)) / 2, Y0 = 760;
const FLIP = 0.13, CHANGES = [[0.35, A, B], [2.85, B, A]]; // flip seconds; [start, from, to]
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const pad = w => w.padEnd(COLS, ' ');

// the letters a cell shows during one change: old, a few in between, new
const SEQ = CHANGES.map(([, from, to], c) => from.map((w, row) => [...pad(w)].map((ch, col) => {
  const r = rng(1000 * c + 10 * row + col + 1), n = 2 + Math.floor(r() * 5), seq = [ch];
  for (let k = 0; k < n; k++) seq.push(ALPHA[Math.floor(r() * 26)]);
  seq.push(pad(to[row])[col]);
  return seq;
})));

// one half of a tile with its letter, squashed towards the hinge by s (1 = flat on the board)
function half(ctx, ch, x, y, top, s = 1, shade = 0) {
  const m = y + CH / 2;
  ctx.save();
  ctx.translate(0, m); ctx.scale(1, s); ctx.translate(0, -m);
  ctx.beginPath(); ctx.roundRect(x, top ? y : m + 2, CW, CH / 2 - 2, top ? [12, 12, 0, 0] : [0, 0, 12, 12]); ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, y + CH);
  g.addColorStop(0, '#2A2B31'); g.addColorStop(0.5, '#1C1D22'); g.addColorStop(1, '#2A2B31');
  ctx.fillStyle = g; ctx.fillRect(x, y, CW, CH);
  ctx.fillStyle = '#F5F1E6'; ctx.fillText(ch, x + CW / 2, m + 4);
  if (shade) { ctx.fillStyle = `rgba(0, 0, 0, ${shade})`; ctx.fillRect(x, y, CW, CH); }
  ctx.restore();
}

function cell(ctx, t, row, col, x, y) {
  let cur = pad(A[row])[col], flip = null;
  CHANGES.forEach(([start], c) => {
    const seq = SEQ[c][row][col], k = (t - start - row * 0.16 - col * 0.05) / FLIP;
    if (k >= 0) cur = seq[Math.min(Math.floor(k) + 1, seq.length - 1)];
    if (k >= 0 && k < seq.length - 1) flip = [seq[Math.floor(k)], seq[Math.floor(k) + 1], k % 1];
  });
  if (!flip) { half(ctx, cur, x, y, true); half(ctx, cur, x, y, false); return; }
  const [old, next, u] = flip, c = Math.cos(Math.PI * u);
  half(ctx, next, x, y, true);           // behind: the new top half
  half(ctx, old, x, y, false);           // the old bottom half, until it is covered
  if (u < 0.5) half(ctx, old, x, y, true, c, 0.55 * (1 - c));      // the old top folds down...
  else half(ctx, next, x, y, false, -c, 0.45 * (1 + c));           // ...and lands as the new bottom
}

export default {
  name: 'Split-Flap',
  ko: '스플릿 플랩',
  draw(ctx, t, W, H) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#20232B'); bg.addColorStop(1, '#0E1014');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    const bw = COLS * CW + (COLS - 1) * GAP + 64, bh = 4 * CH + 3 * ROWGAP + 64;
    ctx.fillStyle = '#08090C';
    ctx.beginPath(); ctx.roundRect(X0 - 32, Y0 - 32, bw, bh, 28); ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; ctx.lineWidth = 3; ctx.stroke();

    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFC93C'; ctx.font = `800 64px ${FONT.sans}`;
    ctx.fillText('DEPARTURES', X0, Y0 - 120);
    ctx.font = `700 48px ${FONT.ko}`; ctx.textAlign = 'right';
    ctx.fillText('출발', X0 + bw - 64, Y0 - 120);

    ctx.textAlign = 'center';
    ctx.font = `700 124px ${FONT.sans}`;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < COLS; col++) cell(ctx, t, row, col, X0 + col * (CW + GAP), Y0 + row * (CH + ROWGAP));
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; // the hinge gap across every row
    for (let row = 0; row < 4; row++) ctx.fillRect(X0 - 8, Y0 + row * (CH + ROWGAP) + CH / 2 - 2, bw - 48, 4);

    ctx.fillStyle = 'rgba(245, 241, 230, 0.45)'; ctx.font = `500 36px ${FONT.mono}`;
    ctx.fillText('ALL FLIGHTS ON TIME', W / 2, Y0 + bh + 50);
  },
};
