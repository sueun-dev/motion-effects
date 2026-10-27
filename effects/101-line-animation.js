// Stroke draw-on: each line is a list of points with its running length; the visible piece of the stroke grows
// from 0 to its full length on a schedule (a pen dot leads it), then the tail runs after it to erase, so it loops.
import { TAU, span, ease } from '../lib/util.js';

const circle = (cx, cy, r, a0 = -Math.PI / 2) => Array.from({ length: 121 }, (_, i) => [cx + r * Math.cos(a0 + (i / 120) * TAU), cy + r * Math.sin(a0 + (i / 120) * TAU)]);
// smooth curve through points (Catmull-Rom), for the handwriting
function smooth(pts, steps = 10) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [p0, p1, p2, p3] = [pts[Math.max(i - 1, 0)], pts[i], pts[i + 1], pts[Math.min(i + 2, pts.length - 1)]];
    for (let s = 0; s < steps; s++) {
      const u = s / steps, u2 = u * u, u3 = u2 * u;
      out.push([0, 1].map(k => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3)));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
const hello = smooth([[0, 0], [40, -40], [88, -150], [104, -214], [86, -226], [70, -200], [68, -120], [70, -40], [72, 0], [82, -52], [106, -86], [132, -80], [142, -48], [144, -6],
  [168, -14], [202, -44], [214, -74], [198, -90], [176, -78], [170, -42], [182, -8], [210, 0], [240, -18], [264, -64], [288, -152], [296, -214], [280, -228], [264, -204], [262, -120],
  [266, -40], [282, -2], [308, -14], [334, -64], [358, -152], [366, -214], [350, -228], [334, -204], [332, -120], [336, -40], [352, -2], [380, -14], [404, -56], [428, -86],
  [458, -86], [474, -56], [462, -18], [436, -2], [414, -20], [414, -56], [436, -82], [470, -84], [506, -78], [540, -66]]).map(([x, y]) => [x * 1.45 + 150, y * 1.45 + 1500]);

// [points, start, end, width, colour]: drawn in this order
const STROKES = [
  [circle(540, 760, 330), 0.15, 0.95, 10, '#2D2A4A'],
  [[[286, 952], [420, 720], [482, 792], [600, 596], [700, 752], [742, 712], [794, 952]], 0.85, 1.5, 10, '#2D2A4A'],
  [[[560, 662], [586, 690], [606, 664], [628, 690], [646, 664]], 1.45, 1.65, 8, '#2D2A4A'],
  [circle(690, 548, 52, Math.PI), 1.55, 1.95, 10, '#FF7A59'],
  [[[322, 1000], [758, 1000]], 1.8, 2.05, 8, '#3D8BD9'],
  [[[380, 1040], [700, 1040]], 1.9, 2.15, 8, '#3D8BD9'],
  [[[452, 1076], [628, 1076]], 2.0, 2.2, 8, '#3D8BD9'],
  [[[350, 562], [366, 546], [382, 562], [398, 546], [414, 562]], 2.05, 2.25, 7, '#2D2A4A'],
  [[[430, 500], [442, 489], [454, 500], [466, 489], [478, 500]], 2.15, 2.32, 6, '#2D2A4A'],
  [hello, 2.25, 3.55, 15, '#E2466E'],
].map(([pts, a, b, w, c]) => {
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, len, a, b, w, c };
});

// the part of a stroke between lengths from..to; returns the point at `to`
function piece(ctx, { pts, len }, from, to) {
  ctx.beginPath();
  let tip = pts[0], started = false;
  for (let i = 1; i < pts.length; i++) {
    if (len[i] < from || len[i - 1] > to) continue;
    const at = d => { const k = (d - len[i - 1]) / (len[i] - len[i - 1] || 1); return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k]; };
    const p = at(Math.max(from, len[i - 1])), q = at(Math.min(to, len[i]));
    if (!started) { ctx.moveTo(p[0], p[1]); started = true; }
    ctx.lineTo(q[0], q[1]);
    tip = q;
  }
  ctx.stroke();
  return tip;
}

export default {
  name: 'Line Animation',
  ko: '라인 애니메이션',
  draw(ctx, t0, W, H) {
    const t = (t0 + 0.5) % 5; // start the loop mid-drawing; the blank page comes near the end
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#FFF8EC'); bg.addColorStop(1, '#FBE9D8');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(45, 42, 74, 0.06)'; // faint dotted paper
    for (let y = 300; y < H; y += 48) for (let x = 36; x < W; x += 48) { ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill(); }

    ctx.translate(0, 70);
    ctx.lineCap = ctx.lineJoin = 'round';
    for (const s of STROKES) {
      const total = s.len[s.len.length - 1];
      const on = ease.inOut(span(t, s.a, s.b)) * total;                               // the pen draws ...
      const off = ease.inOut(span(t, 3.7 + (s.a - 0.15) * 0.3, 3.9 + (s.b - 0.15) * 0.3)) * total; // ... the tail erases
      if (on <= off) continue;
      ctx.strokeStyle = s.c; ctx.lineWidth = s.w;
      const tip = piece(ctx, s, off, on);
      const pen = Math.sin(Math.PI * span(t, s.a, s.b)); // the pen dot shows while this stroke is drawing
      if (pen > 0.01) {
        ctx.fillStyle = `rgba(255, 200, 80, ${0.6 * pen})`;
        ctx.beginPath(); ctx.arc(tip[0], tip[1], s.w * 1.8, 0, TAU); ctx.fill();
      }
    }
  },
};
