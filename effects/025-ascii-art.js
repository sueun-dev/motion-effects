// ASCII art (the classic donut.c): points on a spinning torus are projected into a grid of text cells with a
// depth buffer; each cell's lighting picks a character from ".,-~:;=!*#$@", sparse to dense.
import { TAU, phase, lerp, FONT } from '../lib/util.js';

const CW = 18, CH = 30, COLS = 60, ROWS = 64, CHARS = '.,-~:;=!*#$@';
const R1 = 1, R2 = 2, K2 = 8, K1 = 1240, CY = 1010;
const RAMP = [[70, 46, 160], [232, 87, 122], [255, 179, 107], [255, 244, 214]]; // dark side -> lit side

function colour(k) { // k 0..1 along the ramp
  const x = k * (RAMP.length - 1), i = Math.min(Math.floor(x), RAMP.length - 2), f = x - i;
  return RAMP[i].map((v, c) => Math.round(lerp(v, RAMP[i + 1][c], f)));
}

export default {
  name: 'ASCII Art',
  ko: '아스키 아트',
  draw(ctx, t, W, H) {
    const bg = ctx.createRadialGradient(W / 2, CY, 100, W / 2, CY, 1100);
    bg.addColorStop(0, '#1A1530'); bg.addColorStop(1, '#07060D');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    const A = phase(t) * TAU, B = phase(t) * TAU * 2;   // two spins, both loop in 5 s
    const cA = Math.cos(A), sA = Math.sin(A), cB = Math.cos(B), sB = Math.sin(B);
    const depth = new Float32Array(COLS * ROWS), light = new Float32Array(COLS * ROWS).fill(-9);
    for (let th = 0; th < TAU; th += 0.03) {
      const ct = Math.cos(th), st = Math.sin(th);
      for (let ph = 0; ph < TAU; ph += 0.01) {
        const cp = Math.cos(ph), sp = Math.sin(ph);
        const cx = R2 + R1 * ct, cy = R1 * st;          // a point of the tube's circle, swept around the axis
        const x = cx * (cB * cp + sA * sB * sp) - cy * cA * sB;
        const y = cx * (sB * cp - sA * cB * sp) + cy * cA * cB;
        const ooz = 1 / (K2 + cA * cx * sp + cy * sA);
        const col = Math.floor((W / 2 + K1 * ooz * x) / CW), row = Math.floor((CY - K1 * ooz * y) / CH);
        if (col < 0 || col >= COLS || row < 0 || row >= ROWS) continue;
        const i = row * COLS + col;
        if (ooz <= depth[i]) continue;
        depth[i] = ooz;
        light[i] = cp * ct * sB - cA * ct * sp - sA * st + cB * (cA * st - ct * sA * sp); // -1.41 .. 1.41
      }
    }
    ctx.font = `700 ${CH}px ${FONT.mono}`;
    ctx.textBaseline = 'top';
    for (let i = 0; i < light.length; i++) {
      if (light[i] < -8) continue;
      const k = Math.min(1, Math.max(0, light[i] / 2.83 + 0.5)) ** 1.7;
      const [r, g, b] = colour(k);
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillText(CHARS[Math.round(k * (CHARS.length - 1))], (i % COLS) * CW, Math.floor(i / COLS) * CH);
    }
  },
};
