// Gravitational lensing: a black hole with a hot accretion disk. Each pixel's light ray is traced backwards and bent
// by the hole (Schwarzschild photon orbits: acceleration -1.5 h^2 x / r^5, with the event horizon at r = 1), so the
// far side of the disk shows up arched over and under the hole, a thin photon ring hugs the shadow and the stars
// behind slide around it. The near side of the disk comes toward us and is Doppler-boosted, the far side dims.
export default {
  name: 'Gravitational Lensing',
  ko: '중력 렌즈',
  frag: `
const float RIN = 2.6, ROUT = 11.0;   // disk edges, in horizon radii

// disk texture: streaks that rotate, one turn per loop inside; outside a pattern that repeats every half turn
// turns half as fast, so the inner disk overtakes the outer (blended between r = 4 and 7)
float diskNoise(float r, float ph, float k) {
  float a = k * ph - uPhase * TAU;
  return snoise(vec3(r * 2.2, 1.6 * cos(a), 1.6 * sin(a))) * 0.6 + snoise(vec3(r * 6.0, 3.5 * cos(a), 3.5 * sin(a))) * 0.4;
}
vec3 heat(float k) {   // blackbody-ish ramp: red -> orange -> pale yellow -> blue-white
  vec3 c = mix(vec3(0.9, 0.18, 0.04), vec3(1.0, 0.55, 0.18), smoothstep(0.1, 0.5, k));
  c = mix(c, vec3(1.0, 0.86, 0.62), smoothstep(0.5, 0.95, k));
  return mix(c, vec3(0.75, 0.85, 1.0), smoothstep(1.0, 1.6, k));
}
vec3 sky(vec3 d) {     // the background, read where the bent ray finally points
  vec3 col = vec3(0.004, 0.005, 0.012);
  float band = exp(-pow(dot(d, normalize(vec3(0.3, 1.0, -0.4))) * 3.0, 2.0));  // a faint milky band
  col += vec3(0.08, 0.06, 0.12) * band * (0.5 + 0.5 * snoise(d * 4.0)) + vec3(0.05, 0.03, 0.02) * band * band;
  for (int k = 0; k < 2; k++) {                           // stars: one per cell of a grid on the sphere
    vec3 q = d * (k == 0 ? 70.0 : 32.0);
    vec3 c = floor(q), f = fract(q) - 0.5;
    vec3 h = fract(sin(vec3(dot(c, vec3(127.1, 311.7, 74.7)), dot(c, vec3(269.5, 183.3, 246.1)), dot(c, vec3(113.5, 271.9, 124.6)))) * 43758.5453);
    float s = length(f - (h - 0.5) * 0.6);
    col += mix(vec3(1.0, 0.85, 0.7), vec3(0.7, 0.8, 1.0), h.z) * step(0.75, h.x) * exp(-s * s * 70.0) * (0.25 + 1.0 * h.y);
  }
  return col;
}

vec3 trace(vec3 ro, vec3 rd) {
  vec3 x = ro, v = rd;
  float h2 = dot(cross(x, v), cross(x, v));
  vec3 col = vec3(0.0);
  float T = 1.0, rmin = 1e3;
  for (int i = 0; i < 420; i++) {
    float r = length(x);
    rmin = min(rmin, r);
    if (r < 1.0) return col;                              // fell in: only what the disk added
    if (r > 40.0 && dot(x, v) > 0.0) break;               // escaped
    float dt = clamp(0.045 * r * r / (r + 2.0), 0.02, 1.2);
    v += -1.5 * h2 * x / pow(r, 5.0) * dt;
    vec3 xn = x + v * dt;
    if (x.y * xn.y < 0.0) {                               // crossed the disk plane
      vec3 pc = mix(x, xn, x.y / (x.y - xn.y));
      float rc = length(pc.xz);
      if (rc > RIN - 0.3 && rc < ROUT) {
        float ph = atan(pc.z, pc.x);
        float n = mix(diskNoise(rc, ph, 1.0), diskNoise(rc, ph, 2.0), smoothstep(4.0, 7.0, rc));
        float prof = pow(RIN / rc, 1.6) * smoothstep(RIN - 0.3, RIN + 0.4, rc) * smoothstep(ROUT, ROUT - 4.0, rc);
        vec3 vel = vec3(-sin(ph), 0.0, cos(ph)) * sqrt(0.5 / rc);   // Keplerian orbit
        float b = length(vel);
        float D = sqrt(1.0 - b * b) / (1.0 - dot(vel, -normalize(v)));   // Doppler factor toward the camera
        D *= sqrt(1.0 - 1.0 / rc);                                       // and gravitational redshift
        float k = (0.35 + 0.9 * prof) * D * (0.85 + 0.25 * n);
        float a = clamp(prof * (0.75 + 0.5 * n) * 1.4, 0.0, 0.95);
        col += T * a * heat(k) * pow(D, 3.0) * (0.7 + 2.6 * prof);
        T *= 1.0 - a;
      }
    }
    x = xn;
  }
  return col + T * sky(normalize(v)) * smoothstep(1.45, 1.8, rmin);   // rays that skimmed the photon sphere: too squeezed to show stars
}

void main() {
  float a = uPhase * TAU;
  float el = 0.13 + 0.06 * sin(a), az = 0.1 * sin(a + 1.0);   // the camera rises and falls and swings a little
  vec3 ro = 26.0 * vec3(cos(el) * sin(az), sin(el), cos(el) * cos(az));
  vec3 fw = normalize(-ro), rt = normalize(cross(fw, vec3(0, 1, 0))), up = cross(rt, fw);
  float roll = 0.32;                                        // the disk crosses the frame on a diagonal
  vec3 rt2 = cos(roll) * rt + sin(roll) * up, up2 = cos(roll) * up - sin(roll) * rt;
  vec3 col = vec3(0.0);
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 uv = (2.0 * (gl_FragCoord.xy + vec2(i, j) * 0.5 - 0.25) - uRes) / uRes.x;
    col += trace(ro, normalize(rt2 * uv.x + up2 * (uv.y + 0.12) + fw * 2.1));
  }
  col /= 4.0;
  col = 1.0 - exp(-col * 1.3);
  outColor = vec4(pow(col, vec3(0.9)), 1.0);
}`,
};
