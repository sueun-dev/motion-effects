// Whip pan: the camera slides along an endless strip A | B | A | B on a steep ease; each frame is a weighted average of
// many copies shifted along the pan (directional motion blur, soft sine-shaped kernel) whose spread follows the speed.
import { W, H, span, ease, canvas } from '../lib/util.js';
import { landscape, city } from '../lib/scenes.js';

const A = canvas(), B = canvas();
city(B.getContext('2d'), W, H);
// camera x on the strip: A holds, whips to B (0.7-1.8 s), B holds, whips on to the next A (3.2-4.3 s) = frame 0
const camX = t => W * (ease.inOut(span(t, 0.7, 1.8)) + ease.inOut(span(t, 3.2, 4.3)));
const SHUTTER = 10; // blur length = this many frames of travel

export default {
  name: 'Whip Pan',
  ko: '휩 팬',
  draw(ctx, t, W, H) {
    landscape(A.getContext('2d'), W, H, t);
    const x = camX(t), v = (camX(t + 1 / 60) - camX(t - 1 / 60)); // px per frame
    const blur = v * SHUTTER, n = Math.min(120, 1 + Math.ceil(blur / 6));
    let sum = 0;
    for (let i = 0; i < n; i++) { // running weighted average: copy i at alpha = its weight / weights so far
      const u = (i + 0.5) / n, wgt = Math.sin(Math.PI * u), xi = x + blur * (u - 0.5);
      sum += wgt; ctx.globalAlpha = wgt / sum;
      for (let j = Math.floor(xi / W); j * W < xi + W; j++) ctx.drawImage(j & 1 ? B : A, j * W - xi, 0);
    }
    ctx.globalAlpha = 1;
  },
};
