// Atmospheric scattering seen from orbit: single scattering of sunlight in a planet's air, raymarched. Rayleigh
// scattering (much stronger for blue: coefficients 1 : 2.3 : 5.7 for red, green, blue) turns the sky band blue;
// Mie scattering from haze makes a bright forward glow around the sun. Light that crosses a lot of air on its way
// (at sunset, through the limb) has lost its blue, so it arrives orange and red. The sun sinks behind the planet
// and rises again (day -> sunset -> eclipse ring -> day).
export default {
  name: 'Atmospheric Scattering',
  ko: '대기 산란',
  frag: `
const float RP = 1.0, RA = 1.45;                // planet and top of the atmosphere
const float HR = 0.045, HM = 0.01;              // scale heights (exaggerated so the sky band is thick)
const vec3 BR = vec3(1.75, 4.0, 10.0);          // Rayleigh scattering per unit length (red, green, blue)
const float BM = 2.5;                           // Mie scattering (haze), grey
const vec3 CAM = vec3(0.0, 0.0, 1.75);

vec2 sphere(vec3 ro, vec3 rd, float r) {        // ray-sphere entry and exit distances (-1 if missed)
  float b = dot(ro, rd), c = dot(ro, ro) - r * r, h = b * b - c;
  if (h < 0.0) return vec2(-1.0);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}
vec2 dens(vec3 p) { float h = max(length(p) - RP, 0.0); return vec2(exp(-h / HR), exp(-h / HM)); }
// optical depth (Rayleigh, Mie) from p toward the sun; large if the planet is in the way
vec2 sunDepth(vec3 p, vec3 s) {
  vec2 g = sphere(p, s, RP);
  if (g.x > 0.0) return vec2(1e3);
  float L = sphere(p, s, RA).y, dl = L / 8.0;
  vec2 od = vec2(0.0);
  for (int i = 0; i < 8; i++) od += dens(p + s * (dl * (float(i) + 0.5))) * dl;
  return od;
}
vec3 ground(vec3 n) {                           // oceans, land and cloud from fixed noise on the sphere
  float land = fbm(n * 2.2 + 3.0), cl = fbm(n * 4.0 + vec3(7.0, 1.0, 2.0));
  vec3 c = mix(vec3(0.015, 0.05, 0.13), vec3(0.24, 0.21, 0.1), smoothstep(0.05, 0.12, land));
  c = mix(c, vec3(0.12, 0.2, 0.07), smoothstep(0.12, 0.3, land) * 0.6);
  return mix(c, vec3(0.9), smoothstep(0.1, 0.45, cl) * 0.85);
}

void main() {
  vec2 uv = (2.0 * gl_FragCoord.xy - uRes) / uRes.x;
  float a = uPhase * TAU;
  // the sun swings from behind the camera (120 deg: the face we see is in daylight) over the top to behind the
  // planet (30 deg) and back; it is in the frame below about 74 deg and touches the limb at about 40 deg
  float el = radians(75.0 + 45.0 * sin(a));     // day at 1.25 s, behind the planet at 3.75 s
  vec3 s = normalize(vec3(sin(radians(10.0)), sin(el), -cos(el)));
  vec3 fw = normalize(vec3(0.0, sin(radians(22.0)), -cos(radians(22.0))));   // look 22 deg above the planet centre
  vec3 rt = vec3(1.0, 0.0, 0.0), up = cross(rt, fw);
  vec3 rd = normalize(rt * uv.x + up * uv.y + fw * 1.4);
  float mu = dot(rd, s);

  // space: fixed stars and the sun disc with a soft glare
  vec3 q = rd * 80.0, cell = floor(q), f = fract(q) - 0.5;
  vec2 h = hash22(cell.xy + cell.z * 17.3);
  vec3 o = vec3(h, fract(h.x * 13.1 + h.y)) - 0.5;
  vec3 bg = vec3(0.0035, 0.004, 0.009) + vec3(0.8, 0.85, 1.0) * step(0.8, h.x) * exp(-dot(f - o * 0.6, f - o * 0.6) * 60.0) * h.y * 0.6;
  bg += vec3(1.0, 0.95, 0.88) * (40.0 * smoothstep(0.99975, 0.99985, mu) + 0.25 * pow(max(mu, 0.0), 400.0));

  vec2 at = sphere(CAM, rd, RA), pl = sphere(CAM, rd, RP);
  vec3 col = bg;
  if (at.x > 0.0 || at.y > 0.0) {
    float t0 = max(at.x, 0.0), t1 = pl.x > 0.0 ? pl.x : at.y;
    float dt = (t1 - t0) / 40.0;
    vec3 sumR = vec3(0.0), sumM = vec3(0.0);
    vec2 odV = vec2(0.0);
    for (int i = 0; i < 40; i++) {
      vec3 p = CAM + rd * (t0 + dt * (float(i) + 0.5));
      vec2 d = dens(p) * dt;
      odV += d;
      vec2 odL = sunDepth(p, s);
      vec3 tr = exp(-(BR * (odV.x + odL.x) + BM * 1.1 * (odV.y + odL.y)));
      sumR += tr * d.x;
      sumM += tr * d.y;
    }
    float g = 0.8;
    float phR = 3.0 / (16.0 * PI) * (1.0 + mu * mu);
    float phM = 3.0 / (8.0 * PI) * ((1.0 - g * g) * (1.0 + mu * mu)) / ((2.0 + g * g) * pow(1.0 + g * g - 2.0 * g * mu, 1.5));
    vec3 inscatter = 22.0 * (sumR * BR * phR + sumM * BM * phM);
    vec3 viewTr = exp(-(BR * odV.x + BM * 1.1 * odV.y));
    if (pl.x > 0.0) {                            // the surface: lit by sunlight that crossed the air
      vec3 p = CAM + rd * pl.x, n = normalize(p);
      vec2 odL = sunDepth(p + n * 0.001, s);
      vec3 sun = exp(-(BR * odL.x + BM * 1.1 * odL.y)) * max(dot(n, s), 0.0);
      vec3 c = ground(n) * (sun * 4.0 + 0.008);
      float lights = smoothstep(0.5, 0.75, fbm(n * 14.0)) * smoothstep(0.05, 0.12, fbm(n * 2.2 + 3.0));
      c += vec3(1.0, 0.62, 0.3) * lights * 0.25 * smoothstep(0.0, -0.15, dot(n, s));   // city lights on the night side
      vec3 hv = normalize(s - rd);
      c += sun * 1.6 * pow(max(dot(n, hv), 0.0), 120.0) * (1.0 - smoothstep(0.05, 0.12, fbm(n * 2.2 + 3.0)));   // sun glint on the sea
      col = c * viewTr + inscatter;
    } else {
      col = bg * viewTr + inscatter;
    }
  }
  col = 1.0 - exp(-col * 1.2);
  outColor = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);
}`,
};
