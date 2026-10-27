// Neubrutalism UI: flat loud colours, 6 px black borders and hard offset shadows. A cursor visits each block;
// the block sinks onto its shadow when clicked and pops back up with an overshoot (outBack).
import { FONT, TAU, phase, ease, span } from '../lib/util.js';

const S = 16; // shadow offset
const ink = '#111111';
const text = (ctx, s, x, y, size, font = FONT.black, align = 'left') => {
  ctx.font = `900 ${size}px ${font}`; ctx.textAlign = align; ctx.fillStyle = ink; ctx.fillText(s, x, y);
};

const BLOCKS = [ // x, y, w, h, radius, colour, click time, content
  { x: 80, y: 300, w: 920, h: 110, r: 55, c: '#FFFFFF', at: 0.3, ink: c => { text(c, 'NEO/BRUTAL', 50, 74, 50); c.fillStyle = '#FF6B6B'; c.beginPath(); c.arc(860, 55, 26, 0, TAU); c.fill(); c.stroke(); } },
  { x: 80, y: 470, w: 920, h: 520, r: 28, c: '#FF8A65', at: 1.0, ink: c => { text(c, 'BOLD', 60, 230, 190); text(c, 'MOVES.', 60, 420, 150); } },
  { x: 80, y: 1060, w: 620, h: 140, r: 70, c: '#FFD23F', at: 1.75, ink: c => text(c, 'GET STARTED →', 310, 92, 56, FONT.black, 'center') },
  { x: 760, y: 1060, w: 240, h: 140, r: 28, c: '#A78BFA', at: 2.4, ink: c => text(c, '♥', 120, 100, 80, FONT.sans, 'center') },
  { x: 80, y: 1270, w: 440, h: 330, r: 28, c: '#4ECDC4', at: 3.05, ink: c => { text(c, '98%', 40, 170, 130); text(c, 'FASTER', 44, 260, 46, FONT.sans); } },
  { x: 560, y: 1270, w: 440, h: 330, r: 28, c: '#FFFFFF', at: 3.7, ink: (c, t) => {
    text(c, 'DARK', 40, 110, 64); text(c, 'MODE', 40, 180, 64);
    const on = ease.inOut(span(t, 3.75, 3.95)) - ease.inOut(span(t, 4.55, 4.75)); // the switch flips with the click
    c.fillStyle = on > 0.5 ? '#111' : '#E8E2D4'; c.beginPath(); c.roundRect(40, 220, 200, 80, 40); c.fill(); c.stroke();
    c.fillStyle = '#FFD23F'; c.beginPath(); c.arc(80 + 120 * on, 260, 30, 0, TAU); c.fill(); c.stroke();
  } },
  { x: 80, y: 1670, w: 280, h: 100, r: 50, c: '#9BE15D', at: 4.3, ink: c => text(c, '#bold', 140, 68, 50, FONT.sans, 'center') },
  { x: 400, y: 1670, w: 300, h: 100, r: 50, c: '#FF9DE2', at: 4.3, ink: c => text(c, '#loud', 150, 68, 50, FONT.sans, 'center') },
];

const mod5 = x => ((x % 5) + 5) % 5;
// 1 = standing up on its shadow, 0 = pressed flat; snaps down, then springs back with an overshoot
function lift(t, at) {
  const u = mod5(t - at);
  if (u < 0.1) return 1 - u / 0.1;
  if (u < 0.6) return ease.outBack((u - 0.1) / 0.5);
  return 1;
}

export default {
  name: 'Neubrutalism',
  ko: '뉴브루탈리즘',
  draw(ctx, t, W, H) {
    ctx.fillStyle = '#F6F1E7'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#E6DECD'; ctx.lineWidth = 3; // fixed background grid
    ctx.beginPath();
    for (let x = 0; x <= W; x += 60) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = 0; y <= H; y += 60) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();

    ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.textBaseline = 'alphabetic';
    for (const b of BLOCKS) {
      const off = S * (1 - lift(t, b.at));
      ctx.fillStyle = ink;
      ctx.beginPath(); ctx.roundRect(b.x + S, b.y + S, b.w, b.h, b.r); ctx.fill();
      ctx.save();
      ctx.translate(b.x + off, b.y + off);
      ctx.fillStyle = b.c; ctx.strokeStyle = ink;
      ctx.beginPath(); ctx.roundRect(0, 0, b.w, b.h, b.r); ctx.fill(); ctx.stroke();
      b.ink(ctx, t);
      ctx.restore();
    }

    const a = phase(t) * TAU; // a sticker that wobbles on the hero card
    ctx.save(); ctx.translate(880, 520); ctx.rotate(0.3 * Math.sin(a)); ctx.scale(1 + 0.06 * Math.sin(2 * a), 1 + 0.06 * Math.sin(2 * a));
    ctx.beginPath();
    for (let i = 0; i < 24; i++) { const r = i % 2 ? 78 : 112, q = i / 24 * TAU; ctx.lineTo(r * Math.cos(q), r * Math.sin(q)); }
    ctx.closePath(); ctx.fillStyle = '#FFD23F'; ctx.fill(); ctx.stroke();
    text(ctx, 'NEW', 0, 18, 46, FONT.black, 'center');
    ctx.restore();

    // the cursor glides to each block just before it is clicked, and dips when it clicks
    const targets = BLOCKS.slice(0, 7).map(b => [b.x + b.w * 0.72, b.y + b.h * 0.62, b.at]);
    let i = targets.findIndex(p => p[2] > t);
    if (i < 0) i = 0;
    const [x0, y0, at0] = targets[(i + 6) % 7], [x1, y1, at1] = targets[i];
    const since = mod5(t - at0), k = ease.inOut(span(since, 0.15, mod5(at1 - at0) - 0.05));
    const press = 1 - 0.14 * (since < 0.2 ? Math.sin(Math.PI * since / 0.2) : 0);
    ctx.save(); ctx.translate(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k); ctx.scale(press, press);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 92); ctx.lineTo(24, 70); ctx.lineTo(42, 110); ctx.lineTo(60, 102); ctx.lineTo(42, 64); ctx.lineTo(74, 62); ctx.closePath();
    ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.lineWidth = 6; ctx.stroke();
    ctx.restore();
  },
};
