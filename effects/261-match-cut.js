// Match cut: four shots whose main shape is the same circle in the same place (a dark disc of radius 120 px inside a
// bright ring out to 330 px): an eye, a camera lens, a solar eclipse and a glazed donut, then the eye again. Each cut
// lands inside the same move: the ring spins one full turn on an ease, its fine detail melting into smooth rings as it
// speeds up (motion blur done analytically: every angular pattern fades once it would move more than a fraction of
// its own period in a frame), the surroundings dim, and at the fastest moment the hard cut swaps the shot. The four
// share the same brightness from centre to edge at that moment (three broad streaks still show the turning), so only
// the colour and the detail change.
import { TAU, FONT } from '../lib/util.js';

const CUTS = [0.1, 1.35, 2.6, 3.85];                 // eye -> lens -> eclipse -> donut -> eye
const SPIN = 0.8;                                    // each full-turn spin lasts 0.8 s, centred on its cut
const smooth = k => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
// the spin angle: one full turn eased around each cut (the second term carries a spin that wraps past the loop end)
const angle = t => CUTS.reduce((a, c) => a + TAU * (smooth((t - c + SPIN / 2) / SPIN) + smooth((t - 5 - c + SPIN / 2) / SPIN)), 0);
const shot = t => (t < CUTS[0] ? 3 : t < CUTS[1] ? 0 : t < CUTS[2] ? 1 : t < CUTS[3] ? 2 : 3);
const NAMES = [['EYE', '눈'], ['LENS', '렌즈'], ['ECLIPSE', '일식'], ['DONUT', '도넛']];
const CY = 1000, R0 = 120, R1 = 330;

