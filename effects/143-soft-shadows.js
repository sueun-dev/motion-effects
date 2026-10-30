// Soft shadows: one spherical lamp over a sphere, a ring, a thin pole and a block (raymarched distance fields).
// Its radius swells from 0.04 to 1.0 and back while its power stays the same, so only the shadows change: hard edges
// under the tiny lamp, then wide penumbrae, the ring's hole filling in and the pole's shadow fading away.
// Shadows are traced as cones whose width is the lamp's angular size (sphere-light soft shadows), 2 x 2 supersampled.
import { TAU, phase, FONT } from '../lib/util.js';

const radius = t => { const k = 0.5 - 0.5 * Math.cos(phase(t) * TAU); return 0.04 + 0.96 * k * k * (3 - 2 * k); };
const lamp = t => { const a = phase(t) * TAU; return [0.35 + 0.7 * Math.sin(a), 3.75, -0.5 + 0.35 * Math.sin(2 * a)]; };

export default {
  name: 'Soft Shadows',
  ko: '소프트 섀도',
  uniforms: t => ({ uR: radius(t), uL: lamp(t) }),
  frag: `
uniform float uR;   // lamp radius
uniform vec3 uL;    // lamp centre
float sdBox(vec3 p, vec3 b, float r) { vec3 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r; }
float sdTorus(vec3 p, vec2 t) { vec2 q = vec2(length(p.xy) - t.x, p.z); return length(q) - t.y; }
float sdCyl(vec3 p, float r, float h) { vec2 d = vec2(length(p.xz) - r, abs(p.y) - h); return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)); }

// objects only (the floor is a plane, hit and shadowed separately); id: 1 sphere, 2 ring, 3 pole, 4 block
float objects(vec3 p, out float id) {
  float d = length(p - vec3(-1.35, 0.78, 0.55)) - 0.78; id = 1.0;
  vec3 q = p - vec3(1.25, 0.95, -0.35); q.xz = rot(-0.55) * q.xz;
  float e = sdTorus(q, vec2(0.72, 0.2)); if (e < d) { d = e; id = 2.0; }
  e = sdCyl(p - vec3(-0.2, 1.25, -1.6), 0.07, 1.25); if (e < d) { d = e; id = 3.0; }
  vec3 b = p - vec3(0.55, 0.42, 1.35); b.xz = rot(0.5) * b.xz;
  e = sdBox(b, vec3(0.42), 0.06); if (e < d) { d = e; id = 4.0; }
  return d;
}
float objects(vec3 p) { float id; return objects(p, id); }
vec3 normal(vec3 p) {
  vec2 e = vec2(0.001, 0.0);
  return normalize(vec3(objects(p + e.xyy) - objects(p - e.xyy), objects(p + e.yxy) - objects(p - e.yxy), objects(p + e.yyx) - objects(p - e.yyx)));
}
// visibility of a sphere lamp (radius uR) from p: a cone traced towards its centre, as wide as the lamp looks from p
float softShadow(vec3 p) {
  vec3 tl = uL - p; float dist = length(tl); vec3 rd = tl / dist;
  float w = uR / dist, res = 1.0, t = 0.02;
  for (int i = 0; i < 96; i++) {
    float h = objects(p + rd * t);
    res = min(res, h / (w * t));
    t += clamp(h, 0.01, 0.25);
    if (res < -1.0 || t > dist - uR) break;
  }
  res = max(res, -1.0);
  return 0.25 * (1.0 + res) * (1.0 + res) * (2.0 - res); // smooth from umbra (-1) to fully lit (+1)
}
vec3 albedo(float id) {
  if (id < 1.5) return vec3(1.0, 0.42, 0.38);
  if (id < 2.5) return vec3(0.35, 0.55, 1.0);
  if (id < 3.5) return vec3(0.22, 0.22, 0.28);
  return vec3(1.0, 0.78, 0.3);
}
vec3 light(vec3 p, vec3 n) {
  vec3 tl = uL - p; float d2 = dot(tl, tl);
  float dif = max(dot(n, normalize(tl)), 0.0) * 19.0 / d2;  // same power whatever the lamp size
  return vec3(1.0, 0.93, 0.82) * dif * softShadow(p + n * 0.003) + vec3(0.44, 0.42, 0.50) * (0.5 + 0.5 * n.y) * 0.32;
}
vec3 render(vec2 uv) {
  vec3 ro = vec3(0.0, 6.6, 8.6), ta = vec3(0.0, 1.55, 0.0);
  vec3 f = normalize(ta - ro), r = normalize(cross(f, vec3(0, 1, 0))), u = cross(r, f);
  vec3 rd = normalize(uv.x * r + uv.y * u + 3.3 * f);
  // the lamp itself
  vec3 oc = ro - uL; float b = dot(oc, rd), c = dot(oc, oc) - uR * uR, disc = b * b - c;
  float tLamp = disc > 0.0 ? -b - sqrt(disc) : 1e9;
  float id, t = 0.0;
  for (int i = 0; i < 140; i++) { float h = objects(ro + rd * t, id); if (h < 0.0006 || t > 30.0) break; t += h; }
  float tf = rd.y < 0.0 ? -ro.y / rd.y : 1e9;
  vec3 col;
  if (t < 30.0 && t < tf) {
    vec3 p = ro + rd * t, n = normal(p);
    col = albedo(id) * light(p, n);
    vec3 h = normalize(normalize(uL - p) - rd);
    col += vec3(1.0, 0.95, 0.85) * pow(max(dot(n, h), 0.0), 40.0) * 0.25 * softShadow(p + n * 0.003);
  } else if (tf < 1e8) {
    vec3 p = ro + rd * tf;
    col = vec3(0.93, 0.89, 0.84) * light(p, vec3(0, 1, 0));
    col = mix(col, vec3(0.16, 0.14, 0.17), smoothstep(9.0, 22.0, length(p.xz)));
  } else col = vec3(0.16, 0.14, 0.17);
  if (tLamp < min(t, tf)) {                                   // a frosted globe: white-hot centre, warmer rim
    float ndv = clamp(-dot(normalize(ro + rd * tLamp - uL), rd), 0.0, 1.0);
    col = mix(vec3(1.0, 0.6, 0.3) * 1.3, vec3(1.0, 0.96, 0.88) * 1.9, pow(ndv, 0.6));
  }
  // glow round the lamp
  float dl = length(cross(rd, uL - ro)), k = max(dl - uR, 0.0);
  col += vec3(1.0, 0.85, 0.6) * 0.16 * exp(-k * 3.0) * (0.6 + uR);
  return col;
}
void main() {
  vec3 col = vec3(0.0);
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 uv = (2.0 * (gl_FragCoord.xy + vec2(i, j) * 0.5 - 0.25) - uRes) / uRes.x;
    col += render(uv);
  }
  col /= 4.0;
  col = col / (1.0 + col * 0.35);                                  // soft roll-off of the highlights
  outColor = vec4(pow(col, vec3(1.0 / 2.2)) + grain(gl_FragCoord.xy) / 255.0, 1.0); // fixed dither: no banding in the glow
}`,
  overlay(ctx, t, W, H) {
    const r = radius(t), k = (r - 0.04) / 0.96;
    const x0 = 170, x1 = 860, y = 1790;
    ctx.fillStyle = 'rgba(25, 22, 30, 0.72)';
    ctx.beginPath(); ctx.roundRect(70, 1680, W - 140, 180, 28); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.font = `700 30px ${FONT.sans}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText('light size', 110, 1730);
    ctx.textAlign = 'right'; ctx.font = `500 26px ${FONT.sans}`; ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    const fade = (a, b) => Math.min(1, Math.max(0, (k - a) / (b - a)));      // one caption fades out, then the other in
    ctx.globalAlpha = 1 - fade(0.3, 0.45); ctx.fillText('small light · hard edges', W - 110, 1730);
    ctx.globalAlpha = fade(0.55, 0.7); ctx.fillText('big light · wide penumbra', W - 110, 1730);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.beginPath(); ctx.roundRect(x0, y - 4, x1 - x0, 8, 4); ctx.fill();
    ctx.fillStyle = '#FFE7B8';
    ctx.beginPath(); ctx.arc(110, y, 7, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(W - 110, y, 26, 0, TAU); ctx.fill();
    ctx.fillStyle = '#FFD27A';
    ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * k, y, 8 + 14 * k, 0, TAU); ctx.fill();
  },
};
