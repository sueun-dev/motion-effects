// Gyroid: the triply periodic minimal surface sin x cos y + sin y cos z + sin z cos x = 0, two periods across a
// cube, ray-marched as a printed lattice. The solid is the shell c − w < g < c + w around the level c: at c = 0 it
// is a thin sheet that splits space into two interlocking labyrinths; as c and the wall w grow, the top of the shell
// leaves the range of g and it thickens into the skeletal (network) gyroid, then thins back. The cube's cut faces
// are orange, the walls ivory nylon with fixed print layer lines; the camera swings round it.
import { TAU, FONT, phase, clamp } from '../lib/util.js';

const S = TAU; // cube half size 1, so two periods across
// level c and half wall w at time t: thin sheet (0, 0.22) -> network (0.85, 0.77) -> back
const morph = t => 0.5 - 0.5 * Math.cos(phase(t) * TAU);
const level = t => 0.85 * morph(t), wall = t => 0.22 + 0.55 * morph(t);
const gy = (x, y, z) => Math.sin(x) * Math.cos(y) + Math.sin(y) * Math.cos(z) + Math.sin(z) * Math.cos(x);
// share of the cube that is solid, sampled on a 24^3 grid
function solid(t) {
  const c = level(t), w = wall(t), n = 24;
  let k = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let l = 0; l < n; l++) {
    const f = v => ((v + 0.5) / n * 2 - 1) * S;
    if (Math.abs(gy(f(i), f(j), f(l)) - c) < w) k++;
  }
  return k / n ** 3;
}

