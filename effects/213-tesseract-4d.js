// 4D tesseract: the 16 corners (+-1, +-1, +-1, +-1) are turned in the x-w plane (a quarter turn per loop, which
// maps the hypercube onto itself), then projected to 3D with a 4D perspective (scale 3 / (3 - w)). The 32 edges
// are ray traced as capsules that are thicker and warmer nearer the 4D eye, so the inner cube swells into the
// outer one and back out through it. Each edge's glow uses the exact ray-to-segment distance, and a glossy
// floor reflects everything. 3x3 supersampling.
const TAU = Math.PI * 2;

export default {
  name: '4D Tesseract',
  ko: '4차원 테서랙트',
  uniforms(t) {
    const a = (t / 5) * TAU, th = a / 4;                       // x-w turn: a quarter turn per loop
    const zw = 0.35 * Math.sin(a);                              // and a small z-w sway for depth
    const u = {};
    for (let i = 0; i < 16; i++) {
      let [x, y, z, w] = [i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, i & 8 ? 1 : -1];
      [x, w] = [x * Math.cos(th) - w * Math.sin(th), x * Math.sin(th) + w * Math.cos(th)];
      [z, w] = [z * Math.cos(zw) - w * Math.sin(zw), z * Math.sin(zw) + w * Math.cos(zw)];
      const k = 3 / (3 - w);                                    // 4D perspective: nearer in w = bigger
      u[`uV${i}`] = [x * k, y * k, z * k, w];
    }
    return u;
  },
  frag: `
uniform vec4 uV0, uV1, uV2, uV3, uV4, uV5, uV6, uV7, uV8, uV9, uV10, uV11, uV12, uV13, uV14, uV15;
vec4 V[16];
const float FLOOR = -2.7;
vec3 hue(float w) { return mix(vec3(0.20, 0.85, 1.0), vec3(1.0, 0.30, 0.75), smoothstep(-1.2, 1.2, w)); }
float radius(float w) { return 0.045 + 0.02 * w; }          // never thinner than about 6 px
// ray against capsule a-b (radius r): distance along the ray, or -1
float capsule(vec3 ro, vec3 rd, vec3 a, vec3 b, float r) {
  vec3 ba = b - a, oa = ro - a;
  float baba = dot(ba, ba), bard = dot(ba, rd), baoa = dot(ba, oa), rdoa = dot(rd, oa), oaoa = dot(oa, oa);
  float qa = baba - bard * bard, qb = baba * rdoa - baoa * bard, qc = baba * oaoa - baoa * baoa - r * r * baba;
  float h = qb * qb - qa * qc;
  if (h < 0.0) return -1.0;
  float t = (-qb - sqrt(h)) / qa, y = baoa + t * bard;
  if (y > 0.0 && y < baba) return t;
  vec3 oc = y <= 0.0 ? oa : ro - b;                           // or one of the round ends
  qb = dot(rd, oc); qc = dot(oc, oc) - r * r; h = qb * qb - qc;
  return h > 0.0 ? -qb - sqrt(h) : -1.0;
}
// closest distance between the ray (t > 0) and the segment a-b; s = where on the segment
float raySeg(vec3 ro, vec3 rd, vec3 a, vec3 b, out float s) {
  vec3 ba = b - a, oa = ro - a;
  float bb = dot(ba, ba), bd = dot(ba, rd), bo = dot(ba, oa), dO = dot(rd, oa);
  float den = bb - bd * bd;
  s = clamp(den > 1e-6 ? (bo - bd * dO) / den : 0.0, 0.0, 1.0);
  float t = max(dot(a + ba * s - ro, rd), 0.0);
  s = clamp(dot(ro + rd * t - a, ba) / bb, 0.0, 1.0);
  return length(ro + rd * t - a - ba * s);
}
mat3 view;
// trace the tesseract: rgb = colour, a = 1 if something was hit
vec4 trace(vec3 ro, vec3 rd) {
  ro = view * ro; rd = view * rd;                             // into the shape's own space
  float best = 1e9, bw = 0.0;
  vec3 bn = vec3(0.0), glow = vec3(0.0);
  for (int i = 0; i < 16; i++) {
    for (int b = 0; b < 4; b++) {
      int j = i ^ (1 << b);                                   // corners that differ in one coordinate share an edge
      if (j < i) continue;
      float r = radius(0.5 * (V[i].w + V[j].w)), s;
      float t = capsule(ro, rd, V[i].xyz, V[j].xyz, r);
      if (t > 0.0 && t < best) {
        best = t;
        vec3 p = ro + rd * t, ba = V[j].xyz - V[i].xyz;
        float h = clamp(dot(p - V[i].xyz, ba) / dot(ba, ba), 0.0, 1.0);
        bn = normalize(p - V[i].xyz - ba * h); bw = mix(V[i].w, V[j].w, h);
      }
      float d = raySeg(ro, rd, V[i].xyz, V[j].xyz, s);
      float w = mix(V[i].w, V[j].w, s);
      glow += hue(w) * exp(-9.0 * max(d - radius(w), 0.0)) * 0.10;
    }
    float r = 0.08 + 0.03 * V[i].w;                             // a bead on every corner
    vec3 oc = ro - V[i].xyz;
    float qb = dot(oc, rd), h = qb * qb - dot(oc, oc) + r * r;
    if (h > 0.0 && -qb - sqrt(h) > 0.0 && -qb - sqrt(h) < best) {
      best = -qb - sqrt(h); bn = normalize(oc + rd * best); bw = V[i].w;
    }
  }
  if (best > 1e8) return vec4(glow, 0.0);
  vec3 l = normalize(vec3(-0.3, 0.8, 0.5)), c = hue(bw);
  float dif = max(dot(bn, l), 0.0), fre = pow(1.0 - max(dot(bn, -rd), 0.0), 2.0);
  vec3 col = c * (0.55 + 0.6 * dif) + vec3(1.0) * pow(max(dot(reflect(-l, bn), -rd), 0.0), 30.0) * 0.6 + c * fre * 0.8;
  return vec4(col + glow * 0.3, 1.0);
}
vec3 render(vec3 ro, vec3 rd) {
  vec3 bg = mix(vec3(0.02, 0.02, 0.06), vec3(0.09, 0.06, 0.20), clamp(0.6 + 0.6 * rd.y, 0.0, 1.0));
  bg += vec3(0.16, 0.07, 0.22) * exp(-40.0 * rd.y * rd.y);   // a violet glow on the horizon
  vec4 c = trace(ro, rd);
  if (c.a > 0.5) return c.rgb;
  float tf = rd.y < 0.0 ? (FLOOR - ro.y) / rd.y : 1e9;
  if (tf > 1e8) return bg + c.rgb;
  vec3 p = ro + rd * tf, r = reflect(rd, vec3(0, 1, 0));
  float fre = 0.12 + 0.6 * pow(1.0 - max(-rd.y, 0.0), 5.0);
  vec3 floorCol = vec3(0.03, 0.03, 0.07) + trace(p, r).rgb * (0.25 + fre);   // the floor mirrors the tesseract, dimmed
  return mix(floorCol, bg, smoothstep(6.0, 22.0, tf)) + c.rgb;
}
void main() {
  V[0] = uV0; V[1] = uV1; V[2] = uV2; V[3] = uV3; V[4] = uV4; V[5] = uV5; V[6] = uV6; V[7] = uV7;
  V[8] = uV8; V[9] = uV9; V[10] = uV10; V[11] = uV11; V[12] = uV12; V[13] = uV13; V[14] = uV14; V[15] = uV15;
  float a = uPhase * TAU;
  float yaw = 0.6 + 0.15 * sin(a), pitch = -0.32;              // the 3D view of the projected shape
  view = mat3(cos(yaw), 0.0, sin(yaw), 0.0, 1.0, 0.0, -sin(yaw), 0.0, cos(yaw)) * mat3(1.0, 0.0, 0.0, 0.0, cos(pitch), sin(pitch), 0.0, -sin(pitch), cos(pitch));
  vec3 ro = vec3(0.0, 0.9, 7.4), ta = vec3(0.0, -0.35, 0.0);
  vec3 fw = normalize(ta - ro), rt = normalize(cross(fw, vec3(0, 1, 0))), up = cross(rt, fw);
  vec3 col = vec3(0.0);
  for (int j = 0; j < 3; j++) for (int i = 0; i < 3; i++) {
    vec2 uv = (2.0 * (gl_FragCoord.xy + (vec2(i, j) - 1.0) / 3.0) - uRes) / uRes.x;
    col += render(ro, normalize(fw * 1.9 + rt * uv.x * 0.8 + up * uv.y * 0.8));
  }
  col /= 9.0;
  outColor = vec4(pow(col, vec3(0.92)) + grain(gl_FragCoord.xy) / 255.0, 1.0);
}`,
};
