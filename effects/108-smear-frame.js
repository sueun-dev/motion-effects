// Smear frames: when the mallet swings faster than the eye can follow, each frame draws its head stretched
// along the whole arc it covered since the previous frame (tapering behind), plus a faint fan for the handle.
import { lerp, span, ease, FONT } from '../lib/util.js';

const PX = 540, PY = 1450, ARM = 490, REST = 0.8, WIND = 0.2, OVER = 0.12;

// handle angle from straight up (radians, + is to the right): wind up, whip across, overshoot, settle
function angle(t) {
  const m = ((t % 5) + 5) % 5, sw = (a, from, to) => ease.inOut(span(m, a, a + 0.2)) * (to - from);
  let th = -REST;
  th += -WIND * ease.inOut(span(m, 0.45, 0.87));          // wind up
  th += sw(0.87, -REST - WIND, REST + OVER);               // whip to the right in 0.2 s
  th += -OVER * ease.out(span(m, 1.07, 1.45));             // settle back from the overshoot
  th += WIND * ease.inOut(span(m, 2.85, 3.27));            // wind up the other way
  th += sw(3.27, REST + WIND, -REST - OVER);               // whip to the left
  th += OVER * ease.out(span(m, 3.47, 3.85));
  return th;
}
const polar = (a, r) => [PX + r * Math.sin(a), PY - r * Math.cos(a)];

function mallet(ctx, a) {
  ctx.save();
  ctx.translate(PX, PY); ctx.rotate(a);
  ctx.fillStyle = '#C98B52'; ctx.beginPath(); ctx.roundRect(-14, -ARM, 28, ARM, 14); ctx.fill();
  const g = ctx.createLinearGradient(-120, 0, 120, 0);
  g.addColorStop(0, '#FF8A8F'); g.addColorStop(1, '#E03A52');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-120, -ARM - 70, 240, 140, 46); ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'; ctx.beginPath(); ctx.roundRect(-100, -ARM - 58, 180, 34, 17); ctx.fill();
  ctx.restore();
}

export default {
  name: 'Smear Frame',
  ko: '스미어 프레임',
  draw(ctx, t, W, H) {
    const bg = ctx.createRadialGradient(PX, 1100, 100, PX, 1100, 1100);
    bg.addColorStop(0, '#FFF3D6'); bg.addColorStop(1, '#FFC98F');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    const a = angle(t), prev = angle(t - 1.5 / 30), sweep = a - prev; // a little longer than one frame: a cartoon exaggerates
    if (Math.abs(sweep) > 0.03) { // the smear: everything the head and handle passed through in this frame
      const back = prev - Math.sign(sweep) * 0.1, n = 40;
      ctx.fillStyle = 'rgba(201, 139, 82, 0.35)';
      ctx.beginPath(); ctx.moveTo(PX, PY);
      for (let k = 0; k <= n; k++) ctx.lineTo(...polar(lerp(back, a, k / n), ARM - 70));
      ctx.fill();
      for (let k = 0; k < n; k++) { // the head stretched along its arc, thinner and fainter toward the back
        const u = k / n, w = 70 * (0.25 + 0.75 * u), a0 = lerp(back, a, u), a1 = lerp(back, a, (k + 1) / n);
        ctx.fillStyle = `rgba(240, 70, 90, ${0.25 + 0.65 * u})`;
        ctx.beginPath();
        ctx.moveTo(...polar(a0, ARM - w)); ctx.lineTo(...polar(a1, ARM - w)); ctx.lineTo(...polar(a1, ARM + w)); ctx.lineTo(...polar(a0, ARM + w));
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; // speed lines past the head
      for (const r of [ARM + 110, ARM + 150]) {
        ctx.beginPath(); for (let k = 0; k <= 20; k++) ctx.lineTo(...polar(lerp(back, a, 0.2 + 0.7 * (k / 20)), r)); ctx.stroke();
      }
    }
    mallet(ctx, a);

    ctx.fillStyle = '#5B7CFA'; ctx.beginPath(); ctx.roundRect(PX - 66, PY + 30, 132, 280, 34); ctx.fill(); // sleeve
    ctx.fillStyle = '#E9EEFF'; ctx.beginPath(); ctx.roundRect(PX - 72, PY + 30, 144, 44, 22); ctx.fill();   // cuff
    ctx.save(); // the fist gripping the handle turns with it a little
    ctx.translate(PX, PY); ctx.rotate(a * 0.35);
    ctx.fillStyle = '#FFCFA3'; ctx.beginPath(); ctx.roundRect(-62, -56, 124, 104, 40); ctx.fill();
    ctx.strokeStyle = 'rgba(170, 100, 60, 0.45)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (const y of [-22, 2, 26]) { ctx.beginPath(); ctx.moveTo(-34, y); ctx.lineTo(30, y); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = 'rgba(90, 50, 30, 0.6)';
    ctx.font = `800 50px ${FONT.ko}`; ctx.textAlign = 'center';
    ctx.fillText('빠른 순간은 길게 번진 한 장으로', W / 2, 1790);
  },
};
