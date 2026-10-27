// Knockout text: a paper panel with the letters cut out ('destination-out') lies over a moving sunset scene.
// The scene is tiling mountain layers sliding at different speeds (parallax), seen only through the letters.
import { TAU, phase, fbm3, FONT, canvas } from '../lib/util.js';

const LINES = [['SUN', 930], ['SET', 1440]];
const LAYERS = [[1080, 1080, 170, '#C2507E'], [2160, 1230, 150, '#8E3B78'], [3240, 1380, 130, '#4A2160']]; // period, base y, height, colour
const CLOUDS = [[100, 520, 190, 1], [800, 610, 150, 1], [450, 700, 230, 1], [1150, 880, 170, 1], [300, 960, 200, 1]];
let panel, tiles;

// one mountain ridge that repeats every `period` px: the noise is read on a circle so the ends meet
function ridge(period, base, amp, color, seed) {
  const c = canvas(period, 1920), g = c.getContext('2d'), R = 2.2 * period / 1080;
  g.fillStyle = color; g.beginPath(); g.moveTo(0, 1920);
  for (let x = 0; x <= period; x += 4) {
    const a = x / period * TAU;
    g.lineTo(x, base - amp * (0.6 + fbm3(R * Math.cos(a), R * Math.sin(a), seed)));
  }
  g.lineTo(period, 1920); g.fill();
  return c;
}

export default {
  name: 'Knockout Text',
  ko: '녹아웃 텍스트',
  setup(ctx, W, H) {
    tiles = LAYERS.map(([p, base, amp, color], i) => ridge(p, base, amp, color, i * 3.7));
    panel = canvas();
    const g = panel.getContext('2d');
    g.fillStyle = '#F3ECE1'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'destination-out';
    g.font = `560px Impact, ${FONT.black}`;
    const size = Math.floor(560 * 960 / Math.max(...LINES.map(([s]) => g.measureText(s).width)));
    g.font = `${size}px Impact, ${FONT.black}`;
    g.textAlign = 'center';
    for (const [text, y] of LINES) g.fillText(text, W / 2, y);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#3B2A3A'; g.font = `600 40px ${FONT.ko}`;
    g.fillText('글자 사이로 흐르는 풍경', W / 2, 1600);
  },
  draw(ctx, t, W, H) {
    const sky = ctx.createLinearGradient(0, 300, 0, 1300);
    sky.addColorStop(0, '#2B1B5A'); sky.addColorStop(0.55, '#E8577A'); sky.addColorStop(1, '#FFB36B');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    const sy = 780 + 30 * Math.sin(phase(t) * TAU);
    const glow = ctx.createRadialGradient(W / 2, sy, 120, W / 2, sy, 620);
    glow.addColorStop(0, 'rgba(255, 225, 160, 0.7)'); glow.addColorStop(1, 'rgba(255, 225, 160, 0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#FFE8AE'; ctx.beginPath(); ctx.arc(W / 2, sy, 170, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255, 214, 220, 0.45)'; // long thin clouds, wrapping round a 1700 px loop (off-screen at the wrap)
    CLOUDS.forEach(([x0, y, len, dir]) => {
      const x = ((x0 + dir * phase(t) * 1700) % 1700 + 1700) % 1700 - 320;
      ctx.beginPath(); ctx.ellipse(x, y, len, 16, 0, 0, TAU); ctx.ellipse(x + len * 0.4, y - 18, len * 0.5, 14, 0, 0, TAU); ctx.fill();
    });

    // each layer slides one full period per loop, so nearer (longer) layers move faster
    tiles.forEach((tile, i) => {
      const off = phase(t) * tile.width;
      ctx.drawImage(tile, -off, 0);
      ctx.drawImage(tile, tile.width - off, 0);
    });

    ctx.save();
    ctx.shadowColor = 'rgba(40, 10, 30, 0.45)'; ctx.shadowBlur = 36; ctx.shadowOffsetY = 14; // falls into the holes
    ctx.drawImage(panel, 0, 0);
    ctx.restore();
  },
};
