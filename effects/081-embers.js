// Embers: each spark lives on its own 5 s or 2.5 s cycle (age = (t - birth) mod life), rises from the fire, sways and
// cools from yellow to red; drawn as a short glowing streak along its path. The flames are looping-sine teardrops.
import { TAU, rng, phase, smoothstep } from '../lib/util.js';

const FX = 540, FY = 1660;
const r = rng(81);
const sparks = Array.from({ length: 240 }, () => {
  const life = r() < 0.7 ? 5 : 2.5;
  return {
    life, b: r() * life, x0: FX + (r() + r() + r() - 1.5) * 220, v: (life === 5 ? 200 : 330) * (0.7 + 0.6 * r()),
    drift: (r() - 0.5) * 60, sw: 18 + 40 * r(), sf: 1 + 1.4 * r(), ph: r() * TAU, size: 0.7 + 0.6 * r(),
  };
});
const at = (s, a) => [s.x0 + s.drift * a + s.sw * Math.sin(s.sf * a + s.ph) * Math.min(1, a), FY - 40 - s.v * a * (1 + 0.1 * a)];

let glow = null;
export default {
  name: 'Embers',
  ko: '불씨',
  setup() {
    glow = document.createElement('canvas'); glow.width = glow.height = 64;
    const g = glow.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255, 190, 90, 0.9)'); gr.addColorStop(0.3, 'rgba(255, 110, 30, 0.35)'); gr.addColorStop(1, 'rgba(255, 60, 10, 0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  },
  draw(ctx, t, W, H) {
    const a = phase(t) * TAU;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#07040A'); bg.addColorStop(0.6, '#1A0809'); bg.addColorStop(1, '#3A1108');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const heat = ctx.createRadialGradient(FX, FY, 0, FX, FY, 900);
    heat.addColorStop(0, `rgba(255, 110, 30, ${0.42 + 0.04 * Math.sin(7 * a)})`); heat.addColorStop(1, 'rgba(255, 80, 20, 0)');
    ctx.fillStyle = heat; ctx.fillRect(0, 0, W, H);

    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 9; k++) { // flames: teardrops whose height and tip sway on integer-frequency sines
      const x = FX + (k - 4) * 44, h = (380 - Math.abs(k - 4) * 55) * (0.85 + 0.15 * Math.sin((6 + k) * a + k * 1.7));
      const tip = 30 * Math.sin((5 + (k % 3)) * a + k), w = 70 - Math.abs(k - 4) * 6;
      const g = ctx.createLinearGradient(0, FY, 0, FY - h);
      g.addColorStop(0, 'rgba(255, 230, 150, 0.75)'); g.addColorStop(0.4, 'rgba(255, 130, 30, 0.45)'); g.addColorStop(1, 'rgba(200, 40, 10, 0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x - w, FY);
      ctx.bezierCurveTo(x - w, FY - h * 0.45, x + tip - 10, FY - h * 0.7, x + tip, FY - h);
      ctx.bezierCurveTo(x + tip + 10, FY - h * 0.7, x + w, FY - h * 0.45, x + w, FY);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#1B0B07'; // logs and ground
    for (const [ang, dx] of [[-0.22, -40], [0.22, 40]]) {
      ctx.save(); ctx.translate(FX + dx, FY + 30); ctx.rotate(ang);
      ctx.beginPath(); ctx.roundRect(-220, -26, 440, 52, 26); ctx.fill(); ctx.restore();
    }
    ctx.fillStyle = '#120706'; ctx.fillRect(0, FY + 60, W, H - FY - 60);

    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const s of sparks) {
      const age = ((t - s.b) % s.life + s.life) % s.life, k = age / s.life;
      const alpha = smoothstep(0, 0.08, k) * (1 - smoothstep(0.45, 1, k)) * (0.75 + 0.25 * Math.sin(9 * age + s.ph));
      if (alpha < 0.01) continue;
      const [x, y] = at(s, age), [x1, y1] = at(s, Math.max(0, age - 0.12));
      const hue = 48 - 40 * k, light = 82 - 34 * k;
      ctx.strokeStyle = `hsla(${hue}, 100%, ${light}%, ${alpha})`;
      ctx.lineWidth = (4 - 1.6 * k) * s.size + 1;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x, y); ctx.stroke();
      const gs = 34 * s.size * (1 - 0.4 * k);
      ctx.globalAlpha = alpha * 0.7;
      ctx.drawImage(glow, x - gs / 2, y - gs / 2, gs, gs);
      ctx.globalAlpha = 1;
    }
  },
};
