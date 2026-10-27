// Walk cycle: each foot follows a loop (flat on the ground pushing back, then lifted forward), two-bone IK
// finds the knees, arms swing against the legs and the body dips at each contact. The ground slides at foot speed.
import { TAU, ease } from '../lib/util.js';

const T = 1.25, STRIDE = 220, GROUND = 1460, CX = 540, THIGH = 150, SHIN = 150;
const SPEED = STRIDE / (T / 2); // a planted foot moves back at exactly the ground's speed

// foot position relative to the hip for a leg at cycle position u (0..1): stance first, then swing
function foot(u) {
  u = ((u % 1) + 1) % 1;
  if (u < 0.5) return [STRIDE / 2 - STRIDE * (u / 0.5), 0];
  const k = (u - 0.5) / 0.5;
  return [-STRIDE / 2 + STRIDE * ease.inOut(k), -70 * Math.sin(Math.PI * k)];
}
// knee from hip and foot (law of cosines), bending forward
function knee(hx, hy, fx, fy) {
  const d = Math.min(Math.hypot(fx - hx, fy - hy), THIGH + SHIN - 1), a = Math.atan2(fy - hy, fx - hx);
  const b = Math.acos((THIGH * THIGH + d * d - SHIN * SHIN) / (2 * THIGH * d));
  return [hx + THIGH * Math.cos(a - b), hy + THIGH * Math.sin(a - b)];
}
function limb(ctx, pts, w, color) {
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = ctx.lineJoin = 'round';
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
}

export default {
  name: 'Walk Cycle',
  ko: '걷기 사이클',
  draw(ctx, t, W, H) {
    const p = t / T, bob = 12 * Math.cos(2 * TAU * p);
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, '#9FD8F5'); sky.addColorStop(1, '#E6F6FF');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, GROUND);
    ctx.fillStyle = '#BFE3B4'; // far hills slide slower (1080 px per loop)
    ctx.beginPath(); ctx.moveTo(0, GROUND);
    for (let x = 0; x <= W; x += 10) { const u = ((x + 1080 * (t / 5)) / 1080) * TAU; ctx.lineTo(x, GROUND - 160 - 70 * Math.sin(u) - 40 * Math.sin(2 * u + 1)); }
    ctx.lineTo(W, GROUND); ctx.fill();
    ctx.fillStyle = '#8CCB7E'; ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = '#76B86A'; // ground markers move exactly as fast as a planted foot
    const off = (SPEED * t) % STRIDE;
    for (let x = -off; x < W + STRIDE; x += STRIDE) { ctx.beginPath(); ctx.roundRect(x, GROUND + 40, 120, 18, 9); ctx.fill(); ctx.beginPath(); ctx.roundRect(x + 110, GROUND + 130, 90, 14, 7); ctx.fill(); }

    ctx.save();
    ctx.translate(CX, GROUND); ctx.scale(1.25, 1.25); ctx.translate(-CX, -GROUND); // the walker 25% bigger, feet on the ground
    const hip = [CX, GROUND - 296 + bob];
    // the path the foot traces, relative to the hip
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    for (let k = 0; k < 40; k++) { const [fx, fy] = foot(k / 40); ctx.beginPath(); ctx.arc(hip[0] + fx + 30, GROUND - 14 + fy, 5, 0, TAU); ctx.fill(); }

    const leg = (u, dark) => {
      const [fx, fy] = foot(u), F = [hip[0] + fx, GROUND - 22 + fy], K = knee(hip[0], hip[1], F[0], F[1]);
      limb(ctx, [hip, K, F], 50, dark ? '#2E4C8C' : '#3E66B8');
      ctx.fillStyle = dark ? '#C9CED8' : '#FFFFFF';
      ctx.beginPath(); ctx.ellipse(F[0] + 22, F[1] + 4, 44, 22, 0, 0, TAU); ctx.fill();
    };
    const sh = [CX + 12, hip[1] - 210];
    const arm = (swing, dark) => {
      const e = [sh[0] + 105 * Math.sin(swing), sh[1] + 105 * Math.cos(swing)], f = swing + 0.35 + 0.35 * Math.max(0, swing);
      const h = [e[0] + 95 * Math.sin(f), e[1] + 95 * Math.cos(f)];
      limb(ctx, [sh, e, h], 36, dark ? '#D9772E' : '#FF9A45');
      ctx.fillStyle = dark ? '#E0A880' : '#FFCFA6'; ctx.beginPath(); ctx.arc(h[0], h[1], 22, 0, TAU); ctx.fill();
    };

    const ph = p * TAU;
    arm(0.6 * Math.cos(ph), true); leg(p + 0.5, true);      // far side first
    ctx.fillStyle = '#FF9A45';
    ctx.beginPath(); ctx.roundRect(CX - 62, hip[1] - 250, 136, 270, 60); ctx.fill();
    ctx.fillStyle = '#FFCFA6'; ctx.beginPath(); ctx.arc(CX + 22, hip[1] - 330, 88, 0, TAU); ctx.fill();
    ctx.fillStyle = '#5B3A29'; ctx.beginPath(); ctx.arc(CX + 10, hip[1] - 350, 90, Math.PI * 0.95, Math.PI * 1.95); ctx.fill();
    ctx.fillStyle = '#2A1D3A'; ctx.beginPath(); ctx.ellipse(CX + 72, hip[1] - 330, 9, 14, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255, 120, 120, 0.4)'; ctx.beginPath(); ctx.ellipse(CX + 66, hip[1] - 292, 18, 11, 0, 0, TAU); ctx.fill();
    leg(p, false); arm(-0.6 * Math.cos(ph), false);           // near side on top
    ctx.restore();
  },
};
