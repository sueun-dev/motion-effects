// Claymorphism: every shape gets a soft drop shadow plus two inner shadows (dark bottom-right, light top-left),
// drawn by clipping to the shape and blurring a frame around it. The clay toys bounce with squash and stretch.
import { TAU, phase } from '../lib/util.js';

// fill path() like puffy clay: outer shadow, base gradient, inner shade and inner light, a soft gloss spot
function clay(ctx, path, r, base, light, shade, drop = true) {
  ctx.save();
  if (drop) { ctx.shadowColor = shade + '88'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 34; }
  const g = ctx.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, light); g.addColorStop(1, base);
  ctx.fillStyle = g;
  ctx.beginPath(); path(ctx); ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath(); path(ctx); ctx.clip();
  for (const [color, dx, blur] of [[shade + 'CC', -1, 0.5], ['#FFFFFFD0', 1, 0.35]]) {
    ctx.shadowColor = color; ctx.shadowBlur = r * blur; ctx.shadowOffsetX = ctx.shadowOffsetY = dx * r * 0.16;
    const R = r * 3; // a frame around the shape, wound the other way so the shape stays a hole
    ctx.beginPath(); ctx.moveTo(-R, -R); ctx.lineTo(-R, R); ctx.lineTo(R, R); ctx.lineTo(R, -R); ctx.closePath(); path(ctx); ctx.fill();
  }
  ctx.restore();
  const gl = ctx.createRadialGradient(-r * 0.4, -r * 0.45, 0, -r * 0.4, -r * 0.45, r * 0.5);
  gl.addColorStop(0, 'rgba(255,255,255,0.55)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl; ctx.beginPath(); path(ctx); ctx.fill();
}

const face = (ctx, r) => {
  ctx.fillStyle = '#3B2B4F';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * r * 0.3, -r * 0.08, r * 0.09, r * 0.13, 0, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = '#3B2B4F'; ctx.lineWidth = r * 0.06; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, r * 0.12, r * 0.16, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
};

const GROUND = 1532;
const toys = [ // x, half size, bounces per loop, phase offset, jump height, colours, path
  { x: 250, r: 112, n: 3, off: 0.0, hop: 430, c: ['#FF7FA8', '#FFC3D6', '#D9467A'], path: (c, r) => c.arc(0, 0, r, 0, TAU) },
  { x: 540, r: 108, n: 2, off: 0.3, hop: 560, c: ['#6FA6FF', '#BFD7FF', '#3C6FD6'], path: (c, r) => c.roundRect(-r, -r, 2 * r, 2 * r, r * 0.38) },
  { x: 830, r: 118, n: 3, off: 0.55, hop: 380, c: ['#5FD6A8', '#B8F1DB', '#2E9E76'], path: (c, r) => c.roundRect(-r * 0.7, -r, r * 1.4, 2 * r, r * 0.7) },
];

export default {
  name: 'Claymorphism',
  ko: '클레이모피즘',
  draw(ctx, t, W, H) {
    const a = phase(t) * TAU;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#E6DDFF'); bg.addColorStop(1, '#FFE0EC');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    ctx.save(); ctx.translate(790, 560 + 22 * Math.sin(a)); // sun
    clay(ctx, c => c.arc(0, 0, 120, 0, TAU), 120, '#FFC94D', '#FFE9A8', '#E09A1F');
    ctx.restore();
    ctx.save(); ctx.translate(330 + 50 * Math.sin(a), 720 + 14 * Math.cos(2 * a)); // cloud
    const cloud = c => { c.arc(-95, 20, 75, 0, TAU); c.moveTo(165, 10); c.arc(90, 10, 75, 0, TAU); c.moveTo(115, -40); c.arc(0, -40, 115, 0, TAU); c.moveTo(150, 40); c.roundRect(-150, 0, 300, 95, 47); };
    clay(ctx, cloud, 150, '#F6F2FF', '#FFFFFF', '#C2B3EE');
    ctx.restore();

    ctx.save(); ctx.translate(540, 1600); // the platform the toys land on
    clay(ctx, c => c.roundRect(-450, -110, 900, 220, 110), 300, '#B8A3FF', '#E1D7FF', '#7B62D9');
    ctx.restore();

    for (const s of toys) {
      const u = ((t * s.n / 5 + s.off) % 1 + 1) % 1, C = 0.16;
      let lift = 0, sy = 1;
      if (u < C) sy = 1 - 0.32 * Math.sin(Math.PI * u / C);  // squash on contact
      else { const k = (u - C) / (1 - C); lift = 4 * k * (1 - k); sy = 1 + 0.16 * Math.abs(1 - 2 * k) ** 2; }
      const sx = 1 / sy, y = GROUND - s.r * sy - lift * s.hop;
      ctx.fillStyle = `rgba(90, 60, 160, ${0.30 - 0.2 * lift})`; // contact shadow on the platform
      ctx.beginPath(); ctx.ellipse(s.x, GROUND + 4, s.r * (1.05 - 0.45 * lift) * sx, 20 * (1 - 0.5 * lift), 0, 0, TAU); ctx.fill();
      ctx.save();
      ctx.translate(s.x, y); ctx.rotate(0.12 * Math.sin(a * s.n + s.off * TAU) * lift); ctx.scale(sx, sy);
      clay(ctx, c => s.path(c, s.r), s.r, ...s.c, false);
      face(ctx, s.r);
      ctx.restore();
    }
  },
};
