// Kaleidoscope: the plane is folded in polar coordinates into 8 mirrored wedges (angle -> |mod(angle) - half|),
// so a drifting field of jewel dots and rings repeats as a turning mandala.
export default {
  name: 'Kaleidoscope',
  ko: '만화경',
  frag: `
const float N = 8.0;

vec3 jewels(vec2 s) {
  vec3 col = pal(0.55 + 0.35 * snoise(vec3(s * 0.45, 3.0)), vec3(0.32, 0.16, 0.36), vec3(0.22, 0.14, 0.24), vec3(1.0), vec3(0.85, 0.15, 0.35));
  for (int k = 0; k < 2; k++) {             // two lattices of dots, the second finer and shifted
    float sc = k == 0 ? 1.5 : 2.5;
    vec2 g = s * sc + float(k) * 0.37, id = floor(g), f = fract(g) - 0.5;
    float h = hash12(id + float(k) * 17.0);
    float rad = 0.16 + 0.22 * h;
    float d = length(f) - rad, aa = fwidth(d) + 0.004;
    vec3 c = pal(h, vec3(0.62, 0.5, 0.55), vec3(0.38, 0.4, 0.42), vec3(1.0), vec3(0.0, 0.18, 0.4));
    col = mix(col, c * (1.05 - 0.6 * length(f) / rad), 1.0 - smoothstep(-aa, aa, d));
    float ring = abs(d - 0.075) - 0.032;
    col = mix(col, vec3(1.0, 0.93, 0.78), (1.0 - smoothstep(-aa, aa, ring)) * 0.85);
  }
  return col;
}

void main() {
  vec2 p = (gl_FragCoord.xy - vec2(0.5, 0.47) * uRes) / uRes.x;
  float r = length(p);
  float seg = TAU / N;
  float a = atan(p.y, p.x) + uPhase * seg;  // turns one wedge per loop (a symmetry, so it loops)
  a = abs(mod(a, seg) - 0.5 * seg);         // mirror fold
  vec2 q = r * vec2(cos(a), sin(a));
  vec2 s = q * 2.0 + vec2(0.9, 0.4) + loopXY(0.15);
  vec3 col = jewels(s);
  col *= 0.35 + 0.75 * smoothstep(1.15, 0.15, r);           // vignette
  col += vec3(1.0, 0.85, 0.7) * 0.25 * exp(-r * r * 40.0);   // soft light in the middle
  outColor = vec4(col, 1.0);
}`,
};
