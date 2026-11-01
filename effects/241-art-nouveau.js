// Art Nouveau panel in the manner of Mucha: a cream arch on deep olive, a gold halo, and whiplash vines that grow
// up the frame, curl into spirals and sprout leaves and dusty-rose blossoms while a tall lily rises and opens in
// the halo. Every vine is a tapered ribbon along a Catmull-Rom spline with a dark contour; it grows, holds, then
// draws back into the ground. The halo's bead ring turns one bead per loop.
import { TAU, clamp, ease, span } from '../lib/util.js';

const C = { night: '#2E382C', cream: '#F1E6CC', ink: '#2E3426', sage: '#8BA07A', leaf: '#A6B78F', rose: '#D69A8E', ochre: '#C9A35B', ivory: '#FBF4E4' };
const ARCH = { x0: 90, x1: 990, cy: 770, r: 450, y1: 1830 };
const NOUVEAU = '"Herculanum", "Papyrus", serif';

// Catmull-Rom through the key points, then (optionally) a spiral curling off the end
function vine(pts, curl = 0, r0 = 60, turns = 1.4) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < 20; k++) {
      const u = k / 20;
      out.push([0, 1].map(j => 0.5 * (2 * p1[j] + (p2[j] - p0[j]) * u + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * u * u + (3 * p1[j] - p0[j] - 3 * p2[j] + p3[j]) * u * u * u)));
    }
  }
  const [ex, ey] = pts[pts.length - 1], [px, py] = pts[pts.length - 2];
  out.push([ex, ey]);
  if (curl) { // centre to one side of the end, radius shrinking as it turns
    const d = Math.hypot(ex - px, ey - py), nx = -(ey - py) / d * curl, ny = (ex - px) / d * curl;
    const cx = ex + nx * r0, cy = ey + ny * r0, a0 = Math.atan2(ey - cy, ex - cx);
    for (let i = 1; i <= 60; i++) {
      const u = i / 60, a = a0 + curl * u * turns * TAU, r = r0 * (1 - 0.78 * u);
      out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }
  let L = 0;
  const s = out.map((p, i) => (L += i ? Math.hypot(p[0] - out[i - 1][0], p[1] - out[i - 1][1]) : 0));
  return { pts: out, s, L };
}

// the vines: path, base width, grow window (s), leaves [at 0..1, side, size], blossoms [at 0..1, size]
const VINES = [];
for (const m of [1, -1]) { // the two frame vines are mirror images
  const X = x => 540 + m * (x - 540);
  VINES.push({ path: vine([[X(150), 1640], [X(118), 1420], [X(170), 1200], [X(126), 980], [X(150), 800], [X(230), 640]], -m, 64), w: 20, a: 0.1, d: 1.9,
    leaves: [[0.12, 1, 70], [0.25, -1, 62], [0.4, 1, 66], [0.55, -1, 56], [0.68, 1, 50]], flowers: [[0.33, 34], [0.62, 30], [1, 26]] });
  VINES.push({ path: vine([[X(150), 1500], [X(250), 1430], [X(270), 1330], [X(220), 1270]], -m, 34, 1.2), w: 11, a: 0.6, d: 1.2,
    leaves: [[0.3, 1, 44]], flowers: [] });
  VINES.push({ path: vine([[X(528), 1640], [X(490), 1540], [X(400), 1470], [X(330), 1380], [X(318), 1250]]), w: 54, a: 0.6, d: 1.2,
    leaves: [], flowers: [], blade: true }); // the lily's long leaf blades
}
const STEM = vine([[540, 1620], [520, 1400], [565, 1200], [540, 980]]);

// a tapered ribbon along the first g pixels of a path, pointed at the growing tip: a stem (thick at the root)
// or a leaf blade (widest in the middle)
function ribbon(ctx, v, g, w, color, extra = 0, blade = false) {
  const P = [], Q = [];
  for (let i = 0; i < v.pts.length && v.s[i] <= g; i++) {
    const a = v.pts[Math.max(0, i - 1)], b = v.pts[Math.min(v.pts.length - 1, i + 1)];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / d, ny = (b[0] - a[0]) / d;
    const u = v.s[i] / v.L, shape = blade ? Math.sin(Math.PI * (0.06 + 0.94 * u)) ** 0.8 : 1 - 0.8 * u;
    const hw = (w * shape * Math.min(1, (g - v.s[i]) / 60 + 0.08)) / 2 + extra;
    P.push([v.pts[i][0] + nx * hw, v.pts[i][1] + ny * hw]); Q.push([v.pts[i][0] - nx * hw, v.pts[i][1] - ny * hw]);
  }
  if (P.length < 2) return;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (const p of P) ctx.lineTo(p[0], p[1]);
  for (let i = Q.length - 1; i >= 0; i--) ctx.lineTo(Q[i][0], Q[i][1]);
  ctx.closePath(); ctx.fill();
}

