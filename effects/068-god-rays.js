// God rays (volumetric light scattering, as in GPU Gems 3): the sun sits behind a broken cloud layer; each pixel
// marches toward the sun adding up the sunlight that gets through the drifting clouds, so the gaps cast shafts.
export default {
  name: 'God Rays',
  ko: '빛내림',
  frag: `
const vec2 SUN = vec2(0.5, 1.34);   // x-width units from the bottom left: about 470 px from the top

float cloudRaw(vec2 p, int oct) {   // > 0 inside a cloud
  vec2 L = loopXY(0.2);
  vec3 q = vec3(p * vec2(2.6, 4.6) + L, 2.0);
  float n = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { if (i >= oct) break; n += a * snoise(q); q *= 2.03; a *= 0.5; }
  float band = smoothstep(0.95, 1.25, p.y + 0.12 * n);               // the layer covers the upper part
  float thick = 0.16 + 0.22 * exp(-length(p - SUN) * 6.0);           // denser over the sun: only small holes there
  return (n + thick) * band - (1.0 - band) * 0.3;
}
float sun(vec2 p) { float d = length(p - SUN); return exp(-d * 9.0) + 2.0 * exp(-d * 40.0); }

void main() {
  vec2 p = gl_FragCoord.xy / uRes.x;
  const int N = 40;
  vec2 delta = (p - SUN) * (0.97 / float(N));
  vec2 q = p - delta * hash12(gl_FragCoord.xy);   // fixed per-pixel start offset hides step bands
  float shafts = 0.0, decay = 1.0;
  for (int i = 0; i < N; i++) {
    q -= delta;
    shafts += (1.0 - smoothstep(-0.03, 0.05, cloudRaw(q, 3))) * sun(q) * decay;
    decay *= 0.97;
  }
  shafts *= 4.6 / float(N);

  float dist = length(p - SUN);
  vec3 col = mix(vec3(0.05, 0.05, 0.11), vec3(0.09, 0.09, 0.18), smoothstep(0.2, 1.6, p.y));
  col += vec3(1.0, 0.7, 0.4) * 0.8 * sun(p) + vec3(0.32, 0.16, 0.18) * exp(-abs(p.y - 0.4) * 4.0);   // warm horizon
  float raw = cloudRaw(p, 5), c = smoothstep(-0.05, 0.1, raw);
  vec3 cloudCol = mix(vec3(0.2, 0.18, 0.27), vec3(0.11, 0.1, 0.17), smoothstep(0.0, 0.5, raw));   // thin parts lighter
  cloudCol += vec3(1.0, 0.72, 0.4) * (1.0 - smoothstep(0.0, 0.3, raw)) * 2.0 * exp(-dist * 7.0);   // gold rims near the sun
  col = mix(col, cloudCol, c);
  float below = smoothstep(-0.15, 0.2, SUN.y - p.y);                  // the shafts fall downward from the sun
  col += vec3(1.0, 0.8, 0.5) * shafts * (1.0 - 0.8 * c) * (0.25 + 0.75 * below);

  // hills at the bottom catch the light
  float hill1 = 0.32 + 0.05 * sin(p.x * 5.0 + 1.0) + 0.03 * sin(p.x * 11.0);
  float hill2 = 0.2 + 0.04 * sin(p.x * 4.0 + 3.0) + 0.02 * sin(p.x * 13.0 + 2.0);
  float aa = 1.5 / uRes.x;
  col = mix(col, vec3(0.08, 0.07, 0.13) + vec3(0.45, 0.32, 0.15) * shafts, smoothstep(hill1 + aa, hill1 - aa, p.y));
  col = mix(col, vec3(0.04, 0.035, 0.07), smoothstep(hill2 + aa, hill2 - aa, p.y));
  col = 1.0 - exp(-col * 1.3);   // soft tone curve, so the sun does not blow out
  outColor = vec4(col, 1.0);
}`,
};
