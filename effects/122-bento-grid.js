// FLIP layout: six bento tiles on a 4 x 6 grid move between three layouts; each tile tweens its rectangle (staggered,
// eased) and lays its content out from its current size, so photos re-crop and text re-flows smoothly.
import { TAU, FONT, canvas, clamp, ease, lerp, smoothstep } from '../lib/util.js';
import { landscape } from '../lib/scenes.js';

const GX = 60, GY = 330, UW = 222, UH = 228, GAP = 24;
const LAYOUTS = [ // per tile [col, row, w, h]: photo, weather, calendar, steps, music, chart
  [[0, 0, 2, 3], [2, 0, 2, 2], [2, 2, 1, 1], [3, 2, 1, 1], [0, 3, 4, 1], [0, 4, 4, 2]],
  [[0, 0, 4, 2], [0, 2, 2, 2], [2, 2, 2, 1], [2, 3, 2, 1], [0, 4, 2, 2], [2, 4, 2, 2]],
  [[2, 0, 2, 4], [0, 0, 2, 2], [0, 2, 1, 1], [1, 2, 1, 1], [0, 3, 2, 1], [0, 4, 4, 2]],
];
const MOVES = [[0.3, 0, 1], [1.9, 1, 2], [3.5, 2, 0]]; // start time, from layout, to layout
const SALES = [0.3, 0.42, 0.36, 0.55, 0.5, 0.68, 0.6, 0.78, 0.7, 0.86, 0.8, 0.95];
let photo;

const px = ([c, r, w, h]) => [GX + c * (UW + GAP), GY + r * (UH + GAP), w * UW + (w - 1) * GAP, h * UH + (h - 1) * GAP];
function rect(i, t) { // [x, y, w, h, lift]; lift (0..1) shrinks the tile a little while it travels
  let from = 0, to = 0, k = 0;
  for (const [t0, a, b] of MOVES) if (t >= t0) { from = a; to = b; k = ease.inOut(clamp((t - t0 - i * 0.04) / 1.0)); }
  const p = px(LAYOUTS[from][i]), q = px(LAYOUTS[to][i]), lift = from === to ? 0 : Math.sin(Math.PI * k);
  return [...p.map((v, j) => lerp(v, q[j], k)), lift];
}

function fill(ctx, x, y, w, h, a, b) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, a); g.addColorStop(1, b);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
}
const text = (ctx, s, x, y, size, weight, color, font = FONT.ko) => {
  ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.fillText(s, x, y);
};

