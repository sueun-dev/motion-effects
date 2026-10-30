// Volumetric fireball: a raymarched explosion. Its density is a sphere pushed out by billowing turbulence noise;
// its temperature falls from the core outward and over its life, which sets the emitted colour (white -> yellow ->
// orange -> red) while cooled parts turn into dark smoke that absorbs light. Each blast lives 10 s and a new one
// is born every 5 s, so the old cloud is still rising and thinning while the next one bursts: the noise depends
// only on each blast's age, so the loop is seamless.
export default {
  name: 'Volumetric Fireball',
  ko: '볼류메트릭 화염구',
  frag: `
float turb(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * abs(snoise(p)); p *= 2.03; a *= 0.5; } return s; }

// one blast of age L (0 .. 2): density (x) and temperature (y) at p
vec2 blast(vec3 p, float L) {
  if (L <= 0.0 || L >= 2.0) return vec2(0.0);
  float R = 1.6 * (1.0 - exp(-4.0 * L)) + 0.5 * L;          // fast burst, then slow growth
  vec3 c = vec3(0.0, -0.4 + 0.9 * L + 2.2 * L * L, 0.0);      // it rises, faster and faster as it cools
  vec3 q = p - c;
  float r = length(q);
  if (r > R * 1.7) return vec2(0.0);
  vec3 nq = q / R * 1.2 + vec3(0.0, -1.0 * L, 0.0) + 3.7;     // the noise rolls upward with age
  float t = turb(nq);
  float shape = (R - r) / R + 1.0 * t - 0.3;
  float d = smoothstep(0.0, 0.35, shape) * (1.0 - smoothstep(0.65, 1.3, L)) * smoothstep(0.0, 0.03, L);
  float heat = exp(-2.2 * L) * smoothstep(-0.1, 0.9, shape) * 1.9;
  return vec2(d, heat);
}
vec3 fireColor(float k) {
  vec3 c = mix(vec3(0.0), vec3(0.75, 0.08, 0.02), smoothstep(0.05, 0.3, k));
  c = mix(c, vec3(1.0, 0.42, 0.06), smoothstep(0.3, 0.6, k));
  c = mix(c, vec3(1.0, 0.8, 0.35), smoothstep(0.6, 0.95, k));
  return mix(c, vec3(1.0, 0.97, 0.88), smoothstep(0.95, 1.4, k));
}

void main() {
  vec2 uv = (2.0 * gl_FragCoord.xy - uRes) / uRes.x;
  vec3 ro = vec3(0.0, -0.6, 5.6);
  vec3 rd = normalize(vec3(uv.x, uv.y + 0.75, -1.9));    // horizon low in the frame: room for the rising cloud
  float L0 = uPhase, L1 = uPhase + 1.0;                      // the new blast and the one before it
  float glow = exp(-2.2 * L0) * smoothstep(0.0, 0.03, L0) + exp(-2.2 * L1);
  // night sky and a dark plain lit by the blast
  vec3 col = mix(vec3(0.03, 0.035, 0.06), vec3(0.008, 0.01, 0.025), smoothstep(-0.05, 0.6, rd.y));
  col += vec3(0.9, 0.35, 0.1) * glow * 0.12 * exp(-abs(rd.y) * 6.0);
  const float GROUND = -1.4;
  if (rd.y < 0.0) {
    float tg = (GROUND - ro.y) / rd.y;
    vec3 g = ro + rd * tg;
    vec3 lc = vec3(0.0, 0.3, 0.0) - g;
    float lit = max(normalize(lc).y, 0.0) / (1.0 + 0.15 * dot(lc, lc));
    col = vec3(0.02, 0.018, 0.02) * (0.8 + 0.2 * snoise(vec3(g.xz * 1.5, 0.0))) + vec3(1.0, 0.45, 0.15) * glow * lit * 0.9;
    col = mix(col, vec3(0.03, 0.035, 0.06), smoothstep(8.0, 30.0, tg));
  }
  // march the two blasts
  float T = 1.0;
  vec3 em = vec3(0.0);
  float t0 = 1.8, t1 = 10.0, dt = (t1 - t0) / 110.0;
  float t = t0 + dt * hash12(gl_FragCoord.xy);              // fixed per-pixel offset (never changes over time)
  for (int i = 0; i < 110; i++) {
    vec3 p = ro + rd * t;
    if (p.y < GROUND) break;
    vec2 a = blast(p, L0), b = blast(p, L1);
    float d = a.x + b.x;
    if (d > 0.001) {
      float heat = (a.x * a.y + b.x * b.y) / d;
      vec3 smoke = mix(vec3(0.06, 0.06, 0.065), vec3(0.2, 0.2, 0.21), smoothstep(-0.5, 3.0, p.y)) + vec3(1.0, 0.4, 0.12) * glow * 0.3;
      vec3 e = fireColor(heat) * 5.0 * smoothstep(0.05, 0.45, heat) + smoke * 0.6;
      float sig = d * 6.0;
      float tr = exp(-sig * dt);
      em += T * e * (1.0 - tr);
      T *= tr;
      if (T < 0.01) break;
    }
    t += dt;
  }
  col = col * T + em;
  col = 1.0 - exp(-col * 1.3);
  outColor = vec4(pow(col, vec3(0.9)), 1.0);
}`,
};
