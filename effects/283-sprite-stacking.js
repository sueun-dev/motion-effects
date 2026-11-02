// Sprite stacking: a little house is nothing but 19 flat 16 x 16 pixel images (slices of a voxel model). Each frame
// the slices are drawn bottom to top, every one rotated by the same angle, squashed for the tilted view and lifted a
// few pixels above the last; stacked tight, the edges of the slices read as walls and the house looks solid. Every
// slice pixel is a filled, rotated square (one path per colour), so the turn is smooth and nothing crawls. Midway the
// slices fan apart to show they are separate sheets, a glow walks up through them, and they close up again; the
// sprite sheet below holds the same 19 images. The loop starts fanned out.
import { TAU, FONT, phase, clamp, smoothstep, ease, span } from '../lib/util.js';

const NX = 16, NZ = 19, S = 20, SQ = 0.62;               // slice size, slice count, px per pixel, view squash
const LH0 = 14, LH1 = 40;                                 // lift per slice: stacked tight / fanned out

// the voxel model: colour of pixel (i, j) in slice k, or null
function voxel(i, j, k) {
  const corner = (i === 0 || i === 15) && (j === 0 || j === 15);
  const inHouse = i >= 3 && i <= 12 && j >= 3 && j <= 11, ring = inHouse && (i === 3 || i === 12 || j === 3 || j === 11);
  const tree = Math.hypot(i - 14, j - 13.5, (k - 7.2) * 1.15);
  if (k === 0) return corner ? null : '#7B5034';                                   // dirt
  if (k === 1) {                                                                  // grass, path and flowers
    if (corner) return null;
    if (i >= 7 && i <= 8 && j >= 12) return '#E8CF9C';
    if ([[2, 13], [5, 14], [12, 1], [1, 6], [14, 4]].some(([a, b]) => a === i && b === j)) return (i + j) % 2 ? '#FF8FB8' : '#FFE45C';
    return '#5DBB4C';
  }
  if (i === 14 && j === 13 && k <= 6) return '#7A4A2A';                           // the tree
  if (tree < 2.6 && k >= 5) return tree < 1.6 && k >= 8 ? '#6CCB5C' : '#3FA34D';
  if (i >= 10 && i <= 11 && j >= 5 && j <= 6 && k >= 10) return k === 18 ? '#4A4A52' : '#9A9AA4';   // chimney
  if (k === 2 && inHouse) return ring ? '#9C6B43' : '#C89A6A';                    // floor
  if (k >= 3 && k <= 8 && ring) {                                                 // walls with a door and windows
    if ((i === 3 || i === 12) && (j === 3 || j === 11)) return '#9C6B43';
    if (j === 11 && i >= 7 && i <= 8 && k <= 6) return k === 6 ? '#5A3520' : '#8A5530';
    const win = (j === 11 && (i === 4 || i === 5 || i === 10 || i === 11)) || ((i === 3 || i === 12) && j >= 6 && j <= 8) || (j === 3 && i >= 6 && i <= 9);
    if (win && k >= 4 && k <= 6) return k === 5 ? '#BDEBFF' : '#8FD3FF';
    return k === 8 ? '#E2CBA4' : '#F2E2C4';
  }
  if (k === 9 && i >= 2 && i <= 13 && j >= 2 && j <= 12) return '#A83A32';         // eaves
  if (k >= 10 && k <= 15) {                                                       // gable roof, ridge along j
    const r = k - 10;
    if (i >= 2 + r && i <= 13 - r && j >= 2 && j <= 12) return r === 5 ? '#F28C7A' : j === 2 || j === 12 ? '#B84238' : '#D9534A';
  }
  return null;
}
// each slice: { colour: [[i, j], ...] }
const SLICES = Array.from({ length: NZ }, (_, k) => {
  const m = {};
  for (let j = 0; j < NX; j++) for (let i = 0; i < NX; i++) { const c = voxel(i, j, k); if (c) (m[c] ||= []).push([i, j]); }
  return m;
});
const shade = (hex, f) => `rgb(${[1, 3, 5].map(p => Math.round(Math.min(255, parseInt(hex.slice(p, p + 2), 16) * f))).join(',')})`;

