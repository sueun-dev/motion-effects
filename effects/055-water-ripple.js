// Water ripple: five drops each send out a ring wave twice per loop; the summed height field's slope bends the
// texture lookup (refraction) and lights a specular glint, so the sunset picture underneath wobbles inside the rings.
import { landscape } from '../lib/scenes.js';

export default {
  name: 'Water Ripple',
  ko: '물결 파문',
  tex: (ctx, t, W, H) => landscape(ctx, W, H, t),
  frag: `
float drop(vec2 p, float i) {
  float k = uPhase * 2.0 + i / 5.0;           // two drops per loop at each spot, staggered
  float a = fract(k), n = mod(floor(k), 2.0); // n picks one of two positions for alternate drops
  vec2 c = vec2(0.16 + 0.68 * hash12(vec2(i, n)), 0.35 + 1.15 * hash12(vec2(i + 7.0, n + 3.0)));
  float r = length(p - c);
  float R = 0.04 + 0.62 * a;                  // the ring front
  float x = r - R;
  float wave = sin(x * 60.0) * exp(-x * x * (x > 0.0 ? 700.0 : 40.0));   // sharp front, softer rings behind
  return wave * smoothstep(0.0, 0.08, a) * (1.0 - a) * (1.0 - a) / (0.6 + 4.0 * R);
}
float height(vec2 p) {
  float h = 0.0;
  for (int i = 0; i < 5; i++) h += drop(p, float(i));
  return h;
}
void main() {
  vec2 p = gl_FragCoord.xy / uRes.x;   // x 0..1, y 0..1.78
  float e = 0.0015;
  vec2 g = vec2(height(p + vec2(e, 0)) - height(p - vec2(e, 0)), height(p + vec2(0, e)) - height(p - vec2(0, e))) / (2.0 * e);
  vec2 uv = gl_FragCoord.xy / uRes + g * vec2(1.0, uRes.x / uRes.y) * 0.0011;
  vec3 col = texture(uTex, uv).rgb;
  vec3 n = normalize(vec3(-g * 0.012, 1.0));
  vec3 l = normalize(vec3(-0.4, 0.6, 0.7));
  float spec = pow(max(dot(reflect(-l, n), vec3(0, 0, 1)), 0.0), 60.0);
  float h = height(p);
  col *= 1.0 + 0.006 * dot(g, vec2(-0.5, 0.8)) + 0.35 * h;   // slopes facing the light and crests are brighter
  col += vec3(1.0, 0.95, 0.85) * spec * 0.9;
  outColor = vec4(col, 1.0);
}`,
};
