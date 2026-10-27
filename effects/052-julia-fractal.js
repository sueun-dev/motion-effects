// Julia set z -> z^2 + c. The parameter c goes once round just inside the edge of the Mandelbrot main cardioid
// (c = 0.975 * (e^(ia) / 2 - e^(2ia) / 4)), so the set morphs from cauliflower to rabbit to basilica and back.
// Smooth escape counts on a log scale and 2x2 supersampling keep the fine edges from sparkling.
export default {
  name: 'Julia Fractal',
  ko: '줄리아 프랙털',
  frag: `
float julia(vec2 z, vec2 c) { // smooth escape count, or -1 when the orbit never escapes (inside the set)
  for (int i = 0; i < 300; i++) {
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    float r2 = dot(z, z);
    if (r2 > 256.0) return max(float(i) + 1.0 - log2(log2(r2) * 0.5), 0.0);
  }
  return -1.0;
}
void main() {
  float a = uPhase * TAU;
  vec2 c = 0.975 * (0.5 * vec2(cos(a), sin(a)) - 0.25 * vec2(cos(2.0 * a), sin(2.0 * a)));
  vec3 col = vec3(0.0);
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 uv = (2.0 * (gl_FragCoord.xy + vec2(i, j) * 0.5 - 0.25) - uRes) / uRes.x * 1.22;
    float n = julia(vec2(uv.y, -uv.x), c);                   // turned 90 degrees to fill the tall frame
    vec3 inside = mix(vec3(0.26, 0.05, 0.30), vec3(0.05, 0.02, 0.13), smoothstep(0.0, 1.6, length(uv)));
    if (n < 0.0) { col += inside; continue; }
    float k = log(n + 1.0);                                  // log scale: deep counts change colour slowly
    vec3 far = mix(vec3(0.03, 0.04, 0.12), vec3(0.08, 0.03, 0.16), 0.5 + 0.25 * uv.y);  // night blue far away
    vec3 c1 = mix(far, pal(0.38 * k + 0.1, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.12, 0.30)), smoothstep(0.0, 2.4, k));
    col += mix(c1, inside, smoothstep(24.0, 80.0, n));      // late escapers (thin filaments) blend into the inside
  }
  outColor = vec4(col / 4.0, 1.0);
}`,
};
