// Wave text: each letter rides the same sine wave a little later than the one before it (per-letter stagger), so
// a wave travels through the words; letters stretch slightly on the way up and their shadows shrink as they lift.
import { TAU, phase, FONT } from '../lib/util.js';

const LINES = ['MAKING', 'WAVES'], SIZE = 190, COLOURS = ['#FFFFFF', '#9FF3FF', '#FFD9A0', '#FFB3C8'];

export default {
  name: 'Wave Text',
  ko: '웨이브 텍스트',
  draw(ctx, t, W, H) {
    const a = phase(t) * TAU;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0B2A5B'); bg.addColorStop(0.6, '#1565A8'); bg.addColorStop(1, '#0B2A5B');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(160, 230, 255, 0.25)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) { // gentle swell lines behind the type, moving with the same wave
      ctx.beginPath();
      for (let x = -20; x <= W + 20; x += 10) {
        const y = 1500 + k * 90 + 24 * Math.sin(2 * a - x / 140 - k);
        x < 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.font = `700 ${SIZE}px ${FONT.display}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    let n = 0;
    LINES.forEach((line, row) => {
      const widths = [...line].map(ch => ctx.measureText(ch).width), total = widths.reduce((s, w) => s + w, 0);
      let x = (W - total) / 2;
      const base = 920 + row * 340;
      [...line].forEach((ch, i) => {
        const u = 2 * a - n * 0.55;                       // two waves per loop, each letter a bit behind
        const lift = Math.sin(u), cx = x + widths[i] / 2;
        const y = base - 70 * lift;
        ctx.fillStyle = `rgba(4, 20, 50, ${0.35 - 0.15 * lift})`; // shadow on the line below
        ctx.beginPath(); ctx.ellipse(cx, base + 34, widths[i] * (0.42 - 0.1 * lift), 14, 0, 0, TAU); ctx.fill();
        ctx.save();
        ctx.translate(cx, y);
        ctx.scale(1 - 0.04 * Math.cos(u), 1 + 0.08 * Math.cos(u));   // stretch while rising, squash while falling
        ctx.fillStyle = COLOURS[n % COLOURS.length];
        ctx.fillText(ch, 0, 0);
        ctx.restore();
        x += widths[i]; n++;
      });
    });
  },
};
