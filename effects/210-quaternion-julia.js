// Quaternion Julia: z -> z^2 + c with z and c quaternions (4D). The 3D slice w = 0 is raymarched with the
// distance estimate 0.5 |z| log|z| / |z'| (9 iterations). The constant c circles a point in 4D once per loop,
// so the shape melts from a draped mass into an open lattice and back while it swings; an orbit trap colours it
// coral to gold. Normals span 3 pixels so the ridges do not sparkle; 2x2 supersampling, soft shadow on the floor.
export default {
  name: 'Quaternion Julia',
  ko: '쿼터니언 줄리아',
  uniforms(t) {
    const a = (t / 5) * Math.PI * 2; // c circles a point in 4D once per loop
    return { uC: [-0.291 + 0.12 * Math.cos(a), -0.399 + 0.12 * Math.sin(a), 0.339 + 0.08 * Math.sin(a), 0.437 - 0.08 * Math.cos(a)] };
  },
  frag: `
uniform vec4 uC;
const float FLOOR = -1.55;
vec4 qsqr(vec4 a) { return vec4(a.x * a.x - dot(a.yzw, a.yzw), 2.0 * a.x * a.yzw); }
// distance to the Julia set; trap = the closest the orbit came to each axis and to the origin
float julia(vec3 p, out vec4 trap) {
  vec4 z = vec4(p, 0.0);
  float md2 = 1.0, mz2 = dot(z, z);
  trap = vec4(abs(z.xyz), mz2);
  for (int i = 0; i < 9; i++) {
    md2 *= 4.0 * mz2;                                        // |z'|^2, since z' -> 2 z z'
    z = qsqr(z) + uC;
    mz2 = dot(z, z);
    trap = min(trap, vec4(abs(z.xyz), mz2));
    if (mz2 > 4.0) break;
  }
  return 0.25 * sqrt(mz2 / md2) * log(mz2);
}
float julia(vec3 p) { vec4 tr; return julia(p, tr); }
vec3 normal(vec3 p, float e) {
  vec2 k = vec2(1, -1);
  return normalize(k.xyy * julia(p + k.xyy * e) + k.yyx * julia(p + k.yyx * e) + k.yxy * julia(p + k.yxy * e) + k.xxx * julia(p + k.xxx * e));
}
float shadow(vec3 ro, vec3 rd) {
  float res = 1.0, t = 0.02;
  for (int i = 0; i < 48; i++) { float h = julia(ro + rd * t); res = min(res, 9.0 * h / t); t += clamp(h, 0.01, 0.2); if (res < 0.01 || t > 5.0) break; }
  return clamp(res, 0.0, 1.0);
}
mat3 turn;
vec3 render(vec3 ro, vec3 rd, float pix) {
  vec3 l = normalize(vec3(-0.6, 0.8, 0.45));
  vec3 bg = mix(vec3(0.10, 0.07, 0.18), vec3(0.32, 0.20, 0.38), clamp(0.55 + 0.7 * rd.y, 0.0, 1.0));
  // march in the object's own (turned) space; the floor stays put
  vec3 o = turn * ro, d = turn * rd;
  float t = 0.0;
  vec4 tr;
  bool hit = false;
  float b = dot(o, d), c = dot(o, o) - 2.6;                 // only march inside the bounding sphere
  float hb = b * b - c;
  if (hb > 0.0) {
    t = max(-b - sqrt(hb), 0.0);
    for (int i = 0; i < 160; i++) {
      float h = julia(o + d * t, tr);
      if (h < pix * t) { hit = true; break; }
      t += h;
      if (t > -b + sqrt(hb)) break;
    }
  }
  float tf = rd.y < 0.0 ? (FLOOR - ro.y) / rd.y : 1e3;
  if (!hit || tf < t) {
    if (tf > 100.0) return bg;
    vec3 q = ro + rd * tf;
    float sh = shadow(turn * (q + vec3(0, 0.01, 0)), turn * l);
    vec3 fc = mix(vec3(0.34, 0.24, 0.40), vec3(0.62, 0.48, 0.62), exp(-0.12 * dot(q.xz, q.xz)));
    return mix(fc * (0.45 + 0.55 * sh), bg, smoothstep(4.0, 14.0, tf));
  }
  vec3 p = o + d * t, n = normal(p, pix * t * 3.0), lo = turn * l;
  float dif = max(dot(n, lo), 0.0) * shadow(p + n * 0.003, lo);
  float ao = clamp(tr.w * 2.0 + 0.25, 0.0, 1.0);             // deep orbits sit in the creases
  float spe = pow(max(dot(reflect(-lo, n), -d), 0.0), 40.0);
  float fre = pow(1.0 - max(dot(n, -d), 0.0), 3.0);
  vec3 base = mix(vec3(1.0, 0.46, 0.34), vec3(1.0, 0.84, 0.56), smoothstep(0.05, 0.5, tr.w));   // coral in the creases, gold on the swells
  base = mix(base, vec3(0.55, 0.62, 1.0), 0.35 * smoothstep(0.2, -0.8, n.y));                       // lilac underneath
  vec3 col = base * (vec3(1.3, 1.15, 1.0) * dif + vec3(0.30, 0.24, 0.42) * ao);
  col += vec3(1.0, 0.95, 0.9) * spe * dif * 0.6 + vec3(0.65, 0.55, 0.95) * fre * 0.45 * ao;
  return col;
}
void main() {
  float a = uPhase * TAU;
  float yaw = 0.25 * sin(a);                                 // the object swings while it morphs
  turn = mat3(cos(yaw), 0.0, sin(yaw), 0.0, 1.0, 0.0, -sin(yaw), 0.0, cos(yaw));
  vec3 ro = vec3(0.0, 0.7, 3.3);
  vec3 fw = normalize(vec3(0.0, -0.32, 0.0) - ro), rt = normalize(cross(fw, vec3(0, 1, 0))), up = cross(rt, fw);
  float pix = 0.8 * 2.0 / uRes.x / 1.9;                       // one pixel, in ray-direction units
  vec3 col = vec3(0.0);
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 uv = (2.0 * (gl_FragCoord.xy + vec2(i, j) * 0.5 - 0.25) - uRes) / uRes.x;
    col += render(ro, normalize(fw * 1.9 + rt * uv.x * 0.8 + up * uv.y * 0.8), pix);
  }
  col /= 4.0;
  outColor = vec4(pow(col / (1.0 + 0.2 * col), vec3(0.95)) + grain(gl_FragCoord.xy) / 255.0, 1.0);
}`,
};
