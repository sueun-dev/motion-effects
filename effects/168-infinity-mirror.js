// Infinity mirror: a round box with a half-silvered front glass and a full mirror at the back, with a ring of LEDs
// on the inner wall. Light bounces between the two mirrors, so each bounce adds another, dimmer ring further back.
// The ray is traced "unfolded": instead of bouncing, it runs straight down a tube in which the rings repeat every
// box depth, losing a little light at each mirror. The camera circles, so the tunnel swings round.
export default {
  name: 'Infinity Mirror',
  ko: '무한 거울',
  frag: `
const float RM = 0.82;     // opening radius = inner wall
const float RO = 0.96;     // outer edge of the metal bezel
const float D = 0.19;      // box depth (front glass to back mirror)
const float NB = 48.0;     // LEDs in the ring
const float RB = 0.79;     // LED ring radius (just inside the wall)
const float BACK = 0.94;   // back mirror reflectance
const float FRONT = 0.8;   // front (half-silvered) glass reflectance from inside

vec3 ledColor(float th) {  // two-tone neon gradient that turns once per loop, with three brighter comets
  float a = uPhase * TAU;
  vec3 c = mix(vec3(1.0, 0.16, 0.52), vec3(0.15, 0.85, 1.0), 0.5 + 0.5 * cos(2.0 * th - a));
  c = mix(c, vec3(1.0, 0.72, 0.25), 0.35 * pow(0.5 + 0.5 * cos(2.0 * th + a + 2.0), 6.0));
  float comet = pow(0.5 + 0.5 * cos(3.0 * th - 2.0 * a), 5.0);
  return c * (0.45 + 1.4 * comet);
}

vec3 wallAndMirror(vec3 ro, vec3 rd) {
  float pxa = 2.0 / uRes.x / 2.3;                        // one pixel as an angle
  float t0 = -ro.z / rd.z;
  vec3 e = ro + rd * t0;                                 // where the ray meets the wall / front glass (z = 0)
  float r = length(e.xy), th = atan(e.y, e.x);
  vec3 col = vec3(0.0);
  if (r > RM) {
    // the wall: deep slate, lit by a soft lamp from above and by the ring's own spill
    vec3 wall = vec3(0.035, 0.04, 0.06) * (0.7 + 0.6 * smoothstep(-2.5, 2.0, e.y)) * (1.0 + 0.07 * snoise(vec3(e.xy * 1.6, 1.0)));
    wall += ledColor(th) * 0.16 * exp(-(r - RO) * 3.2) * step(RO, r);
    if (r < RO) {                                        // brushed bezel: a half-round profile
      float u = (r - 0.5 * (RM + RO)) / (0.5 * (RO - RM));
      vec3 n = normalize(vec3(normalize(e.xy) * u, sqrt(max(1.0 - u * u, 0.0))));
      vec3 h = normalize(normalize(vec3(-0.5, 1.2, 1.4)) - rd);
      float spec = pow(max(dot(n, h), 0.0), 40.0);
      wall = vec3(0.09, 0.09, 0.11) * (0.4 + 0.6 * n.z) + vec3(0.9, 0.88, 0.85) * spec * 0.55;
      wall += ledColor(th) * 0.35 * smoothstep(0.3, -1.0, u);   // the LEDs light the inner lip
    }
    return wall;
  }
  // inside: the unfolded tube. Where does the ray hit the side wall?
  vec2 dxy = rd.xy;
  float A = dot(dxy, dxy), B = 2.0 * dot(e.xy, dxy), C = dot(e.xy, e.xy) - RM * RM;
  float s = (-B + sqrt(max(B * B - 4.0 * A * C, 0.0))) / (2.0 * A);
  float zw = e.z + s * rd.z;                             // depth of the wall hit (negative)
  float T = 0.32;                                        // light that gets through the half mirror to the eye
  for (int m = 0; m < 46; m++) {
    float fm = float(m), zm = -D * (fm + 0.5);
    if (zm < zw - 0.02) break;
    float thr = T * pow(BACK, floor((fm + 1.0) * 0.5)) * pow(FRONT, floor(fm * 0.5));
    vec2 q = e.xy + rd.xy * ((zm - e.z) / rd.z);
    float j0 = floor(atan(q.y, q.x) / TAU * NB + 0.5);
    for (int k = -1; k <= 1; k++) {
      float a = (j0 + float(k)) * TAU / NB;
      vec3 c = vec3(RB * cos(a), RB * sin(a), zm);
      vec3 v = c - ro;
      float tc = dot(v, rd);
      float ang = length(v - rd * tc) / tc;              // angle between the ray and the LED
      float size = max(0.011 / tc, 1.3 * pxa);           // never smaller than about a pixel
      float bright = (0.011 / tc) * (0.011 / tc) / (size * size);
      col += ledColor(a) * thr * (2.6 * bright * exp(-ang * ang / (size * size)) + 0.06 * exp(-ang / (size * 6.0)));
    }
    // the dark wall between rings catches a little of each ring's light
    float dz = zw - zm;
    col += ledColor(atan(e.y + s * rd.y, e.x + s * rd.x)) * thr * 0.3 * exp(-dz * dz / 0.004) * step(zw, zm + 0.06);
  }
  // the front glass also reflects a faint softbox from the room
  vec3 rr = reflect(rd, vec3(0.0, 0.0, 1.0));
  col += vec3(0.6, 0.65, 0.8) * 0.05 * smoothstep(0.35, 0.0, abs(rr.x + 0.25)) * smoothstep(0.1, 0.5, rr.y);
  return col;
}

const float FLOOR = -1.2;
vec3 render(vec3 ro, vec3 rd) {
  float tf = rd.y < 0.0 ? (FLOOR - ro.y) / rd.y : 1e3;
  vec3 pf = ro + rd * tf;
  if (pf.z < 0.0) return wallAndMirror(ro, rd);
  // a polished dark floor: it mirrors the wall and the mirror (Fresnel-weighted) and catches the ring's glow
  vec3 col = vec3(0.02, 0.022, 0.03) * (1.0 + 0.1 * snoise(vec3(pf.xz * vec2(1.5, 4.0), 3.0)));
  for (int k = 0; k < 12; k++) {
    float a = float(k) * TAU / 12.0;
    vec3 l = vec3(RB * cos(a), RB * sin(a), -0.05) - pf;
    col += ledColor(a) * 0.012 * max(l.y, 0.0) / pow(dot(l, l), 1.5);
  }
  float fre = 0.12 + 0.5 * pow(1.0 - abs(rd.y), 5.0);
  return col + fre * wallAndMirror(pf, reflect(rd, vec3(0.0, 1.0, 0.0)));
}

void main() {
  float a = uPhase * TAU;
  vec3 ro = vec3(0.42 * cos(a), -0.1 + 0.42 * sin(a), 2.65);   // the camera circles in front of the mirror
  vec3 target = vec3(0.0, -0.1, 0.0);
  vec3 fw = normalize(target - ro), rt = normalize(cross(fw, vec3(0, 1, 0))), up = cross(rt, fw);
  vec3 col = vec3(0.0);
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 uv = (2.0 * (gl_FragCoord.xy + vec2(i, j) * 0.5 - 0.25) - uRes) / uRes.x;
    vec3 rd = normalize(rt * uv.x + up * (uv.y + 0.18) + fw * 2.3);
    col += render(ro, rd);
  }
  col /= 4.0;
  col = 1.0 - exp(-col * 1.6);                           // soft tone curve
  outColor = vec4(pow(col, vec3(0.85)), 1.0);
}`,
};
