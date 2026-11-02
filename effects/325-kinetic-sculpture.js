// Kinetic sculpture: a beach walker on Jansen's linkage. Each leg is eleven bars with Theo Jansen's "holy numbers"
// (a 38, l 7.8 for the frame, m 15 for the crank, b 41.5 ... k 61.9); every joint is found by intersecting two
// circles, so turning the crank alone makes the foot trace a flat-bottomed path. Two crank modules carry eight legs
// (near side bright, far side behind in the haze); the crank turns twice in 5 s, the walker strides along the wet
// sand at the speed its feet push, and a blueprint below draws one leg with its bar letters, numbers and foot path.
import { TAU, FONT, canvas, rng } from '../lib/util.js';

const L = { a: 38, b: 41.5, c: 39.3, d: 40.1, e: 55.8, f: 39.4, g: 36.7, h: 65.7, i: 49, j: 50, k: 61.9, l: 7.8, m: 15 };
const S = 2.15;                    // px per linkage unit in the main view
const GY = 1040;                   // ground line (px)
const SEA = GY - 340, SHORE = GY - 200; // horizon and waterline (px)
const FOOT = -91.83;               // the foot's lowest height below the crank axle (units)
const CARD = { x: 56, y: 1262, w: 968, h: 540 }, BS = 3.55; // the blueprint card and its scale
const C = { tube: '#F2E7BE', edge: '#5E5136', joint: '#3A342B', crank: '#E0703A', far: '#B9B6A6', farEdge: '#8C8A80' };
let SPEED = 0, PATH = [], sky = null, sand = null, PERIOD = 0;

// the point at distance r1 from p and r2 from q; `pick` chooses which of the two
function meet(p, r1, q, r2, pick) {
  const dx = q[0] - p[0], dy = q[1] - p[1], d = Math.hypot(dx, dy);
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const mx = p[0] + dx * a / d, my = p[1] + dy * a / d;
  const s1 = [mx - dy * h / d, my + dx * h / d], s2 = [mx + dy * h / d, my - dx * h / d];
  return pick(s1, s2) ? s1 : s2;
}
const up = (p, q) => p[1] > q[1], down = (p, q) => p[1] < q[1], left = (p, q) => p[0] < q[0];

// one leg at crank angle th, in linkage units (y up, crank axle O at the origin, leg reaching to the left)
function leg(th) {
  const O = [0, 0], X = [-L.a, -L.l], A = [L.m * Math.cos(th), L.m * Math.sin(th)];
  const B = meet(A, L.j, X, L.b, up), Cc = meet(A, L.k, X, L.c, down);
  const D = meet(B, L.e, X, L.d, left), E = meet(D, L.f, Cc, L.g, left), F = meet(E, L.h, Cc, L.i, down);
  return { O, X, A, B, C: Cc, D, E, F };
}
// the same leg mirrored to reach right, on the same crank pin
function legR(th) {
  const g = leg(Math.PI - th), out = {};
  for (const k in g) out[k] = [-g[k][0], g[k][1]];
  return out;
}
// the bars of a leg: [from, to, letter]
const BARS = [['O', 'A', 'm'], ['A', 'B', 'j'], ['X', 'B', 'b'], ['A', 'C', 'k'], ['X', 'C', 'c'], ['B', 'D', 'e'], ['X', 'D', 'd'],
  ['D', 'E', 'f'], ['C', 'E', 'g'], ['E', 'F', 'h'], ['C', 'F', 'i']];

function tube(ctx, p, q, w, fill, edge) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = edge; ctx.lineWidth = w + 3.5;
  ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
  ctx.strokeStyle = fill; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
}

