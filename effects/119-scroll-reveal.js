// Scroll-triggered reveal: the page is flicked up twice; each block waits hidden until its top crosses a line near the
// bottom of the screen, then fades up. Then the page reloads: it fades out and the top blocks rise in one by one.
import { TAU, FONT, canvas, clamp, ease, smoothstep } from '../lib/util.js';
import { landscape } from '../lib/scenes.js';

const X = 60, LINE = 1800;
const PLACES = [['카페 온도', '카페 · 0.8km', '#FF8A65', '#FFB38A'], ['숲길 공원', '공원 · 1.2km', '#2EC4A6', '#8BE3C9'],
  ['창고 갤러리', '전시 · 1.5km', '#7C6CFF', '#B3A8FF'], ['한강 피크닉존', '피크닉 · 2.1km', '#5B8CFF', '#9DBBFF'],
  ['루프탑 라운지', '바 · 2.4km', '#FF5C8A', '#FF9DB8'], ['수제화 골목', '쇼핑 · 2.8km', '#FFB938', '#FFD98A'],
  ['밤도깨비 야시장', '시장 · 3.0km', '#A66BFF', '#CDA8FF'], ['북쪽 전망대', '전망 · 3.6km', '#20B8D8', '#88DDEE']];
// blocks: [kind, top at scroll 0, height, data]
const BLOCKS = [['photo', 420, 480], ['tile', 940, 240, 0], ['tile', 940, 240, 1], ['title', 1220, 60],
  ...PLACES.map((p, i) => ['place', 1300 + i * 170, 150, p])];
// two gentle flicks
const FLICKS = [[0.3, 300], [2.1, 300]];
const scroll = t => FLICKS.reduce((s, [t0, d]) => s + d * smoothstep(t0, t0 + 1.8, t), 0);
let photo, trig;

function block(ctx, [kind, , h, d], y) {
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const x = kind === 'tile' && d ? X + 500 : X, w = kind === 'tile' ? 460 : 960;
  if (kind !== 'title') {
    ctx.save();
    ctx.shadowColor = 'rgba(60, 50, 30, 0.12)'; ctx.shadowBlur = 36; ctx.shadowOffsetY = 12;
    ctx.fillStyle = kind === 'tile' ? (d ? '#DDEBFF' : '#FFE6D8') : '#FFF';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 36); ctx.fill();
    ctx.restore();
  }
  if (kind === 'photo') {
    ctx.save(); ctx.beginPath(); ctx.roundRect(X, y, 960, h, 36); ctx.clip(); ctx.drawImage(photo, X, y);
    const g = ctx.createLinearGradient(0, y + h * 0.4, 0, y + h);
    g.addColorStop(0, 'rgba(10, 5, 25, 0)'); g.addColorStop(1, 'rgba(10, 5, 25, 0.75)');
    ctx.fillStyle = g; ctx.fillRect(X, y, 960, h); ctx.restore();
    ctx.fillStyle = '#FFF'; ctx.font = `800 68px ${FONT.ko}`; ctx.fillText('제주의 여름', X + 50, y + h - 104);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; ctx.font = `500 36px ${FONT.ko}`; ctx.fillText('노을 명소 12곳', X + 50, y + h - 48);
  } else if (kind === 'tile') {
    ctx.fillStyle = d ? '#5B8CFF' : '#FF8A65'; ctx.beginPath(); ctx.arc(x + 74, y + 72, 28, 0, TAU); ctx.fill();
    ctx.fillStyle = '#5E574C'; ctx.font = `600 34px ${FONT.ko}`; ctx.fillText(d ? '수면' : '걸음 수', x + 120, y + 84);
    ctx.fillStyle = '#1D1A16'; ctx.font = `800 76px ${FONT.sans}`; ctx.fillText(d ? '7h 20m' : '8,240', x + 44, y + 196);
  } else if (kind === 'title') {
    ctx.fillStyle = '#1D1A16'; ctx.font = `800 46px ${FONT.ko}`; ctx.fillText('가까운 장소', X + 8, y + 46);
  } else {
    const [name, sub, c1, c2] = d, g = ctx.createLinearGradient(X + 24, y + 20, X + 134, y + 130);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(X + 24, y + 20, 110, 110, 26); ctx.fill();
    ctx.fillStyle = '#FFF'; ctx.font = `800 48px ${FONT.ko}`; ctx.textAlign = 'center'; ctx.fillText(name[0], X + 79, y + 92);
    ctx.textAlign = 'left'; ctx.fillStyle = '#1D1A16'; ctx.font = `700 40px ${FONT.ko}`; ctx.fillText(name, X + 168, y + 68);
    ctx.fillStyle = '#9A948A'; ctx.font = `500 30px ${FONT.ko}`; ctx.fillText(sub, X + 168, y + 114);
    ctx.fillStyle = '#FF8A65'; ctx.font = `700 32px ${FONT.sans}`; ctx.textAlign = 'right'; ctx.fillText('★ 4.8', X + 920, y + 90);
  }
}