// fanned out across the loop point: closing 0.7 - 1.7 s, stacked until 3 s, opening 3 - 4 s
const spread = t => 1 - ease.inOut(span(t, 0.7, 1.7)) + ease.inOut(span(t, 3.0, 4.0));    // 0 stacked .. 1 fanned
const glowAt = t => -2 + (NZ + 3) * (((t + 1) % 5) / 1.7);                                 // walks up the slices from 4 s to 0.7 s

export default {
  name: 'Sprite Stacking',
  ko: '스프라이트 스태킹',
  draw(ctx, t, W, H) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1C1A33'); bg.addColorStop(1, '#2E2547');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    const a = phase(t) * TAU + 0.5, sp = spread(t), lh = LH0 + (LH1 - LH0) * sp, g = glowAt(t);
    const cx = 540, cy = 1240 + 90 * sp, c = Math.cos(a), s = Math.sin(a);
    // the shadow on the floor
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath(); ctx.ellipse(cx, cy + 24, 245, 245 * SQ, 0, 0, TAU); ctx.fill();
    // bottom to top: every slice rotated by a, squashed, lifted by k * lh
    for (let k = 0; k < NZ; k++) {
      const y0 = cy - k * lh, hi = Math.exp(-(((k - g) / 0.8) ** 2));
      ctx.setTransform(S * c, S * s * SQ, -S * s, S * c * SQ, cx, y0);
      if (sp > 0.01) {                                                   // the sheet each slice is drawn on
        ctx.fillStyle = `rgba(255, 255, 255, ${0.05 * sp + 0.12 * hi})`; ctx.fillRect(-8, -8, 16, 16);
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.35 * sp + 0.5 * hi})`; ctx.lineWidth = 1.6 / S;
        ctx.strokeRect(-8, -8, 16, 16);
      }
      const f = 0.72 + 0.28 * k / (NZ - 1) + 0.35 * hi;                  // lower slices a little darker
      for (const [col, px] of Object.entries(SLICES[k])) {
        ctx.fillStyle = shade(col, f);
        ctx.beginPath();
        for (const [i, j] of px) ctx.rect(i - 8, j - 8, 1, 1);
        ctx.fill();
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // slice numbers beside the fanned stack
    if (sp > 0.01) {
      ctx.font = `600 22px ${FONT.mono}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (let k = 0; k < NZ; k += 3) {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.7 * sp})`;
        ctx.fillText(String(k), cx - 290, cy - k * lh);
      }
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; ctx.font = `600 27px ${FONT.sans}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('19 flat images, drawn bottom to top,', 540, 340);
    ctx.fillText('each one rotated and lifted a little', 540, 378);

    // the sprite sheet: the same 19 slices as they are stored
    const PX = 4.5, CELL = PX * NX, GAP = 14, X0 = (W - (10 * CELL + 9 * GAP)) / 2, Y0 = 1560;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'; ctx.beginPath(); ctx.roundRect(40, 1500, 1000, 370, 24); ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; ctx.font = `700 24px ${FONT.sans}`; ctx.textAlign = 'left';
    ctx.fillText('SPRITE SHEET · 19 SLICES × 16 × 16 px', 70, 1542);
    for (let k = 0; k < NZ; k++) {
      const x = X0 + (k % 10) * (CELL + GAP) + (k >= 10 ? (CELL + GAP) / 2 : 0), y = Y0 + Math.floor(k / 10) * 150;
      const hi = Math.exp(-(((k - g) / 0.8) ** 2));
      ctx.fillStyle = '#16142A'; ctx.fillRect(x, y, CELL, CELL);
      for (const [col, px] of Object.entries(SLICES[k])) {
        ctx.fillStyle = col;
        ctx.beginPath();
        for (const [i, j] of px) ctx.rect(x + i * PX, y + j * PX, PX, PX);
        ctx.fill();
      }
      ctx.strokeStyle = `rgba(255, 216, 77, ${0.25 + 0.75 * hi})`; ctx.lineWidth = 2 + 3 * hi;
      ctx.strokeRect(x - 1, y - 1, CELL + 2, CELL + 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + 0.5 * hi})`; ctx.font = `600 19px ${FONT.mono}`; ctx.textAlign = 'center';
      ctx.fillText(String(k), x + CELL / 2, y + CELL + 26);
    }
  },
};
