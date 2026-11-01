// Penrose rhombus tiling (P3) by substitution. Start from a wheel of ten Robinson half-tiles; each step splits
// every thin half-tile into 2 and every thick one into 3 at points 1/φ along an edge, so the tiles shrink by
// φ and a thick + thin rhombus pattern with fivefold symmetry appears (halves are filled, their two legs are
// outlined, so rhombi show). The loop splits generation 4 into 5 and 6 (deflation), then merges them back
// (inflation). Each step sweeps out from the centre as a wave: the edges that change light up gold and the
// colours cross-fade between a tile and its parent, while a slow colour wave rolls outward.
import { TAU, smoothstep } from '../lib/util.js';

const PHI = (1 + Math.sqrt(5)) / 2, CX = 540, CY = 1100, S0 = 1300, START = 0.8;
const gens = [];                                      // gens[g] = [{ col, a, b, c, parent }], points as [x, y]

function substitute() {
  let tris = [];
  for (let i = 0; i < 10; i++) {                       // the wheel: ten thin half-tiles round the origin
    let b = [Math.cos((2 * i - 1) * Math.PI / 10), Math.sin((2 * i - 1) * Math.PI / 10)];
    let c = [Math.cos((2 * i + 1) * Math.PI / 10), Math.sin((2 * i + 1) * Math.PI / 10)];
    if (i % 2 === 0) [b, c] = [c, b];
    tris.push({ col: 0, a: [0, 0], b, c, parent: -1 });
  }
  gens.push(tris);
  const at = (p, q, k) => [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
  for (let g = 1; g <= 6; g++) {
    tris = gens[g - 1].flatMap(({ col, a, b, c }, parent) => {
      if (col === 0) { const p = at(a, b, 1 / PHI); return [{ col: 0, a: c, b: p, c: b, parent }, { col: 1, a: p, b: c, c: a, parent }]; }
      const q = at(b, a, 1 / PHI), r = at(b, c, 1 / PHI);
      return [{ col: 1, a: r, b: c, c: a, parent }, { col: 1, a: q, b: r, c: b, parent }, { col: 0, a: r, b: q, c: a, parent }];
    });
    gens.push(tris);
  }
}

// tile colour: thin rhombi gold to coral, thick ones teal to blue, shaded by their direction on screen and a
// slow colour wave that rolls outward
function tint(col, ang, r, t) {
  const shade = 0.5 + 0.5 * Math.cos(2 * ang), wave = 0.5 + 0.5 * Math.cos(r / 260 - TAU * 2 * t / 5);
  if (col === 0) return [242 - 20 * wave, 178 - 70 * shade * wave - 20 * wave, 74 + 30 * shade];
  return [24 + 40 * shade, 96 + 40 * wave - 20 * shade, 128 + 60 * shade + 30 * wave];
}

export default {
  name: 'Penrose Tiling',
  ko: '펜로즈 타일링',
  setup() { substitute(); },
  draw(ctx, time, W, H) {
    ctx.fillStyle = '#0B1120'; ctx.fillRect(0, 0, W, H);
    const t = (time + START) % 5;                      // the video starts mid-split, so the loop seam is in motion
    // cycle: split 4 -> 5 -> 6 (deflation), hold, merge back 6 -> 5 -> 4 (inflation); w = share of the finer tiles
    const front = (p, r) => smoothstep(0, 1, p * 1.8 - r / 1600);   // a wave from the centre outward
    let k = 4, wave = () => 0;
    if (t < 0.3) wave = () => 0;
    else if (t < 1.3) wave = r => front(t - 0.3, r);
    else if (t < 2.3) { k = 5; wave = r => front(t - 1.3, r); }
    else if (t < 2.8) { k = 5; wave = () => 1; }
    else if (t < 3.8) { k = 5; wave = r => 1 - front(t - 2.8, r); }
    else if (t < 4.8) wave = r => 1 - front(t - 3.8, r);
    const P = p => [CX + S0 * p[0], CY - S0 * p[1]];
    const fine = gens[k + 1], coarse = gens[k];
    const cen = ({ a, b, c }) => [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3];
    const tri = (x) => [P(x.a), P(x.b), P(x.c)];
    const colourOf = (x, r) => {
      const s = tri(x), ang = Math.atan2(s[0][1] - (s[1][1] + s[2][1]) / 2, s[0][0] - (s[1][0] + s[2][0]) / 2);
      return tint(x.col, ang, r, t);
    };
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const glow = [];
    for (const x of fine) {                           // fill the fine half-tiles; colour fades from their parent's
      const pc = P(cen(x)), r = Math.hypot(pc[0] - CX, pc[1] - CY), w = wave(r);
      const c0 = colourOf(coarse[x.parent], r), c1 = colourOf(x, r);
      const c = c0.map((v, i) => Math.round(v + (c1[i] - v) * w));
      const [a, b, cc] = tri(x);
      ctx.fillStyle = ctx.strokeStyle = `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
      ctx.lineWidth = 1;                                // covers the hairline seam between the two halves
      ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.lineTo(...cc); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (w > 0) glow.push([a, b, cc, w]);
    }
    const legs = (a, b, c) => { ctx.beginPath(); ctx.moveTo(...c); ctx.lineTo(...a); ctx.lineTo(...b); ctx.stroke(); };
    ctx.strokeStyle = '#0B1120'; ctx.lineWidth = 4;
    for (const x of coarse) {                         // outlines of the coarse rhombi fade as the wave passes
      const pc = P(cen(x)), w = wave(Math.hypot(pc[0] - CX, pc[1] - CY));
      if (w >= 1) continue;
      ctx.globalAlpha = 1 - w; legs(...tri(x));
    }
    for (const [a, b, c, w] of glow) { ctx.globalAlpha = w; legs(a, b, c); }   // and the fine ones fade in
    ctx.strokeStyle = '#FFE7A3'; ctx.lineWidth = 3;   // a gold flash rides the substitution front
    for (const [a, b, c, w] of glow) {
      const flash = 4 * w * (1 - w);
      if (flash > 0.02) { ctx.globalAlpha = flash; legs(a, b, c); }
    }
    ctx.globalAlpha = 1;
  },
};
