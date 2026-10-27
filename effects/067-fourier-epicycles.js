// Fourier epicycles: the discrete Fourier transform of a heart curve gives circles (radius = |coefficient|,
// speed = frequency); chained tip to tail and turning, the last tip redraws the heart once per 5-second loop.
import { TAU, phase } from '../lib/util.js';

const CX = 540, CY = 1080, SAMPLES = 256, KMAX = 12;

// the classic heart curve, sampled at even parameter steps, as points [x, y] around the centre (y down)
function heart() {
  const pts = [];
  for (let s = 0; s < SAMPLES; s++) {
    const a = (s / SAMPLES) * TAU;
    pts.push([24 * 16 * Math.sin(a) ** 3, -24 * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) - 60]);
  }
  return pts;
}

// c_k = 1/N sum z_n e^{-i k 2pi n / N}, for -KMAX..KMAX, biggest first
const terms = (() => {
  const z = heart(), out = [];
  for (let k = -KMAX; k <= KMAX; k++) {
    let re = 0, im = 0;
    z.forEach(([x, y], n) => {
      const a = -TAU * k * n / SAMPLES;
      re += x * Math.cos(a) - y * Math.sin(a); im += x * Math.sin(a) + y * Math.cos(a);
    });
    re /= SAMPLES; im /= SAMPLES;
    if (Math.hypot(re, im) > 0.8) out.push({ k, amp: Math.hypot(re, im), ph: Math.atan2(im, re) });
  }
  return out.sort((a, b) => b.amp - a.amp);
})();

const tip = u => {   // the end of the chain at loop position u (0..1)
  let x = CX, y = CY;
  for (const c of terms) { const a = c.ph + TAU * c.k * u; x += c.amp * Math.cos(a); y += c.amp * Math.sin(a); }
  return [x, y];
};

export default {
  name: 'Fourier Epicycles',
  ko: '푸리에 원',
  draw(ctx, t, W, H) {
    const bg = ctx.createRadialGradient(CX, CY, 100, CX, CY, 1200);
    bg.addColorStop(0, '#1C2147'); bg.addColorStop(1, '#090B1E');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const u = phase(t);

    // the trail: the last 80% of the loop, fading toward its tail. Pieces are opaque, mixed toward the backdrop colour
    // instead of transparent, so their round ends overlap without bright beads.
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 7;
    const STEPS = 240, LEN = 0.8, HEAD = [255, 105, 145];
    const backdrop = (x, y) => {   // the radial gradient above, evaluated at a point
      const k = Math.min(1, Math.max(0, (Math.hypot(x - CX, y - CY) - 100) / 1100));
      return [0x1C + (0x09 - 0x1C) * k, 0x21 + (0x0B - 0x21) * k, 0x47 + (0x1E - 0x47) * k];
    };
    let prev = tip(u - LEN);
    for (let s = 1; s <= STEPS; s++) {
      const p = tip(u - LEN + (LEN * s) / STEPS), f = (s / STEPS) ** 1.3, b = backdrop(p[0], p[1]);
      ctx.strokeStyle = `rgb(${b.map((v, i) => Math.round(v + (HEAD[i] - v) * f)).join(',')})`;
      ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
      prev = p;
    }

    // the circles and arms
    let x = CX, y = CY;
    ctx.lineWidth = 3;
    for (const c of terms) {
      const a = c.ph + TAU * c.k * u, nx = x + c.amp * Math.cos(a), ny = y + c.amp * Math.sin(a);
      if (c.amp > 4) {
        ctx.strokeStyle = 'rgba(160, 190, 255, 0.45)';
        ctx.beginPath(); ctx.arc(x, y, c.amp, 0, TAU); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(220, 230, 255, 0.85)';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(nx, ny); ctx.stroke();
      x = nx; y = ny;
    }
    ctx.fillStyle = '#FFF3C4';
    ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(220, 230, 255, 0.9)';
    ctx.beginPath(); ctx.arc(CX, CY, 6, 0, TAU); ctx.fill();
  },
};
