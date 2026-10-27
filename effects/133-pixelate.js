// Pixelate (mosaic): the picture is shrunk onto a tiny canvas and scaled back up without smoothing, so it turns into
// square blocks. The block size steps every 3 frames through sizes that grow geometrically (an ease-in curve; the
// third frame of each step is a half-way blend, so steps land softly), the scenes crossfade while the blocks are
// biggest, then the steps run back down to a sharp picture.
import { W, H, clamp, smoothstep, canvas } from '../lib/util.js';
import { landscape, city } from '../lib/scenes.js';

const A = canvas(), B = canvas();
landscape(A.getContext('2d'), W, H, 0);
city(B.getContext('2d'), W, H);
const SIZES = [1, 6, 10, 15, 24, 40, 60, 120]; // block sizes in px (each divides 1080 and 1920)
const small = canvas(), g = small.getContext('2d'); // only its top-left W/size x H/size corner is used
g.imageSmoothingQuality = 'high';

// step q (0..15) of a transition: block size 1 6 10 .. 120 .. 10 6 1 and how far the crossfade has got
const look = q => [SIZES[Math.max(0, 7 - Math.abs(q - 7))], smoothstep(3, 11, q)];

// draw step q of from -> to as a mosaic, at the given opacity
function mosaic(ctx, from, to, q, alpha) {
  const [size, mix] = look(q), w = W / size, h = H / size;
  g.globalAlpha = 1; g.drawImage(from, 0, 0, w, h);
  g.globalAlpha = mix; g.drawImage(to, 0, 0, w, h);
  ctx.imageSmoothingEnabled = false; ctx.globalAlpha = alpha;
  ctx.drawImage(small, 0, 0, w, h, 0, 0, W, H);
}

export default {
  name: 'Pixelate',
  ko: '픽셀레이트',
  draw(ctx, t, W, H) {
    // A holds, A->B (frames 15-59), B holds, B->A (frames 90-134), A holds: frame 150 = frame 0
    const second = t >= 2.5, f = Math.round(t * 30) - (second ? 90 : 15); // frame inside the 45-frame transition
    const [from, to] = second ? [B, A] : [A, B], q = clamp(Math.floor(f / 3), 0, 15);
    mosaic(ctx, from, to, q, 1);
    if (f >= 0 && f < 45 && f % 3 === 2) mosaic(ctx, from, to, q + 1, 0.5);
  },
};
