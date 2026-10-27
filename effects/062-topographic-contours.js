// Topographic map: a height field from two noise layers drifting on opposite looping circles; contour lines are the
// integer crossings of height * levels (anti-aliased with fwidth), with banded elevation tints and soft hillshade.
export default {
  name: 'Topographic Contours',
  ko: '등고선',
  frag: `
const float LEVELS = 12.0;
float height(vec2 p) {   // three smooth octaves only, so the lines stay long and calm
  vec2 L = loopXY(0.12);
  vec3 q = vec3(p * 1.1 + L, 0.0);
  float n = 0.5 * snoise(q) + 0.22 * snoise(q * 2.1 + 3.0) + 0.08 * snoise(q * 4.3 + 7.0);
  return 0.5 + 0.6 * n + 0.22 * snoise(vec3(p * 0.7 - L * 1.3, 4.0));
}
void main() {
  vec2 p = gl_FragCoord.xy / uRes.x;
  float h = height(p);
  float f = h * LEVELS;
  float band = floor(f) / LEVELS;
  vec3 tint = band < 0.3 ? mix(vec3(0.55, 0.78, 0.86), vec3(0.72, 0.87, 0.9), band / 0.3)       // water
            : band < 0.55 ? mix(vec3(0.66, 0.8, 0.6), vec3(0.86, 0.88, 0.64), (band - 0.3) / 0.25)
            : band < 0.8 ? mix(vec3(0.92, 0.82, 0.6), vec3(0.8, 0.6, 0.45), (band - 0.55) / 0.25)
            : mix(vec3(0.82, 0.68, 0.6), vec3(0.98, 0.96, 0.94), (band - 0.8) / 0.25);
  float e = 0.003;
  vec2 g = vec2(height(p + vec2(e, 0)) - h, height(p + vec2(0, e)) - h) / e;
  float shade = clamp(0.92 + 0.08 * dot(normalize(vec3(-g, 2.5)), normalize(vec3(-1.0, 1.0, 1.2))) * 1.6 - 0.08, 0.75, 1.08);
  vec3 col = tint * shade;
  float d = abs(fract(f + 0.5) - 0.5), w = fwidth(f);
  bool index = mod(floor(f + 0.5), 3.0) == 0.0;          // every third line is a heavier index contour
  float lw = index ? 1.9 : 1.1;                           // half width in pixels
  float line = 1.0 - smoothstep((lw - 0.6) * w, (lw + 0.6) * w, d);
  vec3 ink = band < 0.3 ? vec3(0.2, 0.42, 0.6) : vec3(0.42, 0.26, 0.16);
  col = mix(col, ink, line * (index ? 0.9 : 0.6));
  col *= 0.88 + 0.12 * smoothstep(1.2, 0.3, length(gl_FragCoord.xy / uRes - 0.5));
  outColor = vec4(col, 1.0);
}`,
};
