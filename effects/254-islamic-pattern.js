// Islamic star pattern by Hankin's "polygons in contact" method. The plane is tiled by regular octagons and
// squares (4.8.8). From the midpoint of every edge two rays leave at 72° to the edge, each leaning toward one
// end of it, and run until they meet the ray from the next edge leaning toward the same corner: eight V's
// make an eight-pointed star in each octagon, four make a smaller star in each square, and the rays carry
// straight on across every edge into the next polygon. The lines become interlaced strapwork: at every
// crossing (inside the polygons and at the edge midpoints) one strap passes over the other, and
// over and under alternate along every strand (found by walking the strands). The regions between the bands
// are found once by a flood fill and glazed by kind: octagon stars, square stars and the pieces between.
// The loop starts from the construction (compass circles and the polygon grid): the rays grow out of the
// midpoints, thicken into bands, the tiles fill in a wave from the centre, a sheen crosses the glaze, and the
// tiles and bands fade out in the same wave while the circles and grid are drawn in again.
import { TAU, clamp, smoothstep, ease, canvas } from '../lib/util.js';

const CX = 540, CY = 1100, D = 300, A = D / (1 + Math.SQRT2), THETA = 72 * Math.PI / 180, BAND = 16, START = 2.4;
const PAPER = [239, 227, 200], M = 300;
const GLAZE = { star: [26, 66, 132], small: [228, 172, 62], across: [30, 132, 126], along: [190, 82, 56] };   // lapis, saffron, turquoise, terracotta
const polys = [], vees = [], overs = [];
let label, regionColor, regionStart, img, layer;

