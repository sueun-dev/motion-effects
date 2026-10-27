// Plexus: 110 points float on looping Lissajous paths; every pair closer than D is joined by a line whose opacity
// falls smoothly with distance (and every closed triangle gets a faint fill), so links fade in and out instead of popping.
import { TAU, rng, phase } from '../lib/util.js';

const COLS = 10, ROWS = 12, D = 250;
const r = rng(79);
const nodes = [];
for (let j = 0; j < ROWS; j++) {
  for (let i = 0; i < COLS; i++) { // a jittered grid keeps the points spread evenly
    if (r() < 0.08) continue;
    nodes.push({
      x: 40 + (i + 0.2 + 0.6 * r()) * 1000 / COLS, y: 300 + (j + 0.2 + 0.6 * r()) * 1580 / ROWS,
      ax: 30 + 45 * r(), ay: 30 + 45 * r(), fx: r() < 0.85 ? 1 : 2, fy: r() < 0.85 ? 1 : 2,
      px: r() * TAU, py: r() * TAU, z: 0.55 + 0.45 * r(),
    });
  }
}

let dot = null;
export default {
  name: 'Plexus',
  ko: '플렉서스',
  setup() {
    dot = document.createElement('canvas'); dot.width = dot.height = 64;
    const g = dot.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(190,240,255,0.9)'); gr.addColorStop(0.45, 'rgba(90,200,255,0.25)'); gr.addColorStop(1, 'rgba(90,200,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  },
  draw(ctx, t, W, H) {
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#071A3A'); bg.addColorStop(0.55, '#0A0C2A'); bg.addColorStop(1, '#1E0C38');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const halo = ctx.createRadialGradient(W / 2, H * 0.55, 0, W / 2, H * 0.55, 800);
    halo.addColorStop(0, 'rgba(60, 140, 255, 0.18)'); halo.addColorStop(1, 'rgba(60, 140, 255, 0)');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);

    const a = phase(t) * TAU;
    const P = nodes.map(n => [n.x + n.ax * Math.sin(n.fx * a + n.px), n.y + n.ay * Math.sin(n.fy * a + n.py), n.z]);
    const n = P.length, link = Array.from({ length: n }, () => new Float32Array(n)); // link strength 0..1 per pair
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const d = Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1]);
      if (d < D) link[i][j] = link[j][i] = (1 - d / D) ** 1.6 * Math.min(P[i][2], P[j][2]);
    }
    const hue = y => 190 + 80 * (y - 300) / 1600;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      if (!link[i][j]) continue;
      for (let k = j + 1; k < n; k++) { // faint facets where three points are all linked
        const f = Math.min(link[i][j], link[j][k], link[i][k]);
        if (f <= 0) continue;
        ctx.fillStyle = `hsla(${hue(P[i][1])}, 90%, 60%, ${0.22 * f})`;
        ctx.beginPath(); ctx.moveTo(P[i][0], P[i][1]); ctx.lineTo(P[j][0], P[j][1]); ctx.lineTo(P[k][0], P[k][1]); ctx.fill();
      }
    }
    ctx.lineWidth = 2;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      if (!link[i][j]) continue;
      ctx.strokeStyle = `hsla(${hue((P[i][1] + P[j][1]) / 2)}, 90%, 72%, ${0.72 * link[i][j]})`;
      ctx.beginPath(); ctx.moveTo(P[i][0], P[i][1]); ctx.lineTo(P[j][0], P[j][1]); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const [x, y, z] of P) {
      const s = 34 * z;
      ctx.drawImage(dot, x - s / 2, y - s / 2, s, s);
    }
  },
};
