// Whitted-style ray tracing (fragment shader, analytic, noise-free): rays from the eye hit spheres and a checkerboard;
// each hit sends a shadow ray to the point light and spawns a mirror ray and, for glass, a Fresnel-weighted refracted
// ray, kept on a small stack up to 6 bounces deep. Ray cones widen at every curved bounce so the checker is filtered
// by its footprint (no moiré), and 2 × 2 samples per pixel smooth the edges.
export default {
  name: 'Ray Tracing',
  ko: '레이 트레이싱',
  frag: `
const int NS = 5;
vec4 sph[NS];             // centre, radius
int kind[NS];             // 0 matte, 1 mirror, 2 glass
vec3 tint[NS];
const vec3 LIGHT = vec3(-5.0, 9.0, 6.0);

void scene() {
  float a = uPhase * TAU;
  sph[0] = vec4(0.0, 1.05, -0.6, 1.05); kind[0] = 1; tint[0] = vec3(0.92, 0.94, 0.98);              // mirror ball
  sph[1] = vec4(1.75 * cos(a), 0.85 + 0.15 * sin(2.0 * a), -0.6 + 2.0 * sin(a), 0.8); kind[1] = 2; tint[1] = vec3(0.97, 0.99, 1.0); // glass ball orbiting it
  float h2 = sin(2.0 * a), h3 = sin(2.0 * a + 1.2);
  sph[2] = vec4(-1.15, 0.38 + 1.0 * h2 * h2, 1.5, 0.38); kind[2] = 0; tint[2] = vec3(0.10, 0.62, 0.62);    // hopping teal
  sph[3] = vec4(1.25, 0.32 + 0.85 * h3 * h3, 1.8, 0.32); kind[3] = 0; tint[3] = vec3(0.95, 0.55, 0.12);           // hopping orange
  sph[4] = vec4(-1.7, 0.6, -3.8, 0.6); kind[4] = 0; tint[4] = vec3(0.45, 0.35, 0.85);                            // violet, at the back
}

float hitSphere(vec3 ro, vec3 rd, vec4 s) {
  vec3 oc = ro - s.xyz;
  float b = dot(oc, rd), c = dot(oc, oc) - s.w * s.w, h = b * b - c;
  if (h < 0.0) return -1.0;
  h = sqrt(h);
  float t = -b - h;
  if (t < 1e-3) t = -b + h;           // from inside (glass), take the far side
  return t < 1e-3 ? -1.0 : t;
}
// nearest hit: t, object id (-1 sky, NS floor)
vec2 hit(vec3 ro, vec3 rd) {
  float best = 1e9, id = -1.0;
  for (int i = 0; i < NS; i++) { float t = hitSphere(ro, rd, sph[i]); if (t > 0.0 && t < best) { best = t; id = float(i); } }
  if (rd.y < 0.0) { float t = -ro.y / rd.y; if (t > 1e-3 && t < best) { best = t; id = float(NS); } }
  return vec2(best, id);
}
// light reaching p: 1 lit, 0 shadow, glass lets 60 % through
float shadow(vec3 p) {
  vec3 l = LIGHT - p; float d = length(l); l /= d;
  float s = 1.0;
  for (int i = 0; i < NS; i++) { float t = hitSphere(p, l, sph[i]); if (t > 0.0 && t < d) s *= kind[i] == 2 ? 0.6 : 0.0; }
  return s;
}
bool keep(vec3 w) { return max(w.r, max(w.g, w.b)) > 0.015; }   // rays too faint to matter are not traced
vec3 sky(vec3 rd) {
  float y = clamp(rd.y, 0.0, 1.0);
  return mix(vec3(0.78, 0.87, 0.95), vec3(0.18, 0.42, 0.82), pow(y, 0.55));
}
// box-filtered checker (Inigo Quilez): w is the footprint in checker units
float checker(vec2 p, float w) {
  vec2 i = 2.0 * (abs(fract((p - 0.5 * w) * 0.5) - 0.5) - abs(fract((p + 0.5 * w) * 0.5) - 0.5)) / w;
  return 0.5 - 0.5 * i.x * i.y;
}
vec3 phong(vec3 p, vec3 n, vec3 rd, vec3 alb, float shine) {
  vec3 l = normalize(LIGHT - p);
  float sh = shadow(p + n * 2e-3);
  float dif = max(dot(n, l), 0.0) * sh;
  float spe = pow(max(dot(reflect(-l, n), -rd), 0.0), shine) * sh;
  return alb * (0.22 + 0.85 * dif) + vec3(1.0) * spe * 0.6;
}

// iterative Whitted tracer with a stack of rays: origin, direction, weight, cone (width, spread), depth
vec3 trace(vec3 ro0, vec3 rd0, float spread0) {
  vec3 sro[8], srd[8], sw[8]; vec2 scone[8]; int sdep[8];
  int sp = 0;
  sro[0] = ro0; srd[0] = rd0; sw[0] = vec3(1.0); scone[0] = vec2(0.0, spread0); sdep[0] = 0; sp = 1;
  vec3 col = vec3(0.0);
  for (int it = 0; it < 24; it++) {
    if (sp == 0) break;
    sp--;
    vec3 ro = sro[sp], rd = srd[sp], w = sw[sp]; vec2 cone = scone[sp]; int dep = sdep[sp];
    vec2 h = hit(ro, rd);
    if (h.y < 0.0) { col += w * sky(rd); continue; }
    vec3 p = ro + rd * h.x;
    float width = cone.x + cone.y * h.x;                        // the ray cone's width at the hit
    if (h.y == float(NS)) {                                     // the checkerboard floor
      float c = checker(p.xz * 1.25, max(width * 1.25 / max(-rd.y, 0.08), 1e-4));
      vec3 alb = mix(vec3(0.86, 0.20, 0.16), vec3(0.98, 0.84, 0.36), c);
      vec3 fc = phong(p, vec3(0, 1, 0), rd, alb, 30.0);
      float far = smoothstep(18.0, 45.0, length(p.xz));
      col += w * mix(fc, sky(vec3(rd.x, 0.0, rd.z)), far) * 0.88;
      if (dep < 5 && sp < 8 && keep(w * 0.12 * (1.0 - far))) { sro[sp] = p + vec3(0, 2e-3, 0); srd[sp] = reflect(rd, vec3(0, 1, 0)); sw[sp] = w * 0.12 * (1.0 - far); scone[sp] = vec2(width, cone.y); sdep[sp] = dep + 1; sp++; }
      continue;
    }
    int i = int(h.y);
    vec4 s = sph[i];
    vec3 n = (p - s.xyz) / s.w;
    float spreadNew = cone.y + 2.0 * width / s.w;               // a curved mirror widens the cone
    if (kind[i] == 0) {
      col += w * phong(p, n, rd, tint[i], 40.0);
      if (dep < 5 && sp < 8 && keep(w * 0.08)) { sro[sp] = p + n * 2e-3; srd[sp] = reflect(rd, n); sw[sp] = w * 0.08; scone[sp] = vec2(width, spreadNew); sdep[sp] = dep + 1; sp++; }
    } else if (kind[i] == 1) {
      vec3 l = normalize(LIGHT - p);
      col += w * vec3(1.0) * pow(max(dot(reflect(-l, n), -rd), 0.0), 200.0) * shadow(p + n * 2e-3) * 1.2;
      if (dep < 6 && sp < 8 && keep(w * 0.9)) { sro[sp] = p + n * 2e-3; srd[sp] = reflect(rd, n); sw[sp] = w * tint[i] * 0.9; scone[sp] = vec2(width, spreadNew); sdep[sp] = dep + 1; sp++; }
    } else {
      bool inside = dot(rd, n) > 0.0;
      vec3 nn = inside ? -n : n;
      float eta = inside ? 1.5 : 1.0 / 1.5;
      float cosi = -dot(rd, nn);
      float F = 0.04 + 0.96 * pow(clamp(1.0 - cosi, 0.0, 1.0), 5.0);   // Schlick Fresnel
      vec3 rr = refract(rd, nn, eta);
      if (!inside) { vec3 l = normalize(LIGHT - p); col += w * vec3(1.0) * pow(max(dot(reflect(-l, nn), -rd), 0.0), 300.0) * shadow(p + nn * 2e-3) * 1.2; }
      if (dot(rr, rr) == 0.0) F = 1.0;                            // total internal reflection
      if (dep < 6 && sp < 8 && keep(w * F)) { sro[sp] = p + nn * 2e-3; srd[sp] = reflect(rd, nn); sw[sp] = w * F; scone[sp] = vec2(width, spreadNew); sdep[sp] = dep + 1; sp++; }
      if (dep < 6 && sp < 8 && F < 1.0 && keep(w * (1.0 - F))) { sro[sp] = p - nn * 2e-3; srd[sp] = rr; sw[sp] = w * (1.0 - F) * tint[i]; scone[sp] = vec2(width, cone.y + width / s.w); sdep[sp] = dep + 1; sp++; }
    }
  }
  return col;
}

void main() {
  scene();
  vec3 ro = vec3(0.0, 1.9, 8.2), ta = vec3(0.0, 0.9, 0.0);
  vec3 f = normalize(ta - ro), r = normalize(cross(f, vec3(0, 1, 0))), u = cross(r, f);
  float zoom = 2.0, px = 2.0 / uRes.y / zoom;                  // angle covered by one pixel
  vec3 col = vec3(0.0);
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 uv = (2.0 * (gl_FragCoord.xy + vec2(i, j) * 0.5 - 0.25) - uRes) / uRes.y;
    col += trace(ro, normalize(f * zoom + uv.x * r + uv.y * u), px);
  }
  col = max(col / 4.0, 0.0);
  col = col / (1.0 + 0.12 * col);
  outColor = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);
}`,
};
