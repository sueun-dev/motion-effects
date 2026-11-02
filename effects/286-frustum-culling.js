// Frustum and occlusion culling: a top-down city of 120 objects (buildings and trees) around a plaza with four tall
// towers. The camera stands in the plaza and turns once per loop. Each frame every object's bounding circle is tested
// against the frustum (two side planes and the far plane): outside, it is culled and stays grey. Inside, it is tested
// against the shadow each tower casts away from the camera (the region between the rays through its silhouette
// corners): fully inside, it is occluded (hatched). Only what is left costs a draw call; the counter and the
// camera's own view below show it. Tests use a 0.8-unit soft margin, so objects change state with a short fade.
import { TAU, FONT, phase, rng, smoothstep } from '../lib/util.js';

const MX = 120, MY = 296, MS = 840, SC = MS / 100;         // the map: 100 x 100 units
const NEAR = 1, FAR = 54, HALF = 37 * Math.PI / 180;       // frustum
const VX = 40, VY = 1170, VW = 1000, VH = 560, FOC = (VW / 2) / Math.tan(HALF), EYE = 12;    // the camera view (eye 12 up)
const s = x => smoothstep(-0.8, 0.8, x);
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];

// the city: 4 towers next to the plaza, 4 buildings per other block, trees along the streets
const OBJ = (() => {
  const r = rng(286), out = [];
  const cols = ['#FF8A65', '#FFC857', '#4FC3F7', '#9575CD', '#F06292', '#81C784'];
  for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
    const x0 = 3 + 20 * i, y0 = 3 + 20 * j;
    if (i === 2 && j === 2) continue;                       // the plaza
    if (Math.abs(i - 2) + Math.abs(j - 2) === 1) {          // the four towers next to the plaza: occluders
      out.push({ x: x0 + 7, y: y0 + 7, w: 9, d: 9, h: 40, col: '#7FA8FF', tower: true });
      continue;
    }
    for (const [ox, oy] of [[0, 0], [8, 0], [0, 8], [8, 8]]) {
      const w = 5 + r() * 1.2, d = 5 + r() * 1.2;
      out.push({ x: x0 + ox + 3, y: y0 + oy + 3, w, d, h: 5 + r() * 12, col: cols[Math.floor(r() * cols.length)] });
    }
  }
  for (let k = 1; k <= 4; k++) for (const m of [10, 30, 70, 90]) {   // street trees
    out.push({ x: 20 * k + 1.5, y: m, w: 2.4, d: 2.4, h: 4, col: '#5CCB6A', tree: true });
    if (m !== 30 && m !== 70) out.push({ x: m, y: 20 * k + 1.5, w: 2.4, d: 2.4, h: 4, col: '#5CCB6A', tree: true });
  }
  out.forEach(o => { o.r = Math.hypot(o.w, o.d) / 2; });
  return out;
})();
const TOWERS = OBJ.filter(o => o.tower);

const camAt = t => {
  const a = phase(t) * TAU;
  return { x: 50 + 2.5 * Math.sin(a), y: 50 - 2.5 * Math.cos(a), yaw: a - Math.PI / 2 + 0.3 };
};
const corners = o => [[o.x - o.w / 2, o.y - o.d / 2], [o.x + o.w / 2, o.y - o.d / 2], [o.x + o.w / 2, o.y + o.d / 2], [o.x - o.w / 2, o.y + o.d / 2]];

