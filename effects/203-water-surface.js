// Water surface: drops fall on a still pond and send rings out. Every pixel bends its view ray at the rippled
// surface twice: reflected into a sky with a far tree line, refracted (index 1.33) down to wet pebbles with
// caustics, and the two are mixed by Schlick's Fresnel term, so the near water is clear and the far water a mirror.
// Petals float on the rings and shade the stones. Rings from the previous loop are added in, so it loops; 2x2 samples.
export default {
  name: 'Water Surface',
  ko: '물 표면',
  frag: `
const float DEPTH = 0.42;
const vec3 SUN = vec3(0.35, 0.20, -0.92);
// drops: x, z, time (s), strength
const vec4 DROPS[7] = vec4[7](vec4(-0.18, -0.25, 0.25, 1.0), vec4(0.40, -1.50, 0.95, 0.9), vec4(-0.30, 0.55, 1.65, 0.9),
  vec4(-0.55, -2.50, 2.25, 1.1), vec4(0.22, -0.85, 3.00, 1.0), vec4(0.45, 0.20, 3.65, 0.8), vec4(-0.05, -3.60, 4.30, 1.2));

float height(vec2 p) {
  float h = 0.0;
  for (int i = 0; i < 7; i++) {
    vec4 d = DROPS[i];
    float r = length(p - d.xy);
    for (int k = 0; k < 2; k++) {
      float tau = uTime - d.z + 5.0 * float(k);                // this loop's drop and the one before it
      if (tau < 0.0) continue;
      float front = 0.30 * tau + 0.03, sig = 0.07 + 0.08 * tau;
      float env = exp(-pow((r - front) / sig, 2.0)) * exp(-1.1 * tau) / (1.0 + 3.0 * r);
      h += d.w * 0.040 * env * sin(34.0 * (r - front)) * smoothstep(0.0, 0.15, tau);
    }
  }
  float a = uPhase * TAU;                                       // a breath of wind, whole cycles per loop
  h += 0.0010 * sin(dot(p, vec2(7.0, 4.0)) - 2.0 * a) + 0.0008 * sin(dot(p, vec2(-5.0, 8.0)) + a);
  return h;
}
vec2 slope(vec2 p) {
  vec2 e = vec2(0.003, 0.0);
  return vec2(height(p + e.xy) - height(p - e.xy), height(p + e.yx) - height(p - e.yx)) / (2.0 * e.x);
}
// petals: centre x, z, angle; they drift on small circles that close each loop
float petal(vec2 p, int i, out vec2 local) {
  float fi = float(i);
  vec2 c = vec2(-0.55 + 0.37 * mod(fi * 3.0, 4.0) - 0.05 * fi, 0.75 - 0.45 * fi) + 0.06 * vec2(cos(uPhase * TAU + fi), sin(uPhase * TAU + fi));
  float ang = fi * 1.9 + 0.35 * sin(uPhase * TAU + fi * 2.0);
  local = rot(ang) * (p - c);
  vec2 q = local / vec2(0.055, 0.075);
  float notch = 0.35 * (1.0 - smoothstep(0.0, 0.25, abs(q.x))) * step(0.0, q.y);
  return length(q) - 1.0 + notch * smoothstep(0.4, 1.0, q.y);
}
float petals(vec2 p, out vec2 local) {
  float d = 1e3; vec2 lc;
  for (int i = 0; i < 7; i++) { float di = petal(p, i, lc); if (di < d) { d = di; local = lc; } }
  return d;
}
vec3 sky(vec3 r) {
  float el = r.y;
  vec3 c = mix(vec3(1.00, 0.80, 0.62), vec3(0.42, 0.58, 0.86), smoothstep(0.0, 0.45, el));
  c += vec3(1.0, 0.75, 0.45) * pow(max(dot(r, normalize(SUN)), 0.0), 24.0) * 0.45;
  float az = atan(r.x, -r.z);
  float trees = 0.11 + 0.05 * fbm(vec3(az * 2.0, 0.0, 2.0)) + 0.015 * fbm(vec3(az * 14.0, 1.0, 5.0));   // far bank
  vec3 leaf = mix(vec3(0.10, 0.19, 0.12), vec3(0.22, 0.30, 0.16), smoothstep(trees - 0.08, trees, el));
  c = mix(c, leaf, 1.0 - smoothstep(trees - 0.006, trees + 0.006, el));
  return c;
}
// river stones: one rounded, oval stone per cell of a jittered grid (the topmost wins where they overlap), on sand
vec3 pebbles(vec2 p) {
  vec2 g = p / 0.12, i = floor(g), f = fract(g);
  float best = 0.0; vec2 cell = vec2(0.0), dir = vec2(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 o = vec2(x, y), id = i + o, v = f - (o + 0.25 + 0.5 * hash22(id));
    float a = hash12(id + 5.0) * PI, r = 0.36 + 0.2 * hash12(id + 7.0);
    v = rot(a) * v * vec2(1.0, 1.35);                              // oval
    float dome = r * r - dot(v, v);                                // height of this stone's dome here
    if (dome > best) { best = dome; cell = id; dir = v / r; }
  }
  vec3 sand = vec3(0.60, 0.53, 0.42) * (0.85 + 0.15 * vnoise(p * 80.0));
  if (best <= 0.0) return sand * 0.75;
  float h = hash12(cell);
  vec3 col = h < 0.22 ? vec3(0.70, 0.66, 0.60) : h < 0.42 ? vec3(0.50, 0.47, 0.44) : h < 0.6 ? vec3(0.80, 0.63, 0.45)
    : h < 0.72 ? vec3(0.66, 0.42, 0.33) : h < 0.86 ? vec3(0.32, 0.32, 0.34) : vec3(0.92, 0.88, 0.80);
  col *= (0.85 + 0.3 * hash12(cell + 9.0)) * (0.88 + 0.24 * vnoise(p * 140.0 + cell * 7.0));   // speckled stone
  vec3 n = normalize(vec3(dir, 0.55));                             // the dome's normal (stone space)
  float lit = 0.55 + 0.6 * max(dot(n, normalize(vec3(-0.3, 0.6, 0.75))), 0.0);
  float rimDark = smoothstep(0.0, 0.05, best);                     // contact shadow where stone meets sand
  return mix(sand * 0.55, col * lit, rimDark);
}
vec3 render(vec2 uv) {
  vec3 ro = vec3(0.0, 1.0, 1.2);
  vec3 rd = normalize(vec3(uv, -2.0));
  rd.yz = rot(0.53) * rd.yz;                                   // looking down about 30 degrees: the far bank at the top
  if (rd.y > -0.002) return sky(rd);
  float t = -ro.y / rd.y;
  vec3 p = ro + rd * t;
  float fade = 1.0 / (1.0 + 0.05 * t * t);                      // calm the ripples far away, where they would alias
  vec2 s = slope(p.xz) * fade;
  vec3 n = normalize(vec3(-s.x, 1.0, -s.y));
  vec3 l = normalize(SUN);
  // reflection and refraction, mixed by Fresnel (Schlick, F0 = 0.02)
  vec3 rf = reflect(rd, n);
  rf.y = abs(rf.y);
  vec3 refl = sky(rf);
  vec3 tr = refract(rd, n, 1.0 / 1.33);
  float tb = DEPTH / -tr.y;
  vec3 b = p + tr * tb;
  vec3 floorCol = mix(pebbles(b.xz), vec3(0.50, 0.46, 0.41), smoothstep(2.0, 5.5, t));   // far stones blur to their average, no moire
  // caustics: where the surface curves like a lens (negative Laplacian), light on the stones bunches up
  vec2 lp = b.xz + vec2(0.0, DEPTH * 0.4);
  float e = 0.012;
  float lap = height(lp + vec2(e, 0)) + height(lp - vec2(e, 0)) + height(lp + vec2(0, e)) + height(lp - vec2(0, e)) - 4.0 * height(lp);
  float caus = clamp(1.0 - lap / (e * e) * 0.030, 0.4, 2.2);
  vec2 lc;
  float shade = smoothstep(-0.2, 0.25, petals(lp, lc));        // petal shadows on the stones
  floorCol *= vec3(1.05, 1.0, 0.9) * caus * (0.45 + 0.55 * shade);
  float path = tb + DEPTH;
  vec3 under = floorCol * exp(-path * vec3(0.38, 0.16, 0.15)) + vec3(0.05, 0.13, 0.14) * (1.0 - exp(-path * 0.6));
  float F = 0.02 + 0.98 * pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
  vec3 col = mix(under, refl, F);
  col += vec3(1.0, 0.85, 0.6) * pow(max(dot(rf, l), 0.0), 300.0) * F * 1.5;
  // a petal floats on top
  float pd = petals(p.xz, lc);
  float cover = 1.0 - smoothstep(-0.06, 0.06, pd);
  if (cover > 0.0) {
    vec3 pc = mix(vec3(1.0, 0.86, 0.90), vec3(0.95, 0.55, 0.68), smoothstep(-1.0, 0.2, lc.y / 0.075));
    pc *= 0.75 + 0.35 * max(dot(n, l), 0.0) + 0.15 * n.y;
    col = mix(col, pc, cover);
  }
  return col;
}
void main() {
  vec3 col = vec3(0.0);
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 uv = (2.0 * (gl_FragCoord.xy + vec2(i, j) * 0.5 - 0.25) - uRes) / uRes.x;
    col += render(uv);
  }
  col /= 4.0;
  col = pow(col, vec3(0.95));
  outColor = vec4(col + grain(gl_FragCoord.xy) / 255.0, 1.0);
}`,
};
