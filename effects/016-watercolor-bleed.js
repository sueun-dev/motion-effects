// Watercolour: six drops land one after another; each wet front spreads along a ragged noise boundary, pigment
// piles up at the edge (darker rim), colours multiply where they overlap, and each drop fades before it lands again.
// The paper texture and granulation are fixed noise on the page (they never change from frame to frame).
export default {
  name: 'Watercolor Bleed',
  ko: '수채화 번짐',
  frag: `
void main() {
  vec2 p = (2.0 * gl_FragCoord.xy - uRes) / uRes.x;
  float paper = fbm(vec3(p * 11.0, 1.0));
  vec3 col = vec3(0.975, 0.955, 0.915) * (0.975 + 0.03 * paper) + grain(gl_FragCoord.xy) * 0.03;

  vec2 cs[6] = vec2[6](vec2(-0.35, 0.70), vec2(0.38, 0.45), vec2(-0.25, -0.05), vec2(0.42, -0.35), vec2(-0.30, -0.80), vec2(0.20, -1.05));
  vec3 ink[6] = vec3[6](vec3(0.20, 0.38, 0.85), vec3(0.92, 0.32, 0.48), vec3(0.98, 0.78, 0.22), vec3(0.15, 0.62, 0.60), vec3(0.55, 0.32, 0.80), vec3(0.96, 0.50, 0.22));
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float u = fract(uPhase - fi / 6.0);                 // this drop's age, 0..1, one life per loop
    float grow = 1.0 - pow(1.0 - min(u / 0.6, 1.0), 3.0);
    float alive = 1.0 - smoothstep(0.80, 0.98, u);
    float R = (0.34 + 0.1 * mod(fi * 1.7, 1.0)) * grow;
    vec2 q = p - cs[i];
    float rag = fbm(vec3(p * 2.6 + fi * 13.0, 2.0)) * (0.35 + 0.25 * grow);   // ragged wet front, fixed on the paper
    float d = length(q) - R * (1.0 + rag);
    float inside = 1.0 - smoothstep(-0.004, 0.004, d);
    float rim = smoothstep(-0.06, 0.0, d);                                   // pigment collects at the drying edge
    float gran = 0.8 + 0.35 * fbm(vec3(p * 14.0 + fi, 4.0)) + 0.25 * paper;   // granulation in the paper's tooth
    float dens = (0.45 + 0.6 * rim + 0.4 * (1.0 - grow) * exp(-length(q) * 8.0)) * gran;
    col *= mix(vec3(1.0), ink[i], clamp(dens, 0.0, 1.0) * inside * alive);
  }
  outColor = vec4(col, 1.0);
}`,
};
