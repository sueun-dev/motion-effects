// L-system growth: Lindenmayer's fractal plant (X -> F+[[X]-X]-F[-FX]+X, F -> FF, 5 rounds) drawn by a turtle.
// Each F segment is born when the path distance from the root reaches it, so the plant grows tip-first; it sways in
// the wind, blossoms at the branch ends, then fades out and grows again.
import { TAU, phase, rng, ease, clamp, smoothstep } from '../lib/util.js';

const ANGLE = 25 * Math.PI / 180, ROOT_X = 320, ROOT_Y = 1730;
let str = 'X';
for (let i = 0; i < 5; i++) str = str.replace(/[XF]/g, c => (c === 'X' ? 'F+[[X]-X]-F[-FX]+X' : 'FF'));
const jitter = (() => { const r = rng(71); return Array.from(str, () => (r() - 0.5) * 0.25); })();
let total = 0;
for (const c of str) if (c === 'F') total++;

// walk the string; returns segments [x0, y0, x1, y1, depth, born] and branch tips [x, y, born]
function grow(t, len) {
  const segs = [], tips = [], stack = [];
  let x = ROOT_X, y = ROOT_Y, a = -Math.PI / 2 + 0.38, d = 0, depth = 0, last = -1;
  const wind = 0.012 * Math.sin(phase(t) * TAU * 2);
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === 'F') {
      const nx = x + Math.cos(a) * len, ny = y + Math.sin(a) * len;
      segs.push([x, y, nx, ny, depth, d]);
      x = nx; y = ny; d++; last = d;
    } else if (c === '+') a += ANGLE + jitter[i] + wind * (1 + depth);
    else if (c === '-') a -= ANGLE + jitter[i] - wind * (1 + depth);
    else if (c === '[') { stack.push([x, y, a, d, depth]); depth++; last = -1; }
    else if (c === ']') { if (last >= 0 && depth >= 3) tips.push([x, y, last]); [x, y, a, d, depth] = stack.pop(); last = -1; }
  }
  return { segs, tips };
}
const maxDist = Math.max(...grow(0, 1).segs.map(s => s[5])) + 1;

export default {
  name: 'L-System Growth',
  ko: 'L-시스템 성장',
  draw(ctx, t, W, H) {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#FBE7D3'); sky.addColorStop(0.7, '#F6C9B8'); sky.addColorStop(1, '#EBB3A6');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255, 248, 230, 0.8)';
    ctx.beginPath(); ctx.arc(760, 640, 150, 0, TAU); ctx.fill();
    ctx.fillStyle = '#9DB58C';
    ctx.beginPath(); ctx.ellipse(W / 2, ROOT_Y + 230, 900, 260, 0, 0, TAU); ctx.fill();

    const T = ease.out(clamp(t / 3.4)) * maxDist;   // how far along the paths the growth has reached
    const alpha = 1 - smoothstep(4.15, 4.95, t);
    const { segs, tips } = grow(t, 14);
    ctx.lineCap = 'round';
    for (let depth = 0; depth <= 6; depth++) {        // one path per branch order: thick brown trunk to thin green twigs
      ctx.beginPath();
      for (const [x0, y0, x1, y1, dep, born] of segs) {
        if (dep !== depth || born >= T) continue;
        const k = Math.min(1, T - born);
        ctx.moveTo(x0, y0); ctx.lineTo(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k);
      }
      ctx.lineWidth = Math.max(2.5, 22 * 0.6 ** depth);
      const g = depth / 6;
      ctx.strokeStyle = `rgba(${95 - 20 * g}, ${60 + 90 * g}, ${40 + 30 * g}, ${alpha})`;
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(240, 110, 150, ${0.85 * alpha})`;
    ctx.beginPath();
    for (const [x, y, born] of tips) {
      const s = smoothstep(born, born + 6, T);       // blossoms pop open once their twig is grown
      if (s <= 0) continue;
      ctx.moveTo(x + 9 * s, y); ctx.arc(x, y, 9 * s, 0, TAU);
    }
    ctx.fill();
  },
};
