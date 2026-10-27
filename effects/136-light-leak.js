// Light leak (film burn): warm radial glows, stretched and tilted, travel across the frame on eased paths with
// 'screen' blending. They swell to a near-white burn in the middle of the transition, where the scenes crossfade.
import { W, H, span, lerp, smoothstep, canvas } from '../lib/util.js';
import { landscape, city } from '../lib/scenes.js';

const A = canvas(), B = canvas();
city(B.getContext('2d'), W, H);
// colour, start and end centre (fractions of the frame), radius, stretch, strength
const LEAKS = [
  ['255, 60, 20', [-0.6, 0.85], [1.4, 0.15], 1000, 2.2, 1],
  ['255, 135, 25', [-0.5, 0.6], [1.5, 0.4], 820, 2, 0.95],
  ['255, 205, 80', [-0.7, 0.38], [1.4, 0.75], 700, 1.8, 0.9],
  ['255, 246, 225', [-0.5, 0.62], [1.6, 0.42], 480, 1.6, 0.8], // the hot core, added on top ('lighter')
];

// A holds, A->B (0.5-2.0 s), B holds, B->A (3.0-4.5 s), A holds: frame 150 = frame 0
const stage = t => (t < 2.5 ? [A, B, span(t, 0.5, 2.0)] : [B, A, span(t, 3.0, 4.5)]);

export default {
  name: 'Light Leak',
  ko: '라이트 리크',
  draw(ctx, t, W, H) {
    landscape(A.getContext('2d'), W, H, t);
    const [from, to, p] = stage(t);
    const burn = Math.sin(Math.PI * p) ** 2; // 0 -> 1 -> 0 across the transition
    ctx.drawImage(from, 0, 0);
    ctx.globalAlpha = smoothstep(0.25, 0.75, p); ctx.drawImage(to, 0, 0); ctx.globalAlpha = 1;
    if (burn <= 0) return;

    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = `rgba(255, 120, 50, ${0.3 * burn})`; ctx.fillRect(0, 0, W, H); // overall warm exposure
    LEAKS.forEach(([rgb, [x0, y0], [x1, y1], r, stretch, strength], i) => {
      if (i === 3) ctx.globalCompositeOperation = 'lighter';
      const e = smoothstep(i * 0.05, 0.85 + i * 0.05, p); // where along its path
      ctx.save();
      ctx.translate(W * lerp(x0, x1, e), H * lerp(y0, y1, e));
      ctx.rotate(-0.6);
      ctx.scale(stretch, 1);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, `rgba(${rgb}, ${strength * burn})`);
      g.addColorStop(0.45, `rgba(${rgb}, ${0.5 * strength * burn})`);
      g.addColorStop(1, `rgba(${rgb}, 0)`);
      ctx.fillStyle = g; ctx.fillRect(-r, -r, 2 * r, 2 * r);
      ctx.restore();
    });
    ctx.globalCompositeOperation = 'source-over';
  },
};
