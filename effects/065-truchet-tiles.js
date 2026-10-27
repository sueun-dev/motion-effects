// Truchet tiles (Smith tiles): every square holds two quarter-circle arcs joining edge midpoints, so neighbours link
// into long winding paths. Tiles make two eased quarter turns per loop in a diagonal wave (180 degrees = the same tile).
import { rng, ease, clamp, TAU } from '../lib/util.js';

const S = 120, COLS = 9, ROWS = 16, TURN = 0.55;
const tiles = [];
{
  const r = rng(65);
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
    const wave = (i + j) / (COLS + ROWS - 2);       // 0 at the top left, 1 at the bottom right
    tiles.push({ i, j, flip: r() < 0.5, t1: 0.15 + wave * 1.55 + r() * 0.2 }); // both turns end before t = 5
  }
}

export default {
  name: 'Truchet Tiles',
  ko: '트루셰 타일',
  draw(ctx, t, W, H) {
    ctx.fillStyle = '#14112B'; ctx.fillRect(0, 0, W, H);
    const ox = (W - COLS * S) / 2, oy = (H - ROWS * S) / 2;
    for (const tl of tiles) {
      const k = ease.inOut(clamp((t - tl.t1) / TURN)) + ease.inOut(clamp((t - tl.t1 - 2.5) / TURN));
      const turning = Math.sin(Math.PI * (k % 1));   // 0 when settled, 1 mid-turn
      const cx = ox + (tl.i + 0.5) * S, cy = oy + (tl.j + 0.5) * S;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((tl.flip ? Math.PI / 2 : 0) + k * Math.PI / 2);
      ctx.scale(1 - 0.12 * turning, 1 - 0.12 * turning);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.025 + 0.05 * turning})`;
      ctx.beginPath(); ctx.roundRect(-S / 2 + 3, -S / 2 + 3, S - 6, S - 6, 14); ctx.fill();
      const hue = 190 + 130 * ((tl.i + tl.j * 0.6) / (COLS + ROWS * 0.6));
      for (const [w, light] of [[34, 30], [20, 62]]) {   // a dark rim under a bright core: a tube
        ctx.strokeStyle = `hsl(${hue}, 85%, ${light + 10 * turning}%)`;
        ctx.lineWidth = w;
        ctx.beginPath(); ctx.arc(-S / 2, -S / 2, S / 2, 0, TAU / 4); ctx.stroke();
        ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2, TAU / 2, TAU * 3 / 4); ctx.stroke();
      }
      ctx.restore();
    }
  },
};
