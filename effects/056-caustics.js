// Caustics: two layers of animated Voronoi cells (feature points circle on looping paths); the thin bright net is
// where F2 - F1 is small, warped by noise and split slightly per colour channel, over a tiled pool floor.
export default {
  name: 'Caustics',
  ko: '커스틱',
  frag: `
float cells(vec2 p, float seed) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 9.0, d2 = 9.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(x, y), h = hash22(i + g + seed);
    float sp = h.y < 0.5 ? 1.0 : -1.0;                       // one turn per loop, either way round
    vec2 o = 0.5 + 0.3 * vec2(cos(uPhase * TAU * sp + h.x * TAU), sin(uPhase * TAU * sp + h.x * TAU));
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return d2 - d1;
}
float caustic(vec2 p) {
  vec2 L = loopXY(0.3);
  p += 0.25 * vec2(snoise(vec3(p * 0.5, 1.0) + vec3(L, 0)), snoise(vec3(p * 0.5, 7.0) + vec3(L, 0)));
  float a = cells(p, 0.0), b = cells(rot(0.6) * p * 1.35 + 4.0, 11.0);
  return pow(1.0 - smoothstep(0.0, 0.3, a), 3.0) + 0.5 * pow(1.0 - smoothstep(0.0, 0.26, b), 3.0);
}
void main() {
  vec2 p = gl_FragCoord.xy / uRes.x * 3.4;
  // pool floor: pale tiles with darker grout
  vec2 tp = gl_FragCoord.xy / uRes.x * 9.0, tf = abs(fract(tp) - 0.5);
  float grout = smoothstep(0.455, 0.475, max(tf.x, tf.y));
  vec3 floorCol = mix(vec3(0.16, 0.55, 0.72), vec3(0.08, 0.32, 0.5), grout);
  floorCol *= 0.8 + 0.25 * gl_FragCoord.y / uRes.y;
  floorCol += 0.03 * (hash12(floor(tp)) - 0.5);
  vec3 light = vec3(caustic(p + vec2(0.012, 0)), caustic(p), caustic(p - vec2(0.012, 0)));
  vec3 col = floorCol * (0.6 + 0.9 * light) + vec3(0.55, 0.85, 1.0) * light * 0.35;
  col = mix(col, vec3(0.03, 0.18, 0.32), 0.35 * smoothstep(0.4, 1.0, length(gl_FragCoord.xy / uRes - 0.5)));
  outColor = vec4(col, 1.0);
}`,
};
