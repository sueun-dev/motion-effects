// Liquid fill: two wavy liquid layers and rising bubbles are drawn off-screen, then cut to the letter shapes
// with 'destination-in'. The level rises to the brim and drains again once per loop.
import { TAU, phase, rng, FONT, canvas } from '../lib/util.js';

const LINES = [['FILL', 900], ['UP', 1340]]; // text and baseline y
const TOP = 590, BOTTOM = 1350;              // the liquid level runs between these (empty .. brim)
const BUBBLES = (() => { const r = rng(39); return Array.from({ length: 26 }, () => [140 + r() * 800, r(), 6 + r() * 12, 1 + Math.floor(r() * 2)]); })();

let liquid, mask;

function letters(ctx) {
  ctx.font = `900 400px ${FONT.black}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  for (const [text, y] of LINES) ctx.fillText(text, 540, y);
}

// the liquid below a wavy surface; foam = colour of a bright line along the top
function surface(ctx, W, y, a, amp, k, shift, foam) {
  ctx.beginPath(); ctx.moveTo(0, 1920);
  for (let x = 0; x <= W; x += 8) ctx.lineTo(x, y + amp * Math.sin(x / W * TAU * k + a + shift) + amp * 0.5 * Math.sin(x / W * TAU * (k + 1) - 2 * a));
  ctx.lineTo(W, 1920); ctx.fill();
  if (foam) { ctx.strokeStyle = foam; ctx.lineWidth = 8; ctx.stroke(); }
}

export default {
  name: 'Liquid Fill Text',
  ko: '리퀴드 필 텍스트',
  setup() {
    liquid = canvas(); mask = canvas();
    letters(mask.getContext('2d')); // one image of both lines, so one 'destination-in' keeps both
  },
  draw(ctx, t, W, H) {
    const a = phase(t) * TAU;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0B1433'); bg.addColorStop(1, '#16275A');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // 0 -> 1 -> 0 with soft turns at the bottom and the brim
    const fill = 0.5 - 0.5 * Math.cos(phase(t) * TAU);
    const level = BOTTOM - (BOTTOM - TOP) * (0.1 + 0.94 * fill);
    const slosh = 20 + 22 * Math.sin(Math.PI * phase(t)) ** 2; // calmer when it is still

    const g = liquid.getContext('2d');
    g.clearRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#7FE3FF'; surface(g, W, level - 10, a, slosh, 2, 1.3);
    const deep = g.createLinearGradient(0, TOP, 0, BOTTOM);
    deep.addColorStop(0, '#2EC4FF'); deep.addColorStop(1, '#1D4FE0');
    g.fillStyle = deep; surface(g, W, level, -a, slosh * 0.8, 3, 0, 'rgba(210, 248, 255, 0.9)');
    g.globalCompositeOperation = 'source-atop'; // bubbles only where there is liquid
    for (const [x, off, r, speed] of BUBBLES) {
      const k = (off + phase(t) * speed) % 1, y = BOTTOM + 20 - k * (BOTTOM - TOP + 80);
      g.fillStyle = `rgba(255, 255, 255, ${0.45 * Math.min(1, k * 6)})`;
      g.beginPath(); g.arc(x + 10 * Math.sin(a * speed + off * 9), y, r, 0, TAU); g.fill();
    }
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(mask, 0, 0);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)'; letters(ctx); // the empty glass
    ctx.drawImage(liquid, 0, 0);
    ctx.save();
    ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(235, 248, 255, 0.9)';
    ctx.font = `900 400px ${FONT.black}`; ctx.textAlign = 'center';
    for (const [text, y] of LINES) ctx.strokeText(text, 540, y);
    ctx.restore();

    ctx.fillStyle = 'rgba(200, 235, 255, 0.85)';
    ctx.font = `600 56px ${FONT.mono}`; ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(fill * 100)}%`, 540, 1560);
    ctx.fillStyle = 'rgba(200, 235, 255, 0.25)'; ctx.fillRect(340, 1600, 400, 10);
    ctx.fillStyle = '#2EC4FF'; ctx.fillRect(340, 1600, 400 * fill, 10);
  },
};
