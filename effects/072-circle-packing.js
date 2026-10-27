// Circle packing by growth: seeds drop at random free spots (fixed seed) and every circle grows at the same speed
// until it touches another circle or the frame. The run is simulated once; frame t just reads each circle's radius
// from its start time. When the frame is full the circles shrink away from the middle out while the next round
// already starts growing (each circle shows the larger of this loop's and the last loop's radius).
import { TAU, rng, ease, clamp } from '../lib/util.js';

const X0 = 46, X1 = 1034, Y0 = 296, Y1 = 1874, SPEED = 240, GAP = 4, DT = 1 / 60, SPAWN_END = 3.2;
const COLORS = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#C77DFF', '#FF9F6B'];

const circles = (() => {
  const r = rng(72), all = [];
  for (let step = 0; step * DT < SPAWN_END + 1.5; step++) {
    const time = step * DT;
    if (time < SPAWN_END) {
      for (let k = 0; k < 14; k++) {   // a few tries per step: keep the ones that land on free space
        const x = X0 + 6 + r() * (X1 - X0 - 12), y = Y0 + 6 + r() * (Y1 - Y0 - 12), color = COLORS[Math.floor(r() * COLORS.length)];
        if (all.every(c => Math.hypot(c.x - x, c.y - y) > c.r + GAP + 2)) all.push({ x, y, r: 0, born: time, grow: true, color });
      }
    }
    for (const c of all) {
      if (!c.grow) continue;
      let lim = Math.min(c.r + SPEED * DT, c.x - X0, X1 - c.x, c.y - Y0, Y1 - c.y);
      for (const o of all) {
        if (o === c) continue;
        lim = Math.min(lim, Math.hypot(o.x - c.x, o.y - c.y) - o.r - (o.grow ? SPEED * DT : 0) - GAP);
      }
      if (lim < c.r + SPEED * DT) c.grow = false;
      c.r = Math.max(c.r, lim);
    }
  }
  return all.filter(c => c.r >= 4).map(c => ({ ...c, out: Math.hypot(c.x - 540, c.y - 1085) / 1000 }));
})();

export default {
  name: 'Circle Packing',
  ko: '원 패킹',
  draw(ctx, t, W, H) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1A1433'); bg.addColorStop(1, '#0E0B1F');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const radius = (c, time) => {
      const grown = Math.min(c.r, Math.max(0, (time - c.born) * SPEED));
      return grown * (1 - ease.inOut(clamp((time - 4.0 - 0.7 * c.out) / 0.6)));
    };
    const time = (t + 1) % 5;   // the video starts a second into the growth, so frame 0 is not empty
    for (const c of circles) {
      const rad = Math.max(radius(c, time), radius(c, time + 5));   // the last round finishes shrinking after 0
      if (rad < 0.5) continue;
      ctx.fillStyle = c.color;
      ctx.beginPath(); ctx.arc(c.x, c.y, rad, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.beginPath(); ctx.arc(c.x - rad * 0.28, c.y - rad * 0.3, rad * 0.42, 0, TAU); ctx.fill();
    }
  },
};
