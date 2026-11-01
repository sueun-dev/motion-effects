// Ukiyo-e woodblock print of a great wave: flat Prussian-blue colour blocks with a dark key line, a foam crest,
// white claws along the curling lip, spray falling like snow, a snow-capped mountain far away under the wave,
// slim boats riding the swell, a sky with a graded band at the top and a red title cartouche. The wave's spine
// breathes and its lip curls in and out on the loop while the claws flex; the wood-grain paper is made once in
// setup and printed over everything, so it never changes from frame to frame.
import { FONT, TAU, canvas, fbm3, lerp, rng } from '../lib/util.js';

const C = { key: '#1B2236', deep: '#1D3B6E', mid: '#2F5C97', light: '#8DAED3', pale: '#C9D8E6', foam: '#F5EFDF', sky: '#EADFC3', band: '#B8AC90', fuji: '#5F7898', red: '#B8452F' };
let paper = null;

// Catmull-Rom through the points, then a spiral curling off the end (turns, start radius, direction)
function spine(pts, turns, r0, dir) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < 24; k++) {
      const u = k / 24;
      out.push([0, 1].map(j => 0.5 * (2 * p1[j] + (p2[j] - p0[j]) * u + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * u * u + (3 * p1[j] - p0[j] - 3 * p2[j] + p3[j]) * u * u * u)));
    }
  }
  const [ex, ey] = pts[pts.length - 1], [px, py] = out[out.length - 1], d = Math.hypot(ex - px, ey - py);
  out.push([ex, ey]);
  const cx = ex - (ey - py) / d * r0 * dir, cy = ey + (ex - px) / d * r0 * dir, a0 = Math.atan2(ey - cy, ex - cx);
  for (let i = 1; i <= 50; i++) {
    const u = i / 50, a = a0 + dir * u * turns * TAU, r = r0 * (1 - 0.75 * u);
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  let L = 0;
  const s = out.map((p, i) => (L += i ? Math.hypot(p[0] - out[i - 1][0], p[1] - out[i - 1][1]) : 0) );
  return { pts: out, u: s.map(x => x / L), L };
}

// the two edges of a body of water around a spine, width(u) across: A is the back of the wave (the outside of the
// curl), on the left of travel for a clockwise curl (side 1) and on the right for an anticlockwise one (side -1)
function edges(sp, width, side) {
  const A = [], B = [], N = [];
  sp.pts.forEach((p, i) => {
    const a = sp.pts[Math.max(0, i - 1)], b = sp.pts[Math.min(sp.pts.length - 1, i + 1)], d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = side * (b[1] - a[1]) / d, ny = -side * (b[0] - a[0]) / d, w = width(sp.u[i]) / 2;
    A.push([p[0] + nx * w, p[1] + ny * w]); B.push([p[0] - nx * w, p[1] - ny * w]); N.push([nx, ny]);
  });
  return { A, B, N };
}

