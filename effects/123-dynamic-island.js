// Pill morph: the black island at the top of a phone springs open (width, height and corner radius tween with an
// overshoot ease) into a message notification, shrinks back, then opens into a music player; content fades in once open.
import { TAU, FONT, canvas, clamp, ease, lerp, smoothstep } from '../lib/util.js';
import { landscape } from '../lib/scenes.js';

const PX = 80, PY = 300, PW = 920, PH = 1580, SX = PX + 20, SY = PY + 20, SW = PW - 40, SH = PH - 40;
const TOP = SY + 26, IDLE = [300, 88];
// [open at, close at, width, height, radius]
const STATES = [[0.35, 1.9, 820, 210, 70], [2.6, 4.3, 820, 390, 80]];
let wall, art;

function island(t) {
  let [w, h] = IDLE, content = 0, kind = -1;
  STATES.forEach(([open, close, sw, sh], i) => {
    if (t < open || t > close + 0.45) return;
    const e = t < close ? ease.outBack(clamp((t - open) / 0.55)) : 1 - ease.inOut(clamp((t - close) / 0.45));
    w = lerp(IDLE[0], sw, e); h = lerp(IDLE[1], sh, e); kind = i;
    content = smoothstep(open + 0.25, open + 0.5, t) * (1 - smoothstep(close - 0.05, close + 0.12, t));
  });
  const r = kind < 0 ? IDLE[1] / 2 : Math.min(h / 2, lerp(IDLE[1] / 2, STATES[kind][4], clamp((h - IDLE[1]) / 60)));
  return { w, h, r, content, kind };
}

function notification(ctx, x, y) {
  const g = ctx.createLinearGradient(x + 40, y + 45, x + 160, y + 165);
  g.addColorStop(0, '#5FE38A'); g.addColorStop(1, '#28B85A');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x + 40, y + 45, 120, 120, 30); ctx.fill();
  ctx.fillStyle = '#FFF'; ctx.beginPath(); ctx.ellipse(x + 100, y + 100, 38, 31, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + 76, y + 118); ctx.lineTo(x + 68, y + 142); ctx.lineTo(x + 96, y + 128); ctx.fill();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFF'; ctx.font = `700 42px ${FONT.ko}`; ctx.fillText('지우', x + 194, y + 92);
  ctx.fillStyle = '#8E8E93'; ctx.font = `500 30px ${FONT.ko}`; ctx.textAlign = 'right'; ctx.fillText('지금', x + 780, y + 90);
  ctx.textAlign = 'left'; ctx.fillStyle = '#D1D1D6'; ctx.font = `500 34px ${FONT.ko}`;
  ctx.fillText('오늘 저녁 7시 어때? 맛집 찾았어', x + 194, y + 146);
}

function player(ctx, x, y, t) {
  ctx.save(); ctx.beginPath(); ctx.roundRect(x + 40, y + 44, 150, 150, 30); ctx.clip(); ctx.drawImage(art, x + 40, y + 44); ctx.restore();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFF'; ctx.font = `700 44px ${FONT.sans}`; ctx.fillText('Midnight Drive', x + 222, y + 108);
  ctx.fillStyle = '#8E8E93'; ctx.font = `500 34px ${FONT.sans}`; ctx.fillText('Neon Coast', x + 222, y + 156);
  for (let b = 0; b < 6; b++) { // waveform
    const bh = 14 + 46 * (0.5 + 0.5 * Math.sin(t / 5 * TAU * (6 + b) + b * 1.9));
    ctx.fillStyle = b % 2 ? '#FF9F43' : '#FF5E7E';
    ctx.beginPath(); ctx.roundRect(x + 620 + b * 26, y + 120 - bh / 2, 14, bh, 7); ctx.fill();
  }
  const p = 0.32 + 0.05 * (t - 2.6), bx = x + 40, bw = 740, by = y + 236;
  ctx.lineCap = 'round'; ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + bw, by); ctx.stroke();
  ctx.strokeStyle = '#FFF'; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + bw * p, by); ctx.stroke();
  ctx.fillStyle = '#8E8E93'; ctx.font = `500 28px ${FONT.sans}`;
  ctx.fillText('1:12', bx, by + 46); ctx.textAlign = 'right'; ctx.fillText('-2:31', bx + bw, by + 46);
  const cx = x + 410, cy = y + 330; // prev, pause, next
  ctx.fillStyle = '#FFF';
  ctx.fillRect(cx - 18, cy - 26, 13, 52); ctx.fillRect(cx + 5, cy - 26, 13, 52);
  for (const d of [-1, 1]) {
    for (const o of [0, 30]) {
      ctx.beginPath(); ctx.moveTo(cx + d * (150 + o - 15), cy - 22); ctx.lineTo(cx + d * (150 + o + 15), cy); ctx.lineTo(cx + d * (150 + o - 15), cy + 22); ctx.fill();
    }
  }
}

