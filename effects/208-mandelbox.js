// Mandelbox: every point is folded into a box (clamp and reflect), folded through a sphere (inverted inside
// radius 0.5) and scaled by -1.8, ten times over; the distance estimate of the result is raymarched. A warm key
// light circles the box so its shadow sweeps the floor while the camera sways a little; an orbit trap colours
// the folds brass and ivory. Hits stop at one pixel of precision and normals span 3 pixels, so the finest folds
// do not sparkle; 3x3 supersampling.
export default {
  name: 'Mandelbox',
  ko: '만델박스',
  frag: `
const float SCALE = -1.8, MINR2 = 0.25, FLOOR = -2.75;
// distance to the Mandelbox; trap = how close the folded point came to the origin (for colour)
float map(vec3 p, out float trap) {
  vec4 z = vec4(p, 1.0), c = z;
  vec4 s = vec4(vec3(SCALE), abs(SCALE)) / MINR2;
  trap = 1e9;
  for (int i = 0; i < 10; i++) {
    z.xyz = clamp(z.xyz, -1.0, 1.0) * 2.0 - z.xyz;           // box fold
    float r2 = dot(z.xyz, z.xyz);
    z *= clamp(max(MINR2 / r2, MINR2), 0.0, 1.0);            // sphere fold
    z = z * s + c;
    if (i < 3) trap = min(trap, r2);                          // the first folds only: big, calm colour regions
  }
  return (length(z.xyz) - abs(SCALE - 1.0)) / z.w - pow(abs(SCALE), -9.0);
}
float map(vec3 p) { float tr; return map(p, tr); }
vec3 normal(vec3 p, float e) {
  vec2 k = vec2(1, -1);
  return normalize(k.xyy * map(p + k.xyy * e) + k.yyx * map(p + k.yyx * e) + k.yxy * map(p + k.yxy * e) + k.xxx * map(p + k.xxx * e));
}
float shadow(vec3 ro, vec3 rd) {
  float res = 1.0, t = 0.02;
  for (int i = 0; i < 48; i++) { float h = map(ro + rd * t); res = min(res, 10.0 * h / t); t += clamp(h, 0.01, 0.3); if (res < 0.01 || t > 10.0) break; }
  return clamp(res, 0.0, 1.0);
}
float occlusion(vec3 p, vec3 n) {
  float o = 0.0, w = 1.0;
  for (int i = 1; i <= 5; i++) { float h = 0.03 * float(i * i); o += w * (h - map(p + n * h)); w *= 0.6; }
  return clamp(1.0 - 1.6 * o, 0.0, 1.0);
}
vec3 render(vec3 ro, vec3 rd, float pix) {
  float a = uPhase * TAU;
  vec3 l = normalize(vec3(cos(a) * 0.9, 0.75, sin(a) * 0.9 + 0.4));   // the key light circles once per loop
  vec3 bg = mix(vec3(0.02, 0.04, 0.07), vec3(0.07, 0.14, 0.20), clamp(0.6 + rd.y, 0.0, 1.0));
  bg += vec3(0.10, 0.08, 0.06) * pow(max(dot(rd, normalize(-ro)), 0.0), 40.0);   // a soft glow behind the box
  float t = 0.5, tr = 0.0;
  bool hit = false;
  for (int i = 0; i < 200; i++) {
    float h = map(ro + rd * t, tr);
    if (h < pix * t) { hit = true; break; }                  // stop at one pixel of precision: no sub-pixel sparkle
    t += h * 0.9;
    if (t > 16.0) break;
  }
  float tf = rd.y < 0.0 ? (FLOOR - ro.y) / rd.y : 1e3;      // the floor, hit analytically
  if (!hit && tf > 100.0) return bg;
  if (!hit || tf < t) {
    vec3 q = ro + rd * tf;
    float pool = exp(-0.06 * dot(q.xz, q.xz));                // a pool of light round the box
    vec3 fc = mix(vec3(0.05, 0.08, 0.12), vec3(0.30, 0.26, 0.22), pool) * (0.3 + 0.7 * shadow(q + vec3(0, 0.01, 0), l));
    return mix(fc, bg, smoothstep(8.0, 22.0, tf));
  }
  vec3 p = ro + rd * t, n = normal(p, 3.0 * pix * t);           // normals over 3 pixels: the finest folds do not sparkle
  float dif = max(dot(n, l), 0.0) * shadow(p + n * 0.004, l);
  float ao = occlusion(p, n);
  float k = smoothstep(0.1, 1.3, sqrt(tr));
  vec3 base = mix(vec3(0.95, 0.66, 0.36), vec3(0.92, 0.90, 0.86), k);  // brass deep in the folds, ivory on the faces
  vec3 sky = mix(vec3(0.16, 0.22, 0.34), vec3(0.42, 0.58, 0.78), 0.5 + 0.5 * n.y);
  vec3 col = base * (vec3(1.5, 1.22, 0.92) * dif + sky * 0.8 * ao) * (0.25 + 0.75 * ao);
  col += vec3(1.0, 0.9, 0.8) * pow(max(dot(reflect(-l, n), -rd), 0.0), 24.0) * dif * 0.3;
  col += vec3(0.30, 0.55, 0.85) * pow(1.0 - max(dot(n, -rd), 0.0), 4.0) * ao * 0.35;   // cool rim
  return mix(col, bg, smoothstep(6.0, 12.0, t));             // far folds fade into the dusk
}
void main() {
  float a = uPhase * TAU;
  float yaw = 0.62 + 0.06 * sin(a), pitch = 0.58 + 0.05 * sin(2.0 * a);
  float dist = 9.3 + 0.3 * cos(a);
  vec3 ro = dist * vec3(cos(pitch) * sin(yaw), sin(pitch), cos(pitch) * cos(yaw));
  vec3 fw = normalize(-ro), rt = normalize(cross(fw, vec3(0, 1, 0))), up = cross(rt, fw);
  float pix = 1.6 / uRes.x / 1.9;                              // one pixel, in ray-direction units
  vec3 col = vec3(0.0);
  for (int j = 0; j < 3; j++) for (int i = 0; i < 3; i++) {
    vec2 uv = (2.0 * (gl_FragCoord.xy + (vec2(i, j) - 1.0) / 3.0) - uRes) / uRes.x;
    uv.y -= 0.08;
    vec3 rd = normalize(fw * 1.9 + rt * uv.x * 0.8 + up * uv.y * 0.8);
    col += render(ro, rd, pix);
  }
  col /= 9.0;
  col = col / (1.0 + col * 0.3);
  outColor = vec4(pow(col, vec3(0.92)) + grain(gl_FragCoord.xy) / 255.0, 1.0);   // fixed dither against banding
}`,
};
