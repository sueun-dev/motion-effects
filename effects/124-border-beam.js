// Border beam: two glowing trails run round a card's rounded border at constant speed (points found by arc length
// along the outline), drawn sharp plus a blurred copy for glow, and their heads light up the card surface below.
import { TAU, FONT, canvas, lerp } from '../lib/util.js';

const X = 110, Y = 470, CW = 860, CH = 1180, R = 56;
const SIDES = [CW - 2 * R, CH - 2 * R], ARC = R * TAU / 4;
const PER = 2 * SIDES[0] + 2 * SIDES[1] + 4 * ARC;
const BEAMS = [[0, [255, 150, 60], [255, 60, 140]], [0.5, [60, 220, 255], [150, 90, 255]]]; // offset, head colour, tail colour
let glow;

// point at arc length s along the border, clockwise from the top-left corner's end
function at(s) {
  s = ((s % PER) + PER) % PER;
  const corners = [[X + CW - R, Y + R], [X + CW - R, Y + CH - R], [X + R, Y + CH - R], [X + R, Y + R]];
  const starts = [[X + R, Y], [X + CW, Y + R], [X + CW - R, Y + CH], [X, Y + CH - R]], dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  for (let k = 0; k < 4; k++) {
    const len = SIDES[k % 2];
    if (s < len) return [starts[k][0] + dirs[k][0] * s, starts[k][1] + dirs[k][1] * s];
    s -= len;
    if (s < ARC) { const a = -TAU / 4 + k * TAU / 4 + s / R; return [corners[k][0] + R * Math.cos(a), corners[k][1] + R * Math.sin(a)]; }
    s -= ARC;
  }
  return starts[0];
}

function beams(ctx, t) {
  ctx.lineCap = 'butt';
  for (const [off, head, tail] of BEAMS) {
    const s = (t / 5 + off) * PER, N = 150, ds = 7;
    for (let i = N - 1; i >= 0; i--) {
      const k = i / N, [x0, y0] = at(s - (i + 1) * ds), [x1, y1] = at(s - i * ds);
      const c = head.map((v, j) => Math.round(lerp(v, tail[j], k)));
      ctx.strokeStyle = `rgba(${c}, ${(1 - k) ** 1.3})`; ctx.lineWidth = lerp(10, 3, k);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
    const [hx, hy] = at(s); // hot white head
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'; ctx.beginPath(); ctx.arc(hx, hy, 5, 0, TAU); ctx.fill();
  }
}

export default {
  name: 'Border Beam',
  ko: '보더 빔',
  setup() { glow = canvas(); },
  draw(ctx, t, W, H) {
    ctx.fillStyle = '#07080F'; ctx.fillRect(0, 0, W, H);
    const bgGlow = ctx.createRadialGradient(W / 2, 1060, 100, W / 2, 1060, 900);
    bgGlow.addColorStop(0, 'rgba(90, 70, 200, 0.22)'); bgGlow.addColorStop(1, 'rgba(90, 70, 200, 0)');
    ctx.fillStyle = bgGlow; ctx.fillRect(0, 0, W, H);

    ctx.save(); // card surface, lit a little where each beam head is
    ctx.beginPath(); ctx.roundRect(X, Y, CW, CH, R); ctx.clip();
    ctx.fillStyle = '#10121F'; ctx.fillRect(X, Y, CW, CH);
    for (const [off, head] of BEAMS) {
      const [hx, hy] = at((t / 5 + off) * PER), g = ctx.createRadialGradient(hx, hy, 0, hx, hy, 420);
      g.addColorStop(0, `rgba(${head}, 0.16)`); g.addColorStop(1, `rgba(${head}, 0)`);
      ctx.fillStyle = g; ctx.fillRect(X, Y, CW, CH);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(X, Y, CW, CH, R); ctx.stroke();

    const g = glow.getContext('2d');
    g.clearRect(0, 0, W, H); beams(g, t);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.filter = 'blur(36px)'; ctx.drawImage(glow, 0, 0); ctx.drawImage(glow, 0, 0);
    ctx.filter = 'blur(12px)'; ctx.drawImage(glow, 0, 0); ctx.drawImage(glow, 0, 0);
    ctx.restore();
    ctx.drawImage(glow, 0, 0);

    // pricing card content
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    const badge = ctx.createLinearGradient(X + 70, 0, X + 250, 0);
    badge.addColorStop(0, '#FF9A3C'); badge.addColorStop(1, '#FF3C8C');
    ctx.fillStyle = 'rgba(255, 120, 100, 0.14)'; ctx.beginPath(); ctx.roundRect(X + 70, Y + 80, 190, 64, 32); ctx.fill();
    ctx.fillStyle = badge; ctx.font = `800 32px ${FONT.sans}`; ctx.fillText('★ 인기', X + 104, Y + 124);
    ctx.fillStyle = '#FFF'; ctx.font = `800 70px ${FONT.ko}`; ctx.fillText('Pro 플랜', X + 70, Y + 250);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'; ctx.font = `500 34px ${FONT.ko}`; ctx.fillText('팀을 위한 모든 기능', X + 70, Y + 306);
    ctx.fillStyle = '#FFF'; ctx.font = `800 120px ${FONT.sans}`; ctx.fillText('₩19,900', X + 64, Y + 470);
    const pw = ctx.measureText('₩19,900').width;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'; ctx.font = `500 40px ${FONT.ko}`; ctx.fillText('/ 월', X + 84 + pw, Y + 470);
    ['무제한 프로젝트', 'AI 요약 · 번역', '실시간 협업', '우선 고객 지원'].forEach((f, i) => {
      const fy = Y + 590 + i * 92;
      ctx.fillStyle = 'rgba(90, 230, 170, 0.16)'; ctx.beginPath(); ctx.arc(X + 96, fy - 12, 26, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#5AE6AA'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(X + 84, fy - 12); ctx.lineTo(X + 93, fy - 3); ctx.lineTo(X + 109, fy - 22); ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.88)'; ctx.font = `500 38px ${FONT.ko}`; ctx.fillText(f, X + 146, fy);
    });
    const btn = ctx.createLinearGradient(X + 70, 0, X + CW - 70, 0);
    btn.addColorStop(0, '#FF8A3C'); btn.addColorStop(1, '#FF3C8C');
    ctx.fillStyle = btn; ctx.beginPath(); ctx.roundRect(X + 70, Y + CH - 220, CW - 140, 140, 70); ctx.fill();
    ctx.fillStyle = '#FFF'; ctx.font = `800 48px ${FONT.ko}`; ctx.textAlign = 'center';
    ctx.fillText('지금 시작하기', W / 2, Y + CH - 133);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'; ctx.font = `500 30px ${FONT.ko}`;
    ctx.fillText('14일 무료 체험 · 언제든 해지', W / 2, Y + CH + 90);
  },
};
