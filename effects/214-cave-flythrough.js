// Cave fly-through: a narrow sandstone slot cave raymarched as a distance field. Two walls meander along z, lean
// with height and are pushed in and out by fractal value noise; strata bands follow the rock. The path and the
// noise repeat every 16 units along z (the noise lattice wraps), and the camera flies exactly those 16 units per
// loop. Light falls in from the slit above and a dusty sunbeam hangs in the gap; each pixel averages 6 samples
// spread over space and over the frame's shutter time (motion blur).
export default {
  name: 'Cave Fly-through',
  ko: '동굴 비행',
  frag: `
const float L = 16.0;                                         // the cave repeats every L units along z
uint hashu(uvec3 q) { q = q * uvec3(1597334673u, 3812015801u, 2798796415u); return (q.x ^ q.y ^ q.z) * 1597334677u; }
// value noise 0..1 whose lattice wraps every per cells along z
float vnoise(vec3 x, float per) {
  vec3 i = floor(x), f = fract(x), u = f * f * (3.0 - 2.0 * f);
  uint z0 = uint(mod(i.z, per)), z1 = uint(mod(i.z + 1.0, per));
  uvec3 a = uvec3(ivec3(i.xy, 0) + 4096);
  #define H(dx, dy, z) float(hashu(uvec3(a.x + dx, a.y + dy, z)) >> 8) / 16777216.0
  return mix(mix(mix(H(0u, 0u, z0), H(1u, 0u, z0), u.x), mix(H(0u, 1u, z0), H(1u, 1u, z0), u.x), u.y),
             mix(mix(H(0u, 0u, z1), H(1u, 0u, z1), u.x), mix(H(0u, 1u, z1), H(1u, 1u, z1), u.x), u.y), u.z);
}
float fbm3(vec3 p) {                                          // frequency 0.5: 8 cells per L, so every octave wraps
  p *= 0.5;
  return 0.55 * vnoise(p, 8.0) + 0.28 * vnoise(p * 2.0, 16.0) + 0.14 * vnoise(p * 4.0, 32.0);
}
const float W = TAU / L;
// the middle of the slot at height y: it meanders along z and leans as it rises
float mid(float z, float y) { return 0.8 * sin(W * z) + 0.25 * sin(2.0 * W * z + 1.0) + 0.45 * (sin(W * z + 0.4 * y) - sin(W * z)); }
float map(vec3 p) {
  float hw = 1.25 + 0.16 * p.y * (0.6 + 0.4 * sin(W * p.z * 2.0 + 0.5 * p.y));   // wider higher up
  float wall = hw - abs(p.x - mid(p.z, p.y)) + 0.9 * (fbm3(p) - 0.45);
  return min(wall * 0.6, p.y + 0.15 * fbm3(p * 2.0));        // walls and a sandy floor (x2 keeps the wrap)
}
vec3 normal(vec3 p) {
  vec2 k = vec2(1, -1) * 0.015;
  return normalize(k.xyy * map(p + k.xyy) + k.yyx * map(p + k.yyx) + k.yxy * map(p + k.yxy) + k.xxx * map(p + k.xxx));
}
// a dusty sunbeam: a slanted shaft that comes down through the slit once every L units; only the part in front of
// the first wall the ray hits (tmax) glows, brighter near the top
float beam(vec3 ro, vec3 rd, float tmax) {
  vec3 dir = normalize(vec3(0.15, 1.0, 0.35));
  float g = 0.0, b = dot(rd, dir);
  for (int k = -1; k <= 1; k++) {                             // the beam of this repeat and its neighbours
    float cz = -6.0 + L * (float(k) + floor((ro.z + 6.0) / L));
    vec3 w0 = ro - vec3(mid(cz, 3.0), 3.0, cz);
    float d = dot(rd, w0), e = dot(dir, w0), den = max(1.0 - b * b, 1e-4);
    float tc = (b * e - d) / den, sc = (e - b * d) / den;     // closest points on the view ray and on the beam axis
    float dist = length(w0 + rd * tc - dir * sc), y = 3.0 + dir.y * sc;
    if (tc > 0.0 && tc < tmax) g += exp(-dist * dist * 6.0) * 0.4 * smoothstep(-0.5, 6.0, y);
  }
  return g;
}
vec3 render(vec3 ro, vec3 rd) {
  vec3 sky = vec3(1.0, 0.92, 0.80) * 1.4;
  float t = 0.02;
  bool hit = false;
  for (int i = 0; i < 120; i++) {
    float h = map(ro + rd * t);
    if (h < 0.0015 * t) { hit = true; break; }
    t += h;
    if (t > 40.0 || (ro + rd * t).y > 9.0) break;
  }
  vec3 haze = vec3(0.95, 0.55, 0.32);
  float shaft = beam(ro, rd, hit ? t : 1e3);
  if (!hit) return mix(haze, sky, smoothstep(5.0, 9.0, (ro + rd * t).y)) + vec3(1.0, 0.8, 0.55) * shaft;
  vec3 p = ro + rd * t, n = normal(p);
  float high = smoothstep(-0.5, 8.0, p.y);                    // light comes in from the slit above
  float ao = clamp(0.3 + 0.7 * map(p + n * 0.35) / 0.35, 0.0, 1.0);
  float band = fbm3(vec3(p.x * 0.3, p.y * 3.2, p.z)) + 0.3 * p.y;   // strata that follow the height (z unscaled keeps the wrap)
  vec3 rock = mix(vec3(0.78, 0.30, 0.14), vec3(1.0, 0.62, 0.36), 0.5 + 0.5 * sin(band * 7.0));
  rock = mix(rock, vec3(0.62, 0.20, 0.22), smoothstep(0.6, 1.0, sin(band * 3.0 + 1.0)) * 0.5);
  if (p.y < 0.2) rock = vec3(1.0, 0.74, 0.52);                 // pale sand
  // bounced light: violet low down, deep orange in the middle, near white under the slit
  vec3 lit = mix(vec3(0.78, 0.46, 0.66), vec3(1.3, 0.75, 0.45), smoothstep(0.0, 0.55, high));
  lit = mix(lit, vec3(2.0, 1.75, 1.35), smoothstep(0.5, 1.0, high)) * (0.7 + 0.3 * max(n.y, 0.0));
  if (p.y < 0.2) lit = mix(lit, vec3(1.15, 0.92, 0.70), 0.65);   // the sand floor catches warmer light
  vec3 col = rock * lit * ao;
  col += vec3(1.0, 0.85, 0.65) * pow(max(dot(reflect(rd, n), vec3(0, 1, 0)), 0.0), 12.0) * 0.25 * high;
  col = mix(col, haze * 0.8, 1.0 - exp(-0.06 * t));
  return col + vec3(1.0, 0.8, 0.55) * shaft;
}
void main() {
  vec3 col = vec3(0.0);
  for (int k = 0; k < 6; k++) {
    float fk = float(k);
    vec2 jit = vec2(fract(fk * 0.618 + 0.25), fract(fk * 0.382 + 0.6)) - 0.5;   // spread over the pixel
    float t = uTime + ((fk + 0.5) / 6.0 - 0.5) * 0.5 / 30.0;   // and over half the frame time: motion blur
    float z = -L * t / 5.0;                                   // exactly one repeat per loop
    vec3 ro = vec3(mid(z, 1.4), 1.4, z);
    vec3 ta = vec3(mid(z - 5.0, 2.6), 2.6, z - 5.0);
    vec3 fw = normalize(ta - ro), rt = normalize(cross(fw, vec3(0.1 * sin(TAU * t / 5.0), 1, 0))), up = cross(rt, fw);
    vec2 uv = (2.0 * (gl_FragCoord.xy + jit) - uRes) / uRes.x;
    col += render(ro, normalize(fw * 1.2 + rt * uv.x * 0.8 + up * uv.y * 0.8));
  }
  col /= 6.0;
  col = col / (1.0 + 0.3 * col);
  outColor = vec4(pow(col, vec3(0.92)) + grain(gl_FragCoord.xy) / 255.0, 1.0);
}`,
};