const TILES = [
  (ctx, x, y, w, h) => { // photo at a fixed scale, centred: resizing the tile only shows more or less of it
    ctx.drawImage(photo, x + w / 2 - 500, y + h / 2 - 500);
    const g = ctx.createLinearGradient(0, y + h - 200, 0, y + h);
    g.addColorStop(0, 'rgba(0, 0, 0, 0)'); g.addColorStop(1, 'rgba(10, 5, 25, 0.7)');
    ctx.fillStyle = g; ctx.fillRect(x, y + h - 200, w, 200);
    text(ctx, '제주 · 노을', x + 32, y + h - 40, 38, 800, '#FFF');
  },
  (ctx, x, y, w, h) => { // weather
    fill(ctx, x, y, w, h, '#3D7BFF', '#79C2FF');
    const s = Math.min(w, h), size = clamp(s * 0.42, 72, 150);
    ctx.fillStyle = '#FFD45C'; ctx.beginPath(); ctx.arc(x + w - 30 - s * 0.14, y + 30 + s * 0.14, s * 0.14, 0, TAU); ctx.fill();
    text(ctx, '23°', x + 30, y + 26 + size * 0.86, size, 700, '#FFF', FONT.sans);
    text(ctx, '서울 · 맑음', x + 32, y + h - 34, 30, 600, 'rgba(255, 255, 255, 0.85)');
  },
  (ctx, x, y, w, h) => { // calendar
    fill(ctx, x, y, w, h, '#FFFFFF', '#EEF0F6');
    const size = clamp(Math.min(w, h) * 0.5, 96, 150);
    text(ctx, '월요일', x + 30, y + 58, 30, 700, '#FF4D5E');
    text(ctx, '26', x + 26, y + 58 + size * 0.95, size, 700, '#141622', FONT.sans);
  },
  (ctx, x, y, w, h) => { // steps ring
    fill(ctx, x, y, w, h, '#1E2236', '#262B45');
    const r = Math.min(w, h) * 0.3, cx = x + w / 2, cy = y + h / 2;
    ctx.lineWidth = r * 0.24; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#4BE3A0'; ctx.beginPath(); ctx.arc(cx, cy, r, -TAU / 4, -TAU / 4 + TAU * 0.72); ctx.stroke();
    ctx.textAlign = 'center'; text(ctx, '72%', cx, cy + r * 0.16, r * 0.46, 800, '#FFF', FONT.sans); ctx.textAlign = 'left';
  },
  (ctx, x, y, w, h, t) => { // music: text sits right of the cover when the tile is wide, below it when tall
    fill(ctx, x, y, w, h, '#FF5C8A', '#9B5CFF');
    const side = Math.min(h - 64, 190), m = smoothstep(1.2, 2.2, w / h);
    const art = ctx.createLinearGradient(x + 32, y + 32, x + 32 + side, y + 32 + side);
    art.addColorStop(0, '#FFC15E'); art.addColorStop(1, '#FF5C8A');
    ctx.fillStyle = art; ctx.beginPath(); ctx.roundRect(x + 32, y + 32, side, side, 24); ctx.fill();
    const tx = lerp(x + 32, x + 64 + side, m), ty = lerp(y + side + 96, y + 92, m), size = clamp((w - side - 100) / 7.4, 30, 40);
    text(ctx, 'Midnight Drive', tx, ty, lerp(40, size, m), 800, '#FFF', FONT.sans);
    text(ctx, 'Neon Coast', tx, ty + 44, 28, 500, 'rgba(255, 255, 255, 0.8)', FONT.sans);
    ctx.fillStyle = '#FFF';
    for (let b = 0; b < 5; b++) { // equaliser
      const bh = 12 + 28 * (0.5 + 0.5 * Math.sin(t / 5 * TAU * (5 + b) + b * 1.3));
      ctx.beginPath(); ctx.roundRect(x + w - 150 + b * 24, y + h - 30 - bh, 12, bh, 6); ctx.fill();
    }
  },
  (ctx, x, y, w, h) => { // sales sparkline
    fill(ctx, x, y, w, h, '#141726', '#1C2035');
    text(ctx, '이번 달 매출', x + 32, y + 56, 30, 600, 'rgba(255, 255, 255, 0.6)');
    text(ctx, '₩1.24M', x + 32, y + 128, 64, 800, '#FFF', FONT.sans);
    text(ctx, '+12.4%', x + 32, y + 176, 30, 700, '#4BE3A0', FONT.sans);
    const x0 = x + 32, x1 = x + w - 32, top = y + 200, bot = y + h - 36;
    const pts = SALES.map((v, i) => [lerp(x0, x1, i / (SALES.length - 1)), lerp(bot, top, v)]);
    ctx.beginPath(); pts.forEach(([a, b]) => ctx.lineTo(a, b));
    ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.strokeStyle = '#7C8CFF'; ctx.stroke();
    ctx.lineTo(x1, bot); ctx.lineTo(x0, bot); ctx.closePath();
    const g = ctx.createLinearGradient(0, top, 0, bot);
    g.addColorStop(0, 'rgba(124, 140, 255, 0.35)'); g.addColorStop(1, 'rgba(124, 140, 255, 0)');
    ctx.fillStyle = g; ctx.fill();
  },
];

export default {
  name: 'Bento Grid',
  ko: '벤토 그리드',
  setup() {
    photo = canvas(1000, 1000);
    landscape(photo.getContext('2d'), 1000, 1000, 0);
  },
  draw(ctx, t, W, H) {
    const bg = ctx.createRadialGradient(W / 2, 1000, 100, W / 2, 1000, 1200);
    bg.addColorStop(0, '#1A1C2C'); bg.addColorStop(1, '#090A10');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    TILES.forEach((tile, i) => {
      const [x, y, w, h, lift] = rect(i, t), s = 1 - 0.06 * lift;
      ctx.save();
      ctx.translate(x + w / 2, y + h / 2); ctx.scale(s, s); ctx.translate(-x - w / 2, -y - h / 2);
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'; ctx.shadowBlur = 40 + 30 * lift; ctx.shadowOffsetY = 14 + 16 * lift;
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 36); ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.beginPath(); ctx.roundRect(x, y, w, h, 36); ctx.clip();
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      tile(ctx, x, y, w, h, t);
      ctx.restore();
      ctx.restore();
    });
  },
};
