// Raymarching signed distance fields: a torus, a pulsing core and three orbiting spheres are joined with a
// smooth minimum, so they melt into one another as they pass. Soft shadows on a floor, AO, 2x2 supersampling.
export default {
  name: 'Raymarching SDF',
  ko: '레이마칭 SDF',
  frag: `
float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float sdTorus(vec3 p, vec2 t) { vec2 q = vec2(length(p.xz) - t.x, p.y); return length(q) - t.y; }

// distance to the scene; m returns a 0..1 colour blend (0 torus, 1 spheres)
float map(vec3 p, out float m) {
  float a = uPhase * TAU;
  vec3 q = p;
  q.yz = rot(0.5 + 0.25 * sin(a)) * q.yz;
  q.xz = rot(a) * q.xz;                                     // the whole group turns once per loop
  float d = sdTorus(q, vec2(1.15, 0.32)), s = 1e3;
  for (int i = 0; i < 3; i++) {
    float k = float(i), b = a * (k == 1.0 ? -2.0 : 1.0) + k * TAU / 3.0;
    vec3 c = vec3(1.15 * cos(b), 0.9 * sin(2.0 * b + k), 1.15 * sin(b));
    s = min(s, length(q - c) - (0.42 + 0.06 * k));
  }
  s = min(s, length(q) - (0.55 + 0.15 * sin(2.0 * a)));    // a pulsing core
  m = clamp(0.5 + 0.5 * (d - s) / 0.45, 0.0, 1.0);
  return smin(d, s, 0.45);
}
float map(vec3 p) { float m; return map(p, m); }
vec3 normal(vec3 p) {
  vec2 e = vec2(0.0015, 0.0);
  return normalize(vec3(map(p + e.xyy) - map(p - e.xyy), map(p + e.yxy) - map(p - e.yxy), map(p + e.yyx) - map(p - e.yyx)));
}
float shadow(vec3 ro, vec3 rd) {
  float res = 1.0, t = 0.03;
  for (int i = 0; i < 40; i++) { float h = map(ro + rd * t); res = min(res, 8.0 * h / t); t += clamp(h, 0.02, 0.3); if (h < 0.001 || t > 8.0) break; }
  return clamp(res, 0.0, 1.0);
}
const float FLOOR = -2.3;
vec3 render(vec2 uv) {
  vec3 ro = vec3(0.0, 0.6, 7.2), rd = normalize(vec3(uv * 0.78, -2.6));
  rd.yz = rot(0.1) * rd.yz;                                  // looking slightly down
  vec3 bg = mix(vec3(1.0, 0.86, 0.78), vec3(0.50, 0.58, 0.96), clamp(rd.y * 2.2 + 0.45, 0.0, 1.0));
  vec3 l = normalize(vec3(-0.4, 0.9, 0.35));
  float t = 0.0, m = 0.0;
  for (int i = 0; i < 110; i++) { float h = map(ro + rd * t, m); if (h < 0.0008 || t > 14.0) break; t += h; }
  float tf = rd.y < 0.0 ? (FLOOR - ro.y) / rd.y : 1e3;      // the floor, hit analytically
  if (t > 14.0 && tf > 60.0) return bg;
  if (t > 14.0 || tf < t) {
    vec3 p = ro + rd * tf;
    vec3 fc = vec3(0.97, 0.84, 0.80) * (0.68 + 0.32 * shadow(p + vec3(0, 0.01, 0), l));
    return mix(fc, bg, smoothstep(8.0, 40.0, tf));          // fade into the sky far away
  }
  vec3 p = ro + rd * t, n = normal(p);
  float dif = max(dot(n, l), 0.0) * shadow(p + n * 0.01, l);
  float ao = clamp(map(p + n * 0.25) / 0.25, 0.0, 1.0);
  float spe = pow(max(dot(reflect(-l, n), -rd), 0.0), 48.0);
  float fre = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
  vec3 base = mix(vec3(1.0, 0.42, 0.46), vec3(0.36, 0.52, 1.0), m);
  vec3 col = base * (0.25 + 0.95 * dif) * (0.55 + 0.45 * ao) + vec3(1.0) * spe * 0.8;
  return mix(col, bg * 1.05, fre * 0.55);
}
void main() {
  vec3 col = vec3(0.0);
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 uv = (2.0 * (gl_FragCoord.xy + vec2(i, j) * 0.5 - 0.25) - uRes) / uRes.x;
    col += render(uv + vec2(0.0, 0.12));
  }
  outColor = vec4(pow(col / 4.0, vec3(0.95)), 1.0);
}`,
};