function build() {
  for (let j = -5; j <= 5; j++) for (let i = -3; i <= 3; i++) {      // octagons on a lattice, squares between
    const ox = CX + i * D, oy = CY + j * D, R = A / (2 * Math.sin(Math.PI / 8)), sx = ox + D / 2, sy = oy + D / 2, r = A / Math.SQRT2;
    polys.push({ c: [ox, oy], R, v: Array.from({ length: 8 }, (_, k) => [ox + R * Math.cos(TAU * (k + 0.5) / 8), oy + R * Math.sin(TAU * (k + 0.5) / 8)]) });
    polys.push({ c: [sx, sy], R: r, v: Array.from({ length: 4 }, (_, k) => [sx + r * Math.cos(TAU * k / 4), sy + r * Math.sin(TAU * k / 4)]) });
  }
  const segs = [], atMid = new Map(), key = p => `${Math.round(p[0] * 2)},${Math.round(p[1] * 2)}`;
  for (const poly of polys) {
    const n = poly.v.length, mid = k => { const p = poly.v[k % n], q = poly.v[(k + 1) % n]; return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; };
    poly.segs = [];
    for (let k = 0; k < n; k++) {
      const m1 = mid(k), m2 = mid(k + 1), corner = poly.v[(k + 1) % n];
      const ray = m => {                              // unit vector at THETA from the edge, leaning to the corner, inward
        const u = [corner[0] - m[0], corner[1] - m[1]], l = Math.hypot(...u), w = [poly.c[0] - m[0], poly.c[1] - m[1]];
        const sg = Math.sign(u[0] * w[1] - u[1] * w[0]), c = Math.cos(THETA), sn = Math.sin(THETA) * sg;
        return [(u[0] * c - u[1] * sn) / l, (u[1] * c + u[0] * sn) / l];
      };
      const d1 = ray(m1), d2 = ray(m2), den = d1[0] * d2[1] - d1[1] * d2[0];
      const tt = ((m2[0] - m1[0]) * d2[1] - (m2[1] - m1[1]) * d2[0]) / den, P = [m1[0] + d1[0] * tt, m1[1] + d1[1] * tt];
      vees.push({ m1, P, m2, dist: Math.hypot(P[0] - CX, P[1] - CY) });
      const s1 = { a: m1, b: P, d: d1, poly, events: [] }, s2 = { a: m2, b: P, d: d2, poly, events: [], partner: s1 };
      s1.partner = s2;
      segs.push(s1, s2); poly.segs.push(s1, s2);
      for (const sg of [s1, s2]) { if (!atMid.has(key(sg.a))) atMid.set(key(sg.a), []); atMid.get(key(sg.a)).push(sg); }
    }
  }
  // straight on across each midpoint: the segment on the other side pointing the opposite way; the two
  // straight lines through a midpoint cross there
  for (const list of atMid.values()) {
    for (const sg of list) sg.cont = list.find(o => o.poly !== sg.poly && o.d[0] * sg.d[0] + o.d[1] * sg.d[1] < -0.999) || null;
    if (list.length === 4) {
      const c = { at: list[0].a };
      for (const sg of list) sg.events.push({ c, u: 0 });
    }
  }
  for (const poly of polys) for (let i = 0; i < poly.segs.length; i++) for (let j = i + 1; j < poly.segs.length; j++) {
    const p = poly.segs[i], q = poly.segs[j];          // crossings inside a polygon
    const r = [p.b[0] - p.a[0], p.b[1] - p.a[1]], t2 = [q.b[0] - q.a[0], q.b[1] - q.a[1]], den = r[0] * t2[1] - r[1] * t2[0];
    if (Math.abs(den) < 1e-9) continue;
    const u = ((q.a[0] - p.a[0]) * t2[1] - (q.a[1] - p.a[1]) * t2[0]) / den, v = ((q.a[0] - p.a[0]) * r[1] - (q.a[1] - p.a[1]) * r[0]) / den;
    if (u < 1e-4 || u > 1 - 1e-4 || v < 1e-4 || v > 1 - 1e-4) continue;
    const c = { at: [p.a[0] + r[0] * u, p.a[1] + r[1] * u] };
    p.events.push({ c, u }); q.events.push({ c, u: v });
  }
  // walk each strand (M -> P -> M' -> across -> ...) and alternate over and under along it, keeping any
  // crossing another strand has already decided
  const done = new Set();
  for (const first of segs) {
    if (done.has(first)) continue;
    let s = first;
    for (let n = 0; n < 500; n++) { const back = s.cont ? s.cont.partner : null; if (!back || back === first || done.has(back)) break; s = back; }
    const events = [];
    for (let n = 0; s && !done.has(s) && n < 500; n++) {
      done.add(s); done.add(s.partner);
      for (const e of [...s.events].sort((x, y) => x.u - y.u)) events.push({ c: e.c, d: s.d });
      for (const e of [...s.partner.events].sort((x, y) => y.u - x.u)) if (e.u > 0) events.push({ c: e.c, d: s.partner.d });
      s = s.partner.cont;
    }
    const S = events, isOver = c => (c.top ? c.top === S : c.bottom ? c.bottom !== S : null);
    const known = events.findIndex(e => isOver(e.c) !== null);
    const parity = known < 0 ? 0 : isOver(events[known].c) ? known % 2 : 1 - (known % 2);
    events.forEach((e, k) => {
      if (isOver(e.c) === null) { if ((k % 2) === parity) e.c.top = S; else e.c.bottom = S; }
      (e.c.dirs ||= []).push(e.d);
      if (isOver(e.c) && !e.c.dir) { e.c.dir = e.d; overs.push(e.c); }
    });
  }
}

