// Metaballs: six blobs on looping paths add up to one field; where it passes a threshold the liquid surface
// is shaded like glossy goo (normal from the field gradient), so touching blobs melt into each other.
export default {
  name: 'Liquid Motion',
  ko: '리퀴드 모션',
  frag: `
float field(vec2 p) {
  float a = uPhase * TAU, f = 0.0;
  for (int i = 0; i < 6; i++) {
    float k = float(i);
    vec2 c = vec2(0.30 * cos(a * (1.0 + mod(k, 2.0)) + k * 1.7), 0.55 * sin(a + k * 2.1) + 0.12 * sin(2.0 * a + k));
    float r = 0.13 + 0.04 * sin(k * 3.1);
    f += r * r / dot(p - c, p - c);
  }
  return f;
}
void main() {
  vec2 p = (2.0 * gl_FragCoord.xy - uRes) / uRes.x;   // x -1..1, y -1.78..1.78
  vec3 bg = mix(vec3(0.06, 0.04, 0.14), vec3(0.16, 0.07, 0.24), gl_FragCoord.y / uRes.y);
  float f = field(p);
  float e = 0.004;
  vec2 g = vec2(field(p + vec2(e, 0)) - field(p - vec2(e, 0)), field(p + vec2(0, e)) - field(p - vec2(0, e))) / (2.0 * e);
  vec3 n = normalize(vec3(-g * 0.06, 1.0));
  vec3 l = normalize(vec3(-0.5, 0.7, 0.6));
  float diff = max(dot(n, l), 0.0);
  float spec = pow(max(dot(reflect(-l, n), vec3(0, 0, 1)), 0.0), 40.0);
  float rim = pow(1.0 - n.z, 2.0);
  vec3 base = mix(vec3(0.42, 0.30, 1.0), vec3(1.0, 0.36, 0.72), 0.5 + 0.5 * p.y / 1.6);
  vec3 col = base * (0.35 + 0.75 * diff) + spec * 0.9 + rim * vec3(0.5, 0.9, 1.0) * 0.6;
  float edge = smoothstep(0.98, 1.04, f);
  float glow = smoothstep(0.35, 1.0, f) * 0.35;
  outColor = vec4(mix(bg + base * glow * 0.5, col, edge), 1.0);
}`,
};
