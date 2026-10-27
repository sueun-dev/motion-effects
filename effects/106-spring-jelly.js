// Spring jelly: a spoon presses the jelly down and lets go; its height then follows a damped spring
// (overshoot, undershoot, settle), the top sways on a second, slower spring, and the graph below plots it.
import { TAU, lerp, span, ease, FONT } from '../lib/util.js';

const PLATE = 1270, CYCLE = 2.5, RELEASE = 0.45, W0 = TAU * 2.3, ZETA = 0.11;

// squash (negative) / stretch (positive) of the jelly at time tau within a cycle
function spring(tau) {
  if (tau < RELEASE) return -0.3 * ease.inOut(tau / RELEASE);
  const u = tau - RELEASE;
  return -0.3 * Math.exp(-ZETA * W0 * u) * Math.cos(W0 * Math.sqrt(1 - ZETA * ZETA) * u);
}
const sway = tau => (tau < RELEASE ? 0 : 0.16 * Math.exp(-1.6 * (tau - RELEASE)) * Math.sin(TAU * 1.4 * (tau - RELEASE)));

export default {
  name: 'Spring Jelly',
  ko: '스프링 젤리',
  draw(ctx, t, W, H) {
    const tau = ((t % CYCLE) + CYCLE) % CYCLE, s = spring(tau), sh = sway(tau);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#FFF0F4'); bg.addColorStop(0.62, '#FFE0EA'); bg.addColorStop(0.62, '#F7C9D8'); bg.addColorStop(1, '#F2B6C9');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // the rest shape is deformed point by point: squash/stretch keeps the volume, the top sways most
    const P = (x, y) => { const h = -y / 310; return [540 + x * (1 - 0.65 * s * (0.3 + 0.7 * h)) + sh * h * h * 310, PLATE + y * (1 + s)]; };
    const shape = () => {
      ctx.beginPath(); ctx.moveTo(...P(-200, 0));
      ctx.bezierCurveTo(...P(-190, -150), ...P(-178, -275), ...P(-112, -300));
      ctx.bezierCurveTo(...P(-40, -318), ...P(40, -318), ...P(112, -300));
      ctx.bezierCurveTo(...P(178, -275), ...P(190, -150), ...P(200, 0));
      ctx.closePath();
    };
    ctx.save();
    ctx.translate(540, PLATE); ctx.scale(1.3, 1.3); ctx.translate(-540, -PLATE); // jelly, plate and spoon 30% bigger
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.ellipse(540, PLATE + 8, 330 * (1 - 0.3 * s), 62, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(180, 80, 120, 0.25)'; ctx.beginPath(); ctx.ellipse(540, PLATE + 6, 230 * (1 - 0.5 * s), 30, 0, 0, TAU); ctx.fill();

    ctx.save();
    shape(); ctx.clip();
    const g = ctx.createLinearGradient(0, PLATE - 320, 0, PLATE);
    g.addColorStop(0, '#FF6F9C'); g.addColorStop(1, '#E8407A');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#FFE7C2'; ctx.fillRect(0, P(0, -80)[1], W, 400);   // creamy bottom layer
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    const [hx, hy] = P(-110, -230);
    ctx.beginPath(); ctx.ellipse(hx, hy, 26, 60 * (1 + s), 0.35 + sh, 0, TAU); ctx.fill();
    ctx.restore();
    for (const ex of [-60, 60]) { const [x, y] = P(ex, -170); ctx.fillStyle = '#5A1630'; ctx.beginPath(); ctx.ellipse(x, y, 14, 18 * (1 + s), 0, 0, TAU); ctx.fill(); }
    const [mx, my] = P(0, -135);
    ctx.strokeStyle = '#5A1630'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(mx, my, 22, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();

    // the spoon: presses with the top, lifts away after the release, comes back down for the next press
    const hover = PLATE - 560, up = ease.out(span(tau, RELEASE, RELEASE + 0.3)), down = ease.inOut(span(tau, 2.05, 2.5));
    const sy = tau < RELEASE ? P(0, -315)[1] : down > 0 ? lerp(hover, PLATE - 315, down) : lerp(PLATE - 315 * 0.7, hover, up);
    ctx.fillStyle = '#C9CFDD';
    ctx.beginPath(); ctx.moveTo(560, sy - 40); ctx.lineTo(820, sy - 300); ctx.lineTo(850, sy - 280); ctx.lineTo(600, sy - 25); ctx.fill();
    const sp = ctx.createLinearGradient(470, sy - 60, 610, sy);
    sp.addColorStop(0, '#F4F6FB'); sp.addColorStop(1, '#AAB2C5');
    ctx.fillStyle = sp; ctx.beginPath(); ctx.ellipse(540, sy - 32, 92, 34, 0, 0, TAU); ctx.fill();
    ctx.restore();

    // the spring curve: one cycle of the jelly's height, with a dot at now
    const gx = 120, gw = 840, gy = 1640, ga = 230;
    ctx.strokeStyle = 'rgba(120, 40, 70, 0.25)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + gw, gy); ctx.stroke();
    ctx.strokeStyle = '#E8407A'; ctx.lineWidth = 5; ctx.lineJoin = 'round';
    ctx.beginPath(); for (let k = 0; k <= 200; k++) ctx.lineTo(gx + (k / 200) * gw, gy - ga * spring((k / 200) * CYCLE)); ctx.stroke();
    ctx.fillStyle = '#5A1630'; ctx.beginPath(); ctx.arc(gx + (tau / CYCLE) * gw, gy - ga * s, 14, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(90, 22, 48, 0.6)'; ctx.font = `700 34px ${FONT.sans}`; ctx.textAlign = 'left';
    ctx.fillText('overshoot → settle', gx, gy + 120);
  },
};
