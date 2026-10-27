// Infinite zoom (Droste): a gallery wall whose framed painting is the same picture again, scaled by R and
// turned by TURN. The view zooms by 1/R (and turns back by TURN) per loop, so frame 150 is exactly frame 0.
import { phase, smoothstep, FONT } from '../lib/util.js';

const R = 0.5, TURN = 8, CX = 540, CY = 1060;                 // nesting scale, degrees per level, fixed point
const nest = new DOMMatrix().translate(CX, CY).rotate(TURN).scale(R).translate(-CX, -CY);
const OPEN = [CX - CX * R, CY - CY * R, 1080 * R, 1920 * R];   // where the whole picture lands inside itself

// the picture itself, in its own 1080 x 1920 coordinates; s = its scale on screen (for shadow sizes)
function picture(ctx, s) {
  const wall = ctx.createLinearGradient(0, 0, 0, 1920);
  wall.addColorStop(0, '#F6D2AE'); wall.addColorStop(1, '#E8AE84');
  ctx.fillStyle = wall; ctx.fillRect(0, 0, 1080, 1920);
  const spot = ctx.createRadialGradient(CX, 420, 40, CX, 700, 900); // picture light from above
  spot.addColorStop(0, 'rgba(255, 250, 235, 0.75)'); spot.addColorStop(1, 'rgba(255, 250, 235, 0)');
  ctx.fillStyle = spot; ctx.fillRect(0, 0, 1080, 1920);
  ctx.fillStyle = '#C46E55'; ctx.fillRect(0, 1640, 1080, 280);  // wainscot
  ctx.fillStyle = '#A9563F'; ctx.fillRect(0, 1640, 1080, 22);
  ctx.fillStyle = '#7A3B2C'; ctx.fillRect(0, 1840, 1080, 80);   // floor

  ctx.fillStyle = '#3E6B4A'; // a potted plant on each side
  for (const x of [120, 960]) {
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(x + i * 26, 1560 + Math.abs(i) * 20, 34, 120, i * 0.35, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#E9E2D6'; ctx.beginPath(); ctx.roundRect(x - 70, 1650, 140, 190, [8, 8, 30, 30]); ctx.fill();
    ctx.fillStyle = '#3E6B4A';
  }
  ctx.fillStyle = '#2E2A28'; ctx.beginPath(); ctx.roundRect(CX - 80, 1590, 160, 60, 10); ctx.fill(); // plaque
  ctx.fillStyle = '#F2C66D'; ctx.font = `700 46px ${FONT.sans}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('∞', CX, 1622);

  // the frame, turned TURN degrees around the fixed point
  ctx.save();
  ctx.translate(CX, CY); ctx.rotate(TURN * Math.PI / 180); ctx.translate(-CX, -CY);
  const [x, y, w, h] = OPEN, F = 48;
  ctx.shadowColor = 'rgba(70, 30, 10, 0.45)'; ctx.shadowBlur = 50 * s; ctx.shadowOffsetY = 24 * s;
  const gold = ctx.createLinearGradient(x - F, y - F, x + w + F, y + h + F);
  gold.addColorStop(0, '#FFE39A'); gold.addColorStop(0.5, '#C98F2E'); gold.addColorStop(1, '#F5CF6E');
  ctx.fillStyle = gold; ctx.fillRect(x - F, y - F, w + 2 * F, h + 2 * F);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#9A6420'; ctx.fillRect(x - 16, y - 16, w + 32, h + 32);
  ctx.fillStyle = '#2A1A10'; ctx.fillRect(x, y, w, h); // covered by the next level
  ctx.restore();
}

export default {
  name: 'Infinite Zoom',
  ko: '인피니트 줌',
  draw(ctx, t, W, H) {
    const p = phase(t);
    const view = new DOMMatrix().translate(CX, CY).rotate(-TURN * p).scale(R ** -p).translate(-CX, -CY);
    ctx.fillStyle = '#2A1A10'; ctx.fillRect(0, 0, W, H);
    let m = view.multiply(nest.inverse()); // level -1 (twice the size) covers the corners when turned
    for (let k = -1; k < 12; k++, m = m.multiply(nest)) {
      const s = R ** (k - p);
      if (s * 1080 < 4) break;
      ctx.save();
      ctx.setTransform(m);
      ctx.globalAlpha = smoothstep(0.004, 0.014, s); // the tiniest levels fade in instead of popping
      picture(ctx, s);
      ctx.restore();
    }
    const glow = ctx.createRadialGradient(CX, CY, 0, CX, CY, 70); // light at the vanishing point (fixed size)
    glow.addColorStop(0, 'rgba(255, 236, 190, 0.9)'); glow.addColorStop(1, 'rgba(255, 236, 190, 0)');
    ctx.fillStyle = glow; ctx.fillRect(CX - 70, CY - 70, 140, 140);
  },
};
