// Murmuration without a simulation: a leader flies a looping figure-eight and every bird follows the same path a
// little later, offset sideways in the path's own frame, so the flock stretches, bunches and banks together.
import { TAU, rng, phase } from '../lib/util.js';

const N = 650;
const r = rng(82);
const birds = Array.from({ length: N }, () => {
  const g = () => (r() + r() + r() - 1.5) / 1.5; // roughly gaussian -1..1
  return { lag: 0.28 * r() ** 1.3, side: 190 * g(), along: 60 * g(), ph: r() * TAU, size: 0.7 + 0.6 * r(), flap: 12 + Math.floor(r() * 5) };
});
// the leader: a vertical figure-eight, once round per 5 s
const lead = s => [540 + 300 * Math.sin(2 * TAU * s), 1040 + 470 * Math.sin(TAU * s)];

function bird(b, t) {
  const s = phase(t) - b.lag, [x, y] = lead(s), [x2, y2] = lead(s + 0.002);
  const len = Math.hypot(x2 - x, y2 - y), tx = (x2 - x) / len, ty = (y2 - y) / len;
  const breathe = 1 + 0.35 * Math.sin(2 * TAU * s + b.side * 0.02); // the flock swells and thins
  const sx = b.side * breathe + 10 * Math.sin(3 * TAU * phase(t) + b.ph), al = b.along + 10 * Math.cos(2 * TAU * phase(t) + b.ph);
  return [x + tx * al - ty * sx, y + ty * al + tx * sx];
}

let sky = null;
export default {
  name: 'Boids Swarm',
  ko: '군집 비행',
  setup(ctx, W, H) {
    sky = document.createElement('canvas'); sky.width = W; sky.height = H;
    const c = sky.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#3B3F7A'); g.addColorStop(0.45, '#C9708A'); g.addColorStop(0.75, '#F6A86B'); g.addColorStop(1, '#FBD38D');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    const sun = c.createRadialGradient(540, 1560, 0, 540, 1560, 520);
    sun.addColorStop(0, 'rgba(255, 244, 210, 1)'); sun.addColorStop(0.25, 'rgba(255, 220, 150, 0.8)'); sun.addColorStop(1, 'rgba(255, 200, 120, 0)');
    c.fillStyle = sun; c.fillRect(0, 0, W, H);
    for (const [col, base, amp, f] of [['#9A5A78', 1690, 70, 2.1], ['#5E3B5E', 1770, 60, 3.3], ['#2E2140', 1840, 40, 5.2]]) {
      c.fillStyle = col; c.beginPath(); c.moveTo(0, H);
      for (let x = 0; x <= W; x += 10) c.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin(x / W * f * TAU * 0.5 + f)));
      c.lineTo(W, H); c.fill();
    }
  },
  draw(ctx, t, W, H) {
    ctx.drawImage(sky, 0, 0);
    ctx.fillStyle = 'rgba(30, 20, 40, 0.88)';
    for (const b of birds) {
      const [x, y] = bird(b, t), [px, py] = bird(b, t - 1 / 30);
      const len = Math.hypot(x - px, y - py) || 1, dx = (x - px) / len, dy = (y - py) / len;
      const s = 9 * b.size, wing = Math.sin(b.flap * TAU * phase(t) + b.ph); // smooth flapping
      const span = s * (0.75 + 0.35 * wing), sweep = s * (0.2 - 0.5 * wing);
      ctx.beginPath(); // a little chevron pointing along the flight direction
      ctx.moveTo(x + dx * s * 0.7, y + dy * s * 0.7);
      ctx.lineTo(x - dy * span - dx * sweep, y + dx * span - dy * sweep);
      ctx.lineTo(x - dx * s * 0.25, y - dy * s * 0.25);
      ctx.lineTo(x + dy * span - dx * sweep, y - dx * span - dy * sweep);
      ctx.closePath(); ctx.fill();
    }
  },
};
