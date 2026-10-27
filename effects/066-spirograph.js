// Spirograph (hypotrochoid): a toothed wheel of radius r rolls inside a ring of radius R = 8/3 r; three pens at
// different distances d from its centre trace nested curves that close after 3 laps. Draw 4 s, hold, fade, repeat.
import { TAU, ease, clamp, smoothstep } from '../lib/util.js';

const R = 420, r = R * 3 / 8, LAPS = 3, CX = 540, CY = 1080, N = 1500;
const PENS = [[0.84, 340], [0.58, 190], [0.32, 40]]; // [distance from the wheel centre / r, hue]

const pen = (th, d) => {
  const c = R - r, phi = -th * c / r;
  return [CX + c * Math.cos(th) + d * Math.cos(phi), CY + c * Math.sin(th) + d * Math.sin(phi)];
};

function gear(ctx, x, y, rad, teeth, rot, inside) {
  ctx.beginPath();
  for (let i = 0; i <= teeth * 4; i++) {        // square-ish teeth: out, out, in, in
    const a = rot + (i / (teeth * 4)) * TAU, up = (i % 4 < 2) !== inside;
    const rr = rad + (up ? 7 : -7);
    i === 0 ? ctx.moveTo(x + rr * Math.cos(a), y + rr * Math.sin(a)) : ctx.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a));
  }
  ctx.closePath();
}

export default {
  name: 'Spirograph',
  ko: '스피로그래프',
  draw(ctx, t, W, H) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#FBF4EA'); bg.addColorStop(1, '#F1E4D4');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    const prog = ease.inOut(clamp(t / 4));
    const alpha = 1 - smoothstep(4.35, 4.95, t);
    const th = prog * LAPS * TAU;

    // the fixed ring
    ctx.fillStyle = 'rgba(120, 100, 160, 0.10)';
    ctx.beginPath(); ctx.arc(CX, CY, R + 46, 0, TAU); gear(ctx, CX, CY, R + 7, 96, 0, true); ctx.fill('evenodd');
    ctx.strokeStyle = 'rgba(120, 100, 160, 0.35)'; ctx.lineWidth = 2;
    gear(ctx, CX, CY, R + 7, 96, 0, true); ctx.stroke();

    // the curves so far: one unbroken path per pen
    ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const end = Math.floor(prog * N);
    for (const [k, hue] of PENS) {
      ctx.strokeStyle = `hsla(${hue}, 75%, 52%, ${alpha})`;
      ctx.beginPath();
      for (let i = 0; i <= end; i++) { const [x, y] = pen((i / N) * LAPS * TAU, k * r); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      const [x, y] = pen(th, k * r);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    // the rolling wheel and the pen
    const gx = CX + (R - r) * Math.cos(th), gy = CY + (R - r) * Math.sin(th), phi = -th * (R - r) / r;
    ctx.fillStyle = 'rgba(90, 170, 200, 0.22)';
    gear(ctx, gx, gy, r - 7, 36, phi, false); ctx.fill();
    ctx.strokeStyle = 'rgba(40, 110, 150, 0.55)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(40, 110, 150, 0.6)';
    ctx.beginPath(); ctx.arc(gx, gy, 8, 0, TAU); ctx.fill();
    for (const [k, hue] of PENS) {   // the pen holes
      const [px, py] = pen(th, k * r);
      ctx.fillStyle = `hsl(${hue}, 75%, 50%)`;
      ctx.beginPath(); ctx.arc(px, py, 10, 0, TAU); ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(px, py, 3.5, 0, TAU); ctx.fill();
    }
  },
};
