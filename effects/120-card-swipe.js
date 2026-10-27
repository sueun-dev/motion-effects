// Card stack: a finger drags the top card sideways (it tilts, a LIKE / NOPE stamp fades in), lets go and the card flies
// off while the cards behind scale up one slot. Right swipe, then left swipe; the two profiles alternate, so it loops.
import { TAU, FONT, canvas, clamp, ease, lerp, smoothstep } from '../lib/util.js';
import { landscape } from '../lib/scenes.js';

const CW = 860, CH = 1160, CX = 540, CY = 1010;
const PROFILES = [{ name: '지우, 27', sub: '디자이너 · 2km', tags: ['여행', '사진', '카페'] },
  { name: '민준, 29', sub: '사진가 · 5km', tags: ['캠핑', '재즈', '러닝'] }];
const SLOT = [[1, 0], [0.95, 66], [0.9, 132]]; // scale, y offset of the cards behind
const photos = [];

// the top card's drag for swipe n (u = seconds into it): offset, tilt, and how far the stack has moved up
function swipe(u, dir) {
  const drag = 280 * ease.inOut(clamp((u - 0.35) / 0.75)), fly = 1250 * clamp((u - 1.1) / 0.5) ** 2;
  const dx = dir * (drag + fly);
  return { dx, dy: -0.06 * Math.abs(dx), rot: dx * 0.0005, p: ease.out(clamp(Math.abs(dx) / 520)) };
}

function card(ctx, prof, pic, x, y, s, rot, shade) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.shadowColor = 'rgba(40, 10, 40, 0.3)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 20;
  ctx.fillStyle = '#FFF'; ctx.beginPath(); ctx.roundRect(-CW / 2, -CH / 2, CW, CH, 48); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.clip();
  ctx.drawImage(photos[pic], -CW / 2, -CH / 2);
  const g = ctx.createLinearGradient(0, 0, 0, CH / 2);
  g.addColorStop(0, 'rgba(15, 5, 30, 0)'); g.addColorStop(1, 'rgba(15, 5, 30, 0.85)');
  ctx.fillStyle = g; ctx.fillRect(-CW / 2, 0, CW, CH / 2);
  ctx.textAlign = 'left'; ctx.fillStyle = '#FFF'; ctx.font = `800 76px ${FONT.ko}`; ctx.fillText(prof.name, -CW / 2 + 56, CH / 2 - 210);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'; ctx.font = `500 38px ${FONT.ko}`; ctx.fillText(prof.sub, -CW / 2 + 56, CH / 2 - 150);
  ctx.font = `600 32px ${FONT.ko}`;
  let tx = -CW / 2 + 56;
  for (const tag of prof.tags) {
    const w = ctx.measureText(tag).width + 56;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)'; ctx.beginPath(); ctx.roundRect(tx, CH / 2 - 112, w, 64, 32); ctx.fill();
    ctx.fillStyle = '#FFF'; ctx.fillText(tag, tx + 28, CH / 2 - 69);
    tx += w + 16;
  }
  if (shade > 0) { ctx.fillStyle = `rgba(30, 10, 40, ${shade})`; ctx.fillRect(-CW / 2, -CH / 2, CW, CH); }
  ctx.restore();
}

function stamp(ctx, text, color, x, y, rot, a) {
  if (a <= 0) return;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = a;
  ctx.strokeStyle = color; ctx.lineWidth = 10; ctx.beginPath(); ctx.roundRect(-150, -62, 300, 124, 20); ctx.stroke();
  ctx.fillStyle = color; ctx.font = `900 88px ${FONT.black}`; ctx.textAlign = 'center'; ctx.fillText(text, 0, 32);
  ctx.restore();
}

