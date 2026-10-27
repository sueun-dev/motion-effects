// Text on a path: each glyph is placed by arc length along a curve and turned to the curve's tangent.
// A badge of two counter-rotating circle texts, and two wavy ribbons whose words stream along the wave.
import { TAU, phase, FONT } from '../lib/util.js';

const INK = '#1D2340', ORANGE = '#FF6B3D', CREAM = '#F6EEDF';

// glyphs spread evenly round a circle, starting at angle rot (0 = top, clockwise)
function ringText(ctx, text, cx, cy, r, rot, font, color) {
  ctx.font = font;
  const chars = [...text], widths = chars.map(c => ctx.measureText(c).width);
  const gap = (TAU * r - widths.reduce((a, b) => a + b, 0)) / chars.length;
  ctx.fillStyle = color;
  let s = 0;
  chars.forEach((c, i) => {
    const a = rot + (s + widths[i] / 2) / r;
    ctx.save();
    ctx.translate(cx + r * Math.sin(a), cy - r * Math.cos(a));
    ctx.rotate(a);
    ctx.fillText(c, 0, 0);
    ctx.restore();
    s += widths[i] + gap;
  });
}

// a sine wave sampled as a polyline with its running arc length, so we can ask for the point at length s
function wave(W, y0, amp, len, ph) {
  const pts = [], cum = [0];
  for (let x = -300; x <= W + 300; x += 5) pts.push([x, y0 + amp * Math.sin(x / len * TAU + ph)]);
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const at = s => {
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] < s) lo = m; else hi = m; }
    const k = (s - cum[lo]) / (cum[hi] - cum[lo]), [x0, y0_] = pts[lo], [x1, y1] = pts[hi];
    return { x: x0 + (x1 - x0) * k, y: y0_ + (y1 - y0_) * k, a: Math.atan2(y1 - y0_, x1 - x0) };
  };
  return { pts, total: cum[cum.length - 1], at };
}

function ribbon(ctx, W, y0, ph, flow, text, band, color) {
  const path = wave(W, y0, 70, 620, ph);
  ctx.strokeStyle = band; ctx.lineWidth = 118; ctx.lineJoin = 'round';
  ctx.beginPath(); path.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  ctx.font = `900 64px ${FONT.black}`;
  const chars = [...text], widths = chars.map(c => ctx.measureText(c).width), rep = widths.reduce((a, b) => a + b, 0);
  ctx.fillStyle = color;
  let s = ((flow * rep) % rep + rep) % rep - rep; // one repeat before the start, so the left end is never empty
  for (let i = 0; s < path.total; i = (i + 1) % chars.length) {
    const p = path.at(Math.max(0, s + widths[i] / 2));
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillText(chars[i], 0, 0); ctx.restore();
    s += widths[i];
  }
}

export default {
  name: 'Text on Path',
  ko: '패스 텍스트',
  draw(ctx, t, W, H) {
    const a = phase(t) * TAU;
    const bg = ctx.createRadialGradient(W / 2, 1040, 100, W / 2, 1040, 1200);
    bg.addColorStop(0, '#FFF7EA'); bg.addColorStop(1, '#EAD9C0');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    // the words travel one repeat along each ribbon per loop, while the wave itself rolls once
    ribbon(ctx, W, 450, -a, phase(t), 'FOLLOW THE CURVE  ✦  ', INK, CREAM);
    ribbon(ctx, W, 1650, a + 1.5, -phase(t), 'TEXT ON A PATH  ✦  패스 텍스트  ✦  ', ORANGE, INK);

    const cx = W / 2, cy = 1050;
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(cx, cy, 430, 0, TAU); ctx.fill();
    ctx.fillStyle = CREAM; ctx.beginPath(); ctx.arc(cx, cy, 328, 0, TAU); ctx.fill();
    // each ring holds its words three times, so a third of a turn per loop brings it back to the start
    ringText(ctx, 'CIRCULAR TEXT ● '.repeat(3), cx, cy, 380, a / 3, `900 54px ${FONT.black}`, CREAM);
    ringText(ctx, '원형 텍스트 ● '.repeat(3), cx, cy, 275, -a / 3, `800 46px ${FONT.ko}`, INK);
    ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.arc(cx, cy, 215, 0, TAU); ctx.fill();

    // an eight-point star in the middle: a quarter turn per loop lands on itself
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a / 4);
    ctx.fillStyle = CREAM; ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const r = i % 2 ? 62 : 150, b = i / 16 * TAU;
      ctx.lineTo(r * Math.sin(b), -r * Math.cos(b));
    }
    ctx.fill(); ctx.restore();
  },
};
