// Pixel sorting: in every column, each run of bright pixels plus a stretch below it is sorted by brightness
// (bright on top), so the sky and sun drip down over the hills in streaks; the drip length swells and shrinks.
import { TAU, phase, canvas, noise3, loop } from '../lib/util.js';
import { landscape } from '../lib/scenes.js';

const SW = 540, SH = 960, TH = 150; // sorted at half size, then scaled up; TH = brightness that starts a run
const src = canvas(SW, SH), sg = src.getContext('2d', { willReadFrequently: true });

export default {
  name: 'Pixel Sorting',
  ko: '픽셀 소팅',
  draw(ctx, t, W, H) {
    landscape(sg, SW, SH, t);
    const img = sg.getImageData(0, 0, SW, SH), px = new Uint32Array(img.data.buffer);
    const keys = new Uint32Array(SH), lum = new Uint8Array(SH);
    const [lx, ly] = loop(t, 0.8), grow = 0.3 + 0.7 * (0.5 - 0.5 * Math.cos(phase(t) * TAU));
    for (let x = 0; x < SW; x++) {
      const n = 0.5 + 0.5 * noise3(x * 0.025 + lx, ly, 3.7), jag = 0.5 + 0.5 * Math.sin(x * 12.9898) * Math.sin(x * 4.1414);
      const drip = Math.round(SH * 0.42 * grow * (0.25 + 0.5 * n + 0.25 * jag)); // how far this column melts
      for (let y = 0; y < SH; y++) {
        const c = px[y * SW + x], r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255;
        lum[y] = (r * 77 + g * 150 + b * 29) >> 8;
        keys[y] = ((lum[y] << 24) | (r << 16) | (g << 8) | b) >>> 0; // sort key: brightness first, then colour
      }
      for (let y = 0; y < SH;) {
        if (lum[y] <= TH) { y++; continue; }
        let end = y;
        while (end < SH && lum[end] > TH) end++;
        end = Math.min(SH, end + drip);
        const run = keys.subarray(y, end).sort(), n2 = run.length;
        for (let k = 0; k < n2; k++) {
          const v = run[n2 - 1 - k]; // brightest first
          px[(y + k) * SW + x] = 0xff000000 | (v & 255) << 16 | ((v >>> 8) & 255) << 8 | ((v >>> 16) & 255);
        }
        y = end;
      }
    }
    sg.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(src, 0, 0, W, H);
  },
};
