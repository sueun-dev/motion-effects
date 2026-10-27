// Pixel art: the scene is drawn on a 135x240 canvas in whole pixels and scaled up 8x with no smoothing. Layers
// scroll at whole-pixel speeds (parallax), the hero has a 4-frame run cycle and jumps every crate.
import { canvas } from '../lib/util.js';

const LW = 135, LH = 240, S = 8, GROUND = 178, HX = 34; // hero's left edge on screen
const C = { K: '#22163A', R: '#EF476F', W: '#FFFFFF', S: '#FFD0A6', B: '#3D6BE6', b: '#2A45A8', N: '#6B3A22', Y: '#FFD23F', y: '#E89A1E' };
const HERO = [ // head and body, facing right; legs and arms are drawn per frame
  '...KKKKK....',
  '..KRRRRRKK..',
  '.KRRRRRWWRK.',
  '.KRRRRRRRRRK',
  '.KNNSSSSSKK.',
  '.KNSSSWKSK..',
  '.KSSSSSSSSK.',
  '..KSSSSSSK..',
  '..KRRRRRRK..',
  '.KRRRRRRRRK.',
  '.KRRRRRRRRK.',
  '..KBBBBBBK..',
];
const STRIDE = [[-3, 3, 0, 0], [0, 1, 0, 2], [3, -3, 0, 0], [1, 0, 2, 0]]; // back/front foot dx, back/front lift
const lo = canvas(LW, LH), g = lo.getContext('2d');
const px = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
const mod = (a, n) => ((a % n) + n) % n;

function hero(x, y, step, air) {
  HERO.forEach((row, j) => [...row].forEach((ch, i) => ch !== '.' && px(x + i, y + j, 1, 1, C[ch])));
  const [db, dfr, lb, lf] = air ? [-2, 2, 2, 2] : STRIDE[step];
  [[4, db, lb, C.b], [7, dfr, lf, C.B]].forEach(([hip, dx, lift, c]) => { // legs: 2 px wide, 3 rows, then a shoe
    for (let r = 0; r < 3; r++) px(x + hip + Math.round(dx * (r + 1) / 3), y + 12 + r - lift, 2, 1, c);
    px(x + hip + dx, y + 15 - lift, 3, 1, C.N);
  });
  const swing = air ? -3 : [2, 0, -2, 0][step]; // front arm swings against the front leg
  px(x + 5 + swing, y + 9 + (air ? -2 : 1), 2, 2, C.S);
}

function crate(x, y) {
  px(x, y, 12, 12, C.K); px(x + 1, y + 1, 10, 10, '#C97B3D');
  px(x + 1, y + 5, 10, 2, '#8E4F24');
  for (let k = 1; k < 11; k++) px(x + k, y + k, 1, 1, '#8E4F24');
}

export default {
  name: 'Pixel Art',
  ko: '픽셀 아트',
  draw(ctx, t, W, H) {
    const f = Math.round(t * 30), scroll = f * 2; // the ground moves 2 px a frame: 300 px per loop
    const sky = ['#2E2A6B', '#4B3F99', '#7656B8', '#B566B5', '#EE7E9A', '#FFB37A'];
    sky.forEach((c, k) => { // colour bands with a checkered row where they meet
      px(0, k * 22, LW, k === sky.length - 1 ? GROUND - k * 22 : 22, c);
      if (k) for (let x = 0; x < LW; x += 2) px(x, k * 22, 1, 1, sky[k - 1]);
    });
    for (let y = -14; y <= 14; y++) { const w = Math.round(Math.sqrt(196 - y * y)); px(98 - w, 62 + y, 2 * w, 1, y < -6 ? '#FFF3B0' : '#FFE17A'); }
    for (const [cx, cy, w] of [[8, 38, 18], [50, 58, 12]]) { // clouds: 0.5 px a frame, pattern every 75 px
      for (let rep = -1; rep < 2; rep++) {
        const x = mod(cx - Math.floor(f / 2), 75) + rep * 75;
        px(x, cy, w, 4, '#FBE3F0'); px(x + 3, cy - 3, w - 8, 3, '#FBE3F0'); px(x + 2, cy + 4, w - 2, 1, '#D9A8D0');
      }
    }
    for (let x = 0; x < LW; x++) { // mountains (0.5 px a frame, every 75 px) and hills (1 px a frame, every 150 px)
      const m = mod(x + Math.floor(f / 2), 75), mh = 56 - Math.abs(m - 37) * 1.3;
      px(x, GROUND - 30 - mh, 1, mh + 30, '#5B4A9E');
      if (mh > 42) px(x, GROUND - 30 - mh, 1, 3, '#E9E1FF');
      const hX = mod(x + f, 150), hh = Math.round(16 + 7 * Math.sin(hX / 150 * Math.PI * 2) + 4 * Math.sin(hX / 150 * Math.PI * 6));
      px(x, GROUND - hh, 1, hh, '#2F8F5B'); px(x, GROUND - hh, 1, 2, '#58C276');
    }
    for (let k = 0; k < 2; k++) { // two trees on the hills
      const x = mod(30 + k * 75 - f, 150) - 8;
      px(x + 3, GROUND - 26, 3, 10, C.N); px(x, GROUND - 38, 9, 13, '#1F6E45'); px(x + 2, GROUND - 41, 5, 3, '#1F6E45'); px(x + 1, GROUND - 37, 3, 3, '#3FA463');
    }
    px(0, GROUND, LW, LH - GROUND, '#8A4B2C'); // ground: grass strip and scrolling bricks
    for (let row = 0, y = GROUND + 6; y < LH; row++, y += 8) {
      px(0, y, LW, 1, '#5E2F1C');
      for (let x = -15; x < LW + 15; x += 15) px(mod(x - scroll + (row % 2) * 7, 150) - 8, y + 1, 1, 7, '#5E2F1C');
    }
    px(0, GROUND, LW, 4, '#7BD63F'); px(0, GROUND + 4, LW, 2, '#4FA83A');
    for (let x = 0; x < LW + 15; x += 5) px(mod(x - scroll, 150) - 8, GROUND - 1, 1, 1, '#7BD63F');

    // crates every 150 px; the hero jumps each one, collecting the coins above it
    const step = Math.floor(f * 0.4) % 4; // 12 run frames a second, 60 per loop
    let air = 0;
    for (let k = 0; k < 2; k++) {
      const x = mod(120 + k * 150 - scroll, 300) - 20, u = (x + 6 - (HX + 6)) / 24; // +1 .. -1 while it passes
      if (Math.abs(u) < 1) air = Math.max(air, 1 - u * u);
      crate(x, GROUND - 12);
      [-12, 0, 12].forEach((dx, c) => {
        const cxp = x + 4 + dx;
        if (cxp < HX + 8) return; // already collected
        const w = [6, 4, 2, 4][(step + c) % 4];
        const cy = GROUND - 47 + Math.abs(dx) * 0.6;
        px(cxp + 3 - w / 2, cy, w, 8, C.y); px(cxp + 4 - w / 2, cy + 1, Math.max(1, w - 2), 6, C.Y);
      });
    }
    const hy = GROUND - 16 - Math.round(38 * air);
    px(HX + 2 + Math.round(2 * air), GROUND + 1, 9 - Math.round(4 * air), 1, '#3B7F33'); // shadow
    hero(HX, hy, step, air > 0.05);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(lo, 0, 0, LW * S, LH * S);
  },
};
