// Ink transition: blots spread from a few drops; each outline is a circle whose radius is pushed in and out by fbm
// noise around the angle (fixed, morphing only as the blot grows). A coral rim and a dark ink fringe run just ahead
// of the next scene, so the edge looks wet. Nine drops start one after another and spread at a steady pace.
import { W, H, TAU, span, fbm3, canvas } from '../lib/util.js';
import { landscape, city } from '../lib/scenes.js';

const A = canvas(), B = canvas();
city(B.getContext('2d'), W, H);
const DROPS = [[0.5, 0.5, 0], [0.22, 0.2, 0.05], [0.8, 0.82, 0.1], [0.82, 0.2, 0.14], [0.18, 0.78, 0.18],
  [0.5, 0.86, 0.22], [0.5, 0.15, 0.26], [0.18, 0.5, 0.3], [0.84, 0.5, 0.35]]; // x, y, start; at full size they cover all
const LAYERS = [['#FF5D73', 120, 0.08], ['#1C1236', 55, 0.04], [null, 0, 0]]; // colour (null = next scene), lead px, lead %
const GROW = 0.65, RMAX = 640, STEPS = 180;

// A holds, A->B (0.3-2.2 s, the ink covers A by about 1.3 s), B holds, B->A (2.8-4.7 s), A holds: frame 150 = frame 0
const stage = t => (t < 2.5 ? [A, B, span(t, 0.3, 2.2), 0] : [B, A, span(t, 2.8, 4.7), 1]);

// all drops of one layer as one path (their union)
function blots(p, lead, leadPct, flip) {
  const path = new Path2D();
  DROPS.forEach(([x, y, start], i) => {
    const e = span(p, start, start + GROW);
    if (e <= 0) return;
    const R = RMAX * e * (1 + leadPct) + lead * Math.min(1, e * 12); // the rim and fringe grow in quickly
    const cx = W * x, cy = H * (flip ? 1 - y : y);
    for (let s = 0; s <= STEPS; s++) {
      const a = (s / STEPS) * TAU;
      const r = R * (1 + 0.3 * fbm3(Math.cos(a) * 1.7 + i * 3.7 + flip * 9, Math.sin(a) * 1.7 + i * 1.9, R / 600 + lead / 300, 4));
      s ? path.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : path.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    path.closePath();
  });
  return path;
}

export default {
  name: 'Ink Transition',
  ko: '잉크 트랜지션',
  draw(ctx, t, W, H) {
    landscape(A.getContext('2d'), W, H, t);
    const [from, to, p, flip] = stage(t);
    ctx.drawImage(from, 0, 0);
    for (const [color, lead, leadPct] of LAYERS) {
      const path = blots(p, lead, leadPct, flip);
      if (color) { ctx.fillStyle = color; ctx.fill(path); continue; }
      ctx.save(); ctx.clip(path); ctx.drawImage(to, 0, 0); ctx.restore();
    }
  },
};
