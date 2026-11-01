// Physarum (Jeff Jones' slime-mould model): 150,000 agents on a 360 x 640 trail map that wraps at the edges.
// Each step every agent smells the trail at three sensors 9 cells ahead (straight, 45 degrees left and
// right), turns 45 degrees toward the strongest, moves one cell and drops 5 units of trail; then the map is
// blurred 3 x 3 and loses 10 %. Run once in the first frame with a fixed seed from agents scattered evenly:
// the map is kept every 3 steps from step 45 to 180, while a fine mesh coarsens into a few thick veins.
// The video plays that forward and back (a cosine ping-pong), paced by how much the map changes; the shader upsamples it with a
// cubic B-spline, adds a soft halo and colours it on a log scale; every 25th agent is drawn on top as a
// short streak along its last three steps.
import { TAU, rng, clamp } from '../lib/util.js';

const GW = 360, GH = 640, CELLS = GW * GH, AGENTS = 150000;
const SA = TAU / 8, RA = TAU / 8, SO = 9, DEPOSIT = 5, DECAY = 0.9;
const FIRST = 45, LAST = 180, EVERY = 3, START = 1.25;
const SHOWN = 25;                                    // every 25th agent is drawn on top (6,000 of them)
const maps = [], clock = [];                         // trail maps 0..255 (log scale), replay clock 0..1
let img, track;                                      // track: x, y of the drawn agents at every step

function simulate() {
  const r = rng(250);
  const ax = new Float32Array(AGENTS), ay = new Float32Array(AGENTS), ah = new Float32Array(AGENTS);
  for (let i = 0; i < AGENTS; i++) { ax[i] = r() * GW; ay[i] = r() * GH; ah[i] = r() * TAU; }
  let T = new Float32Array(CELLS), T2 = new Float32Array(CELLS);
  const K = AGENTS / SHOWN;
  track = new Float32Array((LAST - FIRST + 1) * K * 2);
  const at = (x, y) => T[(((Math.floor(y) % GH) + GH) % GH) * GW + (((Math.floor(x) % GW) + GW) % GW)];
  for (let s = 0; s <= LAST; s++) {
    for (let i = 0; i < AGENTS; i++) {
      const x = ax[i], y = ay[i];
      let h = ah[i];
      const f = at(x + Math.cos(h) * SO, y + Math.sin(h) * SO);
      const fl = at(x + Math.cos(h - SA) * SO, y + Math.sin(h - SA) * SO);
      const fr = at(x + Math.cos(h + SA) * SO, y + Math.sin(h + SA) * SO);
      if (f > fl && f > fr) { /* keep going */ }
      else if (f < fl && f < fr) h += r() < 0.5 ? -RA : RA;
      else if (fl < fr) h += RA;
      else if (fr < fl) h -= RA;
      ax[i] = (x + Math.cos(h) + GW) % GW; ay[i] = (y + Math.sin(h) + GH) % GH; ah[i] = h;
      T[Math.floor(ay[i]) * GW + Math.floor(ax[i])] += DEPOSIT;
      if (s >= FIRST && i % SHOWN === 0) { const o = ((s - FIRST) * K + i / SHOWN) * 2; track[o] = ax[i]; track[o + 1] = ay[i]; }
    }
    for (let y = 0; y < GH; y++) {                    // 3 x 3 blur and decay, wrapping at the edges
      const up = ((y + GH - 1) % GH) * GW, mid = y * GW, dn = ((y + 1) % GH) * GW;
      for (let x = 0; x < GW; x++) {
        const l = (x + GW - 1) % GW, rr = (x + 1) % GW;
        T2[mid + x] = (T[up + l] + T[up + x] + T[up + rr] + T[mid + l] + T[mid + x] + T[mid + rr] + T[dn + l] + T[dn + x] + T[dn + rr]) / 9 * DECAY;
      }
    }
    [T, T2] = [T2, T];
    if (s >= FIRST && (s - FIRST) % EVERY === 0) {
      const sample = [];                               // brightest veins (99.5th percentile) set the scale
      for (let i = 0; i < CELLS; i += 37) sample.push(T[i]);
      sample.sort((a, b) => a - b);
      maps.push({ T: T.slice(), top: sample[Math.floor(sample.length * 0.995)] });
    }
  }
  const tops = maps.map(m => m.top);                   // smooth the scale from map to map, then log-encode
  maps.forEach((m, k) => {
    let s = 0, n = 0;
    for (let j = Math.max(0, k - 4); j <= Math.min(maps.length - 1, k + 4); j++) { s += tops[j]; n++; }
    const top = s / n, out = new Uint8Array(CELLS);
    for (let i = 0; i < CELLS; i++) out[i] = Math.min(255, 255 * Math.log(1 + 8 * m.T[i] / top) / Math.log(9));
    maps[k] = out;
  });
  clock.push(0);                                       // replay pace: how much each map differs from the last
  for (let k = 1; k < maps.length; k++) {
    let d = 0;
    for (let i = 0; i < CELLS; i += 3) d += Math.abs(maps[k][i] - maps[k - 1][i]);
    clock.push(clock[k - 1] + d);
  }
  for (let k = 0; k < clock.length; k++) clock[k] /= clock[clock.length - 1];
}

