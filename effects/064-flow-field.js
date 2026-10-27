// Flow field: a still noise field sets a direction at every point; each of 2400 particles has its streamline traced
// once in setup, and every frame shows a stretch of it (the trail) that slides along with time, fading in and out.
// Nothing accumulates between frames, so the lines never shimmer.
import { TAU, rng, noise3 } from '../lib/util.js';

const COUNT = 2400, LIFE = 2.5, STEP = 6, TRAVEL = 300, TRAIL = 150;
const paths = [];

const angle = (x, y) => noise3(x * 0.0017, y * 0.0017, 0.4) * TAU * 1.1 + 0.6 * Math.sin(y * 0.002);

export default {
  name: 'Flow Field',
  ko: '플로우 필드',
  setup() {
    const r = rng(64);
    const n = Math.ceil(TRAVEL / STEP) + 1;
    for (let i = 0; i < COUNT; i++) {
      const lives = [0, 1].map(() => {          // alternate lives start from different spots
        let x = -60 + r() * 1200, y = 240 + r() * 1760;
        const pts = [[x, y]];
        for (let s = 1; s < n; s++) {
          const a = angle(x, y);
          x += Math.cos(a) * STEP; y += Math.sin(a) * STEP;
          pts.push([x, y]);
        }
        return pts;
      });
      paths.push({ lives, offset: r(), hue: r() });
    }
  },
  draw(ctx, t, W, H) {
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#071A24'); bg.addColorStop(1, '#140C2A');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // a point a given distance along a path, between its samples
    const at = (pts, d) => {
      const k = Math.min(pts.length - 1.001, Math.max(0, d / STEP)), i = Math.floor(k), f = k - i;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f];
    };
    for (const p of paths) {
      const life = t / LIFE + p.offset, u = life - Math.floor(life);
      const pts = p.lives[Math.floor(life) % 2];
      const head = u * TRAVEL, tail = Math.max(0, head - TRAIL);
      const fade = Math.sin(Math.PI * u) ** 1.5;
      const color = p.hue < 0.5 ? `hsla(${175 + 40 * p.hue}, 85%, 62%,` : `hsla(${p.hue < 0.8 ? 35 : 320}, 90%, 66%,`;
      const s0 = at(pts, tail), s1 = at(pts, head);
      const g = ctx.createLinearGradient(s0[0], s0[1], s1[0], s1[1]);   // tail transparent -> head bright
      g.addColorStop(0, `${color} 0)`); g.addColorStop(1, `${color} ${0.95 * fade})`);
      ctx.strokeStyle = g;
      ctx.beginPath();
      ctx.moveTo(s0[0], s0[1]);
      for (let i = Math.ceil(tail / STEP); i < head / STEP; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.lineTo(s1[0], s1[1]);
      ctx.stroke();
    }
  },
};
