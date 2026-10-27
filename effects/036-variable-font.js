// Variable font: the macOS system font (SF, reached through "system-ui") has a continuous weight axis, so the canvas
// can draw any weight 100..900. Each letter breathes between thin and black a little after its neighbour, and since
// heavier letters are wider the word itself swells and narrows; a slider shows the weight of the middle letter.
import { TAU, phase, FONT } from '../lib/util.js';

const WORD = 'BREATHE', SIZE = 200, SANS = 'system-ui';
const weight = (t, i) => 500 - 400 * Math.cos(phase(t) * TAU * 2 - i * 0.45); // two breaths per loop, 100 .. 900

// Chrome draws system-ui weights 501..538 far too bold (measureText is fine), so inside that slice the glyph is
// drawn at 500 and the 539 glyph is laid over it with partial opacity: its slightly fatter edge fades in smoothly.
function glyph(ctx, ch, x, y, w, size) {
  if (w <= 500 || w >= 539) { ctx.font = `${w.toFixed(1)} ${size}px ${SANS}`; ctx.fillText(ch, x, y); return; }
  ctx.font = `500 ${size}px ${SANS}`; ctx.fillText(ch, x, y);
  ctx.save(); ctx.globalAlpha *= (w - 500) / 39;
  ctx.font = `539 ${size}px ${SANS}`; ctx.fillText(ch, x, y);
  ctx.restore();
}

export default {
  name: 'Variable Font',
  ko: '가변 폰트',
  draw(ctx, t, W, H) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#FFF4EA'); bg.addColorStop(1, '#F6DCD0');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    const letters = [...WORD].map((ch, i) => {
      const w = weight(t, i);
      ctx.font = `${w.toFixed(1)} ${SIZE}px ${SANS}`;
      return { ch, w, width: ctx.measureText(ch).width };
    });
    const total = letters.reduce((s, l) => s + l.width, 0);
    let x = (W - total) / 2;
    ctx.textBaseline = 'alphabetic';
    for (const l of letters) {
      ctx.fillStyle = `hsl(${350 - (l.w - 100) / 800 * 40}, 75%, ${62 - (l.w - 100) / 800 * 38}%)`; // heavier = deeper
      glyph(ctx, l.ch, x, 1000, l.w, SIZE);
      x += l.width;
    }
    // the same axis on one big glyph pair, and a slider that reads its value
    const w = weight(t, 3);
    ctx.fillStyle = '#2A1630'; ctx.textAlign = 'center';
    glyph(ctx, 'Aa', W / 2, 1450, w, 300);
    const k = (w - 100) / 800, sx = 220, sw = 640;
    ctx.fillStyle = 'rgba(42, 22, 48, 0.15)'; ctx.beginPath(); ctx.roundRect(sx, 1560, sw, 10, 5); ctx.fill();
    ctx.fillStyle = '#E2456B'; ctx.beginPath(); ctx.roundRect(sx, 1560, sw * k + 5, 10, 5); ctx.fill();
    ctx.beginPath(); ctx.arc(sx + sw * k, 1565, 22, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2A1630'; ctx.font = `600 40px ${FONT.mono}`;
    ctx.textAlign = 'left'; ctx.fillText('wght', sx, 1650);
    ctx.textAlign = 'right'; ctx.fillText(String(Math.round(w)), sx + sw, 1650);
  },
};
