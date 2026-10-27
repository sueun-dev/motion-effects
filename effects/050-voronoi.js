// Voronoi cells: one wandering point per grid square (looping sin paths); each pixel finds its nearest point,
// and a second pass gives the exact distance to the cell border (Inigo Quilez) for clean, even membranes.
export default {
  name: 'Voronoi',
  ko: '보로노이',
  frag: `
vec2 site(vec2 n) {
  vec2 h = hash22(n);
  float k = hash12(n + 7.7) < 0.5 ? 1.0 : -1.0;          // one turn per loop, either way round
  return 0.5 + 0.32 * vec2(sin(uPhase * TAU * k + TAU * h.x), cos(uPhase * TAU * k + TAU * h.y));
}
void main() {
  vec2 x = gl_FragCoord.xy / uRes.x * 5.0 + vec2(0.3, 0.2);
  vec2 n = floor(x), f = fract(x), mg, mr;
  float md = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(i, j), r = g + site(n + g) - f;
    float d = dot(r, r);
    if (d < md) { md = d; mr = r; mg = g; }
  }
  float edge = 8.0;
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
    vec2 g = mg + vec2(i, j), r = g + site(n + g) - f;
    if (dot(mr - r, mr - r) > 1e-5) edge = min(edge, dot(0.5 * (mr + r), normalize(r - mr)));
  }
  vec2 id = n + mg;
  float px = 5.0 / uRes.x;                                 // one pixel in cell units
  vec3 cell = pal(hash12(id * 1.3), vec3(0.62, 0.55, 0.62), vec3(0.32, 0.28, 0.25), vec3(1.0), vec3(0.0, 0.18, 0.40));
  float dist = length(mr);
  vec3 col = cell * (1.08 - 0.55 * dist);                  // brighter towards the middle
  col = mix(col, vec3(1.0, 0.97, 0.92), 0.35 * smoothstep(0.09, 0.0, edge));
  col = mix(vec3(0.10, 0.06, 0.16), col, smoothstep(0.025 - px, 0.025 + px, edge)); // the membrane
  float nuc = smoothstep(0.075 + px, 0.075 - px, dist);   // nucleus on each site
  col = mix(col, cell * 0.45, nuc);
  col = mix(col, vec3(1.0), smoothstep(0.03 + px, 0.03 - px, length(mr + vec2(0.02, -0.02))) * 0.6);
  outColor = vec4(col, 1.0);
}`,
};
