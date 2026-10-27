// Luma fade (luma matte): a threshold falls through the outgoing picture's brightness map (equalised to ranks 0..1,
// with a fixed soft noise so flat areas melt organically), so the brightest parts dissolve into the next scene first.
// The matte is built at half resolution in JS and scaled up smoothly; a warm glow rides the melting edge.
import { W, H, lerp, smoothstep, noise3, canvas } from '../lib/util.js';
import { landscape, city } from '../lib/scenes.js';

const A = canvas(), B = canvas();
landscape(A.getContext('2d'), W, H, 0);
city(B.getContext('2d'), W, H);
const w = W / 2, h = H / 2, n = w * h, SOFT = 0.07;

// brightness rank (0 darkest .. 1 brightest) of every half-resolution pixel of a picture
function lumaRank(img) {
  const g = canvas(w, h).getContext('2d', { willReadFrequently: true });
  g.filter = 'blur(2px)'; g.drawImage(img, 0, 0, w, h);
  const px = g.getImageData(0, 0, w, h).data, L = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i % w, y = (i - x) / w;
    L[i] = (0.2126 * px[4 * i] + 0.7152 * px[4 * i + 1] + 0.0722 * px[4 * i + 2]) / 255 + 0.06 * noise3(x / 70, y / 70, 3.3);
  }
  const order = Array.from(L.keys()).sort((a, b) => L[a] - L[b]), rank = new Float32Array(n);
  order.forEach((idx, r) => { rank[idx] = r / (n - 1); });
  return rank;
}
const RANK_A = lumaRank(A), RANK_B = lumaRank(B);

const matte = canvas(w, h), mg = matte.getContext('2d'), mdata = mg.createImageData(w, h);
const glow = canvas(w, h), gg = glow.getContext('2d'), gdata = gg.createImageData(w, h);
const layer = canvas(), lg = layer.getContext('2d');

// A holds, A->B (0.5-2.0 s), B holds, B->A (3.0-4.5 s), A holds: frame 150 = frame 0
const stage = t => (t < 2.5 ? [A, B, RANK_A, smoothstep(0.5, 2.0, t)] : [B, A, RANK_B, smoothstep(3.0, 4.5, t)]);

export default {
  name: 'Luma Fade',
  ko: '루마 페이드',
  draw(ctx, t, W, H) {
    const [from, to, rank, k] = stage(t);
    ctx.drawImage(k < 1 ? from : to, 0, 0);
    if (k <= 0 || k >= 1) return;
    const th = lerp(1 + SOFT, -SOFT, k); // pixels ranked above th have turned into the next scene
    const m = mdata.data, gl = gdata.data;
    for (let i = 0; i < n; i++) {
      const v = smoothstep(th - SOFT, th + SOFT, rank[i]); // 0 = still old, 1 = new
      m[4 * i + 3] = 255 * v;
      gl[4 * i] = 255; gl[4 * i + 1] = 196; gl[4 * i + 2] = 130; gl[4 * i + 3] = 255 * 3 * v * (1 - v);
    }
    mg.putImageData(mdata, 0, 0); gg.putImageData(gdata, 0, 0);
    lg.globalCompositeOperation = 'copy'; lg.drawImage(to, 0, 0); // the next scene, cut out by the matte
    lg.globalCompositeOperation = 'destination-in'; lg.drawImage(matte, 0, 0, W, H);
    ctx.drawImage(layer, 0, 0);
    ctx.globalCompositeOperation = 'screen'; ctx.drawImage(glow, 0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
  },
};