// point and direction at fraction u of a path
function at(v, u) {
  const target = u * v.L;
  let i = v.s.findIndex(x => x >= target);
  if (i < 1) i = 1;
  const a = v.pts[i - 1], b = v.pts[i];
  return [b[0], b[1], Math.atan2(b[1] - a[1], b[0] - a[0])];
}

function leaf(ctx, x, y, ang, len, k) {
  if (k <= 0.01) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(k, k);
  ctx.beginPath(); ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.45, -len * 0.42, len, 0); ctx.quadraticCurveTo(len * 0.45, len * 0.3, 0, 0);
  ctx.fillStyle = C.leaf; ctx.fill();
  ctx.lineWidth = 3.5; ctx.strokeStyle = C.ink; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4, 0); ctx.quadraticCurveTo(len * 0.5, -len * 0.06, len * 0.9, 0); ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
}

function blossom(ctx, x, y, size, k, rot) {
  if (k <= 0.01) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot + (1 - k) * 0.8); ctx.scale(k, k);
  ctx.lineWidth = 3; ctx.strokeStyle = C.ink;
  for (let i = 0; i < 5; i++) {
    ctx.save(); ctx.rotate(i * TAU / 5);
    ctx.beginPath(); ctx.ellipse(0, -size * 0.55, size * 0.36, size * 0.55, 0, 0, TAU);
    ctx.fillStyle = C.rose; ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath(); ctx.arc(0, 0, size * 0.26, 0, TAU); ctx.fillStyle = C.ochre; ctx.fill(); ctx.stroke();
  ctx.restore();
}

// the lily: three back and three front petals opening from a closed bud, stamens with ochre anthers
function lily(ctx, x, y, k) {
  if (k <= 0.01) return;
  ctx.save(); ctx.translate(x, y);
  ctx.lineWidth = 4; ctx.lineJoin = 'round';
  const open = ease.inOut(clamp((k - 0.2) / 0.8)), len = 90 + 140 * Math.min(1, k * 1.5);
  for (const i of [0, 2, 4, 1, 3, 5]) { // petals at -60, 0, 60 ... degrees; the back three first
    const a = (-Math.PI / 2) * (1 - open) + (-Math.PI / 3 + i * Math.PI / 3) * open, back = i % 2 === 0;
    const L = back ? len : len * 0.92, w = back ? 44 : 38;
    ctx.save(); ctx.rotate(a + Math.PI / 2);
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-w, -L * 0.3, -w * 0.7, -L * 0.78, 0, -L);
    ctx.bezierCurveTo(w * 0.7, -L * 0.78, w, -L * 0.3, 0, 0);
    ctx.fillStyle = back ? '#F1DCCB' : C.ivory; ctx.fill(); ctx.strokeStyle = C.ink; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, -L * 0.7);
    ctx.strokeStyle = C.rose; ctx.lineWidth = 6; ctx.stroke(); ctx.lineWidth = 4;
    ctx.restore();
  }
  ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5;
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.22 * open, r = 40 + 50 * open;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.6, Math.cos(a) * r, Math.sin(a) * r); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(Math.cos(a) * r, Math.sin(a) * r, 6, 11, a + Math.PI / 2, 0, TAU); ctx.fillStyle = C.ochre; ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function archPath(ctx, inset) {
  const { x0, x1, cy, r, y1 } = ARCH;
  ctx.beginPath();
  ctx.moveTo(x0 + inset, y1 - inset); ctx.lineTo(x0 + inset, cy);
  ctx.arc(540, cy, r - inset, Math.PI, TAU);
  ctx.lineTo(x1 - inset, y1 - inset); ctx.closePath();
}