// the whole page at scroll s; r(i) = how far block i has faded up (0..1)
function page(ctx, s, r, alpha) {
  BLOCKS.forEach((b, i) => {
    const y = b[1] - s, k = r(i);
    if (k <= 0 || y > 1920 || y + b[2] < 390) return;
    ctx.save(); ctx.globalAlpha = alpha * k; ctx.translate(0, 110 * (1 - k));
    block(ctx, b, y); ctx.restore();
  });
}

export default {
  name: 'Scroll Reveal',
  ko: '스크롤 리빌',
  setup() {
    const big = canvas(960, 900);
    landscape(big.getContext('2d'), 960, 900, 0);
    photo = canvas(960, 480);
    photo.getContext('2d').drawImage(big, 0, 200, 960, 480, 0, 0, 960, 480);
    // when each block's top crosses LINE (scroll only grows, so bisect); blocks already above it start shown
    trig = BLOCKS.map(([, top]) => {
      if (top < LINE) return -1;
      if (top - scroll(3.95) >= LINE) return 99;
      let a = 0, b = 3.95;
      for (let n = 0; n < 30; n++) { const m = (a + b) / 2; if (top - scroll(m) < LINE) b = m; else a = m; }
      return b;
    });
  },
  draw(ctx, t, W, H) {
    ctx.fillStyle = '#F5F2EC'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 390, W, H - 390); ctx.clip(); // content slides under the header
    const fade = 1 - smoothstep(3.88, 4.08, t);
    if (fade > 0) page(ctx, scroll(t), i => ease.out(clamp((t - trig[i]) / 0.6)), fade);
    if (t > 4.13) page(ctx, 0, i => (trig[i] < 0 ? ease.out(clamp((t - 4.13 - i * 0.055) / 0.45)) : 0), 1); // reloaded at the top
    ctx.restore();
    const toast = smoothstep(3.75, 3.92, t) * (1 - smoothstep(4.35, 4.55, t)); // the reload message
    if (toast > 0) {
      ctx.save(); ctx.globalAlpha = toast; ctx.translate(0, 30 * (1 - toast));
      ctx.fillStyle = '#1D1A16'; ctx.beginPath(); ctx.roundRect(330, 600, 420, 112, 56); ctx.fill();
      ctx.fillStyle = '#FFF'; ctx.font = `700 40px ${FONT.ko}`; ctx.textAlign = 'center'; ctx.fillText('새로 고침 중…', 540, 670);
      ctx.restore();
    }

    ctx.save();
    ctx.shadowColor = 'rgba(60, 50, 30, 0.10)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 8;
    ctx.fillStyle = '#F5F2EC'; ctx.fillRect(0, 0, W, 390);
    ctx.restore();
    ctx.fillStyle = '#1D1A16'; ctx.font = `800 66px ${FONT.ko}`; ctx.textAlign = 'left'; ctx.fillText('둘러보기', X, 345);
    ctx.fillStyle = '#FF8A65'; ctx.beginPath(); ctx.arc(960, 322, 40, 0, TAU); ctx.fill();
    ctx.fillStyle = '#FFF'; ctx.font = `700 36px ${FONT.ko}`; ctx.textAlign = 'center'; ctx.fillText('수', 960, 335);

    // the finger: fades in, drags the page (moving with it) and lets go
    for (const [t0] of FLICKS) {
      const a = smoothstep(t0 - 0.25, t0, t) * (1 - smoothstep(t0 + 0.7, t0 + 0.95, t));
      if (a <= 0) continue;
      const fy = 1500 - (scroll(Math.min(t, t0 + 0.8)) - scroll(t0));
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(40, 30, 20, 0.28)'; ctx.beginPath(); ctx.arc(760, fy, 50, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#FFF'; ctx.lineWidth = 5; ctx.stroke();
      ctx.globalAlpha = 1;
    }
  },
};
