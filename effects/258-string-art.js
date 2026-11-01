// String art: 200 brass nails on a circle, and one thread per nail stretched from nail i to nail 2i (mod 200). Each
// thread is a plain straight line, but together their envelope is a cardioid (the times-two table on a circle).
// The threads are wound in order, then unwound in the same order; the last ones are still coming off while the first
// go back on, so the loop never stops. Threads add up in light, so the curve glows where they crowd.
import { TAU, clamp, lerp, span, ease, rng, noise3, canvas, FONT } from '../lib/util.js';

const N = 200, CX = 540, CY = 1000, R = 410, BOARD = 470, D = 0.32; // nails, centre, radii, seconds per thread
const nail = i => { const a = Math.PI / 2 + (i / N) * TAU; return [CX + R * Math.cos(a), CY + R * Math.sin(a)]; };
const WIND = i => (i / N) * 2.4;               // thread i starts going on ...
const UNWIND = i => 3.35 + (i / N) * 1.6;      // ... and starts coming off (the last ones finish after the loop wraps)
const TINT = [[255, 77, 109], [255, 140, 90], [255, 209, 102]]; // thread colour along the winding order
const tint = k => { const x = k * 2, i = Math.min(1, Math.floor(x)), f = x - i; return TINT[i].map((c, j) => lerp(c, TINT[i + 1][j], f) | 0); };

// the board: dark walnut with a fixed grain, a bevelled rim and a soft shadow on the wall (drawn once)
const board = canvas(1160, 1160);
{
  const g = board.getContext('2d'), c = 580;
  g.fillStyle = 'rgba(40, 24, 16, 0.35)'; g.filter = 'blur(28px)';
  g.beginPath(); g.arc(c + 14, c + 30, BOARD, 0, TAU); g.fill(); g.filter = 'none';
  const img = g.createImageData(1160, 1160), px = img.data;
  for (let y = 0; y < 1160; y++) for (let x = 0; x < 1160; x++) {
    const dx = x - c, dy = y - c, r = Math.hypot(dx, dy);
    if (r > BOARD) continue;
    const grain = Math.sin((y + 40 * noise3(x / 260, y / 90, 3)) * 0.11 + 6 * noise3(x / 500, y / 140, 7)); // wavy grain lines
    const v = 0.5 + 0.5 * grain, fine = noise3(x / 3, y / 40, 1) * 0.5;
    const rim = r > BOARD - 14 ? (dx * -0.5 + dy * -0.8) / r * 0.5 : 0; // the bevel: lit top left, dark bottom right
    const k = 1 + 0.18 * v + 0.08 * fine + rim;
    const o = (y * 1160 + x) * 4, a = clamp(BOARD - r); // antialiased edge
    px[o] = 52 * k; px[o + 1] = 33 * k; px[o + 2] = 26 * k; px[o + 3] = 255 * a;
  }
  const tmp = canvas(1160, 1160); tmp.getContext('2d').putImageData(img, 0, 0);
  g.drawImage(tmp, 0, 0);
  const sheen = g.createRadialGradient(c - 160, c - 220, 40, c, c, BOARD);
  sheen.addColorStop(0, 'rgba(255, 220, 180, 0.10)'); sheen.addColorStop(1, 'rgba(255, 220, 180, 0)');
  g.fillStyle = sheen; g.beginPath(); g.arc(c, c, BOARD, 0, TAU); g.fill();
}
// one brass nail head, drawn once and stamped 200 times
const head = canvas(28, 28);
{
  const g = head.getContext('2d');
  g.fillStyle = 'rgba(0, 0, 0, 0.45)'; g.beginPath(); g.arc(16, 17, 7, 0, TAU); g.fill();
  const m = g.createRadialGradient(11, 10, 1, 13, 13, 8);
  m.addColorStop(0, '#FFF3C4'); m.addColorStop(0.45, '#D9A441'); m.addColorStop(1, '#6B4A16');
  g.fillStyle = m; g.beginPath(); g.arc(13, 13, 7, 0, TAU); g.fill();
}
// a fixed paper-like texture for the wall
const wall = canvas();
{
  const g = wall.getContext('2d'), r = rng(5);
  const bg = g.createLinearGradient(0, 0, 0, 1920);
  bg.addColorStop(0, '#EFE6DA'); bg.addColorStop(1, '#E2D5C4');
  g.fillStyle = bg; g.fillRect(0, 0, 1080, 1920);
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(90, 60, 30, ${0.02 + r() * 0.03})`; g.fillRect(r() * 1080, r() * 1920, 2, 2); }
}

export default {
  name: 'String Art',
  ko: '스트링 아트',
  draw(ctx, t, W, H) {
    ctx.drawImage(wall, 0, 0);
    ctx.drawImage(board, CX - 580, CY - 580);

    // each thread: the part between where it is coming off (from) and how far it has gone on (to), along nail i -> 2i
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round'; ctx.lineWidth = 2.4;
    let wound = 0;
    const tips = [];
    for (let i = 0; i < N; i++) {
      const local = (((t - WIND(i)) % 5) + 5) % 5;             // seconds since this thread started going on
      const to = ease.out(span(local, 0, D)), from = ease.inOut(span(local, UNWIND(i) - WIND(i), UNWIND(i) - WIND(i) + D));
      if (to >= 1 && from <= 0) wound++;
      if (to <= from) continue;
      const [x0, y0] = nail(i), [x1, y1] = nail((2 * i) % N), [r, g, b] = tint(i / N);
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.55)`;
      ctx.beginPath();
      ctx.moveTo(lerp(x0, x1, from), lerp(y0, y1, from)); ctx.lineTo(lerp(x0, x1, to), lerp(y0, y1, to));
      ctx.stroke();
      if (to < 1) tips.push([lerp(x0, x1, to), lerp(y0, y1, to), Math.sin(Math.PI * to)]);
    }
    for (const [x, y, a] of tips) { // the running end of each thread going on
      ctx.fillStyle = `rgba(255, 240, 200, ${0.8 * a})`;
      ctx.beginPath(); ctx.arc(x, y, 3.5, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    for (let i = 0; i < N; i++) { const [x, y] = nail(i); ctx.drawImage(head, x - 13, y - 13); }

    // caption
    ctx.textAlign = 'center';
    ctx.fillStyle = '#3B2A22'; ctx.font = `700 64px ${FONT.display}`;
    ctx.fillText('CARDIOID', W / 2, 1610);
    ctx.fillStyle = 'rgba(59, 42, 34, 0.7)'; ctx.font = `500 34px ${FONT.mono}`;
    ctx.fillText('nail i  →  nail 2i  (mod 200)', W / 2, 1666);
    ctx.font = `500 28px ${FONT.mono}`; ctx.fillStyle = 'rgba(59, 42, 34, 0.5)';
    ctx.fillText(`${String(wound).padStart(3, ' ')} / 200 threads · all straight`, W / 2, 1714);
  },
};
