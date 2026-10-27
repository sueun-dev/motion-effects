// Memphis design: flat pastel shapes, black dot grids, zigzags, squiggles and striped fills. Each piece floats
// on its own small looping orbit and turns (whole turns or a sway), and the squiggle's wave travels along it.
import { TAU, phase, rng } from '../lib/util.js';

const INK = '#141414';

const DRAW = {
  circle(c, s, col) { c.fillStyle = INK; c.beginPath(); c.arc(14, 14, s, 0, TAU); c.fill(); c.fillStyle = col; c.beginPath(); c.arc(0, 0, s, 0, TAU); c.fill(); },
  stripeHalf(c, s, col) {
    c.save(); c.beginPath(); c.arc(0, 0, s, Math.PI, TAU); c.closePath(); c.fillStyle = col; c.fill(); c.clip();
    c.fillStyle = INK; for (let x = -s; x < s; x += 44) c.fillRect(x, -s, 16, s);
    c.restore();
  },
  dots(c, s) { c.fillStyle = INK; for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { c.beginPath(); c.arc((i - 2) * s / 2.5, (j - 2) * s / 2.5, 9, 0, TAU); c.fill(); } },
  zigzag(c, s, col) { c.strokeStyle = col; c.lineWidth = 22; c.beginPath(); for (let i = 0; i <= 8; i++) c.lineTo(-s / 2 + i * s / 8, i % 2 ? -34 : 34); c.stroke(); },
  triangle(c, s, col) { c.strokeStyle = col; c.lineWidth = 18; c.beginPath(); for (let i = 0; i < 3; i++) c.lineTo(s * Math.cos(i * TAU / 3 - Math.PI / 2), s * Math.sin(i * TAU / 3 - Math.PI / 2)); c.closePath(); c.stroke(); },
  triFill(c, s, col) { c.fillStyle = col; c.beginPath(); for (let i = 0; i < 3; i++) c.lineTo(s * Math.cos(i * TAU / 3), s * Math.sin(i * TAU / 3)); c.fill(); },
  ring(c, s, col) { c.strokeStyle = col; c.lineWidth = 26; c.beginPath(); c.arc(0, 0, s, 0, TAU); c.stroke(); },
  plus(c, s, col) { c.fillStyle = col; c.fillRect(-s, -s / 4, 2 * s, s / 2); c.fillRect(-s / 4, -s, s / 2, 2 * s); },
  stripeRect(c, s, col) {
    c.save(); c.fillStyle = col; c.beginPath(); c.rect(-s, -s * 0.6, 2 * s, 1.2 * s); c.fill(); c.clip();
    c.strokeStyle = INK; c.lineWidth = 12; c.beginPath();
    for (let x = -3 * s; x < 3 * s; x += 46) { c.moveTo(x, -s); c.lineTo(x + 2 * s, s); }
    c.stroke(); c.restore();
  },
};

// type, x, y, size, colour, whole turns per loop, sway (radians), orbit radius, phase
const PIECES = [
  ['circle', 520, 1060, 230, '#FFC94A', 0, 0, 18, 0],
  ['stripeHalf', 600, 1230, 210, '#4F86F7', 0, 0.22, 24, 1.5],
  ['dots', 270, 820, 170, '', 0, 0.25, 30, 2.2],
  ['zigzag', 740, 560, 330, '#FF5FA2', 0, 0.35, 34, 3.1],
  ['triangle', 830, 1480, 150, '#7B5CFA', 1, 0, 30, 4.0],
  ['ring', 260, 500, 85, '#FF7A59', 0, 0, 36, 0.7],
  ['triFill', 190, 1230, 120, '#22B8A7', -1, 0, 30, 5.2],
  ['plus', 870, 890, 66, INK, 1, 0, 28, 2.8],
  ['stripeRect', 300, 1710, 150, '#FF9EC7', 0, 0.3, 26, 1.1],
  ['dots', 860, 1760, 120, '', 0, 0.3, 22, 3.6],
  ['circle', 880, 360, 60, '#22B8A7', 0, 0, 30, 4.4],
];

export default {
  name: 'Memphis Design',
  ko: '멤피스 디자인',
  draw(ctx, t, W, H) {
    const a = phase(t) * TAU;
    ctx.fillStyle = '#FFF3E3'; ctx.fillRect(0, 0, W, H);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    const r = rng(9); // confetti dashes drifting on small loops
    for (let i = 0; i < 26; i++) {
      const x = r() * W, y = 300 + r() * (H - 340), q = r() * TAU, col = ['#FF5FA2', '#4F86F7', '#FFC94A', '#22B8A7', INK][i % 5];
      ctx.save(); ctx.translate(x + 14 * Math.cos(a + q), y + 14 * Math.sin(a + q)); ctx.rotate(q + 0.5 * Math.sin(a + q));
      ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(-22, -7, 44, 14, 7); ctx.fill();
      ctx.restore();
    }

    for (const [type, x, y, s, col, turns, sway, orbit, q] of PIECES) {
      ctx.save();
      ctx.translate(x + orbit * Math.cos(a + q), y + orbit * Math.sin(a + q));
      ctx.rotate(turns * a + sway * Math.sin(a + q));
      DRAW[type](ctx, s, col);
      ctx.restore();
    }

    ctx.save(); // the squiggle: its wave travels along it, one wavelength per loop
    ctx.translate(440, 1530); ctx.rotate(-0.15 + 0.08 * Math.sin(a));
    ctx.strokeStyle = '#19B5A5'; ctx.lineWidth = 22;
    ctx.beginPath();
    for (let x = -200; x <= 200; x += 6) ctx.lineTo(x, 40 * Math.sin(x / 400 * 3 * TAU - a));
    ctx.stroke();
    ctx.restore();
  },
};
