// Hyperbolic {5,4} tiling in the Poincaré disk: pentagons, four at every corner. Each pixel is mapped back by
// the Möbius translation z -> (z - a) / (1 - a z), then folded into one triangle of the tiling by reflecting
// across its three mirrors (the real axis, which is an edge line; the line at 45°; and a circle orthogonal to
// the rim) until it lies inside. The number of edge-line reflections says which of the two tile colours it is.
// Sizes are measured in hyperbolic distance, so lines, stars and their antialiasing shrink correctly toward the
// rim; tiles fade to their mean colour once they are a few pixels wide or slide too far per frame. The translation runs along an
// edge line by two edge lengths every 5 s, a symmetry of the coloured tiling, so the flow loops.
import { FONT } from '../lib/util.js';

const P = 5, Q = 4;
const HALF = Math.acosh(Math.cos(Math.PI / P) / Math.sin(Math.PI / Q));   // vertex to edge midpoint
const XM = Math.tanh(HALF / 2), C = (1 + XM * XM) / (2 * XM), R = C - XM;  // mirror circle: centre C, radius R
const VF = Math.acosh(1 / (Math.tan(Math.PI / P) * Math.tan(Math.PI / Q))), F = Math.tanh(VF / 2);   // face centre
const CX = 540, CY = 1060, RAD = 500, AXIS = 0.5;  // disk on screen; the flow runs along this angle (radians)
const f = x => x.toFixed(6);

export default {
  name: 'Hyperbolic Tiling',
  ko: '쌍곡 타일링',
  uniforms: t => ({ uA: Math.tanh(HALF * 2 * t / 5) }),   // half of 4 half-edges = two edge lengths per loop
  frag: `
uniform float uA;
const float C = ${f(C)}, R = ${f(R)}, ANG = ${f(Math.PI / Q)};
const vec2 FC = vec2(${f(F * Math.cos(Math.PI / Q))}, ${f(F * Math.sin(Math.PI / Q))});
vec2 cmul(vec2 a, vec2 b) { return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
vec2 cdiv(vec2 a, vec2 b) { return vec2(a.x * b.x + a.y * b.y, a.y * b.x - a.x * b.y) / dot(b, b); }
float hdist(vec2 a, vec2 b) { return acosh(1.0 + 2.0 * dot(a - b, a - b) / ((1.0 - dot(a, a)) * (1.0 - dot(b, b)))); }
vec3 tile(vec2 z, float px) {
  // how far this point travels per frame (hyperbolic): cosh(distance to the flow axis) x step
  float sh = 2.0 * abs(z.y) / (1.0 - dot(z, z)), travel = sqrt(1.0 + sh * sh);
  z = cdiv(z - vec2(uA, 0.0), vec2(1.0, 0.0) - uA * z);                 // undo the translation
  float parity = 0.0;
  vec2 n = vec2(-sin(ANG), cos(ANG));
  for (int i = 0; i < 80; i++) {                                         // fold into the triangle (V, M, F)
    bool moved = false;
    if (z.y < 0.0) { z.y = -z.y; parity = 1.0 - parity; moved = true; }
    float s = dot(z, n);
    if (s > 0.0) { z -= 2.0 * s * n; moved = true; }
    vec2 d = z - vec2(C, 0.0);
    if (dot(d, d) < R * R) { z = vec2(C, 0.0) + d * R * R / dot(d, d); moved = true; }
    if (!moved) break;
  }
  // hyperbolic distances: to the edge (the real axis), to the face centre, to the vertex (origin)
  float dE = asinh(2.0 * z.y / (1.0 - dot(z, z)));
  float dF = hdist(z, FC), dV = 2.0 * atanh(length(z));
  // angle round the face centre from the vertex direction (0) to the edge midpoint (36°)
  vec2 w = cdiv(z - FC, vec2(1.0, 0.0) - cmul(vec2(FC.x, -FC.y), z)), wv = -FC;
  float phi = acos(clamp(dot(normalize(w), normalize(wv)), -1.0, 1.0)) / (PI / 5.0);
  float aa = px;
  vec3 body = parity < 0.5 ? vec3(0.10, 0.17, 0.38) : vec3(0.95, 0.89, 0.76);
  vec3 star = parity < 0.5 ? vec3(0.93, 0.70, 0.30) : vec3(0.82, 0.33, 0.25);
  body *= 1.12 - 0.3 * smoothstep(0.0, 0.85, dF);                        // a soft dome over each tile
  float sr = mix(0.62, 0.27, pow(phi, 0.8));                             // five-pointed star, points to the corners
  star *= 1.0 - 0.35 * smoothstep(0.1, 0.6, dF);                         // stars shade toward their points
  vec3 col = mix(body, star, smoothstep(aa, -aa, dF - sr));
  col = mix(col, vec3(0.05, 0.06, 0.12), smoothstep(aa, -aa, dE - 0.05));             // tile edges
  col = mix(col, vec3(0.93, 0.70, 0.30), smoothstep(aa, -aa, dV - 0.1));               // gold studs at corners
  vec3 mean = vec3(0.20, 0.18, 0.28);                                    // fades into a dusky rim, like a vignette
  // where tiles are only a few pixels wide, or slide by a big share of their size each frame, show their average
  return mix(col, mean, max(smoothstep(0.02, 0.07, px), smoothstep(3.5, 9.0, travel)));
}
void main() {
  vec3 acc = vec3(0.0);
  vec2 c0 = vec2(${CX}.0, ${1920 - CY}.0);
  float rot = ${f(AXIS)};
  mat2 m = mat2(cos(rot), -sin(rot), sin(rot), cos(rot));
  bool inside = false;
  for (int j = 0; j < 3; j++) for (int i = 0; i < 3; i++) {             // 3 x 3 supersampling
    vec2 z = m * ((gl_FragCoord.xy + (vec2(i, j) - 1.0) / 3.0 - c0) / ${RAD}.0);
    float r2 = dot(z, z);
    if (r2 >= 0.9995) { acc += vec3(0.0); continue; }
    inside = true;
    float px = 2.0 / ${RAD}.0 / (1.0 - r2);                              // one pixel in hyperbolic units
    acc += tile(z, px);
  }
  vec2 uv = gl_FragCoord.xy / uRes;
  float r = length(gl_FragCoord.xy - c0) / ${RAD}.0;
  vec3 bg = mix(vec3(0.03, 0.03, 0.07), vec3(0.08, 0.06, 0.14), uv.y) + vec3(0.10, 0.08, 0.16) * exp(-pow(r - 1.0, 2.0) * 30.0);
  float cover = clamp((1.0 - r) * ${RAD}.0 + 0.5, 0.0, 1.0);
  vec3 col = mix(bg, acc / 9.0 / max(cover, 0.001), cover);
  if (!inside) col = bg;
  float rim = smoothstep(9.0, 6.0, abs(r - 1.0) * ${RAD}.0 - 4.0);      // a gold rim round the disk
  col = mix(col, vec3(0.86, 0.66, 0.30), rim);
  outColor = vec4(col, 1.0);
}`,
  overlay(ctx, t, W) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(240, 225, 190, 0.9)'; ctx.font = `600 44px ${FONT.serif}`;
    ctx.fillText('{5, 4}', W / 2, 1700);
    ctx.fillStyle = 'rgba(240, 225, 190, 0.6)'; ctx.font = `italic 34px ${FONT.serif}`;
    ctx.fillText('z  ↦  (z − a) / (1 − a z)', W / 2, 1760);
  },
};
