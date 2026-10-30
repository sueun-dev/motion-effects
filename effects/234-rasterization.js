// Rasterization: a cube and an octahedron that cut into each other, over a floor, are projected onto a 36 x 34 pixel
// grid and filled triangle by triangle, scanline by scanline, the way a GPU rasterizer does: a pixel is covered when
// its centre lies inside the triangle (edge functions), its depth is interpolated and tested against the depth
// buffer, and pixels that fail flash red. The floor and back wall are drawn last, so they fill in only around
// the objects.
import { TAU, FONT, clamp, smoothstep } from '../lib/util.js';

const COLS = 36, ROWS = 34, CELL = 30, GX = 0, GY = 330;          // colour buffer on screen
const DC = 11, DX = 40, DY = 1440;                                // depth buffer view
const T0 = 0.2, T1 = 3.7, FADE0 = 4.1;                           // fill window, then a fade-out until 5 s

// --- the scene, projected once ---------------------------------------------------------------------------------
const rot = (p, rx, ry) => {
  let [x, y, z] = p;
  [y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
  [x, z] = [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)];
  return [x, y, z];
};
const mesh = (verts, faces, c, pos, rx, ry, scale) => faces.map(f => ({ v: f.map(i => rot(verts[i].map(q => q * scale), rx, ry).map((q, k) => q + pos[k])), c }));
const cube = mesh([[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
  [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [3, 7, 6], [3, 6, 2], [0, 4, 7], [0, 7, 3], [1, 2, 6], [1, 6, 5]],
  [255, 122, 89], [-0.85, -0.05, -5.2], 0.55, 0.7, 0.82);
const octa = mesh([[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],
  [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]],
  [46, 196, 182], [0.5, 0.15, -5.0], 0.3, 0.5, 1.4);
const floor = [[[-6, -1.25, -1.9], [6, -1.25, -1.9], [6, -1.25, -10]], [[-6, -1.25, -1.9], [6, -1.25, -10], [-6, -1.25, -10]]].map(v => ({ v, c: [91, 108, 255] }));
const wall = [[[-8, -1.25, -10], [8, -1.25, -10], [8, 7, -10]], [[-8, -1.25, -10], [8, 7, -10], [-8, 7, -10]]].map(v => ({ v, c: [120, 92, 200] }));
const F = 31, L = [-0.45, 0.75, 0.5].map(q => q / Math.hypot(-0.45, 0.75, 0.5));
const tris = [];
for (const t of [...cube, ...octa, ...floor, ...wall]) {
  const s = t.v.map(([x, y, z]) => [COLS / 2 + F * x / -z, 13.5 - F * y / -z, -z]);
  const area = (s[2][0] - s[0][0]) * (s[1][1] - s[0][1]) - (s[2][1] - s[0][1]) * (s[1][0] - s[0][0]);
  if (area <= 0) continue;                                         // back face (clockwise on screen): culled
  [s[1], s[2]] = [s[2], s[1]];                                     // keep the edge functions positive inside
  const [a, b, c] = t.v, u = b.map((q, k) => q - a[k]), w = c.map((q, k) => q - a[k]);
  const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], nl = Math.hypot(...n);
  const lit = 0.32 + 0.68 * Math.max(0, (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / nl);
  tris.push({ s, area, col: t.c.map(q => Math.round(q * lit)) });
}

// --- every pixel write in order, with its depth-test result (depends only on the writes before it) -------------
const events = [], rowsOf = [];
const depth = new Float32Array(COLS * ROWS).fill(Infinity);
tris.forEach((tr, ti) => {
  const [p0, p1, p2] = tr.s, edge = (a, b, x, y) => (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
  const y0 = Math.max(0, Math.floor(Math.min(p0[1], p1[1], p2[1]))), y1 = Math.min(ROWS - 1, Math.ceil(Math.max(p0[1], p1[1], p2[1])));
  for (let j = y0; j <= y1; j++) {
    const row = [];
    for (let i = 0; i < COLS; i++) {
      const x = i + 0.5, y = j + 0.5;
      const w0 = edge(p1, p2, x, y), w1 = edge(p2, p0, x, y), w2 = edge(p0, p1, x, y);
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = (w0 * p0[2] + w1 * p1[2] + w2 * p2[2]) / tr.area;
      const k = j * COLS + i, pass = z < depth[k];
      if (pass) depth[k] = z;
      row.push({ k, z, pass, ti, col: tr.col });
    }
    if (row.length) rowsOf.push({ ti, j, row });
  }
});
rowsOf.forEach((r, n) => r.row.forEach((e, m) => {
  e.t = T0 + (T1 - T0) * (n + m / r.row.length) / rowsOf.length;   // constant scanline speed
  e.r = n; events.push(e);
}));

export default {
  name: 'Rasterization',
  ko: '래스터화',
  draw(ctx, t, W, H) {
    ctx.fillStyle = '#0B0E18'; ctx.fillRect(0, 0, W, H);
    const fade = 1 - clamp((t - FADE0) / (5 - FADE0));
    const color = new Array(COLS * ROWS).fill(null), dbuf = new Float32Array(COLS * ROWS).fill(Infinity), born = new Float32Array(COLS * ROWS);
    let written = 0, failed = 0, current = -1, curRow = null;
    const flashes = [];
    for (const e of events) {
      if (e.t > t) { if (current < 0) { current = e.ti; curRow = rowsOf[e.r]; } break; }
      if (e.pass) { color[e.k] = e.col; dbuf[e.k] = e.z; born[e.k] = e.t; written++; } else { failed++; flashes.push(e); }
    }

    // colour buffer: empty cells with their sample point, then written pixels popping in
    for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
      const x = GX + i * CELL, y = GY + j * CELL, c = color[j * COLS + i];
      ctx.fillStyle = '#141A2A'; ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
      ctx.fillStyle = 'rgba(160, 175, 220, 0.28)'; ctx.fillRect(x + CELL / 2 - 1.5, y + CELL / 2 - 1.5, 3, 3);
      if (c && fade > 0) {
        const k = clamp((t - born[j * COLS + i]) / 0.12), lift = 1 + 0.5 * (1 - k);
        ctx.globalAlpha = fade;
        ctx.fillStyle = `rgb(${c.map(q => Math.min(255, Math.round(q * lift))).join(',')})`;
        ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
        ctx.globalAlpha = 1;
      }
    }
    for (const e of flashes) {                                      // failed depth tests: a red frame that fades
      const k = clamp((t - e.t) / 0.35);
      if (k >= 1) continue;
      ctx.strokeStyle = `rgba(255, 70, 90, ${(1 - k) * 0.95})`; ctx.lineWidth = 3;
      ctx.strokeRect(GX + (e.k % COLS) * CELL + 2.5, GY + Math.floor(e.k / COLS) * CELL + 2.5, CELL - 5, CELL - 5);
    }

    // the triangles as vectors (clipped to the grid); the one being filled in bright yellow, with its current scanline
    ctx.save();
    ctx.beginPath(); ctx.rect(GX, GY, COLS * CELL, ROWS * CELL); ctx.clip();
    ctx.lineJoin = 'round';
    tris.forEach((tr, ti) => {
      const on = ti === current && t < T1;
      ctx.strokeStyle = on ? '#FFD84D' : 'rgba(220, 228, 255, 0.38)'; ctx.lineWidth = on ? 3.5 : 1.6;
      ctx.beginPath();
      tr.s.forEach(([x, y], k) => (k ? ctx.lineTo : ctx.moveTo).call(ctx, GX + x * CELL, GY + y * CELL));
      ctx.closePath(); ctx.stroke();
      if (on) tr.s.forEach(([x, y]) => { ctx.fillStyle = '#FFD84D'; ctx.beginPath(); ctx.arc(GX + x * CELL, GY + y * CELL, 6, 0, TAU); ctx.fill(); });
    });
    if (curRow && t >= T0 && t < T1) {
      const y = GY + (curRow.j + 0.5) * CELL, xs = curRow.row.map(e => GX + (e.k % COLS + 0.5) * CELL);
      const glow = ctx.createLinearGradient(0, y - CELL / 2, 0, y + CELL / 2);
      glow.addColorStop(0, 'rgba(255, 216, 77, 0)'); glow.addColorStop(0.5, 'rgba(255, 216, 77, 0.35)'); glow.addColorStop(1, 'rgba(255, 216, 77, 0)');
      ctx.fillStyle = glow; ctx.fillRect(GX, y - CELL / 2, COLS * CELL, CELL);
      ctx.strokeStyle = '#FFD84D'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(Math.min(...xs) - CELL / 2, y); ctx.lineTo(Math.max(...xs) + CELL / 2, y); ctx.stroke();
    }
    ctx.restore();

    // depth buffer (near = light) and the counters
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; ctx.font = `600 26px ${FONT.sans}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('COLOR BUFFER  36 × 34', GX + 24, GY - 14);
    ctx.fillText('DEPTH BUFFER', DX, DY - 16);
    for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
      const z = dbuf[j * COLS + i];
      const g = z === Infinity ? 20 : Math.round(20 + fade * (20 + 200 * clamp((9.5 - z) / 5.5)));
      ctx.fillStyle = `rgb(${g}, ${g}, ${Math.min(255, g + 12)})`;
      ctx.fillRect(DX + i * DC, DY + j * DC, DC - 1, DC - 1);
    }
    const tri = current < 0 ? tris.length : current + 1;
    const lines = [['TRIANGLE', `${Math.min(tri, tris.length)} / ${tris.length}`], ['SCANLINE', curRow && t < T1 && t >= T0 ? `y = ${curRow.j}` : '—'],
      ['PIXELS WRITTEN', String(written)], ['DEPTH TEST FAILED', String(failed)]];
    lines.forEach(([k, v], n) => {
      const y = DY + 40 + n * 92;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'; ctx.font = `600 24px ${FONT.sans}`; ctx.fillText(k, 500, y);
      ctx.globalAlpha = Math.min(smoothstep(0, T0, t), fade);      // the counters fade out with the pixels
      ctx.fillStyle = n === 3 ? '#FF6B7D' : '#FFFFFF'; ctx.font = `700 40px ${FONT.mono}`; ctx.fillText(v, 500, y + 46);
      ctx.globalAlpha = 1;
    });
  },
};
