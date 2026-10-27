// Noise fire: three octaves of noise rise at different speeds (each periodic in y, read on a cylinder, so the upward
// scroll loops), carve a tapering flame shape, and map through a black-body ramp. Sparks rise on fixed paths.
export default {
  name: 'Fire',
  ko: '불꽃',
  frag: `
float rising(vec2 p, vec2 k, float P, float n) {
  float th = TAU * (p.y / P - n * uPhase), R = k.y * P / TAU;
  return snoise(vec3(p.x * k.x, R * cos(th), R * sin(th)));
}
vec3 ramp(float h) {
  h = clamp(h, 0.0, 1.0);
  return vec3(1.6 * h, 1.25 * h * h, 1.1 * pow(h, 5.0)) * smoothstep(0.0, 0.12, h);
}
void main() {
  vec2 p = (gl_FragCoord.xy - vec2(0.5 * uRes.x, 0.24 * uRes.y)) / uRes.x;   // flame base at the origin
  vec3 sky = mix(vec3(0.05, 0.03, 0.09), vec3(0.16, 0.06, 0.1), smoothstep(1.3, -0.3, p.y));
  vec3 col = sky + vec3(0.6, 0.2, 0.05) * 0.5 * exp(-dot(p * vec2(1.4, 2.2), p * vec2(1.4, 2.2)) * 3.0);   // warm glow

  float n = 0.55 * rising(p, vec2(3.0, 2.6), 1.2, 2.0) + 0.3 * rising(p + 3.1, vec2(6.0, 5.0), 0.6, 5.0)
          + 0.15 * rising(p + 7.7, vec2(12.0, 10.0), 0.3, 12.0);
  float y = p.y;
  float qx = p.x + 0.07 * n * smoothstep(0.0, 0.8, y);                  // licks sway sideways as they rise
  float w = 0.25 * (1.0 - smoothstep(-0.15, 0.85, y)) + 0.01;
  float body = 1.0 - abs(qx) / w;
  float heat = body * 0.75 + n * 0.55 - max(y, 0.0) * 0.8 + 0.3;
  heat *= smoothstep(-0.12, 0.02, y) * (1.0 - smoothstep(0.55, 1.0, y));  // fades into the logs and out at the top
  col += ramp(heat);

  // logs: two crossed dark rounded bars lit from the fire above
  for (int i = 0; i < 2; i++) {
    float s = i == 0 ? 1.0 : -1.0;
    vec2 q = rot(s * 0.32) * (p - vec2(0.0, -0.06));
    float d = length(vec2(max(abs(q.x) - 0.26, 0.0), q.y)) - 0.035;
    vec3 wood = mix(vec3(0.12, 0.05, 0.03), vec3(0.75, 0.3, 0.08), smoothstep(-0.03, 0.035, q.y) * 0.8);
    col = mix(col, wood, 1.0 - smoothstep(-0.003, 0.003, d));
  }
  // sparks: each rises along its own path, once (or twice) per loop, and fades out at the top
  for (int i = 0; i < 22; i++) {
    float fi = float(i), h = hash12(vec2(fi, 4.0));
    float k = fract(uPhase * (1.0 + floor(h * 2.0)) + hash12(vec2(fi, 9.0)));
    vec2 s = vec2(0.18 * (hash12(vec2(fi, 2.0)) - 0.5) + 0.06 * sin(k * 7.0 + fi), 0.05 + k * 1.1);
    s.x += 0.12 * (hash12(vec2(fi, 5.0)) - 0.5) * k;
    float g = exp(-dot(p - s, p - s) / 0.00003) + 0.3 * exp(-dot(p - s, p - s) / 0.0003);
    col += vec3(1.0, 0.62, 0.25) * 1.4 * g * smoothstep(0.0, 0.1, k) * (1.0 - k);
  }
  outColor = vec4(col, 1.0);
}`,
};
