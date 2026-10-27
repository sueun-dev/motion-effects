// Mesh gradient: four colour points drift on looping paths and blend; a fixed grain sits on top (it never changes).
export default {
  name: 'Grainy Gradient',
  ko: '그레이니 그라디언트',
  frag: `
void main() {
  vec2 p = gl_FragCoord.xy / uRes.x;               // x 0..1, y 0..1.78
  vec2 L = loopXY(0.5);
  p += 0.18 * vec2(snoise(vec3(p * 1.4, 0.0) + vec3(L, 0.0)), snoise(vec3(p * 1.4 + 9.0, 0.0) + vec3(L, 0.0)));
  float a = uPhase * TAU;
  vec2 pts[4] = vec2[4](
    vec2(0.20 + 0.18 * cos(a), 1.35 + 0.20 * sin(a)),
    vec2(0.85 + 0.12 * cos(a + 2.0), 1.10 + 0.25 * sin(2.0 * a)),
    vec2(0.30 + 0.20 * sin(a), 0.45 + 0.18 * cos(a)),
    vec2(0.75 + 0.15 * cos(2.0 * a + 1.0), 0.35 + 0.20 * sin(a + 1.0)));
  vec3 cols[4] = vec3[4](vec3(0.98, 0.55, 0.32), vec3(0.95, 0.35, 0.62), vec3(0.42, 0.36, 0.95), vec3(0.62, 0.30, 0.85));
  vec3 col = vec3(0.0); float wsum = 0.0;
  for (int i = 0; i < 4; i++) {
    float d = distance(p, pts[i]);
    float w = 1.0 / pow(d * d + 0.02, 1.6);
    col += w * cols[i]; wsum += w;
  }
  col /= wsum;
  col += grain(gl_FragCoord.xy / 2.0) * 0.11;
  outColor = vec4(col, 1.0);
}`,
};
