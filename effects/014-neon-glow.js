// Neon sign: each tube is a polyline revealed along its length with a line dash, drawn three times with
// additive blending (wide haze, blurred glow, white-hot core). It lights up, glows, then fades off smoothly.
import { TAU, rng, canvas, ease, span } from '../lib/util.js';

const rrect = (x, y, w, h, r) => { // rounded rectangle as points
  const pts = [], c = [[x + w - r, y + r, -0.25], [x + w - r, y + h - r, 0], [x + r, y + h - r, 0.25], [x + r, y + r, 0.5]];
  for (const [cx, cy, a0] of c) for (let i = 0; i <= 10; i++) { const a = (a0 + i / 40) * TAU; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  pts.push(pts[0]);
  return pts;
};
const at = (pts, dx, dy, s = 1) => pts.map(([x, y]) => [dx + x * s, dy + y * s]);
const heart = [];
for (let i = 0; i <= 80; i++) {
  const a = i / 80 * TAU;
  heart.push([540 + 13 * 16 * Math.sin(a) ** 3, 1110 - 13 * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a))]);
}
const O = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * TAU; O.push([62 + 62 * Math.cos(a), 95 + 95 * Math.sin(a)]); }
const LX = 170, LY = 600, G = 205; // the word NEON, single-stroke letters 125 x 190
const TUBES = [ // points, colour, light-up window (s)
  [rrect(130, 460, 820, 1120, 90), '#FF3CAC', 0.0, 0.7],
  [at([[0, 190], [0, 0], [125, 190], [125, 0]], LX, LY), '#38F2FF', 0.5, 0.85],
  [at([[125, 0], [0, 0], [0, 190], [125, 190]], LX + G, LY), '#38F2FF', 0.7, 1.05],
  [at([[0, 95], [105, 95]], LX + G, LY), '#38F2FF', 0.95, 1.1],
  [at(O, LX + 2 * G, LY), '#38F2FF', 0.95, 1.35],
  [at([[0, 190], [0, 0], [125, 190], [125, 0]], LX + 3 * G, LY), '#38F2FF', 1.2, 1.55],
  [heart, '#FF4D6D', 1.4, 2.2],
  [Array.from({ length: 61 }, (_, i) => [290 + i * 500 / 60, 1420 + 34 * Math.sin(i / 60 * 3 * TAU)]), '#FFE45C', 2.0, 2.6],
].map(([pts, color, a, b]) => {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return { pts, color, a, b, len };
});

let wall = null;
const line = (ctx, pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); };

export default {
  name: 'Neon Glow',
  ko: '네온 글로우',
  setup(_, W, H) {
    wall = canvas(W, H); // dark brick wall, drawn once
    const g = wall.getContext('2d'), r = rng(3);
    g.fillStyle = '#0B0A10'; g.fillRect(0, 0, W, H);
    for (let row = 0; row * 64 < H; row++) {
      for (let x = -(row % 2) * 70; x < W; x += 140) {
        const v = 22 + r() * 12;
        g.fillStyle = `rgb(${v + 6}, ${v - 2}, ${v + 2})`;
        g.beginPath(); g.roundRect(x + 4, row * 64 + 4, 132, 56, 6); g.fill();
      }
    }
    const vig = g.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 1200);
    vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.75)');
    g.fillStyle = vig; g.fillRect(0, 0, W, H);
  },
  draw(ctx, t, W, H) {
    ctx.drawImage(wall, 0, 0);
    const power = 1 - ease.inOut(span(t, 4.2, 4.8)); // everything fades off together
    const lit = TUBES.reduce((s, tb) => s + span(t, tb.a, tb.b), 0) / TUBES.length * power;
    const room = ctx.createRadialGradient(540, 1000, 100, 540, 1000, 1000); // light spilling on the wall
    room.addColorStop(0, `rgba(255, 60, 172, ${0.22 * lit})`); room.addColorStop(1, 'rgba(255, 60, 172, 0)');
    ctx.fillStyle = room; ctx.fillRect(0, 0, W, H);

    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const tb of TUBES) { // unlit glass tubes are always there
      ctx.strokeStyle = 'rgba(210, 200, 230, 0.16)'; ctx.lineWidth = 12;
      line(ctx, tb.pts); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const tb of TUBES) {
      const k = ease.inOut(span(t, tb.a, tb.b));
      if (k <= 0 || power <= 0) continue;
      ctx.setLineDash([tb.len * k, tb.len + 20]);
      for (const [w, alpha, blur, col] of [[44, 0.22, 0, tb.color], [18, 0.6, 46, tb.color], [6, 0.95, 0, '#FFFFFF']]) {
        ctx.globalAlpha = alpha * power;
        ctx.strokeStyle = col; ctx.lineWidth = w;
        ctx.shadowColor = tb.color; ctx.shadowBlur = blur;
        line(ctx, tb.pts); ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }
    ctx.setLineDash([]); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  },
};
