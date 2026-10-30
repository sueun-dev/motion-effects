// Apollonian fractal (sphere inversion): space is tiled into cubes (fract), then every point is inverted through
// a sphere (p *= s / |p|^2) and the scale is kept, eight times over. What is left is an endless cave of spheres
// packed inside spheres. The camera holds almost still (fine filigree crawls if it moves) while the sun swings
// across, so shadows slide over the pearls; an orbit trap paints copper filigree and far spheres fade into a
// lilac haze. Hits are settled onto the surface before shading so the big spheres do not band. 2x2 supersampling.
export default {
  name: 'Apollonian Fractal',
  ko: '아폴로니안 프랙털',
  frag: `
const float S = 1.15;
// distance to the fractal; trap = how close the folded point came to each axis and to the centre
float map(vec3 p, out vec4 trap) {
  float scale = 1.0;
  trap = vec4(1000.0);
  for (int i = 0; i < 8; i++) {
    p = -1.0 + 2.0 * fract(0.5 * p + 0.5);                  // fold space into a cube of side 2
    float r2 = dot(p, p);
    trap = min(trap, vec4(abs(p), r2));
    float k = S / r2;                                        // invert through the sphere of radius sqrt(S)
    p *= k;
    scale *= k;
  }
  return 0.25 * abs(p.y) / scale;
}
float map(vec3 p) { vec4 tr; return map(p, tr); }
vec3 normal(vec3 p, float e) {
  vec2 k = vec2(1, -1);
  return normalize(k.xyy * map(p + k.xyy * e) + k.yyx * map(p + k.yyx * e) + k.yxy * map(p + k.yxy * e) + k.xxx * map(p + k.xxx * e));
}
float shadow(vec3 ro, vec3 rd) {                            // soft shadow with the improved penumbra estimate (no banding)
  float res = 1.0, t = 0.01, ph = 1e10;
  for (int i = 0; i < 64; i++) {
    float h = map(ro + rd * t);
    float y = h * h / (2.0 * ph), d = sqrt(max(h * h - y * y, 0.0));
    res = min(res, 10.0 * d / max(t - y, 1e-4));
    ph = h;
    t += clamp(h, 0.004, 0.06);
    if (res < 0.005 || t > 1.2) break;
  }
  res = clamp(res, 0.0, 1.0);
  return res * res * (3.0 - 2.0 * res);
}
vec3 render(vec3 ro, vec3 rd, float pix) {
  vec3 haze = mix(vec3(0.55, 0.60, 0.82), vec3(0.85, 0.80, 0.92), clamp(0.5 + 0.5 * rd.y, 0.0, 1.0));   // cool distance
  float t = 0.005;
  vec4 tr;
  bool hit = false;
  for (int i = 0; i < 220; i++) {
    float h = map(ro + rd * t, tr);
    if (h < pix * t) { hit = true; break; }
    t += h;
    if (t > 6.0) break;
  }
  if (!hit) return haze;
  for (int i = 0; i < 24; i++) t += map(ro + rd * t);         // settle onto the surface: the DE bends off it, so normals band otherwise
  vec3 p = ro + rd * t, n = normal(p, pix * t * 3.0);
  float a = uPhase * TAU;
  vec3 l = normalize(vec3(0.40, 0.8, 0.45) + 0.75 * sin(a) * vec3(0.75, 0.0, -0.66));   // the sun swings across the camera's side
  float e = 0.02 + 0.02 * t, d0 = map(p);                   // measure from the hit itself, so the march's last step does not band
  float ao = clamp(0.5 + 0.5 * (map(p + n * e) + map(p + n * 2.0 * e) - 2.0 * d0) / (1.5 * e), 0.0, 1.0);
  float dif = max(dot(n, l), 0.0) * shadow(p + n * 0.004, l);
  vec3 base = vec3(0.96, 0.94, 0.90);
  base = mix(base, vec3(1.0, 0.72, 0.30), clamp(6.0 * tr.y, 0.0, 1.0));       // amber bands
  base = mix(base, vec3(0.95, 0.40, 0.22), pow(clamp(1.0 - 2.0 * tr.z, 0.0, 1.0), 8.0));  // coral rims
  vec3 sky = mix(vec3(0.42, 0.40, 0.52), vec3(0.85, 0.80, 0.85), 0.5 + 0.5 * n.y);
  vec3 col = base * (vec3(1.1, 0.96, 0.80) * dif + sky * 0.7 * ao) * (0.35 + 0.65 * ao);
  col += vec3(1.0, 0.9, 0.8) * pow(max(dot(reflect(-l, n), -rd), 0.0), 20.0) * dif * 0.25;
  return mix(col, haze, smoothstep(0.4, 3.0, t));            // far spheres melt into the haze
}
void main() {
  float a = uPhase * TAU;
  vec3 ro = vec3(2.55 + 0.007 * cos(a), 0.55 + 0.004 * sin(2.0 * a), 2.4 + 0.007 * sin(a));   // a tiny closed drift
  vec3 ta = vec3(1.35 + 0.007 * sin(a), 0.42, 1.05 + 0.007 * cos(a));
  vec3 fw = normalize(ta - ro), rt = normalize(cross(fw, vec3(0.01 * sin(a), 1, 0))), up = cross(rt, fw);
  float pix = 0.8 * 2.0 / uRes.x / 1.5;
  vec3 col = vec3(0.0);
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 uv = (2.0 * (gl_FragCoord.xy + vec2(i, j) * 0.5 - 0.25) - uRes) / uRes.x;
    col += render(ro, normalize(fw * 1.5 + rt * uv.x * 0.8 + up * uv.y * 0.8), pix);
  }
  col /= 4.0;
  outColor = vec4(pow(col, vec3(0.95)) + grain(gl_FragCoord.xy) / 255.0, 1.0);
}`,
};
