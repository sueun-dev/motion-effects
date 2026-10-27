// Neumorphism (soft UI): controls are the background colour and exist only through light (top-left) and dark
// (bottom-right) shadows. Pressing crossfades the outer shadows (convex) into inner shadows (concave).
import { TAU, ease, span } from '../lib/util.js';

const BG = '#E3E8F0';
const light = a => `rgba(255, 255, 255, ${a.toFixed(3)})`, dark = a => `rgba(136, 152, 180, ${a.toFixed(3)})`;

// k = 0: raised, k = 1: pressed in. d = shadow distance
function neu(ctx, path, k, d) {
  ctx.save();
  ctx.fillStyle = BG;
  for (const [col, s] of [[light(0.95 * (1 - k)), -1], [dark(0.75 * (1 - k)), 1]]) {
    ctx.shadowColor = col; ctx.shadowBlur = d * 2; ctx.shadowOffsetX = ctx.shadowOffsetY = s * d;
    ctx.beginPath(); path(ctx); ctx.fill();
  }
  ctx.restore();
  if (k <= 0) return;
  ctx.save();
  ctx.beginPath(); path(ctx); ctx.clip();
  for (const [col, s] of [[dark(0.8 * k), 1], [light(0.95 * k), -1]]) {
    ctx.shadowColor = col; ctx.shadowBlur = d * 1.6; ctx.shadowOffsetX = ctx.shadowOffsetY = s * d * 0.8;
    ctx.beginPath(); // a frame around the shape, wound the other way so the shape stays a hole
    ctx.moveTo(-3000, -3000); ctx.lineTo(-3000, 3000); ctx.lineTo(3000, 3000); ctx.lineTo(3000, -3000); ctx.closePath();
    path(ctx); ctx.fill();
  }
  ctx.restore();
}

const pressed = (t, at, hold = 1.2) => ease.inOut(span(t, at, at + 0.35)) - ease.inOut(span(t, at + hold, at + hold + 0.35));
const mix = (k, a, b) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',')})`;
const iconCol = k => mix(k, [158, 170, 190], [91, 124, 255]);

export default {
  name: 'Neumorphism',
  ko: '뉴모피즘',
  draw(ctx, t, W, H) {
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    const big = pressed(t, 0.3, 1.5) + pressed(t, 2.8, 1.5);  // the power button goes in and out twice
    neu(ctx, c => c.arc(540, 880, 285, 0, TAU), 1, 24);       // the well it sits in
    neu(ctx, c => c.arc(540, 880, 215 - 6 * big, 0, TAU), big, 32);
    ctx.save(); ctx.translate(540, 880);
    ctx.shadowColor = `rgba(91, 124, 255, ${(0.7 * big).toFixed(3)})`; ctx.shadowBlur = 30 * big;
    ctx.strokeStyle = iconCol(big); ctx.lineWidth = 18;
    ctx.beginPath(); ctx.arc(0, 8, 78, -Math.PI / 2 + 0.7, -Math.PI / 2 - 0.7 + TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -90); ctx.lineTo(0, -10); ctx.stroke();
    ctx.restore();

    const icons = [ // heart, play, star; each pressed for a moment, one after another
      [250, 1.0, c => { c.moveTo(0, 30); c.bezierCurveTo(-60, -10, -40, -55, 0, -28); c.bezierCurveTo(40, -55, 60, -10, 0, 30); }],
      [540, 1.7, c => { c.moveTo(-20, -34); c.lineTo(34, 0); c.lineTo(-20, 34); c.closePath(); }],
      [830, 2.4, c => { for (let i = 0; i < 10; i++) { const r = i % 2 ? 17 : 40, q = i / 10 * TAU - Math.PI / 2; c.lineTo(r * Math.cos(q), r * Math.sin(q)); } c.closePath(); }],
    ];
    for (const [x, at, icon] of icons) {
      const p = pressed(t, at);
      neu(ctx, c => c.arc(x, 1340, 105, 0, TAU), p, 20);
      ctx.save(); ctx.translate(x, 1340 + 3 * p); ctx.scale(1 - 0.06 * p, 1 - 0.06 * p);
      ctx.fillStyle = iconCol(p); ctx.beginPath(); icon(ctx); ctx.fill();
      ctx.restore();
    }

    const on = pressed(t, 3.3, 1.0); // toggle switch
    neu(ctx, c => c.roundRect(310, 1580, 460, 150, 75), 1, 14);
    ctx.fillStyle = `rgba(91, 124, 255, ${(0.25 * on).toFixed(3)})`;
    ctx.beginPath(); ctx.roundRect(325, 1595, 430, 120, 60); ctx.fill();
    neu(ctx, c => c.arc(385 + 310 * on, 1655, 56, 0, TAU), 0, 12);
  },
};
