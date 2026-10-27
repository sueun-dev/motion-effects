// Easing: six balls travel the same distance in the same time, each through a different easing function.
// Faint dots under each track mark where the ball is at equal time steps (a spacing chart); ghosts show speed.
import { TAU, span, ease, FONT } from '../lib/util.js';

const LANES = [
  ['linear', k => k, '#7C8CFF'],
  ['ease-in', ease.in, '#3CC6B8'],
  ['ease-out', ease.out, '#FFB547'],
  ['ease-in-out', ease.inOut, '#FF7A6B'],
  ['back', ease.outBack, '#C77DFF'],
  ['bounce', ease.outBounce, '#FF6FA8'],
];
const X0 = 150, X1 = 930, TOP = 330, GAP = 250, R = 36;

// 0..1 along the track: out on [0.4, 2.2] s, back on [2.9, 4.7] s (the same easing, mirrored)
const pos = (f, t) => (t < 2.55 ? f(span(t, 0.4, 2.2)) : 1 - f(span(t, 2.9, 4.7)));

export default {
  name: 'Easing Curves',
  ko: '이징',
  draw(ctx, t, W, H) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1B1D3A'); bg.addColorStop(1, '#2C2150');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    LANES.forEach(([name, f, color], i) => {
      const y = TOP + i * GAP + 150;
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `700 58px ${FONT.sans}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(name, X0 - R, y - 70);

      // the curve itself, small, at the right of the label
      const gx = X1 - 90, gy = y - 72, gw = 120, gh = 70;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'; ctx.lineWidth = 2;
      ctx.strokeRect(gx - gw / 2 + 30, gy - gh, gw, gh);
      ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.beginPath();
      for (let s = 0; s <= 40; s++) ctx.lineTo(gx - gw / 2 + 30 + (s / 40) * gw, gy - f(s / 40) * gh);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath(); ctx.roundRect(X0 - R - 8, y - R - 8, X1 - X0 + 2 * R + 16, 2 * R + 16, R + 8); ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'; // spacing chart: 13 equal time steps
      for (let s = 0; s <= 12; s++) { ctx.beginPath(); ctx.arc(X0 + (X1 - X0) * f(s / 12), y + R + 30, 6, 0, TAU); ctx.fill(); }

      for (let g = 4; g >= 1; g--) { // ghosts a few frames back
        const x = X0 + (X1 - X0) * pos(f, t - g * 0.035);
        ctx.fillStyle = color; ctx.globalAlpha = 0.07 * (5 - g);
        ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
      const x = X0 + (X1 - X0) * pos(f, t);
      const ball = ctx.createRadialGradient(x - 12, y - 14, 4, x, y, R);
      ball.addColorStop(0, '#FFFFFF'); ball.addColorStop(0.25, color); ball.addColorStop(1, color);
      ctx.fillStyle = ball;
      ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
    });
  },
};
