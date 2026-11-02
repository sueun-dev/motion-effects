// Topology optimization (SIMP): a solid 2:1 bracket plate, bolted along its left edge and pulled down at the middle
// of its right edge, is meshed into 96 x 48 finite elements. Each iteration solves the plate (stiffness E = ρ³, a
// preconditioned conjugate-gradient solve), takes the compliance sensitivities, smooths them with a 2.8-element filter
// and moves the densities with the optimality-criteria update, while the allowed volume steps down from 100 % to 40 %.
// All 44 iterations are computed once at load; the frames play them back (densities blended between iterations,
// stress shown as colour), then the material grows back. A fragment shader draws the field as a bevelled metal plate.
import { FONT, TAU, span, ease, clamp } from '../lib/util.js';

const NX = 96, NY = 48, ITERS = 44, VOL = 0.4, RMIN = 2.8, UP = 4; // grid, iterations, final volume, filter, upsampling
const FW = NX * UP, FH = NY * UP;
const PLATE = { x: 72, y: 470, w: 936, h: 468 };                    // where the plate sits on screen (px)

// the whole optimization, run once
let RUN = null;
function solve() {
  if (RUN) return RUN;
  const nu = 0.3, Emin = 1e-9, P = 3;
  const D = [[1, nu, 0], [nu, 1, 0], [0, 0, (1 - nu) / 2]].map(r => r.map(v => v / (1 - nu * nu)));
  // strain-displacement matrix of a unit square element (nodes (0,0) (1,0) (1,1) (0,1)) at natural point (xi, eta)
  const strain = (xi, eta) => {
    const dx = [-(1 - eta), 1 - eta, 1 + eta, -(1 + eta)].map(v => v / 2), dy = [-(1 - xi), -(1 + xi), 1 + xi, 1 - xi].map(v => v / 2);
    const B = [new Float64Array(8), new Float64Array(8), new Float64Array(8)];
    for (let i = 0; i < 4; i++) { B[0][2 * i] = dx[i]; B[1][2 * i + 1] = dy[i]; B[2][2 * i] = dy[i]; B[2][2 * i + 1] = dx[i]; }
    return B;
  };
  const KE = Array.from({ length: 8 }, () => new Float64Array(8)), g = 1 / Math.sqrt(3);
  for (const xi of [-g, g]) for (const eta of [-g, g]) {          // 2 x 2 Gauss points
    const B = strain(xi, eta);
    for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) {
      let s = 0;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) s += B[i][a] * D[i][j] * B[j][b];
      KE[a][b] += s / 4;
    }
  }
  const Bc = strain(0, 0);
  const node = (i, j) => i * (NY + 1) + j, ndof = 2 * (NX + 1) * (NY + 1), ne = NX * NY;
  const edof = new Int32Array(ne * 8);
  for (let ex = 0; ex < NX; ex++) for (let ey = 0; ey < NY; ey++)
    [node(ex, ey), node(ex + 1, ey), node(ex + 1, ey + 1), node(ex, ey + 1)].forEach((n, k) => {
      edof[(ex * NY + ey) * 8 + 2 * k] = 2 * n; edof[(ex * NY + ey) * 8 + 2 * k + 1] = 2 * n + 1;
    });
  const fixed = new Uint8Array(ndof), F = new Float64Array(ndof);
  for (let j = 0; j <= NY; j++) fixed[2 * node(0, j)] = fixed[2 * node(0, j) + 1] = 1; // bolted left edge
  F[2 * node(NX, NY / 2) + 1] = -1;                                                     // the load
  // sparse stiffness (CSR): every dof couples to the dofs of its 3 x 3 neighbouring nodes
  const rowPtr = new Int32Array(ndof + 1), cols = [];
  for (let i = 0; i <= NX; i++) for (let j = 0; j <= NY; j++) for (let c = 0; c < 2; c++) {
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      const a = i + di, b = j + dj;
      if (a >= 0 && b >= 0 && a <= NX && b <= NY) cols.push(2 * node(a, b), 2 * node(a, b) + 1);
    }
    rowPtr[2 * node(i, j) + c + 1] = cols.length;
  }
  const colIdx = Int32Array.from(cols), val = new Float64Array(cols.length);
  const find = (r, c) => { let k = rowPtr[r]; while (colIdx[k] !== c) k++; return k; };
  const eidx = new Int32Array(ne * 64), diag = new Int32Array(ndof);
  for (let e = 0; e < ne; e++) for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) eidx[e * 64 + a * 8 + b] = find(edof[e * 8 + a], edof[e * 8 + b]);
  for (let r = 0; r < ndof; r++) diag[r] = find(r, r);
  // the sensitivity filter: weights rmin − distance to the elements around
  const R = Math.ceil(RMIN) - 1, Hn = [], Hw = [], Hs = new Float64Array(ne);
  for (let ex = 0; ex < NX; ex++) for (let ey = 0; ey < NY; ey++) {
    const e = ex * NY + ey, nb = [], w = [];
    for (let a = Math.max(0, ex - R); a <= Math.min(NX - 1, ex + R); a++) for (let b = Math.max(0, ey - R); b <= Math.min(NY - 1, ey + R); b++) {
      const h = RMIN - Math.hypot(a - ex, b - ey);
      if (h > 0) { nb.push(a * NY + b); w.push(h); Hs[e] += h; }
    }
    Hn.push(nb); Hw.push(w);
  }
  const x = new Float64Array(ne).fill(1), u = new Float64Array(ndof), r = new Float64Array(ndof), z = new Float64Array(ndof);
  const p = new Float64Array(ndof), q = new Float64Array(ndof), dc = new Float64Array(ne), dcf = new Float64Array(ne), xn = new Float64Array(ne);
  const matvec = (src, dst) => { for (let i = 0; i < ndof; i++) { let s = 0; for (let k = rowPtr[i]; k < rowPtr[i + 1]; k++) s += val[k] * src[colIdx[k]]; dst[i] = s; } };
  const dens = [], stress = [], comp = [], vol = [];
  for (let it = 0; it <= ITERS; it++) {
    val.fill(0);
    for (let e = 0; e < ne; e++) {
      const E = Emin + x[e] ** P * (1 - Emin);
      for (let a = 0; a < 8; a++) if (!fixed[edof[e * 8 + a]]) for (let b = 0; b < 8; b++) if (!fixed[edof[e * 8 + b]]) val[eidx[e * 64 + a * 8 + b]] += E * KE[a][b];
    }
    for (let i = 0; i < ndof; i++) if (fixed[i]) val[diag[i]] = 1;
    // K u = F by Jacobi-preconditioned conjugate gradients, starting from the last solution
    matvec(u, q);
    let rz = 0, bn = 0;
    for (let i = 0; i < ndof; i++) { r[i] = fixed[i] ? 0 : F[i] - q[i]; z[i] = r[i] / val[diag[i]]; p[i] = z[i]; rz += r[i] * z[i]; bn += F[i] * F[i]; }
    for (let k = 0; k < 5000; k++) {
      matvec(p, q);
      let pq = 0; for (let i = 0; i < ndof; i++) pq += p[i] * q[i];
      const al = rz / pq;
      let rn = 0;
      for (let i = 0; i < ndof; i++) { u[i] += al * p[i]; r[i] -= al * q[i]; rn += r[i] * r[i]; }
      if (rn < 1e-14 * bn) break;
      let rz2 = 0; for (let i = 0; i < ndof; i++) { z[i] = r[i] / val[diag[i]]; rz2 += r[i] * z[i]; }
      for (let i = 0; i < ndof; i++) p[i] = z[i] + (rz2 / rz) * p[i];
      rz = rz2;
    }
    // compliance, its sensitivities, and the von Mises stress at each element's centre
    let C = 0, V = 0;
    const vm = new Float32Array(ne);
    for (let e = 0; e < ne; e++) {
      let s = 0;
      for (let a = 0; a < 8; a++) { let t = 0; for (let b = 0; b < 8; b++) t += KE[a][b] * u[edof[e * 8 + b]]; s += u[edof[e * 8 + a]] * t; }
      const E = Emin + x[e] ** P * (1 - Emin);
      C += E * s; V += x[e];
      dc[e] = -P * x[e] ** (P - 1) * s;
      let ex = 0, ey = 0, gxy = 0;
      for (let a = 0; a < 8; a++) { const ua = u[edof[e * 8 + a]]; ex += Bc[0][a] * ua; ey += Bc[1][a] * ua; gxy += Bc[2][a] * ua; }
      const sx = E * (D[0][0] * ex + D[0][1] * ey), sy = E * (D[1][0] * ex + D[1][1] * ey), txy = E * D[2][2] * gxy;
      vm[e] = Math.sqrt(sx * sx + sy * sy - sx * sy + 3 * txy * txy);
    }
    // stress in the material (vm / ρ³ where there is material; holes take the mean of the material around them,
    // so the colour does not fade at the edges)
    const sm = new Float32Array(ne);
    for (let e = 0; e < ne; e++) if (x[e] > 0.3) sm[e] = vm[e] / x[e] ** P;
    for (let ex = 0; ex < NX; ex++) for (let ey = 0; ey < NY; ey++) {
      const e = ex * NY + ey;
      if (x[e] > 0.3) continue;
      let s = 0, n = 0;
      for (let a = Math.max(0, ex - 2); a <= Math.min(NX - 1, ex + 2); a++) for (let b = Math.max(0, ey - 2); b <= Math.min(NY - 1, ey + 2); b++)
        if (x[a * NY + b] > 0.3) { s += sm[a * NY + b]; n++; }
      sm[e] = n ? s / n : 0;
    }
    dens.push(Float32Array.from(x)); stress.push(sm); comp.push(C); vol.push(V / ne);
    if (it === ITERS) break;
    for (let e = 0; e < ne; e++) {
      let s = 0; const nb = Hn[e], w = Hw[e];
      for (let k = 0; k < nb.length; k++) s += w[k] * x[nb[k]] * dc[nb[k]];
      dcf[e] = s / (Hs[e] * Math.max(1e-3, x[e]));
    }
    // optimality criteria: bisect the Lagrange multiplier until the volume meets this iteration's target
    const target = Math.max(VOL, 1 - 0.04 * (it + 1));
    let l1 = 0, l2 = 1e9;
    while ((l2 - l1) / (l1 + l2) > 1e-4) {
      const lm = 0.5 * (l1 + l2);
      let sum = 0;
      for (let e = 0; e < ne; e++) { xn[e] = Math.max(0.001, x[e] - 0.2, Math.min(1, x[e] + 0.2, x[e] * Math.sqrt(Math.max(0, -dcf[e]) / lm))); sum += xn[e]; }
      if (sum > target * ne) l1 = lm; else l2 = lm;
    }
    x.set(xn);
  }
  // stress scale: the 92nd percentile of the final design's solid elements
  const fin = stress[ITERS].filter((_, e) => dens[ITERS][e] > 0.5).sort((a, b) => a - b);
  RUN = { dens, stress, comp, vol, smax: fin[Math.floor(fin.length * 0.92)] };
  return RUN;
}

