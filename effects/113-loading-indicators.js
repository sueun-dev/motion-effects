// Five loaders on dark glass cards: a material spinner (head and tail of an arc chase each other), three bouncing
// dots, a progress ring that fills, ticks and clears, an iOS-style activity wheel and an indeterminate bar.
import { TAU, FONT, clamp, ease, fract, smoothstep } from '../lib/util.js';

const CARDS = [ // x, y, w, h, title, caption
  [70, 330, 450, 560, 'Spinner', '불러오는 중'], [560, 330, 450, 560, 'Dots', '입력 중'],
  [70, 930, 450, 560, 'Progress', '다운로드'], [560, 930, 450, 560, 'Activity', '동기화 중'],
];

function card(ctx, x, y, w, h) {
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 18;
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#232946'); g.addColorStop(1, '#1A1F38');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y, w, h, 44); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)'; ctx.lineWidth = 2; ctx.stroke();
}

function spinner(ctx, cx, cy, t) {
  const n = Math.floor(t / 1.25), u = fract(t / 1.25), rot = t / 5 * TAU * 2;
  const head = rot + 0.75 * TAU * (n + ease.inOut(clamp(u * 2))) + 0.25;   // 4 cycles x 3/4 turn = 3 whole turns
  const tail = rot + 0.75 * TAU * (n + ease.inOut(clamp(u * 2 - 1)));
  ctx.lineCap = 'round'; ctx.lineWidth = 24;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)'; ctx.beginPath(); ctx.arc(cx, cy, 110, 0, TAU); ctx.stroke();
  ctx.strokeStyle = '#7C8CFF'; ctx.beginPath(); ctx.arc(cx, cy, 110, tail, head); ctx.stroke();
}

function dots(ctx, cx, cy, t) {
  ['#FF7A9A', '#FFC15E', '#5EE0C1'].forEach((c, i) => {
    const lift = Math.max(0, Math.sin(TAU * fract(t / 1.25 - i * 0.14)));
    ctx.globalAlpha = 0.55 + 0.45 * lift;
    ctx.fillStyle = c; ctx.beginPath();
    ctx.ellipse(cx + (i - 1) * 100, cy + 30 - 90 * lift, 34, 34 * (0.9 + 0.1 * lift), 0, 0, TAU); ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function ring(ctx, cx, cy, t) {
  const u = t % 2.5;
  const v = ease.inOut(span01(u, 0.2, 1.6)), clear = ease.inOut(span01(u, 2.0, 2.45));
  const done = smoothstep(1.55, 1.75, u) * (1 - smoothstep(2.15, 2.4, u)); // the tick shows while it is full
  ctx.lineCap = 'round'; ctx.lineWidth = 22;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'; ctx.beginPath(); ctx.arc(cx, cy, 118, 0, TAU); ctx.stroke();
  if (v - clear > 0.002) {
    const a0 = -TAU / 4 + clear * TAU, a1 = -TAU / 4 + v * TAU;
    const g = ctx.createConicGradient(-TAU / 4, cx, cy);
    g.addColorStop(0, '#4FD1FF'); g.addColorStop(1, '#8B6CFF');
    ctx.strokeStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 118, a0, a1); ctx.stroke();
    ctx.globalAlpha = done; ctx.strokeStyle = '#5EE08A'; ctx.stroke(); ctx.globalAlpha = 1;
  }
  ctx.fillStyle = '#FFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.globalAlpha = 1 - done; ctx.font = `700 60px ${FONT.sans}`;
  ctx.fillText(`${u > 2 ? 0 : Math.round(100 * v)}%`, cx, cy + 2);
  ctx.globalAlpha = done; ctx.strokeStyle = '#5EE08A'; ctx.lineWidth = 16; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(cx - 44, cy + 2); ctx.lineTo(cx - 12, cy + 34); ctx.lineTo(cx + 48, cy - 30); ctx.stroke();
  ctx.globalAlpha = 1;
}
const span01 = (u, a, b) => clamp((u - a) / (b - a));

function activity(ctx, cx, cy, t) {
  const head = t / 5 * 5; // 5 turns per loop
  ctx.lineCap = 'round'; ctx.lineWidth = 18; ctx.strokeStyle = '#FFF';
  for (let j = 0; j < 12; j++) {
    const d = fract(head - j / 12 + 0.08); // 0 just before the head arrives, then it fades
    const o = d < 0.08 ? smoothstep(0, 0.08, d) : (1 - (d - 0.08) / 0.92) ** 1.6;
    const a = j / 12 * TAU - TAU / 4;
    ctx.globalAlpha = 0.14 + 0.86 * o;
    ctx.beginPath(); ctx.moveTo(cx + 56 * Math.cos(a), cy + 56 * Math.sin(a)); ctx.lineTo(cx + 108 * Math.cos(a), cy + 108 * Math.sin(a)); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export default {
  name: 'Loading Indicators',
  ko: '로딩 인디케이터',
  draw(ctx, t, W, H) {
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0E1124'); bg.addColorStop(1, '#171433');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W / 2, 1100, 50, W / 2, 1100, 900);
    glow.addColorStop(0, 'rgba(110, 90, 255, 0.18)'); glow.addColorStop(1, 'rgba(110, 90, 255, 0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

    CARDS.forEach(([x, y, w, h, title, caption], i) => {
      card(ctx, x, y, w, h);
      const cx = x + w / 2, cy = y + 230;
      ctx.save(); [spinner, dots, ring, activity][i](ctx, cx, cy, t); ctx.restore();
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#FFF'; ctx.font = `700 42px ${FONT.sans}`; ctx.fillText(title, cx, y + h - 104);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'; ctx.font = `500 30px ${FONT.ko}`; ctx.fillText(caption, cx, y + h - 56);
    });

    // indeterminate bar: a segment that grows while it slides, 4 passes per loop
    card(ctx, 70, 1530, 940, 270);
    ctx.textAlign = 'left'; ctx.fillStyle = '#FFF'; ctx.font = `700 40px ${FONT.ko}`;
    ctx.fillText('사진 3장 업로드 중', 120, 1625);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'; ctx.font = `500 30px ${FONT.ko}`;
    ctx.fillText('잠시만 기다려 주세요', 120, 1675);
    const bx = 120, bw = 840, by = 1720;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(bx, by, bw, 18, 9); ctx.clip();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'; ctx.fillRect(bx, by, bw, 18);
    const u = fract(t / 1.25), a = bx + ease.inOut(u) * (bw + 160), len = 120 + 260 * Math.sin(Math.PI * u);
    const g = ctx.createLinearGradient(a - len, 0, a, 0);
    g.addColorStop(0, '#4FD1FF'); g.addColorStop(1, '#8B6CFF');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(a - len, by, len, 18, 9); ctx.fill();
    ctx.restore();
  },
};
