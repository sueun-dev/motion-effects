// Disintegration: a photo is cut into 6 px cells; each cell has a start time (a sweep from the right plus fixed noise).
// Its age = clock - start, and its flight is a closed-form function of age (wind + swirl), so the clock running back
// to 0 rewinds the dust into the picture. Intact cells are drawn straight from the photo through a cell-sized mask.
import { TAU, clamp, smoothstep, span, noise3, rng } from '../lib/util.js';
import { landscape } from '../lib/scenes.js';

const X0 = 150, Y0 = 380, PW = 780, PH = 1080, CELL = 6, GW = PW / CELL, GH = PH / CELL, SWEEP = 1.7, FLY = 1.7;
const sine = k => 0.5 - 0.5 * Math.cos(Math.PI * k);
let photo = null, mask = null, maskCtx = null, maskData = null, cells = [];

// the global clock: still, dissolve to the right, then rewind while the last dust is still in the air, still again
const clock = t => 2.4 * (span(t, 1.2, 3.2) - sine(span(t, 3.3, 4.85)));

export default {
  name: 'Disintegration',
  ko: '디스인티그레이션',
  setup() {
    photo = document.createElement('canvas'); photo.width = PW; photo.height = PH;
    const p = photo.getContext('2d');
    p.fillStyle = '#FBF8F2'; p.fillRect(0, 0, PW, PH); // a polaroid: white frame, picture inside
    const pic = document.createElement('canvas'); pic.width = PW - 60; pic.height = PH - 200;
    landscape(pic.getContext('2d'), pic.width, pic.height, 0);
    p.drawImage(pic, 30, 30);
    const px = p.getImageData(0, 0, PW, PH).data, r = rng(83);
    for (let j = 0; j < GH; j++) {
      for (let i = 0; i < GW; i++) {
        const k = ((j * CELL + 3) * PW + i * CELL + 3) * 4, n = noise3(i * 0.06, j * 0.06, 3.7);
        cells.push({
          i, j, start: clamp((1 - i / GW) * 0.8 + 0.25 * n + 0.1 * r()) * SWEEP, col: `rgb(${px[k]}, ${px[k + 1]}, ${px[k + 2]})`,
          vx: 95 + 70 * noise3(i * 0.08, j * 0.08, 1) + 20 * r(), vy: -45 + 60 * noise3(i * 0.08, j * 0.08, 2) + 20 * r(),
          sw: noise3(i * 0.05, j * 0.05, 4) * 6 + r(), // a smooth wind field (neighbours drift together) plus a little scatter
          dust: r() < 0.3, // only some cells fly off as grains, the rest just vanish
        });
      }
    }
    mask = document.createElement('canvas'); mask.width = GW; mask.height = GH;
    maskCtx = mask.getContext('2d');
    maskData = maskCtx.createImageData(GW, GH);
  },
  draw(ctx, t, W, H) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1C2035'); bg.addColorStop(1, '#3A2F4E');

    const c = clock(t);
    for (let n = 0; n < cells.length; n++) maskData.data[n * 4 + 3] = c > cells[n].start ? 0 : 255;
    maskCtx.putImageData(maskData, 0, 0);
    ctx.save(); // the intact part: photo cut by the mask (scaled up without smoothing, so cells stay square)
    ctx.drawImage(photo, X0, Y0);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(mask, X0, Y0, PW, PH);
    ctx.restore();
    ctx.globalCompositeOperation = 'destination-over'; // destination-in cleared the rest: background goes behind
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';

    for (const p of cells) { // the dust
      const a = c - p.start;
      if (!p.dust || a <= 0 || a >= FLY) continue;
      const e = a * a;
      const x = X0 + p.i * CELL + p.vx * a + 45 * e + 18 * Math.sin(p.sw + 3 * a) * a;
      const y = Y0 + p.j * CELL + p.vy * a - 25 * e + 18 * Math.cos(p.sw + 2 * a) * a;
      const s = CELL * (1 - 0.5 * smoothstep(0, FLY, a));
      ctx.globalAlpha = 1 - smoothstep(0, FLY * 0.85, a);
      ctx.fillStyle = p.col;
      ctx.fillRect(x, y, s, s);
    }
    ctx.globalAlpha = 1;
  },
};