// map index (fractional) at cycle time t: fine mesh -> thick veins -> fine mesh, a cosine ping-pong
function mapAt(t) {
  const c = 0.5 - 0.5 * Math.cos(TAU * t / 5);
  let k = 0;
  while (k < clock.length - 2 && clock[k + 1] <= c) k++;
  return k + clamp((c - clock[k]) / (clock[k + 1] - clock[k]));
}

export default {
  name: 'Physarum',
  ko: '점균',
  overlay(ctx, time) {                                 // the agents themselves: short streaks over their last steps
    const step = mapAt((time + START) % 5) * EVERY, K = AGENTS / SHOWN, n = LAST - FIRST;
    const map = maps[Math.round(step / EVERY)];
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    const inVein = new Path2D(), stray = new Path2D();  // agents riding a vein are brighter than the explorers
    for (let a = 0; a < K; a++) {
      const pos = sNow => {
        const s0 = Math.min(n - 1, Math.max(0, Math.floor(sNow))), u = clamp(sNow - s0);
        const o0 = (s0 * K + a) * 2, o1 = ((s0 + 1) * K + a) * 2;
        let x1 = track[o1], y1 = track[o1 + 1];
        if (Math.abs(x1 - track[o0]) > 2 || Math.abs(y1 - track[o0 + 1]) > 2) { x1 = track[o0]; y1 = track[o0 + 1]; }   // wrapped
        return [(track[o0] + (x1 - track[o0]) * u) * 3, (track[o0 + 1] + (y1 - track[o0 + 1]) * u) * 3];
      };
      const p0 = pos(step - 3), pm = pos(step - 1.5), p1 = pos(step);
      if (Math.abs(p1[0] - p0[0]) > 30 || Math.abs(p1[1] - p0[1]) > 30 || Math.abs(pm[0] - p0[0]) > 30 || Math.abs(pm[1] - p0[1]) > 30) continue;   // crossed the wrap
      const path = map[Math.floor(p1[1] / 3) * GW + Math.floor(p1[0] / 3)] > 170 ? inVein : stray;
      path.moveTo(p0[0], p0[1]); path.lineTo(pm[0], pm[1]); path.lineTo(p1[0], p1[1]);
    }
    ctx.strokeStyle = 'rgba(200, 245, 255, 0.42)'; ctx.stroke(inVein);
    ctx.strokeStyle = 'rgba(170, 160, 255, 0.16)'; ctx.stroke(stray);
    ctx.globalCompositeOperation = 'source-over';
  },
  tex(ctx, time) {
    if (!maps.length) simulate();                      // shader effects have no setup: run it on the first frame
    const f = mapAt((time + START) % 5), k = Math.min(maps.length - 2, Math.floor(f)), u = f - k;
    const A = maps[k], B = maps[k + 1];
    img ||= ctx.createImageData(GW, GH);
    for (let i = 0; i < CELLS; i++) { img.data[i * 4] = A[i] + (B[i] - A[i]) * u; img.data[i * 4 + 3] = 255; }
    ctx.putImageData(img, 0, 0);                       // the map sits in the canvas's top-left corner
  },
  frag: `
const int GW = 360, GH = 640;
float cell(ivec2 g) {
  g = ivec2((g.x + GW) % GW, (g.y + GH) % GH);          // the map wraps
  return texelFetch(uTex, ivec2(g.x, int(uRes.y) - 1 - g.y), 0).r;
}
vec4 bspline(float t) {
  float t2 = t * t, t3 = t2 * t, s = 1.0 - t;
  return vec4(s * s * s, 3.0 * t3 - 6.0 * t2 + 4.0, -3.0 * t3 + 3.0 * t2 + 3.0 * t + 1.0, t3) / 6.0;
}
float field(vec2 q) {                                   // smooth cubic upsample, q in cells
  vec2 i = floor(q - 0.5), f = q - 0.5 - i;
  vec4 wx = bspline(f.x), wy = bspline(f.y);
  float s = 0.0;
  for (int y = 0; y < 4; y++) for (int x = 0; x < 4; x++) s += wx[x] * wy[y] * cell(ivec2(i) + ivec2(x - 1, y - 1));
  return s;
}
float halo(vec2 q) {                                    // wide soft blur of the map for the glow
  float s = 0.0, w = 0.0;
  for (int y = -3; y <= 3; y++) for (int x = -3; x <= 3; x++) {
    float k = exp(-float(x * x + y * y) / 6.0);
    s += k * cell(ivec2(floor(q)) + ivec2(x, y) * 2); w += k;
  }
  return s / w;
}
void main() {
  vec2 q = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / 3.0;
  float v = field(q), g = halo(q);
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 col = mix(vec3(0.015, 0.02, 0.06), vec3(0.035, 0.05, 0.13), uv.y);
  col += vec3(0.25, 0.18, 0.75) * pow(g, 1.5) * 0.8;                       // violet glow around the veins
  col = mix(col, vec3(0.20, 0.14, 0.48), smoothstep(0.3, 0.55, v));        // the faint film of trail
  col = mix(col, vec3(0.20, 0.72, 1.00), smoothstep(0.52, 0.76, v));       // veins
  col = mix(col, vec3(0.88, 0.98, 1.00), smoothstep(0.78, 1.0, v));        // their bright cores
  outColor = vec4(col, 1.0);
}`,
};
