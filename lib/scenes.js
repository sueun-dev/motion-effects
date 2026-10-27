// Two procedural pictures for effects that need "an image" (halftone, duotone, transitions ...).
// Both are pure functions of t: landscape() drifts gently on the 5-second loop, city() stands still.
import { TAU, phase, rng, fbm3 } from './util.js';

// sunset over layered mountains and a lake
export function landscape(ctx, w, h, t = 0) {
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.62);
  sky.addColorStop(0, '#2B1B5A'); sky.addColorStop(0.55, '#E8577A'); sky.addColorStop(1, '#FFB36B');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h * 0.62);

  const sx = w * 0.5, sy = h * (0.37 + 0.01 * Math.sin(phase(t) * TAU)), sr = w * 0.17;
  const glow = ctx.createRadialGradient(sx, sy, sr * 0.8, sx, sy, sr * 3);
  glow.addColorStop(0, 'rgba(255, 220, 150, 0.55)'); glow.addColorStop(1, 'rgba(255, 220, 150, 0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h * 0.62);
  ctx.fillStyle = '#FFE6A8';
  ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill();

  const layers = [['#C2507E', 0.47, 0.10], ['#8E3B78', 0.52, 0.12], ['#5A2A68', 0.57, 0.11], ['#2E1A4A', 0.62, 0.08]];
  layers.forEach(([color, base, amp], k) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) ctx.lineTo(x, h * (base - amp * (0.5 + fbm3(x / w * (2 + k) + k * 7.3, k * 3.1, 0.5))));
    ctx.lineTo(w, h); ctx.fill();
  });

  const lake = ctx.createLinearGradient(0, h * 0.62, 0, h);
  lake.addColorStop(0, '#E0748A'); lake.addColorStop(0.3, '#7A3B78'); lake.addColorStop(1, '#1E1238');
  ctx.fillStyle = lake; ctx.fillRect(0, h * 0.62, w, h * 0.38);
  ctx.fillStyle = 'rgba(255, 226, 160, 0.7)'; // sun on the water: lines that sway on the loop
  const k = h / 1920; // the lines were laid out for a full 1920 px frame; keep them inside smaller pictures
  for (let i = 0; i < 14; i++) {
    const y = h * 0.63 + i * i * 2.6 * k, half = sr * (1 - i / 16) * (0.8 + 0.2 * Math.sin(phase(t) * TAU + i));
    ctx.fillRect(sx - half, y, half * 2, (4 + i * 0.6) * k);
  }
}

// night skyline with lit windows, a moon and the city reflected in the river
export function city(ctx, w, h) {
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.68);
  sky.addColorStop(0, '#0B1030'); sky.addColorStop(0.6, '#3A2A6E'); sky.addColorStop(1, '#E0607E');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  const r = rng(11);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  for (let i = 0; i < 90; i++) { ctx.beginPath(); ctx.arc(r() * w, r() * h * 0.45, 1 + r() * 2, 0, TAU); ctx.fill(); }
  const moon = ctx.createRadialGradient(w * 0.72, h * 0.2, 10, w * 0.72, h * 0.2, 260);
  moon.addColorStop(0, 'rgba(255, 240, 210, 0.45)'); moon.addColorStop(1, 'rgba(255, 240, 210, 0)');
  ctx.fillStyle = moon; ctx.fillRect(0, 0, w, h * 0.6);
  ctx.fillStyle = '#FFF1D6'; ctx.beginPath(); ctx.arc(w * 0.72, h * 0.2, 72, 0, TAU); ctx.fill();

  const base = h * 0.68;
  const skyline = (seed, color, minH, maxH, lit) => {
    const q = rng(seed), out = [];
    for (let x = -20; x < w + 20;) {
      const bw = 70 + q() * 110, bh = minH + q() * (maxH - minH);
      out.push([x, bw, bh]);
      ctx.fillStyle = color; ctx.fillRect(x, base - bh, bw - 6, bh);
      if (lit) {
        for (let y = base - bh + 24; y < base - 20; y += 34) {
          for (let wx = x + 12; wx < x + bw - 24; wx += 26) {
            if (q() < 0.42) { ctx.fillStyle = q() < 0.8 ? '#FFD36E' : '#9BE7FF'; ctx.fillRect(wx, y, 12, 18); }
          }
        }
      }
      x += bw;
    }
    return out;
  };
  skyline(3, '#2A2F5E', 260, 620, false);
  skyline(7, '#141433', 160, 820, true);

  ctx.save(); // the river: the frame above, flipped, darker and cut into ripples
  ctx.beginPath(); ctx.rect(0, base, w, h - base); ctx.clip();
  ctx.globalAlpha = 0.45;
  for (let y = base; y < h; y += 6) ctx.drawImage(ctx.canvas, 0, 2 * base - y - 6, w, 6, Math.sin(y * 0.05) * 6, y, w, 6);
  ctx.globalAlpha = 1;
  const water = ctx.createLinearGradient(0, base, 0, h);
  water.addColorStop(0, 'rgba(20, 16, 50, 0.35)'); water.addColorStop(1, 'rgba(8, 8, 26, 0.95)');
  ctx.fillStyle = water; ctx.fillRect(0, base, w, h - base);
  ctx.restore();
}
