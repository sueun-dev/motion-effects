// Smoke: a density field = a widening column shape times domain-warped noise that rises (periodic in y, read on a
// cylinder, so it loops); lit from one side using the density gradient, over a dark studio backdrop.
export default {
  name: 'Smoke',
  ko: '연기',
  frag: `
float rising(vec2 p, vec2 k, float P, float n) {
  float th = TAU * (p.y / P - n * uPhase), R = k.y * P / TAU;
  return snoise(vec3(p.x * k.x, R * cos(th), R * sin(th)));
}
float density(vec2 p) {
  float y = p.y;                                              // 0 at the incense tip
  vec2 w = vec2(rising(p, vec2(2.2, 2.0), 1.4, 1.0), rising(p + 5.0, vec2(2.2, 2.0), 1.4, 1.0));
  vec2 q = p + 0.18 * w * smoothstep(0.0, 0.6, y);            // curls grow as it rises
  float n = 0.6 * rising(q, vec2(4.0, 3.2), 0.7, 2.0) + 0.4 * rising(q + 2.0, vec2(8.0, 6.0), 0.35, 4.0);
  float sway = 0.1 * sin(y * 4.0 - uPhase * TAU) * smoothstep(0.1, 0.9, y);
  float width = 0.012 + 0.2 * smoothstep(0.0, 1.2, y) * smoothstep(0.0, 1.2, y) + 0.08 * y;
  float column = exp(-pow((q.x - sway) / width, 2.0));
  float d = column * (0.55 + 0.7 * n) * smoothstep(-0.02, 0.06, y) * (1.0 - smoothstep(0.7, 1.45, y));
  return clamp(d, 0.0, 1.0);
}
void main() {
  vec2 p = (gl_FragCoord.xy - vec2(0.5 * uRes.x, 0.18 * uRes.y)) / uRes.x;
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 col = mix(vec3(0.03, 0.05, 0.07), vec3(0.12, 0.17, 0.21), smoothstep(1.2, 0.0, length((uv - vec2(0.35, 0.6)) * vec2(1.0, 1.4))));
  float d = density(p);
  float e = 0.01;
  float lit = clamp(0.5 + 6.0 * (density(p + vec2(-e, e * 0.5)) - d), 0.0, 1.0);   // brighter facing the light (upper left)
  vec3 smoke = mix(vec3(0.42, 0.5, 0.58), vec3(0.95, 0.93, 0.9), lit);
  col = mix(col, smoke, d * 0.85);
  // incense stick and its glowing tip
  float stick = step(abs(p.x), 0.004) * step(p.y, -0.005) * step(-0.5, p.y);
  col = mix(col, vec3(0.32, 0.18, 0.12), stick);
  col += vec3(1.0, 0.45, 0.15) * (exp(-dot(p, p) / 0.00004) + 0.3 * exp(-dot(p, p) / 0.0008));
  outColor = vec4(col, 1.0);
}`,
};