export default {
  name: 'Match Cut',
  ko: '매치 컷',
  uniforms: t => ({ uShot: shot(t), uA: angle(t), uW: Math.abs(angle(t + 1 / 60) - angle(t - 1 / 60)) }),
  frag: `
uniform float uShot, uA, uW; // shot 0..3, spin angle, and how far it turns in one frame (rad)
const vec2 C = vec2(540.0, ${CY}.0);
const float R0 = ${R0}.0, R1 = ${R1}.0;
float aa(float d) { return clamp(0.5 - d, 0.0, 1.0); }       // coverage from a signed distance in px
float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// motion blur for a pattern with k repeats round the circle: it fades before it could move half a repeat a frame
float blur(float k) { return exp(-pow(k * uW / 2.2, 4.0)); }

// ---- the surroundings (they do not spin) ----
vec3 eyeBack(vec2 d, out float open, out float top) {
  float x = d.x / 560.0, up = 290.0 * pow(max(1.0 - x * x, 0.0), 0.75), lo = 300.0 * pow(max(1.0 - x * x, 0.0), 0.9);
  top = -up + 30.0 * x; float bot = lo + 25.0 * x;                            // a tilted almond opening
  open = aa(top - d.y) * aa(d.y - bot);
  vec3 skin = vec3(0.30, 0.19, 0.15) * (0.55 + 0.35 * smoothstep(900.0, 200.0, length(d * vec2(0.8, 1.2))));
  skin *= 1.0 - 0.35 * smoothstep(60.0, 0.0, abs(d.y - top + 90.0 + 40.0 * x * x)); // the lid crease
  float lash = smoothstep(26.0, 0.0, abs(d.y - top + 6.0)) * (0.6 + 0.4 * sin(d.x * 0.35));
  skin = mix(skin, vec3(0.03, 0.02, 0.02), clamp(lash, 0.0, 1.0));
  vec3 white = vec3(0.45, 0.40, 0.40) * (0.55 + 0.45 * smoothstep(560.0, 120.0, abs(d.x)));
  white *= 0.55 + 0.45 * smoothstep(0.0, 90.0, d.y - top);                   // shadow of the upper lid
  return mix(skin, white, open);
}
vec3 lensBack(float r, float th) {
  vec3 b = vec3(0.035) + vec3(0.05) * smoothstep(R1 + 140.0, R1 + 20.0, r);
  b += vec3(0.05) * step(R1 + 60.0, r) * step(r, R1 + 120.0) * (0.5 + 0.5 * sin(th * 160.0)); // knurled grip
  b += vec3(0.35) * smoothstep(4.0, 0.0, abs(r - (R1 + 34.0)));               // a bright bevel
  return mix(vec3(0.02), b, aa(r - (R1 + 140.0)));
}
vec3 eclipseBack(vec2 d) {
  vec2 cell = floor(d / 60.0), f = fract(d / 60.0) - 0.5 - (hash22(cell) - 0.5) * 0.7;
  return vec3(0.01, 0.012, 0.03) + vec3(0.8, 0.85, 1.0) * exp(-dot(f, f) * 9000.0) * step(0.55, hash12(cell + 7.0)); // fixed stars
}
vec3 donutBack(vec2 d) {
  vec3 slate = vec3(0.10, 0.11, 0.12) * (0.85 + 0.3 * vnoise(d * 0.04) + 0.12 * vnoise(d * 0.3));
  float r = length(d - vec2(30.0, 40.0));                                     // the donut's soft shadow
  return slate * (1.0 - 0.6 * smoothstep(R1 + 60.0, R1 - 40.0, r) * smoothstep(R0 - 50.0, R0 + 40.0, r));
}

// ---- the rings (they spin): colour at radius r, angle th in the ring's own frame, screen angle sa ----
vec4 iris(float r, float th) {
  float b = blur(40.0), wob = 25.0 * blur(9.0) * sin(9.0 * th + 1.0);
  float fib = b * (0.55 * sin(29.0 * th + 2.0 * sin(5.0 * th) + r * 0.03) + 0.45 * sin(17.0 * th + 1.5 * sin(3.0 * th + r * 0.01)));
  vec3 c = mix(vec3(0.85, 0.55, 0.18), vec3(0.22, 0.55, 0.62), smoothstep(R0 * 1.35, R0 * 2.1, r + wob));
  c *= (0.9 + 0.35 * fib) * (1.0 - 0.7 * smoothstep(R1 - 60.0, R1, r));     // fibres, and the dark limbal ring
  return vec4(mix(vec3(0.01), c, smoothstep(R0 - 1.0, R0 + 2.0, r)), aa(r - R1));
}
vec4 lens(float r, float th) {
  float b = blur(9.0), seg = TAU / 9.0, a = mod(th, seg) - seg * 0.5;
  float poly = mix(r, r * cos(a) / cos(seg * 0.5), b);                      // 9-blade aperture, round when blurred
  vec3 c = vec3(0.36, 0.37, 0.40) * (1.0 + b * 0.28 * (a / seg));             // the blades, each shaded across
  vec3 g = vec3(0.06, 0.07, 0.09) + vec3(0.15, 0.45, 0.3) * smoothstep(8.0, 0.0, abs(r - R1 * 0.83))
         + vec3(0.9) * smoothstep(10.0, 0.0, abs(r - R1 * 0.89)) + vec3(0.5, 0.25, 0.6) * smoothstep(7.0, 0.0, abs(r - R1 * 0.95));
  c = mix(c, g, smoothstep(R1 * 0.74, R1 * 0.78, r));                         // the glass: coatings and a ring light
  return vec4(mix(vec3(0.0), c, smoothstep(R0 - 1.0, R0 + 2.0, poly)), aa(r - R1));
}
vec4 corona(float r, float th) {
  float streak = 0.5 + blur(24.0) * (0.3 * sin(10.0 * th + 1.5 * sin(3.0 * th)) + 0.2 * sin(23.0 * th + r * 0.004));
  vec3 c = vec3(0.86, 0.9, 1.0) * 1.3 * pow(R0 / max(r, R0), 1.6 + 1.6 * (1.0 - streak));
  float prom = blur(12.0) * smoothstep(0.8, 1.0, sin(6.0 * th + 0.7) * sin(5.0 * th)) * smoothstep(R0 + 26.0, R0, r);
  c += vec3(1.0, 0.35, 0.5) * (smoothstep(8.0, 0.0, r - R0) * 0.8 + prom * 1.5) * step(R0, r); // pink limb, prominences
  return vec4(mix(vec3(0.015), c, smoothstep(R0 - 1.0, R0 + 1.0, r)), 1.0);
}
vec4 donut(float r, float th, float sa) {
  float rc = 0.5 * (R0 + R1), w = 0.5 * (R1 - R0), u = (r - rc) / w;         // -1 inner edge .. 1 outer edge
  if (abs(u) > 1.0) return vec4(0.0);
  vec3 L = normalize(vec3(-0.5, -0.6, 0.7)), n = normalize(vec3(u * vec2(cos(sa), sin(sa)), sqrt(1.0 - u * u) * 1.2));
  float lit = max(dot(n, L), 0.0);
  vec3 c = mix(vec3(0.78, 0.48, 0.22), vec3(0.95, 0.85, 0.65), smoothstep(0.75, 0.95, abs(u))) * (0.35 + 0.8 * lit);
  float edge = 0.62 + 0.12 * blur(7.0) * sin(7.0 * th) + 0.06 * blur(23.0) * sin(23.0 * th + 2.0); // the icing's wavy edge
  float ice = smoothstep(edge + 0.02, edge - 0.02, abs(u));
  vec3 g = vec3(0.96, 0.42, 0.62) * (0.45 + 0.7 * lit) + vec3(1.0) * pow(max(dot(n, normalize(L + vec3(0, 0, 1))), 0.0), 60.0) * 0.8;
  float cells = 70.0, ci = floor(th / TAU * cells), cr = floor((u + 1.0) * 4.0);  // sprinkles, one per cell
  vec2 id = vec2(ci, cr), rnd = hash22(id + 3.0);
  vec2 q = rot(rnd.x * TAU) * vec2((fract(th / TAU * cells) - 0.5) * TAU / cells * r, ((u + 1.0) * 4.0 - cr - 0.5) * w / 4.0);
  float h = hash12(id);
  vec3 sc = h < 0.25 ? vec3(1.0, 0.95, 0.85) : h < 0.5 ? vec3(1.0, 0.8, 0.15) : h < 0.75 ? vec3(0.2, 0.55, 1.0) : vec3(0.35, 0.85, 0.45);
  g = mix(g, sc * (0.6 + 0.5 * lit), aa(length(max(abs(q) - vec2(8.0, 0.0), 0.0)) - 3.2) * step(rnd.y, 0.7) * blur(cells));
  return vec4(mix(c, g, ice), aa((abs(u) - 1.0) * w));
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y), d = p - C;
  float r = length(d), sa = atan(d.y, d.x), th = sa - uA;
  int s = int(uShot + 0.5);
  float spin = smoothstep(0.04, 0.3, uW);                                    // 0 at rest, 1 near the fastest
  float open = 1.0, top = 0.0;
  vec3 col = s == 0 ? eyeBack(d, open, top) : s == 1 ? lensBack(r, sa) : s == 2 ? eclipseBack(d) : donutBack(d);
  vec4 o = s == 0 ? iris(r, th) : s == 1 ? lens(r, th) : s == 2 ? corona(r, th) : donut(r, th, sa);
  if (s == 0) o.a *= open;                                                   // the lids cover the iris
  col = mix(col, o.rgb, o.a);
  if (s == 0) { // eye: the lid's shadow on the iris and a fixed window catchlight
    col *= 1.0 - 0.45 * smoothstep(70.0, 0.0, d.y - top) * open;
    float glint = length(max(abs(d - vec2(-90.0, -112.0)) - vec2(10.0, 14.0), 0.0)) - 8.0; // a soft window catchlight
    col += vec3(0.85) * smoothstep(4.0, -4.0, glint) * open * (1.0 - spin);
  }
  // near the fastest moment every shot settles on the same brightness profile, and the surroundings dim
  float target = r < R1 ? mix(0.5, 0.16, smoothstep(R1 - 70.0, R1, r)) * smoothstep(R0, R0 + 6.0, r) + 0.01 : 0.03;
  col = mix(col, col * (target / max(lum(col), 0.004)), spin);
  col *= 1.0 + 0.35 * spin * sin(3.0 * th) * step(R0, r) * step(r, R1);        // three broad streaks show the spin
  col = clamp(col, 0.0, 1.0);
  float vig = smoothstep(1000.0, 300.0, length(d * vec2(1.2, 0.9)));         // low key: the edges fall to black
  outColor = vec4(col * (0.1 + 0.9 * vig), 1.0);
}`,
  overlay(ctx, t, W, H) {
    // the registration guides: the same two circles in every shot
    ctx.setLineDash([10, 14]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    for (const r of [R0, R1]) { ctx.beginPath(); ctx.arc(540, CY, r, 0, TAU); ctx.stroke(); }
    ctx.setLineDash([]);
    // the edit: four clips on a timeline, cut marks and a playhead
    const x0 = 90, x1 = 990, y = 1700, h = 64, X = s => x0 + (x1 - x0) * s / 5;
    const clips = [[0, CUTS[0], 3], [CUTS[0], CUTS[1], 0], [CUTS[1], CUTS[2], 1], [CUTS[2], CUTS[3], 2], [CUTS[3], 5, 3]];
    const tint = ['#C9893A', '#7A6FD8', '#9FB8FF', '#F06C9B'], now = shot(t);
    ctx.font = `700 22px ${FONT.sans}`; ctx.textAlign = 'center';
    for (const [a, b, i] of clips) {
      ctx.fillStyle = tint[i]; ctx.globalAlpha = i === now ? 0.95 : 0.4;
      ctx.beginPath(); ctx.roundRect(X(a) + 2, y, X(b) - X(a) - 4, h, 10); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = '#0E0F14';
      if (X(b) - X(a) > 80) ctx.fillText(NAMES[i][0], (X(a) + X(b)) / 2, y + 40);
    }
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(X(t) - 2, y - 16, 4, h + 32);
    ctx.font = `800 54px ${FONT.display}`; ctx.fillText(NAMES[now][0], W / 2, 1560);
    ctx.font = `500 32px ${FONT.ko}`; ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fillText(NAMES[now][1], W / 2, 1604);
    ctx.font = `500 24px ${FONT.mono}`; ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillText('same circle · same place', W / 2, 1646);
    ctx.font = `500 22px ${FONT.mono}`; ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    for (const c of CUTS) { ctx.fillRect(X(c) - 1, y + h + 6, 2, 14); ctx.fillText('CUT', X(c), y + h + 46); }
  },
};