export default {
  name: 'Dynamic Island',
  ko: '다이내믹 아일랜드',
  setup() {
    const big = canvas(SW, 1900);
    landscape(big.getContext('2d'), SW, 1900, 0);
    wall = canvas(SW, SH);
    wall.getContext('2d').drawImage(big, 0, 330, SW, SH, 0, 0, SW, SH);
    art = canvas(150, 150);
    art.getContext('2d').drawImage(big, 280, 560, 320, 320, 0, 0, 150, 150);
  },
  draw(ctx, t, W, H) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#ECE8FF'); bg.addColorStop(1, '#FFDDEB');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    ctx.save(); // phone body and lock screen
    ctx.shadowColor = 'rgba(40, 20, 80, 0.35)'; ctx.shadowBlur = 70; ctx.shadowOffsetY = 30;
    ctx.fillStyle = '#16161C'; ctx.beginPath(); ctx.roundRect(PX, PY, PW, PH, 130); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.roundRect(SX, SY, SW, SH, 112); ctx.clip(); ctx.drawImage(wall, SX, SY); ctx.restore();
    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = `600 44px ${FONT.ko}`; ctx.fillText('10월 26일 월요일', W / 2, 930);
    ctx.font = `700 230px ${FONT.sans}`; ctx.fillText('9:41', W / 2, 1150);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'; ctx.beginPath(); ctx.roundRect(W / 2 - 140, SY + SH - 34, 280, 12, 6); ctx.fill();

    const isl = island(t), x = W / 2 - isl.w / 2;
    const bar = 1 - smoothstep(340, 520, isl.w); // status bar hides while the island is wide
    ctx.globalAlpha = bar; ctx.fillStyle = '#FFF'; ctx.font = `600 34px ${FONT.sans}`; ctx.textAlign = 'left';
    ctx.fillText('SKT', SX + 76, TOP + 56);
    ctx.strokeStyle = '#FFF'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(SX + SW - 150, TOP + 28, 64, 32, 9); ctx.stroke();
    ctx.fillRect(SX + SW - 145, TOP + 33, 44, 22); ctx.fillRect(SX + SW - 82, TOP + 38, 5, 12);
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.roundRect(x, TOP, isl.w, isl.h, isl.r); ctx.fill();
    ctx.fillStyle = '#16182A'; ctx.beginPath(); ctx.arc(W / 2 + 96, TOP + 44, 15, 0, TAU); ctx.fill(); // camera lens
    if (isl.content > 0) {
      ctx.save();
      ctx.beginPath(); ctx.roundRect(x, TOP, isl.w, isl.h, isl.r); ctx.clip();
      ctx.globalAlpha = isl.content;
      ctx.translate(W / 2, TOP); ctx.scale(0.94 + 0.06 * isl.content, 0.94 + 0.06 * isl.content); ctx.translate(-410, 0);
      if (isl.kind === 0) notification(ctx, 0, 0); else player(ctx, 0, 0, t);
      ctx.restore();
    }
  },
};
