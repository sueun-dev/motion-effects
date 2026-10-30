// Volumetric spotlights: five moving heads on a truss shine through stage haze. Each pixel marches through the
// haze; at every step it adds the light of every spot whose cone contains the point (soft cone edge, distance
// falloff, Henyey-Greenstein forward scattering, so beams aimed at us glow brightest), unless the singer is in the
// way: a shadow test against her capsules carves dark streaks into the beams. The haze drifts on a loop.
export default {
  name: 'Volumetric Spotlight',
  ko: '볼류메트릭 스포트라이트',
  frag: `
const float TRUSS = 7.4;

vec3 lightPos(int i) { return vec3(-4.0 + 2.0 * float(i), TRUSS, -3.2); }
vec3 lightCol(int i) {
  if (i == 0) return vec3(1.0, 0.18, 0.55);
  if (i == 1) return vec3(0.2, 0.55, 1.0);
  if (i == 2) return vec3(1.0, 0.9, 0.78);
  if (i == 3) return vec3(0.2, 0.55, 1.0);
  return vec3(1.0, 0.18, 0.55);
}
vec3 lightDir(int i) {   // each beam's aim point on the floor sweeps on its own loop
  float a = uPhase * TAU, k = float(i);
  float side = k < 2.0 ? 1.0 : (k > 2.0 ? -1.0 : 0.0);
  vec3 aim = vec3(side * 0.6 + 2.6 * sin(a + k * 1.3) * (k == 2.0 ? 0.4 : 1.0), 0.0, -1.6 + 1.2 * sin(2.0 * a + k * 2.1));
  return normalize(aim - lightPos(i));
}
// the singer: three capsules (body, head, raised arm)
float capsule(vec3 ro, vec3 rd, vec3 pa, vec3 pb, float r) {   // ray-capsule intersection distance (or -1), iq
  vec3 ba = pb - pa, oa = ro - pa;
  float baba = dot(ba, ba), bard = dot(ba, rd), baoa = dot(ba, oa), rdoa = dot(rd, oa), oaoa = dot(oa, oa);
  float a = baba - bard * bard, b = baba * rdoa - baoa * bard, c = baba * oaoa - baoa * baoa - r * r * baba;
  float h = b * b - a * c;
  if (h >= 0.0) {
    float t = (-b - sqrt(h)) / a, y = baoa + t * bard;
    if (y > 0.0 && y < baba) return t;
    vec3 oc = (y <= 0.0) ? oa : ro - pb;
    b = dot(rd, oc); c = dot(oc, oc) - r * r; h = b * b - c;
    if (h > 0.0) return -b - sqrt(h);
  }
  return -1.0;
}
float figure(vec3 ro, vec3 rd) {   // nearest hit, or 1e9
  float t = 1e9, h;
  float sway = 0.05 * sin(uPhase * TAU * 2.0);
  vec3 hip = vec3(sway * 0.5, 0.85, -0.6), neck = vec3(sway, 1.42, -0.6);
  h = capsule(ro, rd, vec3(-0.12, 0.05, -0.6), hip, 0.075); if (h > 0.0) t = min(t, h);           // legs
  h = capsule(ro, rd, vec3(0.13, 0.05, -0.6), hip, 0.075);  if (h > 0.0) t = min(t, h);
  h = capsule(ro, rd, hip, neck, 0.15);                      if (h > 0.0) t = min(t, h);           // body
  h = capsule(ro, rd, neck + vec3(0.0, 0.2, 0.0), neck + vec3(0.0, 0.24, 0.0), 0.11); if (h > 0.0) t = min(t, h);
  h = capsule(ro, rd, neck + vec3(0.12, -0.04, 0.0), neck + vec3(0.42 + 0.06 * sin(uPhase * TAU), 0.62, 0.05), 0.05); if (h > 0.0) t = min(t, h);
  h = capsule(ro, rd, neck + vec3(-0.12, -0.04, 0.0), neck + vec3(-0.2, -0.55, 0.12), 0.05); if (h > 0.0) t = min(t, h);
  return t;
}
float hg(float c, float g) { return (1.0 - g * g) / (4.0 * PI * pow(1.0 + g * g - 2.0 * g * c, 1.5)); }
// light arriving at p from spot i (colour), with the cone, falloff and the singer's shadow
vec3 spot(int i, vec3 p) {
  vec3 lp = lightPos(i), v = p - lp;
  float d = length(v);
  v /= d;
  float cone = smoothstep(0.9855, 0.9895, dot(v, lightDir(i)));
  if (cone <= 0.0) return vec3(0.0);
  float sh = figure(lp, v) < d - 0.02 ? 0.0 : 1.0;
  return lightCol(i) * cone * sh * 9.0 / (1.0 + 0.012 * d * d);
}

// light scattered toward the eye by the haze along a ray, from t0 to t1, in n steps (offset by a fixed per-pixel jitter)
vec3 haze(vec3 ro, vec3 rd, float t0, float t1, float n) {
  float dt = (t1 - t0) / n;
  float t = t0 + dt * hash12(gl_FragCoord.xy);
  vec3 fog = vec3(0.0);
  for (int k = 0; k < 90; k++) {
    if (float(k) >= n) break;
    vec3 q = ro + rd * t;
    float h = 0.65 + 0.35 * snoise(vec3(q.xz * 0.3, q.y * 0.45) + vec3(loopXY(0.6), 0.0));   // drifting haze
    for (int i = 0; i < 5; i++) {
      vec3 L = spot(i, q);
      if (L.x + L.y + L.z > 0.0) fog += L * h * hg(dot(normalize(q - lightPos(i)), -rd), 0.55);
    }
    t += dt;
  }
  return fog * dt * 0.55;
}
// the fixtures: glowing lenses, brightest when aimed at us
vec3 lenses(vec3 ro, vec3 rd) {
  vec3 col = vec3(0.0);
  for (int i = 0; i < 5; i++) {
    vec3 lp = lightPos(i), v = lp - ro;
    float tc = dot(v, rd);
    if (tc <= 0.0) continue;
    float ang = length(v - rd * tc) / tc;
    float face = smoothstep(0.6, 1.0, dot(-normalize(v), lightDir(i)));
    col += lightCol(i) * (exp(-ang * ang * 4e4) * (1.0 + 3.0 * face) + 0.03 * exp(-ang * 50.0) * (0.5 + face));
  }
  return col;
}

void main() {
  vec2 uv = (2.0 * gl_FragCoord.xy - uRes) / uRes.x;
  vec3 ro = vec3(0.0, 1.3, 6.5);
  vec3 fw = normalize(vec3(0.0, 2.3, -1.0) - ro), rt = normalize(cross(fw, vec3(0, 1, 0))), up = cross(rt, fw);
  vec3 rd = normalize(rt * uv.x + up * uv.y + fw * 1.75);
  // what the ray hits: the singer, the floor or the back wall
  float tf = rd.y < 0.0 ? -ro.y / rd.y : 1e9, tw = (-5.0 - ro.z) / rd.z, tg = figure(ro, rd);
  float tEnd = min(min(tf, tw), tg);
  vec3 col = vec3(0.0);
  vec3 p = ro + rd * tEnd;
  if (tg <= tEnd) {
    vec3 n = normalize(vec3(p.x, 0.0, p.z + 0.6));          // rim light on the dark figure
    for (int i = 0; i < 5; i++) col += spot(i, p + n * 0.03) * max(dot(n, normalize(lightPos(i) - p)), 0.0) * 0.004;
  } else if (tf <= tw) {                                    // glossy black stage floor: pools of light and highlights
    for (int i = 0; i < 5; i++) {
      vec3 l = normalize(lightPos(i) - p);
      vec3 L = spot(i, p);
      col += L * (0.012 * l.y + 0.05 * pow(max(dot(reflect(rd, vec3(0, 1, 0)), l), 0.0), 60.0));
    }
    col += vec3(0.01, 0.01, 0.015);
    vec3 rr = reflect(rd, vec3(0.0, 1.0, 0.0));            // the floor mirrors the beams and lenses, dimmed
    float fg = figure(p, rr);                              // the singer blocks her own reflection too
    float tr = min(clamp((-5.0 - p.z) / rr.z, 0.1, 14.0), fg);
    col += 0.2 * (haze(p, rr, 0.05, tr, 40.0) + lenses(p, rr) * step(1e8, fg));
  } else {                                                  // back wall
    for (int i = 0; i < 5; i++) col += spot(i, p) * 0.006;
    col += vec3(0.008, 0.008, 0.014);
  }
  col += haze(ro, rd, 1.0, min(tEnd, 22.0), 90.0) + lenses(ro, rd);
  col = 1.0 - exp(-col * 1.2);
  outColor = vec4(pow(col, vec3(0.9)), 1.0);
}`,
};
