// Three-point lighting: a plaster head on a plinth (raymarched distance fields) lit by the classic studio set-up.
// Each lamp is a small glowing card in the scene: a warm KEY high on the left models the face, a cool, weak FILL low on
// the right lifts the shadows, and a RIM behind on the right traces the outline off the dark backdrop. They go out,
// then come back one at a time (key, fill, rim) and hold together; every lamp has its own soft shadow.
import { TAU, phase, smoothstep, FONT } from '../lib/util.js';

const CENTER = [0, 1.55, 0];
// lamps: position, colour, strength, label
const LAMPS = [
  { p: [-0.62, 2.08, 0.72], name: 'KEY', ko: '키' },
  { p: [0.64, 1.12, 0.7], name: 'FILL', ko: '필' },
  { p: [0.8, 1.95, -1.0], name: 'RIM', ko: '림', above: true },
];
// how far each lamp is up (0..1): all on, all out, then key, fill and rim come back one by one
const level = t => {
  const out = 1 - smoothstep(0.45, 0.95, t);
  return [1.3, 2.2, 3.1].map(s => Math.max(out, smoothstep(s, s + 0.6, t)));
};
// the camera drifts a little round the head
const cam = t => {
  const th = -0.12 + 0.08 * Math.sin(phase(t) * TAU);
  return [CENTER[0] + 2.75 * Math.sin(th), 1.55, CENTER[2] + 2.75 * Math.cos(th)];
};
const FOCAL = 2.3;
const TARGET = [0, 1.28, 0]; // the camera looks a little below the face, so the plinth is in frame

