// Menger sponge: a cube with a cross of square tunnels cut through it, then the same cut repeated in each of the
// 20 smaller cubes that remain, four levels deep (mod-repeated cells in one distance function). The holes open level
// by level, each level in its own colour, and close again; the sponge stands on a corner and turns 120 degrees per
// loop (its three-fold symmetry), casting a perforated shadow. Soft shadows, AO, 2x2 supersampling.
export default {
  name: 'Menger Sponge',
  ko: '멩거 스펀지',
  uniforms(t) {
    // hole size per level, 0..1: level 1 opens first, level 4 last; they close again in reverse order
    const open = k => {
      const a = Math.min(1, Math.max(0, (t - 0.05 - 0.55 * k) / 0.6)), b = Math.min(1, Math.max(0, (t - 4.5 + 0.3 * k) / 0.45));
      const s = x => x * x * (3 - 2 * x);
      return s(a) * (1 - s(b));
    };
    return { uOpen: [open(0), open(1), open(2), open(3)] };
  },
  frag: `
uniform vec4 uOpen;
// world -> sponge space: the body diagonal (1,1,1) points up, so the cube balances on a corner
const mat3 TILT = mat3(0.70711, -0.70711, 0.0,  0.57735, 0.57735, 0.57735,  -0.40825, -0.40825, 0.81650);
const float FLOOR = -1.7321;

// distance to the sponge; lvl = which cut made this surface (0 = outer faces, 1..4 = tunnel walls of each level)
float map(vec3 p, out float lvl) {
  p.xz = rot(-uPhase * TAU / 3.0 - 0.28 * sin(uPhase * TAU)) * p.xz;   // a third of a turn, slowest at mid-loop
  p = TILT * p;
  vec3 b = abs(p) - 1.0;
  float d = length(max(b, 0.0)) + min(max(b.x, max(b.y, b.z)), 0.0);
  lvl = 0.0;
  float s = 1.0;
  for (int k = 0; k < 4; k++) {
    vec3 q = abs(mod(p * s + 1.0, 2.0) - 1.0);          // position inside this level's cell, -1..1 folded to 0..1
    float m = min(max(q.x, q.y), min(max(q.y, q.z), max(q.z, q.x)));
    float c = (uOpen[k] / 3.0 - m) / s;                  // outside the cross of three square bars, half-width 1/3
    if (uOpen[k] > 0.001 && c > d) { d = c; lvl = float(k + 1); }
    s *= 3.0;
  }
  return d;
}
float map(vec3 p) { float l; return map(p, l); }
vec3 normal(vec3 p) {
  vec2 e = vec2(0.0007, 0.0);
  return normalize(vec3(map(p + e.xyy) - map(p - e.xyy), map(p + e.yxy) - map(p - e.yxy), map(p + e.yyx) - map(p - e.yyx)));
}
float shadow(vec3 ro, vec3 rd) {
  float res = 1.0, t = 0.01;
  for (int i = 0; i < 80; i++) { float h = map(ro + rd * t); res = min(res, 14.0 * h / t); t += clamp(h, 0.006, 0.2); if (res < 0.002 || t > 6.0) break; }
  return clamp(res, 0.0, 1.0);
}
float occlusion(vec3 p, vec3 n) {
  float o = 0.0, w = 1.0;
  for (int i = 1; i <= 5; i++) { float h = 0.018 * float(i * i); o += w * (h - map(p + n * h)); w *= 0.6; }
  return clamp(1.0 - 2.2 * o, 0.0, 1.0);
}
vec3 levelColor(float l) {
  if (l < 0.5) return vec3(0.95, 0.90, 0.82);   // outer faces: warm ivory
  if (l < 1.5) return vec3(0.90, 0.40, 0.33);   // level 1: terracotta
  if (l < 2.5) return vec3(0.95, 0.68, 0.30);   // level 2: saffron
  if (l < 3.5) return vec3(0.27, 0.62, 0.58);   // level 3: sea green
  return vec3(0.30, 0.38, 0.72);                // level 4: slate blue
}
vec3 render(vec2 uv) {
  vec3 ro = vec3(0.0, 2.2, 6.9), ta = vec3(0.0, -0.05, 0.0);
  vec3 fw = normalize(ta - ro), rt = normalize(cross(fw, vec3(0, 1, 0))), up = cross(rt, fw);
  vec3 rd = normalize(uv.x * rt + uv.y * up + 3.6 * fw);
  vec3 bg = mix(vec3(0.80, 0.62, 0.52), vec3(0.12, 0.16, 0.30), clamp(rd.y * 2.2 + 0.62, 0.0, 1.0));
  // key light along one of the sponge's axes at mid-loop, so light streams through the tunnels onto the floor then
  vec3 l = normalize(vec3(-0.70711, 0.57735, 0.40825));
  float t = 5.0, lvl = 0.0;                              // start just in front of the sponge's bounding sphere
  for (int i = 0; i < 180; i++) { float h = map(ro + rd * t, lvl); if (h < 0.0003 * t || t > 11.0) break; t += h; }
  float tf = rd.y < 0.0 ? (FLOOR - ro.y) / rd.y : 1e3;
  if (t > 11.0 || tf < t) {
    if (tf > 80.0) return bg;
    vec3 p = ro + rd * tf;
    vec3 fc = vec3(0.86, 0.70, 0.60) * (0.38 + 0.72 * shadow(p + vec3(0.0, 0.002, 0.0), l));
    return mix(fc, bg, smoothstep(7.0, 30.0, tf));
  }
  vec3 p = ro + rd * t, n = normal(p);
  float dif = max(dot(n, l), 0.0) * shadow(p + n * 0.002, l);
  float ao = occlusion(p, n);
  float sky = 0.6 + 0.4 * n.y, bounce = max(-n.y, 0.0), front = max(dot(n, -rd), 0.0);
  float spe = pow(max(dot(reflect(-l, n), -rd), 0.0), 40.0) * dif;
  vec3 base = levelColor(lvl);
  vec3 amb = vec3(0.26, 0.30, 0.46) * sky + vec3(0.42, 0.30, 0.24) * bounce + vec3(0.14, 0.15, 0.20) * front;
  vec3 col = base * (amb * (0.25 + 0.75 * ao) + vec3(1.25, 1.08, 0.88) * dif) + 0.15 * spe;
  return col;
}
void main() {
  vec3 col = vec3(0.0);
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 uv = (2.0 * (gl_FragCoord.xy + vec2(i, j) * 0.5 - 0.25) - uRes) / uRes.x;
    col += render(uv + vec2(0.0, -0.05));
  }
  col /= 4.0;
  col = 1.0 - exp(-col * 1.35);                         // soft shoulder, so the lit faces keep their shading
  outColor = vec4(col + grain(gl_FragCoord.xy) / 255.0, 1.0);
}`,
};