// one leg on screen: rigid triangles filled pale, then the tubes, then the joints
function drawLeg(ctx, g, map, far) {
  const P = {};
  for (const k in g) P[k] = map(g[k]);
  ctx.fillStyle = far ? 'rgba(160, 158, 146, 0.35)' : 'rgba(242, 231, 190, 0.32)';
  for (const tri of [['X', 'B', 'D'], ['C', 'E', 'F']]) {
    ctx.beginPath(); tri.forEach(k => ctx.lineTo(P[k][0], P[k][1])); ctx.closePath(); ctx.fill();
  }
  for (const [a, b, n] of BARS) {
    if (n === 'm') continue;
    tube(ctx, P[a], P[b], far ? 5 : 6.5, far ? C.far : C.tube, far ? C.farEdge : C.edge);
  }
  ctx.fillStyle = far ? C.farEdge : C.joint;
  for (const k of ['A', 'B', 'C', 'D', 'E', 'X']) { ctx.beginPath(); ctx.arc(P[k][0], P[k][1], far ? 4 : 5.5, 0, TAU); ctx.fill(); }
  ctx.fillStyle = far ? '#6F6D66' : '#2B2620'; // a rubber foot
  ctx.beginPath(); ctx.ellipse(P.F[0], P.F[1] - 2, far ? 8 : 10, far ? 5 : 6, 0, 0, TAU); ctx.fill();
  return P;
}

