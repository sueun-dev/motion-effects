// Kawaii: flat pastel stickers with faces (a cloud on a rainbow, a star, a crescent moon, an onigiri, a purin and a
// strawberry) drawn with thick rounded brown outlines, dot eyes with shines and pink blush. They bounce with squash and
// stretch, blush harder as they land, and each squeezes its eyes into happy arcs once per loop; sparkles swell and
// fade around them and little hearts float up. The "kawaii" letters bob in a wave.
import { TAU, clamp, ease, fract, rng } from '../lib/util.js';

const INK = '#5A3B3B', BLUSH = '#FF8FAE';
// 0..1..0: eyes squeeze shut into happy arcs from `at` (0.35 s), hold 0.55 s, open again (0.35 s)
const happyAt = (t, at) => ease.inOut(clamp((t - at) / 0.35)) * (1 - ease.inOut(clamp((t - at - 0.9) / 0.35)));
const ROUND = '"Arial Rounded MT Bold", "Hiragino Maru Gothic ProN", sans-serif';

function outlined(ctx, fill, lw = 9) {
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
}

// a face centred at (0, 0): dot eyes that can squeeze into happy arcs (0..1), a small mouth, blush
function face(ctx, s, happy, blush, mouth = 'smile') {
  const ex = 34 * s, ey = 0, r = 11 * s;
  for (const x of [-ex, ex]) {
    const open = 1 - happy;
    if (open > 0.05) {
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(x, ey, r, r * 1.25 * open, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.globalAlpha = open; ctx.beginPath(); ctx.arc(x - r * 0.35, ey - r * 0.45 * open, r * 0.36, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    }
    if (happy > 0.05) { // ^ ^
      ctx.globalAlpha = happy; ctx.strokeStyle = INK; ctx.lineWidth = 6 * s; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(x, ey + 6 * s, r * 1.1, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); ctx.globalAlpha = 1;
    }
  }
  ctx.fillStyle = BLUSH; ctx.globalAlpha = 0.35 + 0.5 * blush;
  for (const x of [-ex - 22 * s, ex + 22 * s]) { ctx.beginPath(); ctx.ellipse(x, 22 * s, (15 + 5 * blush) * s, (9 + 3 * blush) * s, 0, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = INK; ctx.lineWidth = 5.5 * s; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  if (mouth === 'w') { ctx.moveTo(-14 * s, 16 * s); ctx.quadraticCurveTo(-7 * s, 28 * s, 0, 18 * s); ctx.quadraticCurveTo(7 * s, 28 * s, 14 * s, 16 * s); ctx.stroke(); }
  else if (mouth === 'open') { ctx.moveTo(-12 * s, 16 * s); ctx.quadraticCurveTo(0, 40 * s, 12 * s, 16 * s); ctx.closePath(); ctx.fillStyle = '#E8607A'; ctx.fill(); ctx.stroke(); }
  else { ctx.arc(0, 14 * s, 11 * s, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
}

const SHAPES = {
  cloud(ctx) {
    ctx.beginPath();
    for (const [x, y, r] of [[-150, 30, 80], [-70, -40, 105], [50, -60, 115], [150, 10, 85], [80, 60, 80], [-60, 70, 80]]) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
    ctx.save(); ctx.lineWidth = 18; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = '#FFFFFF'; ctx.fill(); // one outline for the whole puff
    ctx.clip(); ctx.fillStyle = '#DDEBFF'; ctx.beginPath(); ctx.ellipse(10, 140, 260, 70, 0, 0, TAU); ctx.fill(); ctx.restore();
  },
  star(ctx) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 58 : 118; ctx.lineTo(r * Math.cos(a), r * Math.sin(a)); }
    ctx.closePath(); outlined(ctx, '#FFE070');
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; ctx.beginPath(); ctx.ellipse(-40, -30, 14, 24, 0.6, 0, TAU); ctx.fill();
  },
  onigiri(ctx) {
    ctx.beginPath(); ctx.moveTo(0, -150);
    ctx.bezierCurveTo(60, -150, 150, 40, 150, 90); ctx.bezierCurveTo(150, 140, 110, 150, 0, 150);
    ctx.bezierCurveTo(-110, 150, -150, 140, -150, 90); ctx.bezierCurveTo(-150, 40, -60, -150, 0, -150);
    outlined(ctx, '#FFFFFF');
    ctx.save(); ctx.clip(); ctx.fillStyle = '#2F3B3A'; ctx.fillRect(-70, 70, 140, 90); ctx.restore();
    ctx.beginPath(); ctx.rect(-70, 70, 140, 82); ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = 'rgba(200, 220, 255, 0.5)'; ctx.beginPath(); ctx.ellipse(-60, -40, 12, 30, 0.5, 0, TAU); ctx.fill();
  },
  purin(ctx) {
    ctx.beginPath(); ctx.ellipse(0, 140, 175, 34, 0, 0, TAU); outlined(ctx, '#BFE3FF'); // the plate
    ctx.beginPath(); ctx.moveTo(-95, -60); ctx.lineTo(-130, 120); ctx.quadraticCurveTo(0, 150, 130, 120); ctx.lineTo(95, -60); ctx.quadraticCurveTo(0, -80, -95, -60);
    outlined(ctx, '#FFE08A');
    ctx.beginPath(); ctx.moveTo(-95, -60); ctx.quadraticCurveTo(0, -80, 95, -60); ctx.lineTo(102, -20); // caramel drips
    ctx.quadraticCurveTo(84, 10, 70, -12); ctx.quadraticCurveTo(50, 20, 30, -10); ctx.quadraticCurveTo(0, 26, -30, -8); ctx.quadraticCurveTo(-56, 18, -76, -12); ctx.quadraticCurveTo(-92, 4, -102, -20); ctx.closePath();
    outlined(ctx, '#C47A3A', 8);
    ctx.beginPath(); // whipped cream: one outline round three puffs
    for (const [x, y, r] of [[-26, -100, 32], [22, -104, 30], [0, -124, 30]]) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
    ctx.lineWidth = 16; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = '#FFFFFF'; ctx.fill();
    ctx.beginPath(); ctx.arc(10, -168, 22, 0, TAU); outlined(ctx, '#FF5A72', 7); // cherry
    ctx.beginPath(); ctx.moveTo(14, -188); ctx.quadraticCurveTo(24, -214, 44, -222); ctx.lineWidth = 6; ctx.stroke();
  },
  moon(ctx) { // a crescent: the outer arc of a big circle, then back along a smaller circle bitten out of it
    const r1 = 110, cx = 48, cy = -34, r2 = 92, d = Math.hypot(cx, cy), m = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const c = Math.atan2(cy, cx), k1 = Math.acos(m / r1), k2 = Math.acos((d - m) / r2);
    ctx.beginPath(); ctx.arc(0, 0, r1, c + k1, c - k1 + TAU); ctx.arc(cx, cy, r2, c + Math.PI + k2, c + Math.PI - k2, true); ctx.closePath();
    outlined(ctx, '#FFF0A6');
  },
  strawberry(ctx) {
    ctx.beginPath(); ctx.moveTo(0, 150);
    ctx.bezierCurveTo(-90, 120, -140, 20, -130, -40); ctx.bezierCurveTo(-120, -110, 120, -110, 130, -40); ctx.bezierCurveTo(140, 20, 90, 120, 0, 150);
    outlined(ctx, '#FF6F7D');
    const r = rng(6); ctx.fillStyle = '#FFE9A8';
    for (let i = 0; i < 16; i++) { const x = (r() - 0.5) * 200, y = -40 + r() * 150; if (Math.abs(x) < 120 - (y + 40) * 0.5 && (Math.abs(x) > 70 || y > 50)) { ctx.beginPath(); ctx.ellipse(x, y, 5, 8, 0, 0, TAU); ctx.fill(); } }
    ctx.beginPath(); // leaves
    for (let i = 0; i < 5; i++) { const a = Math.PI + i * Math.PI / 4; ctx.moveTo(0, -84); ctx.quadraticCurveTo(70 * Math.cos(a - 0.3), -84 + 70 * Math.sin(a - 0.3) * 0.6, 90 * Math.cos(a), -84 + 90 * Math.sin(a) * 0.55 + 20); ctx.quadraticCurveTo(70 * Math.cos(a + 0.3), -84 + 70 * Math.sin(a + 0.3) * 0.6, 0, -84); }
    outlined(ctx, '#7ED6A0', 8);
  },
};

// name, x, ground y, size, bounce height, phase, face offset y, mouth, when the eyes squeeze (s)
const CAST = [
  ['onigiri', 255, 1330, 0.8, 70, 0.0, 10, 'w', 1.0],
  ['purin', 545, 1400, 0.78, 50, 0.33, 40, 'open', 2.3],
  ['strawberry', 830, 1330, 0.78, 80, 0.66, 20, 'smile', 3.6],
];

function sparkle(ctx, x, y, size, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? size * 0.28 : size; ctx.lineTo(r * Math.cos(a), r * Math.sin(a)); }
  ctx.closePath(); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.lineWidth = Math.min(4, size * 0.15); ctx.strokeStyle = '#FFB4CB'; ctx.stroke();
  ctx.restore();
}

function heart(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(0, 12); ctx.bezierCurveTo(-30, -8, -18, -34, 0, -20); ctx.bezierCurveTo(18, -34, 30, -8, 0, 12);
  ctx.fillStyle = '#FF7FA3'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
  ctx.restore();
}

export default {
  name: 'Kawaii',
  ko: '카와이',
  draw(ctx, t, W, H) {
    const a = t / 5 * TAU;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#FFD9E6'); bg.addColorStop(1, '#FFF1DC');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'; // polka dots
    for (let y = 0, row = 0; y < H + 60; y += 64, row++) for (let x = (row % 2) * 40; x < W + 60; x += 80) { ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.fill(); }

    // rainbow and the cloud floating on it
    const cy = 600 + 14 * Math.sin(a);
    ['#FFB3C7', '#FFD8A8', '#FFF3B0', '#C8F0C8', '#BFE3FF', '#D9C8FF'].forEach((c, i) => {
      ctx.strokeStyle = c; ctx.lineWidth = 30; ctx.beginPath(); ctx.arc(540, 800, 380 - i * 30, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke();
    });
    ctx.save(); ctx.translate(540, cy); ctx.rotate(0.03 * Math.sin(a + 1));
    SHAPES.cloud(ctx);
    face(ctx, 1.1, happyAt(t, 0.1), 0.5 + 0.5 * Math.sin(a) ** 2, 'w');
    ctx.restore();

    // the star swings and bobs at the upper left, a sleepy crescent moon rocks at the upper right
    ctx.save(); ctx.translate(175, 905 + 16 * Math.sin(a * 2 + 1)); ctx.rotate(0.22 * Math.sin(a * 2)); ctx.scale(0.75, 0.75);
    SHAPES.star(ctx); face(ctx, 0.75, happyAt(t, 2.9), 0.6 + 0.4 * Math.sin(a * 2) ** 2, 'smile');
    ctx.restore();
    ctx.save(); ctx.translate(870, 930 + 14 * Math.sin(a * 2 + 2.5)); ctx.rotate(-0.3 + 0.15 * Math.sin(a * 2 + 1.5)); ctx.scale(0.8, 0.8);
    SHAPES.moon(ctx); ctx.translate(-48, 34); ctx.rotate(0.5); face(ctx, 0.6, 1, 0.7, 'smile');
    ctx.restore();

    // the three bouncers: a parabola every 1.25 s, squashed at contact, stretched when fast
    for (const [name, x, gy, size, hop, ph, fy, mouth, smile] of CAST) {
      const u = fract(t / 1.25 + ph), h = 4 * u * (1 - u) * hop;
      const contact = Math.exp(-((Math.min(u, 1 - u) / 0.07) ** 2)), speed = Math.abs(1 - 2 * u);
      const sy = 1 - 0.13 * contact + 0.06 * speed * (1 - contact), sx = 1 / sy;
      ctx.fillStyle = 'rgba(200, 120, 140, 0.22)'; // ground shadow, smaller when high
      ctx.beginPath(); ctx.ellipse(x, gy + 6, 120 * size * (1 - h / hop * 0.35), 18 * size, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(x, gy - h); ctx.scale(sx * size, sy * size); ctx.translate(0, -150);
      SHAPES[name](ctx);
      ctx.translate(0, fy); face(ctx, 1, happyAt(t, smile), contact, mouth);
      ctx.restore();
    }

    // sparkles that swell, turn and shrink away, and hearts floating up
    const r = rng(12);
    for (let i = 0; i < 12; i++) {
      const x = 80 + r() * 920, y = 340 + r() * 1150, q = fract(t / 1.25 + r()), k = Math.sin(q * Math.PI) ** 2;
      if (k > 0.01) sparkle(ctx, x, y, 30 * k, q * Math.PI / 2); // grows from nothing
    }
    for (let i = 0; i < 6; i++) {
      const q = fract(t / 2.5 + i / 6), x = 140 + (i * 167) % 800 + 20 * Math.sin(q * TAU + i), y = 1500 - 420 * q;
      ctx.globalAlpha = Math.sin(q * Math.PI); heart(ctx, x, y, 0.9 + 0.3 * Math.sin(q * Math.PI)); ctx.globalAlpha = 1;
    }

    // the word, each letter bobbing in a wave
    ctx.font = `700 170px ${ROUND}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    const word = 'kawaii', cols = ['#FF8FB1', '#FFC56E', '#8ED8B5', '#8FC3FF', '#C9A7FF', '#FF8FB1'];
    const ws = [...word].map(ch => ctx.measureText(ch).width);
    let x = W / 2 - (ws.reduce((s, w) => s + w, 0) + 8 * (word.length - 1)) / 2;
    [...word].forEach((ch, i) => {
      const y = 1730 - 26 * Math.max(0, Math.sin(a * 2 - i * 0.6)) ** 2;
      ctx.lineWidth = 22; ctx.strokeStyle = INK; ctx.strokeText(ch, x + ws[i] / 2, y);
      ctx.fillStyle = cols[i]; ctx.fillText(ch, x + ws[i] / 2, y);
      x += ws[i] + 8;
    });
    ctx.font = `400 64px ${'"Hiragino Maru Gothic ProN", sans-serif'}`; ctx.fillStyle = INK;
    ctx.fillText('か わ い い', W / 2, 1830);
  },
};
