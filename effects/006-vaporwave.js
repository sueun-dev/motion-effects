// Synthwave: a striped sunset sun over neon-rimmed mountains and a perspective grid floor. The floor scrolls
// toward the camera by whole grid cells per loop; lines are anti-aliased with fwidth and fade where they get dense.
export default {
  name: 'Vaporwave',
  ko: '베이퍼웨이브',
  frag: `
float gridLine(float c, float wWorld) {
  float fw = fwidth(c), d = abs(fract(c - 0.5) - 0.5);
  float w = max(wWorld, fw * 1.3);
  return (1.0 - smoothstep(w - fw, w + fw, d)) * (1.0 - smoothstep(0.12, 0.4, fw));
}
void main() {
  vec2 p = (2.0 * gl_FragCoord.xy - uRes) / uRes.x;   // x -1..1, y -1.78..1.78
  const float HZ = -0.22;                              // horizon
  vec3 col;
  if (p.y > HZ) {
    float k = (p.y - HZ) / 1.9;
    col = mix(vec3(1.0, 0.36, 0.62), vec3(0.23, 0.05, 0.38), smoothstep(0.0, 0.55, k));
    col = mix(col, vec3(0.05, 0.01, 0.13), smoothstep(0.5, 1.0, k));
    vec2 cell = floor(p * 40.0);                       // fixed stars
    vec2 sp = (hash22(cell) - 0.5) * 0.8;
    float star = step(0.93, hash12(cell + 7.0)) * (1.0 - smoothstep(0.0, 0.035, length(fract(p * 40.0) - 0.5 - sp * 0.5)));
    col += star * smoothstep(0.25, 0.6, k) * 0.9;

    vec2 sc = vec2(0.0, HZ + 0.52); float R = 0.62;    // the sun
    float sd = length(p - sc) - R;
    float s = (p.y - sc.y) / R;
    float stripe = abs(fract(s * 7.0 - uPhase) - 0.5);  // gaps drift up one stripe per loop
    float gap = 0.22 * (1.0 - smoothstep(-0.9, 0.25, s));
    float sfw = fwidth(s * 7.0);
    float cut = smoothstep(gap - sfw, gap + sfw, stripe);
    vec3 sun = mix(vec3(1.0, 0.18, 0.55), vec3(1.0, 0.88, 0.32), smoothstep(-0.9, 0.8, s));
    float inSun = 1.0 - smoothstep(-fwidth(sd), fwidth(sd), sd);
    col += vec3(1.0, 0.3, 0.6) * 0.35 * exp(-max(sd, 0.0) * 5.0);
    col = mix(col, sun, inSun * cut);

    float ax = abs(p.x);                               // mountains on both sides with a neon rim
    float ridge = (0.05 + 0.42 * smoothstep(0.15, 1.0, ax)) * (0.55 + 0.45 * abs(sin(ax * 7.0 + 1.0)) + 0.15 * snoise(vec3(p.x * 4.0, 0.0, 1.0)));
    float md = p.y - (HZ + ridge);
    float mfw = fwidth(md);
    vec3 rock = mix(vec3(0.10, 0.02, 0.20), vec3(0.22, 0.05, 0.34), (p.y - HZ) / max(ridge, 0.01));
    col = mix(col, rock, 1.0 - smoothstep(-mfw, mfw, md));
    col += vec3(0.4, 0.9, 1.0) * (1.0 - smoothstep(0.0, mfw * 3.0, abs(md + mfw))) * 0.9;
  } else {
    float depth = 0.32 / (HZ - p.y);                   // camera height over the floor
    vec2 w = vec2(p.x * depth * 10.0, depth * 10.0 + uPhase * 4.0); // 4 whole cells per loop
    float lines = max(gridLine(w.x, 0.02), gridLine(w.y, 0.02));
    float near = smoothstep(0.0, 1.2, HZ - p.y);
    col = mix(vec3(0.35, 0.05, 0.40), vec3(0.12, 0.02, 0.22), smoothstep(0.0, 0.5, near));
    vec3 neon = mix(vec3(1.0, 0.25, 0.85), vec3(0.3, 0.85, 1.0), near);
    col += neon * lines * (0.6 + 0.6 * near);
    col += vec3(1.0, 0.3, 0.6) * 0.5 * exp(-(HZ - p.y) * 9.0);   // haze where the floor meets the sky
  }
  col += vec3(1.0, 0.5, 0.8) * 0.5 * exp(-abs(p.y - HZ) * 60.0); // bright horizon line
  outColor = vec4(col, 1.0);
}`,
};
