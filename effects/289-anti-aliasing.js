// Anti-aliasing: a still sunset scene of thin edges (power lines, the stay cables of a bridge, a 0.8 px deck rail,
// water ripples finer than a pixel) is drawn at full resolution with 16 samples per pixel. A loupe hops between three
// spots, and four panels show the 51 x 38 pixels under it ten times larger, each pixel resolved a different way:
//   NO AA     one sample at the pixel centre: stair steps, broken cables, the rail gone
//   FXAA      the no-AA image post-processed: luma edges found, edge ends searched, pixels blended across the edge
//   MSAA 4x   4 coverage samples (rotated grid) but the colour shaded once at the centre: edges smooth, ripples not
//   SSAA 16x  16 fully shaded samples: everything smooth
// Nothing in the scene moves: the panels hold still while the loupe rests and cross-fade while it travels, so the
// jaggies are plain to see and never crawl.
import { FONT, clamp } from '../lib/util.js';

const MAINH = 1040, Z = 10, PW = 510, PH = 340;               // main view height, zoom, panel size (51 x 34 pixels)
const PANELS = [[20, 1104, 'NO AA', '1 sample'], [550, 1104, 'FXAA', 'post-process'], [20, 1516, 'MSAA 4×', '4 coverage · 1 shade'], [550, 1516, 'SSAA 16×', '16 shaded samples']];
const SPOTS = [[760, 413], [735, 712], [735, 818]];          // loupe centres in main-view pixels
// The loop is 150 frames, 50 per spot. In each, the loupe glides to the next spot over 20 frames while the panels
// switch to it one pixel row per frame, top to bottom (34 frames), then everything rests. The loop starts 33 frames
// into the first switch, so the cut from the last frame to the first is just one more row.
const ease = k => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
function loupe(t) {
  const f = (t * 30 + 33) % 150, i = Math.floor(f / 50), j = (i + 1) % 3, u = f - i * 50;
  const k = ease(clamp(u / 20)), a = SPOTS[i], b = SPOTS[j];
  return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, i, j, rows: Math.min(34, Math.round(u)) };
}
const origin = s => [Math.round(s[0] - 25.5), Math.round(s[1] - 17)];

