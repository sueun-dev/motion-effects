// Like button: on tap a coloured ring bursts open, the heart pops back filled (overshoot easing) and pairs of dots
// fly out and shrink; the counter rolls up. A second tap unlikes. Twice per loop.
import { TAU, FONT, canvas, clamp, ease, lerp, smoothstep } from '../lib/util.js';
import { city } from '../lib/scenes.js';

const HX = 540, HY = 1335; // heart centre
const LIKES = [[0.6, 2.0], [3.05, 4.45]]; // [like tap, unlike tap]
const TAPS = LIKES.flat();
const DOTS = ['#FF5C8A', '#FFC24B', '#5ED3F3', '#8D6BFF', '#4BE3A0', '#FF8A4B', '#FF5C8A'];
let photo;

function heart(ctx, x, y, s) { // the classic parametric heart, about 2s wide
  ctx.beginPath();
  for (let i = 0; i <= 120; i++) {
    const a = i / 120 * TAU;
    ctx.lineTo(x + s * Math.sin(a) ** 3, y - s * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 16 - s * 0.1);
  }
  ctx.closePath();
}
const bump = (t, a, b, c, d) => smoothstep(a, b, t) * (1 - smoothstep(c, d, t));

export default {
  name: 'Like Burst',
  ko: '좋아요 버스트',
  setup() {
    const big = canvas(1080, 1920);
    city(big.getContext('2d'), 1080, 1920);
    photo = canvas(820, 560);
    photo.getContext('2d').drawImage(big, 40, 700, 1000, 683, 0, 0, 820, 560);
  },
  draw(ctx, t, W, H) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#FFF1F4'); bg.addColorStop(1, '#FFD3DE');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.shadowColor = 'rgba(120, 30, 60, 0.15)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 20;
    ctx.fillStyle = '#FFF'; ctx.beginPath(); ctx.roundRect(90, 340, 900, 1420, 52); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.roundRect(130, 380, 820, 560, 34); ctx.clip(); ctx.drawImage(photo, 130, 380); ctx.restore();
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.fillStyle = '#1C1626'; ctx.font = `800 46px ${FONT.ko}`; ctx.fillText('오늘의 야경', 140, 1020);
    ctx.fillStyle = '#8D8496'; ctx.font = `500 32px ${FONT.ko}`; ctx.fillText('@night.walker  ·  서울', 140, 1068);

    const press = Math.max(...TAPS.map(p => bump(t, p - 0.1, p, p + 0.05, p + 0.2)));
    const cyc = LIKES.find(([on, off]) => t >= on && t < off + 0.5);
    let scale = 1 - 0.12 * press, fill = 0;
    if (cyc) {
      const k = t - cyc[0], u = t - cyc[1];
      // ring: a disc grows, then a hole opens inside it
      const R = 205 * ease.out(clamp(k / 0.3)), hole = 205 * ease.out(clamp((k - 0.12) / 0.3));
      if (R > hole + 0.5) {
        const g = ctx.createRadialGradient(HX, HY, 0, HX, HY, 205);
        g.addColorStop(0, '#FF7AA8'); g.addColorStop(1, '#A66BFF');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(HX, HY, R, 0, TAU); ctx.arc(HX, HY, hole, 0, TAU, true); ctx.fill();
      }
      const kp = clamp((k - 0.12) / 0.75); // seven pairs of dots
      if (kp > 0 && kp < 1) {
        DOTS.forEach((c, i) => {
          const a = i / 7 * TAU - TAU / 4 + cyc[0];
          for (const [da, dist, size] of [[0, 1, 20], [0.28, 0.8, 14]]) {
            const r = (190 + 200 * ease.out(kp)) * dist;
            ctx.fillStyle = c; ctx.beginPath();
            ctx.arc(HX + r * Math.cos(a + da), HY + r * Math.sin(a + da), size * (1 - kp), 0, TAU); ctx.fill();
          }
        });
      }
      const pop = ease.outBack(clamp((k - 0.15) / 0.4));
      scale = k < 0.15 ? scale * (1 - k / 0.15) : pop * (1 - 0.15 * Math.sin(Math.PI * clamp(u / 0.35)));
      fill = k < 0.15 ? 0 : 1 - smoothstep(0, 0.25, u); // the outline shrinks away, the filled heart pops in
    }
    if (scale > 0.01) {
      heart(ctx, HX, HY, 150 * scale);
      ctx.lineWidth = 15; ctx.lineJoin = 'round';
      ctx.strokeStyle = '#2B2638'; ctx.globalAlpha = 1 - fill; ctx.stroke();
      ctx.globalAlpha = fill; ctx.fillStyle = '#FF3B5C'; ctx.fill(); ctx.strokeStyle = '#FF3B5C'; ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // counter that rolls up on like and down on unlike
    const ev = TAPS.filter(p => p <= t).length, k = ease.out(clamp((t - (TAPS[ev - 1] ?? -9)) / 0.3));
    const now = ev % 2 ? '1,204' : '1,203', before = ev % 2 ? '1,203' : '1,204', dir = ev % 2 ? 1 : -1;
    ctx.save();
    ctx.beginPath(); ctx.rect(300, 1572, 480, 72); ctx.clip(); // a one-line window, so the digits roll
    ctx.textAlign = 'center'; ctx.font = `800 64px ${FONT.sans}`; ctx.fillStyle = '#1C1626';
    ctx.globalAlpha = 1 - k; ctx.fillText(before, HX, 1630 - dir * 64 * k);
    ctx.globalAlpha = k; ctx.fillText(now, HX, 1630 + dir * 64 * (1 - k));
    ctx.restore();
    ctx.textAlign = 'center'; ctx.fillStyle = '#8D8496'; ctx.font = `500 34px ${FONT.ko}`;
    ctx.fillText('명이 좋아해요', HX, 1700);

    // finger: rests below right, slides onto the heart for each tap
    const near = Math.max(...TAPS.map(p => bump(t, p - 0.4, p - 0.05, p + 0.12, p + 0.5)));
    const fx = lerp(800, HX + 30, near), fy = lerp(1620, HY + 40, near), r = 50 - 9 * press;
    ctx.save();
    ctx.shadowColor = 'rgba(80, 20, 50, 0.3)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8 * (1 - press);
    ctx.fillStyle = `rgba(60, 20, 50, ${0.2 + 0.14 * press})`;
    ctx.beginPath(); ctx.arc(fx, fy, r, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(fx, fy, r, 0, TAU); ctx.stroke();
  },
};
