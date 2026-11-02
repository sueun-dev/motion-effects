// Eye shader: one eyeball ray traced per pixel (3 x 3 samples). The cornea is a second, smaller sphere bulging out of
// the sclera; a ray that meets it gets a Fresnel reflection of the studio (the wet catchlight) and is refracted
// (n = 1.336) on to the iris, a flat disc set back inside the eye, so the iris shifts with the viewing angle (parallax)
// and rays that miss its edge fall into the dark eye: the limbal ring. Light focused by the cornea lands as a bright
// caustic crescent on the far side of the iris. The eye glances around, the light dims and the pupil opens, then the
// eye turns aside and its layers pull apart (cornea, iris, sclera) and close up again.
import { FONT, clamp, smoothstep, ease } from '../lib/util.js';

const F = 1200, CAMZ = 3.4, RL = 0.52, ZL = Math.sqrt(1 - RL * RL), ZC = 0.516, RC = 0.62, ZI = 0.8;

// eased piecewise keys: [time, yaw, pitch]
const GAZE = [[0, 0, 0], [0.25, 0, 0], [0.5, -0.34, 0.16], [0.9, -0.34, 0.16], [1.15, 0.33, 0.04], [1.55, 0.33, 0.04], [1.8, 0.04, -0.2],
  [2.2, 0.04, -0.2], [2.5, 0, 0], [2.65, 0, 0], [3.25, 0.62, 0.1], [4.25, 0.62, 0.1], [4.9, 0, 0], [5, 0, 0]];
const shift = t => (t + 4.8) % 5;                                                // the loop starts as the eye settles back
function gaze(t) {
  t = shift(t);
  let i = 0;
  while (i < GAZE.length - 2 && t >= GAZE[i + 1][0]) i++;
  const [t0, y0, p0] = GAZE[i], [t1, y1, p1] = GAZE[i + 1], k = ease.inOut(clamp((t - t0) / (t1 - t0)));
  return [y0 + (y1 - y0) * k, p0 + (p1 - p0) * k];
}
const explode = t => smoothstep(2.95, 3.45, shift(t)) - smoothstep(3.85, 4.35, shift(t));
const dark = t => smoothstep(0.6, 1.4, shift(t)) - smoothstep(2.0, 2.7, shift(t));   // the light dims, then comes back
const pupil = t => 0.12 + 0.13 * dark(t + 4.75);                                 // the pupil follows 0.25 s later
const centre = t => [540 - 150 * smoothstep(2.65, 3.25, shift(t)) + 150 * smoothstep(4.25, 4.9, shift(t)), 900];

// where a point in eye space lands on screen
function project([x, y, z], t) {
  const [yaw, pitch] = gaze(t), [cx, cy] = centre(t);
  const y1 = y * Math.cos(pitch) - z * Math.sin(pitch), z1 = y * Math.sin(pitch) + z * Math.cos(pitch);
  const x2 = x * Math.cos(yaw) + z1 * Math.sin(yaw), z2 = -x * Math.sin(yaw) + z1 * Math.cos(yaw);
  return [cx + F * x2 / (CAMZ - z2), cy - F * y1 / (CAMZ - z2)];
}

