// Demoscene plasma: four sine fields (two straight waves, a diagonal and a moving ring) are summed and the
// sum is run through a cycling rainbow palette. Every time term is a whole multiple of the loop angle.
export default {
  name: 'Plasma',
  ko: '플라스마',
  frag: `
void main() {
  vec2 p = (2.0 * gl_FragCoord.xy - uRes) / uRes.x * 3.2; // x -3.2..3.2
  float a = uPhase * TAU;
  float v = sin(p.x * 1.1 + a);
  v += sin(p.y * 0.9 - a);
  v += sin((p.x + p.y) * 0.7 + a);
  vec2 c = p + vec2(2.4 * sin(a), 3.6 * cos(a));
  v += sin(length(c) * 1.6 - a);
  vec3 col = 0.5 + 0.5 * cos(PI * v * 0.5 + vec3(0.0, 2.1, 4.2) + a); // rainbow that keeps cycling
  col = mix(col, col * col, 0.35);                                       // a little richer
  float vig = 1.0 - 0.25 * dot(p / vec2(3.2, 5.7), p / vec2(3.2, 5.7));
  outColor = vec4(col * vig, 1.0);
}`,
};
