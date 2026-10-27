// Mask (line) reveal: every line of type sits in its own clipping box, so it can only be seen above an invisible
// baseline; the lines rise into view one after another, hold, then keep rising out through the top of their boxes.
import { TAU, clamp, ease, FONT } from '../lib/util.js';

const LINES = [['EVERY', '#1B1530'], ['LINE', '#1B1530'], ['RISES', '#FF5A36'], ['IN TURN', '#1B1530']];
const SIZE = 210, LH = 230, TOP = 700; // font size, line height, baseline of the first line

export default {
  name: 'Mask Reveal',
  ko: '마스크 리빌',
  draw(ctx, t, W, H) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#F7EFE3'); bg.addColorStop(1, '#EBDCCB');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255, 90, 54, 0.12)';
    ctx.beginPath(); ctx.arc(820, 1500, 360 + 20 * Math.sin(TAU * t / 5), 0, TAU); ctx.fill();

    ctx.font = `800 ${SIZE}px ${FONT.sans}`;
    ctx.textBaseline = 'alphabetic';
    LINES.forEach(([text, colour], i) => {
      const base = TOP + i * LH;
      const up = ease.out(clamp((t - 0.15 - i * 0.2) / 0.7));       // rise into view ...
      const away = ease.in(clamp((t - 3.65 - i * 0.17) / 0.6));      // ... and on out of the top
      const y = base + LH * (1 - up) - LH * away;
      ctx.save();
      ctx.beginPath(); ctx.rect(0, base - SIZE * 0.82, W, LH - 4); ctx.clip(); // the invisible window for this line
      ctx.fillStyle = colour;
      ctx.fillText(text, 110, y);
      ctx.restore();
    });
  },
};