// flood-fill the regions between the lines once (on a canvas 300 px bigger all round, so no shape is cut by
// the frame), and glaze each by where its centre sits: octagon star, square star, or the pieces between
function regionsOf(W, H) {
  const EW = W + 2 * M, EH = H + 2 * M, c = canvas(EW, EH), g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, EW, EH);
  g.strokeStyle = '#000'; g.lineWidth = 6; g.lineJoin = 'miter';
  g.translate(M, M); g.beginPath();
  for (const v of vees) { g.moveTo(...v.m1); g.lineTo(...v.P); g.lineTo(...v.m2); }
  g.stroke();
  const px = g.getImageData(0, 0, EW, EH).data, lab = new Int32Array(EW * EH).fill(-1);
  const stack = new Int32Array(EW * EH), cx = [], cy = [];
  for (let i = 0; i < EW * EH; i++) {
    if (lab[i] !== -1 || px[i * 4] < 128) continue;
    const id = cx.length;
    let top = 0, n = 0, sx = 0, sy = 0;
    stack[top++] = i; lab[i] = id;
    while (top) {
      const p = stack[--top], x = p % EW, y = (p - x) / EW;
      n++; sx += x; sy += y;
      if (x > 0 && lab[p - 1] === -1 && px[(p - 1) * 4] >= 128) { lab[p - 1] = id; stack[top++] = p - 1; }
      if (x < EW - 1 && lab[p + 1] === -1 && px[(p + 1) * 4] >= 128) { lab[p + 1] = id; stack[top++] = p + 1; }
      if (y > 0 && lab[p - EW] === -1 && px[(p - EW) * 4] >= 128) { lab[p - EW] = id; stack[top++] = p - EW; }
      if (y < EH - 1 && lab[p + EW] === -1 && px[(p + EW) * 4] >= 128) { lab[p + EW] = id; stack[top++] = p + EW; }
    }
    cx.push(sx / n - M); cy.push(sy / n - M);
  }
  label = new Int32Array(W * H);                     // the visible window
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) label[y * W + x] = lab[(y + M) * EW + x + M];
  const off = (x, y, ox, oy) => [((x - ox) % D + D * 1.5) % D - D / 2, ((y - oy) % D + D * 1.5) % D - D / 2];
  regionColor = cx.map((x, k) => {
    const [u, v] = off(x, cy[k], CX, CY), [us, vs] = off(x, cy[k], CX + D / 2, CY + D / 2);
    if (Math.hypot(u, v) < 30) return GLAZE.star;
    if (Math.hypot(us, vs) < 30) return GLAZE.small;
    return Math.abs(v) > Math.abs(u) ? GLAZE.along : GLAZE.across;   // pieces beside the vertical / horizontal gaps
  });
  regionStart = cx.map((x, k) => 1.8 + 1.1 * clamp(Math.hypot(x - CX, cy[k] - CY) / 1250));
}

