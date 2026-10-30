// Subsurface scattering: a raymarched wax rabbit lit by a warm lamp that swings behind it. For every visible point the
// shader marches inside the body towards the lamp to measure how thick it is there, and lets light through with
// exp(-thickness · σ), σ smaller for red: the thin ears and edges glow orange, the thick body stays milky. 2x2 samples.
export default {
  name: 'Subsurface Scattering',
  ko: '서브서피스 스캐터링',
  frag: `
float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float sdEll(vec3 p, vec3 r) { float k0 = length(p / r), k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
float sdEll2(vec2 p, vec2 r) { float k0 = length(p / r), k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
// an ear: a thin cupped slab, 0.09 thick with a thicker ridge down the middle, elliptic outline
float sdEar(vec3 q) {
  q.z += 1.1 * q.x * q.x;
  vec2 w = vec2(sdEll2(q.xy, vec2(0.13, 0.6)), abs(q.z));
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - 0.045 - 0.022 * exp(-q.x * q.x / 0.0009);
}

const float FLOOR = -1.2;
// the rabbit, facing +z, turned 20° towards the right of the frame
float map(vec3 p) {
  p.xz = rot(-0.35) * p.xz;
  float d = sdEll(p - vec3(0.0, -0.4, -0.15), vec3(0.88, 0.82, 1.02));            // body
  d = smin(d, sdEll(p - vec3(0.0, 0.08, 0.35), vec3(0.58, 0.62, 0.55)), 0.3);       // chest
  d = smin(d, sdEll(p - vec3(0.0, 0.82, 0.62), vec3(0.47, 0.43, 0.5)), 0.25);       // head
  d = smin(d, sdEll(p - vec3(0.0, 0.7, 1.04), vec3(0.24, 0.19, 0.17)), 0.12);       // muzzle
  d = smin(d, length(p - vec3(0.0, -0.55, -1.13)) - 0.26, 0.12);                    // tail
  for (int i = 0; i < 2; i++) {
    float s = float(i) * 2.0 - 1.0;
    vec3 q = p - vec3(0.2 * s, 1.1, 0.45);
    q.xy = rot(-0.3 * s) * q.xy;                                                     // ears lean outwards
    q.yz = rot(-0.38) * q.yz;                                                        // and back
    d = smin(d, sdEar(q - vec3(0.0, 0.62, 0.0)), 0.08);
    d = smin(d, sdEll(p - vec3(0.3 * s, -1.06, 0.78), vec3(0.16, 0.13, 0.28)), 0.12); // front paws
    d = smin(d, sdEll(p - vec3(0.55 * s, -1.08, 0.12), vec3(0.24, 0.13, 0.5)), 0.16); // hind feet
  }
  return max(d, FLOOR - p.y);
}
vec3 normal(vec3 p) {
  vec2 e = vec2(0.001, -0.001);
  return normalize(e.xyy * map(p + e.xyy) + e.yyx * map(p + e.yyx) + e.yxy * map(p + e.yxy) + e.xxx * map(p + e.xxx));
}
// how far light travels inside the wax on its way from the lamp to p (every part it passes through counts)
float thickness(vec3 p, vec3 l, float maxT) {
  float t = 0.0, inside = 0.0;
  for (int i = 0; i < 128; i++) {
    float d = map(p + l * t), s = clamp(abs(d) * 0.7, 0.012, 0.25);
    inside += s * clamp(0.5 - d / 0.04, 0.0, 1.0);                                 // soft at the surface: no contour steps
    t += s;
    if (t > maxT) break;
  }
  return inside;
}
float shadow(vec3 ro, vec3 rd, float maxT) {
  float res = 1.0, t = 0.04;
  for (int i = 0; i < 64; i++) { float h = map(ro + rd * t); res = min(res, 8.0 * h / t); t += clamp(h, 0.01, 0.2); if (h < 0.0005 || t > maxT) break; }
  return clamp(res, 0.0, 1.0);
}
vec3 render(vec2 uv, vec3 lp) {
  vec3 ro = vec3(0.0, 0.55, 7.0), rd = normalize(vec3(uv * 0.66, -2.4));
  rd.yz = rot(-0.07) * rd.yz;
  vec3 lc = vec3(1.0, 0.72, 0.45) * 2.6;                                             // warm lamp
  vec3 bg = mix(vec3(0.012, 0.012, 0.02), vec3(0.035, 0.03, 0.045), smoothstep(-0.4, 0.6, rd.y));
  // the figure: march only inside its bounding sphere
  float t = 1e3;
  vec3 oc = ro - vec3(0.0, 0.4, 0.0);
  float b = dot(oc, rd), c = dot(oc, oc) - 2.6 * 2.6, h = b * b - c;
  if (h > 0.0) {
    float s = max(-b - sqrt(h), 0.0), e = -b + sqrt(h);
    for (int i = 0; i < 160; i++) { float d = map(ro + rd * s); if (d < 0.0003 * s) { t = s; break; } s += 0.85 * d; if (s > e) break; }
  }
  float tf = rd.y < 0.0 ? (FLOOR - ro.y) / rd.y : 1e3;
  vec3 col = bg;
  if (t < 1e3) {
    vec3 p = ro + rd * t, n = normal(p), l = normalize(lp - p);
    float ndl = dot(n, l), sh = shadow(p + n * 0.01, l, length(lp - p));
    vec3 alb = vec3(0.95, 0.88, 0.78);
    float wrap = max((ndl + 0.35) / 1.35, 0.0) * sh;                                   // wax: light wraps a little round
    float th = thickness(p - n * 0.004, l, min(length(lp - p), 4.0));
    vec3 trans = 0.88 * exp(-th * vec3(4.5, 14.0, 24.0)) + 0.12 * exp(-th * vec3(1.6, 3.6, 6.5)); // red goes furthest
    float fwd = 0.35 + 0.65 * pow(max(dot(rd, l), 0.0), 2.0);                         // brighter looking into the lamp
    float ao = clamp(0.4 + 0.6 * map(p + n * 0.18) / 0.18, 0.0, 1.0);
    col = alb * lc * wrap * 0.55;
    col += lc * alb * vec3(1.0, 0.7, 0.5) * trans * fwd * 0.8;
    col += alb * vec3(0.09, 0.085, 0.09) * ao * (0.6 + 0.4 * n.y);                    // dim room light
    col += alb * vec3(0.07, 0.085, 0.12) * max(dot(n, normalize(vec3(-0.6, 0.5, 0.7))), 0.0) * ao; // cool fill
    col += lc * 0.25 * pow(max(dot(reflect(-l, n), -rd), 0.0), 24.0) * sh;
  } else if (tf < 60.0) {
    vec3 p = ro + rd * tf, l = normalize(lp - p);
    float dist = length(lp - p);
    float pool = max(l.y, 0.0) * shadow(p + vec3(0.0, 0.01, 0.0), l, dist) / (1.0 + 0.12 * dist * dist);
    col = vec3(0.05, 0.045, 0.05) + vec3(0.5, 0.38, 0.28) * lc * pool * 0.35;
    col = mix(col, bg, smoothstep(6.0, 22.0, tf));
  }
  // the lamp itself: a small glowing orb, hidden where the rabbit or the floor is in front of it
  float tl = dot(lp - ro, rd);
  if (tl > 0.0 && tl < min(t, tf)) {
    float dl = length(ro + rd * tl - lp);
    col += lc * (smoothstep(0.09, 0.06, dl) * 2.0 + 0.05 * exp(-dl * 2.2));
  }
  return col;
}
void main() {
  float a = uPhase * TAU, phi = 1.9 * sin(a);                                       // 0 = right behind the rabbit
  vec3 lp = vec3(2.7 * sin(phi), 1.25, -2.7 * cos(phi));
  vec3 col = vec3(0.0);
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 uv = (2.0 * (gl_FragCoord.xy + vec2(i, j) * 0.5 - 0.25) - uRes) / uRes.x;
    col += render(uv, lp);
  }
  col /= 4.0;
  col = col * (2.51 * col + 0.03) / (col * (2.43 * col + 0.59) + 0.14);              // ACES-style curve
  outColor = vec4(pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2)) + grain(gl_FragCoord.xy) / 255.0, 1.0);
}`,
};
