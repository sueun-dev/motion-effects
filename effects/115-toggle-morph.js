// Micro-interactions: a finger taps a switch (knob slides and stretches, track turns green), a hamburger icon
// (lines slide together, then rotate into an X) and a play button (two quads morph into pause bars); then back.
import { TAU, FONT, clamp, ease, lerp, smoothstep } from '../lib/util.js';

const ROWS = [ // card top, title, caption off, caption on, tap times
  [330, '알림', '알림이 꺼져 있어요', '새 소식을 알려드려요', [0.45, 2.95]],
  [830, '메뉴', '닫힘', '열림', [1.2, 3.7]],
  [1330, '음악', 'Midnight Drive · 일시정지', 'Midnight Drive · 재생 중', [1.95, 4.45]],
];
const CTRL_X = 790, ctrlY = i => ROWS[i][0] + 230;
// where the finger rests on each control and when: [arrive, leave, row]; it goes round and round
const VISITS = [[0.35, 0.6, 0], [1.1, 1.35, 1], [1.85, 2.1, 2], [2.85, 3.1, 0], [3.6, 3.85, 1], [4.35, 4.6, 2], [5.35, 5.6, 0]];
const spot = i => [CTRL_X + 34, ctrlY(i) + 46];

function finger(t) {
  if (t < VISITS[0][0]) t += 5;
  for (let k = 0; k < VISITS.length - 1; k++) {
    const [, leave, a] = VISITS[k], [arrive, , b] = VISITS[k + 1];
    if (t <= leave && t >= VISITS[k][0]) return spot(a);
    if (t > leave && t < arrive) {
      const e = ease.inOut((t - leave) / (arrive - leave)), p = spot(a), q = spot(b);
      return [lerp(p[0], q[0], e), lerp(p[1], q[1], e)];
    }
  }
  return spot(0);
}
const state = (t, [on, off]) => ease.inOut(clamp((t - on) / 0.4)) - ease.inOut(clamp((t - off) / 0.4));

function toggle(ctx, cx, cy, s) {
  const w = 270, h = 156, x = cx - w / 2, y = cy - h / 2, r = h / 2 - 8;
  const g = [Math.round(lerp(226, 52, s)), Math.round(lerp(229, 199, s)), Math.round(lerp(236, 89, s))];
  ctx.fillStyle = `rgb(${g})`; ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
  const stretch = 34 * Math.sin(Math.PI * s), kx = x + 8 + s * (w - 16 - 2 * r - stretch);
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.25)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
  ctx.fillStyle = '#FFF'; ctx.beginPath(); ctx.roundRect(kx, y + 8, 2 * r + stretch, 2 * r, r); ctx.fill();
  ctx.restore();
}

function burger(ctx, cx, cy, m) {
  ctx.fillStyle = '#1B1F3B'; ctx.beginPath(); ctx.roundRect(cx - 105, cy - 105, 210, 210, 56); ctx.fill();
  const slide = ease.inOut(clamp(m * 2)), turn = ease.inOut(clamp(m * 2 - 1)); // first together, then rotate
  ctx.strokeStyle = '#FFF'; ctx.lineWidth = 15; ctx.lineCap = 'round';
  for (const k of [-1, 0, 1]) {
    ctx.save();
    ctx.translate(cx, cy + k * 38 * (1 - slide));
    ctx.rotate(k * turn * TAU / 8);
    ctx.globalAlpha = k === 0 ? 1 - slide : 1;
    ctx.beginPath(); ctx.moveTo(-56, 0); ctx.lineTo(56, 0); ctx.stroke();
    ctx.restore();
  }
}

const PLAY = [[[-30, -50], [8, -25], [8, 25], [-30, 50]], [[8, -25], [46, 0], [46, 0], [8, 25]]];
const PAUSE = [[[-40, -46], [-13, -46], [-13, 46], [-40, 46]], [[13, -46], [40, -46], [40, 46], [13, 46]]];
function playPause(ctx, cx, cy, m) {
  const g = ctx.createLinearGradient(cx - 105, cy - 105, cx + 105, cy + 105);
  g.addColorStop(0, '#FF5E7E'); g.addColorStop(1, '#FF9F43');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 105, 0, TAU); ctx.fill();
  ctx.fillStyle = '#FFF'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#FFF'; ctx.lineWidth = 6;
  for (let q = 0; q < 2; q++) {
    ctx.beginPath();
    PLAY[q].forEach((p, i) => ctx.lineTo(cx + lerp(p[0], PAUSE[q][i][0], m), cy + lerp(p[1], PAUSE[q][i][1], m)));
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
}

export default {
  name: 'Toggle Morph',
  ko: '토글·아이콘 모프',
  draw(ctx, t, W, H) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#EAF4F2'); bg.addColorStop(1, '#D5E2F3');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    ROWS.forEach(([top, title, off, on, taps], i) => {
      ctx.save();
      ctx.shadowColor = 'rgba(30, 50, 90, 0.13)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 16;
      ctx.fillStyle = '#FFF'; ctx.beginPath(); ctx.roundRect(70, top, 940, 460, 48); ctx.fill();
      ctx.restore();
      const s = state(t, taps), cy = ctrlY(i);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#141A2E'; ctx.font = `800 64px ${FONT.ko}`; ctx.fillText(title, 130, cy - 10);
      ctx.font = `500 32px ${FONT.ko}`;
      ctx.fillStyle = `rgba(120, 128, 150, ${1 - s})`; ctx.fillText(off, 130, cy + 50);
      ctx.fillStyle = `rgba(40, 150, 110, ${s})`; ctx.fillText(on, 130, cy + 50);
      [toggle, burger, playPause][i](ctx, CTRL_X, cy, s);
      if (i === 2) { // a small equaliser wakes up while it plays
        ctx.fillStyle = `rgba(255, 94, 126, ${s})`;
        for (let b = 0; b < 4; b++) {
          const h = 14 + 30 * s * (0.5 + 0.5 * Math.sin(t / 5 * TAU * (6 + b) + b * 1.7));
          ctx.beginPath(); ctx.roundRect(290 + b * 22, cy - 16 - h, 12, h, 6); ctx.fill();
        }
      }
    });

    const [fx, fy] = finger(t);
    const press = Math.max(...ROWS.flatMap(r => r[4]).map(tap => smoothstep(tap - 0.1, tap, t) * (1 - smoothstep(tap + 0.05, tap + 0.2, t))));
    ctx.save();
    ctx.shadowColor = 'rgba(20, 30, 70, 0.3)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8 * (1 - press);
    ctx.fillStyle = `rgba(30, 40, 90, ${0.2 + 0.14 * press})`;
    ctx.beginPath(); ctx.arc(fx, fy, 48 - 9 * press, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(fx, fy, 48 - 9 * press, 0, TAU); ctx.stroke();
  },
};
