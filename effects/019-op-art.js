// Op art: black and white bands whose phase is bent by travelling waves and two drifting bulges, so the stripes
// seem to swell and squirm. Edges are anti-aliased with fwidth; bands stay wide enough never to shimmer.
export default {
  name: 'Op Art',
  ko: '옵아트',
  frag: `
void main() {
  vec2 p = (2.0 * gl_FragCoord.xy - uRes) / uRes.x;
  float a = uPhase * TAU;
  vec2 c1 = vec2(0.35 * cos(a), 0.45 + 0.35 * sin(a));
  vec2 c2 = vec2(-0.4 * cos(a + 1.0), -0.7 + 0.3 * sin(2.0 * a));
  float v = p.y * 11.0;
  v += 1.3 * sin(p.x * 3.2 + a) * cos(p.y * 1.4 - a);            // a slow wave rolls through the bands
  v += 0.6 * sin(p.x * 6.0 - a + p.y * 2.0);
  v += 4.0 * exp(-dot(p - c1, p - c1) * 5.0);                    // bulges that push the bands apart
  v -= 3.5 * exp(-dot(p - c2, p - c2) * 6.0);
  float s = sin(v * PI);
  float w = fwidth(s) * 0.8;
  float ink = smoothstep(-w, w, s);
  vec3 col = mix(vec3(0.05, 0.05, 0.06), vec3(0.96, 0.95, 0.92), ink);
  outColor = vec4(col, 1.0);
}`,
};
