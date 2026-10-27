// IK tentacles: chains of joints solved with FABRIK (pull the tip to the target, then pull the root back to the
// base, repeat) every frame from the same curled start pose; a small travelling wave makes them look alive.
import { TAU, phase, rng, fract, FONT } from '../lib/util.js';

const target = t => { const a = phase(t) * TAU; return [540 + 280 * Math.sin(2 * a), 900 + 300 * Math.sin(a + 0.6)]; };
const ARMS = [
  { base: [540, 1990], n: 20, len: 1250, w: 84, lag: 0, aim: [0, 0], hue: 300 },
  { base: [150, 1990], n: 16, len: 1050, w: 50, lag: 0.35, aim: [-170, 120], hue: 250 },
  { base: [930, 1990], n: 16, len: 1050, w: 50, lag: 0.7, aim: [170, 120], hue: 345 },
];

function solve({ base, n, len }, goal, wiggle, side) {
  const d = len / n, pts = [];
  for (let i = 0; i <= n; i++) { const s = i / n; pts.push([base[0] + side * 260 * Math.sin(s * Math.PI * 1.4), base[1] - s * len * 0.7]); } // curled start
  for (let it = 0; it < 24; it++) {
    pts[n] = [...goal];
    for (let i = n - 1; i >= 0; i--) { const [x, y] = pts[i], [X, Y] = pts[i + 1], l = Math.hypot(x - X, y - Y) || 1; pts[i] = [X + ((x - X) * d) / l, Y + ((y - Y) * d) / l]; }
    pts[0] = [...base];
    for (let i = 0; i < n; i++) { const [x, y] = pts[i], [X, Y] = pts[i + 1], l = Math.hypot(X - x, Y - y) || 1; pts[i + 1] = [x + ((X - x) * d) / l, y + ((Y - y) * d) / l]; }
  }
  return pts.map(([x, y], i) => { // sideways ripple, zero at both ends so the tip still touches the target
    const s = i / n, [ax, ay] = pts[Math.max(i - 1, 0)], [bx, by] = pts[Math.min(i + 1, n)], l = Math.hypot(bx - ax, by - ay) || 1;
    const k = 28 * Math.sin(Math.PI * s) * Math.sin(TAU * (2 * s - wiggle));
    return [x - ((by - ay) / l) * k, y + ((bx - ax) / l) * k];
  });
}

export default {
  name: 'IK Tentacle',
  ko: 'IK 촉수',
  draw(ctx, t, W, H) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0F5C7A'); bg.addColorStop(0.5, '#0B3556'); bg.addColorStop(1, '#071A33');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(160, 230, 255, 0.05)'; // still light shafts from the surface
    for (const [x, w] of [[180, 140], [470, 90], [760, 170]]) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + w, 0); ctx.lineTo(x + w * 2.6 - 200, H); ctx.lineTo(x - 260, H); ctx.fill(); }
    const r = rng(4);
    for (let i = 0; i < 26; i++) { // bubbles rising, fading in and out so none pops
      const x0 = r() * W, sp = 1 + Math.floor(r() * 2), u = fract(r() + (t / 5) * sp), size = 4 + r() * 8;
      ctx.strokeStyle = `rgba(200, 240, 255, ${0.5 * Math.sin(Math.PI * u)})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x0 + 20 * Math.sin(u * 9 + i), H - u * (H - 300), size, 0, TAU); ctx.stroke();
    }

    const [tx, ty] = target(t);
    ctx.strokeStyle = 'rgba(255, 240, 160, 0.18)'; ctx.lineWidth = 4; ctx.setLineDash([3, 18]); ctx.lineCap = 'round';
    ctx.beginPath(); for (let k = 0; k <= 120; k++) ctx.lineTo(...target((k / 120) * 5)); ctx.stroke();
    ctx.setLineDash([]);

    ARMS.forEach((arm, j) => {
      const [gx, gy] = target(t - arm.lag); // the side arms reach a little beside the target, a moment later
      const pts = solve(arm, [gx + arm.aim[0], gy + arm.aim[1]], phase(t) * 3 + j * 0.3, j === 2 ? -1 : 1), n = arm.n;
      for (let i = 0; i < n; i++) { // a tapered tube: overlapping discs from root to tip
        for (let s = 0; s < 4; s++) {
          const u = (i + s / 4) / n, [x, y] = [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * s / 4, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * s / 4];
          ctx.fillStyle = `hsl(${arm.hue + 30 * u}, 70%, ${38 + 30 * u}%)`;
          ctx.beginPath(); ctx.arc(x, y, arm.w * (1 - 0.85 * u) + 4, 0, TAU); ctx.fill();
        }
      }
      for (let i = 2; i < n; i += 2) { // suckers along one side
        const u = i / n, [x, y] = pts[i], [X, Y] = pts[i + 1], l = Math.hypot(X - x, Y - y) || 1, off = arm.w * (1 - 0.85 * u) * 0.55;
        ctx.fillStyle = 'rgba(255, 214, 236, 0.75)';
        ctx.beginPath(); ctx.arc(x + ((Y - y) / l) * off, y - ((X - x) / l) * off, 4 + 10 * (1 - u), 0, TAU); ctx.fill();
      }
      if (j === 0) { // the IK joints of the main arm
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'; ctx.lineWidth = 3;
        ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        pts.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.fill(); });
      }
    });

    ctx.fillStyle = '#06122A'; // the rocks they grow from
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 1800 - 60 * Math.sin(x / 140) - 30 * Math.sin(x / 47 + 1));
    ctx.lineTo(W, H); ctx.fill();
    const glow = ctx.createRadialGradient(tx, ty, 4, tx, ty, 110);
    glow.addColorStop(0, 'rgba(255, 246, 190, 1)'); glow.addColorStop(0.25, 'rgba(255, 220, 120, 0.6)'); glow.addColorStop(1, 'rgba(255, 200, 80, 0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(tx, ty, 110, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; ctx.font = `700 32px ${FONT.sans}`; ctx.textAlign = 'center';
    ctx.fillText('TARGET', tx, ty - 70);
  },
};
