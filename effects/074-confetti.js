// Confetti: two party poppers fire at t = 0 and 2.5 s. Each paper piece follows a closed-form path (drag slows the
// shot, then it falls at a steady speed), sways, spins and flips (its height scales with cos), so it all loops.
import { TAU, rng, smoothstep } from '../lib/util.js';

const K = 2.5, VT = 165, LIFE = 4.8;
const COLORS = [[255, 84, 118], [255, 190, 50], [50, 190, 255], [128, 96, 255], [40, 205, 145], [255, 132, 60]];
const POPPERS = [{ x: 150, y: 1740, ang: -1.08 }, { x: 930, y: 1740, ang: -Math.PI + 1.08 }];
const r = rng(74);
const pieces = [];
for (const b of [0, 2.5]) {
  for (const p of POPPERS) {
    for (let i = 0; i < 100; i++) {
      const a = p.ang + (r() - 0.5) * 0.75, v = 2000 + 1500 * r();
      pieces.push({
        b, x0: p.x + Math.cos(p.ang) * 30, y0: p.y + Math.sin(p.ang) * 30, vx: v * Math.cos(a), vy: v * Math.sin(a),
        c: COLORS[i % COLORS.length], shape: i % 7 === 0 ? 1 : i % 5 === 0 ? 2 : 0,
        w: 22 + 12 * r(), h: 12 + 6 * r(), rot: r() * TAU, spin: (r() - 0.5) * 4,
        flip: 1.8 + 2.4 * r(), sway: 25 + 45 * r(), sf: 1.2 + 1.2 * r(), ph: r() * TAU,
      });
    }
  }
}
const since = (t, b) => ((t - b) % 5 + 5) % 5;

function popper(ctx, p, kick) {
  ctx.save();
  ctx.translate(p.x - Math.cos(p.ang) * kick, p.y - Math.sin(p.ang) * kick);
  ctx.rotate(p.ang);
  ctx.beginPath(); ctx.moveTo(-190, -16); ctx.lineTo(0, -46); ctx.lineTo(0, 46); ctx.lineTo(-190, 16); ctx.closePath();
  ctx.fillStyle = '#7C5CFF'; ctx.fill();
  ctx.clip();
  ctx.fillStyle = '#FFD04A';
  for (let s = -220; s < 40; s += 46) { ctx.beginPath(); ctx.moveTo(s, -60); ctx.lineTo(s + 20, -60); ctx.lineTo(s + 50, 60); ctx.lineTo(s + 30, 60); ctx.fill(); }
  ctx.restore();
}

export default {
  name: 'Confetti',
  ko: '컨페티',
  draw(ctx, t, W, H) {
    const bg = ctx.createRadialGradient(W / 2, H * 0.45, 100, W / 2, H * 0.5, H * 0.75);
    bg.addColorStop(0, '#FFF7EC'); bg.addColorStop(1, '#FFD3DF');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    const shot = Math.min(since(t, 0), since(t, 2.5)); // seconds since the last pop
    for (const p of POPPERS) {
      const puff = (shot / 0.12) * Math.exp(1 - shot / 0.12);
      const mx = p.x + Math.cos(p.ang) * 40, my = p.y + Math.sin(p.ang) * 40;
      const g = ctx.createRadialGradient(mx, my, 0, mx, my, 260);
      g.addColorStop(0, `rgba(255, 255, 255, ${0.8 * puff})`); g.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = g; ctx.fillRect(mx - 260, my - 260, 520, 520);
    }

    for (const q of pieces) {
      const a = since(t, q.b);
      if (a > LIFE) continue;
      const e = (1 - Math.exp(-K * a)) / K;
      const x = q.x0 + q.vx * e + q.sway * Math.sin(q.sf * a + q.ph) * smoothstep(0.3, 1.4, a);
      const y = q.y0 + VT * a + (q.vy - VT) * e;
      const f = Math.cos(q.flip * a + q.ph); // flipping paper: the back side is darker
      const shade = 0.72 + 0.28 * smoothstep(-0.4, 0.4, f);
      ctx.globalAlpha = 1 - smoothstep(LIFE - 0.5, LIFE, a);
      ctx.fillStyle = `rgb(${q.c[0] * shade}, ${q.c[1] * shade}, ${q.c[2] * shade})`;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(q.rot + q.spin * a);
      ctx.scale(1, Math.abs(f) * 0.9 + 0.1);
      if (q.shape === 1) { ctx.beginPath(); ctx.arc(0, 0, q.h * 0.75, 0, TAU); ctx.fill(); }
      else if (q.shape === 2) ctx.fillRect(-q.w, -q.h * 0.22, q.w * 2, q.h * 0.44);
      else ctx.fillRect(-q.w / 2, -q.h / 2, q.w, q.h);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    for (const p of POPPERS) popper(ctx, p, 22 * Math.exp(-shot * 6) * Math.min(1, shot * 30));
  },
};
