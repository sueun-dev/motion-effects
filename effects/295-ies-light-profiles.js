// IES light profiles: three recessed downlights 0.32 m in front of a gallery wall, each loaded with a different
// photometric file (candela against vertical angle). The wall and floor are lit straight from those curves,
// E = I(θ) · cos(incidence) / r², so each fixture paints its own scallop: a crisp cut-off arch, a batwing whose
// 38° peak draws a bright band, a spot whose spill ring adds a second, wider arch. Every 1.67 s the files move one fixture to the right (the candela
// curves morph, so the scallops reshape smoothly); the polar candela plot of each fixture sits under it.
import { TAU, FONT, span, ease, clamp } from '../lib/util.js';

const FX = [-1.15, 0, 1.15], LY = 3.38, LZ = 0.32; // fixtures (m): x, height, distance from the wall
const SWAPS = [0.35, 2.02, 3.68], MORPH = 0.75;    // the files move along at these times (s), each morph 0.75 s

// the three photometric files, relative candela at vertical angle th (radians from straight down)
const PROFILES = [
  { name: 'CUT-OFF DOWNLIGHT', sub: '30° cut-off', peak: 1800,
    I: th => (0.86 + 0.14 * Math.cos(th * 5.0)) * (1 - smooth(0.505, 0.53, th)) + 0.035 * Math.exp(-th * 2) * (1 - smooth(1.1, 1.5, th)) },
  { name: 'BATWING', sub: 'peak at 38°', peak: 1250,
    I: th => (0.16 + 1.05 * Math.exp(-(((th - 0.66) / 0.13) ** 2))) * (1 - smooth(0.8, 0.95, th)) },
  { name: 'SPOT + SPILL RING', sub: '15° core · 45° spill', peak: 3900,
    I: th => 2.2 * Math.exp(-((th / 0.2) ** 2)) + 0.3 * (1 - smooth(0.77, 0.8, th)) },
];
function smooth(a, b, x) { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); }
const GLSL_PROFILES = `
float pA(float th) { return (0.86 + 0.14 * cos(th * 5.0)) * (1.0 - smoothstep(0.505, 0.53, th)) + 0.035 * exp(-th * 2.0) * (1.0 - smoothstep(1.1, 1.5, th)); }
float pB(float th) { float g = (th - 0.66) / 0.13; return (0.16 + 1.05 * exp(-g * g)) * (1.0 - smoothstep(0.8, 0.95, th)); }
float pC(float th) { float g = th / 0.2; return 2.2 * exp(-g * g) + 0.3 * (1.0 - smoothstep(0.77, 0.8, th)); }`;

// how far the files have moved (0 .. 3) and, inside a morph, its progress
const shift = t => SWAPS.reduce((s, a) => s + ease.inOut(span(t, a, a + MORPH)), 0);
// weights of the three files on fixture j: file p sits on fixture p + shift
function weights(j, t) {
  const at = (((j - shift(t)) % 3) + 3) % 3;
  return [0, 1, 2].map(p => { const d = Math.abs(p - at); return Math.max(0, 1 - Math.min(d, 3 - d)); });
}

