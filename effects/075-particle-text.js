// Particle text: the words are drawn once off-screen and every 8th pixel becomes a particle target. The cloud is the
// word twisted, blown up and jittered; each particle unwinds along that spiral into its target and back out again,
// so neighbours fly together (a vortex) instead of crossing. Fast particles are drawn along their last frame (blur).
import { TAU, rng, phase, span, FONT } from '../lib/util.js';

const STEP = 8, HUES = 10, TWIST = 0.55, CX = 540, CY = 960;
const sine = k => 0.5 - 0.5 * Math.cos(Math.PI * k);
let parts = [], sprites = [];

export default {
  name: 'Particle Text',
  ko: '파티클 텍스트',
  setup(ctx, W, H) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
    let size = 260;
    g.font = `900 ${size}px ${FONT.black}`;
    size = Math.floor(size * Math.min(1, 930 / g.measureText('MAGIC').width));
    g.font = `900 ${size}px ${FONT.black}`;
    g.fillText('MAKE', W / 2, 960 - size * 0.56);
    g.fillText('MAGIC', W / 2, 960 + size * 0.56);
    const px = g.getImageData(0, 0, W, H).data, r = rng(75);
    for (let y = 0; y < H; y += STEP) {
      for (let x = 0; x < W; x += STEP) {
        if (px[(y * W + x) * 4 + 3] < 128) continue;
        const a = r() * TAU, k = 30 + 120 * Math.sqrt(r());
        parts.push({
          tx: x + (r() - 0.5) * STEP, ty: y + (r() - 0.5) * STEP, jx: k * Math.cos(a), jy: k * Math.sin(a), ph: r() * TAU,
          d: Math.hypot(x - CX, y - CY) / 600 * 0.4, hue: Math.min(HUES - 1, Math.floor(x / W * HUES)),
        });
      }
    }
    for (let i = 0; i < HUES; i++) {
      const s = document.createElement('canvas'); s.width = s.height = 32;
      const sg = s.getContext('2d'), gr = sg.createRadialGradient(16, 16, 0, 16, 16, 16), hue = 185 + i * 14;
      gr.addColorStop(0, `hsla(${hue}, 100%, 88%, 1)`); gr.addColorStop(0.35, `hsla(${hue}, 100%, 62%, 0.65)`); gr.addColorStop(1, `hsla(${hue}, 100%, 55%, 0)`);
      sg.fillStyle = gr; sg.fillRect(0, 0, 32, 32);
      sprites.push(s);
    }
  },
  draw(ctx, t, W, H) {
    const bg = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, H * 0.7);
    bg.addColorStop(0, '#1C1240'); bg.addColorStop(1, '#05040F');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    const pos = (p, t) => {
      const a = phase(t) * TAU;
      const m = sine(span(t, 0.05 + p.d, 1.7 + p.d)) - sine(span(t, 3.0 + p.d, 4.65 + p.d)); // 0 cloud .. 1 word
      const u = 1 - m, ang = TWIST * u, sc = 1 + 0.4 * u;
      const vx = p.tx - CX, vy = p.ty - CY, c = Math.cos(ang), s = Math.sin(ang);
      const jx = p.jx + 40 * Math.sin(a + p.ph), jy = p.jy + 40 * Math.cos(a + p.ph);
      return [CX + sc * (vx * c - vy * s) + jx * u, CY + sc * (vx * s + vy * c) + jy * u, m];
    };
    for (const p of parts) {
      const [x, y, m] = pos(p, t), [x0, y0] = pos(p, t - 4 / 30); // trail over the last four frames
      const n = Math.max(1, Math.min(24, Math.ceil(Math.hypot(x - x0, y - y0) / 5)));
      const s = 17 + 8 * m;
      const alpha = (0.4 + 0.6 * m) * (0.8 + 0.2 * Math.sin(3 * phase(t) * TAU + p.ph));
      for (let i = 0; i < n; i++) { // the trail fades in and out at both ends, so it slides on and off pixels gently
        const k = (i + 0.5) / n;
        ctx.globalAlpha = n === 1 ? alpha : alpha * Math.sin(Math.PI * k) * 1.57 / n;
        ctx.drawImage(sprites[p.hue], x + (x0 - x) * k - s / 2, y + (y0 - y) * k - s / 2, s, s);
      }
    }
    ctx.globalAlpha = 1;
  },
};
