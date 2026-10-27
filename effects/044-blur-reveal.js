// Blur reveal (focus pull): every letter starts scattered, enlarged and blurred (canvas filter blur), then
// one after another slides home and comes into sharp focus; near the end the word drifts back out of focus.
import { TAU, phase, span, ease, rng, FONT } from '../lib/util.js';

const WORD = 'FOCUS', SUB = '초점이 맞는 순간';
const SCATTER = (() => { const r = rng(44); return [...WORD].map(() => [(r() - 0.5) * 260, (r() - 0.5) * 420, (r() - 0.5) * 0.5]); })();
const BOKEH = (() => { const r = rng(4); return Array.from({ length: 14 }, () => [r() * 1080, 300 + r() * 1600, 40 + r() * 110, r() * TAU, r()]); })();

// 0 = lost in blur, 1 = in focus
const focus = (t, delay) => ease.out(span(t, 0.3 + delay, 1.7 + delay)) * (1 - ease.inOut(span(t, 3.7 + delay * 0.5, 4.8)));

export default {
  name: 'Blur Reveal',
  ko: '블러 리빌',
  draw(ctx, t, W, H) {
    const bg = ctx.createRadialGradient(W / 2, 1050, 60, W / 2, 1050, 1250);
    bg.addColorStop(0, '#3A2550'); bg.addColorStop(1, '#100A1C');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    for (const [x, y, r, p, hue] of BOKEH) { // soft out-of-focus lights drifting on small circles
      const a = phase(t) * TAU + p, cx = x + 30 * Math.cos(a), cy = y + 30 * Math.sin(a);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      const c = hue < 0.5 ? '255, 170, 120' : '160, 150, 255';
      g.addColorStop(0, `rgba(${c}, 0.16)`); g.addColorStop(0.75, `rgba(${c}, 0.1)`); g.addColorStop(1, `rgba(${c}, 0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    }

    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = `400 250px ${FONT.serif}`;
    const widths = [...WORD].map(c => ctx.measureText(c).width), gap = 14;
    let x = W / 2 - (widths.reduce((a, b) => a + b, 0) + gap * (WORD.length - 1)) / 2;
    [...WORD].forEach((ch, i) => {
      const k = focus(t, i * 0.14), u = 1 - k, [dx, dy, rot] = SCATTER[i];
      ctx.save();
      ctx.translate(x + widths[i] / 2 + dx * u, 1080 + dy * u);
      ctx.rotate(rot * u);
      ctx.scale(1 + 0.6 * u, 1 + 0.6 * u);
      ctx.filter = `blur(${(36 * u).toFixed(2)}px)`;
      ctx.globalAlpha = 0.3 + 0.7 * k;
      ctx.fillStyle = '#FFF4E6';
      ctx.fillText(ch, 0, 0);
      ctx.restore();
      x += widths[i] + gap;
    });

    const k = focus(t, 0.75), u = 1 - k; // the subtitle focuses last
    ctx.save();
    ctx.filter = `blur(${(20 * u).toFixed(2)}px)`;
    ctx.globalAlpha = 0.15 + 0.85 * k;
    ctx.fillStyle = '#FFB98A'; ctx.font = `600 64px ${FONT.ko}`;
    ctx.fillText(SUB, W / 2, 1250 + 40 * u);
    ctx.fillStyle = 'rgba(255, 244, 230, 0.55)';
    ctx.fillRect(W / 2 - 200 * k, 1145, 400 * k, 3);
    ctx.restore();
  },
};
