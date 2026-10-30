// Sierpinski tetrahedron as an IFS of folds: three mirror folds (x+y, x+z, y+z < 0) send every point into one
// corner, then it is scaled 2x away from that corner, so each step swaps every tetrahedron for four half-size
// ones. The level sweeps 2.75 -> 5.5 -> 0 -> 2.75; in between, the last step's scale grows from 1x to 2x, so
// the four children shrink into place. The pyramid turns 120 degrees per loop (its own symmetry), slowest while
// the detail is finest. Each corner gets a colour at every level. 2x2 supersampling.
export default {
  name: 'Sierpinski Tetrahedron',
  ko: '시에르핀스키 사면체',
  uniforms(t) {
    const a = (t / 5) * Math.PI * 2;
    return {
      uLevel: 2.75 + 2.75 * Math.sin(a),                       // 2.75 -> 5.5 -> 0 -> 2.75
      uYaw: (a / 3) + (0.8 / 3) * (Math.cos(a) - 1),           // a third of a turn, slowest while the detail is finest
    };
  },
  frag: `
uniform float uLevel, uYaw;
const float FLOOR = -0.58;
const mat3 UP = mat3(0.7071, 0.0, -0.7071, 0.5774, 0.5774, 0.5774, 0.4082, -0.8165, 0.4082);  // world up -> corner (1,1,1)
float sdTetra(vec3 z) { return (max(max(-z.x - z.y - z.z, z.x + z.y - z.z), max(-z.x + z.y + z.z, z.x - z.y + z.z)) - 1.0) / 1.732; }
// distance to the fractal at a fractional level; col = one colour per corner per level
float map(vec3 p, out vec3 col) {
  vec3 z = UP * p, r = z, ctr = vec3(0.0);
  float n = floor(uLevel), f = uLevel - n, s = 1.0, w = 0.6, sum = 0.15;
  col = vec3(0.95, 0.88, 0.78) * sum;                        // ivory for the whole, then a colour per corner per level
  for (int i = 0; i < 7; i++) {
    if (float(i) > n) break;
    float g = float(i) < n ? 2.0 : 1.0 + f * f * (3.0 - 2.0 * f);   // the last step grows from 1x to 2x: the children shrink into place
    // which corner of the current tetrahedron holds the point? Asked in the unfolded space, so the colours turn with
    // the shape: gold at the top, and three base colours a third of the wheel apart that drift a third per loop
    vec3 q = r - ctr;
    vec4 k = vec4(q.x + q.y + q.z, q.x - q.y - q.z, -q.x + q.y - q.z, -q.x - q.y + q.z);
    float m = max(max(k.x, k.y), max(k.z, k.w));
    vec3 v = m == k.x ? vec3(1, 1, 1) : m == k.y ? vec3(1, -1, -1) : m == k.z ? vec3(-1, 1, -1) : vec3(-1, -1, 1);
    float h = (m == k.y ? 0.0 : m == k.z ? 1.0 : 2.0) / 3.0 + uPhase / 3.0;
    vec3 c = m == k.x ? vec3(1.0, 0.78, 0.38) : pal(h, vec3(0.66), vec3(0.34), vec3(1.0), vec3(0.0, 0.33, 0.67));
    col += c * w * (g - 1.0); sum += w * (g - 1.0); w *= 0.7;   // the growing step counts as much as it has grown
    ctr += v * 0.5 / s;                                      // the centre of the child the point is in
    if (z.x + z.y < 0.0) z.xy = -z.yx;                       // the three mirror folds
    if (z.x + z.z < 0.0) z.xz = -z.zx;
    if (z.y + z.z < 0.0) z.zy = -z.yz;
    z = z * g - vec3(g - 1.0);                               // scale away from the corner (1,1,1)
    s *= g;
  }
  col /= sum;
  return sdTetra(z) / s;
}
float map(vec3 p) { vec3 c; return map(p, c); }
vec3 normal(vec3 p) {
  vec2 k = vec2(1, -1) * 0.0008;
  return normalize(k.xyy * map(p + k.xyy) + k.yyx * map(p + k.yyx) + k.yxy * map(p + k.yxy) + k.xxx * map(p + k.xxx));
}
float shadow(vec3 ro, vec3 rd) {
  float res = 1.0, t = 0.01;
  for (int i = 0; i < 64; i++) { float h = map(ro + rd * t); res = min(res, 16.0 * h / t); t += clamp(h, 0.005, 0.15); if (res < 0.005 || t > 5.0) break; }
  return clamp(res, 0.0, 1.0);
}
mat3 turn;
vec3 render(vec3 ro, vec3 rd) {
  vec3 l = normalize(vec3(-0.75, 0.6, 0.5));
  vec3 bg = mix(vec3(0.99, 0.80, 0.62), vec3(0.42, 0.50, 0.78), clamp(rd.y * 2.0 + 0.35, 0.0, 1.0));
  vec3 o = turn * ro, d = turn * rd, lo = turn * l;
  float t = 0.0;
  vec3 c;
  bool hit = false;
  for (int i = 0; i < 160; i++) {
    float h = map(o + d * t, c);
    if (h < 0.0004 * t) { hit = true; break; }
    t += h;
    if (t > 12.0) break;
  }
  float tf = rd.y < 0.0 ? (FLOOR - ro.y) / rd.y : 1e3;
  if (!hit || tf < t) {
    if (tf > 100.0) return bg;
    vec3 q = ro + rd * tf;
    float sh = shadow(turn * (q + vec3(0, 0.002, 0)), lo);
    vec3 fc = vec3(0.96, 0.82, 0.72) * (0.5 + 0.5 * sh);
    return mix(fc, bg, smoothstep(3.0, 16.0, tf));
  }
  vec3 p = o + d * t, n = normal(p);
  float dif = max(dot(n, lo), 0.0) * shadow(p + n * 0.002, lo);
  float ao = clamp(0.4 + 0.6 * map(p + n * 0.06) / 0.06, 0.0, 1.0);
  vec3 sky = mix(vec3(0.55, 0.48, 0.52), vec3(0.62, 0.70, 0.95), 0.5 + 0.5 * n.y);
  vec3 col = c * (vec3(1.45, 1.2, 0.95) * dif + sky * 0.5 * ao);
  col += vec3(1.0, 0.92, 0.8) * pow(max(dot(reflect(-lo, n), -d), 0.0), 30.0) * dif * 0.35;
  return col;
}
void main() {
  float yaw = uYaw;                                          // a third of a turn per loop: the pyramid looks the same again
  turn = mat3(cos(yaw), 0.0, sin(yaw), 0.0, 1.0, 0.0, -sin(yaw), 0.0, cos(yaw));
  vec3 ro = vec3(0.0, 1.25, 4.3), ta = vec3(0.0, 0.5, 0.0);
  vec3 fw = normalize(ta - ro), rt = normalize(cross(fw, vec3(0, 1, 0))), up = cross(rt, fw);
  vec3 col = vec3(0.0);
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 uv = (2.0 * (gl_FragCoord.xy + vec2(i, j) * 0.5 - 0.25) - uRes) / uRes.x;
    col += render(ro, normalize(fw * 1.9 + rt * uv.x * 0.8 + up * uv.y * 0.8));
  }
  col /= 4.0;
  outColor = vec4(pow(col / (1.0 + 0.15 * col), vec3(0.95)) + grain(gl_FragCoord.xy) / 255.0, 1.0);
}`,
};
