// Slit-scan / time displacement: each row of the frame shows the scene at a different moment (time = t + y * k),
// so a turning, swaying flower and straight sliding stripes smear into twisted, wavy shapes.
// The thin outline is the flower as it really is right now.
export default {
  name: 'Slit-Scan',
  ko: '슬릿 스캔',
  frag: `
float sway(float time) { return 0.2 * sin(time / 5.0 * TAU * 2.0); }

// the flower at a given time: returns colour in rgb, coverage in a
vec4 flower(vec2 p, float time) {
  float a = time / 5.0 * TAU;
  vec2 q = rot(a) * (p - vec2(sway(time), 0.0));
  float ang = atan(q.y, q.x), r = length(q);
  float edge = 0.3 + 0.1 * cos(5.0 * ang);
  float aa = 0.004;
  float cover = smoothstep(edge + aa, edge - aa, r);
  vec3 col = pal(ang / TAU + 0.15 * r, vec3(0.6, 0.5, 0.55), vec3(0.4, 0.4, 0.4), vec3(1.0), vec3(0.0, 0.33, 0.6));
  col = mix(col, vec3(1.0, 0.95, 0.85), smoothstep(0.07, 0.05, r));
  col *= 0.8 + 0.25 * smoothstep(edge, 0.0, r);
  return vec4(col, cover);
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.x;   // centre 0, y about -0.89 .. 0.89
  float time = uTime + p.y * 2.6;                      // this row's moment
  vec3 col = mix(vec3(0.05, 0.05, 0.12), vec3(0.12, 0.06, 0.2), 0.5 + p.y);
  // stripes that only slide sideways: straight in any one moment, waves across moments
  float sx = (p.x - 0.5 * sway(time)) * 9.0;
  float st = abs(fract(sx) - 0.5);
  col = mix(col, vec3(0.2, 0.18, 0.36), smoothstep(0.16 + fwidth(sx), 0.16, st));
  vec4 f = flower(p, time);
  col = mix(col, f.rgb, f.a);
  // the real, undistorted flower right now: a thin outline
  vec2 q = rot(uPhase * TAU) * (p - vec2(sway(uTime), 0.0));
  float d = length(q) - (0.3 + 0.1 * cos(5.0 * atan(q.y, q.x)));
  float w = fwidth(d);
  col = mix(col, vec3(1.0), 0.75 * smoothstep(0.0025 + w, 0.0025, abs(d)));
  outColor = vec4(col, 1.0);
}`,
};
