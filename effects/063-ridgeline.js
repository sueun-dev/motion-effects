// Ridgeline plot (Joy Division lines): 42 stacked noise profiles, each filled underneath so it hides the ones behind;
// a wave rolls down the stack, lifting the peaks of each line in turn.
import { TAU, phase, fbm3, loop } from '../lib/util.js';

const LINES = 42, TOP = 470, GAP = 28, X0 = 110, X1 = 970;

export default {
  name: 'Ridgeline',
  ko: '리지라인',
  draw(ctx, t, W, H) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0A0B22'); bg.addColorStop(1, '#1B0F33');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    const [lx, ly] = loop(t, 0.7);
    ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (let i = 0; i < LINES; i++) {
      const base = TOP + i * GAP;
      const lift = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(phase(t) * TAU - i * 0.3)); // the rolling wave
      const pts = [];
      for (let x = X0; x <= X1; x += 5) {
        const win = Math.exp(-(((x - 540) / 210) ** 4));                   // flat at the sides, busy in the middle
        const n = fbm3(x * 0.0095, i * 0.33 + lx, ly, 3);
        const h = Math.max(0, 0.42 + n) ** 1.7 * 330 * win * lift;
        pts.push([x, base - h]);
      }
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (const [x, y] of pts) ctx.lineTo(x, y);
      ctx.lineTo(X1, base + 60); ctx.lineTo(X0, base + 60); ctx.closePath();
      ctx.fillStyle = bg; // same gradient as the backdrop, so the fills are invisible except where they hide lines
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (const [x, y] of pts) ctx.lineTo(x, y);
      const k = i / (LINES - 1);
      ctx.strokeStyle = `hsl(${190 + 120 * k}, 90%, ${68 - 8 * k}%)`;
      ctx.stroke();
    }
    const glow = ctx.createRadialGradient(W / 2, 1050, 50, W / 2, 1050, 850);
    glow.addColorStop(0, 'rgba(120, 70, 200, 0.2)'); glow.addColorStop(1, 'rgba(120, 70, 200, 0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  },
};
