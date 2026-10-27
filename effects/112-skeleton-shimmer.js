// Skeleton loading: grey placeholder shapes with a diagonal light band sweeping over them (a moving linear gradient
// clipped to the shapes). Then the real posts fade in piece by piece, and later fold back into the skeleton.
import { TAU, FONT, canvas, clamp, ease, smoothstep, fract } from '../lib/util.js';
import { landscape, city } from '../lib/scenes.js';

const X = 70, TOPS = [420, 1140];
const POSTS = [
  { name: '김하늘', sub: '2분 전 · 제주', line1: '노을이 이렇게 예쁠 줄은 몰랐어요.', line2: '#여행  #주말  #노을', colors: ['#FF8A65', '#E8577A'] },
  { name: '이도윤', sub: '1시간 전 · 서울', line1: '퇴근길에 올려다본 오늘의 야경', line2: '#야경  #도시  #퇴근길', colors: ['#6C8BFF', '#8E5CF7'] },
];
const TEXT = [null, ['name', 700, 40, '#151A2D'], ['sub', 500, 30, '#8A91A5'], null, ['line1', 500, 36, '#2A3047'], ['line2', 600, 34, '#5B6CFF']];
const photos = [];

// placeholder shapes of one post: [kind, x, y, w, h] (a circle is [kind, cx, cy, r])
const shapes = y => [
  ['circle', X + 98, y + 96, 48],
  ['bar', X + 176, y + 58, 300, 34],
  ['bar', X + 176, y + 110, 200, 26],
  ['img', X + 50, y + 180, 840, 330],
  ['bar', X + 50, y + 556, 740, 30],
  ['bar', X + 50, y + 608, 460, 30],
];

function path(ctx, s) {
  ctx.beginPath();
  if (s[0] === 'circle') ctx.arc(s[1], s[2], s[3], 0, TAU);
  else ctx.roundRect(s[1], s[2], s[3], s[4], s[0] === 'img' ? 28 : s[4] / 2);
}

function content(ctx, s, i, post, p) {
  ctx.textBaseline = 'middle';
  if (i === 0) {
    const g = ctx.createLinearGradient(s[1] - s[3], s[2] - s[3], s[1] + s[3], s[2] + s[3]);
    g.addColorStop(0, post.colors[0]); g.addColorStop(1, post.colors[1]);
    ctx.fillStyle = g; path(ctx, s); ctx.fill();
    ctx.fillStyle = '#FFF'; ctx.font = `700 40px ${FONT.ko}`; ctx.textAlign = 'center';
    ctx.fillText(post.name[0], s[1], s[2] + 2); ctx.textAlign = 'left';
  } else if (i === 3) {
    ctx.save(); path(ctx, s); ctx.clip(); ctx.drawImage(photos[p], s[1], s[2]); ctx.restore();
  } else {
    const [key, weight, size, color] = TEXT[i];
    ctx.font = `${weight} ${size}px ${FONT.ko}`; ctx.fillStyle = color;
    ctx.fillText(post[key], s[1], s[2] + s[4] / 2 + 2);
  }
}

export default {
  name: 'Skeleton Shimmer',
  ko: '스켈레톤 시머',
  setup() {
    // crops of the two pictures: [scene, picture w, h, crop x, y, w, h]
    for (const [scene, w, h, ...crop] of [[landscape, 840, 800, 0, 190, 840, 330], [city, 1080, 1920, 0, 780, 1080, 424]]) {
      const big = canvas(w, h), c = canvas(840, 330);
      scene(big.getContext('2d'), w, h, 0);
      c.getContext('2d').drawImage(big, ...crop, 0, 0, 840, 330);
      photos.push(c);
    }
  },
  draw(ctx, t, W, H) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#EEF1F8'); bg.addColorStop(1, '#DCE2EE');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#151A2D'; ctx.font = `800 64px ${FONT.ko}`; ctx.textBaseline = 'alphabetic';
    ctx.fillText('피드', X + 6, 360);

    // the light band: 3 sweeps per loop, slanted so it reaches the lower card a moment later
    const bx = -900 + fract(t * 3 / 5) * 3000;
    const band = ctx.createLinearGradient(bx - 320, 0, bx + 320, 240);
    band.addColorStop(0, 'rgba(255,255,255,0)'); band.addColorStop(0.5, 'rgba(255,255,255,0.9)'); band.addColorStop(1, 'rgba(255,255,255,0)');

    TOPS.forEach((top, p) => {
      ctx.save();
      ctx.shadowColor = 'rgba(30, 40, 90, 0.12)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 16;
      ctx.fillStyle = '#FFF'; ctx.beginPath(); ctx.roundRect(X, top, 940, 680, 40); ctx.fill();
      ctx.restore();
      shapes(top).forEach((s, i) => {
        const k = clamp((t - (1.9 + p * 0.3 + i * 0.07)) / 0.45);
        const r = ease.out(k) * (1 - smoothstep(4.25 + p * 0.1, 4.75 + p * 0.1, t)); // 0 = skeleton, 1 = loaded
        if (r < 1) {
          ctx.save(); ctx.globalAlpha = 1 - r;
          path(ctx, s); ctx.fillStyle = '#E1E6EF'; ctx.fill();
          ctx.clip(); ctx.fillStyle = band; ctx.fillRect(X, top, 940, 680);
          ctx.restore();
        }
        if (r > 0) {
          ctx.save(); ctx.globalAlpha = r; ctx.translate(0, (1 - r) * 14);
          content(ctx, s, i, POSTS[p], p);
          ctx.restore();
        }
      });
    });
  },
};
