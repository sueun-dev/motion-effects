// Dashboard build-up: bars grow one after another (overshoot ease), a line chart draws itself left to right (clip that
// widens) with points popping in, a donut sweeps its segments and the numbers count up; then it all retracts.
import { TAU, FONT, clamp, ease, lerp } from '../lib/util.js';

const BARS = [0.45, 0.62, 0.38, 0.8, 0.7, 0.98, 0.58], DAYS = ['월', '화', '수', '목', '금', '토', '일'];
const LINE = [0.22, 0.35, 0.3, 0.52, 0.46, 0.6, 0.55, 0.74, 0.7, 0.9];
const PIE = [[0.38, '#5B6CFF', '앱'], [0.27, '#22C7A9', '웹'], [0.2, '#FFB23F', '매장'], [0.15, '#FF6B8B', '기타']];

function card(ctx, y, h, title, sub) {
  ctx.save();
  ctx.shadowColor = 'rgba(30, 40, 90, 0.1)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 14;
  ctx.fillStyle = '#FFF'; ctx.beginPath(); ctx.roundRect(70, y, 940, h, 44); ctx.fill();
  ctx.restore();
  ctx.textAlign = 'left'; ctx.fillStyle = '#8A90A6'; ctx.font = `600 32px ${FONT.ko}`; ctx.fillText(title, 120, y + 70);
  if (sub) { ctx.fillStyle = '#141A2E'; ctx.font = `800 64px ${FONT.sans}`; ctx.fillText(sub, 120, y + 140); }
}

export default {
  name: 'Chart Animation',
  ko: '차트 애니메이션',
  draw(ctx, t, W, H) {
    ctx.fillStyle = '#F1F3F9'; ctx.fillRect(0, 0, W, H);
    const out = 1 - ease.inOut(clamp((t - 4.05) / 0.7)); // everything retracts at the end of the loop
    ctx.textBaseline = 'alphabetic';

    // bars
    const grow = BARS.map((_, i) => ease.outBack(clamp((t - 0.2 - i * 0.09) / 0.5)) * out);
    card(ctx, 290, 560, '주간 매출', `₩${(12.4 * grow.reduce((a, b) => a + b, 0) / 7).toFixed(1)}M`);
    ctx.fillStyle = '#16B686'; ctx.font = `700 34px ${FONT.sans}`; ctx.textAlign = 'right';
    ctx.globalAlpha = clamp(grow[6]); ctx.fillText('▲ 18.2%', 960, 430); ctx.globalAlpha = 1;
    BARS.forEach((v, i) => {
      const x = 130 + i * 122, h = 300 * v * grow[i], base = 790, top = i === 5;
      const g = ctx.createLinearGradient(0, base - 300, 0, base);
      g.addColorStop(0, top ? '#7B5CFF' : '#B9C2FF'); g.addColorStop(1, top ? '#5B6CFF' : '#DCE1FF');
      ctx.fillStyle = g;
      if (h > 1) { ctx.beginPath(); ctx.roundRect(x, base - h, 76, h, [18, 18, 6, 6]); ctx.fill(); }
      ctx.textAlign = 'center'; ctx.fillStyle = top ? '#141A2E' : '#8A90A6'; ctx.font = `600 30px ${FONT.ko}`;
      ctx.fillText(DAYS[i], x + 38, base + 44);
    });

    // line: drawn through a clip that widens
    const p = ease.inOut(clamp((t - 0.9) / 1.2)) * out, x0 = 120, x1 = 960, top = 1080, bot = 1300;
    card(ctx, 880, 470, '방문자', `${Math.round(48210 * p).toLocaleString('en-US')}`);
    const pts = LINE.map((v, i) => [lerp(x0, x1, i / (LINE.length - 1)), lerp(bot, top, v)]);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, x0 + (x1 - x0) * p + 1, H); ctx.clip();
    ctx.beginPath(); pts.forEach(([a, b]) => ctx.lineTo(a, b)); ctx.lineTo(x1, bot); ctx.lineTo(x0, bot); ctx.closePath();
    const area = ctx.createLinearGradient(0, top, 0, bot);
    area.addColorStop(0, 'rgba(34, 199, 169, 0.3)'); area.addColorStop(1, 'rgba(34, 199, 169, 0)');
    ctx.fillStyle = area; ctx.fill();
    ctx.beginPath(); pts.forEach(([a, b]) => ctx.lineTo(a, b));
    ctx.strokeStyle = '#22C7A9'; ctx.lineWidth = 8; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
    ctx.restore();
    pts.forEach(([a, b], i) => { // points pop as the line reaches them
      const k = ease.outBack(clamp(((x0 + (x1 - x0) * p) - a) / 60)) * (p > 0.001);
      if (k <= 0) return;
      ctx.fillStyle = '#FFF'; ctx.beginPath(); ctx.arc(a, b, 13 * k, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#22C7A9'; ctx.lineWidth = 6; ctx.stroke();
      if (i === LINE.length - 1) { ctx.fillStyle = '#22C7A9'; ctx.fill(); }
    });

    // donut: segments sweep one after another
    const q = ease.inOut(clamp((t - 1.6) / 1.2)) * out;
    card(ctx, 1380, 460, '채널별 비중', null);
    const cx = 300, cy = 1630, r = 140;
    ctx.lineWidth = 58; ctx.lineCap = 'butt';
    ctx.strokeStyle = '#EEF0F7'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
    let a0 = 0;
    PIE.forEach(([v, c]) => {
      const s = Math.max(a0, Math.min(a0 + v - 0.008, q));
      if (s > a0) { ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(cx, cy, r, -TAU / 4 + a0 * TAU, -TAU / 4 + s * TAU); ctx.stroke(); }
      a0 += v;
    });
    ctx.textAlign = 'center'; ctx.fillStyle = '#141A2E'; ctx.font = `800 52px ${FONT.sans}`;
    ctx.fillText(`₩${(8.2 * q).toFixed(1)}M`, cx, cy + 14);
    ctx.fillStyle = '#8A90A6'; ctx.font = `500 28px ${FONT.ko}`; ctx.fillText('총 매출', cx, cy + 56);
    PIE.forEach(([v, c, label], i) => {
      const y = 1530 + i * 72, k = clamp((q - PIE.slice(0, i).reduce((s, e) => s + e[0], 0)) / v);
      ctx.globalAlpha = 0.25 + 0.75 * k;
      ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(560, y - 26, 30, 30, 9); ctx.fill();
      ctx.textAlign = 'left'; ctx.fillStyle = '#141A2E'; ctx.font = `600 36px ${FONT.ko}`; ctx.fillText(label, 614, y);
      ctx.textAlign = 'right'; ctx.font = `700 36px ${FONT.sans}`; ctx.fillText(`${Math.round(v * 100 * k)}%`, 950, y);
    });
    ctx.globalAlpha = 1;
  },
};
