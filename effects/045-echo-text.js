// Echo text: the same word drawn again at earlier moments of its own path (t - k * delay), back to front,
// so a stack of coloured copies trails behind the lead word like an echo.
import { TAU, phase, FONT, hsl } from '../lib/util.js';

const COPIES = 14, DELAY = 0.07;

function pose(t) {
  const a = phase(t) * TAU;
  return { x: 540 + 150 * Math.cos(a), y: 1090 + 330 * Math.sin(a), s: 1 + 0.12 * Math.sin(2 * a), r: -0.1 * Math.sin(a) };
}

export default {
  name: 'Echo Text',
  ko: '에코 텍스트',
  draw(ctx, t, W, H) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#140F30'); bg.addColorStop(1, '#2A1250');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 230px ${FONT.display}`;
    for (let k = COPIES; k >= 0; k--) {
      const p = pose(t - k * DELAY), f = k / COPIES;
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.scale(p.s, p.s);
      if (k === 0) {
        ctx.fillStyle = '#FFF6EA';
        ctx.shadowColor = 'rgba(255, 120, 170, 0.8)'; ctx.shadowBlur = 40;
      } else {
        ctx.fillStyle = hsl((390 - 130 * f) % 360, 95, 62 - 18 * f, 1 - 0.7 * f); // orange near the lead -> pink -> violet far back
      }
      ctx.fillText('ECHO', 0, 0);
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(255, 246, 234, 0.5)'; ctx.font = `600 40px ${FONT.ko}`;
    ctx.fillText('같은 단어가 시간차로 따라온다', W / 2, 1720);
  },
};
