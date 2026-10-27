// Bauhaus grid: 3 x 4 tiles of primary-colour circles, half circles, quarter circles and triangles. On every beat
// each tile turns its shape a quarter turn (staggered, eased), so after four beats everything is back home.
import { FONT, TAU, ease, span } from '../lib/util.js';

const C = { r: '#D8392B', y: '#F2BE22', b: '#1D4F9C', k: '#171717', w: '#EFE6D2' };
const S = 320, X0 = 60, Y0 = 400, h = S / 2;

const MOTIF = {
  quarter: c => { c.moveTo(-h, -h); c.arc(-h, -h, S, 0, Math.PI / 2); },
  half: c => { c.moveTo(-h, h); c.arc(0, h, h, Math.PI, TAU); },
  circle: c => c.arc(0, 0, h * 0.72, 0, TAU),
  tri: c => { c.moveTo(-h, h); c.lineTo(h, h); c.lineTo(-h, -h); },
  halves: c => { c.moveTo(0, -h); c.arc(0, -h, h, 0, Math.PI); c.moveTo(0, h); c.arc(0, h, h, Math.PI, TAU); },
  bars: c => { for (let i = 0; i < 3; i++) c.rect(-h, -h + i * S / 3, S, S / 6); },
};
// row by row: background, shape colour, shape, turn direction
const TILES = [
  ['y', 'k', 'quarter', 1], ['b', 'w', 'circle', 1], ['r', 'y', 'half', -1],
  ['w', 'r', 'tri', -1], ['k', 'y', 'halves', 1], ['y', 'b', 'quarter', 1],
  ['b', 'r', 'half', 1], ['w', 'k', 'bars', -1], ['r', 'w', 'quarter', -1],
  ['k', 'w', 'tri', 1], ['y', 'r', 'circle', 1], ['w', 'b', 'half', -1],
];

export default {
  name: 'Bauhaus',
  ko: '바우하우스',
  draw(ctx, t, W, H) {
    ctx.fillStyle = C.w; ctx.fillRect(0, 0, W, H);
    TILES.forEach(([bg, fg, shape, dir], i) => {
      const col = i % 3, row = Math.floor(i / 3), x = X0 + col * S, y = Y0 + row * S;
      let turn = 0;
      for (let k = 0; k < 4; k++) { // one quarter turn per beat, rippling diagonally across the grid
        const start = k * 1.25 + (col + row) * 0.09;
        turn += ease.inOut(span(t, start, start + 0.62));
      }
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, S, S); ctx.clip();
      ctx.fillStyle = C[bg]; ctx.fillRect(x, y, S, S);
      ctx.translate(x + h, y + h); ctx.rotate(dir * turn * Math.PI / 2);
      ctx.fillStyle = C[fg];
      ctx.beginPath(); MOTIF[shape](ctx); ctx.fill();
      ctx.restore();
    });
    ctx.fillStyle = C.k;
    ctx.fillRect(X0, Y0 + 4 * S + 24, 3 * S, 14);
    ctx.font = `700 120px ${FONT.display}`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('bauhaus', X0 - 6, Y0 + 4 * S + 160);
    ctx.font = `500 44px ${FONT.display}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = C.r; ctx.fillText('1919', X0 + 3 * S, Y0 + 4 * S + 150);
  },
};
