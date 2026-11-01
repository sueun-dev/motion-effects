// Conway's Game of Life (B3/S23) on a 54 x 76 torus: a Gosper glider gun fires a glider every 30 generations, the
// stream leaves the right edge and comes back on the left (the board wraps), and an eater swallows each glider.
// Pulsars, pentadecathlons and an octagon oscillate around it, among still lifes. Setup steps the board 600
// generations into its period-30 cycle; 6 generations a second make 5 s exactly one period. Each cell glows: the
// glow eases up when it is born and dies away over about half a second after it dies (a filter run over the cyclic
// history), so oscillators breathe and gliders leave violet comet tails. The colour follows the cell's age through a
// slower filter of its own, so it drifts instead of jumping.
import { FONT, canvas, lerp, smoothstep } from '../lib/util.js';

const NX = 54, NY = 76, CELL = 20, Y0 = 320, GENS = 30;
const SHAPES = {
  gun: ['........................O', '......................O.O', '............OO......OO............OO', '...........O...O....OO............OO',
    'OO........O.....O...OO', 'OO........O...O.OO....O.O', '..........O.....O.......O', '...........O...O', '............OO'],
  eater: ['OO', 'O.O', '..O', '..OO'],
  pulsar: ['..OOO...OOO', '', 'O....O.O....O', 'O....O.O....O', 'O....O.O....O', '..OOO...OOO', '',
    '..OOO...OOO', 'O....O.O....O', 'O....O.O....O', 'O....O.O....O', '', '..OOO...OOO'],
  penta: ['OOOOOOOOOO'], // ten in a row settles into a pentadecathlon (period 15)
  pentaV: ['O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
  octagon: ['...OO', '..O..O', '.O....O', 'O......O', 'O......O', '.O....O', '..O..O', '...OO'], // period 5
  beehive: ['.OO', 'O..O', '.OO'], loaf: ['.OO', 'O..O', '.O.O', '..O'], boat: ['OO', 'O.O', '.O'], // still lifes
};
// shape, x, y (cells); checked to leave the gun, the stream and the eater untouched
const PLACE = [['gun', 2, 3], ['eater', 22, 63], ['pulsar', 4, 20], ['pentaV', 25, 23], ['octagon', 43, 47],
  ['pulsar', 38, 59], ['loaf', 4, 58], ['boat', 45, 20], ['penta', 5, 69], ['beehive', 46, 6]];
// colour scale 0..1: dead (violet afterglow), just born (amber), age 1 (rose), age 2 (sky), age 3+ (teal)
const PALETTE = [[130, 95, 255], [255, 200, 110], [255, 112, 150], [110, 170, 255], [63, 214, 201]];
const RISE = 0.08, FALL = 0.2, HUE = 0.25; // filter time constants (s): glow up in ~0.2 s, gone ~0.5 s after death

const step = g => {
  const n = new Uint8Array(NX * NY);
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
    let s = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) s += g[((y + dy + NY) % NY) * NX + (x + dx + NX) % NX];
    n[y * NX + x] = s === 3 || (s === 2 && g[y * NX + x]) ? 1 : 0;
  }
  return n;
};

let gens = null, glows = null, hues = null, grid = null, glow = null;

// how alive a cell is at time t: the step between generations eased with smoothstep (6 generations a second, frames
// sit 0.4 of the way into a generation so no frame lands on a still moment)
const at = t => { const u = t / 5 * GENS + 0.4, k = Math.floor(u) % GENS; return [gens[k], gens[k + 1], smoothstep(0, 1, u - Math.floor(u))]; };

const color = p => {
  const k = Math.min(p, 1) * 4, i = Math.min(Math.floor(k), 3), f = k - i;
  return PALETTE[i].map((c, j) => Math.round(lerp(c, PALETTE[i + 1][j], f)));
};