// the whole walker at crank angle th: crank axles at x0 +- 112 units, feet on the line gy, sc px per unit
function walker(ctx, th, x0, gy, sc) {
  const map = (dx, dy) => p => [x0 + (p[0] + dx) * sc, gy - (p[1] - FOOT + dy) * sc];
  const pt = map(0, 0), mods = [[-112, 0], [112, Math.PI]], top = 52;
  // far side: the same modules a quarter turn later, shifted up and right
  for (const [ox, ph] of mods) {
    const m = map(ox + 6, 9);
    drawLeg(ctx, leg(th + ph + Math.PI / 2), m, true);
    drawLeg(ctx, legR(th + ph + Math.PI / 2), m, true);
  }
  // the frame: a backbone over both modules, braced down to each crank axle and its two fixed pivots
  for (const [ox] of mods) {
    tube(ctx, pt([ox, top]), pt([ox, 0]), 7, C.tube, C.edge);
    tube(ctx, pt([ox - L.a, -L.l]), pt([ox, 0]), 7, C.tube, C.edge);
    tube(ctx, pt([ox + L.a, -L.l]), pt([ox, 0]), 7, C.tube, C.edge);
    tube(ctx, pt([ox - L.a, -L.l]), pt([ox - 30, top]), 6, C.tube, C.edge);
    tube(ctx, pt([ox + L.a, -L.l]), pt([ox + 30, top]), 6, C.tube, C.edge);
  }
  tube(ctx, pt([-172, top]), pt([172, top]), 9, C.tube, C.edge);
  // a sail on a mast: a triangle of cloth whose belly breathes with the crank
  const belly = 4 * Math.sin(th * 2), mast = pt([-40, top + 105]), foot0 = pt([-165, top + 6]), foot1 = pt([150, top + 6]);
  const c1 = pt([20, top + 30 + belly]), c2 = pt([0, top + 70 + belly]);
  ctx.beginPath(); ctx.moveTo(foot0[0], foot0[1]); ctx.quadraticCurveTo(c1[0], c1[1], foot1[0], foot1[1]);
  ctx.quadraticCurveTo(c2[0], c2[1], mast[0], mast[1]); ctx.closePath();
  ctx.fillStyle = 'rgba(250, 246, 234, 0.92)'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = C.edge; ctx.stroke();
  tube(ctx, pt([-40, top]), mast, 6, C.tube, C.edge);
  // near side, with the orange cranks
  for (const [ox, ph] of mods) {
    const m = map(ox, 0);
    drawLeg(ctx, leg(th + ph), m, false);
    const P = drawLeg(ctx, legR(th + ph), m, false);
    ctx.fillStyle = C.crank; ctx.strokeStyle = C.edge; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(P.O[0], P.O[1], 12, 0, TAU); ctx.fill(); ctx.stroke();
    tube(ctx, P.O, P.A, 9, C.crank, '#7A3A1C');
    ctx.fillStyle = C.joint; ctx.beginPath(); ctx.arc(P.A[0], P.A[1], 5.5, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(P.O[0], P.O[1], 4, 0, TAU); ctx.fill();
  }
}

export default {
  name: 'Kinetic Sculpture',
  ko: '키네틱 조각',
  setup(_, W, H) {
    // how far the feet push per radian of crank, on the flat part of the foot path
    const N = 720;
    PATH = Array.from({ length: N }, (_, i) => leg(i / N * TAU).F);
    let s = 0, n = 0;
    for (let i = 0; i < N; i++) {
      const p = PATH[i], q = PATH[(i + 1) % N];
      if (p[1] < FOOT + 1) { s += Math.abs(q[0] - p[0]); n++; }
    }
    SPEED = s / n / (TAU / N);           // units per radian
    PERIOD = SPEED * TAU * 2 * S / 2;    // the sand pattern repeats twice over the 5-second walk

    sky = canvas(W, GY + 4);             // sky, sea and the far dunes: fixed
    const g = sky.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, SEA);
    grd.addColorStop(0, '#93BCD6'); grd.addColorStop(0.65, '#D8E6EA'); grd.addColorStop(1, '#F3EBDB');
    g.fillStyle = grd; g.fillRect(0, 0, W, SEA);
    g.fillStyle = 'rgba(255, 255, 255, 0.6)';
    for (const [x, y, w] of [[230, 400, 260], [820, 320, 330], [640, 520, 200]]) {
      g.beginPath(); g.ellipse(x, y, w, w * 0.12, 0, 0, TAU); g.ellipse(x - w * 0.3, y - w * 0.07, w * 0.45, w * 0.1, 0, 0, TAU); g.fill();
    }
    const sea = g.createLinearGradient(0, SEA, 0, SHORE);
    sea.addColorStop(0, '#6F95A8'); sea.addColorStop(1, '#A7C1C6');
    g.fillStyle = sea; g.fillRect(0, SEA, W, SHORE - SEA);
    const wet = g.createLinearGradient(0, SHORE, 0, GY + 4);
    wet.addColorStop(0, '#C9C3B0'); wet.addColorStop(1, '#BBA98A');
    g.fillStyle = wet; g.fillRect(0, SHORE, W, GY + 4 - SHORE);

    sand = canvas(Math.ceil(W + PERIOD) + 4, H - GY); // the foreground sand, one period wider than the frame
    const q = sand.getContext('2d'), r = rng(325), sw = sand.width, sh = sand.height;
    const fg = q.createLinearGradient(0, 0, 0, sh);
    fg.addColorStop(0, '#B9A584'); fg.addColorStop(0.35, '#CDB894'); fg.addColorStop(1, '#E2CFA9');
    q.fillStyle = fg; q.fillRect(0, 0, sw, sh);
    for (let i = 0; i < 70; i++) { // ripples and wet streaks, repeated so the strip tiles every PERIOD px
      const x = r() * PERIOD, y = 20 + r() * (sh - 20), w = 30 + r() * 90, a = 0.05 + r() * 0.08, light = r() < 0.5;
      for (let k = -1; k * PERIOD < sw; k++) {
        q.fillStyle = light ? `rgba(255, 250, 235, ${a})` : `rgba(110, 90, 60, ${a})`;
        q.beginPath(); q.ellipse(x + k * PERIOD, y, w * (0.5 + y / sh), 2 + y / sh * 4, 0, 0, TAU); q.fill();
      }
    }
  },
  draw(ctx, t, W, H) {
    const th = -TAU * 2 * t / 5;                // two crank turns per loop; turning this way the feet push backwards
    const walked = -th * SPEED * S;             // px walked so far
    ctx.drawImage(sky, 0, 0);
    // surf lines on the sea, sliding past slowly (they move a whole number of their own repeats per loop)
    ctx.strokeStyle = 'rgba(248, 246, 238, 0.75)'; ctx.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      const y = SEA + 30 + k * 30, per = 160 + 40 * k, off = (t / 5 * per) % per; // one repeat per loop: 32-56 px/s, nearer lines faster
      ctx.lineWidth = 2 + k;
      for (let x = -per - off; x < W + per; x += per) {
        ctx.beginPath(); ctx.moveTo(x + 40, y); ctx.quadraticCurveTo(x + per * 0.35, y - 5, x + per * 0.6, y); ctx.stroke();
      }
    }
    ctx.lineCap = 'butt';
    // the foreground sand slides at walking speed
    const off = walked % PERIOD;
    ctx.drawImage(sand, -off, GY);
    // reflection in the wet sand, then the walker's shadows, then the walker
    const x0 = W / 2;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, GY, W, CARD.y - GY); ctx.clip();
    ctx.globalAlpha = 0.18;
    ctx.translate(0, 2 * GY); ctx.scale(1, -1);
    walker(ctx, th, x0, GY, S);
    ctx.restore();
    const fade = ctx.createLinearGradient(0, GY, 0, CARD.y);
    fade.addColorStop(0, 'rgba(205, 184, 148, 0)'); fade.addColorStop(1, 'rgba(205, 184, 148, 0.85)');
    ctx.fillStyle = fade; ctx.fillRect(0, GY, W, CARD.y - GY);
    const shade = ctx.createRadialGradient(x0, GY + 6, 0, x0, GY + 6, 480);
    shade.addColorStop(0, 'rgba(70, 55, 35, 0.22)'); shade.addColorStop(1, 'rgba(70, 55, 35, 0)');
    ctx.save(); ctx.translate(0, GY + 6); ctx.scale(1, 0.05); ctx.translate(0, -(GY + 6));
    ctx.fillStyle = shade; ctx.fillRect(x0 - 480, GY + 6 - 480, 960, 960); ctx.restore();
    walker(ctx, th, x0, GY, S);

    // the blueprint: one near leg (the left one of the first module), its bars lettered, its foot path in orange
    const { x, y, w, h } = CARD;
    ctx.save();
    ctx.shadowColor = 'rgba(40, 30, 20, 0.35)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
    ctx.fillStyle = '#16304F'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 26); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 26); ctx.clip();
    ctx.strokeStyle = 'rgba(150, 190, 230, 0.12)'; ctx.lineWidth = 1;
    for (let gx = x + 14; gx < x + w; gx += 28) { ctx.beginPath(); ctx.moveTo(gx + 0.5, y); ctx.lineTo(gx + 0.5, y + h); ctx.stroke(); }
    for (let gy = y + 14; gy < y + h; gy += 28) { ctx.beginPath(); ctx.moveTo(x, gy + 0.5); ctx.lineTo(x + w, gy + 0.5); ctx.stroke(); }
    ctx.restore();
    const ox = x + 470, oy = y + 165;                         // the crank axle on the card
    const bmap = p => [ox + p[0] * BS, oy - p[1] * BS];
    const g = leg(th);
    ctx.strokeStyle = 'rgba(255, 150, 90, 0.9)'; ctx.lineWidth = 3; // the foot path
    ctx.beginPath(); PATH.forEach(p => { const q = bmap(p); ctx.lineTo(q[0], q[1]); }); ctx.closePath(); ctx.stroke();
    ctx.strokeStyle = 'rgba(150, 200, 255, 0.35)'; ctx.setLineDash([10, 8]); // the ground
    ctx.beginPath(); ctx.moveTo(x + 30, oy - FOOT * BS + 9); ctx.lineTo(x + w - 30, oy - FOOT * BS + 9); ctx.stroke(); ctx.setLineDash([]);
    const P = {};
    for (const k in g) P[k] = bmap(g[k]);
    ctx.fillStyle = 'rgba(160, 200, 255, 0.12)';
    for (const tri of [['X', 'B', 'D'], ['C', 'E', 'F']]) { ctx.beginPath(); tri.forEach(k => ctx.lineTo(P[k][0], P[k][1])); ctx.closePath(); ctx.fill(); }
    ctx.lineCap = 'round';
    for (const [a, b, n] of BARS) {
      ctx.strokeStyle = n === 'm' ? '#FF9A5A' : '#EAF2FF'; ctx.lineWidth = n === 'm' ? 7 : 4;
      ctx.beginPath(); ctx.moveTo(P[a][0], P[a][1]); ctx.lineTo(P[b][0], P[b][1]); ctx.stroke();
    }
    ctx.strokeStyle = '#EAF2FF'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); // the fixed frame: a and l
    ctx.beginPath(); ctx.moveTo(P.O[0], P.O[1]); ctx.lineTo(P.X[0], P.O[1]); ctx.lineTo(P.X[0], P.X[1]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#16304F'; ctx.strokeStyle = '#EAF2FF'; ctx.lineWidth = 3;
    for (const k of ['O', 'A', 'B', 'C', 'D', 'E', 'X']) { ctx.beginPath(); ctx.arc(P[k][0], P[k][1], k === 'O' || k === 'X' ? 8 : 6, 0, TAU); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = '#FF9A5A'; ctx.beginPath(); ctx.arc(P.F[0], P.F[1], 9, 0, TAU); ctx.fill();
    // bar letters, each in a small disc a set fraction along its bar
    const at = { m: 0.62, j: 0.5, b: 0.5, k: 0.42, c: 0.7, e: 0.5, d: 0.5, f: 0.4, g: 0.6, h: 0.55, i: 0.6 }; // checked: no two overlap over the loop
    ctx.font = `700 24px ${FONT.mono}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const [a, b, n] of BARS) {
      const u = at[n], px = P[a][0] + (P[b][0] - P[a][0]) * u, py = P[a][1] + (P[b][1] - P[a][1]) * u;
      ctx.fillStyle = n === 'm' ? '#FF9A5A' : '#2E6FB8'; ctx.beginPath(); ctx.arc(px, py, 15, 0, TAU); ctx.fill();
      ctx.fillStyle = '#FFFFFF'; ctx.fillText(n, px, py + 1);
    }
    ctx.fillStyle = '#EAF2FF'; ctx.fillText('a', P.X[0] + 0.3 * (P.O[0] - P.X[0]), P.O[1] + 20); ctx.fillText('l', P.X[0] + 16, (P.O[1] + P.X[1]) / 2 + 2);
    // the holy numbers, in a column on the right
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = `700 30px ${FONT.sans}`; ctx.fillStyle = '#FFFFFF';
    ctx.fillText('Jansen linkage', x + 650, y + 62);
    ctx.font = `500 24px ${FONT.ko}`; ctx.fillStyle = 'rgba(234, 242, 255, 0.75)';
    ctx.fillText('얀센 링크 · holy numbers', x + 650, y + 96);
    ctx.font = `500 25px ${FONT.mono}`;
    'abcdefghijklm'.split('').forEach((n, i) => {
      const cx = x + 650 + (i % 2) * 160, cy = y + 150 + Math.floor(i / 2) * 46;
      ctx.fillStyle = n === 'm' ? '#FF9A5A' : '#9CC7FF'; ctx.fillText(n, cx, cy);
      ctx.fillStyle = '#FFFFFF'; ctx.fillText(L[n].toFixed(1), cx + 30, cy);
    });
    ctx.font = `500 22px ${FONT.sans}`; ctx.fillStyle = 'rgba(255, 170, 120, 0.95)';
    ctx.fillText('— foot path · 발 궤적', x + 650, y + h - 40);
  },
};
