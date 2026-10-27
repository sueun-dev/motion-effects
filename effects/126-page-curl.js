// Page peel: the corner is dragged across the page; the fold line is the perpendicular bisector of the corner and the
// finger, the part past it is cut off and drawn mirrored (the paper's back, shaded like a curl), the next page shows below.
import { TAU, FONT, canvas, smoothstep } from '../lib/util.js';
import { landscape } from '../lib/scenes.js';

const X0 = 110, Y0 = 360, PW = 860, PH = 1360, X1 = X0 + PW, Y1 = Y0 + PH;
const TURNS = [0.2, 2.7], DUR = 2.2; // pages A, B alternate, so two turns make a loop
const TEXT_A = ['새벽 다섯 시, 마을은 아직', '잠들어 있었다. 하늘은 남색에서', '보라로 천천히 물들었고, 멀리서', '첫 버스가 언덕을 넘어오는', '소리가 났다.', '', '나는 낡은 배낭을 메고 정류장', '으로 걸었다. 주머니 속 쪽지에는', '할머니의 글씨로 짧은 한 줄이', '적혀 있었다.', '', '“바다는 늘 그 자리에 있단다.”'];
const TEXT_B = ['버스 창밖으로 해가 떠오르자', '바다가 한꺼번에 빛났다.', '나는 그제야 쪽지의 뜻을', '조금 알 것 같았다.'];
let pages, layer;

function page(draw) {
  const c = canvas(PW, PH), g = c.getContext('2d');
  const paper = g.createLinearGradient(0, 0, PW, 0);
  paper.addColorStop(0, '#E9E1D0'); paper.addColorStop(0.06, '#FBF7EF'); paper.addColorStop(1, '#FFFDF8');
  g.fillStyle = paper; g.fillRect(0, 0, PW, PH);
  g.fillStyle = '#A89A84'; g.font = `500 28px ${FONT.ko}`; g.textAlign = 'center'; g.fillText('바다로 가는 길', PW / 2, 90);
  g.fillText('· · ·', PW / 2, PH - 70);
  g.textAlign = 'left';
  draw(g);
  return c;
}

// clip a polygon to the half-plane (p - m) . n >= 0 (or <= 0 when side = -1)
function cut(poly, m, n, side) {
  const d = p => side * ((p[0] - m[0]) * n[0] + (p[1] - m[1]) * n[1]), out = [];
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length], dp = d(p), dq = d(q);
    if (dp >= 0) out.push(p);
    if (dp * dq < 0) { const k = dp / (dp - dq); out.push([p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k]); }
  });
  return out;
}
const path = (ctx, poly) => { ctx.beginPath(); poly.forEach(p => ctx.lineTo(p[0], p[1])); ctx.closePath(); };

