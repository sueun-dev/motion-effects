// Thin-film iridescence: soap bubbles (analytic spheres) whose colour is light interference in a water film a few
// hundred nanometres thick. For 16 wavelengths the shader sums the Airy reflectance of the film, R = 2r²(1 − cos δ) /
// (1 − 2r² cos δ + r⁴) with δ = 4π n d cos θt / λ, and turns the spectrum into RGB with CIE colour-matching curves.
// The film drains (thin and dark on top, thick below) and swirls; front and back walls both reflect. 2x2 samples.
export default {
  name: 'Thin-Film Iridescence',
  ko: '박막 간섭',
  frag: `
// CIE 1931 colour matching, multi-lobe fit (Wyman, Sloan & Shirley 2013)
float g(float x, float mu, float s1, float s2) { float s = x < mu ? s1 : s2; float k = (x - mu) / s; return exp(-0.5 * k * k); }
vec3 cmf(float l) {
  return vec3(1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2),
              0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1),
              1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8));
}
vec3 xyz2rgb(vec3 c) {
  return vec3(3.2406 * c.x - 1.5372 * c.y - 0.4986 * c.z, -0.9689 * c.x + 1.8758 * c.y + 0.0415 * c.z, 0.0557 * c.x - 0.2040 * c.y + 1.0570 * c.z);
}
// reflectance of a soap film (n = 1.33) of thickness d nm in air, seen at cos(angle) ci, as linear RGB
vec3 film(float d, float ci) {
  float n = 1.33, ct = sqrt(1.0 - (1.0 - ci * ci) / (n * n));
  float rs = (ci - n * ct) / (ci + n * ct), rp = (n * ci - ct) / (n * ci + ct);
  vec3 sum = vec3(0.0), white = vec3(0.0);
  for (int i = 0; i < 16; i++) {
    float l = 395.0 + float(i) * 20.0;
    float cd = cos(4.0 * PI * n * d * ct / l);
    float s2 = rs * rs, p2 = rp * rp;
    float R = 0.5 * (2.0 * s2 * (1.0 - cd) / (1.0 - 2.0 * s2 * cd + s2 * s2) + 2.0 * p2 * (1.0 - cd) / (1.0 - 2.0 * p2 * cd + p2 * p2));
    vec3 c = cmf(l);
    sum += R * c; white += c;
  }
  return max(xyz2rgb(sum), 0.0) / xyz2rgb(white);
}
// the studio around the bubbles: a dim room, a big white softbox up left, a warm strip on the right, a cool floor
vec3 env(vec3 d) {
  vec3 c = mix(vec3(0.05, 0.06, 0.1), vec3(0.85, 0.9, 1.05), smoothstep(-0.3, 0.9, d.y));
  vec3 k = normalize(vec3(-0.55, 0.55, 0.62));
  vec3 q = d / max(dot(d, k), 0.01), u = normalize(cross(k, vec3(0, 1, 0))), v = cross(u, k);
  vec2 b = abs(vec2(dot(q, u), dot(q, v))) - vec2(0.38, 0.26);
  c += vec3(9.0) * smoothstep(0.04, 0.0, max(b.x, b.y)) * step(0.0, dot(d, k));
  vec3 k2 = normalize(vec3(0.85, 0.1, 0.5));
  vec3 side = normalize(cross(k2, vec3(0, 1, 0)));
  c += vec3(4.0, 2.4, 1.2) * smoothstep(0.06, 0.0, abs(dot(d, side)) - 0.05) * smoothstep(0.3, 0.6, dot(d, k2)) * smoothstep(0.75, 0.35, abs(d.y));
  return c;
}
// film thickness (nm) on a bubble: drains from ~120 nm on top to ~950 nm below, stirred by slow looping swirls
float fbm3(vec3 p) { return 0.5 * snoise(p) + 0.25 * snoise(p * 2.03) + 0.125 * snoise(p * 4.01); }
float thickness(vec3 q, float k) {
  float a = uPhase * TAU;
  vec3 o = vec3(0.22 * cos(a + k), 0.22 * sin(a + k), k * 3.1);   // a circle through the noise: the swirls loop
  vec3 w = q;
  w.xz = rot(0.35 * sin(a + k * 1.7)) * w.xz;                       // the film sways round the bubble and back
  w += 0.4 * vec3(snoise(w * 1.2 + o), snoise(w * 1.2 + o + 5.2), snoise(w * 1.2 + o + 9.7));
  return max(mix(120.0, 950.0, smoothstep(0.95, -0.9, q.y)) + 280.0 * fbm3(w * 1.5 + o), 0.0);
}
const int N = 8;
vec4 bubble(int i, float a) {                                       // centre xyz, radius
  vec4 b[N] = vec4[N](vec4(0.3, 0.1, 0.0, 1.9), vec4(-2.3, 3.3, -1.0, 1.05), vec4(2.4, -2.7, 0.5, 0.85), vec4(-2.5, -1.6, 1.0, 0.55),
                      vec4(2.6, 2.7, -0.5, 0.5), vec4(-0.9, -4.7, 0.0, 1.0), vec4(1.1, 3.8, 0.8, 0.36), vec4(2.1, -5.6, 0.3, 0.55));
  vec4 c = b[i];
  float k = float(i);
  c.x += 0.3 * sin(a + k * 1.3);
  c.y += 0.35 * sin(2.0 * a + k * 0.7);
  c.z += 0.4 * cos(a + k);
  return c;
}
vec3 render(vec2 uv) {
  float a = uPhase * TAU;
  vec3 ro = vec3(0.0, 0.0, 10.0), rd = normalize(vec3(uv * 0.42, -1.0));
  // backdrop: deep navy with a soft violet glow behind the big bubble
  vec3 bg = mix(vec3(0.012, 0.014, 0.03), vec3(0.03, 0.035, 0.08), smoothstep(-0.8, 0.6, uv.y));
  bg += vec3(0.07, 0.04, 0.12) * exp(-dot(uv - vec2(0.1, 0.05), uv - vec2(0.1, 0.05)) * 1.6);
  vec3 col = vec3(0.0), through = vec3(1.0);
  for (int i = 0; i < N; i++) {
    vec4 b = bubble(i, a);
    vec3 oc = ro - b.xyz;
    float bb = dot(oc, rd), h = bb * bb - dot(oc, oc) + b.w * b.w;
    if (h <= 0.0) continue;
    h = sqrt(h);
    for (int s = 0; s < 2; s++) {                                  // the near wall, then the far wall from inside
      vec3 p = ro + rd * (-bb + (s == 0 ? -h : h)), q = (p - b.xyz) / b.w;
      vec3 n = s == 0 ? q : -q;
      float ci = clamp(dot(-rd, n), 0.02, 1.0);
      vec3 R = film(thickness(q, float(i)), ci);
      col += through * R * env(reflect(rd, n));
      through *= 1.0 - R;
    }
  }
  return col + through * bg;
}
void main() {
  vec3 col = vec3(0.0);
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 uv = (2.0 * (gl_FragCoord.xy + vec2(i, j) * 0.5 - 0.25) - uRes) / uRes.x;
    col += render(uv);
  }
  col /= 4.0;
  col = col * (2.51 * col + 0.03) / (col * (2.43 * col + 0.59) + 0.14);
  outColor = vec4(pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2)) + grain(gl_FragCoord.xy) / 255.0, 1.0);
}`,
};
