// Odometer: five digit wheels roll upward through every digit in between (forward only, so 9 rolls on to 0).
// Each wheel is drawn at several moments inside the frame and averaged (alpha 1/k) for a real motion blur.
import { clamp, FONT, canvas } from '../lib/util.js';

const STEPS = ['00000', '25713', '68259', '99999']; // and then the famous roll-over back to 00000
const STEP = 5 / STEPS.length, ROLL = 0.75;          // seconds per step, seconds one roll takes
const CW = 176, CH = 290, GAP = 14, X0 = (1080 - (5 * CW + 4 * GAP)) / 2, Y0 = 1100 - CH / 2;
const SHUTTER = 1 / 60, SAMPLES = 6;

// wheel i position in digits: it only ever grows, by a multiple of 10 over the loop
function wheel(i, t) {
  let p = 0;
  STEPS.forEach((from, s) => {
    const to = STEPS[(s + 1) % STEPS.length];
    const d = (+to[i] - +from[i] + 10) % 10;
    const k = clamp((t - s * STEP - 0.05 - (4 - i) * 0.06) / ROLL); // the right wheel moves first, like a carry
    p += d * (0.5 - 0.5 * Math.cos(Math.PI * k));
  });
  return p;
}

let cell; // one wheel window, drawn opaque so that averaging copies of it is exact

function drawDigits(p, face, ink) {
  const g = cell.getContext('2d');
  g.fillStyle = face; g.fillRect(0, 0, CW, CH);
  g.fillStyle = ink;
  g.font = `700 214px ${FONT.sans}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const n0 = Math.floor(p);
  for (let n = n0 - 1; n <= n0 + 2; n++) g.fillText(String(((n % 10) + 10) % 10), CW / 2, CH / 2 + 6 + (n - p) * CH);
  return cell;
}

export default {
  name: 'Odometer Counter',
  ko: '숫자 롤링 카운터',
  setup() { cell = canvas(CW, CH); },
  draw(ctx, t, W, H) {
    const bg = ctx.createRadialGradient(W / 2, 1100, 50, W / 2, 1100, 1300);
    bg.addColorStop(0, '#24324A'); bg.addColorStop(1, '#0A0F1A');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W / 2, 1100, 100, W / 2, 1100, 640); // warm dashboard light
    glow.addColorStop(0, 'rgba(255, 138, 61, 0.22)'); glow.addColorStop(1, 'rgba(255, 138, 61, 0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

    // bezel
    ctx.fillStyle = '#05070C';
    ctx.beginPath(); ctx.roundRect(X0 - 34, Y0 - 34, 5 * CW + 4 * GAP + 68, CH + 68, 36); ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)'; ctx.lineWidth = 3; ctx.stroke();

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < 5; i++) {
      const x = X0 + i * (CW + GAP), last = i === 4;
      ctx.save();
      ctx.beginPath(); ctx.rect(x, Y0, CW, CH); ctx.clip();
      for (let j = 0; j < SAMPLES; j++) { // running average of the samples = motion blur
        ctx.globalAlpha = 1 / (j + 1);
        ctx.drawImage(drawDigits(wheel(i, t - SHUTTER * j / (SAMPLES - 1)), last ? '#E8452C' : '#191D26', last ? '#FFFFFF' : '#F2EEE4'), x, Y0);
      }
      ctx.globalAlpha = 1;
      const shade = ctx.createLinearGradient(0, Y0, 0, Y0 + CH); // the wheel curving away at top and bottom
      shade.addColorStop(0, 'rgba(0, 0, 0, 0.8)'); shade.addColorStop(0.2, 'rgba(0, 0, 0, 0)');
      shade.addColorStop(0.5, 'rgba(255, 255, 255, 0.06)');
      shade.addColorStop(0.8, 'rgba(0, 0, 0, 0)'); shade.addColorStop(1, 'rgba(0, 0, 0, 0.8)');
      ctx.fillStyle = shade; ctx.fillRect(x, Y0, CW, CH);
      ctx.restore();
    }

    ctx.fillStyle = '#FF8A3D';
    ctx.font = `700 46px ${FONT.sans}`;
    ctx.fillText('O D O M E T E R', W / 2, Y0 - 120);
    ctx.fillStyle = 'rgba(242, 238, 228, 0.6)';
    ctx.font = `500 40px ${FONT.sans}`;
    ctx.fillText('TOTAL  km', W / 2, Y0 + CH + 110);
    ctx.fillStyle = 'rgba(242, 238, 228, 0.35)';
    ctx.font = `500 34px ${FONT.ko}`;
    ctx.fillText('자릿수가 굴러 올라간다', W / 2, Y0 + CH + 175);
  },
};
