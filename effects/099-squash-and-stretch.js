// A ball bounces four times in the loop: it stretches along its speed in the air and squashes flat on contact
// (volume kept: scaleX = 1 / scaleY). Faint ghosts show the arc.
import { TAU } from '../lib/util.js';

const PERIOD = 1.25, CONTACT = 0.12, R = 150, GROUND = 1520, TOP = 560;

function ball(t) {
  const u = ((t / PERIOD) % 1 + 1) % 1;
  if (u < CONTACT) { // on the floor: squash in and out
    const s = Math.sin(Math.PI * u / CONTACT);
    const sy = 1 - 0.48 * s;
    return { y: GROUND - R * sy, sx: 1 / sy, sy };
  }
  const k = (u - CONTACT) / (1 - CONTACT);
  const y = GROUND - R - 4 * k * (1 - k) * (GROUND - R - TOP);
  const sy = 1 + 0.45 * Math.abs(1 - 2 * k) ** 2; // fastest near the floor
  return { y, sx: 1 / sy, sy };
}

export default {
  name: 'Squash and Stretch',
  ko: '스쿼시 앤 스트레치',
  draw(ctx, t, W, H) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#FFE8C7'); bg.addColorStop(1, '#FFC9A3');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#F2A27C'; ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = '#E4895F'; ctx.fillRect(0, GROUND, W, 10);

    const x = W / 2;
    for (let g = 4; g >= 1; g--) { // ghosts a few frames behind
      const b = ball(t - g * 0.05);
      ctx.fillStyle = `rgba(255, 90, 95, ${0.08 * (5 - g)})`;
      ctx.beginPath(); ctx.ellipse(x, b.y, R * b.sx, R * b.sy, 0, 0, TAU); ctx.fill();
    }
    const b = ball(t);
    const lift = (GROUND - R - b.y) / (GROUND - R - TOP);
    ctx.fillStyle = `rgba(120, 50, 30, ${0.28 - 0.18 * Math.max(0, lift)})`;
    ctx.beginPath(); ctx.ellipse(x, GROUND + 6, R * (1.2 - 0.5 * Math.max(0, lift)) * b.sx, 22, 0, 0, TAU); ctx.fill();

    const grd = ctx.createRadialGradient(x - R * 0.35, b.y - R * 0.4, R * 0.1, x, b.y, R * 1.2);
    grd.addColorStop(0, '#FF9A8B'); grd.addColorStop(0.55, '#FF4D5E'); grd.addColorStop(1, '#C81E45');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.ellipse(x, b.y, R * b.sx, R * b.sy, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath(); ctx.ellipse(x - R * 0.35 * b.sx, b.y - R * 0.45 * b.sy, R * 0.22 * b.sx, R * 0.14 * b.sy, -0.5, 0, TAU); ctx.fill();
  },
};
