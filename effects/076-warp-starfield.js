// Warp starfield: stars keep a fixed (x, y) while their depth z falls from 1 to 0 twice per loop (fract), so the field
// repeats; each one is a streak from where it projects now back to where it was a fixed depth earlier (long when close).
import { TAU, rng, phase, smoothstep } from '../lib/util.js';

const N = 1300, F = 420, CX = 540, CY = 1100, TAIL = 0.15;
const r = rng(76);
const stars = Array.from({ length: N }, () => ({
  a: r() * TAU, R: 0.18 + 1.5 * Math.sqrt(r()), z0: r(), hue: 195 + 80 * r() ** 2,
}));

export default {
  name: 'Warp Starfield',
  ko: '워프 스타필드',
  draw(ctx, t, W, H) {
    const bg = ctx.createRadialGradient(CX, CY, 0, CX, CY, H * 0.75);
    bg.addColorStop(0, '#2A1C72'); bg.addColorStop(0.35, '#0E0B3A'); bg.addColorStop(1, '#020210');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const pulse = 0.85 + 0.15 * Math.sin(phase(t) * TAU * 2);
    const core = ctx.createRadialGradient(CX, CY, 0, CX, CY, 320);
    core.addColorStop(0, `rgba(210, 225, 255, ${0.55 * pulse})`); core.addColorStop(0.3, 'rgba(120, 140, 255, 0.18)'); core.addColorStop(1, 'rgba(80, 60, 200, 0)');
    ctx.fillStyle = core; ctx.fillRect(0, 0, W, H);

    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const s of stars) {
      const z = ((s.z0 - 2 * phase(t)) % 1 + 1) % 1, Z = 0.04 + z;
      const r1 = s.R * F / Z, r2 = s.R * F / (Z + TAIL);
      if (r2 > 1400) continue;
      const near = 1 - z;
      const alpha = smoothstep(1.04, 0.6, Z) * smoothstep(0.04, 0.14, Z); // fade in far away, out as it passes
      const c = Math.cos(s.a), sn = Math.sin(s.a);
      const x1 = CX + c * r1, y1 = CY + sn * r1, x2 = CX + c * r2, y2 = CY + sn * r2;
      const g = ctx.createLinearGradient(x2, y2, x1, y1);
      g.addColorStop(0, `hsla(${s.hue}, 90%, 70%, 0)`); g.addColorStop(1, `hsla(${s.hue}, 80%, ${78 + 18 * near}%, ${alpha})`);
      ctx.strokeStyle = g;
      ctx.lineWidth = 2 + 4.5 * near * near;
      ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x1, y1); ctx.stroke();
    }
  },
};
