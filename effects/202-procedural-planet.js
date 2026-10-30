// Procedural planet: one sphere, coloured from 3D noise sampled on its surface. fBm continents above a sea level,
// ridged noise for mountain ranges, height bands for beach, forest, desert, rock and snow, ice caps by latitude and
// bump normals from the height. A cloud shell turns with it and shades the ground, and an atmosphere rim glows on the
// day side. It turns once per loop on an axis tipped towards us; 8 samples per pixel, spread over a third of a frame
// of time, add a little motion blur so the turning detail stays smooth.
export default {
  name: 'Procedural Planet',
  ko: '절차적 행성',
  frag: `
const vec3 SUN = vec3(-0.80, 0.42, 0.43);
mat3 spin;   // world -> planet space (tilted axis, turning)

float fbm4(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * snoise(p); p *= 2.03; a *= 0.5; } return s; }
float terrain(vec3 q) {
  float c = fbm4(q * 0.95 + vec3(3.1, 1.7, 0.4)) + 0.06 * snoise(q * 16.0) + 0.03 * snoise(q * 32.0) - 0.04;   // continents above sea level 0
  float r = 1.0 - abs(snoise(q * 2.6 + vec3(7.0)));                          // ridged noise: mountain chains
  float land = smoothstep(0.0, 0.2, c);
  return c + 0.22 * r * r * r * land;
}
float clouds(vec3 q) {
  vec3 w = q + 0.14 * vec3(snoise(q * 1.6 + 11.0), snoise(q * 1.6 + 23.0), snoise(q * 1.6 + 37.0));   // swirls
  w += 0.05 * vec3(loopXY(1.0), 0.0);                                        // a slow drift that comes back each loop
  float f = fbm4(w * 2.0 + vec3(5.0, 2.0, 9.0)) + 0.07 * snoise(w * 22.0);
  return smoothstep(0.14, 0.42, f) * (0.55 + 0.45 * smoothstep(0.0, 0.4, abs(q.y)));
}
vec3 surfaceColor(vec3 q, float h, out float ocean) {
  ocean = 1.0 - smoothstep(-0.004, 0.004, h);
  float lat = abs(q.y) + 0.06 * snoise(q * 4.0);
  vec3 sea = mix(vec3(0.06, 0.45, 0.58), vec3(0.015, 0.07, 0.22), smoothstep(0.0, 0.16, -h));
  float dry = smoothstep(0.05, 0.3, snoise(q * 1.8 + 4.0) + 0.15 * snoise(q * 7.0)) * (1.0 - smoothstep(0.5, 0.75, lat));
  vec3 land = mix(vec3(0.18, 0.40, 0.14), vec3(0.74, 0.58, 0.32), dry);     // forest or desert
  land = mix(vec3(0.86, 0.80, 0.58), land, smoothstep(0.0, 0.025, h));       // beach
  land = mix(land, vec3(0.40, 0.33, 0.27), smoothstep(0.16, 0.30, h));       // rock
  land = mix(land, vec3(0.88, 0.88, 0.90), smoothstep(0.44, 0.52, h));       // snow on the highest peaks
  vec3 col = mix(land, sea, ocean);
  float ice = smoothstep(0.93, 0.95, lat);
  ocean *= 1.0 - ice;
  return mix(col, vec3(0.92, 0.96, 1.0), ice);
}
// returns colour and how much of the sample the planet + atmosphere covers (for the stars behind)
vec4 render(vec2 uv) {
  vec3 ro = vec3(0.0, 0.0, 3.9), rd = normalize(vec3(uv, -2.6));
  vec3 l = normalize(SUN);
  float b = dot(ro, rd), c = dot(ro, ro) - 1.0, disc = b * b - c;
  float closest = length(ro - rd * b);                                         // nearest approach of the ray to the centre
  float lit = smoothstep(-0.35, 0.6, dot(normalize(ro - rd * b), l));
  vec3 rim = vec3(0.35, 0.62, 1.0) * (exp(-abs(closest - 1.0) / 0.03) + 0.25 * exp(-max(closest - 1.0, 0.0) / 0.12)) * lit;
  if (disc < 0.0) return vec4(rim * 1.3, clamp(length(rim), 0.0, 1.0));
  vec3 p = ro + rd * (-b - sqrt(disc)), q = spin * p;
  float h = terrain(q), ocean;
  vec3 alb = surfaceColor(q, h, ocean);
  // bump normal from the height's change along two tangent directions (land only; the sea is smooth)
  vec3 n = p;
  if (h > 0.0) {
    vec3 t1 = normalize(cross(q, vec3(0.0, 1.0, 0.0001))), t2 = cross(q, t1);
    float e = 0.01;
    float hx = terrain(normalize(q + t1 * e)) - h, hy = terrain(normalize(q + t2 * e)) - h;
    n = transpose(spin) * normalize(q - 0.02 * (t1 * hx + t2 * hy) / e);
  }
  float ndl = max(dot(n, l), 0.0), day = smoothstep(-0.1, 0.25, dot(p, l));
  float cl = clouds(q), cs = clouds(spin * normalize(p + l * 0.04));         // clouds, and their shadow on the ground
  vec3 col = alb * (ndl * day * (1.0 - 0.55 * cs) * vec3(1.2, 1.1, 1.0) + vec3(0.02, 0.025, 0.045));
  float spe = pow(max(dot(reflect(-l, p), -rd), 0.0), 50.0) * ocean * day * (1.0 - cl);
  col += vec3(1.0, 0.88, 0.72) * spe * 0.7;
  col = mix(col, vec3(1.0, 0.99, 0.97) * (max(dot(p, l), 0.0) * 1.1 + 0.015), cl * 0.9);
  float fres = pow(1.0 - max(dot(p, -rd), 0.0), 2.5);
  col += vec3(0.30, 0.55, 1.0) * fres * lit * 0.8 + rim * 0.3;
  return vec4(col, 1.0);
}
void main() {
  mat3 tilt = mat3(1, 0, 0, 0, cos(0.8), sin(0.8), 0, -sin(0.8), cos(0.8)) * mat3(cos(0.35), sin(0.35), 0, -sin(0.35), cos(0.35), 0, 0, 0, 1);   // the north pole leans towards us
  vec4 acc = vec4(0.0);
  for (int k = 0; k < 8; k++) {
    float fk = float(k);
    float a = (uTime + (fk + 0.5) / 8.0 / 90.0) / 5.0 * TAU;                // 8 moments within a third of a frame
    spin = mat3(cos(a), 0, -sin(a), 0, 1, 0, sin(a), 0, cos(a)) * transpose(tilt);
    vec2 jit = fract(vec2(fk * 0.618034, fk * 0.381966 + 0.5)) - 0.5;         // and 8 spots inside the pixel
    vec2 uv = (2.0 * (gl_FragCoord.xy + jit) - uRes) / uRes.x;
    acc += render(uv + vec2(0.0, 0.06));
  }
  acc /= 8.0;
  // the sky behind: a faint nebula and fixed stars, both tied to the screen
  vec2 fc = gl_FragCoord.xy;
  vec3 sky = mix(vec3(0.010, 0.012, 0.030), vec3(0.045, 0.025, 0.075), smoothstep(0.2, 1.0, fc.y / uRes.y));
  sky += vec3(0.10, 0.05, 0.16) * smoothstep(0.1, 0.8, fbm(vec3(fc / 700.0, 1.3))) * 0.6;
  vec2 cell = floor(fc / 9.0), off = hash22(cell) * 9.0;
  float star = step(0.93, hash12(cell + 17.0)) * exp(-dot(fc - cell * 9.0 - off, fc - cell * 9.0 - off) / 1.4);
  sky += vec3(0.9, 0.92, 1.0) * star * (0.3 + 0.7 * hash12(cell + 3.0));
  vec3 col = acc.rgb + sky * (1.0 - clamp(acc.a, 0.0, 1.0));
  col = 1.0 - exp(-col * 1.25);
  col = pow(col, vec3(0.9));
  outColor = vec4(col + grain(fc) / 255.0, 1.0);
}`,
};