function button(ctx, x, y, r, color, icon, s) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  ctx.shadowColor = 'rgba(40, 10, 40, 0.25)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
  ctx.fillStyle = '#FFF'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 12; ctx.lineCap = 'round';
  ctx.beginPath();
  if (icon === 'x') { ctx.moveTo(-26, -26); ctx.lineTo(26, 26); ctx.moveTo(26, -26); ctx.lineTo(-26, 26); ctx.stroke(); }
  else if (icon === 'star') { for (let i = 0; i < 10; i++) { const a = i / 10 * TAU - TAU / 4, rr = i % 2 ? 14 : 32; ctx.lineTo(rr * Math.cos(a), rr * Math.sin(a)); } ctx.fill(); }
  else { for (let i = 0; i <= 60; i++) { const a = i / 60 * TAU; ctx.lineTo(30 * Math.sin(a) ** 3, -30 * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 16 - 3); } ctx.fill(); }
  ctx.restore();
}

export default {
  name: 'Card Swipe',
  ko: '카드 스와이프',
  setup() {
    for (const [filter, ct] of [['none', 0], ['hue-rotate(150deg) saturate(0.9)', 2.5]]) {
      const big = canvas(CW, 1500), c = canvas(CW, CH);
      landscape(big.getContext('2d'), CW, 1500, ct);
      const g = c.getContext('2d');
      g.filter = filter; g.drawImage(big, 0, 220, CW, CH, 0, 0, CW, CH);
      photos.push(c);
    }
  },
  draw(ctx, t, W, H) {
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#FFE1EC'); bg.addColorStop(1, '#FFD0B5');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    const n = Math.floor(t / 2.5), dir = n ? -1 : 1, sw = swipe(t - n * 2.5, dir);
    for (let k = 3; k >= 1; k--) { // the cards behind, each moving up one slot as the top card leaves
      const [s0, y0] = SLOT[Math.min(k, 2)], [s1, y1] = SLOT[k - 1];
      const s = lerp(s0, s1, sw.p), yo = lerp(y0, y1, sw.p), alpha = k === 3 ? sw.p : 1;
      ctx.save(); ctx.globalAlpha = alpha;
      card(ctx, PROFILES[(n + k) % 2], (n + k) % 2, CX, CY + yo, s, 0, 0.18 * lerp(Math.min(k, 2), k - 1, sw.p) / 2);
      ctx.restore();
    }
    const x = CX + sw.dx, y = CY + sw.dy;
    card(ctx, PROFILES[n % 2], n % 2, x, y, 1, sw.rot, 0);
    const a = clamp(Math.abs(sw.dx) / 180);
    ctx.save(); ctx.translate(x, y); ctx.rotate(sw.rot);
    if (dir > 0) stamp(ctx, 'LIKE', '#2BD47D', -CW / 2 + 210, -CH / 2 + 150, -0.26, a);
    else stamp(ctx, 'NOPE', '#FF4D6A', CW / 2 - 210, -CH / 2 + 150, 0.26, a);
    ctx.restore();

    const u = t - n * 2.5, hl = 0.16 * a * (1 - smoothstep(1.15, 1.5, u)); // the matching button swells while dragging
    button(ctx, 300, 1780, 78, '#FF4D6A', 'x', 1 + (dir < 0) * hl);
    button(ctx, 540, 1780, 58, '#3FA9FF', 'star', 1);
    button(ctx, 780, 1780, 78, '#2BD47D', 'heart', 1 + (dir > 0) * hl);

    // finger: lands on the card, drags with it, lifts off on release
    const fa = smoothstep(0.1, 0.35, u) * (1 - smoothstep(1.1, 1.3, u));
    if (fa > 0) {
      const d = Math.min(Math.abs(sw.dx), 290) * dir;
      ctx.globalAlpha = fa;
      ctx.fillStyle = 'rgba(40, 10, 40, 0.3)'; ctx.beginPath(); ctx.arc(CX + 40 + d, 1160 + sw.dy, 52, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#FFF'; ctx.lineWidth = 5; ctx.stroke();
      ctx.globalAlpha = 1;
    }
  },
};