// the frame's culling results: inF (in the frustum) and occ (hidden behind a tower), both 0..1
function cull(cam) {
  const f = [Math.cos(cam.yaw), Math.sin(cam.yaw)];
  const eL = [Math.cos(cam.yaw - HALF), Math.sin(cam.yaw - HALF)], eR = [Math.cos(cam.yaw + HALF), Math.sin(cam.yaw + HALF)];
  const shadows = TOWERS.map(q => {                         // silhouette rays: the extreme corners as seen from the camera
    const c0 = Math.atan2(q.y - cam.y, q.x - cam.x);
    const cs = corners(q).map(([x, y]) => ({ x, y, a: Math.atan2(Math.sin(Math.atan2(y - cam.y, x - cam.x) - c0), Math.cos(Math.atan2(y - cam.y, x - cam.x) - c0)) }));
    const lo = cs.reduce((m, c) => (c.a < m.a ? c : m)), hi = cs.reduce((m, c) => (c.a > m.a ? c : m));
    const dir = c => { const l = Math.hypot(c.x - cam.x, c.y - cam.y); return [(c.x - cam.x) / l, (c.y - cam.y) / l]; };
    return { q, lo, hi, sLo: dir(lo), sHi: dir(hi), near: Math.min(...cs.map(c => Math.hypot(c.x - cam.x, c.y - cam.y))) };
  });
  const res = OBJ.map(o => {
    const p = [o.x - cam.x, o.y - cam.y], z = p[0] * f[0] + p[1] * f[1];
    const inF = s(cross(eL, p) + o.r) * s(cross(p, eR) + o.r) * s(FAR + o.r - z) * s(z + o.r - NEAR);
    let occ = 0;
    if (!o.tower) for (const sh of shadows) {
      if (Math.hypot(...p) - o.r < sh.near) continue;
      occ = Math.max(occ, s(cross(sh.sLo, p) - o.r) * s(cross(p, sh.sHi) - o.r));
    }
    return { o, inF, occ, z };
  });
  return { res, shadows, f, eL, eR };
}