export default {
  name: 'Game of Life',
  ko: '라이프 게임',
  setup(_, W) {
    let g = new Uint8Array(NX * NY);
    for (const [name, x0, y0] of PLACE) SHAPES[name].forEach((row, y) => [...row].forEach((c, x) => { if (c === 'O') g[(y0 + y) * NX + x0 + x] = 1; }));
    const hist = [];
    for (let i = 0; i <= 600 + GENS; i++) { if (i >= 590) hist.push(g); g = step(g); }
    if (hist[10].some((v, i) => v !== hist[10 + GENS][i])) throw new Error('board is not period 30');
    // per generation: alive and age (generations alive, capped; a dead cell keeps its last age)
    const age = new Float32Array(NX * NY);
    gens = [];
    hist.forEach((a, k) => {
      for (let i = 0; i < a.length; i++) if (a[i]) age[i] = k && hist[k - 1][i] ? Math.min(age[i] + 1, 3) : 0;
      if (k >= 10) gens.push({ alive: a, age: age.slice() });
    });
    // glow and colour: one-pole filters run frame by frame over three loops of the periodic history. The glow follows
    // a cell that comes alive quickly and one that dies slowly; the colour eases toward the age scale (0 when dead).
    // The last loop (150 frames) is kept, as bytes, so it is periodic too.
    const k = dt => 1 - Math.exp(-1 / 30 / dt), up = k(RISE), down = k(FALL), hue = k(HUE);
    const gl = new Float32Array(NX * NY), hu = new Float32Array(NX * NY);
    glows = []; hues = [];
    for (let n = 0; n < 450; n++) {
      const [A, B, f] = at((n % 150) / 30);
      for (let i = 0; i < gl.length; i++) {
        const v = lerp(A.alive[i], B.alive[i], f), age = B.alive[i] ? B.age[i] : A.age[i];
        gl[i] += (v - gl[i]) * (v > gl[i] ? up : down);
        hu[i] += (v * (0.25 + 0.25 * age) - hu[i]) * hue;
      }
      if (n >= 300) { glows.push(Uint8Array.from(gl, x => Math.round(x * 255))); hues.push(Uint8Array.from(hu, x => Math.round(x * 255))); }
    }

    grid = canvas(W, NY * CELL); // faint dots on the cell corners, drawn once
    const c = grid.getContext('2d');
    c.fillStyle = 'rgba(160, 180, 255, 0.10)';
    for (let y = 0; y <= NY; y++) for (let x = 0; x <= NX; x++) c.fillRect(x * CELL - 1, y * CELL - 1, 2, 2);
    glow = canvas(NX * 4, NY * 4);
  },
  draw(ctx, t, W, H) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0A0E1C'); bg.addColorStop(1, '#0E0A1E');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(grid, 0, Y0);

    const n = t * 30, n0 = Math.floor(n), k = n - n0, a = n0 % 150, b1 = (n0 + 1) % 150; // between stored frames
    const gc = glow.getContext('2d');
    gc.clearRect(0, 0, glow.width, glow.height);
    for (let i = 0; i < NX * NY; i++) {
      const gv = lerp(glows[a][i], glows[b1][i], k) / 255;
      if (gv < 0.01) continue;
      const [r, g, b] = color(lerp(hues[a][i], hues[b1][i], k) / 255);
      const x = (i % NX) * CELL, y = Y0 + Math.floor(i / NX) * CELL, s = 6 + 11 * gv;
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(1, 1.2 * gv)})`;
      ctx.beginPath(); ctx.roundRect(x + (CELL - s) / 2, y + (CELL - s) / 2, s, s, 3 + 2 * (1 - gv)); ctx.fill();
      gc.fillStyle = `rgba(${r}, ${g}, ${b}, ${gv})`;
      gc.fillRect((i % NX) * 4, Math.floor(i / NX) * 4, 4, 4);
    }
    ctx.save(); // soft glow: the cells at quarter size, blurred and added on top
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55; ctx.filter = 'blur(14px)';
    ctx.drawImage(glow, 0, Y0, NX * CELL, NY * CELL);
    ctx.restore();

    ctx.font = `500 26px ${FONT.mono}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(190, 200, 255, 0.55)';
    ctx.fillText('B3/S23  ·  54 × 76 TORUS  ·  GOSPER GUN → EATER  ·  PERIOD 30', W / 2, Y0 + NY * CELL + 40);
  },
};
