// Pendulum wave, seen from above: pendulum k swings exactly 1 + k times in 5 seconds, so neighbours drift
// apart by one swing per loop: the row snakes, splits into two, three, four lines and lines up again at t = 5.
import { TAU, hsl } from '../lib/util.js';

const N = 10, TOP = 440, GAP = 132, AMP = 300, R = 38;
const swing = (k, t) => Math.cos(TAU * (1 + k) * t / 5); // -1 .. 1, all at +1 when t = 0 or 5

export default {
  name: 'Pendulum Wave',
  ko: '진자 파동',
  draw(ctx, t, W, H) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0E1430'); bg.addColorStop(1, '#1B1446');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'; ctx.lineWidth = 2; // faint ruler marks of the swing
    for (let x = -3; x <= 3; x++) { ctx.beginPath(); ctx.moveTo(W / 2 + x * AMP / 3, TOP - 60); ctx.lineTo(W / 2 + x * AMP / 3, TOP + GAP * (N - 1) + 60); ctx.stroke(); }

    const cx = W / 2;
    const ball = (k, s) => ({ x: cx + AMP * swing(k, s), y: TOP + k * GAP - 22 * swing(k, s) ** 2 }); // a little higher at the ends

    // the curve through all the balls shows the wave
    const pts = Array.from({ length: N }, (_, k) => ball(k, t));
    ctx.strokeStyle = 'rgba(190, 210, 255, 0.35)'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let k = 1; k < N - 1; k++) ctx.quadraticCurveTo(pts[k].x, pts[k].y, (pts[k].x + pts[k + 1].x) / 2, (pts[k].y + pts[k + 1].y) / 2);
    ctx.lineTo(pts[N - 1].x, pts[N - 1].y); ctx.stroke();

    // pivot bar
    ctx.fillStyle = '#C9B48A';
    ctx.beginPath(); ctx.roundRect(cx - 14, TOP - 70, 28, GAP * (N - 1) + 140, 14); ctx.fill();

    // motion blur: each ball and string is drawn at 10 moments across half a frame (a 180° shutter),
    // each faint, so a fast ball becomes a soft streak instead of jumping
    const S = 10, alpha = 1 - 0.02 ** (1 / S);
    for (let k = 0; k < N; k++) {
      const hue = 330 - k * 26, y0 = TOP + k * GAP;
      ctx.globalAlpha = alpha;
      for (let j = 0; j < S; j++) {
        const p = ball(k, t - j / S / 60);
        ctx.strokeStyle = 'rgba(230, 235, 255, 0.55)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(cx, y0); ctx.lineTo(p.x, p.y); ctx.stroke();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.beginPath(); ctx.ellipse(p.x + 16, y0 + 26, R * 0.95, R * 0.5, 0, 0, TAU); ctx.fill();
        const g = ctx.createRadialGradient(p.x - R * 0.35, p.y - R * 0.4, R * 0.1, p.x, p.y, R);
        g.addColorStop(0, hsl(hue, 100, 88)); g.addColorStop(0.6, hsl(hue, 85, 62)); g.addColorStop(1, hsl(hue, 70, 42));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#E9DDBE';
      ctx.beginPath(); ctx.arc(cx, y0, 7, 0, TAU); ctx.fill();
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; ctx.textAlign = 'center';
    ctx.font = '600 40px "Apple SD Gothic Neo", sans-serif';
    ctx.fillText('5초에 1번, 2번 … 10번 흔들리는 진자', cx, 1800);
  },
};