// the camera's own view (into its own canvas, origin at the view's corner): only the drawn objects, far to near
function drawView(ctx, cam) {
  const { res, f } = cull(cam);
  const hz = VH * 0.42, cxv = VW / 2;
  const sky = ctx.createLinearGradient(0, 0, 0, hz); sky.addColorStop(0, '#1B2350'); sky.addColorStop(1, '#5A4E8C');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, VW, hz);
  const gr = ctx.createLinearGradient(0, hz, 0, VH); gr.addColorStop(0, '#262B45'); gr.addColorStop(1, '#141828');
  ctx.fillStyle = gr; ctx.fillRect(0, hz, VW, VH - hz);
  const r = [-f[1], f[0]];                                 // camera right on the map
  const proj = (x, y, h) => {
    const p = [x - cam.x, y - cam.y], z = Math.max(0.5, p[0] * f[0] + p[1] * f[1]), l = p[0] * r[0] + p[1] * r[1];
    return [cxv + l * FOC / z, hz - (h - EYE) * FOC / z];
  };
  const shade = (hex, k) => `rgb(${[1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * k)).join(',')})`;
  const list = res.filter(e => e.inF * (1 - e.occ) > 0.01).sort((a, b) => b.z - a.z);
  for (const { o, inF, occ } of list) {
    ctx.globalAlpha = inF * (1 - occ);
    if (o.tree) {
      const [bx, by] = proj(o.x, o.y, 0), [, ty] = proj(o.x, o.y, o.h), [, my] = proj(o.x, o.y, o.h * 0.45), rr = (by - ty) * 0.42;
      ctx.fillStyle = '#6B4A2E'; ctx.fillRect(bx - rr * 0.12, my, rr * 0.24, by - my);
      ctx.fillStyle = o.col; ctx.beginPath(); ctx.arc(bx, ty + rr, rr, 0, TAU); ctx.fill();
    } else {
      const c = corners(o);
      const faces = [[0, 1], [1, 2], [2, 3], [3, 0]].map(([a, b]) => {
        const mx = (c[a][0] + c[b][0]) / 2 - o.x, my = (c[a][1] + c[b][1]) / 2 - o.y;   // outward normal ~ (mx, my)
        return { a, b, facing: mx * (cam.x - o.x - mx) + my * (cam.y - o.y - my) > 0, n: [mx, my] };
      });
      for (const fc of faces) {
        if (!fc.facing) continue;
        const lit = 0.55 + 0.3 * Math.max(0, (fc.n[0] * 0.6 - fc.n[1] * 0.8) / Math.hypot(...fc.n));
        const q = [proj(...c[fc.a], 0), proj(...c[fc.b], 0), proj(...c[fc.b], o.h), proj(...c[fc.a], o.h)];
        ctx.fillStyle = shade(o.col, lit);
        ctx.beginPath(); q.forEach((v, k) => (k ? ctx.lineTo(...v) : ctx.moveTo(...v))); ctx.closePath(); ctx.fill();
        ctx.fillStyle = shade(o.col, lit * 0.82);                // a darker band at every floor
        for (let hh = 2.6; hh < o.h - 1; hh += 3.4) {
          const b = [proj(...c[fc.a], hh), proj(...c[fc.b], hh), proj(...c[fc.b], hh + 0.9), proj(...c[fc.a], hh + 0.9)];
          ctx.beginPath(); b.forEach((v, k) => (k ? ctx.lineTo(...v) : ctx.moveTo(...v))); ctx.closePath(); ctx.fill();
        }
      }
      if (o.h < EYE) {                                      // roofs below the eye are seen from above
        const q = c.map(v => proj(...v, o.h));
        ctx.fillStyle = shade(o.col, 1.0);
        ctx.beginPath(); q.forEach((v, k) => (k ? ctx.lineTo(...v) : ctx.moveTo(...v))); ctx.closePath(); ctx.fill();
      }
    }
  }
  // x-ray: the occluded objects' outlines, seen through the tower that hides them (never drawn by the GPU)
  for (const { o, inF, occ } of res) {
    if (inF * occ < 0.01 || o.tree) continue;
    ctx.globalAlpha = inF * occ; ctx.fillStyle = 'rgba(255, 92, 170, 0.32)';
    const c = corners(o);
    for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0]]) {   // the faces that would face the camera
      const mx = (c[a][0] + c[b][0]) / 2, my = (c[a][1] + c[b][1]) / 2;
      if ((mx - o.x) * (cam.x - mx) + (my - o.y) * (cam.y - my) <= 0) continue;
      const q = [proj(...c[a], 0), proj(...c[b], 0), proj(...c[b], o.h), proj(...c[a], o.h)];
      ctx.beginPath(); q.forEach((v, k) => (k ? ctx.lineTo(...v) : ctx.moveTo(...v))); ctx.closePath(); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

let hatch = null;
export default {
  name: 'Frustum & Occlusion Culling',
  ko: '절두체·가림 컬링',
  draw(ctx, t, W, H) {
    ctx.fillStyle = '#0B0E1C'; ctx.fillRect(0, 0, W, H);
    if (!hatch) {                                           // a fixed diagonal hatch, aligned to the screen
      const c = document.createElement('canvas'); c.width = c.height = 14;
      const g = c.getContext('2d'); g.strokeStyle = 'rgba(255, 92, 170, 0.75)'; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(-2, 16); g.lineTo(16, -2); g.moveTo(-2, 2); g.lineTo(2, -2); g.moveTo(12, 16); g.lineTo(16, 12); g.stroke();
      hatch = ctx.createPattern(c, 'repeat');
    }
    const cam = camAt(t), { res, shadows, f, eL, eR } = cull(cam);
    const M = (x, y) => [MX + x * SC, MY + y * SC];

    // the map: blocks and streets
    ctx.save();
    ctx.beginPath(); ctx.roundRect(MX, MY, MS, MS, 22); ctx.clip();
    ctx.fillStyle = '#151A2E'; ctx.fillRect(MX, MY, MS, MS);
    ctx.fillStyle = '#1C2238';
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) { const [x, y] = M(2 + 20 * i, 2 + 20 * j); ctx.beginPath(); ctx.roundRect(x, y, 16 * SC, 16 * SC, 10); ctx.fill(); }
    // the frustum
    const P = (v, d) => M(cam.x + v[0] * d, cam.y + v[1] * d);
    const fl = FAR / Math.cos(HALF);
    ctx.beginPath(); ctx.moveTo(...P(eL, NEAR)); ctx.lineTo(...P(eL, fl)); ctx.lineTo(...P(eR, fl)); ctx.lineTo(...P(eR, NEAR)); ctx.closePath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)'; ctx.fill();
    // each tower's occlusion shadow, inside the frustum only
    ctx.save(); ctx.clip();
    for (const sh of shadows) {
      ctx.beginPath(); ctx.moveTo(...M(sh.lo.x, sh.lo.y)); ctx.lineTo(...M(sh.lo.x + sh.sLo[0] * 90, sh.lo.y + sh.sLo[1] * 90));
      ctx.lineTo(...M(sh.hi.x + sh.sHi[0] * 90, sh.hi.y + sh.sHi[1] * 90)); ctx.lineTo(...M(sh.hi.x, sh.hi.y)); ctx.closePath();
      ctx.fillStyle = 'rgba(255, 92, 170, 0.10)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255, 92, 170, 0.6)'; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(...P(eL, fl)); ctx.lineTo(...P(eL, NEAR)); ctx.lineTo(...P(eR, NEAR)); ctx.lineTo(...P(eR, fl)); ctx.stroke();
    ctx.setLineDash([12, 9]); ctx.beginPath(); ctx.moveTo(...P(eL, fl)); ctx.lineTo(...P(eR, fl)); ctx.stroke(); ctx.setLineDash([]);
    // the objects: grey when culled, coloured when drawn, hatched when occluded
    for (const { o, inF, occ } of res) {
      const [x, y] = M(o.x - o.w / 2, o.y - o.d / 2), w = o.w * SC, d = o.d * SC, drawn = inF * (1 - occ);
      ctx.beginPath();
      if (o.tree) ctx.arc(x + w / 2, y + d / 2, w / 2, 0, TAU); else ctx.roundRect(x, y, w, d, o.tower ? 8 : 4);
      ctx.fillStyle = '#323850'; ctx.fill();
      ctx.globalAlpha = drawn; ctx.fillStyle = o.col; ctx.fill(); ctx.globalAlpha = 1;
      if (inF * occ > 0.01) {
        ctx.globalAlpha = inF * occ; ctx.fillStyle = hatch; ctx.fill();
        ctx.strokeStyle = '#FF5CAA'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.globalAlpha = 1;
      }
      if (o.tower) { ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'; ctx.lineWidth = 3; ctx.stroke(); }
    }
    // the camera
    const [cx, cy] = M(cam.x, cam.y);
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(cx, cy, 13, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0B0E1C'; ctx.beginPath(); ctx.moveTo(cx + f[0] * 10, cy + f[1] * 10); ctx.lineTo(cx - f[1] * 6 - f[0] * 5, cy + f[0] * 6 - f[1] * 5); ctx.lineTo(cx + f[1] * 6 - f[0] * 5, cy - f[0] * 6 - f[1] * 5); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(MX, MY, MS, MS, 22); ctx.stroke();

    // the camera's own view
    ctx.save();
    ctx.beginPath(); ctx.roundRect(VX, VY, VW, VH, 22); ctx.clip();
    ctx.translate(VX, VY); drawView(ctx, cam);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(VX, VY, VW, VH, 22); ctx.stroke();
    ctx.fillStyle = 'rgba(10, 12, 24, 0.7)'; ctx.beginPath(); ctx.roundRect(VX + 16, VY + 16, 250, 42, 12); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.font = `700 22px ${FONT.sans}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText("THE CAMERA'S VIEW", VX + 32, VY + 38);

    // counters
    const drawn = res.filter(e => e.inF * (1 - e.occ) >= 0.5).length;
    const culled = res.filter(e => e.inF < 0.5).length, hidden = res.length - drawn - culled;
    const stat = (x, label, value, color) => {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; ctx.font = `600 23px ${FONT.sans}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(label, x, 1790);
      ctx.fillStyle = color; ctx.font = `700 50px ${FONT.mono}`; ctx.fillText(value, x, 1850);
    };
    stat(70, 'DRAW CALLS', `${String(drawn).padStart(3, ' ')}/${res.length}`, '#FFFFFF');
    stat(470, 'FRUSTUM-CULLED', String(culled).padStart(3, ' '), '#8A93B8');
    stat(800, 'OCCLUDED', String(hidden).padStart(3, ' '), '#FF5CAA');
  },
};
