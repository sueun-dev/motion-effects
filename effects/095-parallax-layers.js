// Parallax scrolling: six periodic layers slide by different whole numbers of their own period every 5 s,
// far ones slowly and near ones fast, while the car (the camera) stays put. Paler colours sit further away.
import { TAU, phase, rng } from '../lib/util.js';

const mod = (a, n) => ((a % n) + n) % n;

// a skyline y(x) that repeats every `period` pixels (whole harmonics of the period only)
function ridge(ctx, W, H, shift, period, base, amp, seed, color) {
  const r = rng(seed), waves = [1, 2, 3, 5].map(k => [k, r() * TAU, (0.5 + r()) / k]);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W + 6; x += 6) {
    const u = ((x + shift) / period) * TAU;
    ctx.lineTo(x, base - amp * waves.reduce((s, [k, p, a]) => s + a * Math.sin(k * u + p), 0));
  }
  ctx.lineTo(W, H); ctx.fill();
  return u => base - amp * waves.reduce((s, [k, p, a]) => s + a * Math.sin(k * u + p), 0);
}

// things placed every `step` pixels along a scrolling layer
function every(W, shift, step, fn) {
  for (let i = -1, x0 = -mod(shift, step); x0 + i * step < W + step; i++) fn(x0 + i * step, Math.round((shift + x0 + i * step) / step));
}

export default {
  name: 'Parallax Layers',
  ko: '패럴랙스',
  draw(ctx, t, W, H) {
    const p = phase(t);
    const sky = ctx.createLinearGradient(0, 0, 0, 1300);
    sky.addColorStop(0, '#26215F'); sky.addColorStop(0.45, '#7A4E9E'); sky.addColorStop(0.8, '#F2897B'); sky.addColorStop(1, '#FFCB8E');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(650, 900, 60, 650, 900, 520);
    glow.addColorStop(0, 'rgba(255, 236, 190, 0.7)'); glow.addColorStop(1, 'rgba(255, 236, 190, 0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#FFEFC4'; ctx.beginPath(); ctx.arc(650, 900, 120, 0, TAU); ctx.fill(); // the sun is infinitely far: it never moves

    const s1 = 540 * p; // clouds and far mountains: 540 px per loop
    ctx.fillStyle = 'rgba(255, 228, 220, 0.45)';
    ctx.beginPath(); // one path for all the puffs, so overlaps do not darken
    every(W, s1, 540, x => {
      for (const [dx, dy, rx] of [[0, 0, 110], [90, -30, 80], [170, 5, 95], [330, 170, 70], [400, 150, 90]]) {
        ctx.moveTo(x + dx + rx, 520 + dy); ctx.ellipse(x + dx, 520 + dy, rx, rx * 0.36, 0, 0, TAU);
      }
    });
    ctx.fill();
    ridge(ctx, W, H, s1, 540, 1110, 150, 3, '#C99CC6');
    ridge(ctx, W, H, 1080 * p, 1080, 1250, 150, 8, '#9C6EA8');

    const s3 = 1620 * p, hill = ridge(ctx, W, H, s3, 540, 1400, 70, 13, '#6B4C8C');
    every(W, s3, 90, (x, i) => { // pines on the hills
      const r = rng(mod(i, 6) + 20), h = 70 + r() * 80, y = hill(((x + s3) / 540) * TAU) + 12;
      if (r() < 0.25) return;
      ctx.fillStyle = '#4F3A75';
      ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + h * 0.32, y); ctx.lineTo(x - h * 0.32, y); ctx.fill();
    });

    const s4 = 2160 * p; // the road
    ctx.fillStyle = '#2E2552'; ctx.fillRect(0, 1500, W, H - 1500);
    ctx.fillStyle = '#3A2E63'; ctx.fillRect(0, 1500, W, 170);
    ctx.fillStyle = '#4A3C78'; ctx.fillRect(0, 1500, W, 14);
    ctx.fillStyle = '#F6C66E';
    every(W, s4, 270, x => { ctx.beginPath(); ctx.roundRect(x, 1580, 130, 12, 6); ctx.fill(); });

    // the car stays in the middle of the frame; its wheels roll 8 turns per loop (2160 px of road)
    const cx = 540, cy = 1555 + 4 * Math.sin(p * TAU * 10), R = 2160 / (8 * TAU);
    ctx.fillStyle = 'rgba(20, 12, 40, 0.35)';
    ctx.beginPath(); ctx.ellipse(cx, 1628, 160, 14, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#FF5E6C';
    ctx.beginPath(); ctx.roundRect(cx - 160, cy - 50, 320, 76, 26); ctx.fill();
    ctx.beginPath(); ctx.roundRect(cx - 95, cy - 112, 180, 80, [40, 50, 8, 8]); ctx.fill();
    ctx.fillStyle = '#BFE6FF';
    ctx.beginPath(); ctx.roundRect(cx - 78, cy - 98, 72, 56, [26, 6, 4, 4]); ctx.fill();
    ctx.beginPath(); ctx.roundRect(cx + 4, cy - 98, 64, 56, [6, 30, 4, 4]); ctx.fill();
    ctx.fillStyle = '#FFE9A8'; ctx.beginPath(); ctx.ellipse(cx + 150, cy - 18, 12, 16, 0, 0, TAU); ctx.fill();
    for (const wx of [cx - 95, cx + 95]) {
      ctx.fillStyle = '#231B3A'; ctx.beginPath(); ctx.arc(wx, 1600, R, 0, TAU); ctx.fill();
      ctx.fillStyle = '#D9D2EA'; ctx.beginPath(); ctx.arc(wx, 1600, R * 0.5, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#231B3A'; ctx.lineWidth = 5;
      for (let k = 0; k < 3; k++) {
        const a = p * TAU * 8 + (k * TAU) / 3;
        ctx.beginPath(); ctx.moveTo(wx, 1600); ctx.lineTo(wx + R * 0.5 * Math.cos(a), 1600 + R * 0.5 * Math.sin(a)); ctx.stroke();
      }
    }

    const s5 = 3240 * p; // dark foreground bushes, the fastest layer
    ridge(ctx, W, H, s5, 1080, 1790, 40, 31, '#1C1734');
    ctx.fillStyle = '#1C1734';
    every(W, s5, 360, (x, i) => {
      const r = rng(mod(i, 3) + 40);
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(x + k * 55, 1760 - r() * 40, 50 + r() * 40, 0, TAU); ctx.fill(); }
    });
  },
};