export default {
  name: 'Eye Shader',
  ko: '눈 셰이더',
  uniforms(t) {
    const [yaw, pitch] = gaze(t);
    return { uGaze: [yaw, pitch], uExp: [explode(t)], uLight: [1 - 0.68 * dark(t)], uPupil: [pupil(t)], uC: centre(t) };
  },
  frag: `
uniform vec2 uGaze, uC; uniform float uExp, uLight, uPupil;
const float F = ${F}.0, CAMZ = ${CAMZ}, RL = ${RL}, ZL = ${ZL.toFixed(5)}, ZC = ${ZC}, RC = ${RC}, ZI = ${ZI};
const vec3 KEY = normalize(vec3(-0.55, 0.6, 0.75));
float sphere(vec3 ro, vec3 rd, vec3 c, float r, out float tFar) {
  vec3 oc = ro - c; float b = dot(oc, rd), h = b * b - dot(oc, oc) + r * r;
  tFar = -1.0;
  if (h < 0.0) return -1.0;
  h = sqrt(h); tFar = -b + h;
  return -b - h;
}
// the studio around the eye: dark, one big softbox up left (the catchlight), a thin strip light on the right
vec3 env(vec3 d) {
  vec3 c = mix(vec3(0.012, 0.014, 0.02), vec3(0.05, 0.055, 0.07), 0.5 + 0.5 * d.y);
  vec3 r = normalize(cross(KEY, vec3(0, 1, 0))), u = cross(r, KEY);
  float k = dot(d, KEY), x = dot(d, r) / k, y = dot(d, u) / k;
  if (k > 0.0) c += vec3(1.0, 0.96, 0.9) * 7.0 * uLight * smoothstep(0.26, 0.22, abs(x)) * smoothstep(0.2, 0.16, abs(y));
  float s = dot(d, normalize(vec3(0.9, 0.1, 0.4)));
  c += vec3(0.7, 0.8, 1.0) * 1.6 * smoothstep(0.985, 0.995, s) * uLight;
  return c;
}
vec3 sclera(vec3 p, vec3 n, vec3 v, vec3 nw) {
  float vein = pow(1.0 - abs(snoise(p * 3.2 + 7.0)), 14.0) + 0.6 * pow(1.0 - abs(snoise(p * 6.5 + 2.0)), 18.0);
  float edge = smoothstep(0.86, 0.2, p.z);                            // vessels gather away from the iris
  vec3 alb = mix(vec3(0.86, 0.83, 0.8), vec3(0.85, 0.62, 0.58), 0.35 * edge);
  alb = mix(alb, vec3(0.7, 0.12, 0.1), clamp(vein * edge * 0.55, 0.0, 0.6));
  float dif = pow(max(dot(nw, KEY) * 0.55 + 0.45, 0.0), 1.8);         // wrapped light: a soft, slightly translucent falloff
  vec3 col = alb * (dif * uLight * vec3(1.0, 0.95, 0.9) + vec3(0.04, 0.035, 0.035));
  col *= 1.0 - 0.55 * smoothstep(0.35, 0.0, ZL - p.z) * smoothstep(-0.05, 0.0, ZL - p.z);   // shading round the limbus
  return col;
}
vec3 iris(vec3 p) {
  float r = length(p.xy), a = atan(p.y, p.x), rp = uPupil;
  float u = clamp((r - rp) / (RL * 0.97 - rp), 0.0, 1.0);
  float fib = 0.5 + 0.5 * snoise(vec3(cos(a) * 9.0, sin(a) * 9.0, r * 7.0)) * 0.6 + 0.4 * snoise(vec3(cos(a) * 26.0, sin(a) * 26.0, r * 3.0));
  float crypt = smoothstep(0.55, 0.8, snoise(vec3(cos(a) * 5.0, sin(a) * 5.0, r * 12.0 + 3.0)));
  vec3 outer = mix(vec3(0.16, 0.32, 0.36), vec3(0.3, 0.5, 0.5), fib);
  vec3 inner = mix(vec3(0.45, 0.28, 0.08), vec3(0.75, 0.55, 0.2), fib);
  vec3 c = mix(inner, outer, smoothstep(0.12, 0.38, u));
  c *= 1.0 - 0.45 * crypt;
  c *= 1.0 - 0.75 * smoothstep(0.78, 1.0, u);                         // dark outer rim of the iris
  c *= 0.35 + 0.65 * smoothstep(0.0, 0.05, u);                        // the dark pupil ruff
  // caustic: the cornea focuses the key light onto the side of the iris away from it
  vec2 away = -normalize(KEY.xy);
  float caus = smoothstep(0.35, 0.95, dot(normalize(p.xy), away)) * smoothstep(0.25, 0.75, u) * smoothstep(1.0, 0.8, u);
  float lit = 0.22 + 0.5 * smoothstep(-0.6, 0.6, dot(normalize(p.xy), -away));
  return c * uLight * (lit + 2.6 * caus) + c * 0.03;
}
vec3 trace(vec3 ro, vec3 rd, vec3 bg) {
  vec3 col = vec3(0.0); float through = 1.0;
  float oc = 0.55 * uExp, oi = 0.28 * uExp;
  vec3 cc = vec3(0.0, 0.0, ZC + oc);
  bool cornea = true;
  for (int i = 0; i < 4; i++) {
    float tFar, tc = cornea ? sphere(ro, rd, cc, RC, tFar) : -1.0;
    if (tc > 1e-4 && (ro + rd * tc).z < ZL + oc) tc = -1.0;               // only the cap in front of the limbus
    float ts = sphere(ro, rd, vec3(0.0), 1.0, tFar), tsIn = tFar;
    if (ts > 1e-4 && (ro + rd * ts).z > ZL) ts = -1.0;                    // the sclera is open where the cornea sits
    if (ts <= 1e-4 && tsIn > 1e-4 && (ro + rd * tsIn).z < ZL) ts = tsIn; else if (ts <= 1e-4) ts = -1.0;
    float ti = abs(rd.z) > 1e-5 ? (ZI + oi - ro.z) / rd.z : -1.0;
    vec3 pi = ro + rd * ti;
    if (ti > 1e-4 && length(pi.xy) > RL * 0.97) ti = -1.0;
    float t = 1e9; int hit = 0;
    if (tc > 1e-4 && tc < t) { t = tc; hit = 1; }
    if (ts > 1e-4 && ts < t) { t = ts; hit = 2; }
    if (ti > 1e-4 && ti < t) { t = ti; hit = 3; }
    if (hit == 0) return col + through * bg;
    vec3 p = ro + rd * t;
    if (hit == 1) {                                                        // cornea: reflect, then refract inward
      vec3 n = normalize(p - cc);
      float fr = 0.025 + 0.975 * pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
      col += through * fr * env(reflect(rd, n));
      col += through * uExp * vec3(0.5, 0.7, 0.8) * 0.25 * pow(1.0 - max(dot(n, -rd), 0.0), 3.0);   // a glassy rim once it floats free
      through *= 1.0 - fr;
      rd = refract(rd, n, mix(1.0 / 1.336, 1.0, uExp));
      ro = p; cornea = false;
      continue;
    }
    if (hit == 3) {
      if (length(p.xy) > uPupil) return col + through * iris(p);
      ro = p + rd * 1e-3; continue;                                         // through the pupil
    }
    vec3 n = normalize(p);
    if (dot(n, rd) > 0.0) return col + through * vec3(0.03, 0.008, 0.006) * (0.4 + 0.6 * uLight);   // the dark inside of the eye
    vec3 nw = n;
    float fr = 0.02 + 0.98 * pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
    return col + through * (sclera(p, n, -rd, nw) * (1.0 - fr) + fr * env(reflect(rd, n)));
  }
  return col;
}
void main() {
  vec2 p0 = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  float cx = cos(uGaze.x), sx = sin(uGaze.x);
  mat3 Rx = mat3(1, 0, 0, 0, cos(uGaze.y), sin(uGaze.y), 0, -sin(uGaze.y), cos(uGaze.y));
  mat3 Ry = mat3(cx, 0, -sx, 0, 1, 0, sx, 0, cx);
  mat3 M = Ry * Rx, Mt = transpose(M);                                  // eye space -> world, and back
  vec3 bg = mix(vec3(0.05, 0.06, 0.08), vec3(0.015, 0.017, 0.024), smoothstep(0.0, 1.0, length(p0 - vec2(540.0, 900.0)) / 1100.0)) * (0.55 + 0.45 * uLight);
  vec3 col = vec3(0.0);
  bool near = length(p0 - uC) < 720.0;
  int n = near ? 3 : 1;
  for (int j = 0; j < 3; j++) for (int i = 0; i < 3; i++) {
    if (i >= n || j >= n) continue;
    vec2 p = p0 + (vec2(i, j) + 0.5) / float(n) - 0.5;
    vec3 rd = normalize(vec3((p.x - uC.x) / F, -(p.y - uC.y) / F, -1.0)), ro = vec3(0.0, 0.0, CAMZ);
    col += trace(Mt * ro, Mt * rd, bg);
  }
  col /= float(n * n);
  col = col * (2.51 * col + 0.03) / (col * (2.43 * col + 0.59) + 0.14);
  col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));
  outColor = vec4(col + grain(gl_FragCoord.xy) / 255.0, 1.0);
}`,
  overlay(ctx, t, W, H) {
    // the layers' names while the eye is pulled apart
    const e = explode(t);
    if (e > 0.02) {
      const tags = [['CORNEA', [0, 0.35, ZC + RC + 0.55 * e - 0.05], [0, -250]], ['IRIS', [0, -0.42, ZI + 0.28 * e], [0, 300]], ['SCLERA', [-0.62, 0.55, 0.55], [-60, -230]]];
      ctx.globalAlpha = smoothstep(0.35, 0.9, e);
      ctx.font = `700 30px ${FONT.sans}`; ctx.textBaseline = 'middle';
      for (const [name, p, [dx, dy]] of tags) {
        const [x, y] = project(p, t), lx = x + dx, ly = y + dy;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(lx, ly); ctx.stroke();
        ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
        const w = ctx.measureText(name).width + 36;
        ctx.fillStyle = 'rgba(10, 12, 18, 0.75)'; ctx.beginPath(); ctx.roundRect(lx - w / 2, ly - 26, w, 52, 14); ctx.fill();
        ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.fillText(name, lx, ly + 1);
      }
      ctx.globalAlpha = 1;
    }
    // light level and pupil size
    const L = 1 - 0.68 * dark(t), rp = pupil(t), x = 140, y = 1700, w = 800;
    ctx.fillStyle = 'rgba(10, 12, 18, 0.7)'; ctx.beginPath(); ctx.roundRect(x - 40, y - 70, w + 80, 170, 24); ctx.fill();
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; ctx.font = `600 22px ${FONT.sans}`;
    ctx.fillText('LIGHT', x, y - 22); ctx.fillText('PUPIL', x + 470, y - 22);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'; ctx.beginPath(); ctx.roundRect(x, y, 380, 14, 7); ctx.fill();
    ctx.fillStyle = '#FFE3A8'; ctx.beginPath(); ctx.roundRect(x, y, 380 * L, 14, 7); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.font = `700 36px ${FONT.mono}`;
    ctx.fillText(`${Math.round(L * 100)}%`, x, y + 66);
    ctx.fillText(`${(rp / 0.52 * 11.8).toFixed(1)} mm`, x + 470, y + 66);   // iris ≈ 11.8 mm across
    ctx.fillStyle = '#4E8C93'; ctx.beginPath(); ctx.arc(x + 750, y + 20, 46, 0, Math.PI * 2); ctx.fill();   // iris to scale
    ctx.fillStyle = '#08080A'; ctx.beginPath(); ctx.arc(x + 750, y + 20, 46 * rp / 0.52, 0, Math.PI * 2); ctx.fill();
  },
};
