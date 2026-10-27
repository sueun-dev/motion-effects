// Flat-design long shadow: each icon polygon is swept along the light direction (every edge drags a quad), filled
// once with a fading gradient and clipped to its badge. The light turns once round per loop.
import { TAU, phase } from '../lib/util.js';

const poly = (n, f) => Array.from({ length: n }, (_, i) => f(i / n * TAU, i));
const roundRect = (x, y, w, h, r) => [[x + w - r, y + r, -0.25], [x + w - r, y + h - r, 0], [x + r, y + h - r, 0.25], [x + r, y + r, 0.5]]
  .flatMap(([cx, cy, a0]) => Array.from({ length: 7 }, (_, i) => { const a = (a0 + i / 24) * TAU; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }));
const ICONS = {
  camera: [roundRect(-160, -80, 320, 210, 34), roundRect(-70, -130, 140, 70, 16)],
  heart: [poly(60, a => [4.2 * 16 * Math.sin(a) ** 3, -4.2 * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) - 8])],
  star: [poly(10, (a, i) => { const r = i % 2 ? 30 : 72; return [r * Math.sin(a), -r * Math.cos(a) + 4]; })],
  bolt: [[[18, -78], [-46, 10], [-4, 10], [-18, 78], [46, -12], [4, -12]]],
};
const BADGES = [ // x, y, radius, colour, icon, icon scale
  [540, 860, 320, '#1ABC9C', 'camera', 0.46], [250, 1480, 125, '#E85D4E', 'heart', 1], [540, 1480, 125, '#F4A62A', 'star', 1], [830, 1480, 125, '#8E5BD8', 'bolt', 1],
];

const area = P => P.reduce((s, [x, y], i) => { const [u, v] = P[(i + 1) % P.length]; return s + x * v - u * y; }, 0);
// path of everything the polygons cover while sliding by (dx, dy); every piece wound the same way, so nonzero fills the union
function sweep(ctx, polys, dx, dy) {
  ctx.beginPath();
  const piece = Q => { const R = area(Q) < 0 ? [...Q].reverse() : Q; R.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
  for (const P of polys) {
    piece(P); piece(P.map(([x, y]) => [x + dx, y + dy]));
    P.forEach(([x, y], i) => { const [u, v] = P[(i + 1) % P.length]; piece([[x, y], [u, v], [u + dx, v + dy], [x + dx, y + dy]]); });
  }
}
const fade = (ctx, dx, dy, alpha) => {
  const g = ctx.createLinearGradient(0, 0, dx, dy);
  g.addColorStop(0, `rgba(0, 0, 0, ${alpha})`); g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  return g;
};

export default {
  name: 'Long Shadow',
  ko: '롱 섀도',
  draw(ctx, t, W, H) {
    const a = phase(t) * TAU + Math.PI / 4, ux = Math.cos(a), uy = Math.sin(a);
    ctx.fillStyle = '#2C3E57'; ctx.fillRect(0, 0, W, H);
    for (const [x, y, r] of BADGES) { // the badges' own shadows across the background
      ctx.save(); ctx.translate(x, y);
      sweep(ctx, [poly(48, q => [r * Math.cos(q), r * Math.sin(q)])], ux * r * 3.2, uy * r * 3.2);
      ctx.fillStyle = fade(ctx, ux * r * 3.2, uy * r * 3.2, 0.32); ctx.fill();
      ctx.restore();
    }
    for (const [x, y, r, col, icon, s] of BADGES) {
      ctx.save(); ctx.translate(x, y);
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      ctx.clip();
      const k = r / 125 * 0.9 * s, polys = ICONS[icon].map(P => P.map(([px, py]) => [px * k, py * k]));
      sweep(ctx, polys, ux * r * 2, uy * r * 2);
      ctx.fillStyle = fade(ctx, ux * r * 1.6, uy * r * 1.6, 0.28); ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      for (const P of polys) { P.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); }
      ctx.fill();
      if (icon === 'camera') { // lens and flash
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 25 * k, 70 * k, 0, TAU); ctx.fill();
        ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(0, 25 * k, 44 * k, 0, TAU); ctx.fill();
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(110 * k, -40 * k, 14 * k, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  },
};
