// Shape morph: every shape is stored as its radius in 360 directions from the centre (circle, square, star,
// heart), so morphing is just blending the two radius lists; colours blend along with it.
import { TAU, phase, lerp, clamp, ease, hsl, FONT } from '../lib/util.js';

const N = 360, R = 300, CX = 540, CY = 1010;

// distance from the centre to a closed polygon along direction a (first hit)
function rayHit(poly, a) {
  const dx = Math.cos(a), dy = Math.sin(a);
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
    const ex = x2 - x1, ey = y2 - y1, den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const s = (x1 * ey - y1 * ex) / den, u = (x1 * dy - y1 * dx) / den;
    if (s > 0 && u >= 0 && u <= 1) best = Math.min(best, s);
  }
  return best;
}
const radii = poly => Array.from({ length: N }, (_, i) => rayHit(poly, (i / N) * TAU));
const star = Array.from({ length: 10 }, (_, k) => { const a = (k / 10) * TAU - Math.PI / 2, r = k % 2 ? 0.48 : 1.12; return [r * Math.cos(a), r * Math.sin(a)]; });
const heart = Array.from({ length: 240 }, (_, k) => {
  const s = (k / 240) * TAU;
  return [(16 * Math.sin(s) ** 3) / 16.5, -(13 * Math.cos(s) - 5 * Math.cos(2 * s) - 2 * Math.cos(3 * s) - Math.cos(4 * s)) / 16.5 - 0.12];
});
const SHAPES = [
  { r: Array(N).fill(1), hue: 345, name: 'circle' },
  { r: Array.from({ length: N }, (_, i) => 0.9 / Math.max(Math.abs(Math.cos((i / N) * TAU)), Math.abs(Math.sin((i / N) * TAU)))), hue: 380, name: 'square' },
  { r: radii(star), hue: 405, name: 'star' },
  { r: radii(heart), hue: 325, name: 'heart' },
];
// colours blend by hue, so the in-between colours stay bright (the hues avoid yellow, where brightness peaks)
const hueOf = (A, B, k) => lerp(A.hue, B.hue, k) % 360;

function outline(ctx, r, cx, cy, size) {
  ctx.beginPath();
  for (let i = 0; i < N; i++) { const a = (i / N) * TAU; ctx.lineTo(cx + size * r[i] * Math.cos(a), cy + size * r[i] * Math.sin(a)); }
  ctx.closePath();
}

export default {
  name: 'Shape Morph',
  ko: '셰이프 모프',
  draw(ctx, t, W, H) {
    const seg = (phase(t) * 4) % 4, i = Math.floor(seg), A = SHAPES[i], B = SHAPES[(i + 1) % 4];
    const k = ease.inOut(clamp((seg - i - 0.3) / 0.7)); // hold, then morph to the next shape
    const r = A.r.map((v, n) => lerp(v, B.r[n], k));
    const hue = hueOf(A, B, k);

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#FFF8F0'); bg.addColorStop(1, '#F6E6F4');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    const pulse = 1 + 0.05 * Math.sin(Math.PI * k); // a small swell while it changes
    ctx.save();
    ctx.shadowColor = 'rgba(120, 60, 90, 0.28)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 34;
    const g = ctx.createLinearGradient(CX - R, CY - R, CX + R, CY + R);
    g.addColorStop(0, hsl(hue + 10, 95, 70)); g.addColorStop(1, hsl(hue - 8, 85, 56));
    ctx.fillStyle = g;
    outline(ctx, r, CX, CY, R * pulse); ctx.fill();
    ctx.restore();
    ctx.save(); // soft highlight inside the shape
    outline(ctx, r, CX, CY, R * pulse); ctx.clip();
    const hl = ctx.createRadialGradient(CX - 120, CY - 150, 10, CX - 120, CY - 150, 300);
    hl.addColorStop(0, 'rgba(255,255,255,0.45)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl; ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // the sequence below: circle -> square -> star -> heart, the current step lit up
    SHAPES.forEach((s, n) => {
      const x = 225 + n * 210, y = 1600;
      const on = n === i ? 1 - k : n === (i + 1) % 4 ? k : 0;
      ctx.fillStyle = hsl(s.hue % 360, 80 * on, 84 - 26 * on);
      outline(ctx, s.r, x, y, 46 + 14 * on); ctx.fill();
      ctx.fillStyle = `rgba(90, 60, 100, ${0.45 + 0.5 * on})`;
      ctx.font = `600 34px ${FONT.sans}`; ctx.textAlign = 'center';
      ctx.fillText(s.name, x, y + 110);
      if (n < 3) { ctx.fillStyle = 'rgba(90, 60, 100, 0.35)'; ctx.font = `600 40px ${FONT.sans}`; ctx.fillText('→', x + 105, y + 14); }
    });
  },
};
