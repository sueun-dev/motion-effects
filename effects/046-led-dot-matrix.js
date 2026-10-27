// LED dot matrix: messages in a 5x7 bitmap font scroll across a grid of round LEDs. The scroll position is
// fractional, and each LED eases between the two font columns it sits between, so LEDs dim in and out softly.
import { phase, FONT, canvas } from '../lib/util.js';

const GLYPHS = {
  A: '01110 10001 10001 11111 10001 10001 10001', C: '01110 10001 10000 10000 10000 10001 01110',
  D: '11110 10001 10001 10001 10001 10001 11110', G: '01110 10001 10000 10111 10001 10001 01111', E: '11111 10000 10000 11110 10000 10000 11111',
  H: '10001 10001 10001 11111 10001 10001 10001', I: '01110 00100 00100 00100 00100 00100 01110',
  L: '10000 10000 10000 10000 10000 10000 11111', M: '10001 11011 10101 10101 10001 10001 10001',
  N: '10001 11001 10101 10011 10001 10001 10001', O: '01110 10001 10001 10001 10001 10001 01110', P: '11110 10001 10001 11110 10000 10000 10000',
  R: '11110 10001 10001 11110 10100 10010 10001', S: '01111 10000 10000 01110 00001 00001 11110',
  T: '11111 00100 00100 00100 00100 00100 00100', W: '10001 10001 10001 10101 10101 10101 01010',
  X: '10001 10001 01010 00100 01010 10001 10001', '♥': '01010 11111 11111 11111 01110 00100 00000',
};
// a message as a list of columns, each column 7 booleans (top to bottom)
function columns(text) {
  const cols = [];
  for (const ch of text) {
    if (ch === ' ') { cols.push(...Array.from({ length: 3 }, () => Array(7).fill(0))); continue; }
    const rows = GLYPHS[ch].split(' ');
    for (let c = 0; c < 5; c++) cols.push(rows.map(r => +r[c]));
    cols.push(Array(7).fill(0));
  }
  return cols;
}

// message, LED colour, dim colour. Each scrolls one full message length per loop, so short messages keep
// the scroll slow (about 0.3 LED per frame) and every LED fades over several frames instead of popping.
// The rows are a third of a column out of step, so their LEDs do not all change on the same frame.
const LINES = [
  [columns('HELLO ♥ '), '#FF4A2E', '#3A1410', 0],
  [columns('LED SIGN '), '#FFB020', '#3A2A10', 1 / 3],
  [columns('SMOOTH ♥ '), '#38F59A', '#0F3324', 2 / 3],
];
const NC = 30, PITCH = 33, R = 12.5, X0 = (1080 - (NC - 1) * PITCH) / 2, Y0 = 1100 - 13 * PITCH;
let halos;

export default {
  name: 'LED Dot Matrix',
  ko: 'LED 전광판',
  setup() {
    halos = LINES.map(([, on]) => { // soft glow sprite per colour, added with 'lighter'
      const c = canvas(120, 120), g = c.getContext('2d'), grd = g.createRadialGradient(60, 60, 8, 60, 60, 60);
      grd.addColorStop(0, on + 'AA'); grd.addColorStop(1, on + '00');
      g.fillStyle = grd; g.fillRect(0, 0, 120, 120);
      return c;
    });
  },
  draw(ctx, t, W, H) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1A1C22'); bg.addColorStop(1, '#08090C');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#050506';
    ctx.beginPath(); ctx.roundRect(X0 - 50, Y0 - 50, (NC - 1) * PITCH + 100, 26 * PITCH + 100, 30); ctx.fill();
    ctx.strokeStyle = '#2C2F38'; ctx.lineWidth = 8; ctx.stroke();

    const lit = [];
    LINES.forEach(([cols, on, off, lag], li) => {
      const s = phase(t) * cols.length + lag; // scroll position in columns
      for (let c = 0; c < NC; c++) {
        const m = c + s, i = Math.floor(m), k = 0.5 - 0.5 * Math.cos(Math.PI * (m - i)); // eased cross-fade
        const a = cols[i % cols.length], b = cols[(i + 1) % cols.length];
        for (let r = 0; r < 7; r++) {
          const v = a[r] * (1 - k) + b[r] * k; // brightness 0..1
          const x = X0 + c * PITCH, y = Y0 + (li * 9 + 1 + r) * PITCH;
          ctx.fillStyle = off; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
          if (v > 0.01) {
            ctx.globalAlpha = v; ctx.fillStyle = on;
            ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
            lit.push([x, y, v, li]);
          }
        }
      }
    });
    ctx.globalCompositeOperation = 'lighter'; // glow and a small hot spot on top of every lit LED
    for (const [x, y, v, li] of lit) {
      ctx.globalAlpha = v;
      ctx.drawImage(halos[li], x - 60, y - 60);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'; ctx.beginPath(); ctx.arc(x - 3, y - 3, R * 0.45, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'; ctx.font = `600 36px ${FONT.mono}`; ctx.textAlign = 'center';
    ctx.fillText('● LIVE', W / 2, Y0 + 26 * PITCH + 120);
  },
};