const ramp = (u, stops) => { // piecewise-linear [u, value] table
  for (let i = 1; i < stops.length; i++) if (u <= stops[i][0]) return lerp(stops[i - 1][1], stops[i][1], (u - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
  return stops[stops.length - 1][1];
};

function poly(ctx, pts, fill, line = 0) {
  ctx.beginPath(); for (const p of pts) ctx.lineTo(p[0], p[1]); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (line) { ctx.lineWidth = line; ctx.strokeStyle = C.key; ctx.stroke(); }
}

// a wave: body, flow lines, foam crest, claws along the lip ({ n, span of u, length, turn direction })
function wave(ctx, sp, width, a, claws) {
  const { A, B, N } = edges(sp, width, claws.turn);
  const body = [...A, ...B.slice().reverse()];
  poly(ctx, body, C.deep);
  ctx.save(); poly(ctx, body); ctx.clip();
  // flow lines: offset copies of the spine in lighter blues, thinning toward the lip
  for (let k = -3; k <= 4; k++) {
    ctx.beginPath();
    sp.pts.forEach((p, i) => { const w = width(sp.u[i]) / 2 * (k / 5); ctx.lineTo(p[0] + N[i][0] * w, p[1] + N[i][1] * w); });
    ctx.lineWidth = k < 0 ? 16 : 9; ctx.strokeStyle = k < 0 ? C.mid : C.light; ctx.globalAlpha = k < 0 ? 0.9 : 0.55; ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // foam: a scalloped white band inside the back edge, from the shoulder over the crest to the lip
  const F = [], G = [];
  sp.pts.forEach((p, i) => {
    const u = sp.u[i];
    if (u < 0.42) return;
    const fw = ramp(u, [[0.42, 0], [0.55, 46], [0.8, 60], [1, 30]]) * (0.75 + 0.25 * Math.abs(Math.sin(u * 90)));
    F.push(A[i]); G.push([A[i][0] - N[i][0] * fw, A[i][1] - N[i][1] * fw]);
  });
  poly(ctx, [...F, ...G.reverse()], C.foam);
  ctx.restore();
  poly(ctx, body, null, 5);
  // claws: tapering foam fingers reaching forward off the lip and hooking down, flexing with a travelling phase
  const [u0, u1] = claws.span;
  for (let j = 0; j < claws.n; j++) {
    const u = u0 + (j + 0.5) / claws.n * (u1 - u0), i = sp.u.findIndex(x => x >= u), [x, y] = A[i];
    const [px, py] = sp.pts[Math.min(i + 1, sp.pts.length - 1)], [qx, qy] = sp.pts[Math.max(i - 1, 0)];
    const dir = Math.atan2(py - qy, px - qx) - claws.turn * (0.75 + 0.15 * Math.sin(a + j * 0.9)); // out and forward
    claw(ctx, x, y, dir, claws.len * (0.65 + 0.5 * Math.sin(j * 2.3 + 1) ** 2), claws.turn * (2.1 + 0.4 * Math.sin(a + j * 0.9 + 1))); // hooking down
  }
}

// one claw: a little spine that bends harder toward its tip; a ribbon 18 px wide at the root, pointed at the tip
function claw(ctx, x, y, dir, len, curl) {
  const P = [], Q = [];
  let px = x, py = y;
  for (let k = 0; k <= 14; k++) {
    const f = k / 14, ang = dir + curl * f * f, w = 10 * (1 - f) + 1;
    P.push([px - Math.sin(ang) * w, py + Math.cos(ang) * w]); Q.push([px + Math.sin(ang) * w, py - Math.cos(ang) * w]);
    px += Math.cos(ang) * len / 14; py += Math.sin(ang) * len / 14;
  }
  poly(ctx, [...P, ...Q.reverse()], C.foam, 3);
}

function boat(ctx, x, y, rot, len) { // a long narrow boat with a crew crouching low, a pale hull and a keyline
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.lineWidth = 3; ctx.strokeStyle = C.key;
  for (let k = 0; k < 8; k++) { // crew: blue backs with pale heads
    const cx = -len / 2 + 60 + k * (len - 120) / 7;
    ctx.beginPath(); ctx.ellipse(cx, -16, 16, 20, -0.3, Math.PI, TAU); ctx.closePath(); ctx.fillStyle = C.mid; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + 8, -32, 7, 0, TAU); ctx.fillStyle = '#E9D9B6'; ctx.fill(); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(-len / 2, -22); ctx.quadraticCurveTo(-len / 2 + 30, 0, 0, 4); ctx.quadraticCurveTo(len / 2 - 30, 0, len / 2, -30);
  ctx.lineTo(len / 2 - 26, 16); ctx.quadraticCurveTo(0, 26, -len / 2 + 22, 14); ctx.closePath();
  ctx.fillStyle = '#E3C98F'; ctx.fill(); ctx.stroke();
  ctx.restore();
}

export default {
  name: 'Ukiyo-e',
  ko: '우키요에',
  setup(_, W, H) {
    paper = canvas(W, H); // wood grain and fibres, printed over the whole picture with multiply
    const g = paper.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    for (let y = -20; y < H + 20; y += 5) {
      g.beginPath();
      for (let x = 0; x <= W; x += 20) g.lineTo(x, y + 26 * fbm3(x / 420, y / 160, 3.7));
      const v = fbm3(3.1, y / 90, 8.2);
      g.lineWidth = 2 + 2 * Math.abs(v); g.strokeStyle = `rgba(120, 95, 60, ${0.05 + 0.08 * Math.abs(v)})`; g.stroke();
    }
    const r = rng(17);
    for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(110, 90, 60, ${0.06 + 0.06 * r()})`; g.fillRect(r() * W, r() * H, 1 + r() * 6, 1); }
  },
  draw(ctx, t, W, H) {
    const a = t / 5 * TAU;
    // sky with a graded band at the top (bokashi) and two flat clouds
    const sky = ctx.createLinearGradient(0, 0, 0, 900);
    sky.addColorStop(0, C.band); sky.addColorStop(0.45, C.sky); sky.addColorStop(1, C.sky);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#DCCFAE';
    for (const [x, y, s] of [[820, 470, 1], [250, 330, 0.8]]) { ctx.beginPath(); ctx.ellipse(x, y, 190 * s, 26 * s, 0, 0, TAU); ctx.ellipse(x - 60 * s, y - 22 * s, 110 * s, 24 * s, 0, 0, TAU); ctx.fill(); }

    // the mountain far away, on the horizon under the curl
    const fx = 690, fy = 1360;
    ctx.beginPath(); ctx.moveTo(fx - 230, fy); ctx.quadraticCurveTo(fx - 70, fy - 120, fx - 26, fy - 190); ctx.lineTo(fx + 26, fy - 190); ctx.quadraticCurveTo(fx + 70, fy - 120, fx + 230, fy); ctx.closePath();
    ctx.fillStyle = C.fuji; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.key; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(fx - 62, fy - 128); ctx.lineTo(fx - 26, fy - 190); ctx.lineTo(fx + 26, fy - 190); ctx.lineTo(fx + 62, fy - 128);
    for (let k = 0; k < 6; k++) ctx.lineTo(fx + 62 - (k + 0.5) * 124 / 6, fy - 128 + (k % 2 ? -14 : 12)); // ragged snow line
    ctx.closePath(); ctx.fillStyle = C.foam; ctx.fill(); ctx.stroke();
    // the distant sea
    ctx.fillStyle = C.mid; ctx.fillRect(0, fy, W, H - fy);
    ctx.strokeStyle = C.light; ctx.lineWidth = 5;
    for (let y = fy + 30; y < H; y += 46) { ctx.beginPath(); for (let x = 0; x <= W; x += 30) ctx.lineTo(x, y + 8 * Math.sin(x / 70 + y + a)); ctx.stroke(); }

    boat(ctx, 640, 1500 + 10 * Math.sin(a + 1), -0.06 + 0.05 * Math.sin(a + 2), 380);

    // the great wave: its spine sways, the lip curls in and out
    const big = spine([[-170, 1820], [30, 1420], [190, 1040], [370 + 8 * Math.sin(a), 760 + 12 * Math.sin(a)], [590, 610 + 16 * Math.sin(a + 0.5)],
      [790 + 10 * Math.sin(a + 0.8), 650 + 12 * Math.sin(a + 1)], [900 + 14 * Math.sin(a + 1.2), 800 + 8 * Math.sin(a + 1.4)]], 1.05 + 0.12 * Math.sin(a + 1.8), 92, 1);
    wave(ctx, big, u => ramp(u, [[0, 940], [0.25, 560], [0.5, 260], [0.72, 130], [0.86, 70], [1, 8]]), a, { n: 20, span: [0.58, 0.86], len: 130, turn: 1 });

    // spray: drops falling from the lip like snow, each one fading in and out on its own loop
    const r = rng(3);
    for (let i = 0; i < 70; i++) {
      const x0 = 520 + r() * 520, y0 = 640 + r() * 260, q = (t / 5 + r()) % 1, size = 4 + r() * 7;
      const x = x0 + 60 * q + 10 * Math.sin(q * TAU + i), y = y0 + 380 * q;
      ctx.globalAlpha = Math.sin(q * Math.PI);
      ctx.fillStyle = C.foam; ctx.beginPath(); ctx.arc(x, y, size, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    boat(ctx, 450, 1760 + 12 * Math.sin(a + 2.5), 0.32 + 0.06 * Math.sin(a + 3), 420);

    // a smaller wave in front, curling the other way
    const small = spine([[1260, 1990], [1060, 1790], [880 + 8 * Math.sin(a + 2), 1640 + 10 * Math.sin(a + 2)], [740, 1620 + 8 * Math.sin(a + 2.6)], [660, 1690]], 0.9 + 0.1 * Math.sin(a + 3), 46, -1);
    wave(ctx, small, u => ramp(u, [[0, 520], [0.4, 260], [0.75, 90], [1, 6]]), a + 2, { n: 9, span: [0.5, 0.8], len: 80, turn: -1 });

    // the title cartouche
    ctx.fillStyle = C.red; ctx.fillRect(930, 320, 92, 330);
    ctx.lineWidth = 3; ctx.strokeStyle = C.key; ctx.strokeRect(930, 320, 92, 330);
    ctx.fillStyle = C.foam; ctx.font = `600 58px ${'"Hiragino Mincho ProN", serif'}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    [...'浮世絵大浪'].forEach((ch, i) => ctx.fillText(ch, 976, 360 + i * 62));

    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(paper, 0, 0); ctx.restore();
  },
};
