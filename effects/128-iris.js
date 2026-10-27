// Iris: a circular clip closes on the outgoing scene (pausing for a beat around the sun or moon), shuts, then
// opens again on the next scene from its own point of interest. A glowing ring traces the iris edge.
import { W, H, TAU, span, ease, lerp, smoothstep, canvas } from '../lib/util.js';
import { landscape, city } from '../lib/scenes.js';

const A = canvas(), B = canvas();
city(B.getContext('2d'), W, H);
const SUN = [W * 0.5, H * 0.37], MOON = [W * 0.72, H * 0.2];
const reach = ([x, y]) => Math.hypot(Math.max(x, W - x), Math.max(y, H - y)) + 30; // radius that covers the frame

// A holds, A->B (0.35-2.15 s), B holds, B->A (2.85-4.65 s), A holds: frame 150 = frame 0
const stage = t => (t < 2.5 ? [A, B, SUN, MOON, span(t, 0.35, 2.15)] : [B, A, MOON, SUN, span(t, 2.85, 4.65)]);
const BEAT = 250; // radius of the pause around the point of interest

export default {
  name: 'Iris',
  ko: '아이리스',
  draw(ctx, t, W, H) {
    landscape(A.getContext('2d'), W, H, t);
    const [from, to, c0, c1, p] = stage(t);
    const closing = p < 0.52;
    const [cx, cy] = closing ? c0 : c1;
    // radius from an eased area (r squared), so the dark part grows at an even, eased pace
    const r = closing
      ? Math.sqrt(lerp(reach(c0) ** 2, BEAT ** 2, smoothstep(0, 0.36, p))) * (1 - ease.in(span(p, 0.42, 0.52)))
      : reach(c1) * Math.sqrt(smoothstep(0.52, 1, p));

    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 1400); // the closed iris is a deep violet, not flat black
    bg.addColorStop(0, '#2E2152'); bg.addColorStop(1, '#07050F');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    if (r < 1) return;

    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU);
    ctx.clip();
    ctx.drawImage(closing ? from : to, 0, 0);
    const vig = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r); // soft inner shadow at the rim
    vig.addColorStop(0, 'rgba(7, 5, 15, 0)'); vig.addColorStop(1, 'rgba(7, 5, 15, 0.45)');
    ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 244, 225, 0.8)'; ctx.lineWidth = Math.min(5, r / 6);
    ctx.shadowColor = 'rgba(255, 200, 150, 0.8)'; ctx.shadowBlur = 24;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
    ctx.restore();
  },
};