export default {
  name: 'Three-Point Lighting',
  ko: '3점 조명',
  uniforms: t => {
    const w = level(t);
    return { uRo: cam(t), uW: w, uK: LAMPS[0].p, uF: LAMPS[1].p, uR: LAMPS[2].p };
  },
  frag: `
uniform vec3 uRo, uW, uK, uF, uR;
const vec3 CEN = vec3(0.0, 1.55, 0.0);
const float FOCAL = ${FOCAL.toFixed(2)};
float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float smax(float a, float b, float k) { return -smin(-a, -b, k); }
float sdEll(vec3 p, vec3 r) { float k0 = length(p / r), k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
float sdCap(vec3 p, vec3 a, vec3 b, float r) { vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
float sdBox(vec3 p, vec3 b, float r) { vec3 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r; }

float bust(vec3 p) {
  vec3 q = vec3(abs(p.x), p.y, p.z);                                          // mirrored, for paired features
  float d = sdEll(p - vec3(0.0, 1.71, -0.05), vec3(0.31, 0.36, 0.38));        // skull
  d = smin(d, sdEll(p - vec3(0.0, 1.47, 0.07), vec3(0.25, 0.32, 0.28)), 0.12); // face and jaw
  d = smin(d, sdEll(p - vec3(0.0, 1.24, 0.17), vec3(0.1, 0.085, 0.1)), 0.08); // chin
  d = smin(d, sdEll(q - vec3(0.16, 1.54, 0.2), vec3(0.085, 0.06, 0.08)), 0.06);   // cheekbones
  d = smin(d, sdCap(q, vec3(0.03, 1.69, 0.29), vec3(0.17, 1.68, 0.25), 0.045), 0.06); // brow
  d = smax(d, -(length(q - vec3(0.112, 1.6, 0.33)) - 0.058), 0.06);          // eye sockets
  d = smin(d, sdEll(q - vec3(0.112, 1.598, 0.262), vec3(0.058, 0.036, 0.045)), 0.02); // closed eyelids
  d = smin(d, sdCap(p, vec3(0.0, 1.66, 0.31), vec3(0.0, 1.49, 0.395), 0.034), 0.04); // nose
  d = smin(d, length(p - vec3(0.0, 1.477, 0.39)) - 0.044, 0.03);
  d = smin(d, length(q - vec3(0.042, 1.47, 0.355)) - 0.031, 0.02);           // nostril wings
  d = smin(d, sdEll(p - vec3(0.0, 1.385, 0.315), vec3(0.068, 0.02, 0.03)), 0.025); // lips
  d = smin(d, sdEll(p - vec3(0.0, 1.347, 0.305), vec3(0.06, 0.024, 0.03)), 0.025);
  d = smin(d, sdEll(q - vec3(0.305, 1.57, -0.03), vec3(0.03, 0.085, 0.055)), 0.04);  // ears
  d = smin(d, sdCap(p, vec3(0.0, 1.3, -0.07), vec3(0.0, 0.85, -0.04), 0.15), 0.1);  // neck
  d = smin(d, sdCap(q, vec3(0.0, 1.02, -0.07), vec3(0.4, 0.9, -0.07), 0.1), 0.1); // collarbones and shoulders
  float chest = max(sdEll(p - vec3(0.0, 0.78, -0.05), vec3(0.54, 0.26, 0.24)), 0.52 - p.y);
  d = smin(d, chest, 0.12);                                                   // chest, cut flat below
  d = min(d, sdBox(p - vec3(0.0, 0.48, -0.05), vec3(0.2, 0.055, 0.2), 0.02));  // the plinth
  d = min(d, sdBox(p - vec3(0.0, 0.2, -0.05), vec3(0.27, 0.23, 0.27), 0.02));
  return d;
}
float map(vec3 p) {
  float b = length(p - vec3(0.0, 1.1, 0.0)) - 1.25;                           // cheap bound round the whole bust
  return b > 0.1 ? b : bust(p);
}
vec3 normal(vec3 p) {
  vec2 e = vec2(0.0007, 0.0);
  return normalize(vec3(map(p + e.xyy) - map(p - e.xyy), map(p + e.yxy) - map(p - e.yxy), map(p + e.yyx) - map(p - e.yyx)));
}
float shadow(vec3 p, vec3 lp, float k) {
  vec3 rd = lp - p; float dist = length(rd); rd /= dist;
  float res = 1.0, t = 0.03, ph = 1e10;
  for (int i = 0; i < 110; i++) {                // small steps and the y/d correction: penumbrae without banding
    float h = bust(p + rd * t);                  // the real field: the bounding sphere must not cast shadows
    float y = h * h / (2.0 * ph), d = sqrt(max(h * h - y * y, 0.0));
    res = min(res, k * d / max(t - y, 1e-4));
    ph = h; t += clamp(h, 0.005, 0.045);
    if (res < 0.001 || t > dist) break;
  }
  return smoothstep(0.0, 1.0, clamp(res, 0.0, 1.0));
}
// one lamp: wrapped diffuse (plaster scatters a little), a soft highlight, a grazing sheen, its own soft shadow
vec3 lamp(vec3 p, vec3 n, vec3 v, vec3 lp, vec3 col, float s, float k, float sheen) {
  vec3 l = normalize(lp - p);
  float dif = max((dot(n, l) + 0.15) / 1.15, 0.0);
  float spe = pow(max(dot(n, normalize(l + v)), 0.0), 24.0) * 0.25
            + pow(1.0 - max(dot(n, v), 0.0), 2.5) * max(dot(n, l), 0.0) * sheen;  // grazing sheen: what makes a rim glow
  return col * s * (dif + spe) * shadow(p + n * 0.006, lp, k);
}
// a glowing card facing the head: 0 outside, 1 inside
float card(vec3 ro, vec3 rd, vec3 c, out float tc) {
  vec3 n = normalize(normalize(CEN - c) + 0.9 * normalize(uRo - c)), r = normalize(cross(vec3(0, 1, 0), n)), u = cross(n, r); // turned partly to camera
  float dn = dot(rd, n); tc = 1e9;
  if (abs(dn) < 1e-4) return 0.0;
  float t = dot(c - ro, n) / dn; if (t < 0.0) return 0.0;
  vec3 q = ro + rd * t - c; vec2 uv = vec2(dot(q, r), dot(q, u));
  vec2 e = abs(uv) - vec2(0.11, 0.15);
  float inside = 1.0 - smoothstep(-0.004, 0.004, max(e.x, e.y));
  tc = inside > 0.0 ? t : 1e9;
  return inside;
}
vec3 render(vec2 uv) {
  vec3 ro = uRo, f = normalize(vec3(0.0, 1.28, 0.0) - ro), r = normalize(cross(f, vec3(0, 1, 0))), u = cross(r, f);
  vec3 rd = normalize(uv.x * r + uv.y * u + FOCAL * f);
  // backdrop: charcoal, a little lighter behind the head
  vec3 col = mix(vec3(0.006, 0.006, 0.009), vec3(0.03, 0.028, 0.034), exp(-1.6 * length(uv - vec2(0.0, 0.35))));
  float t = 0.0, hit = 0.0;
  for (int i = 0; i < 160; i++) { float h = map(ro + rd * t); if (h < 0.0003) { hit = 1.0; break; } t += h; if (t > 8.0) break; }
  if (hit > 0.5) {
    vec3 p = ro + rd * t, n = normal(p), v = -rd;
    vec3 alb = p.y < 0.535 ? vec3(0.13, 0.125, 0.14) : vec3(0.86, 0.83, 0.79); // dark plinth, plaster bust
    vec3 li = vec3(0.025);                                                      // a whisper of room light
    li += uW.x * lamp(p, n, v, uK, vec3(1.0, 0.82, 0.62), 1.5, 10.0, 0.0);
    li += uW.y * lamp(p, n, v, uF, vec3(0.62, 0.74, 1.0), 0.3, 6.0, 0.0);
    li += uW.z * lamp(p, n, v, uR, vec3(0.72, 0.86, 1.0), 4.0, 12.0, 3.0);
    col = alb * li;
  }
  // the three cards, glowing when their lamp is on
  float tc;
  vec3 C[3]; C[0] = uK; C[1] = uF; C[2] = uR;
  vec3 K[3]; K[0] = vec3(1.0, 0.82, 0.62); K[1] = vec3(0.62, 0.74, 1.0); K[2] = vec3(0.72, 0.86, 1.0);
  for (int i = 0; i < 3; i++) {
    float w = i == 0 ? uW.x : i == 1 ? uW.y : uW.z;
    float m = card(ro, rd, C[i], tc);
    if (m > 0.0 && (hit < 0.5 || tc < t)) col = mix(col, K[i] * (0.12 + 2.4 * w), m);
    vec3 dc = C[i] - ro; float along = dot(dc, rd);                            // halo round the card
    float dl = length(dc - rd * along);
    col += K[i] * w * 0.1 * exp(-dl * dl / 0.03) * step(0.0, along) * (hit < 0.5 || along < t ? 1.0 : 0.0);
  }
  return col;
}
void main() {
  vec3 col = vec3(0.0);
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 uv = (2.0 * (gl_FragCoord.xy + vec2(i, j) * 0.5 - 0.25) - uRes) / uRes.x;
    col += render(uv);
  }
  col /= 4.0;
  col = col / (1.0 + col * 0.6);
  outColor = vec4(pow(col, vec3(1.0 / 2.2)) + grain(gl_FragCoord.xy) / 255.0, 1.0);
}`,
  overlay(ctx, t, W, H) {
    // label each card: project its position with the same camera as the shader
    const ro = cam(t), ta = TARGET;
    const sub = (a, b) => a.map((x, i) => x - b[i]), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const norm = a => { const l = Math.hypot(...a); return a.map(x => x / l); };
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const f = norm(sub(ta, ro)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f);
    const w = level(t);
    LAMPS.forEach((L, i) => {
      const d = sub(L.p, ro), z = dot(d, f);
      const x = (dot(d, r) * FOCAL / z * W + W) / 2, y = H / 2 - dot(d, u) * FOCAL / z * W / 2;
      ctx.globalAlpha = 0.3 + 0.7 * w[i];                                         // label under its card
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFFFFF'; ctx.font = `800 36px ${FONT.sans}`;
      const ly = L.above ? y - 150 : y + 130;                                     // the rim's label sits above, clear of the head
      ctx.fillText(L.name, x, ly);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; ctx.font = `500 25px ${FONT.ko}`;
      ctx.fillText(`${L.ko} 라이트`, x, ly + 38);
      ctx.globalAlpha = 1;
    });
  },
};
