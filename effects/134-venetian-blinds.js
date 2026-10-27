// Venetian blinds: the frame is cut into horizontal slats that each turn about their own axis (drawn height = |cos|),
// one after another from the top. The front of every slat is scene A, the back is scene B; shading follows the turn.
import { W, H, span, smoothstep, canvas } from '../lib/util.js';
import { landscape, city } from '../lib/scenes.js';

const A = canvas(), B = canvas();
city(B.getContext('2d'), W, H);
const N = 12, SH = H / N; // 12 slats, 160 px each

// slat i turns 0 -> 180 degrees in A->B (0.5-2.0 s) and on to 360 in B->A (3.0-4.5 s): frame 150 = frame 0
function angle(t, i) {
  const d = (i / (N - 1)) * 0.45, turn = p => smoothstep(d, d + 0.55, p);
  return Math.PI * (turn(span(t, 0.5, 2.0)) + turn(span(t, 3.0, 4.5)));
}

export default {
  name: 'Venetian Blinds',
  ko: '블라인드',
  draw(ctx, t, W, H) {
    landscape(A.getContext('2d'), W, H, t);
    ctx.fillStyle = '#0B0814'; ctx.fillRect(0, 0, W, H); // seen through the gaps of turned slats
    for (let i = 0; i < N; i++) {
      const a = angle(t, i), c = Math.cos(a), s = Math.sin(a);
      const h = SH * Math.abs(c), y = i * SH + (SH - h) / 2;
      if (h < 0.5) continue;
      ctx.drawImage(c >= 0 ? A : B, 0, i * SH, W, SH, 0, y, W, h);
      if (Math.abs(s) < 0.01) continue;
      const shade = ctx.createLinearGradient(0, y, 0, y + h); // the tilted slat catches light on one side
      const lit = `rgba(255, 240, 220, ${0.22 * s * s})`, dark = `rgba(8, 5, 20, ${0.7 * s * s})`;
      shade.addColorStop(0, s > 0 ? lit : dark); shade.addColorStop(1, s > 0 ? dark : lit);
      ctx.fillStyle = shade; ctx.fillRect(0, y, W, h);
    }
  },
};
