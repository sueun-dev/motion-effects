// Volumetric clouds: a layer of cumulus raymarched as a density field (fbm of gradient noise, flat bases, puffy
// tops). At every step a short march toward the sun gives the light that reaches it (Beer-Lambert) and a
// Henyey-Greenstein phase makes the edges facing the low sun glow. The noise repeats every P units along the
// flight path, so flying forward exactly P per loop comes back to the same clouds.
export default {
  name: 'Volumetric Clouds',
  ko: '볼류메트릭 구름',
  frag: `
const float P = 12.0;                     // the clouds repeat every P units along z (the flight path)
const float TOP = 2.0;                    // cloud layer: y 0 .. TOP
#define SUN normalize(vec3(0.43, 0.19, -0.882))  // low sun ahead, to the right

vec3 h33(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx) * 2.0 - 1.0; }
// gradient noise that repeats every per lattice cells along z
float pnoise(vec3 x, float per) {
  vec3 i = floor(x), f = fract(x), u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  #define G(o) dot(h33(vec3(i.xy + o.xy, mod(i.z + o.z, per))), f - o)
  return mix(mix(mix(G(vec3(0, 0, 0)), G(vec3(1, 0, 0)), u.x), mix(G(vec3(0, 1, 0)), G(vec3(1, 1, 0)), u.x), u.y),
             mix(mix(G(vec3(0, 0, 1)), G(vec3(1, 0, 1)), u.x), mix(G(vec3(0, 1, 1)), G(vec3(1, 1, 1)), u.x), u.y), u.z);
}
float density(vec3 p, int oct) {
  if (p.y < 0.0 || p.y > TOP) return 0.0;
  vec3 q = p * (6.0 / P);                 // 6 lattice cells per repeat
  float h = p.y / TOP;
  float base = pnoise(q * vec3(1.0, 0.8, 1.0), 6.0) + 0.5 * pnoise(q * 2.0 + vec3(5.2, 1.3, 0.0), 12.0);
  base = base * 0.9 + 0.3;                                // coverage: most of the sky below is cloud
  float d = base * smoothstep(0.0, 0.1, h) * smoothstep(1.0, 0.3, h) - 0.22 * h;   // flat bases, rounded tops
  if (oct > 2) {                                          // billowy detail eats into the edges
    vec3 r = q * 4.0 + vec3(loopXY(0.15), 0.0);           // it churns slowly on a small circle
    float det = 0.0, a = 0.5, per = 24.0;
    for (int i = 0; i < 3; i++) { det += a * abs(pnoise(r, per)); r = r * 2.0 + 1.7; per *= 2.0; a *= 0.5; }
    d -= det * 0.4 * (1.0 - clamp(d * 2.5, 0.0, 1.0));
  }
  return clamp(d * 3.5, 0.0, 1.0);
}
vec3 skyColor(vec3 rd) {
  float s = max(dot(rd, SUN), 0.0), y = max(rd.y, 0.0);
  vec3 sky = mix(vec3(1.0, 0.6, 0.38), vec3(0.42, 0.34, 0.52), smoothstep(0.0, 0.2, y));
  sky = mix(sky, vec3(0.06, 0.11, 0.32), smoothstep(0.12, 0.7, y));
  sky += vec3(1.0, 0.5, 0.25) * 0.5 * pow(s, 5.0) + vec3(1.0, 0.8, 0.55) * 0.5 * pow(s, 80.0);
  sky += vec3(1.0, 0.86, 0.66) * 5.0 * smoothstep(0.99978, 0.99988, s);   // the sun disc
  return sky;
}
// what a gap in the deck shows: coast and sea SEA units below, in the deck's soft shadow except where sunlight
// comes through, seen through hazy air lit by the same sunset colours (aerial perspective)
const float SEA = -9.0;
vec3 ground(vec3 ro, vec3 rd, float tBot, vec3 haze) {
  float ts = (SEA - ro.y) / rd.y;
  vec3 ps = ro + rd * ts;
  vec3 q = vec3(ps.x, 0.0, ps.z) / P;                       // ground textures repeat with the clouds
  float coast = pnoise(q * 3.0, 3.0) + 0.5 * pnoise(q * 6.0 + 2.0, 6.0) + 0.25 * pnoise(q * 12.0 + 4.0, 12.0);
  float land = smoothstep(0.02, 0.07, coast);
  float fields = pnoise(q * 24.0 + 7.0, 24.0);
  vec3 c = mix(vec3(0.04, 0.08, 0.14), mix(vec3(0.13, 0.14, 0.07), vec3(0.2, 0.16, 0.1), smoothstep(-0.3, 0.3, fields)), land);
  float sh = 0.0;                                            // soft shadow of the deck along the sunbeam
  for (int k = 0; k < 3; k++) { float y = 0.3 + 0.6 * float(k); sh += density(ps + SUN * ((y - ps.y) / SUN.y), 2); }
  float lit = exp(-1.5 * sh);
  c *= vec3(0.35, 0.36, 0.5) + vec3(1.3, 0.85, 0.55) * lit;   // dim blue under the deck, warm where the sun gets in
  float glint = (1.0 - land) * pow(max(dot(reflect(rd, vec3(0, 1, 0)), SUN), 0.0), 30.0);
  c += vec3(1.0, 0.7, 0.45) * glint * lit;
  vec3 air = mix(vec3(0.3, 0.3, 0.43), haze, 0.3 + 0.4 * lit) * 0.85;                     // haze under the deck
  return mix(c, air, 1.0 - exp(-0.06 * (ts - tBot)));
}
float hg(float c, float g) { return (1.0 - g * g) / (4.0 * PI * pow(1.0 + g * g - 2.0 * g * c, 1.5)); }

void main() {
  vec2 uv = (2.0 * gl_FragCoord.xy - uRes) / uRes.x;
  vec3 ro = vec3(0.0, 3.8, -P * uPhase);                // fly forward one repeat per loop
  vec3 rd = normalize(vec3(uv.x, uv.y - 0.42, -1.5));    // horizon about 40 % down the frame
  vec3 sky = skyColor(rd);
  float tTop = (TOP - ro.y) / rd.y, tBot = -ro.y / rd.y;
  float t0 = rd.y < 0.0 ? tTop : 1e9, t1 = rd.y < 0.0 ? tBot : 1e9;
  vec3 haze = skyColor(normalize(vec3(rd.x, 0.015, rd.z)));
  vec3 bg = sky;
  if (rd.y < 0.0) bg = t1 > 70.0 ? haze : ground(ro, rd, tBot, haze);   // far: the horizon haze; near: the land below
  t1 = min(t1, 70.0);
  float mu = dot(rd, SUN);
  float ph = mix(hg(mu, 0.7), hg(mu, -0.15), 0.35) * 4.0 * PI;
  vec3 sunCol = vec3(1.0, 0.66, 0.4) * 2.4;
  vec3 col = vec3(0.0);
  float T = 1.0, t = t0;
  float dt = 0.03;
  t += dt * hash12(gl_FragCoord.xy);                     // fixed per-pixel start offset (never changes over time)
  for (int i = 0; i < 240; i++) {
    if (t > t1 || T < 0.01) break;
    dt = 0.03 + 0.011 * (t - t0);
    vec3 p = ro + rd * t;
    float d = density(p, 4);
    if (d > 0.001) {
      float sl = 0.0, ls = 0.06;                         // light march toward the sun
      vec3 lp = p;
      for (int k = 0; k < 5; k++) { lp += SUN * ls; sl += density(lp, 2) * ls; ls *= 1.7; }
      float h = p.y / TOP;
      vec3 amb = mix(vec3(0.08, 0.1, 0.22), vec3(0.3, 0.36, 0.62), h);
      float powder = 1.0 - exp(-d * 6.0);
      vec3 S = sunCol * (exp(-sl * 8.0) + 0.2 * exp(-sl * 1.5)) * ph * (0.4 + 0.6 * powder) + amb;
      float sig = d * 9.0;
      float tr = exp(-sig * dt);
      vec3 lit = S * (1.0 - tr);
      float fog = exp(-0.028 * t);                       // far clouds melt into the haze
      col += T * mix(haze * (1.0 - tr), lit, fog);
      T *= tr;
    }
    t += dt;
  }
  col += T * bg;
  col = 1.0 - exp(-col * 1.15);
  outColor = vec4(pow(col, vec3(0.92)), 1.0);
}`,
};
