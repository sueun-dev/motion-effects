// Bokeh: out-of-focus light discs (flat centre, slightly brighter rim, soft edge) drift on looping orbits and add up.
// A slow rack focus swaps which layer is blurred: near discs swell and soften while far ones tighten, then back.
import { TAU, rng, phase } from '../lib/util.js';

const HUES = [42, 30, 345, 180, 265, 50];
const r = rng(80);
const discs = [];
for (const [layer, count, rMin, rMax, amp] of [[0, 46, 22, 52, 25], [1, 26, 60, 110, 45], [2, 12, 120, 200, 70]]) {
  for (let i = 0; i < count; i++) {
    discs.push({
      layer, x: r() * 1080, y: 300 + r() * 1620, rad: rMin + (rMax - rMin) * r(),
      ax: amp * (0.5 + r()), ay: amp * (0.5 + r()), f: 1 + (r() < 0.3 ? 1 : 0), p1: r() * TAU, p2: r() * TAU,
      hue: HUES[Math.floor(r() * HUES.length)], a: [0.55, 0.32, 0.2][layer] * (0.6 + 0.4 * r()),
    });
  }
}

export default {
  name: 'Bokeh',
  ko: '보케',
  draw(ctx, t, W, H) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0A0716'); bg.addColorStop(0.6, '#1A0D26'); bg.addColorStop(1, '#2A1224');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W / 2, H * 0.6, 0, W / 2, H * 0.6, 900);
    glow.addColorStop(0, 'rgba(255, 150, 90, 0.16)'); glow.addColorStop(1, 'rgba(255, 150, 90, 0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

    const a = phase(t) * TAU, focus = 0.5 - 0.5 * Math.cos(a); // 0: far layer sharp .. 1: near layer sharp
    ctx.globalCompositeOperation = 'lighter';
    for (const d of discs) {
      const blur = d.layer === 2 ? 1 - focus : d.layer === 0 ? focus : 0.5; // 0 sharp .. 1 very soft
      const R = d.rad * (0.85 + 0.35 * blur);
      const x = d.x + d.ax * Math.sin(d.f * a + d.p1), y = d.y + d.ay * Math.cos(a + d.p2);
      const soft = 0.04 + 0.3 * blur, alpha = d.a * (1.15 - 0.4 * blur); // a wider disc spreads the same light thinner
      const g = ctx.createRadialGradient(x, y, 0, x, y, R);
      g.addColorStop(0, `hsla(${d.hue}, 90%, 62%, ${alpha * 0.7})`);
      g.addColorStop(Math.max(0, 0.92 - soft - 0.1), `hsla(${d.hue}, 90%, 64%, ${alpha * 0.8})`);
      g.addColorStop(0.92 - soft, `hsla(${d.hue}, 95%, 72%, ${alpha})`); // the slightly brighter rim
      g.addColorStop(1, `hsla(${d.hue}, 90%, 60%, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
    }
  },
};
