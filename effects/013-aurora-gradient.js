// Aurora: three light curtains whose lower edge follows looping 1D noise, with vertical rays (noise stretched
// along y) fading upward from green to violet, over fixed stars, a mountain ridge and their reflection in a lake.
export default {
  name: 'Aurora Gradient',
  ko: '오로라 그라디언트',
  frag: `
const float HZ = -0.98;   // lake shore
vec3 sky(vec2 p) {
  float k = clamp((p.y - HZ) / 2.6, 0.0, 1.0);
  vec3 col = mix(vec3(0.03, 0.10, 0.18), vec3(0.01, 0.015, 0.06), sqrt(k));
  vec2 cell = floor(p * 45.0);                                   // fixed stars
  float star = step(0.94, hash12(cell)) * (1.0 - smoothstep(0.04, 0.14, length(fract(p * 45.0) - 0.5 - (hash22(cell) - 0.5) * 0.6)));
  col += star * (0.4 + 0.6 * hash12(cell + 3.0)) * 0.9;

  vec2 L = loopXY(0.45);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float base = -0.40 + 0.30 * fi + 0.18 * snoise(vec3(p.x * 1.6 + fi * 7.0, L)) + 0.08 * sin(p.x * 2.0 + fi * 2.0);
    float dy = p.y - base;
    float edge = smoothstep(-0.04, 0.0, dy);                         // crisp lower hem
    float hem = exp(-max(dy, 0.0) * 14.0);                           // brightest just above it
    float rise = exp(-max(dy, 0.0) / (0.5 + 0.15 * fi));             // rays fade upward
    float xw = p.x + 0.15 * snoise(vec3(p.x * 1.7 + fi * 3.0, L * 1.2));
    float rays = 0.3 + 0.7 * smoothstep(-0.5, 0.8, snoise(vec3(xw * 7.0 + fi * 11.0, L * 0.7)));
    float gaps = smoothstep(-0.2, 0.45, snoise(vec3(p.x * 0.9 + fi * 5.0 + 20.0, L * 0.6))); // the curtain thins out here and there
    vec3 c = mix(vec3(0.15, 1.0, 0.55), vec3(0.2, 0.8, 1.0), smoothstep(0.05, 0.4, dy));
    c = mix(c, vec3(0.8, 0.3, 1.0), smoothstep(0.3, 0.8, dy));
    col += c * (edge * (0.7 * hem + rise * rays) + 0.35 * exp(min(dy, 0.0) * 30.0) * (1.0 - edge)) * gaps * (0.85 - 0.15 * fi);
    col += vec3(0.1, 0.6, 0.4) * 0.06 * exp(-abs(dy) * 4.0) * gaps;  // faint haze around it
  }
  float ridge = HZ + 0.10 + 0.20 * abs(sin(p.x * 2.3 + 0.6)) + 0.07 * snoise(vec3(p.x * 3.0, 5.0, 0.0)); // mountains
  float md = p.y - ridge;
  col = mix(col, vec3(0.01, 0.02, 0.04), 1.0 - smoothstep(-fwidth(md), fwidth(md), md));
  return col;
}
void main() {
  vec2 p = (2.0 * gl_FragCoord.xy - uRes) / uRes.x;
  vec3 col;
  if (p.y >= HZ) col = sky(p);
  else {
    vec2 q = vec2(p.x + 0.006 * sin(p.y * 90.0), 2.0 * HZ - p.y); // mirror with fixed ripples
    col = sky(q) * 0.55 + vec3(0.0, 0.02, 0.04);
    col *= 1.0 - 0.4 * smoothstep(0.0, 0.8, HZ - p.y);
  }
  outColor = vec4(col, 1.0);
}`,
};