// iteration shown at time t: hold the solid block, play 0 -> 44 (the early iterations, where most material goes,
// get the most time), hold, then run back to the solid block
function iterAt(t) {
  const p = smooth(span(t, 0.25, 3.5)) * (1 - ease.inOut(span(t, 3.8, 5.0)));
  return ITERS * p ** 1.3;
}
const smooth = k => k * k * (3 - 2 * k);
const cubic = (a, b, c, d, f) => b + 0.5 * f * (c - a + f * (2 * a - 5 * b + 4 * c - d + f * (3 * (b - c) + d - a)));

let img = null, field = null, sField = null;
export default {
  name: 'Topology Optimization',
  ko: '위상 최적화',
  // the density (red) and stress (green) fields, upsampled 4x with Catmull-Rom, in the top-left corner of the texture
  tex(ctx, t, W, H) {
    const run = solve(), it = iterAt(t), k = Math.min(ITERS - 1, Math.floor(it)), f = it - k;
    if (!img) { img = ctx.createImageData(FW, FH); field = new Float32Array(NX * NY); sField = new Float32Array(NX * NY); }
    for (let e = 0; e < NX * NY; e++) {
      field[e] = run.dens[k][e] + (run.dens[k + 1][e] - run.dens[k][e]) * f;
      sField[e] = run.stress[k][e] + (run.stress[k + 1][e] - run.stress[k][e]) * f;
    }
    const at = (a, ex, ey) => a[clamp(ex, 0, NX - 1) * NY + clamp(ey, 0, NY - 1)];
    const sample = (a, fx, fy) => {
      const ix = Math.floor(fx), iy = Math.floor(fy), gx = fx - ix, gy = fy - iy, row = [];
      for (let j = -1; j <= 2; j++) row.push(cubic(at(a, ix - 1, iy + j), at(a, ix, iy + j), at(a, ix + 1, iy + j), at(a, ix + 2, iy + j), gx));
      return cubic(row[0], row[1], row[2], row[3], gy);
    };
    for (let Y = 0; Y < FH; Y++) for (let X = 0; X < FW; X++) {
      const fx = (X + 0.5) / UP - 0.5, fy = NY - (Y + 0.5) / UP - 0.5, o = (Y * FW + X) * 4;
      img.data[o] = clamp(sample(field, fx, fy)) * 255;
      img.data[o + 1] = clamp(Math.max(0, sample(sField, fx, fy)) / run.smax / 1.1) * 255;
      img.data[o + 2] = 0; img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  },
  // as the design settles to 0/1, its edge is drawn crisp and the stress colours come in
  uniforms: t => ({ uCrisp: ease.inOut(span(iterAt(t), 16, 36)), uHeat: ease.inOut(span(iterAt(t), 22, 40)) }),
  frag: `
uniform float uCrisp, uHeat;
const vec4 PLATE = vec4(${PLATE.x}.0, ${PLATE.y}.0, ${PLATE.w}.0, ${PLATE.h}.0);
const vec2 FS = vec2(${FW}.0, ${FH}.0);
vec2 fieldUv(vec2 f) { return vec2(f.x * FS.x / uRes.x, 1.0 - (1.0 - f.y) * FS.y / uRes.y); }
float dens(vec2 f) { return f.x < 0.0 || f.y < 0.0 || f.x > 1.0 || f.y > 1.0 ? 0.0 : texture(uTex, fieldUv(clamp(f, 0.5 / FS, 1.0 - 0.5 / FS))).r; }
vec3 heat(float s) {                                                // stress: deep blue -> teal -> yellow -> red
  vec3 c = mix(vec3(0.14, 0.25, 0.75), vec3(0.1, 0.75, 0.75), smoothstep(0.0, 0.35, s));
  c = mix(c, vec3(1.0, 0.85, 0.25), smoothstep(0.35, 0.7, s));
  return mix(c, vec3(1.0, 0.3, 0.2), smoothstep(0.7, 1.0, s));
}
void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  // blueprint backdrop with a fixed grid
  vec3 col = mix(vec3(0.035, 0.06, 0.11), vec3(0.06, 0.1, 0.17), smoothstep(1900.0, 300.0, px.y));
  vec2 gq = abs(fract(px / 40.0 - 0.5) - 0.5) * 40.0;
  col += vec3(0.05, 0.09, 0.14) * (1.0 - smoothstep(0.6, 1.6, min(gq.x, gq.y)));
  vec2 f = (px - PLATE.xy) / PLATE.zw; f.y = 1.0 - f.y;              // plate coordinates, y up
  vec2 e = 1.0 / PLATE.zw * 2.0;
  float d = dens(f);
  // soft drop shadow down-right
  float sh = smoothstep(0.1, 0.85, dens(f - vec2(14.0, -18.0) / PLATE.zw));
  col *= 1.0 - 0.45 * sh;
  // grey (intermediate) densities show as thinner, see-through material; 0/1 designs come out crisp
  float w = fwidth(d) * 0.8;
  float m = mix(smoothstep(0.1, 0.85, d), smoothstep(0.5 - w, 0.5 + w, d), uCrisp);
  if (m > 0.0) {
    float hx = smoothstep(0.1, 0.85, dens(f + vec2(e.x, 0.0))) - smoothstep(0.1, 0.85, dens(f - vec2(e.x, 0.0)));
    float hy = smoothstep(0.1, 0.85, dens(f + vec2(0.0, e.y))) - smoothstep(0.1, 0.85, dens(f - vec2(0.0, e.y)));
    vec3 n = normalize(vec3(-hx * 1.2, -hy * 1.2, 1.0));            // bevelled edges from the density slope
    vec3 l = normalize(vec3(-0.5, 0.6, 0.65));
    float s = texture(uTex, fieldUv(clamp(f, 0.5 / FS, 1.0 - 0.5 / FS))).g;
    float brush = 0.94 + 0.06 * vnoise(vec2(px.x * 0.02, px.y * 1.3)); // brushed metal, fixed to the plate
    vec3 metal = vec3(0.7, 0.72, 0.76) * brush;
    vec3 base = mix(metal, heat(s) * 0.95, 0.62 * uHeat);
    float dif = max(dot(n, l), 0.0), spec = pow(max(dot(reflect(-l, n), vec3(0, 0, 1)), 0.0), 24.0);
    vec3 lit = base * (0.35 + 0.75 * dif) + vec3(0.9, 0.95, 1.0) * spec * 0.35;
    // the finite-element grid, faint, on the material
    vec2 cell = abs(fract(f * vec2(${NX}.0, ${NY}.0) - 0.5) - 0.5) / fwidth(f * vec2(${NX}.0, ${NY}.0));
    lit *= 1.0 - 0.1 * (1.0 - smoothstep(0.4, 1.2, min(cell.x, cell.y)));
    col = mix(col, lit, m);
  }
  outColor = vec4(pow(col, vec3(0.92)), 1.0);
}`,
  // supports, the load, the read-outs and the convergence chart
  overlay(ctx, t, W, H) {
    const run = solve(), it = iterAt(t), k = Math.min(ITERS - 1, Math.floor(it)), f = it - k;
    const { x, y, w, h } = PLATE;
    // the bolted left edge: a hatched wall
    ctx.fillStyle = 'rgba(160, 190, 230, 0.16)'; ctx.fillRect(x - 40, y - 24, 30, h + 48);
    ctx.save(); ctx.beginPath(); ctx.rect(x - 40, y - 24, 30, h + 48); ctx.clip();
    ctx.strokeStyle = 'rgba(190, 215, 245, 0.7)'; ctx.lineWidth = 3;
    for (let k2 = -2; k2 < 30; k2++) { ctx.beginPath(); ctx.moveTo(x - 40, y - 24 + k2 * 20); ctx.lineTo(x - 10, y - 54 + k2 * 20); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = '#CFE2FF'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - 10, y - 24); ctx.lineTo(x - 10, y + h + 24); ctx.stroke();
    // the load: an arrow down at the middle of the right edge
    const ax = x + w + 2, ay = y + h / 2;
    ctx.strokeStyle = '#FF6A5C'; ctx.fillStyle = '#FF6A5C'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(ax, ay - 150); ctx.lineTo(ax, ay - 26); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax - 18, ay - 34); ctx.lineTo(ax + 18, ay - 34); ctx.closePath(); ctx.fill();
    ctx.font = `700 40px ${FONT.sans}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText('F', ax - 20, ay - 150);
    ctx.textAlign = 'left'; ctx.font = `600 26px ${FONT.sans}`; ctx.fillStyle = 'rgba(207, 226, 255, 0.75)';
    ctx.fillText('fixed', x - 40, y - 52);
    // read-outs
    const C = run.comp[k] + (run.comp[k + 1] - run.comp[k]) * f, V = run.vol[k] + (run.vol[k + 1] - run.vol[k]) * f;
    const rows = [['iteration', `${Math.round(it)} / ${ITERS}`], ['volume', `${Math.round(V * 100)} %`], ['compliance', C.toFixed(1)]];
    rows.forEach(([a, b], i) => {
      const cx = 200 + i * 340;
      ctx.textAlign = 'center'; ctx.font = `500 26px ${FONT.sans}`; ctx.fillStyle = 'rgba(207, 226, 255, 0.65)';
      ctx.fillText(a, cx, 1040);
      ctx.font = `600 44px ${FONT.mono}`; ctx.fillStyle = '#EAF2FF';
      ctx.fillText(b, cx, 1092);
    });
    // stress legend
    const lx = 300, ly = 1170, lw = 480;
    const grd = ctx.createLinearGradient(lx, 0, lx + lw, 0);
    [['#2440BF', 0], ['#1ABFBF', 0.35], ['#FFD940', 0.7], ['#FF4D33', 1]].forEach(([c, s]) => grd.addColorStop(s, c));
    ctx.fillStyle = grd; ctx.beginPath(); ctx.roundRect(lx, ly - 9, lw, 18, 9); ctx.fill();
    ctx.font = `500 24px ${FONT.sans}`; ctx.fillStyle = 'rgba(207, 226, 255, 0.7)';
    ctx.textAlign = 'right'; ctx.fillText('low', lx - 16, ly); ctx.textAlign = 'left'; ctx.fillText('high stress', lx + lw + 16, ly);
    // convergence chart: compliance (white) and volume (blue) against iteration
    const gx = 130, gy = 1290, gw = 820, gh = 380;
    ctx.strokeStyle = 'rgba(207, 226, 255, 0.25)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy + gh); ctx.lineTo(gx + gw, gy + gh); ctx.stroke();
    const cMax = Math.max(...run.comp) * 1.08;
    const px = i => gx + gw * i / ITERS;
    const line = (vals, top, color) => {
      ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.lineJoin = 'round';
      ctx.beginPath();
      vals.forEach((v, i) => { const py = gy + gh - gh * v / top; i ? ctx.lineTo(px(i), py) : ctx.moveTo(px(i), py); });
      ctx.stroke();
    };
    ctx.globalAlpha = 0.35; line(run.comp, cMax, '#EAF2FF'); line(run.vol, 1.08, '#5AA8FF'); ctx.globalAlpha = 1;
    ctx.save(); ctx.beginPath(); ctx.rect(gx, gy - 20, gw * it / ITERS + 3, gh + 40); ctx.clip();
    line(run.comp, cMax, '#EAF2FF'); line(run.vol, 1.08, '#5AA8FF');
    ctx.restore();
    const cy = gy + gh - gh * C / cMax, vy = gy + gh - gh * V / 1.08;
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(px(it), cy, 10, 0, TAU); ctx.fill();
    ctx.fillStyle = '#5AA8FF'; ctx.beginPath(); ctx.arc(px(it), vy, 10, 0, TAU); ctx.fill();
    ctx.font = `600 26px ${FONT.sans}`; ctx.textAlign = 'right';
    ctx.fillStyle = '#EAF2FF'; ctx.fillText('compliance', gx + gw, gy + 6);
    ctx.fillStyle = '#5AA8FF'; ctx.fillText('volume', gx + gw, gy + 42);
    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(207, 226, 255, 0.6)'; ctx.font = `500 24px ${FONT.sans}`;
    ctx.fillText('iteration', gx + gw / 2, gy + gh + 36);
    ctx.fillText('SIMP · E = ρ³ · filter r = 2.8 · 96 × 48 elements', W / 2, 1800);
  },
};
