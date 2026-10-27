// Comic pop art: a rotating sunburst of speed rays under a fixed Ben-Day dot screen; a jagged burst balloon with
// "POW!" then "BAM!" springs out (outBack), wobbles, and snaps away. Thick black ink outlines and hard shadows.
import { TAU, phase, rng, canvas, ease, span } from '../lib/util.js';

const CX = 540, CY = 1060, IMPACT = '"Impact", "Arial Black", sans-serif';
let dots = null;

const burst = seed => { // jagged star outline, fixed per word
  const r = rng(seed);
  return Array.from({ length: 36 }, (_, i) => [i / 36 * TAU, i % 2 ? 0.62 + 0.08 * r() : 0.9 + 0.22 * r()]);
};
const WORDS = [ // text, start (s), burst colours, shape
  { text: 'POW!', at: 4.0, outer: '#E8202A', inner: '#FFE135', ink: '#E8202A', tilt: -0.12, shape: burst(4) },
  { text: 'BAM!', at: 1.5, outer: '#1E6BFF', inner: '#FFFFFF', ink: '#FF2E7E', tilt: 0.1, shape: burst(8) },
];
const star = (ctx, pts, R) => { ctx.beginPath(); for (const [a, k] of pts) ctx.lineTo(R * k * Math.cos(a), R * k * Math.sin(a)); ctx.closePath(); };

export default {
  name: 'Pop Art Comic',
  ko: '팝아트 코믹',
  setup(_, W, H) {
    dots = canvas(W, H); // Ben-Day dots, bigger toward the edges; drawn once
    const g = dots.getContext('2d');
    g.fillStyle = 'rgba(232, 32, 90, 0.5)';
    for (let y = 0, row = 0; y < H + 30; y += 26, row++) {
      for (let x = (row % 2) * 13; x < W + 30; x += 26) {
        const r = 2 + 8 * Math.min(1, Math.hypot(x - CX, y - CY) / 1100);
        g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      }
    }
  },
  draw(ctx, t, W, H) {
    const a = phase(t) * TAU;
    ctx.fillStyle = '#FFF2A8'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#FFC928'; // sunburst rays, turning two rays per loop
    for (let i = 0; i < 18; i++) {
      const q = i / 18 * TAU + a / 9;
      ctx.beginPath(); ctx.moveTo(CX, CY);
      ctx.arc(CX, CY, 2400, q, q + TAU / 36); ctx.closePath(); ctx.fill();
    }
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(dots, 0, 0); ctx.restore();

    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const w of WORDS) {
      const lt = ((t - w.at) % 5 + 5) % 5;
      const s = ease.outBack(span(lt, 0, 0.55)) * (1 - ease.in(span(lt, 2.25, 2.5))); // each word lives 2.5 s
      if (s <= 0.001) continue;
      ctx.save();
      ctx.translate(CX, CY); ctx.rotate(w.tilt + 0.05 * Math.sin(lt * 9) * (1 - span(lt, 0, 1.2))); ctx.scale(s, s);
      ctx.strokeStyle = '#111'; ctx.lineWidth = 16; // action strokes flying out
      for (let i = 0; i < 12; i++) {
        const q = i / 12 * TAU + 0.2, r0 = 440 + 40 * (i % 3), r1 = r0 + 80 + 60 * span(lt, 0, 0.5);
        ctx.beginPath(); ctx.moveTo(r0 * Math.cos(q), r0 * Math.sin(q)); ctx.lineTo(r1 * Math.cos(q), r1 * Math.sin(q)); ctx.stroke();
      }
      ctx.fillStyle = '#111'; ctx.save(); ctx.translate(22, 26); star(ctx, w.shape, 400); ctx.fill(); ctx.restore(); // hard shadow
      ctx.fillStyle = w.outer; star(ctx, w.shape, 400); ctx.fill(); ctx.lineWidth = 14; ctx.stroke();
      ctx.fillStyle = w.inner; star(ctx, w.shape, 305); ctx.fill(); ctx.lineWidth = 10; ctx.stroke();

      ctx.font = `215px ${IMPACT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let k = 12; k > 0; k -= 2) { ctx.fillStyle = '#111'; ctx.fillText(w.text, k, 8 + k); } // extruded letters
      ctx.lineWidth = 18; ctx.strokeStyle = '#111'; ctx.strokeText(w.text, 0, 8);
      ctx.fillStyle = w.ink; ctx.fillText(w.text, 0, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; // a glossy highlight on the upper half of the letters
      ctx.save(); ctx.beginPath(); ctx.rect(-400, -100, 800, 80); ctx.clip(); ctx.fillText(w.text, 0, 8); ctx.restore();
      ctx.restore();
    }
  },
};
