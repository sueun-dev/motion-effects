// Ordered dithering: a lit, spinning banded planet is reduced to two colours with an 8x8 Bayer threshold matrix that is
// fixed to the screen's 8 px "pixels"; grey levels become the familiar cross-hatched 1-bit patterns.
export default {
  name: 'Dithering',
  ko: '디더링',
  frag: `
const float P = 8.0; // size of one 1-bit pixel
float bayer8(ivec2 p) { // classic Bayer index 0..63 by bit interleaving, as a threshold 0..1
  p &= 7;
  int xy = p.x ^ p.y;
  int v = ((xy & 1) << 5) | ((p.y & 1) << 4) | ((xy & 2) << 2) | ((p.y & 2) << 1) | ((xy & 4) >> 1) | ((p.y & 4) >> 2);
  return (float(v) + 0.5) / 64.0;
}
// grey level of the scene at a point (y up, x -1..1): a banded planet against a dark sky
float scene(vec2 p) {
  vec2 c = vec2(0.0, 0.05);
  float R = 0.7, d = length(p - c);
  if (d > R) {
    float star = step(0.997, hash12(floor(p * 67.5))) * step(0.3, p.y);   // a few fixed stars up top
    return 0.3 * smoothstep(0.1, -1.9, p.y) + star;
  }
  vec3 n = vec3((p - c) / R, 0.0);
  n.z = sqrt(1.0 - dot(n.xy, n.xy));
  vec3 q = n;                                   // turn the surface: one full spin per loop around a tilted axis
  q.yz = rot(0.3) * q.yz;
  q.xz = rot(uPhase * TAU) * q.xz;
  float bands = smoothstep(-0.35, 0.35, sin(q.y * 6.0 + 1.0 * snoise(q * 1.5)));
  float spots = smoothstep(0.3, 0.42, snoise(q * 1.7 + 4.0));
  float albedo = 0.3 + 0.45 * bands + 0.4 * spots;
  float diff = max(dot(n, normalize(vec3(-0.5, 0.45, 0.75))), 0.0);
  return albedo * (0.03 + 1.1 * diff) + 0.5 * pow(1.0 - n.z, 4.0);   // plus a rim light on the edge
}
void main() {
  vec2 cell = floor(gl_FragCoord.xy / P);
  vec2 p = ((cell + 0.5) * P * 2.0 - uRes) / uRes.x;
  float on = step(bayer8(ivec2(cell)), scene(p));
  vec3 ink = vec3(0.11, 0.09, 0.22), light = vec3(0.98, 0.92, 0.78);
  outColor = vec4(mix(ink, light, on), 1.0);
}`,
};
