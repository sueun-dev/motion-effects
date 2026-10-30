// Underwater: a raymarched sea floor scene. Sunlight through the wavy surface makes caustics (a moving web of
// bright lines, here the edges of a Voronoi pattern whose points circle on the loop) on the sand, the rocks, the kelp
// and the fish; the same pattern, projected down along the sun, lights the water itself, giving slanted light shafts.
// Blue-green fog swallows everything with distance, bubbles rise and a small school of fish swims through.
export default {
  name: 'Underwater',
  ko: '수중',
  frag: `
const vec3 SUN = vec3(0.28, 0.94, 0.18);   // sunlight direction under water (pointing up toward the sun)
const float SURF = 8.0;                     // the water surface height

// caustic web: bright edges of a Voronoi pattern whose points circle (one turn per loop, so it loops)
float voro(vec2 p, float spin) {
  vec2 c = floor(p), f = fract(p);
  float f1 = 8.0, f2 = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(i, j), h = hash22(c + g);
    vec2 o = 0.5 + 0.32 * vec2(cos(spin * uPhase * TAU + TAU * h.x), sin(spin * uPhase * TAU + TAU * h.y));
    float d = length(g + o - f);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
  }
  return f2 - f1;
}
float caustic(vec2 p) {
  float a = exp(-voro(p * 0.9, 1.0) * 7.0), b = exp(-voro(rot(0.7) * p * 1.4 + 3.0, -1.0) * 7.0);
  return a * 0.7 + b * 0.5 + 1.6 * a * b;
}
// where the sunbeam through p left the surface: the caustic there lights p (and the water along the way)
float sunlit(vec3 p) { return caustic((p.xz + SUN.xz / SUN.y * (SURF - p.y)) * 0.8); }

// --- the scene ---
float sdEllipsoid(vec3 p, vec3 r) { float k0 = length(p / r), k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
float floorH(vec2 xz) { return 0.25 * sin(xz.x * 0.5 + 1.0) * cos(xz.y * 0.4) + 0.08 * sin(xz.x * 2.1 + xz.y * 1.3); }
vec3 fishPos(int k) {                        // each fish crosses from left to right once per loop, wrapping off screen
  float f = float(k);
  vec2 h = hash22(vec2(f, 7.0));
  return vec3(-9.0 + 18.0 * fract(uPhase + h.x), 3.4 + 1.6 * h.y + 0.15 * sin(uPhase * TAU * 2.0 + f), 0.6 - 2.4 * fract(h.x * 7.3));
}
float fish(vec3 p) {
  float d = 1e3;
  for (int k = 0; k < 7; k++) {
    vec3 q = p - fishPos(k);
    float wag = sin(uPhase * TAU * 8.0 + float(k) * 1.3);
    q.z += 0.05 * wag * smoothstep(0.0, -0.45, q.x);            // the body flexes toward the tail
    float body = sdEllipsoid(q, vec3(0.5, 0.19, 0.09));
    vec3 t = q - vec3(-0.55, 0.0, 0.08 * wag);
    float tail = max(sdEllipsoid(t, vec3(0.16, 0.2, 0.025)), -t.x - 0.07);
    d = min(d, min(body, tail));
  }
  return d;
}
float kelp(vec3 p) {
  float d = 1e3;
  for (int k = 0; k < 6; k++) {
    float f = float(k);
    vec2 h = hash22(vec2(f, 11.0));
    vec2 base = vec2(-4.4 + 1.75 * f + 0.8 * (h.x - 0.5), -1.2 - 5.5 * h.y);
    float top = 3.8 + 3.2 * fract(h.x * 5.3);
    float y = clamp(p.y, 0.0, top);
    vec2 sway = vec2(0.45 * sin(y * 0.55 - uPhase * TAU + f), 0.2 * cos(y * 0.4 - uPhase * TAU + f)) * y / 7.0;
    vec2 c = base + sway;
    d = min(d, length(vec3(p.x - c.x, p.y - y, p.z - c.y)) - 0.05);
    // a leaf blade every 0.6 units, alternating sides, tilted up
    float yb = clamp((floor(p.y / 0.6) + 0.5) * 0.6, 0.3, top - 0.2), side = mod(floor(p.y / 0.6), 2.0) * 2.0 - 1.0;
    vec2 cb = base + vec2(0.45 * sin(yb * 0.55 - uPhase * TAU + f), 0.2 * cos(yb * 0.4 - uPhase * TAU + f)) * yb / 7.0;
    vec3 q = vec3(p.x - cb.x - side * 0.2, p.y - yb - 0.08, p.z - cb.y);
    q.xy = rot(side * 0.6) * q.xy;
    d = min(d, sdEllipsoid(q, vec3(0.24, 0.07, 0.025)));
  }
  return d * 0.8;
}
float rocks(vec3 p) {
  float a = length((p - vec3(-2.6, -0.2, -1.2)) * vec3(1.0, 1.5, 1.0)) - 1.1;
  float b = length((p - vec3(3.0, -0.3, -4.5)) * vec3(0.9, 1.3, 1.0)) - 1.5;
  float c = length(p - vec3(1.4, -0.1, 0.8)) - 0.45;
  return min(min(a, b), c) * 0.7 + 0.06 * snoise(p * 2.5);
}
// distance and material: 0 sand, 1 rock, 2 kelp, 3 fish
vec2 map(vec3 p) {
  vec2 r = vec2(p.y - floorH(p.xz), 0.0);
  float d = rocks(p); if (d < r.x) r = vec2(d, 1.0);
  d = kelp(p);        if (d < r.x) r = vec2(d, 2.0);
  d = fish(p);        if (d < r.x) r = vec2(d, 3.0);
  return r;
}
vec3 normal(vec3 p) {
  vec2 e = vec2(0.004, 0.0);
  return normalize(vec3(map(p + e.xyy).x - map(p - e.xyy).x, map(p + e.yxy).x - map(p - e.yxy).x, map(p + e.yyx).x - map(p - e.yyx).x));
}
vec3 water(vec3 rd) {                         // the colour of the water itself in a direction
  return mix(vec3(0.0, 0.09, 0.17), vec3(0.06, 0.42, 0.55), smoothstep(-0.4, 0.8, rd.y)) + vec3(0.25, 0.5, 0.45) * pow(max(dot(rd, SUN), 0.0), 12.0);
}

vec3 render(vec3 ro, vec3 rd, float jit, out float tHit) {
  float t = 0.05, m = -1.0;
  for (int i = 0; i < 110; i++) {
    vec2 h = map(ro + rd * t);
    if (h.x < 0.0015 * t) { m = h.y; break; }
    t += h.x;
    if (t > 40.0) break;
  }
  vec3 col;
  if (m < 0.0) {                              // open water, and the bright rippled surface overhead
    col = water(rd);
    if (rd.y > 0.0) {
      vec3 s = ro + rd * ((SURF - ro.y) / rd.y);
      col += vec3(0.5, 0.85, 0.85) * caustic(s.xz * 0.8) * 0.35 * smoothstep(0.15, 0.6, rd.y);
    }
    t = 40.0;
  } else {
    vec3 p = ro + rd * t, n = normal(p);
    vec3 base = m < 0.5 ? vec3(0.82, 0.72, 0.52) : m < 1.5 ? vec3(0.36, 0.33, 0.3) : m < 2.5 ? vec3(0.32, 0.4, 0.1) : mix(vec3(1.0, 0.82, 0.35), vec3(0.12, 0.38, 0.75), smoothstep(-0.05, 0.1, n.y));
    float sun = max(dot(n, SUN), 0.0) * (0.35 + 1.6 * mix(sunlit(p), 0.45, smoothstep(9.0, 22.0, t)));   // far away the web fades to its average
    col = base * (vec3(0.08, 0.22, 0.28) * (0.6 + 0.4 * n.y) + vec3(0.8, 0.95, 0.9) * sun);
    if (m > 2.5) col += vec3(0.5, 0.7, 0.8) * pow(max(dot(reflect(rd, n), SUN), 0.0), 20.0) * 0.6;   // fish scales glint
  }
  // light shafts: march through the water, lit where the sun's beam came through a bright patch of the surface
  float sh = 0.0, tm = min(t, 30.0), dt = tm / 36.0;
  float s = dt * jit;                        // fixed per-pixel offset (never changes over time)
  for (int i = 0; i < 36; i++) {
    vec3 q = ro + rd * s;
    sh += pow(caustic((q.xz + SUN.xz / SUN.y * (SURF - q.y)) * 0.18), 1.5) * exp(-0.09 * s) * smoothstep(0.0, 3.0, q.y);
    s += dt;
  }
  tHit = t;
  float fogK = 1.0 - exp(-0.085 * t);
  col = mix(col, water(rd), fogK);
  col += vec3(0.35, 0.7, 0.65) * sh * dt * 0.09;
  return col;
}

// bubbles: spheres rising in a few columns, each a whole number of times per loop
vec4 bubbles(vec3 ro, vec3 rd, float tScene) {
  vec4 acc = vec4(0.0);
  for (int k = 0; k < 24; k++) {
    float f = float(k);
    vec2 h = hash22(vec2(f, 3.0));
    float y = fract(uPhase * (1.0 + floor(h.y * 2.0)) + h.x) * 8.5;
    vec3 c = vec3(-2.6 + 0.5 * fract(f * 0.37) + 0.12 * sin(y * 3.0 + f), y, -1.0 + 0.4 * fract(f * 0.71));
    if (k >= 12) c.xz = vec2(3.0 + 0.6 * fract(f * 0.37) + 0.12 * sin(y * 3.0 + f), -4.0 + 0.5 * fract(f * 0.53));
    float r = 0.05 + 0.07 * fract(f * 0.29);
    vec3 oc = ro - c;
    float b = dot(oc, rd), cc = dot(oc, oc) - r * r, d = b * b - cc;
    if (d > 0.0) {
      float tt = -b - sqrt(d);
      if (tt > 0.0 && tt < tScene) {
        vec3 n = normalize(oc + rd * tt);
        float rim = pow(1.0 - abs(dot(n, rd)), 2.0);
        float spec = pow(max(dot(reflect(rd, n), SUN), 0.0), 40.0);
        float a = clamp(rim * 0.9 + spec, 0.0, 1.0) * exp(-0.06 * tt);
        acc = max(acc, vec4(vec3(0.75, 0.95, 1.0), a));
      }
    }
  }
  return acc;
}

void main() {
  float a = uPhase * TAU;
  vec3 ro = vec3(0.6 * sin(a), 2.0 + 0.2 * sin(2.0 * a), 7.5);
  vec3 fw = normalize(vec3(0.0, 3.4, 0.0) - ro), rt = normalize(cross(fw, vec3(0, 1, 0))), up = cross(rt, fw);
  vec3 col = vec3(0.0);
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 uv = (2.0 * (gl_FragCoord.xy + vec2(i, j) * 0.5 - 0.25) - uRes) / uRes.x;
    vec3 rd = normalize(rt * uv.x + up * uv.y + fw * 1.5);
    float tHit;
    vec3 c = render(ro, rd, hash12(gl_FragCoord.xy * 2.0 + vec2(i, j)), tHit);
    vec4 b = bubbles(ro, rd, tHit);
    col += mix(c, b.rgb, b.a);
  }
  col /= 4.0;
  col = 1.0 - exp(-col * 1.6);
  outColor = vec4(pow(col, vec3(0.9)), 1.0);
}`,
};
