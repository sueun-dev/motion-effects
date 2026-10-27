// Swiss poster: a 6-column modular grid (160 px units) with a red block, a black circle, rules and big Helvetica.
// The layout steps through four arrangements; every element slides exactly from grid cell to grid cell.
import { FONT, ease, span } from '../lib/util.js';

const U = 160, X0 = 60, Y0 = 300;
const RED = '#E2231A', INK = '#111111';
// four layouts per element, in grid units; the fifth (t = 5) is the first again
const LAYOUT = { // blocks live in the top half, type in the bottom half
  red: [[0, 0, 4, 4], [2, 0, 4, 4], [0, 1, 6, 3], [3, 0, 3, 5]],
  circle: [[4, 0, 2, 2], [0, 2, 2, 2], [4, 3, 2, 2], [0, 0, 2, 2]],
  bar: [[0, 4.4, 6, 0.12], [0, 4.4, 3, 0.12], [3, 0.4, 3, 0.12], [0, 4.4, 2, 0.12]],
  swiss: [[0, 5.0], [1, 5.0], [0, 5.4], [0, 5.0]],
  style: [[0, 6.4], [0, 6.4], [1, 6.8], [2, 6.4]],
  note: [[4, 6.75], [0, 8.4], [0, 8.6], [0, 8.4]],
};
const MOVES = [0.6, 1.8, 3.0, 4.2]; // a slide starts at each of these times (the last one ends before 5 s)

function at(key, t, i) {
  const L = LAYOUT[key];
  let s = L[0].slice();
  MOVES.forEach((m, k) => {
    const e = ease.inOut(span(t, m + i * 0.05, m + i * 0.05 + 0.45));
    const a = L[k], b = L[(k + 1) % 4];
    if (e > 0) s = s.map((_, j) => a[j] + (b[j] - a[j]) * e);
  });
  const [gx, gy, gw = 0, gh = 0] = s; // grid units -> pixels
  return [X0 + gx * U, Y0 + gy * U, gw * U, gh * U];
}

export default {
  name: 'Swiss Style',
  ko: '스위스 스타일',
  draw(ctx, t, W, H) {
    ctx.fillStyle = '#F1EEE8'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)'; ctx.lineWidth = 2; // the grid itself, faint
    ctx.beginPath();
    for (let c = 0; c <= 6; c++) { ctx.moveTo(X0 + c * U, Y0); ctx.lineTo(X0 + c * U, Y0 + 10 * U); }
    for (let r = 0; r <= 10; r++) { ctx.moveTo(X0, Y0 + r * U); ctx.lineTo(X0 + 6 * U, Y0 + r * U); }
    ctx.stroke();

    let [x, y, w, h] = at('red', t, 0);
    ctx.fillStyle = RED; ctx.fillRect(x, y, w, h);
    [x, y, w, h] = at('circle', t, 1);
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, w / 2, 0, Math.PI * 2); ctx.fill();
    [x, y, w, h] = at('bar', t, 2);
    ctx.fillRect(x, y, w, h);

    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.font = `700 260px ${FONT.sans}`; ctx.letterSpacing = '-10px';
    [x, y] = at('swiss', t, 3); ctx.fillText('Swiss', x - 12, y + 192);
    [x, y] = at('style', t, 4); ctx.fillText('Style', x - 12, y + 192);
    ctx.letterSpacing = '0px';
    [x, y] = at('note', t, 5);
    ctx.font = `700 34px ${FONT.sans}`; ctx.fillText('International', x, y + 40);
    ctx.font = `400 34px ${FONT.sans}`;
    ctx.fillText('Typographic Style', x, y + 82); ctx.fillText('Zürich  1957', x, y + 124);
  },
};
