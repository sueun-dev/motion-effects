// Diagonal wipe: the next scene is drawn through a half-plane clip whose slanted edge sweeps across on an eased
// (smoothstep) curve; a glowing white edge line and a light sheen trailing it mark the boundary.
import { W, H, smoothstep, lerp, canvas } from '../lib/util.js';
import { landscape, city } from '../lib/scenes.js';

const A = canvas(), B = canvas();
city(B.getContext('2d'), W, H);

// A holds, A->B (0.6-1.9 s), B holds, B->A (3.1-4.4 s), A holds: frame 150 = frame 0
const stage = t => (t < 2.5 ? [A, B, smoothstep(0.6, 1.9, t)] : [B, A, smoothstep(3.1, 4.4, t)]);

const N = [Math.cos(-0.36), Math.sin(-0.36)]; // the edge travels right (and a little up), tilted about 20 degrees
const T = [-N[1], N[0]];                       // along the edge
const D0 = H * N[1] - 90, D1 = W * N[0] + 90;  // edge fully off-screen at both ends (corners projected on N)

export default {
  name: 'Wipe',
  ko: '와이프',
  draw(ctx, t, W, H) {
    landscape(A.getContext('2d'), W, H, t);
    const [from, to, k] = stage(t);
    ctx.drawImage(from, 0, 0);
    if (k <= 0 || k >= 1) { if (k >= 1) ctx.drawImage(to, 0, 0); return; }

    const d = lerp(D0, D1, k), cx = N[0] * d, cy = N[1] * d, L = 3000;
    const behind = new Path2D(); // everything on the far side of the edge line
    behind.moveTo(cx + T[0] * L, cy + T[1] * L);
    behind.lineTo(cx - T[0] * L, cy - T[1] * L);
    behind.lineTo(cx - T[0] * L - N[0] * L, cy - T[1] * L - N[1] * L);
    behind.lineTo(cx + T[0] * L - N[0] * L, cy + T[1] * L - N[1] * L);
    behind.closePath();

    ctx.save();
    ctx.clip(behind);
    ctx.drawImage(to, 0, 0);
    const sheen = ctx.createLinearGradient(cx, cy, cx - N[0] * 320, cy - N[1] * 320);
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0.35)'); sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sheen; ctx.fill(behind);
    ctx.restore();

    ctx.save(); // the edge line with a glow
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(255, 230, 200, 0.95)'; ctx.shadowBlur = 40;
    ctx.beginPath(); ctx.moveTo(cx + T[0] * L, cy + T[1] * L); ctx.lineTo(cx - T[0] * L, cy - T[1] * L); ctx.stroke();
    ctx.restore();
  },
};