export default {
  name: 'Art Nouveau',
  ko: '아르누보',
  draw(ctx, time, W, H) {
    const t = (time + 0.9) % 5; // the video starts 0.9 s into the growth, so the loop seam falls in motion
    // growth of a piece over [a, a + d]; everything draws back in reverse from 3.5 s and is gone by 4.8 s
    const grow = (a, d) => ease.inOut(span(t, a, a + d)) * (1 - ease.inOut(span(t, 3.5 + (2.4 - a - d) * 0.3, 3.5 + (2.4 - a - d) * 0.3 + d * 0.6)));

    ctx.fillStyle = C.night; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(201, 163, 91, 0.35)'; ctx.lineWidth = 2; // a fine gold rule round the outside
    ctx.strokeRect(40, 40, W - 80, H - 80);

    archPath(ctx, 0); ctx.fillStyle = C.ochre; ctx.fill();
    archPath(ctx, 14); ctx.fillStyle = C.ink; ctx.fill();
    archPath(ctx, 22); ctx.fillStyle = C.cream; ctx.fill();
    ctx.save(); archPath(ctx, 22); ctx.clip();

    // the halo: pale rose disc, gold rings and a ring of beads turning one bead per loop
    const hx = 540, hy = 830;
    ctx.fillStyle = '#E8D3A8'; // a scalloped edge
    for (let i = 0; i < 28; i++) { const a = i / 28 * TAU; ctx.beginPath(); ctx.arc(hx + 338 * Math.cos(a), hy + 338 * Math.sin(a), 30, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#EED3BF'; ctx.beginPath(); ctx.arc(hx, hy, 330, 0, TAU); ctx.fill();
    ctx.strokeStyle = C.ochre; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(hx, hy, 330, 0, TAU); ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(hx, hy, 280, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(hx, hy, 250, 0, TAU); ctx.stroke();
    const spin = time / 5 * TAU / 36;
    for (let i = 0; i < 36; i++) {
      const a = i / 36 * TAU + spin;
      ctx.fillStyle = i % 2 ? C.ochre : C.rose;
      ctx.beginPath(); ctx.arc(hx + 305 * Math.cos(a), hy + 305 * Math.sin(a), 9, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(201, 163, 91, 0.45)'; ctx.lineWidth = 2;
    for (let i = 0; i < 48; i++) { // fine rays inside the halo
      const a = i / 48 * TAU;
      ctx.beginPath(); ctx.moveTo(hx + 120 * Math.cos(a), hy + 120 * Math.sin(a)); ctx.lineTo(hx + 240 * Math.cos(a), hy + 240 * Math.sin(a)); ctx.stroke();
    }

    // the lily stem rises, then the vines and leaf blades; contours first, colour on top
    const stem = grow(0.25, 1.3);
    ribbon(ctx, STEM, stem * STEM.L, 22, C.ink, 3.5); ribbon(ctx, STEM, stem * STEM.L, 22, C.sage);
    for (const v of VINES) {
      const g = grow(v.a, v.d) * v.path.L;
      ribbon(ctx, v.path, g, v.w, C.ink, 3.5, v.blade); ribbon(ctx, v.path, g, v.w, v.blade ? C.leaf : C.sage, 0, v.blade);
      if (v.blade) { // midrib
        ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.beginPath();
        for (let i = 0; i < v.path.pts.length && v.path.s[i] <= g * 0.92; i++) ctx.lineTo(...v.path.pts[i]);
        ctx.stroke();
      }
      for (const [u, side, size] of v.leaves) {
        const [x, y, a] = at(v.path, u);
        leaf(ctx, x, y, a + side * 0.75, size, ease.outBack(clamp((g - u * v.path.L) / 120)));
      }
      for (const [u, size] of v.flowers) {
        const [x, y] = at(v.path, Math.min(u, 0.995));
        blossom(ctx, x, y, size, ease.outBack(clamp((g - u * v.path.L + 20) / 140)), u * 5);
      }
    }
    lily(ctx, 540, 960, grow(1.2, 1.2));
    ctx.restore();

    // the lettering panel
    ctx.fillStyle = C.ink; ctx.fillRect(170, 1640, 740, 150);
    ctx.fillStyle = C.cream; ctx.fillRect(180, 1650, 720, 130);
    ctx.strokeStyle = C.ochre; ctx.lineWidth = 3; ctx.strokeRect(192, 1662, 696, 106);
    ctx.fillStyle = C.ink; ctx.font = `400 84px ${NOUVEAU}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.letterSpacing = '6px';
    ctx.fillText('ART NOUVEAU', 543, 1718);
    ctx.letterSpacing = '0px';
  },
};
