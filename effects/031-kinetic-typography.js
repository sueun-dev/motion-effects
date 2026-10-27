// Kinetic typography: four words enter on the beat (drop, slide, spin, slam), bounce in time at 120 BPM while the
// stack sways, then leave one by one so the loop starts empty again. Each word is a keyframed transform.
import { TAU, clamp, ease, FONT } from '../lib/util.js';

const BEAT = 0.5; // 120 BPM
const span = (t, a, d) => clamp((t - a) / d);
const fadeIn = k => clamp(k * 2.5), fadeOut = k => 1 - clamp(k * 1.6);
const WORDS = [
  { text: 'MAKE', y: 700, size: 190, at: 0.1, out: 3.95,
    enter: k => ({ dy: -420 * (1 - ease.outBack(k)), rot: -0.4 * (1 - k), a: fadeIn(k) }),
    exit: k => ({ dy: -380 * ease.in(k), a: fadeOut(k) }) },
  { text: 'EVERY', y: 910, size: 190, at: 0.6, out: 4.1,
    enter: k => ({ dx: 520 * (1 - ease.out(k)), a: fadeIn(k) }), exit: k => ({ dx: -460 * ease.in(k), a: fadeOut(k) }) },
  { text: 'WORD', y: 1120, size: 190, at: 1.1, out: 4.25,
    enter: k => ({ rot: Math.PI * 0.6 * (1 - ease.outBack(k)), s: ease.outBack(k) }),
    exit: k => ({ dx: 420 * ease.in(k), rot: 0.5 * ease.in(k), a: fadeOut(k) }) },
  { text: 'MOVE', y: 1400, size: 270, at: 1.6, out: 4.4, hot: true,
    enter: k => ({ s: 1 + 0.7 * (1 - ease.out(k)), a: fadeIn(k) }), exit: k => ({ s: 1 + 1.2 * ease.in(k), a: fadeOut(k) }) },
];

export default {
  name: 'Kinetic Typography',
  ko: '키네틱 타이포그래피',
  draw(ctx, t, W, H) {
    const beat = Math.pow(0.5 + 0.5 * Math.cos(TAU * t / BEAT), 4); // a smooth pulse on every beat
    const bg = ctx.createRadialGradient(W / 2, 1050, 50, W / 2, 1050, 1300);
    bg.addColorStop(0, '#3B1D74'); bg.addColorStop(1, '#120826');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = `rgba(255, 120, 150, ${0.1 + 0.14 * beat})`; ctx.lineWidth = 6; // rings glow on the beat
    for (let r = 0; r < 3; r++) { ctx.beginPath(); ctx.arc(W / 2, 1050, 300 + r * 160, 0, TAU); ctx.stroke(); }

    const hold = span(t, 1.95, 0.25) * (1 - span(t, 3.75, 0.2));    // the bouncing part between entrances and exits
    const hit = Math.sin(Math.PI * clamp((t - 1.85) / 0.4));         // MOVE lands: the stack dips once
    const sway = 0.07 * Math.sin(TAU * (t - 1.95) / (4 * BEAT)) * hold;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    WORDS.forEach((w, i) => {
      if (t < w.at) return;
      const m = { dx: 0, dy: 0, rot: 0, s: 1, a: 1, ...w.enter(span(t, w.at, 0.4)) };
      if (t > w.out) Object.assign(m, { dx: 0, dy: 0, rot: 0, s: 1, a: 1 }, w.exit(span(t, w.out, 0.45)));
      const bump = 1 + 0.06 * hold * Math.pow(0.5 + 0.5 * Math.cos(TAU * (t - i * 0.08) / BEAT), 3);
      ctx.save();
      ctx.translate(W / 2 + m.dx, w.y + m.dy + (i < 3 ? 36 * hit : 0));
      ctx.rotate(m.rot + sway * (i % 2 ? -1 : 1));
      ctx.scale(m.s * bump, m.s * bump);
      ctx.globalAlpha = clamp(m.a);
      ctx.font = `900 ${w.size}px ${FONT.black}`;
      ctx.fillStyle = '#0B0518'; ctx.fillText(w.text, 10, 12);              // hard shadow
      if (w.hot) {
        const g = ctx.createLinearGradient(0, -w.size / 2, 0, w.size / 2);
        g.addColorStop(0, '#FFD36E'); g.addColorStop(1, '#FF4F7B');
        ctx.fillStyle = g;
      } else ctx.fillStyle = '#FFF2DE';
      ctx.fillText(w.text, 0, 0);
      ctx.restore();
    });
  },
};
