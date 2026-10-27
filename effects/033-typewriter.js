// Typewriter: letters are struck onto the paper one at a time (with a little human timing and a fixed, slightly
// uneven baseline per letter) and a cursor follows; when typing pauses the cursor breathes instead of blinking.
import { TAU, clamp, rng, smoothstep } from '../lib/util.js';

const FONT_TW = '"American Typewriter", "Courier New", monospace';
const LINES = ['Hello, world.', 'Every story', 'starts with', 'one letter.'];
const X0 = 175, Y0 = 800, LEAD = 140, SIZE = 94, TOP = 560, BOTTOM = 1420;
const KEYS = (() => { // when each letter is struck, its baseline nudge and ink
  const r = rng(42), out = [];
  let time = 0.35;
  LINES.forEach((line, row) => [...line].forEach((ch, col) => {
    if (row && !col) time += 0.12; // carriage return
    out.push({ ch, row, col, at: time, dy: (r() - 0.5) * 5, rot: (r() - 0.5) * 0.04, ink: 0.75 + 0.25 * r() });
    time += (ch === ' ' ? 0.04 : 0.055) + r() * 0.03;
  }));
  return out;
})();

export default {
  name: 'Typewriter',
  ko: '타자기 효과',
  draw(ctx, t, W, H) {
    const desk = ctx.createLinearGradient(0, 0, 0, H);
    desk.addColorStop(0, '#2B1E17'); desk.addColorStop(1, '#140D09');
    ctx.fillStyle = desk; ctx.fillRect(0, 0, W, H);
    ctx.save(); // the sheet of paper, with a soft shadow, a red margin and faint rules
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 24;
    ctx.fillStyle = '#F6EEDC'; ctx.fillRect(100, TOP, 880, BOTTOM - TOP);
    ctx.restore();
    ctx.fillStyle = 'rgba(70, 110, 170, 0.16)';
    for (let k = -1; k < 5; k++) ctx.fillRect(100, Y0 + 26 + k * LEAD, 880, 2);
    ctx.fillStyle = 'rgba(220, 70, 70, 0.45)'; ctx.fillRect(146, TOP, 3, BOTTOM - TOP);

    const fade = 1 - smoothstep(4.3, 4.75, t); // the page clears at the end of the loop
    ctx.font = `400 ${SIZE}px ${FONT_TW}`;
    ctx.textBaseline = 'alphabetic';
    let cx = X0, cy = Y0, last = -9;
    for (const k of KEYS) {
      const x = X0 + ctx.measureText(LINES[k.row].slice(0, k.col)).width, y = Y0 + k.row * LEAD;
      if (t < k.at) break;
      const s = 1 + 0.3 * Math.exp(-(t - k.at) * 30);   // struck: a quick settle from slightly larger
      ctx.save();
      ctx.translate(x, y + k.dy); ctx.rotate(k.rot); ctx.scale(s, s);
      ctx.fillStyle = `rgba(28, 22, 40, ${k.ink * fade})`;
      ctx.fillText(k.ch, 0, 0);
      ctx.restore();
      cx = x + ctx.measureText(k.ch).width; cy = y; last = k.at;
    }
    if (t > 4.75) { cx = X0; cy = Y0; }                           // back to the top for the next loop
    const shown = t < 4.75 ? fade : smoothstep(4.75, 5, t);
    const busy = 1 - smoothstep(0.25, 0.5, t - last);             // solid while typing ...
    const breathe = 0.55 + 0.45 * Math.cos(TAU * t);              // ... otherwise it fades in and out smoothly
    ctx.fillStyle = `rgba(230, 80, 60, ${clamp(busy + (1 - busy) * breathe) * shown})`;
    ctx.fillRect(cx + 6, cy - SIZE * 0.72, 7, SIZE * 0.86);
  },
};