export default {
  name: 'Islamic Geometric Pattern',
  ko: '이슬람 기하 문양',
  setup(ctx, W, H) { build(); regionsOf(W, H); img = ctx.createImageData(W, H); layer = canvas(W, H); },
  draw(ctx, time, W, H) {
    const t = (time + START) % 5;                      // the video starts mid-construction, so the seam is in motion
    const late = r => 0.5 * clamp(r / 1250);           // everything spreads out from the centre

    // paper and glazed tiles, per pixel: each region fades in at its own time, and out again near the end
    const d = img.data, alpha = regionStart.map(s => smoothstep(s, s + 0.5, t) * (1 - smoothstep(3.7 + (s - 1.8) * 0.5, 4.3 + (s - 1.8) * 0.5, t)));
    for (let i = 0, n = W * H; i < n; i++) {
      const r = label[i], a = r >= 0 ? alpha[r] : 0, c = r >= 0 ? regionColor[r] : PAPER;
      d[i * 4] = PAPER[0] + (c[0] - PAPER[0]) * a; d[i * 4 + 1] = PAPER[1] + (c[1] - PAPER[1]) * a; d[i * 4 + 2] = PAPER[2] + (c[2] - PAPER[2]) * a; d[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const shine = smoothstep(2.7, 3.0, t) * (1 - smoothstep(3.9, 4.2, t));   // once glazed, a sheen sweeps across
    if (shine > 0) {
      const x = -900 + 2900 * smoothstep(2.7, 4.2, t), g = ctx.createLinearGradient(x - 350, x * 0.6 - 210, x + 350, x * 0.6 + 210);
      g.addColorStop(0, 'rgba(255, 250, 235, 0)'); g.addColorStop(0.5, `rgba(255, 250, 235, ${0.22 * shine})`); g.addColorStop(1, 'rgba(255, 250, 235, 0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }

    // construction: compass circles and the polygon grid. They are drawn in (sweeping) while the finished
    // pattern fades at the end of the loop, stay through the start, and fade once the bands arrive
    const guide = t < 2 ? clamp(1 - (t - 1.3) / 0.6) : smoothstep(3.9, 4.3, t);
    if (guide > 0) {
      ctx.lineWidth = 2; ctx.strokeStyle = `rgba(150, 105, 55, ${0.7 * guide})`;
      for (const poly of polys) {
        const r = Math.hypot(poly.c[0] - CX, poly.c[1] - CY), p = t < 2 ? 1 : ease.inOut(clamp((t - 4.0 - late(r)) / 0.5));
        if (p <= 0) continue;
        ctx.beginPath(); ctx.arc(poly.c[0], poly.c[1], poly.R, -Math.PI / 2, -Math.PI / 2 + TAU * p); ctx.stroke();
        const n = poly.v.length;
        ctx.beginPath();
        for (let k = 0; k < n; k++) {
          const a = poly.v[k], b = poly.v[(k + 1) % n];
          ctx.moveTo(...a); ctx.lineTo(a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p);
        }
        ctx.stroke();
      }
    }

    // the rays grow out of the midpoints toward their meeting points, then thicken into bands (drawn on their
    // own layer, so at the end the whole strapwork can fade out in a wave from the centre)
    const width = 2.5 + (BAND - 2.5) * smoothstep(1.0, 2.5, t), face = smoothstep(3, 9, width);
    const g = layer.getContext('2d');
    g.clearRect(0, 0, W, H);
    const path = new Path2D();
    for (const v of vees) {
      const p = ease.out(clamp((t - 0.15 - late(v.dist)) / 0.6));
      if (p <= 0) continue;
      const a = [v.m1[0] + (v.P[0] - v.m1[0]) * p, v.m1[1] + (v.P[1] - v.m1[1]) * p];
      const b = [v.m2[0] + (v.P[0] - v.m2[0]) * p, v.m2[1] + (v.P[1] - v.m2[1]) * p];
      path.moveTo(...v.m1); path.lineTo(...a);
      if (p >= 1) path.lineTo(...v.m2); else { path.moveTo(...v.m2); path.lineTo(...b); }
    }
    g.lineJoin = 'miter'; g.miterLimit = 8; g.lineCap = 'butt';
    const band = (p, w) => {                          // a strap: dark edges, ivory face that opens as it widens
      g.strokeStyle = '#2B2118'; g.lineWidth = w + Math.min(7, w * 0.45); g.stroke(p);
      if (face > 0) { g.globalAlpha = face; g.strokeStyle = '#F7EDD6'; g.lineWidth = w - 1; g.stroke(p); g.globalAlpha = 1; }
    };
    band(path, width);
    if (face > 0) {                                   // interlace: redraw a piece of the over strap at each crossing
      const pieces = new Path2D();
      for (const o of overs) {                        // long enough to cover the under strap's edges
        const [d0, d1] = o.dirs, sin = Math.abs(d0[0] * d1[1] - d0[1] * d1[0]), L = (width / 2 + 4) / sin + 2;
        pieces.moveTo(o.at[0] - o.dir[0] * L, o.at[1] - o.dir[1] * L);
        pieces.lineTo(o.at[0] + o.dir[0] * L, o.at[1] + o.dir[1] * L);
      }
      band(pieces, width);
    }
    if (t > 4.1) {                                    // fade out in a ring that runs from the centre to the corners
      const R = 1300, mask = g.createRadialGradient(CX, CY, 0, CX, CY, R);
      for (let k = 0; k <= 20; k++) {
        const r = k / 20 * R, s0 = 4.1 + 0.7 * late(r);
        mask.addColorStop(k / 20, `rgba(0, 0, 0, ${1 - smoothstep(s0, s0 + 0.5, t)})`);
      }
      g.globalCompositeOperation = 'destination-in'; g.fillStyle = mask; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'source-over';
    }
    ctx.drawImage(layer, 0, 0);
  },
};