export default {
  name: 'IES Light Profiles',
  ko: 'IES 배광',
  uniforms: t => ({ uW0: weights(0, t), uW1: weights(1, t), uW2: weights(2, t) }),
  frag: `
uniform vec3 uW0, uW1, uW2;
${GLSL_PROFILES}
const float LY = ${LY.toFixed(2)}, LZ = ${LZ.toFixed(2)}, CEIL = 3.4;
const vec3 CAM = vec3(0.0, 2.0, 5.0);
const float F = 1470.0, CY = 802.0;        // focal length and horizon row in pixels (a shifted lens: verticals stay vertical)
const vec3 WARM = vec3(1.0, 0.8, 0.6);      // 3000 K
float prof(vec3 w, float th) { return w.x * pA(th) + w.y * pB(th) + w.z * pC(th); }
vec3 fixture(int j) { return vec3(j == 0 ? ${FX[0]} : j == 1 ? 0.0 : ${FX[2]}, LY, LZ); }
vec3 weightsOf(int j) { return j == 0 ? uW0 : j == 1 ? uW1 : uW2; }

// illuminance at p on a surface with normal n, from the three files
float illum(vec3 p, vec3 n) {
  float e = 0.0;
  for (int j = 0; j < 3; j++) {
    vec3 v = p - fixture(j);
    float r = length(v), th = acos(clamp(-v.y / r, -1.0, 1.0));
    e += prof(weightsOf(j), th) * max(dot(n, -v / r), 0.0) / (r * r);
  }
  return e;
}
// a colour-field painting (two soft blocks on a ground), 0.6 x 0.76 m, one under each fixture
vec3 painting(int j, vec2 q) {                                    // q: -1..1 across the canvas
  vec3 g = j == 0 ? vec3(0.42, 0.1, 0.07) : j == 1 ? vec3(0.06, 0.13, 0.2) : vec3(0.38, 0.3, 0.1);
  vec3 a = j == 0 ? vec3(0.86, 0.4, 0.12) : j == 1 ? vec3(0.22, 0.5, 0.55) : vec3(0.8, 0.66, 0.26);
  vec3 b = j == 0 ? vec3(0.22, 0.04, 0.05) : j == 1 ? vec3(0.04, 0.06, 0.1) : vec3(0.26, 0.29, 0.13);
  float wob = 0.03 * (vnoise(q * 6.0 + float(j) * 7.0) - 0.5);
  float ba = smoothstep(0.86, 0.78, abs(q.x) + wob) * smoothstep(-0.02, 0.06, q.y + wob) * smoothstep(0.9, 0.82, q.y);
  float bb = smoothstep(0.86, 0.78, abs(q.x) - wob) * smoothstep(-0.9, -0.82, q.y) * smoothstep(-0.1, -0.18, q.y + wob);
  vec3 c = mix(mix(g, a, ba), b, bb);
  return c * 1.35 * (0.94 + 0.08 * vnoise(q * vec2(40.0, 9.0)));   // a fixed brushy weave
}
// warm plaster: a fixed, very soft trowel texture, with the paintings and their frames
vec3 wallAlbedo(vec2 p) {
  float n = vnoise(p * 9.0) * 0.6 + vnoise(p * 23.0) * 0.4;
  vec3 c = vec3(0.62, 0.6, 0.58) * (0.97 + 0.05 * n);
  for (int j = 0; j < 3; j++) {
    vec2 d = p - vec2(fixture(j).x, 1.12), hs = vec2(0.3, 0.38);
    float fr = 0.028;
    // a soft shadow under the frame (the light comes from above)
    float sh = smoothstep(hs.x + 0.03, hs.x - 0.01, abs(d.x)) * smoothstep(-hs.y - fr - 0.07, -hs.y - fr, d.y) * step(d.y, 0.0);
    c *= 1.0 - 0.45 * sh;
    if (abs(d.x) < hs.x + fr && abs(d.y) < hs.y + fr) c = vec3(0.05, 0.045, 0.04);   // black frame
    if (abs(d.x) < hs.x && abs(d.y) < hs.y) c = painting(j, d / hs);
  }
  if (p.y < 0.1) c = vec3(0.16, 0.15, 0.14);                     // skirting board
  return c;
}
vec3 wall(vec3 p) {
  vec3 c = wallAlbedo(p.xy) * (illum(p, vec3(0, 0, 1)) * 1.5 + 0.018) * WARM;
  c *= 1.0 - 0.35 * smoothstep(CEIL - 0.25, CEIL, p.y);            // the corner under the ceiling stays a touch darker
  return c;
}
vec3 shade(vec3 rd) {
  if (rd.z < 0.0) {
    float tw = -CAM.z / rd.z;
    vec3 pw = CAM + rd * tw;
    if (pw.y >= 0.0 && pw.y <= CEIL) return wall(pw);
  }
  if (rd.y > 0.0) {                                                 // the ceiling with the three trims
    float tc = (CEIL - CAM.y) / rd.y;
    vec3 pc = CAM + rd * tc;
    vec3 c = vec3(0.017, 0.016, 0.015) * (1.0 + 1.5 * exp(-pc.z * 2.0));
    for (int j = 0; j < 3; j++) {
      float d = length(pc.xz - fixture(j).xz);
      c = mix(c, vec3(0.03), smoothstep(0.105, 0.095, d));         // black trim
      c = mix(c, vec3(1.0, 0.93, 0.8) * 2.2, smoothstep(0.062, 0.052, d)); // the lit lens
    }
    return c;
  }
  // the floor: dark polished concrete, its own light pools plus a soft reflection of the wall
  float tf = -CAM.y / rd.y;
  vec3 pf = CAM + rd * tf;
  vec3 c = vec3(0.2, 0.19, 0.18) * (0.97 + 0.04 * vnoise(pf.xz * 14.0)) * (illum(pf, vec3(0, 1, 0)) * 0.9 + 0.03) * WARM;
  vec3 rr = vec3(rd.x, -rd.y, rd.z);
  float tw = -pf.z / rr.z;
  vec3 pw = pf + rr * tw, refl = vec3(0.0);
  for (int k = 0; k < 4; k++) {                                     // a few taps, so the reflection is glossy, not a mirror
    vec2 o = vec2(float(k % 2) - 0.5, float(k / 2) - 0.5) * 0.09 * tw;
    vec3 q = pw + vec3(o, 0.0);
    refl += q.y < CEIL ? wall(q) : vec3(0.05);
  }
  float fres = 0.08 + 0.3 * pow(1.0 - abs(rd.y), 5.0);
  return c + refl * 0.7 * fres * exp(-pw.y * 0.25);
}
void main() {
  vec3 col = vec3(0.0);
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 px = vec2(gl_FragCoord.x + float(i) * 0.5 - 0.25, uRes.y - gl_FragCoord.y + float(j) * 0.5 - 0.25);
    vec3 rd = normalize(vec3((px.x - uRes.x * 0.5) / F, (CY - px.y) / F, -1.0));
    col += shade(rd);
  }
  col /= 4.0;
  col = 1.0 - exp(-col * 1.25);                                     // soft exposure, so the hot spots roll off
  col += grain(gl_FragCoord.xy) * 0.006;
  outColor = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);
}`,
  // under each fixture: its IES file as a polar candela plot (0° straight down, 90° sideways)
  overlay(ctx, t, W, H) {
    const s = shift(t);
    const cardW = 316, cardH = 372, top = 1488, gap = 16;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `600 26px ${FONT.sans}`; ctx.fillStyle = 'rgba(255, 236, 205, 0.7)';
    ctx.fillText('CANDELA vs VERTICAL ANGLE · ONE .IES FILE PER FIXTURE', W / 2, top - 34);
    for (let j = 0; j < 3; j++) {
      const x0 = W / 2 + (j - 1) * (cardW + gap) - cardW / 2, cx = x0 + cardW / 2, cy = top + 70, R = 150;
      ctx.fillStyle = 'rgba(14, 12, 11, 0.72)';
      ctx.beginPath(); ctx.roundRect(x0, top, cardW, cardH, 22); ctx.fill();
      ctx.strokeStyle = 'rgba(255, 220, 170, 0.18)'; ctx.lineWidth = 2; ctx.stroke();
      // grid: rings at 25 % steps and spokes every 15°
      ctx.strokeStyle = 'rgba(255, 230, 200, 0.16)'; ctx.lineWidth = 1.5;
      for (let k = 1; k <= 4; k++) { ctx.beginPath(); ctx.arc(cx, cy, R * k / 4, 0, Math.PI); ctx.stroke(); }
      for (let a = 0; a <= 180; a += 15) {
        const r = a * Math.PI / 180;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + R * Math.cos(r), cy + R * Math.sin(r)); ctx.stroke();
      }
      ctx.font = `500 19px ${FONT.sans}`; ctx.fillStyle = 'rgba(255, 230, 200, 0.45)';
      ctx.fillText('0°', cx, cy + R + 16);
      ctx.fillText('90°', cx - R + 4, cy - 14); ctx.fillText('90°', cx + R - 4, cy - 14);
      ctx.fillText('45°', cx - R * 0.74 - 14, cy + R * 0.74 + 6); ctx.fillText('45°', cx + R * 0.74 + 14, cy + R * 0.74 + 6);
      // the curve: this fixture's (possibly morphing) file, scaled to its own peak
      const w = weights(j, t), I = th => w.reduce((a, wp, p) => a + wp * PROFILES[p].I(th), 0);
      let peak = 0;
      for (let k = 0; k <= 90; k++) peak = Math.max(peak, I(k * Math.PI / 180));
      ctx.beginPath();
      for (let k = -90; k <= 90; k++) {
        const th = Math.abs(k) * Math.PI / 180, r = R * 0.97 * I(th) / peak, a = Math.PI / 2 - k * Math.PI / 180;
        const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a);
        k === -90 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 196, 120, 0.22)'; ctx.fill();
      ctx.strokeStyle = '#FFC98A'; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.fillStyle = '#FFE9C8'; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, TAU); ctx.fill();
      // the file's name: during a morph the old one fades out, then the new one fades in (never both at once)
      const at = (((j - s) % 3) + 3) % 3, u = at - Math.floor(at);
      const p = u < 0.5 ? Math.floor(at) % 3 : Math.ceil(at) % 3, alpha = u === 0 ? 1 : Math.abs(1 - 2 * u);
      const pr = PROFILES[p], cd = Math.round(w.reduce((a, wp, q) => a + wp * PROFILES[q].peak, 0) / 50) * 50;
      ctx.globalAlpha = alpha;
      ctx.font = `700 25px ${FONT.sans}`; ctx.fillStyle = '#FFF3E2';
      ctx.fillText(pr.name, cx, top + cardH - 74);
      ctx.font = `500 22px ${FONT.sans}`; ctx.fillStyle = 'rgba(255, 220, 180, 0.75)';
      ctx.fillText(pr.sub, cx, top + cardH - 42);
      ctx.globalAlpha = 1;
      ctx.font = `500 20px ${FONT.mono}`; ctx.fillStyle = 'rgba(255, 220, 180, 0.6)';
      ctx.textAlign = 'right'; ctx.fillText(`${cd} cd`, x0 + cardW - 18, top + 24); ctx.textAlign = 'center';
    }
  },
};
