// Clock wipe (radial wipe): the next scene shows through a pie-slice clip that sweeps clockwise from 12 o'clock
// like a clock hand, on an eased (smoothstep) curve. A glowing hand and a centre hub mark the sweep.
import { W, H, TAU, smoothstep, canvas } from '../lib/util.js';
import { landscape, city } from '../lib/scenes.js';

const A = canvas(), B = canvas();
city(B.getContext('2d'), W, H);
const CX = W / 2, CY = H * 0.53, R = 1300; // R reaches past every corner

// A holds, A->B (0.5-2.0 s), B holds, B->A (3.0-4.5 s), A holds: frame 150 = frame 0
const stage = t => (t < 2.5 ? [A, B, smoothstep(0.5, 2.0, t)] : [B, A, smoothstep(3.0, 4.5, t)]);

export default {
  name: 'Clock Wipe',
  ko: '시계 와이프',
  draw(ctx, t, W, H) {
    landscape(A.getContext('2d'), W, H, t);
    const [from, to, k] = stage(t);
    ctx.drawImage(from, 0, 0);
    if (k <= 0) return;
    if (k >= 1) { ctx.drawImage(to, 0, 0); return; }

    const a0 = -Math.PI / 2, a = a0 + TAU * k;
    const slice = new Path2D();
    slice.moveTo(CX, CY); slice.arc(CX, CY, R, a0, a); slice.closePath();

    ctx.save();
    ctx.clip(slice);
    ctx.drawImage(to, 0, 0);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = smoothstep(0, 0.05, k) * smoothstep(1, 0.95, k); // the hand fades in and out at 12 o'clock
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(255, 225, 190, 0.95)'; ctx.shadowBlur = 36;
    ctx.beginPath(); ctx.moveTo(CX, CY); ctx.lineTo(CX + Math.cos(a) * R, CY + Math.sin(a) * R); ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.arc(CX, CY, 22, 0, TAU); ctx.fill();
    ctx.restore();
  },
};
