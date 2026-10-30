// CSG boolean: the classic tree (cube AND sphere) MINUS (three cylinders), built from signed distance fields and
// raymarched: intersection is max(a, b), subtraction is max(a, -b). Each surface keeps its operand's colour (red cube,
// blue sphere, green cylinders). The sphere shrinks in to trim the corners, the cylinders bore through one by one,
// then everything opens back up to the plain cube. The tree below lights up the operation that is running.
import { TAU, FONT, span, ease, phase } from '../lib/util.js';

const R0 = 1.8, R1 = 1.36, C1 = 0.56, OFF = -0.06; // sphere radius before/after, bore radius, "no bore"
const BORE = [[1.2, 1.7], [1.7, 2.2], [2.2, 2.7]]; // x, y, z drilling windows (s)
const bump = (t, a, b) => span(t, a - 0.25, a + 0.05) * (1 - span(t, b, b + 0.25)); // ghost fade in/out

function state(t) {
  const back = ease.inOut(span(t, 3.75, 4.6)); // everything reopens together
  const sph = ease.inOut(span(t, 0.35, 1.1));
  return {
    R: R0 + (R1 - R0) * sph * (1 - back),
    bores: BORE.map(([a, b]) => OFF + (C1 - OFF) * ease.inOut(span(t, a, b)) * (1 - back)),
    gS: bump(t, 0.35, 1.1) + 0.6 * bump(t, 3.75, 4.6),
    gC: BORE.map(([a, b]) => bump(t, a, b) + 0.6 * bump(t, 3.75, 4.6)),
    back,
  };
}

