// Paper cutout: stacked wavy paper sheets, each casting a soft shadow on the sheet behind it, roll on looping
// sine waves; a paper boat rides one sheet. A fixed paper-fibre texture (seeded, never changes) sits on top.
import { TAU, phase, rng, canvas } from '../lib/util.js';

const LAYERS = ['#CDEDE6', '#A3DED6', '#76CBC8', '#4CB2BE', '#3192AC', '#247495', '#1C567A', '#153B5C'];
let paperTex = null;

const waveY = (i, x, a) => {
  const base = 1010 + i * 112, amp = 34 + i * 7, k = 0.006 + 0.0009 * (i % 3);
  const dir = i % 2 ? 1 : -1;
  return base + amp * (0.65 * Math.sin(k * x + dir * a + i * 1.3) + 0.35 * Math.sin(2.3 * k * x - 2 * dir * a + i));
};

function shadowed(ctx, color, draw) {
  ctx.save();
  ctx.shadowColor = 'rgba(25, 30, 50, 0.38)'; ctx.shadowBlur = 34; ctx.shadowOffsetY = -6;
  ctx.fillStyle = color;
  ctx.beginPath(); draw(); ctx.fill();
  ctx.restore();
}

export default {
  name: 'Paper Cutout',
  ko: '페이퍼 컷아웃',
  setup() {
    const r = rng(5);
    paperTex = canvas(256, 256);
    const g = paperTex.getContext('2d');
    for (let i = 0; i < 9000; i++) { // speckles and short fibres, all from a fixed seed
      const v = r() < 0.5 ? 0 : 255;
      g.fillStyle = `rgba(${v}, ${v}, ${v}, ${0.05 + 0.08 * r()})`;
      g.fillRect(r() * 256, r() * 256, 1 + r() * 2.5, 1 + r() * 1.2);
    }
  },
  draw(ctx, t, W, H) {
    const a = phase(t) * TAU;
    const sky = ctx.createLinearGradient(0, 0, 0, 1100);
    sky.addColorStop(0, '#FFE7CF'); sky.addColorStop(1, '#FFC9B0');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

    shadowed(ctx, '#FFF4E4', () => ctx.arc(540, 760, 250, 0, TAU)); // sun disc and its inner ring
    shadowed(ctx, '#FF9C6E', () => ctx.arc(540, 760 + 8 * Math.sin(a), 175, 0, TAU));
    for (const [x, y, s, k] of [[230, 430, 1, 0], [860, 560, 0.8, 2], [300, 880, 0.65, 4]]) {
      const cx = x + 40 * Math.sin(a + k);
      shadowed(ctx, '#FFFFFF', () => {
        ctx.roundRect(cx - 120 * s, y, 240 * s, 70 * s, 35 * s);
        ctx.moveTo(cx + 30 * s, y + 10 * s); ctx.arc(cx - 20 * s, y + 10 * s, 55 * s, 0, TAU);
        ctx.moveTo(cx + 105 * s, y + 25 * s); ctx.arc(cx + 55 * s, y + 25 * s, 50 * s, 0, TAU);
      });
    }

    LAYERS.forEach((color, i) => {
      shadowed(ctx, color, () => {
        ctx.moveTo(-40, H + 40);
        for (let x = -40; x <= W + 40; x += 12) ctx.lineTo(x, waveY(i, x, a));
        ctx.lineTo(W + 40, H + 40);
      });
      if (i === 2) { // the boat sits on this sheet, so the sheets in front hide its keel
        const bx = 540, by = waveY(2, bx, a);
        const tilt = Math.atan2(waveY(2, bx + 30, a) - waveY(2, bx - 30, a), 60);
        ctx.save(); ctx.translate(bx, by + 10); ctx.rotate(tilt);
        shadowed(ctx, '#FFFFFF', () => { ctx.moveTo(-150, -40); ctx.lineTo(150, -40); ctx.lineTo(95, 30); ctx.lineTo(-95, 30); });
        shadowed(ctx, '#FFF1DA', () => { ctx.moveTo(-6, -60); ctx.lineTo(-6, -270); ctx.lineTo(-120, -60); });
        shadowed(ctx, '#FF8A80', () => { ctx.moveTo(6, -60); ctx.lineTo(6, -230); ctx.lineTo(100, -60); });
        ctx.restore();
      }
    });

    ctx.save(); // fixed paper fibres over everything
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(paperTex, 'repeat');
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  },
};
