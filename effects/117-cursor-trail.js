// Cursor trail: the pointer runs a looping Lissajous path; the tail is the same path sampled back in time, drawn as a
// tapering colour line (plus a blurred copy for glow) that breaks into shrinking dots, with a lagging follower ring.
import { TAU, FONT, canvas, lerp } from '../lib/util.js';

const LINE = 34, DOTS = 12, DT = 0.011;
let glow;

const pos = t => {
  const a = t / 5 * TAU;
  return [540 + 360 * Math.sin(3 * a + 0.5), 960 + 440 * Math.sin(2 * a)];
};

function arrow(ctx, x, y) {
  const P = [[0, 0], [0, 35], [9, 27], [15, 41], [21, 38], [15, 25], [26, 25]];
  ctx.save();
  ctx.translate(x, y); ctx.scale(2.3, 2.3);
  ctx.beginPath(); P.forEach(([px, py]) => ctx.lineTo(px, py)); ctx.closePath();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#FFF'; ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.lineJoin = 'round'; ctx.lineWidth = 1.6; ctx.strokeStyle = '#11131F'; ctx.stroke();
  ctx.restore();
}

function tail(ctx, t) { // the line part, tail first so the head is on top
  ctx.lineCap = 'round';
  for (let i = LINE; i > 0; i--) {
    const [x0, y0] = pos(t - i * DT), [x1, y1] = pos(t - (i - 1) * DT), k = i / LINE;
    ctx.strokeStyle = `hsl(${185 + 115 * k}, 95%, ${64 - 12 * k}%)`;
    ctx.lineWidth = lerp(26, 4, k);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
}

export default {
  name: 'Cursor Trail',
  ko: '커서 트레일',
  setup() { glow = canvas(); },
  draw(ctx, t, W, H) {
    const bg = ctx.createRadialGradient(W / 2, 900, 100, W / 2, 900, 1300);
    bg.addColorStop(0, '#1A1B3D'); bg.addColorStop(1, '#07081A');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    const [cx, cy] = pos(t);
    for (let y = 420; y <= 1500; y += 60) { // dot grid that brightens near the cursor
      for (let x = 60; x <= 1020; x += 60) {
        const near = Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / 50000);
        ctx.fillStyle = `rgba(170, 180, 255, ${0.12 + 0.5 * near})`;
        ctx.beginPath(); ctx.arc(x, y, 3 + 2 * near, 0, TAU); ctx.fill();
      }
    }

    const g = glow.getContext('2d');
    g.clearRect(0, 0, W, H); tail(g, t);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; ctx.filter = 'blur(22px)'; ctx.globalAlpha = 0.9;
    ctx.drawImage(glow, 0, 0);
    ctx.restore();
    ctx.drawImage(glow, 0, 0);
    for (let d = 0; d < DOTS; d++) { // after the line the tail breaks into dots
      const k = d / DOTS, [x, y] = pos(t - (LINE + 3 + d * 4) * DT);
      ctx.fillStyle = `hsla(${302 + 40 * k}, 95%, 64%, ${1 - k * 0.8})`;
      ctx.beginPath(); ctx.arc(x, y, 11 * (1 - k) + 3, 0, TAU); ctx.fill();
    }

    const [rx, ry] = pos(t - 0.09); // follower ring
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(rx, ry, 46, 0, TAU); ctx.stroke();
    arrow(ctx, cx, cy);

    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#FFF'; ctx.font = `700 52px ${FONT.display}`; ctx.textAlign = 'left'; ctx.fillText('flow.', 70, 330);
    ctx.font = `500 30px ${FONT.sans}`; ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; ctx.textAlign = 'right';
    ctx.fillText('Work      About      Contact', 1010, 326);
    ctx.textAlign = 'center'; ctx.fillStyle = '#FFF'; ctx.font = `700 104px ${FONT.display}`;
    ctx.fillText('Follow the light', W / 2, 1660);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; ctx.font = `500 38px ${FONT.ko}`;
    ctx.fillText('커서를 따라오는 점과 선의 꼬리', W / 2, 1740);
  },
};
