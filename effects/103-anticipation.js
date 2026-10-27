// Anticipation: before each hop the blob slowly squashes down, leans and pulls back the other way, then
// releases into a stretched jump. Two hops (right, then left) make the loop; ghosts trace the flight.
import { TAU, lerp, span, ease, FONT } from '../lib/util.js';

const GROUND = 1360, D = 360, HOP = 2.5;

// pose during one hop: tau in seconds 0..2.5, starting at x0 and going in direction dir (+1 right, -1 left)
function hop(tau, x0, dir) {
  const crouch = ease.inOut(span(tau, 0.4, 1.15)), release = span(tau, 1.15, 1.25), k = span(tau, 1.25, 1.9);
  if (tau < 1.15) return { x: x0 - 45 * crouch * dir, h: 0, sy: 1 - 0.27 * crouch, rot: -0.2 * crouch * dir, squint: crouch };
  if (tau < 1.25) return { x: x0 - 45 * dir * (1 - release), h: 0, sy: lerp(0.73, 1.25, release), rot: lerp(-0.2, 0.2, release) * dir, squint: 1 - release };
  if (tau < 1.9) return { x: x0 + D * dir * k, h: 1680 * k * (1 - k), sy: 1 + 0.25 * (1 - 2 * k) ** 2, rot: 0.2 * dir * (1 - 2 * k), squint: 0 };
  const land = ease.out(span(tau, 1.9, 2.02)), settle = ease.outBack(span(tau, 2.02, 2.4));
  return { x: x0 + D * dir, h: 0, sy: tau < 2.02 ? lerp(1.25, 0.76, land) : lerp(0.76, 1, settle), rot: -0.2 * dir * (1 - ease.out(span(tau, 1.9, 2.3))), squint: 0 };
}
const pose = t => {
  const m = ((t % 5) + 5) % 5, first = m < HOP, tau = m % HOP, dir = first ? 1 : -1;
  return { ...hop(tau, first ? 540 - D / 2 : 540 + D / 2, dir), look: dir * (1 - 2 * ease.inOut(span(tau, 2.15, 2.45))) };
};

function body(ctx, p, ghost) {
  const sx = 1 / Math.sqrt(p.sy) ** 1.4, w = 270 * sx, h = 295 * p.sy;
  ctx.save();
  ctx.translate(p.x, GROUND - p.h); ctx.rotate(p.rot);
  ctx.beginPath(); ctx.ellipse(0, -h / 2, w / 2, h / 2, 0, 0, TAU);
  if (ghost) { ctx.fill(); ctx.restore(); return; }
  const g = ctx.createLinearGradient(0, -h, 0, 0);
  g.addColorStop(0, '#FFD45E'); g.addColorStop(1, '#FF9A3D');
  ctx.fillStyle = g; ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.beginPath(); ctx.ellipse(-w * 0.22, -h * 0.74, w * 0.13, h * 0.09, -0.5, 0, TAU); ctx.fill();
  for (const ex of [-0.18, 0.18]) { // eyes look where it is about to go and squint while it gathers itself
    const x = w * ex + 22 * p.look, y = -h * 0.6, eh = 38 * (1 - 0.55 * p.squint);
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.ellipse(x, y, 28, eh, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2A1D3A'; ctx.beginPath(); ctx.ellipse(x + 10 * p.look, y + 5, 14, Math.max(5, eh * 0.5), 0, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = '#E76A3A'; ctx.beginPath(); ctx.ellipse(22 * p.look, -h * 0.38, 20, 11 + 8 * (1 - p.squint), 0, 0, Math.PI); ctx.fill();
  ctx.restore();
}

export default {
  name: 'Anticipation',
  ko: '예비 동작',
  draw(ctx, t, W, H) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#CDEBFF'); bg.addColorStop(GROUND / H, '#EAF6FF'); bg.addColorStop(GROUND / H, '#9ED98A'); bg.addColorStop(1, '#7CC46E');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#8BCB79'; ctx.fillRect(0, GROUND - 4, W, 14);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'; // two still clouds
    for (const [x, y, r] of [[230, 520, 60], [820, 700, 48]]) {
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.moveTo(x + r * 2.1, y - r * 0.4); ctx.arc(x + r, y - r * 0.4, r * 1.1, 0, TAU);
      ctx.moveTo(x + r * 2.9, y); ctx.arc(x + r * 2, y, r * 0.9, 0, TAU); ctx.rect(x, y - 1, r * 2, r * 0.9); ctx.fill(); // one path: no overlaps
    }

    const p = pose(t), lift = Math.min(1, p.h / 300);
    ctx.fillStyle = `rgba(40, 90, 40, ${0.3 - 0.18 * lift})`;
    ctx.beginPath(); ctx.ellipse(p.x, GROUND + 4, 150 * (1 - 0.4 * lift) / Math.sqrt(p.sy), 20, 0, 0, TAU); ctx.fill();
    for (let g = 5; g >= 1; g--) { // ghosts of the last few frames
      const q = pose(t - g * 0.06);
      ctx.fillStyle = `rgba(255, 150, 60, ${0.05 * (6 - g) * Math.min(1, (q.h + Math.abs(q.x - p.x)) / 60)})`;
      body(ctx, q, true);
    }
    body(ctx, p, false);

    // which part of the move this is
    const tau = ((t % HOP) + HOP) % HOP;
    const steps = [['1  예비 동작', 'ANTICIPATION', span(tau, 0.3, 0.5) - span(tau, 1.15, 1.3)], ['2  동작', 'ACTION', span(tau, 1.15, 1.3) - span(tau, 2.1, 2.4)]];
    steps.forEach(([ko, en, on], i) => {
      const x = 300 + i * 480, y = 1610;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.35 + 0.6 * on})`;
      ctx.beginPath(); ctx.roundRect(x - 210, y - 70, 420, 150, 40); ctx.fill();
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(40, 60, 40, ${0.35 + 0.65 * on})`;
      ctx.font = `800 52px ${FONT.ko}`; ctx.fillText(ko, x, y);
      ctx.font = `700 30px ${FONT.sans}`; ctx.fillText(en, x, y + 48);
    });
  },
};