export default {
  name: 'Anti-Aliasing',
  ko: '안티앨리어싱',
  uniforms(t) {
    const l = loupe(t);
    return { uA: origin(SPOTS[l.i]), uB: origin(SPOTS[l.j]), uRows: [l.rows] };
  },
  frag: `
uniform vec2 uA, uB; uniform float uRows;
const float HZ = 800.0;                                         // horizon (pixels from the top)
const vec3 INK = vec3(0.045, 0.05, 0.1);
float seg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)); }

// which object covers point p (pixels, y down): 0 sky, 1 water, 2 hills, 3 bridge, 4 cable, 5 power line
int hit(vec2 p) {
  if (abs(p.y - (340.0 + 0.00028 * (p.x - 260.0) * (p.x - 260.0))) < 0.9) return 5;     // two sagging wires
  if (abs(p.y - (362.0 + 0.00024 * (p.x - 200.0) * (p.x - 200.0))) < 0.55) return 5;
  if (p.y > 726.0 && p.y < 742.0) return 3;                                              // deck
  if (p.y > 721.6 && p.y < 722.4) return 3;                                              // a 0.8 px rail
  for (int k = 0; k < 2; k++) {
    float cx = k == 0 ? 300.0 : 800.0;
    if (abs(p.x - cx) < 60.0 && p.y > 318.0 && p.y < 890.0) {
      if (seg(p, vec2(cx - 34.0, 742.0), vec2(cx - 5.0, 330.0)) < 6.0) return 3;         // A-frame pylon
      if (seg(p, vec2(cx + 34.0, 742.0), vec2(cx + 5.0, 330.0)) < 6.0) return 3;
      if (abs(p.x - cx) < 9.0 && p.y < 342.0) return 3;
      if (abs(p.x - cx) < 26.0 && p.y > 742.0 && p.y < 880.0) return 3;                  // pier
    }
    if (p.y > 340.0 && p.y < 728.0 && abs(p.x - cx) < 350.0)
      for (int i = 0; i < 10; i++) {                                                     // the stay-cable fans
        vec2 top = vec2(cx, 345.0 + 9.0 * float(9 - i));
        float dx = 70.0 + 30.0 * float(i);
        if (seg(p, top, vec2(cx - dx, 727.0)) < 0.6 || seg(p, top, vec2(cx + dx, 727.0)) < 0.6) return 4;
      }
  }
  if (p.y < HZ && p.y > 785.0 - 20.0 * (0.5 + 0.5 * sin(p.x * 0.011 + 1.0)) - 9.0 * sin(p.x * 0.031)) return 2;
  return p.y < HZ ? 0 : 1;
}
vec3 shade(int id, vec2 p) {
  if (id >= 3) return id == 4 ? vec3(0.09, 0.08, 0.15) : INK;
  if (id == 2) return mix(vec3(0.3, 0.2, 0.36), vec3(0.42, 0.27, 0.38), smoothstep(760.0, 800.0, p.y));
  vec2 sun = vec2(735.0, 772.0);
  if (id == 0) {
    float y = p.y / HZ;
    vec3 c = mix(vec3(0.07, 0.09, 0.22), vec3(0.32, 0.22, 0.48), smoothstep(0.0, 0.62, y));
    c = mix(c, vec3(0.96, 0.6, 0.38), smoothstep(0.55, 1.0, y));
    float d = length(p - sun);
    c += vec3(1.0, 0.62, 0.32) * 0.5 * exp(-d / 150.0);
    return mix(c, vec3(1.0, 0.92, 0.7), smoothstep(81.0, 79.0, d));                     // the sun disc
  }
  // water: perspective ripples, finer toward the horizon, bright in a glitter path under the sun
  float y = p.y - HZ + 10.0;
  vec3 c = mix(vec3(0.42, 0.28, 0.42), vec3(0.06, 0.07, 0.17), smoothstep(10.0, 270.0, y));
  float ph = 2600.0 / y + 0.8 * sin(p.x * 0.045 + 900.0 / y);
  float rip = pow(0.5 + 0.5 * sin(ph), 4.0);
  float path = exp(-pow((p.x - sun.x) / (46.0 + 0.5 * y), 2.0));
  return c + vec3(1.0, 0.78, 0.5) * rip * (0.18 + 0.95 * path);
}
vec3 scene(vec2 p) { return shade(hit(p), p); }

// the four ways to resolve pixel q (integer, main-view pixels)
vec3 noaa(vec2 q) { return scene(q + 0.5); }
vec3 msaa(vec2 q) {                                              // rotated-grid 4 samples, shaded at the centre
  vec2 s[4] = vec2[4](vec2(0.375, 0.125), vec2(0.875, 0.375), vec2(0.125, 0.625), vec2(0.625, 0.875));
  vec3 c = vec3(0.0);
  for (int i = 0; i < 4; i++) c += shade(hit(q + s[i]), q + 0.5);
  return c * 0.25;
}
vec3 ssaa(vec2 q) {
  vec3 c = vec3(0.0);
  for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) c += scene(q + (vec2(i, j) + 0.5) / 4.0);
  return c / 16.0;
}
float L(vec2 q) { return dot(noaa(q), vec3(0.299, 0.587, 0.114)); }
vec3 fxaa(vec2 q) {                                              // FXAA 3.11 (quality), one pixel step per search
  vec3 cM = noaa(q);
  float lM = dot(cM, vec3(0.299, 0.587, 0.114));
  float lN = L(q + vec2(0, -1)), lS = L(q + vec2(0, 1)), lW = L(q + vec2(-1, 0)), lE = L(q + vec2(1, 0));
  float hi = max(lM, max(max(lN, lS), max(lW, lE))), lo = min(lM, min(min(lN, lS), min(lW, lE))), range = hi - lo;
  if (range < max(0.0312, hi * 0.125)) return cM;
  float lNW = L(q + vec2(-1, -1)), lNE = L(q + vec2(1, -1)), lSW = L(q + vec2(-1, 1)), lSE = L(q + vec2(1, 1));
  float eH = abs(lNW - 2.0 * lW + lSW) + 2.0 * abs(lN - 2.0 * lM + lS) + abs(lNE - 2.0 * lE + lSE);
  float eV = abs(lNW - 2.0 * lN + lNE) + 2.0 * abs(lW - 2.0 * lM + lE) + abs(lSW - 2.0 * lS + lSE);
  bool horz = eH >= eV;
  float l1 = horz ? lN : lW, l2 = horz ? lS : lE;
  bool first = abs(l1 - lM) >= abs(l2 - lM);
  float grad = 0.25 * max(abs(l1 - lM), abs(l2 - lM)), lEdge = 0.5 * (lM + (first ? l1 : l2));
  vec2 nrm = horz ? vec2(0.0, first ? -1.0 : 1.0) : vec2(first ? -1.0 : 1.0, 0.0), dir = horz ? vec2(1, 0) : vec2(0, 1);
  float dP = 12.0, dN = 12.0, eP = 0.0, eN = 0.0;
  for (int i = 1; i <= 12; i++) {                                 // walk along the edge both ways to its ends
    vec2 a = q + dir * float(i), b = q - dir * float(i);
    if (dP > 11.5) { eP = 0.5 * (L(a) + L(a + nrm)) - lEdge; if (abs(eP) >= grad) dP = float(i); }
    if (dN > 11.5) { eN = 0.5 * (L(b) + L(b + nrm)) - lEdge; if (abs(eN) >= grad) dN = float(i); }
  }
  float e = dP < dN ? eP : eN;
  float off = ((lM - lEdge) < 0.0) != (e < 0.0) ? 0.5 - min(dP, dN) / (dP + dN) : 0.0;
  float sub = clamp(abs((2.0 * (lN + lS + lW + lE) + lNW + lNE + lSW + lSE) / 12.0 - lM) / range, 0.0, 1.0);
  sub = (-2.0 * sub + 3.0) * sub * sub;
  off = max(off, sub * sub * 0.75);
  return mix(cM, noaa(q + nrm), off);
}
vec3 resolve(int mode, vec2 q) { return mode == 0 ? noaa(q) : mode == 1 ? fxaa(q) : mode == 2 ? msaa(q) : ssaa(q); }

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec3 col = vec3(0.035, 0.04, 0.07);
  if (p.y < ${MAINH}.0) {
    col = ssaa(floor(p));
    col *= 1.0 - 0.25 * smoothstep(500.0, 1100.0, length(p - vec2(540.0, 560.0)));      // a soft vignette
  } else {
    vec2 P[4] = vec2[4](${PANELS.map(([x, y]) => `vec2(${x}, ${y})`).join(', ')});
    for (int k = 0; k < 4; k++) {
      vec2 l = p - P[k];
      if (l.x < 0.0 || l.y < 0.0 || l.x >= ${PW}.0 || l.y >= ${PH}.0) continue;
      vec2 v = floor(l / ${Z}.0), f = l - v * ${Z}.0;
      col = resolve(k, v.y < uRows ? uB + v : uA + v);
      if (f.x < 1.0 || f.y < 1.0) col *= 0.72;                                             // the pixel grid
    }
  }
  outColor = vec4(col, 1.0);
}`,
  overlay(ctx, t, W, H) {
    const l = loupe(t);
    // leader lines from the loupe to the panels, then the loupe itself
    const bx = l.x - 25.5, by = l.y - 17;
    ctx.strokeStyle = 'rgba(255, 236, 200, 0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(bx, by + 34); ctx.lineTo(20, MAINH); ctx.moveTo(bx + 51, by + 34); ctx.lineTo(1060, MAINH); ctx.stroke();
    ctx.strokeStyle = '#FFECC8'; ctx.lineWidth = 2; ctx.strokeRect(bx - 1, by - 1, 53, 36);
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255, 236, 200, 0.9)';
    ctx.beginPath(); ctx.arc(l.x, l.y, 46, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(l.x + 34, l.y + 34); ctx.lineTo(l.x + 62, l.y + 62); ctx.stroke();
    ctx.lineCap = 'butt';

    // panel frames and labels, each with its sample pattern
    const pats = [[[0.5, 0.5]], [[0.5, 0.5]], [[0.375, 0.125], [0.875, 0.375], [0.125, 0.625], [0.625, 0.875]],
      Array.from({ length: 16 }, (_, n) => [(n % 4 + 0.5) / 4, (Math.floor(n / 4) + 0.5) / 4])];
    PANELS.forEach(([x, y, name, sub], k) => {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)'; ctx.lineWidth = 2; ctx.strokeRect(x - 1, y - 1, PW + 2, PH + 2);
      if (l.rows > 0 && l.rows < 34) {                           // the row the panels are switching at
        ctx.fillStyle = '#FFC24D'; ctx.fillRect(x, y + l.rows * Z - 1.5, PW, 3);
      }
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'; ctx.fillRect(x, y - 44, 34, 34);       // one pixel and its samples
      ctx.fillStyle = '#FFD27A';
      for (const [u, v] of pats[k]) { ctx.beginPath(); ctx.arc(x + u * 34, y - 44 + v * 34, k === 3 ? 2.4 : 3.4, 0, Math.PI * 2); ctx.fill(); }
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#FFFFFF'; ctx.font = `700 30px ${FONT.sans}`; ctx.fillText(name, x + 48, y - 16);
      const w = ctx.measureText(name).width;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.62)'; ctx.font = `500 22px ${FONT.sans}`; ctx.fillText(sub, x + 64 + w, y - 16);
    });
  },
};
