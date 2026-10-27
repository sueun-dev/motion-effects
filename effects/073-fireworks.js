// Fireworks: every shell's rise and burst are closed-form ballistics (drag + gravity) from its launch time,
// taken modulo 5 s, so the show loops; sparks are tapered streaks with a soft glowing head, added together.
import { TAU, rng, clamp } from '../lib/util.js';

const G = 200, K = 1.45, RISE = 1.0, TRAIL = 0.36;
const HUES = [350, 42, 190, 290, 135, 25];
const r = rng(73);
const shells = HUES.map((hue, i) => ({
  t0: i * 5 / 6, hue, x0: 540 + (r() - 0.5) * 300,
  bx: 300 + ((i * 0.618 + 0.2) % 1) * 480, by: 560 + ((i * 0.382 + 0.1) % 1) * 560,
  sparks: Array.from({ length: 150 }, () => {
    const z = 2 * r() - 1, a = r() * TAU, s = 540 + 60 * r();
    const k = Math.sqrt(1 - z * z); // directions on a sphere, seen from the side
    return { vx: s * k * Math.cos(a), vy: s * k * Math.sin(a), life: 1.9 + 0.8 * r(), tw: r() * TAU, l: 60 + 20 * r() };
  }),
}));

// spark offset from the burst point after `a` seconds: speed decays as e^(-K a), gravity pulls down
const fly = (p, a) => {
  const e = (1 - Math.exp(-K * a)) / K;
  return [p.vx * e, G * a / K + (p.vy - G / K) * e];
};

let bg = null, glow = {};
export default {
  name: 'Fireworks',
  ko: '불꽃놀이',
  setup(ctx, W, H) {
    bg = document.createElement('canvas'); bg.width = W; bg.height = H;
    const c = bg.getContext('2d');
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#03051A'); sky.addColorStop(0.65, '#130E36'); sky.addColorStop(1, '#3B1B4C');
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    const q = rng(3);
    for (let i = 0; i < 140; i++) { c.fillStyle = `rgba(255,255,255,${0.15 + q() * 0.4})`; c.beginPath(); c.arc(q() * W, q() * H * 0.8, 1.2 + q() * 1.3, 0, TAU); c.fill(); }
    for (let x = -10; x < W;) { // skyline with lit windows
      const w = 60 + q() * 90, h = 90 + q() * 170;
      c.fillStyle = '#06061A'; c.fillRect(x, H - h, w - 4, h);
      c.fillStyle = 'rgba(255, 200, 120, 0.5)';
      for (let y = H - h + 20; y < H - 16; y += 28) for (let wx = x + 10; wx < x + w - 18; wx += 20) if (q() < 0.3) c.fillRect(wx, y, 8, 12);
      x += w;
    }
    for (const hue of HUES) { // soft round glow sprite per colour
      const s = document.createElement('canvas'); s.width = s.height = 48;
      const g = s.getContext('2d').createRadialGradient(24, 24, 0, 24, 24, 24);
      g.addColorStop(0, `hsla(${hue}, 100%, 92%, 1)`); g.addColorStop(0.3, `hsla(${hue}, 100%, 65%, 0.5)`); g.addColorStop(1, `hsla(${hue}, 100%, 55%, 0)`);
      const sc = s.getContext('2d'); sc.fillStyle = g; sc.fillRect(0, 0, 48, 48);
      glow[hue] = s;
    }
  },
  draw(ctx, t) {
    ctx.drawImage(bg, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const s of shells) {
      const age = ((t - s.t0) % 5 + 5) % 5;
      if (age < RISE) { // the rocket eases up to the burst point
        const pos = k => { const e = 1 - (1 - k) ** 2; return [s.x0 + (s.bx - s.x0) * e, 1950 + (s.by - 1950) * e]; };
        const k = age / RISE, [x, y] = pos(k), [x1, y1] = pos(Math.max(0, k - 0.14));
        const g = ctx.createLinearGradient(x1, y1, x, y);
        g.addColorStop(0, 'rgba(255, 170, 90, 0)'); g.addColorStop(1, 'rgba(255, 225, 180, 0.95)');
        ctx.strokeStyle = g; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x, y); ctx.stroke();
        ctx.drawImage(glow[s.hue], x - 16, y - 16, 32, 32);
        continue;
      }
      const a = age - RISE;
      const flash = (a / 0.15) * Math.exp(1 - a / 0.15); // smooth bump, peaks 0.15 s after the burst
      const g = ctx.createRadialGradient(s.bx, s.by, 0, s.bx, s.by, 520);
      g.addColorStop(0, `hsla(${s.hue}, 100%, 70%, ${0.22 * flash})`); g.addColorStop(1, `hsla(${s.hue}, 100%, 60%, 0)`);
      ctx.fillStyle = g; ctx.fillRect(s.bx - 520, s.by - 520, 1040, 1040);
      for (const p of s.sparks) {
        if (a > p.life) continue;
        const fade = (1 - a / p.life) ** 1.3 * (0.7 + 0.3 * Math.sin(a * 12 + p.tw)); // smooth twinkle
        const hot = clamp(1 - a * 2); // white-hot right after the burst
        let [px, py] = fly(p, a);
        ctx.globalAlpha = fade;
        ctx.drawImage(glow[s.hue], s.bx + px - 12, s.by + py - 12, 24, 24);
        for (let j = 1; j <= 5; j++) { // tapered trail: older segments fainter and thinner
          const [qx, qy] = fly(p, Math.max(0, a - TRAIL * j / 5));
          ctx.strokeStyle = `hsla(${s.hue}, 100%, ${p.l + (95 - p.l) * hot}%, ${1 - j / 6})`;
          ctx.lineWidth = 4.6 - j * 0.5;
          ctx.beginPath(); ctx.moveTo(s.bx + px, s.by + py); ctx.lineTo(s.bx + qx, s.by + qy); ctx.stroke();
          px = qx; py = qy;
        }
        ctx.globalAlpha = 1;
      }
    }
  },
};
