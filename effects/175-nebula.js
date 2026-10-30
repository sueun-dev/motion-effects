// Nebula: flying slowly through glowing gas. The gas is a raymarched emission-absorption volume: domain-warped fbm
// gives the clouds, a second noise colours them (hydrogen pink, oxygen teal, a little gold), a bright star cluster
// far ahead makes the edges that face it glow, and soft dark dust clouds absorb what is behind them. A few stars sit
// inside the gas and slide past. The noise and the stars repeat every P units along the flight path, so flying
// exactly P per loop comes back to the start.
export default {
  name: 'Nebula',
  ko: '성운',
  frag: `
const float P = 10.0;     // everything repeats every P units along z

vec3 h33(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx) * 2.0 - 1.0; }
// gradient noise that repeats every per lattice cells along z
float pnoise(vec3 x, float per) {
  vec3 i = floor(x), f = fract(x), u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  #define G(o) dot(h33(vec3(i.xy + o.xy, mod(i.z + o.z, per))), f - o)
  return mix(mix(mix(G(vec3(0, 0, 0)), G(vec3(1, 0, 0)), u.x), mix(G(vec3(0, 1, 0)), G(vec3(1, 1, 0)), u.x), u.y),
             mix(mix(G(vec3(0, 0, 1)), G(vec3(1, 0, 1)), u.x), mix(G(vec3(0, 1, 1)), G(vec3(1, 1, 1)), u.x), u.y), u.z);
}
float pfbm(vec3 q, float per, int oct) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { if (i >= oct) break; s += a * pnoise(q, per); q = q * 2.0 + vec3(1.7, 9.2, 0.0); per *= 2.0; a *= 0.5; }
  return s;
}
const vec3 L = vec3(0.12, 0.08, -0.99);   // a bright star cluster far ahead lights the clouds from behind

// glowing gas density at p (oct octaves of detail)
float gas(vec3 p, int oct) {
  vec3 q = p * (2.0 / P);                                 // 2 lattice cells per repeat
  vec2 w = vec2(pnoise(q + vec3(0.0, 4.0, 0.0), 2.0), pnoise(q + vec3(6.0, 1.0, 0.0), 2.0));
  q.xy += 0.7 * w;                                        // domain warp: wispy, folded shapes
  float n = pfbm(q * 2.0, 4.0, oct);
  float hole = smoothstep(0.3, 1.6, length(p.xy - vec2(0.2, -0.1)));   // an open channel along the flight path
  float g = clamp((n + 0.25 * w.x - 0.04) * 2.0, 0.0, 1.0);
  return g * g * hole;
}
// dark dust: big soft clouds that only absorb
float dust(vec3 p) {
  vec3 q = p * (2.0 / P);
  return smoothstep(0.25, 0.7, pnoise(q * 1.5 + vec3(5.0, 2.0, 0.0), 3.0) + 0.3 * pnoise(q * 4.0 + 1.0, 8.0));
}
// bright stars inside the gas, k = 0..5, one copy per repeat
vec3 starPos(int k) {
  vec3 r = h33(vec3(float(k) * 7.1, 3.3, float(k) * 1.7));
  return vec3(0.2 + r.x * 3.0, -0.1 + r.y * 2.4, -float(k) * P / 6.0);
}
// the far glow at infinity: read by direction only
vec3 backdrop(vec3 rd) {
  vec2 d = rd.xy / -rd.z;
  float n = fbm(vec3(d * 1.6, 2.0)), m = fbm(vec3(d * 3.0 + 7.0, 4.0));
  float core = exp(-dot(d - L.xy / -L.z, d - L.xy / -L.z) * 5.0);
  vec3 c = mix(vec3(0.5, 0.08, 0.3), vec3(0.05, 0.35, 0.5), smoothstep(-0.3, 0.3, m));
  c = c * smoothstep(-0.4, 0.6, n) * (0.25 + 0.9 * core) + vec3(1.0, 0.75, 0.5) * core * core * 0.9;
  return c;
}

void main() {
  vec2 uv = (2.0 * gl_FragCoord.xy - uRes) / uRes.x;
  float a = uPhase * TAU;
  uv = rot(0.06 * sin(a)) * uv;                            // a gentle roll
  vec3 ro = vec3(0.12 * sin(a), 0.08 * sin(2.0 * a), -P * uPhase);
  vec3 rd = normalize(vec3(uv.x, uv.y - 0.1, -1.7));
  vec3 col = backdrop(rd);
  // fixed stars at infinity
  vec2 sp = rd.xy / -rd.z * 46.0;                         // cells about 20 px wide
  for (int k = 0; k < 2; k++) {
    vec2 cell = floor(sp), f = fract(sp) - 0.5;
    vec2 h = hash22(cell + float(k) * 31.0);
    float s = length(f - (h - 0.5) * 0.7);
    col += vec3(0.8, 0.85, 1.0) * step(0.86, h.x) * exp(-s * s * 140.0) * (0.2 + 0.8 * h.y * h.y);
    sp *= 0.57;
  }
  // march through the clouds. Steps grow with distance (dt = 0.04 + 0.02 t); the whole set of steps is shifted by a
  // fixed per-pixel fraction of a step (never changing over time), which turns slicing bands into a fine, still dither
  float T = 1.0;
  float jit = hash12(gl_FragCoord.xy);
  float pxa = 2.0 / uRes.x / 1.7;                          // one pixel as an angle
  vec3 em = vec3(0.0);
  for (int i = 0; i < 170; i++) {
    float t = 0.2 + 2.0 * (exp(0.02 * (float(i) + jit)) - 1.0);
    float dt = 0.2 + 2.0 * (exp(0.02 * (float(i) + jit + 1.0)) - 1.0) - t;
    if (t > 30.0 || T < 0.02) break;
    vec3 p = ro + rd * t;
    for (int k = 0; k < 6; k++) {                          // a star whose closest point to the ray falls in this step
      vec3 c = starPos(k);
      c.z -= P * floor((c.z - p.z) / P + 0.5);            // the copy nearest this sample
      float tc = dot(c - ro, rd);
      if (tc >= t && tc < t + dt) {
        float ang = length(c - ro - rd * tc) / tc, sz = max(0.01 / tc, 1.4 * pxa), k2 = 0.01 / tc / sz;
        vec3 sc = mix(vec3(1.0, 0.8, 0.6), vec3(0.65, 0.8, 1.0), fract(float(k) * 0.37));
        em += T * sc * (3.0 * k2 * k2 * exp(-ang * ang / (sz * sz)) + 0.04 * exp(-ang / (sz * 4.0))) * smoothstep(0.3, 1.5, tc);
      }
    }
    float d = gas(p, 5), du = dust(p) * smoothstep(0.5, 3.0, t);
    T *= exp(-0.9 * du * dt);
    if (d > 0.002) {
      float rim = clamp((d - gas(p + L * 0.35, 3)) * 1.8, 0.0, 1.0);   // the edge that faces the light
      float hue = pnoise(p * (3.0 / P) + 3.0, 3.0);
      vec3 c = mix(vec3(1.0, 0.22, 0.55), vec3(0.12, 0.55, 1.0), smoothstep(-0.25, 0.25, hue));
      c = mix(c, vec3(1.0, 0.62, 0.28), smoothstep(0.25, 0.55, abs(hue)));
      float fade = smoothstep(0.3, 2.5, t) * exp(-0.045 * t);   // nothing right in front of the lens; far ones dimmer
      vec3 e = (c * 0.22 + (c * 0.6 + 0.5) * rim * 2.4) * d * fade;
      float sig = 0.45 * d * smoothstep(0.3, 2.5, t);
      float tr = exp(-sig * dt);
      em += T * e * (1.0 - tr) / max(sig, 1e-3);
      T *= tr;
    }
  }
  col = col * T + em;
  col = 1.0 - exp(-col * 1.5);
  outColor = vec4(pow(col, vec3(0.95)), 1.0);
}`,
};
