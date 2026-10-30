// Distance and height fog over a raymarched 3D landscape: a winding valley between forested ridges at sunrise,
// seen from a camera gliding slowly on a small loop. Every hit gets fog from the exact integral of a density that
// falls off with height, rho(y) = a e^(-b (y - y0)), plus a thin distance haze of the same form with a much slower
// falloff, so the far ridges fade into haze while white fog pools in the valleys and the ridge tops stay clear.
// Toward the low sun the fog glows warm; the fog bank breathes and its edge drifts.
export default {
  name: 'Distance & Height Fog',
  ko: '거리·높이 안개',
  frag: `
const float P = 24.0;                         // the valley winds and the noise repeats every P units along z
const vec3 SUN = vec3(0.17, 0.15, -0.974);    // low morning sun ahead (unit length)
const float FA = 0.5, FB = 1.2;               // height fog: density FA at y = y0, falling off by e every 1 / FB up
const float HA = 0.045, HB = 0.12;            // distance haze: a thin layer that thins slowly with height

vec3 h33(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx) * 2.0 - 1.0; }
// gradient noise that repeats every per lattice cells along z
float pnoise(vec3 x, float per) {
  vec3 i = floor(x), f = fract(x), u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  #define G(o) dot(h33(vec3(i.xy + o.xy, mod(i.z + o.z, per))), f - o)
  return mix(mix(mix(G(vec3(0, 0, 0)), G(vec3(1, 0, 0)), u.x), mix(G(vec3(0, 1, 0)), G(vec3(1, 1, 0)), u.x), u.y),
             mix(mix(G(vec3(0, 0, 1)), G(vec3(1, 0, 1)), u.x), mix(G(vec3(0, 1, 1)), G(vec3(1, 1, 1)), u.x), u.y), u.z);
}
float valleyX(float z) { return 2.5 * sin(TAU * z / P); }  // the valley floor winds left and right

// ground height (no trees): valley walls rising to ridged mountains
float ground(vec2 xz) {
  vec3 q = vec3(xz.x, 0.5, xz.y) * (4.0 / P);              // 4 lattice cells per repeat
  float r = 0.0, a = 0.5, per = 4.0;
  for (int i = 0; i < 4; i++) { float n = 1.0 - abs(pnoise(q, per)); r += a * n * n; q = q * 2.0 + vec3(1.3, 0.0, 0.0); per *= 2.0; a *= 0.5; }
  float v = abs(xz.x - valleyX(xz.y));
  float big = pnoise(vec3(xz.x, 0.5, xz.y) * (2.0 / P) + vec3(9.0, 0.0, 0.0), 2.0);   // broad rise and fall of the range
  return 7.0 * smoothstep(0.5, 11.0, v) * (0.45 + 0.75 * r) * (1.0 + 0.9 * big * smoothstep(4.0, 14.0, v)) + 1.6 * r - 0.8;
}
// conifers: two staggered grids of cones on the slopes below the tree line, faded out far away
float trees(vec2 xz, float g, float far) {
  float t = 0.0;
  for (int k = 0; k < 2; k++) {
    vec2 u = xz / 0.55 + float(k) * 0.5, c = floor(u), f = fract(u) - 0.5;
    vec3 h = h33(vec3(c, float(k) * 7.0)) * 0.5 + 0.5;
    float d = length(f - (h.xy - 0.5) * 0.3) * 0.55;
    t = max(t, (0.4 + 0.35 * h.z) * max(0.0, 1.0 - d / 0.2) * step(0.25, h.x));
  }
  return t * smoothstep(5.8, 4.2, g) * smoothstep(-0.5, 0.4, g) * (1.0 - far);
}
float height(vec2 xz, float far) { float g = ground(xz); return g + trees(xz, g, far); }

vec3 skyColor(vec3 rd) {
  float s = max(dot(rd, SUN), 0.0);
  vec3 sky = mix(vec3(0.98, 0.84, 0.7), vec3(0.42, 0.55, 0.75), smoothstep(-0.02, 0.5, rd.y));
  return sky + vec3(1.0, 0.8, 0.55) * (0.3 * pow(s, 12.0) + 0.35 * pow(s, 200.0)) + vec3(1.0, 0.95, 0.85) * 0.8 * smoothstep(0.99975, 0.99988, s);
}
vec3 fogColor(vec3 rd) {   // grey-blue, warm toward the sun
  return mix(vec3(0.62, 0.68, 0.76), vec3(1.0, 0.86, 0.68), pow(max(dot(rd, SUN), 0.0), 6.0));
}
// optical depth of a layer with density a e^(-b (y - y0)) along the ray up to distance t (exact integral)
float layer(vec3 ro, vec3 rd, float t, float a, float b, float y0) {
  float k = abs(rd.y) < 1e-4 ? t : (1.0 - exp(-b * rd.y * t)) / (b * rd.y);
  return a * exp(-b * (ro.y - y0)) * k;
}
// fog amount: thick valley fog that pools low (y0 breathes) plus the thin distance haze
float fogAmount(vec3 ro, vec3 rd, float t, float y0) {
  return 1.0 - exp(-layer(ro, rd, t, FA, FB, y0) - layer(ro, rd, t, HA, HB, 0.0));
}

vec3 render(vec3 ro, vec3 rd, float jit, float y0) {
  // march the heightfield: step by a fraction of the height above the ground, then refine the hit
  float t = 0.5 + 0.2 * jit, tHit = -1.0, prevT = t;
  for (int i = 0; i < 340; i++) {
    vec3 p = ro + rd * t;
    float far = smoothstep(12.0, 32.0, t);
    float d = p.y - height(p.xz, far);
    if (d < 0.002 * t) { tHit = t; break; }
    prevT = t;
    t += max(0.35 * d, 0.006 * t);
    if (t > 250.0 || p.y > 12.0 && rd.y > 0.0) break;
  }
  if (tHit < 0.0) return mix(skyColor(rd), fogColor(rd), fogAmount(ro, rd, 400.0, y0));
  float lo = prevT, hi = tHit;                             // a few bisection steps for a clean edge
  for (int i = 0; i < 5; i++) { float m = 0.5 * (lo + hi); vec3 p = ro + rd * m; if (p.y > height(p.xz, smoothstep(12.0, 32.0, m))) lo = m; else hi = m; }
  t = hi;
  vec3 p = ro + rd * t;
  float far = smoothstep(12.0, 32.0, t), e = 0.02 + 0.002 * t;
  vec3 n = normalize(vec3(height(p.xz - vec2(e, 0), far) - height(p.xz + vec2(e, 0), far), 2.0 * e,
                          height(p.xz - vec2(0, e), far) - height(p.xz + vec2(0, e), far)));
  float g = ground(p.xz), tree = clamp((p.y - g) / 0.4, 0.0, 1.0);
  vec3 base = mix(vec3(0.24, 0.22, 0.17), vec3(0.16, 0.2, 0.12), smoothstep(5.5, 4.5, g));   // grass and rock / meadows
  base = mix(base, vec3(0.05, 0.09, 0.07), max(tree, 0.6 * smoothstep(5.6, 4.6, g) * smoothstep(-0.4, 0.2, g)));   // forest
  float sun = max(dot(n, SUN), 0.0), back = pow(max(dot(n, -normalize(vec3(rd.x, 0.0, rd.z))), 0.0), 3.0);
  vec3 col = base * (vec3(0.32, 0.38, 0.5) * (0.5 + 0.5 * n.y) + vec3(1.0, 0.75, 0.5) * 1.6 * sun);
  col += vec3(1.0, 0.7, 0.45) * 0.12 * back * smoothstep(0.0, 0.5, sun);                    // warm rim on sunward edges
  float wisp = 0.4 * snoise(vec3(p.xz * 0.12 + 1.2 * vec2(cos(uPhase * TAU), sin(uPhase * TAU)), 3.0));   // the fog edge drifts
  return mix(col, fogColor(rd), fogAmount(ro, rd, t, y0 + wisp));
}

void main() {
  float a = uPhase * TAU;
  vec3 ro = vec3(valleyX(3.0) * 0.8 + 0.8 * sin(a), 8.5 + 0.25 * sin(2.0 * a), 1.0 * cos(a));   // a slow glide on a small loop
  vec3 ahead = vec3(valleyX(-8.0) * 0.8, 4.5, -12.0);     // looking down the valley
  vec3 fw = normalize(ahead - ro), rt = normalize(cross(fw, vec3(0, 1, 0))), up = cross(rt, fw);
  float y0 = 0.9 + 0.35 * sin(a + 1.0);                    // the valley fog breathes up and down
  vec3 col = vec3(0.0);
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 uv = (2.0 * (gl_FragCoord.xy + vec2(i, j) * 0.5 - 0.25) - uRes) / uRes.x;
    vec3 rd = normalize(rt * uv.x + up * (uv.y - 0.35) + fw * 1.5);
    col += render(ro, rd, hash12(gl_FragCoord.xy * 2.0 + vec2(i, j)), y0);
  }
  outColor = vec4(pow(col / 4.0, vec3(1.05)), 1.0);
}`,
};