function frame(ctx, t, W, H) {
  const bg = ctx.createRadialGradient(W / 2, 1000, 200, W / 2, 1000, 1300);
  bg.addColorStop(0, '#3A2C24'); bg.addColorStop(1, '#16100D');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.save(); // the pages under this one give the book some thickness
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 20;
  for (let i = 3; i >= 1; i--) { ctx.fillStyle = `rgb(${232 - i * 14}, ${224 - i * 14}, ${206 - i * 14})`; ctx.fillRect(X0, Y0 + i * 4, PW + i * 7, PH); }
  ctx.restore();

  const n0 = TURNS.filter(s => t >= s + DUR).length, turning = TURNS.findIndex(s => t >= s && t < s + DUR);
  const cur = pages[n0 % 2], next = pages[(n0 + 1) % 2];
  const rect = [[X0, Y0], [X1, Y0], [X1, Y1], [X0, Y1]];
  if (turning < 0) { ctx.drawImage(cur, X0, Y0); return; }

  // the dragged corner: from bottom-right to its mirror image past the spine, lifting on the way
  const e = smoothstep(0, 1, (t - TURNS[turning]) / DUR); // gentle ease (peak speed 1.5x the average)
  const P = [X1 - 2 * PW * e, Y1 - 420 * Math.sin(Math.PI * e) * (1 - e)], C = [X1, Y1];
  const len = Math.hypot(C[0] - P[0], C[1] - P[1]);
  ctx.drawImage(next, X0, Y0);
  if (len < 1) { ctx.drawImage(cur, X0, Y0); return; }
  const n = [(C[0] - P[0]) / len, (C[1] - P[1]) / len], M = [(C[0] + P[0]) / 2, (C[1] + P[1]) / 2];
  const gone = cut(rect, M, n, 1), stay = cut(rect, M, n, -1), fade = Math.sin(Math.PI * e) ** 0.5;
  const along = (d0, d1) => ctx.createLinearGradient(M[0] + n[0] * d0, M[1] + n[1] * d0, M[0] + n[0] * d1, M[1] + n[1] * d1);

  if (gone.length > 2) { // shadow on the next page along the fold
    ctx.save(); path(ctx, gone); ctx.clip();
    const s = along(0, 220);
    s.addColorStop(0, `rgba(40, 25, 10, ${0.32 * fade})`); s.addColorStop(1, 'rgba(40, 25, 10, 0)');
    ctx.fillStyle = s; ctx.fillRect(X0, Y0, PW, PH); ctx.restore();
  }
  if (stay.length > 2) { ctx.save(); path(ctx, stay); ctx.clip(); ctx.drawImage(cur, X0, Y0); ctx.restore(); }

  // the flap: the cut-off part mirrored over the fold line, kept to the right of the spine
  const flap = gone.map(([x, y]) => { const d = 2 * ((x - M[0]) * n[0] + (y - M[1]) * n[1]); return [x - d * n[0], y - d * n[1]]; });
  if (flap.length > 2) {
    ctx.save();
    ctx.beginPath(); ctx.rect(X0, Y0 - 6, W, PH + 12); ctx.clip();
    ctx.shadowColor = `rgba(20, 10, 0, ${0.38 * fade})`; ctx.shadowBlur = 60; ctx.shadowOffsetX = -10 * n[0]; ctx.shadowOffsetY = -10 * n[1];
    const back = along(0, -600); // bright just past the fold (the curl), duller towards the tip
    back.addColorStop(0, '#DED5C3'); back.addColorStop(0.07, '#FFFDF7'); back.addColorStop(1, '#E6DDCB');
    ctx.fillStyle = back; path(ctx, flap); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.clip();
    const k = 2 * (M[0] * n[0] + M[1] * n[1]); // the print showing through, mirrored
    ctx.globalAlpha = 0.05;
    ctx.setTransform(1 - 2 * n[0] * n[0], -2 * n[0] * n[1], -2 * n[0] * n[1], 1 - 2 * n[1] * n[1], k * n[0], k * n[1]);
    ctx.drawImage(cur, X0, Y0);
    ctx.restore();
  }

  const a = smoothstep(0, 0.12, e) * (1 - smoothstep(0.55, 0.75, e)); // the finger holding the corner
  if (a > 0) {
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(30, 20, 10, 0.3)'; ctx.beginPath(); ctx.arc(P[0] + 10, P[1] - 10, 52, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#FFF'; ctx.lineWidth = 5; ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

export default {
  name: 'Page Curl',
  ko: '페이지 넘김',
  setup() {
    layer = canvas();
    const big = canvas(700, 700);
    landscape(big.getContext('2d'), 700, 700, 0);
    pages = [page(g => {
      g.fillStyle = '#B4462F'; g.font = `500 40px ${FONT.serif}`; g.fillText('III', 80, 250);
      g.fillStyle = '#2A2118'; g.font = `800 64px ${FONT.ko}`; g.fillText('바다로 가는 길', 80, 340);
      g.fillStyle = '#B4462F'; g.fillRect(80, 380, 90, 5);
      g.fillStyle = '#3B3128'; g.font = `500 38px ${FONT.ko}`;
      TEXT_A.forEach((l, i) => g.fillText(l, 80, 500 + i * 64));
    }), page(g => {
      g.save(); g.beginPath(); g.roundRect(80, 180, PW - 160, 560, 20); g.clip();
      g.drawImage(big, 0, 150, 700, 560, 80, 180, PW - 160, 560); g.restore();
      g.fillStyle = '#8A7C68'; g.font = `italic 500 30px ${FONT.ko}`; g.fillText('그날 아침의 바다', 80, 800);
      g.fillStyle = '#3B3128'; g.font = `500 38px ${FONT.ko}`;
      TEXT_B.forEach((l, i) => g.fillText(l, 80, 920 + i * 64));
    })];
  },
  draw(ctx, t, W, H) { // motion blur: six renders spread over one frame, averaged
    const l = layer.getContext('2d');
    for (let k = 0; k < 6; k++) {
      l.save(); frame(l, t + (k / 5 - 0.5) / 30, W, H); l.restore();
      ctx.globalAlpha = 1 / (k + 1); ctx.drawImage(layer, 0, 0);
    }
    ctx.globalAlpha = 1;
  },
};
