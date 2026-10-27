// Domain warping (after Inigo Quilez): f(p + k * r), r = f(p + k * q), q = f(p) with f = fbm noise. Each layer
// bends the coordinates of the next (marble / smoke swirls). The warp multiplies any motion of the inner layers
// many times, so their noise lookups only circle a small loop each 5 s.
export default {
  name: 'Domain Warping',
  ko: '도메인 워핑',
  frag: `
float fbmN(vec3 p, int n) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { if (i >= n) break; s += a * snoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; }
  return s;
}
void main() {
  vec2 p = (2.0 * gl_FragCoord.xy - uRes) / uRes.x * 0.9; // x -0.9..0.9
  vec2 L = loopXY(1.0);
  vec2 q = vec2(fbmN(vec3(p + 0.07 * L, 0.0), 2), fbmN(vec3(p + vec2(5.2, 1.3) - 0.07 * L.yx, 1.7), 2));
  vec2 r = vec2(fbmN(vec3(p + 1.6 * q + vec2(1.7, 9.2), 0.04 * L.x), 3), fbmN(vec3(p + 1.6 * q + vec2(8.3, 2.8), 0.04 * L.y), 3));
  float f = 0.5 + 0.5 * fbmN(vec3(p + 1.6 * r, 2.4), 4);

  vec3 col = mix(vec3(0.04, 0.06, 0.18), vec3(0.12, 0.48, 0.58), smoothstep(0.25, 0.75, f)); // ink -> teal
  col = mix(col, vec3(0.98, 0.58, 0.34), smoothstep(0.2, 0.75, length(q)) * 0.8);           // warm veins
  col = mix(col, vec3(0.99, 0.94, 0.85), smoothstep(0.3, 0.75, abs(r.x)) * 0.75);           // creamy marble
  col *= 0.6 + 0.7 * f;
  vec2 v = p * vec2(0.8, 0.45);
  outColor = vec4(col * (1.0 - 0.4 * dot(v, v)), 1.0);
}`,
};
