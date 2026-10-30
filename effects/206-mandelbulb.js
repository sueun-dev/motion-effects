// Mandelbulb: z -> z^8 + c in spherical coordinates (radius to the 8th power, both angles times 8), iterated until
// it escapes; the distance estimate 0.25 * log(r) * r / dr is raymarched. A key light circles the camera's view
// axis once per loop, so soft shadows sweep round every bulb and crevice while the camera sways a little.
// Orbit traps colour it; 3x3 supersampling.
export default {
  name: 'Mandelbulb',
  ko: '만델벌브',
  frag: `
// distance to the bulb; trap.xyz = closest the orbit came to each axis plane, trap.w = to the origin
float map(vec3 p, out vec4 trap) {
  vec3 w = p;
  float m = dot(w, w), dz = 1.0;
  trap = vec4(abs(w), m);
  for (int i = 0; i < 5; i++) {
    dz = 8.0 * pow(m, 3.5) * dz + 1.0;
    float r = sqrt(m), b = 8.0 * acos(clamp(w.y / r, -1.0, 1.0)), a = 8.0 * atan(w.x, w.z);
    w = p + pow(r, 8.0) * vec3(sin(b) * sin(a), cos(b), sin(b) * cos(a));
    trap = min(trap, vec4(abs(w), dot(w, w)));
    m = dot(w, w);
    if (m > 256.0) break;
  }
  return 0.25 * log(m) * sqrt(m) / dz;
}
float map(vec3 p) { vec4 tr; return map(p, tr); }
vec3 normal(vec3 p, float e) {
  vec2 k = vec2(1, -1);
  return normalize(k.xyy * map(p + k.xyy * e) + k.yyx * map(p + k.yyx * e) + k.yxy * map(p + k.yxy * e) + k.xxx * map(p + k.xxx * e));
}
float shadow(vec3 ro, vec3 rd) {
  float res = 1.0, t = 0.01;
  for (int i = 0; i < 40; i++) { float h = map(ro + rd * t); res = min(res, 10.0 * h / t); t += clamp(h, 0.008, 0.15); if (res < 0.01 || t > 2.5) break; }
  return clamp(res, 0.0, 1.0);
}
vec3 sky(vec3 rd) {
  return mix(vec3(0.30, 0.17, 0.16), vec3(0.03, 0.05, 0.10), smoothstep(-0.5, 0.5, rd.y));
}
vec3 render(vec2 uv, mat2 R) {
  vec3 ro = vec3(0.0, 1.05, 2.75) * (1.0 + 0.012 * cos(uPhase * TAU)), ta = vec3(0.0, -0.08, 0.0);
  vec3 fw = normalize(ta - ro), rt = normalize(cross(fw, vec3(0, 1, 0))), up = cross(rt, fw);
  vec3 rd = normalize(uv.x * rt + uv.y * up + 2.15 * fw);
  vec3 bg = sky(rd) + vec3(0.20, 0.11, 0.10) * exp(-2.2 * length(uv));   // a warm glow behind the bulb
  float a = uPhase * TAU;
  vec3 l = normalize(0.62 * cos(a) * rt + (0.62 * sin(a) + 0.30) * up - fw);   // circles the view axis
  vec3 o = ro, d = rd;
  o.xz = R * o.xz; d.xz = R * d.xz; l.xz = R * l.xz;      // the camera sways round the bulb
  // only march inside the bulb's bounding sphere (radius 1.25)
  float bb = dot(o, d), cc = dot(o, o) - 1.5625, hdisc = bb * bb - cc;
  if (hdisc < 0.0) return bg;
  float t = max(0.0, -bb - sqrt(hdisc)), tmax = -bb + sqrt(hdisc);
  vec4 tr; bool hit = false;
  for (int i = 0; i < 200; i++) {
    float h = map(o + d * t, tr);
    if (h < 0.0005 * t) { hit = true; break; }
    t += h;
    if (t > tmax) break;
  }
  if (!hit) return bg;
  vec3 p = o + d * t, n = normal(p, 0.0012 * t);
  // orbit-trap colour: ivory ridges, amber folds, deep blue in the gaps
  vec3 base = vec3(0.30, 0.10, 0.04);
  base = mix(base, vec3(0.95, 0.72, 0.42), clamp(tr.y * 1.6, 0.0, 1.0));
  base = mix(base, vec3(0.12, 0.25, 0.48), clamp(tr.z * tr.z * 1.4, 0.0, 1.0));
  base = mix(base, vec3(1.0, 0.92, 0.80), clamp(pow(tr.w, 4.0), 0.0, 1.0));
  float occ = clamp(pow(clamp(tr.w, 0.0, 1.0), 0.8) * 1.25, 0.08, 1.0);     // orbits that stay near 0 sit in crevices
  float dif = clamp(dot(n, l), 0.0, 1.0) * shadow(p + n * 0.002, l);
  float bounce = clamp(0.5 - 0.5 * dot(n, l), 0.0, 1.0) * occ;
  float skyl = (0.6 + 0.4 * n.y) * occ;
  vec3 h2 = normalize(l - d);
  float spe = pow(clamp(dot(n, h2), 0.0, 1.0), 28.0) * dif;
  float fre = pow(clamp(1.0 + dot(d, n), 0.0, 1.0), 2.0) * occ;
  vec3 col = base * (vec3(1.75, 1.32, 0.90) * dif + vec3(0.16, 0.24, 0.42) * skyl + vec3(0.36, 0.17, 0.12) * bounce);
  col += vec3(1.0, 0.85, 0.65) * spe * 0.25 + vec3(0.35, 0.45, 0.70) * fre * 0.25;
  return col;
}
void main() {
  mat2 R = rot(0.04 * sin(uPhase * TAU));
  vec3 col = vec3(0.0);
  for (int j = 0; j < 3; j++) for (int i = 0; i < 3; i++) {
    vec2 uv = (2.0 * (gl_FragCoord.xy + (vec2(i, j) - 1.0) / 3.0) - uRes) / uRes.x;
    col += render(uv + vec2(0.0, 0.14), R);
  }
  col /= 9.0;
  col = pow(col / (1.0 + col * 0.15), vec3(0.85));
  vec2 v = gl_FragCoord.xy / uRes - 0.5;
  col *= 1.0 - 0.35 * dot(v, v);
  outColor = vec4(col + grain(gl_FragCoord.xy) / 255.0, 1.0);
}`,
};