export default {
  name: 'Gyroid',
  ko: '자이로이드',
  uniforms: t => {
    const a = phase(t) * TAU;
    return { uC: level(t), uW: wall(t), uYaw: 0.62 + 0.42 * Math.sin(a), uPitch: 0.5 + 0.08 * Math.sin(2 * a + 0.8) };
  },
  frag: `
uniform float uC, uW, uYaw, uPitch;
const float S = ${S.toFixed(5)}, B = 1.0;
const vec3 LIGHT = normalize(vec3(-0.55, 0.9, 0.45));
float gyr(vec3 p) { vec3 q = p * S; return sin(q.x) * cos(q.y) + sin(q.y) * cos(q.z) + sin(q.z) * cos(q.x); }
float sdBox(vec3 p, vec3 b, float r) { vec3 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r; }
float lattice(vec3 p) { return (abs(gyr(p) - uC) - uW) / (S * 1.75); }   // shell around the level, scaled to a safe distance
float map(vec3 p) { return max(lattice(p), sdBox(p, vec3(B), 0.015)); }
vec3 normal(vec3 p) {
  vec2 e = vec2(0.0012, 0.0);
  return normalize(vec3(map(p + e.xyy) - map(p - e.xyy), map(p + e.yxy) - map(p - e.yxy), map(p + e.yyx) - map(p - e.yyx)));
}
vec2 boxHit(vec3 ro, vec3 rd) {                                      // entry and exit of the cube
  vec3 m = 1.0 / rd, n = m * ro, k = abs(m) * (B + 0.01);
  vec3 t1 = -n - k, t2 = -n + k;
  return vec2(max(max(t1.x, t1.y), t1.z), min(min(t2.x, t2.y), t2.z));
}
float march(vec3 ro, vec3 rd) {
  vec2 tb = boxHit(ro, rd);
  if (tb.x > tb.y || tb.y < 0.0) return -1.0;
  float t = max(tb.x, 0.0);
  for (int i = 0; i < 140; i++) {
    float h = map(ro + rd * t);
    if (h < 0.0004) return t;
    t += h;
    if (t > tb.y) break;
  }
  return -1.0;
}
float shadow(vec3 ro, vec3 rd) {
  vec2 tb = boxHit(ro, rd);
  if (tb.x > tb.y || tb.y < 0.0) return 1.0;
  float res = 1.0, t = max(tb.x, 0.004);
  for (int i = 0; i < 56; i++) {
    float h = map(ro + rd * t);
    res = min(res, 24.0 * h / t);
    if (res < 0.01) break;
    t += clamp(h, 0.006, 0.08);
    if (t > tb.y) break;
  }
  return clamp(res, 0.0, 1.0);
}
vec3 sky(vec3 rd) { return mix(vec3(0.016, 0.018, 0.026), vec3(0.04, 0.045, 0.062), clamp(rd.y * 1.5 + 0.6, 0.0, 1.0)); }
vec3 render(vec3 ro, vec3 rd) {
  float t = march(ro, rd);
  float tf = rd.y < 0.0 ? (-B - ro.y) / rd.y : 1e3;                 // the floor the cube stands on
  if (t < 0.0 || tf < t) {
    if (tf > 100.0) return sky(rd);
    vec3 p = ro + rd * tf;
    float sh = shadow(p + vec3(0, 0.002, 0), LIGHT);
    float ao = 1.0 - 0.55 * exp(-max(sdBox(p, vec3(B), 0.0), 0.0) * 5.0);   // soft contact darkening round the base
    vec3 c = vec3(0.05, 0.053, 0.066) * (0.45 + 0.55 * sh) * ao;
    return mix(c, sky(rd), smoothstep(5.0, 12.0, tf));
  }
  vec3 p = ro + rd * t, n = normal(p);
  bool cap = sdBox(p, vec3(B), 0.015) > lattice(p) - 0.0006;          // on a face of the cube = a cut through the shell
  float sh = shadow(p + n * 0.004, LIGHT);
  float ao = clamp(0.35 + 0.65 * map(p + n * 0.06) / 0.06, 0.0, 1.0) * clamp(0.5 + 0.5 * map(p + n * 0.16) / 0.16, 0.0, 1.0);
  vec3 alb = cap ? vec3(1.0, 0.42, 0.2) : vec3(0.93, 0.89, 0.82);
  alb *= 0.965 + 0.035 * sin(p.y * 140.0);     // print layers, fixed to the part
  float dif = max(dot(n, LIGHT), 0.0) * sh;
  float fill = 0.5 + 0.5 * dot(n, normalize(vec3(0.7, 0.2, -0.4)));
  float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
  vec3 h = normalize(LIGHT - rd);
  vec3 col = alb * (dif * vec3(1.0, 0.95, 0.88) * 1.25 + vec3(0.26, 0.3, 0.42) * fill * ao * 0.75);
  col += vec3(1.0) * pow(max(dot(n, h), 0.0), 40.0) * 0.18 * sh;
  col += vec3(0.4, 0.5, 0.75) * rim * 0.22 * ao;
  return col;
}
void main() {
  vec3 ta = vec3(0.0, -0.08, 0.0);
  vec3 ro = ta + 4.6 * vec3(sin(uYaw) * cos(uPitch), sin(uPitch), cos(uYaw) * cos(uPitch));
  vec3 fw = normalize(ta - ro), rt = normalize(cross(fw, vec3(0, 1, 0))), up = cross(rt, fw);
  vec3 col = vec3(0.0);
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 px = gl_FragCoord.xy + vec2(float(i), float(j)) * 0.5 - 0.25;
    vec2 uv = (px - vec2(uRes.x * 0.5, uRes.y - 900.0)) / 1180.0;    // the cube's centre sits at row 900
    col += render(ro, normalize(fw + uv.x * rt + uv.y * up));
  }
  col /= 4.0;
  col = col / (1.0 + col * 0.35);
  outColor = vec4(pow(col, vec3(1.0 / 2.2)) + grain(gl_FragCoord.xy) * 0.008, 1.0);
}`,
  // the equation and the two numbers that shape the lattice
  overlay(ctx, t, W, H) {
    const c = level(t), w = wall(t), m = morph(t);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `italic 500 40px ${FONT.serif}`; ctx.fillStyle = '#F4EEE4';
    ctx.fillText('sin x cos y + sin y cos z + sin z cos x', W / 2, 1530);
    ctx.font = `500 30px ${FONT.sans}`; ctx.fillStyle = 'rgba(244, 238, 228, 0.7)';
    ctx.fillText(`solid where  | g − c | < w`, W / 2, 1584);
    const bar = (y, label, v, lo, hi, txt) => {
      const x0 = 250, x1 = 830, k = clamp((v - lo) / (hi - lo));
      ctx.textAlign = 'left'; ctx.font = `600 28px ${FONT.sans}`; ctx.fillStyle = 'rgba(244, 238, 228, 0.85)';
      ctx.fillText(label, 130, y);
      ctx.strokeStyle = 'rgba(244, 238, 228, 0.22)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      ctx.strokeStyle = '#FF7A45'; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + (x1 - x0) * k, y); ctx.stroke();
      ctx.fillStyle = '#FFE2D2'; ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * k, y, 13, 0, TAU); ctx.fill();
      ctx.textAlign = 'right'; ctx.font = `500 28px ${FONT.mono}`; ctx.fillStyle = 'rgba(244, 238, 228, 0.85)';
      ctx.fillText(txt, 955, y);
    };
    bar(1662, 'level c', c, 0, 0.85, c.toFixed(2));
    bar(1722, 'wall w', w, 0.22, 0.77, w.toFixed(2));
    ctx.textAlign = 'left'; ctx.font = `500 26px ${FONT.sans}`;
    ctx.fillStyle = `rgba(244, 238, 228, ${0.45 + 0.4 * (1 - m)})`; ctx.fillText('sheet', 250, 1790);
    ctx.textAlign = 'right'; ctx.fillStyle = `rgba(244, 238, 228, ${0.45 + 0.4 * m})`; ctx.fillText('network', 830, 1790);
    ctx.textAlign = 'center'; ctx.font = `500 26px ${FONT.mono}`; ctx.fillStyle = 'rgba(255, 170, 130, 0.9)';
    ctx.fillText(`${Math.round(solid(t) * 100)} % solid`, W / 2, 1790);
  },
};
