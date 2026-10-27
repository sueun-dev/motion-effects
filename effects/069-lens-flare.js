// Lens flare: a bright light circles the sky; ghosts (hexagonal aperture reflections) sit on the line from the light
// through the frame centre at fixed ratios, so they swing to the opposite side. Plus a starburst, halo and streak.
export default {
  name: 'Lens Flare',
  ko: '렌즈 플레어',
  frag: `
float hexagon(vec2 p, float r) {   // distance to a regular hexagon
  p = abs(p);
  return max(dot(p, vec2(0.866, 0.5)), p.y) - r;
}
void main() {
  vec2 res = uRes / uRes.x;
  vec2 p = gl_FragCoord.xy / uRes.x;              // x 0..1, y 0..1.78
  vec2 C = res * 0.5;
  float a = uPhase * TAU;
  vec2 L = C + vec2(0.3 * cos(a), 0.28 + 0.22 * sin(a));   // the light circles above the middle

  // dusk sky, a few fixed stars and a mountain line
  vec3 col = mix(vec3(0.1, 0.05, 0.18), vec3(0.02, 0.04, 0.12), smoothstep(0.2, 1.6, p.y));
  vec2 sg = floor(gl_FragCoord.xy / 6.0);
  col += vec3(0.8) * step(0.997, hash12(sg)) * smoothstep(0.6, 1.2, p.y);
  float ridge = 0.34 + 0.06 * sin(p.x * 6.0 + 1.3) + 0.025 * sin(p.x * 17.0);
  col = mix(col, vec3(0.03, 0.02, 0.06), smoothstep(ridge + 0.002, ridge - 0.002, p.y));

  vec2 d = p - L;
  float r = length(d);
  // the light: core, glow, starburst rays and a horizontal anamorphic streak
  col += vec3(1.0, 0.95, 0.85) * (0.012 / (r + 0.012));
  col += vec3(1.0, 0.7, 0.4) * 0.35 * exp(-r * 6.0);
  float ang = atan(d.y, d.x);
  col += vec3(1.0, 0.85, 0.7) * 0.25 * pow(abs(cos(ang * 6.0)), 40.0) * exp(-r * 5.0);
  col += vec3(0.45, 0.65, 1.0) * 0.6 * exp(-abs(d.y) * 260.0) * exp(-abs(d.x) * 2.2);
  // a rainbow halo ring around the light
  float halo = exp(-pow((r - 0.26) * 30.0, 2.0));
  col += pal(r * 3.0, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67)) * halo * 0.12;

  // ghosts along the line light -> centre -> beyond
  vec2 axis = C - L;
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float s = vec4(0.55, 0.9, 1.25, 1.7)[i % 4] + (i >= 4 ? 0.4 : 0.0) * fi / 6.0 - (i == 6 ? 1.9 : 0.0);
    vec2 g = L + axis * (1.0 + s);
    float size = 0.025 + 0.05 * hash12(vec2(fi, 3.0));
    float h = hexagon(rot(0.3) * (p - g), size);
    float body = smoothstep(0.006, -0.006, h) * 0.6 + smoothstep(0.004, -0.002, abs(h + 0.003)) * 0.5;
    vec3 tint = pal(fi * 0.17 + 0.1, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
    col += tint * body * 0.3;
  }
  // a big soft ring ghost on the far side
  vec2 g2 = L + axis * 2.0;
  col += vec3(0.4, 0.9, 0.7) * 0.08 * exp(-pow((length(p - g2) - 0.12) * 45.0, 2.0));
  col = 1.0 - exp(-col * 1.4);   // soft tone curve so bright parts do not clip hard
  outColor = vec4(col, 1.0);
}`,
};
