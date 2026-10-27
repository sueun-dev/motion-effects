// Stagger: every tile plays the same pop-in / shrink-out animation, only delayed by its diagonal index
// (row + column) x 100 ms, so the grid cascades in and out like a wave.
import { TAU, span, ease } from '../lib/util.js';

const COLS = 4, ROWS = 6, SIZE = 190, GAP = 28, DELAY = 0.1;
const X0 = (1080 - (COLS * SIZE + (COLS - 1) * GAP)) / 2, Y0 = 400;
const COLORS = ['#FF6B6B', '#FFB84C', '#4ECDC4', '#5B7CFA', '#A78BFA', '#FF8FC7'];

function icon(ctx, kind, r) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'; ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)'; ctx.lineWidth = 14; ctx.lineCap = 'round';
  ctx.beginPath();
  if (kind === 0) ctx.arc(0, 0, r, 0, TAU);
  if (kind === 1) ctx.roundRect(-r, -r, 2 * r, 2 * r, r * 0.3);
  if (kind === 2) { ctx.moveTo(0, -r); ctx.lineTo(r, r * 0.8); ctx.lineTo(-r, r * 0.8); }
  if (kind === 3) { ctx.arc(0, 0, r * 0.85, 0, TAU); ctx.stroke(); return; }
  if (kind === 4) { ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke(); return; }
  if (kind === 5) for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU - Math.PI / 2, rr = k % 2 ? r * 0.45 : r; ctx.lineTo(rr * Math.cos(a), rr * Math.sin(a)); }
  ctx.fill();
}

export default {
  name: 'Stagger',
  ko: '스태거',
  draw(ctx, t, W, H) {
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#20233F'); bg.addColorStop(1, '#3A2550');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = X0 + c * (SIZE + GAP) + SIZE / 2, y = Y0 + r * (SIZE + GAP) + SIZE / 2, d = (r + c) * DELAY;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'; ctx.lineWidth = 3; // the empty slot
        ctx.beginPath(); ctx.roundRect(x - SIZE / 2 + 4, y - SIZE / 2 + 4, SIZE - 8, SIZE - 8, 40); ctx.stroke();

        const out = ease.in(span(t, 0.6 + d, 1.1 + d));   // leave one after another ...
        const inn = ease.outBack(span(t, 2.3 + d, 2.9 + d)); // ... and come back in the same order
        const k = t < 2.1 ? 1 - out : inn;
        if (k <= 0.001) continue;
        const spin = t < 2.1 ? 0.5 * out : -0.4 * (1 - span(t, 2.3 + d, 2.9 + d)) ** 2;
        ctx.save();
        ctx.translate(x, y + (t < 2.1 ? 60 * out : 0)); ctx.rotate(spin); ctx.scale(k, k);
        ctx.globalAlpha = Math.min(1, k * 1.5);
        const color = COLORS[(r * 2 + c * 3) % COLORS.length];
        const g = ctx.createLinearGradient(0, -SIZE / 2, 0, SIZE / 2);
        g.addColorStop(0, color); g.addColorStop(1, color + 'CC');
        ctx.fillStyle = g;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 12;
        ctx.beginPath(); ctx.roundRect(-SIZE / 2, -SIZE / 2, SIZE, SIZE, 40); ctx.fill();
        ctx.shadowColor = 'transparent';
        icon(ctx, (r * 4 + c) % 6, 42);
        ctx.restore();
      }
    }
  },
};
