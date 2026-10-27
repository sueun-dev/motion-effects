// Moire: two identical fine patterns printed on top of each other, slightly out of step, make large interference
// bands. Top: two line gratings 4 degrees apart; bottom: two ring sets with offset centres. One layer of each slides
// by whole line spacings per loop, so every pixel changes slowly while the bands sweep far. Lines use fwidth AA.
export default {
  name: 'Moiré',
  ko: '무아레',
  frag: `
const float P = 16.0; // line spacing in px
float ink(float d) {    // 1 on a line, 0 between; lines take a bit under half
  float v = cos(TAU * d / P);
  float w = fwidth(v) * 0.8 + 1e-4;
  return smoothstep(0.15 - w, 0.15 + w, v);
}
float lines(vec2 p, float ang, float shift) { return ink(dot(p, vec2(cos(ang), sin(ang))) - shift); }
float rings(vec2 p, vec2 c, float shift) { return ink(length(p - c) - shift); }
void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);   // top-left origin
  vec2 top = vec2(540.0, 680.0), bot = vec2(540.0, 1440.0);
  float R = 340.0, s = uPhase * P;
  vec3 paper = mix(vec3(0.99, 0.94, 0.86), vec3(0.92, 0.89, 0.99), p.y / uRes.y);
  vec3 navy = vec3(0.10, 0.10, 0.28);
  float k = 0.0, edge = 1e9;
  float dt = length(p - top), db = length(p - bot);
  if (dt < R + 4.0) k = 1.0 - (1.0 - lines(p - top, 0.6, 0.0)) * (1.0 - lines(p - top, 0.67, 2.0 * s));
  if (db < R + 4.0) k = 1.0 - (1.0 - rings(p, bot - vec2(46.0, 0.0), -s)) * (1.0 - rings(p, bot + vec2(46.0, 0.0), 2.0 * s));
  float inside = 1.0 - smoothstep(R - 1.5, R + 1.5, min(dt, db));
  vec3 col = paper * (1.0 - 0.07 * smoothstep(R + 70.0, R, min(dt, db)));     // soft shadow under each disc
  col = mix(col, mix(vec3(0.99, 0.97, 0.93), navy, k), inside);
  col = mix(col, navy, 1.0 - smoothstep(2.0, 4.0, abs(min(dt, db) - R - 2.0))); // rim
  outColor = vec4(col, 1.0);
}`,
};
