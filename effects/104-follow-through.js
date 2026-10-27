// Follow through / overlapping action: the bunny's body slides and stops; its ears swing on a damped spring
// driven by the body's acceleration, and each ear segment runs a little behind the one below, so the tips lag most.
import { TAU, lerp, span, ease, FONT } from '../lib/util.js';

const GROUND = 1330, SEG = 4, LEN = 58, RATE = 240, LOOP = 5 * RATE;
const EARS = [{ side: -1, rest: -0.2 }, { side: 1, rest: 0.2 }];

// the body: slide right, hold, slide left, hold (x, and a lean into the move)
function body(t) {
  const m = ((t % 5) + 5) % 5, a = ease.inOut(span(m, 0.3, 0.85)), b = ease.inOut(span(m, 2.8, 3.35));
  const k = a - b, moving = Math.sin(Math.PI * span(m, 0.3, 0.85)) - Math.sin(Math.PI * span(m, 2.8, 3.35));
  return { x: lerp(330, 750, k), lean: 0.22 * moving };
}
// the root of each ear and the direction the ear grows from it
const anchor = (b, ear) => {
  const ax = b.x + ear.side * 52, ay = GROUND - 200;
  return { x: b.x + (ax - b.x) * Math.cos(b.lean) - (ay - GROUND) * Math.sin(b.lean), y: GROUND + (ax - b.x) * Math.sin(b.lean) + (ay - GROUND) * Math.cos(b.lean), a: ear.rest + b.lean };
};

// how far the ears swing: a damped spring pushed by the body's acceleration, simulated once at 240 Hz
// for three loops (the last one is kept, so the start and end match)
const SWING = (() => {
  const w = TAU * 1.8, zeta = 0.14, dt = 1 / RATE, out = [];
  let th = 0, v = 0;
  for (let s = 0; s < 3 * LOOP; s++) {
    const t = s * dt, acc = (body(t + dt).x - 2 * body(t).x + body(t - dt).x) / (dt * dt);
    v += (-w * w * th - 2 * zeta * w * v - 0.011 * acc) * dt;
    th += v * dt;
    if (s >= 2 * LOOP) out.push(th);
  }
  return out;
})();
const swing = t => SWING[((Math.round(t * RATE) % LOOP) + LOOP) % LOOP];

// the ear as a chain: each segment is a little later than the one below it, so the tip lags the base
function earsAt(t) {
  const b = body(t);
  return EARS.map(ear => {
    const a = anchor(b, ear), pts = [[a.x, a.y]];
    for (let i = 1; i <= SEG; i++) {
      const dir = a.a + swing(t - (i - 1) * 0.045) * (0.45 + 0.55 * (i / SEG));
      const [x, y] = pts[i - 1];
      pts.push([x + LEN * Math.sin(dir), y - LEN * Math.cos(dir)]);
    }
    return pts;
  });
}

function ear(ctx, pts, width, color) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
  ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
  ctx.stroke();
}

export default {
  name: 'Follow Through',
  ko: '팔로우 스루',
  draw(ctx, t, W, H) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#2B2D6E'); bg.addColorStop(GROUND / H, '#7A62C9'); bg.addColorStop(GROUND / H, '#4B3A8E'); bg.addColorStop(1, '#33276A');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    const b = body(t), ears = earsAt(t);
    ctx.save();
    ctx.translate(W / 2, GROUND); ctx.scale(1.2, 1.2); ctx.translate(-W / 2, -GROUND); // everything 20% bigger, standing on the ground
    for (let g = 40; g >= 1; g--) { // fading trail of the ear tips over the last third of a second
      const a = earsAt(t - g / 120), c = earsAt(t - (g - 1) / 120);
      ctx.strokeStyle = `rgba(255, 190, 230, ${0.5 * (1 - g / 41)})`; ctx.lineWidth = 8; ctx.lineCap = 'round';
      a.forEach((pts, n) => { ctx.beginPath(); ctx.moveTo(...pts[SEG]); ctx.lineTo(...c[n][SEG]); ctx.stroke(); });
    }
    ctx.fillStyle = 'rgba(20, 10, 50, 0.35)';
    ctx.beginPath(); ctx.ellipse(b.x, GROUND + 6, 150, 20, 0, 0, TAU); ctx.fill();
    ears.forEach(pts => { ear(ctx, pts, 54, '#F4F0FF'); ear(ctx, pts.slice(1), 22, '#FFB3D1'); });

    ctx.save();
    ctx.translate(b.x, GROUND); ctx.rotate(b.lean);
    const g = ctx.createRadialGradient(-50, -170, 20, 0, -120, 190);
    g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#D9D2F5');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, -125, 150, 128, 0, 0, TAU); ctx.fill();
    const look = Math.sign(Math.sin(b.lean)) * Math.min(1, Math.abs(b.lean) * 8) * 14;
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#2A1D3A'; ctx.beginPath(); ctx.ellipse(s * 52 + look, -140, 16, 22, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(s * 52 + look + 5, -148, 6, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255, 140, 170, 0.45)'; ctx.beginPath(); ctx.ellipse(s * 88 + look, -98, 24, 14, 0, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#FF7FA8'; ctx.beginPath(); ctx.ellipse(look, -108, 14, 10, 0, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.restore();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = `800 54px ${FONT.ko}`; ctx.textAlign = 'center';
    ctx.fillText('몸은 멈춰도 귀는 계속', W / 2, 1600);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.font = `700 32px ${FONT.sans}`;
    ctx.fillText('BODY STOPS · EARS FOLLOW THROUGH', W / 2, 1660);
  },
};
