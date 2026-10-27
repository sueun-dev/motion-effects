// Material ripple: a finger presses two buttons; from each touch point a circle grows (clipped to the button) until it
// covers it, then fades after release, while a light state layer darkens the pressed button.
import { TAU, FONT, canvas, clamp, ease, smoothstep } from '../lib/util.js';
import { landscape } from '../lib/scenes.js';

const REST = [860, 1720], A = [380, 1245], B = [690, 1438];
const KEYS = [[0, REST], [0.6, A], [1.5, A], [2.6, B], [3.5, B], [4.7, REST], [5, REST]];
const PRESSES = [{ t: 0.65, up: 1.0, at: A }, { t: 2.65, up: 3.0, at: B }];
const BUTTONS = [ // x, y, w, h, fill, label, label colour, ripple colour
  [120, 1160, 840, 170, '#6B4CFF', '예약하기', '#FFFFFF', '255, 255, 255'],
  [120, 1356, 840, 170, '#ECE7FF', '♡  찜하기', '#5B3DF0', '91, 61, 240'],
];
let photo;

function finger(t) {
  let i = 0;
  while (t > KEYS[i + 1][0]) i++;
  const [t0, p0] = KEYS[i], [t1, p1] = KEYS[i + 1], k = ease.inOut((t - t0) / (t1 - t0));
  return [p0[0] + (p1[0] - p0[0]) * k, p0[1] + (p1[1] - p0[1]) * k];
}
const pressed = (t, p) => smoothstep(p.t, p.t + 0.08, t) * (1 - smoothstep(p.up, p.up + 0.12, t));

export default {
  name: 'Ripple Button',
  ko: '리플 버튼',
  setup() {
    const big = canvas(840, 900);
    landscape(big.getContext('2d'), 840, 900, 0);
    photo = canvas(840, 420);
    photo.getContext('2d').drawImage(big, 0, 190, 840, 420, 0, 0, 840, 420);
  },
  draw(ctx, t, W, H) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#F3F0FF'); bg.addColorStop(1, '#DCD6F7');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.translate(0, 70); // the layout below is drawn 70 px lower to sit in the middle of the frame

    ctx.save();
    ctx.shadowColor = 'rgba(60, 40, 140, 0.16)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 20;
    ctx.fillStyle = '#FFF'; ctx.beginPath(); ctx.roundRect(70, 420, 940, 1170, 48); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.roundRect(120, 470, 840, 420, 32); ctx.clip(); ctx.drawImage(photo, 120, 470); ctx.restore();
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.fillStyle = '#17142B'; ctx.font = `800 56px ${FONT.ko}`; ctx.fillText('제주 노을 투어', 120, 990);
    ctx.fillStyle = '#7C7891'; ctx.font = `500 34px ${FONT.ko}`; ctx.fillText('★ 4.9  ·  리뷰 1,284개', 120, 1050);
    ctx.textAlign = 'right'; ctx.fillStyle = '#17142B'; ctx.font = `800 48px ${FONT.sans}`; ctx.fillText('₩89,000', 960, 990);

    BUTTONS.forEach(([x, y, w, h, fill, label, color, rip], b) => {
      const p = PRESSES[b], press = pressed(t, p), s = 1 - 0.015 * press;
      ctx.save();
      ctx.translate(x + w / 2, y + h / 2); ctx.scale(s, s); ctx.translate(-x - w / 2, -y - h / 2);
      ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2);
      ctx.fillStyle = fill; ctx.fill(); ctx.clip();
      ctx.fillStyle = `rgba(${b ? '91, 61, 240' : '20, 0, 80'}, ${0.12 * press})`; ctx.fillRect(x, y, w, h); // state layer
      const k = clamp((t - p.t) / 0.65);
      if (k > 0) {
        const [px, py] = p.at, maxR = Math.hypot(Math.max(px - x, x + w - px), Math.max(py - y, y + h - py));
        const alpha = 0.34 * (1 - smoothstep(p.up + 0.2, p.up + 0.75, t));
        ctx.fillStyle = `rgba(${rip}, ${alpha})`;
        ctx.beginPath(); ctx.arc(px, py, maxR * ease.out(k), 0, TAU); ctx.fill();
      }
      ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.font = `700 52px ${FONT.ko}`;
      ctx.fillText(label, x + w / 2, y + h / 2 + 19);
      ctx.restore();
    });

    // the finger: a translucent touch circle that shrinks a little while it presses
    const [fx, fy] = finger(t), press = Math.max(...PRESSES.map(p => pressed(t, p)));
    ctx.save();
    ctx.shadowColor = 'rgba(30, 10, 80, 0.3)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8 * (1 - press);
    ctx.fillStyle = `rgba(40, 24, 90, ${0.22 + 0.12 * press})`;
    ctx.beginPath(); ctx.arc(fx, fy, 50 - 8 * press, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(fx, fy, 50 - 8 * press, 0, TAU); ctx.stroke();
  },
};