export default {
  name: 'CSG Boolean',
  ko: '불리언 연산',
  uniforms(t) {
    const s = state(t);
    return { uR: s.R, uB: s.bores, uGS: s.gS, uGC: s.gC, uRot: phase(t) * TAU / 4 + 0.62 };
  },
  frag: `
uniform float uR, uGS, uRot;
uniform vec3 uB, uGC;
const vec3 RED = vec3(0.91, 0.27, 0.31), BLUE = vec3(0.22, 0.47, 1.0), GREEN = vec3(0.2, 0.78, 0.47);

vec3 toObj(vec3 p) {                                  // the object turns a quarter turn per loop (a cube symmetry)
  p.yz = rot(-0.5) * p.yz;
  p.xz = rot(uRot) * p.xz;
  return p;
}
float sdBox(vec3 p, float b, float r) { vec3 q = abs(p) - (b - r); return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r; }
// the result and which operand made the surface: 0 cube, 1 sphere, 2 cylinders
float csg(vec3 p, out float id) {
  float box = sdBox(p, 1.0, 0.035), sph = length(p) - uR;
  float cut = max(max(uB.x - length(p.yz), uB.y - length(p.xz)), uB.z - length(p.xy));
  float d = max(box, sph);
  id = box > sph ? 0.0 : 1.0;
  if (cut > d) { d = cut; id = 2.0; }
  return d;
}
float map(vec3 p) { float id; return csg(toObj(p), id); }
// the operands themselves, as see-through ghosts: the sphere and three capped cylinders
float ghost(vec3 p, out vec3 gc, out float ga) {
  p = toObj(p);
  float d = 1e3; gc = BLUE; ga = 0.0;
  if (uGS > 0.001) { d = length(p) - uR; ga = uGS; } // signed: the camera is outside every ghost
  vec3 len = vec3(length(p.yz), length(p.xz), length(p.xy)), ax = vec3(p.x, p.y, p.z);
  for (int k = 0; k < 3; k++) {
    if (uGC[k] < 0.001) continue;
    vec2 q = vec2(len[k] - max(uB[k], 0.02), abs(ax[k]) - 1.75);
    float c = min(max(q.x, q.y), 0.0) + length(max(q, 0.0));
    if (c < d) { d = c; gc = GREEN; ga = uGC[k]; }
  }
  return d;
}
vec3 nrm(vec3 p) {
  vec2 e = vec2(0.0012, 0.0);
  return normalize(vec3(map(p + e.xyy) - map(p - e.xyy), map(p + e.yxy) - map(p - e.yxy), map(p + e.yyx) - map(p - e.yyx)));
}
float shadow(vec3 ro, vec3 rd) {
  float res = 1.0, t = 0.03;
  for (int i = 0; i < 48; i++) { float h = map(ro + rd * t); res = min(res, 10.0 * h / t); t += clamp(h, 0.02, 0.25); if (h < 0.001 || t > 7.0) break; }
  return clamp(res, 0.0, 1.0);
}
const float FLOOR = -2.05;
vec3 render(vec2 uv) {
  vec3 ro = vec3(0.0, 1.3, 7.4), rd = normalize(vec3(uv * 0.72, -2.4));
  rd.yz = rot(0.17) * rd.yz;
  vec3 bg = mix(vec3(0.84, 0.81, 0.77), vec3(0.97, 0.95, 0.92), clamp(uv.y * 0.35 + 0.6, 0.0, 1.0));
  vec3 l = normalize(vec3(-0.5, 0.95, 0.45));
  float t = 0.0, id = 0.0;
  for (int i = 0; i < 120; i++) { float h = map(ro + rd * t); if (h < 0.0006 || t > 14.0) break; t += h; }
  float tf = rd.y < 0.0 ? (FLOOR - ro.y) / rd.y : 1e3;
  vec3 col;
  float hitT = 1e3;
  if (t < 14.0 && t < tf) {
    vec3 p = ro + rd * t, n = nrm(p);
    csg(toObj(p), id);
    vec3 base = id < 0.5 ? RED : id < 1.5 ? BLUE : GREEN;
    float dif = max(dot(n, l), 0.0) * shadow(p + n * 0.01, l);
    float ao = clamp(0.4 + 0.6 * map(p + n * 0.2) / 0.2, 0.0, 1.0);
    float spe = pow(max(dot(reflect(-l, n), -rd), 0.0), 40.0);
    float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
    float fill = max(dot(n, normalize(vec3(0.8, 0.1, 0.6))), 0.0);
    col = base * (0.24 + 0.8 * dif + 0.3 * fill) * ao + vec3(0.9) * spe * 0.45 + vec3(1.0, 0.96, 0.9) * rim * 0.18;
    hitT = t;
  } else if (tf < 1e2) {
    vec3 p = ro + rd * tf;
    col = mix(vec3(0.9, 0.87, 0.83) * (0.78 + 0.22 * shadow(p + vec3(0, 0.01, 0), l)), bg, smoothstep(6.0, 22.0, tf));
    hitT = tf;
  } else col = bg;
  // ghosts: march to the nearest operand shell in front of the solid and tint it, stronger at grazing angles
  if (uGS + uGC.x + uGC.y + uGC.z > 0.001) {
    float g = 0.0, ga; vec3 gc;
    for (int i = 0; i < 90; i++) { float h = ghost(ro + rd * g, gc, ga); if (h < 0.0008 || g > hitT) break; g += h; }
    if (g < hitT) {
      vec3 p = ro + rd * g;
      vec2 e = vec2(0.002, 0.0); float a2; vec3 c2;
      vec3 n = normalize(vec3(ghost(p + e.xyy, c2, a2) - ghost(p - e.xyy, c2, a2), ghost(p + e.yxy, c2, a2) - ghost(p - e.yxy, c2, a2), ghost(p + e.yyx, c2, a2) - ghost(p - e.yyx, c2, a2)));
      float f = pow(1.0 - abs(dot(n, rd)), 2.0);
      col = mix(col, gc * 0.9 + 0.1, ga * (0.16 + 0.7 * f));
    }
  }
  return col;
}
void main() {
  vec3 col = vec3(0.0);
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 uv = (2.0 * (gl_FragCoord.xy + vec2(i, j) * 0.5 - 0.25) - uRes) / uRes.x;
    col += render(uv - vec2(0.0, 0.2));
  }
  outColor = vec4(pow(col / 4.0, vec3(0.92)) + grain(gl_FragCoord.xy) / 255.0, 1.0); // fixed dither against banding
}`,
  // the CSG tree: (cube AND sphere) MINUS (cyl OR cyl OR cyl); each node glows while its operation runs
  overlay(ctx, t, W, H) {
    const s = state(t);
    const on = { and: s.gS, minus: Math.max(...s.gC), or: Math.max(...s.gC) };
    const y0 = 1490, y1 = 1640, y2 = 1790;
    const node = (x, y, sym, k) => {
      ctx.fillStyle = `rgba(40, 36, 52, ${0.82})`;
      ctx.beginPath(); ctx.arc(x, y, 40, 0, TAU); ctx.fill();
      ctx.lineWidth = 5; ctx.strokeStyle = `rgba(255, 214, 102, ${0.25 + 0.75 * k})`;
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF'; ctx.font = `700 52px ${FONT.sans}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(sym, x, y + 2);
    };
    const edge = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
    ctx.strokeStyle = 'rgba(60, 54, 70, 0.55)'; ctx.lineWidth = 4;
    edge(540, y0, 330, y1); edge(540, y0, 750, y1);
    edge(330, y1, 230, y2); edge(330, y1, 430, y2);
    edge(750, y1, 630, y2); edge(750, y1, 750, y2); edge(750, y1, 870, y2);
    node(540, y0, '−', on.minus); node(330, y1, '∩', on.and); node(750, y1, '∪', on.or);
    // leaves: little operand icons
    const leaf = (x, color, k, draw) => {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.beginPath(); ctx.roundRect(x - 46, y2 - 46, 92, 92, 22); ctx.fill();
      ctx.lineWidth = 5; ctx.strokeStyle = `rgba(255, 190, 60, ${k})`; ctx.stroke();
      ctx.fillStyle = color; draw(x, y2);
    };
    const red = '#E8454F', blue = '#3878FF', green = '#33C477';
    leaf(230, red, 0, (x, y) => ctx.fillRect(x - 24, y - 24, 48, 48));
    leaf(430, blue, s.gS, (x, y) => { ctx.beginPath(); ctx.arc(x, y, 27, 0, TAU); ctx.fill(); });
    leaf(630, green, s.gC[0], (x, y) => ctx.fillRect(x - 30, y - 11, 60, 22));
    leaf(750, green, s.gC[1], (x, y) => ctx.fillRect(x - 11, y - 30, 22, 60));
    leaf(870, green, s.gC[2], (x, y) => { ctx.beginPath(); ctx.arc(x, y, 15, 0, TAU); ctx.fill(); });
  },
};
