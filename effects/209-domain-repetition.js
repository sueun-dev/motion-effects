// Domain repetition: one pillar with two striped arches is modelled once, and p.xz = mod(p.xz, 3) - 1.5 copies it
// into every cell of an endless hall. The camera walks down an aisle exactly two cells per loop, so the last frame
// meets the first; low sun shadows stripe the floor and the copies fade into a warm haze. 2x2 supersampling.
export default {
  name: 'Domain Repetition',
  ko: '도메인 반복',
  frag: `
const float CELL = 3.0;
// distance to the hall; m = 0 floor, 1 pillar, 2 arch; q = the point in its cell's own space
float map(vec3 p, out float m, out vec3 q) {
  vec2 id = floor(p.xz / CELL + 0.5);
  q = vec3(p.x - CELL * id.x, p.y, p.z - CELL * id.y);      // the same local space in every cell
  float r = 0.24 + 0.08 * smoothstep(0.45, 0.0, q.y) + 0.07 * smoothstep(2.55, 2.85, q.y);  // flared base and capital
  float pillar = max((length(q.xz) - r) * 0.8, q.y - 3.0);   // 0.8: the flares bend the field, so step a bit short
  vec2 a = vec2(abs(q.x), abs(q.z));
  float slabX = max(abs(q.z) - 0.2, abs(q.y - 3.6) - 0.7);    // a wall along x, above the capitals
  float slabZ = max(abs(q.x) - 0.2, abs(q.y - 3.6) - 0.7);    // and one along z
  float archX = max(slabX, 1.25 - length(vec2(a.x - 1.5, q.y - 2.85)));   // a round opening cut out of each
  float archZ = max(slabZ, 1.25 - length(vec2(a.y - 1.5, q.y - 2.85)));
  float arch = min(archX, archZ);
  float d = min(pillar, arch);
  m = pillar < arch ? 1.0 : 2.0;
  if (p.y < d) { m = 0.0; d = p.y; }
  return d;
}
float map(vec3 p) { float m; vec3 q; return map(p, m, q); }
vec3 normal(vec3 p) {
  vec2 k = vec2(1, -1) * 0.0015;
  return normalize(k.xyy * map(p + k.xyy) + k.yyx * map(p + k.yyx) + k.yxy * map(p + k.yxy) + k.xxx * map(p + k.xxx));
}
float shadow(vec3 ro, vec3 rd) {                            // soft shadow with the improved penumbra estimate (no banding)
  float res = 1.0, t = 0.02, ph = 1e10;
  for (int i = 0; i < 160; i++) {
    float h = map(ro + rd * t);
    float y = h * h / (2.0 * ph), d = sqrt(max(h * h - y * y, 0.0));
    res = min(res, 64.0 * d / max(t - y, 1e-4));
    ph = h;
    t += clamp(h, 0.005, 0.2);
    if (res < 0.005 || t > 10.0) break;
  }
  res = clamp(res, 0.0, 1.0);
  return res * res * (3.0 - 2.0 * res);
}
vec3 render(vec3 ro, vec3 rd) {
  vec3 haze = mix(vec3(0.98, 0.78, 0.66), vec3(0.70, 0.72, 0.92), clamp(rd.y * 1.6 + 0.2, 0.0, 1.0));
  vec3 l = normalize(vec3(-0.55, 0.62, 0.55));               // low sun from behind on the left
  float t = 0.0, m = 0.0;
  vec3 q;
  bool hit = false;
  for (int i = 0; i < 180; i++) {
    float h = map(ro + rd * t, m, q);
    if (h < 0.0004 * t + 0.0004) { hit = true; break; }
    t += h * 0.9;
    if (t > 70.0) break;
  }
  if (!hit) return haze;
  vec3 p = ro + rd * t, n = normal(p);
  float sh = shadow(p + n * 0.01, l);
  float dif = max(dot(n, l), 0.0) * sh;
  float ao = clamp(0.35 + 0.65 * map(p + n * 0.35) / 0.35, 0.0, 1.0);
  vec3 base = vec3(0.93, 0.87, 0.78);                        // warm limestone
  if (m > 1.5) {                                             // red and cream voussoirs round each opening
    vec2 c = vec2(abs(q.x) > abs(q.z) ? abs(q.x) : abs(q.z), q.y);
    float ang = atan(c.y - 2.85, c.x - 1.5);
    float s = smoothstep(-0.08, 0.08, sin(ang * 11.0));
    base = mix(vec3(0.72, 0.24, 0.16), vec3(0.95, 0.86, 0.70), s);
  }
  if (m < 0.5) base = vec3(0.80, 0.70, 0.62);                // polished floor
  vec3 sky = mix(vec3(0.55, 0.50, 0.62), vec3(0.75, 0.80, 0.98), 0.5 + 0.5 * n.y);
  vec3 col = base * (vec3(1.6, 1.22, 0.86) * dif + sky * 0.34 * ao);
  if (m < 0.5) col += haze * 0.18 * pow(1.0 - max(dot(n, -rd), 0.0), 4.0);  // a sheen on the floor far off
  return mix(col, haze, 1.0 - exp(-0.055 * t));              // the copies fade into the haze
}
void main() {
  float a = uPhase * TAU;
  vec3 ro = vec3(1.5 + 0.2 * sin(a), 1.55 + 0.05 * sin(2.0 * a), -2.0 * CELL * uPhase);  // two cells per loop
  vec3 fw = normalize(vec3(0.42 + 0.05 * sin(a), 0.16, -1.0));
  vec3 rt = normalize(cross(fw, vec3(0, 1, 0))), up = cross(rt, fw);
  vec3 col = vec3(0.0);
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 uv = (2.0 * (gl_FragCoord.xy + vec2(i, j) * 0.5 - 0.25) - uRes) / uRes.x;
    col += render(ro, normalize(fw * 1.4 + rt * uv.x * 0.8 + up * uv.y * 0.8));
  }
  col /= 4.0;
  outColor = vec4(pow(col / (1.0 + 0.15 * col), vec3(0.95)) + grain(gl_FragCoord.xy) / 255.0, 1.0);
}`,
};
