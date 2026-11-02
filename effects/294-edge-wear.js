// Edge wear: a red tool chest (a signed distance field: rounded cabinet and lid, drawer grooves cut with a smooth
// subtraction, bar handles, casters) is ray marched with 2 x 2 samples per pixel. Its curvature is measured from the
// field itself: f(p + e·n) + f(p - e·n) is positive near convex edges, zero on flat panels and negative in grooves. First that curvature map fades in over the chest (orange edges, grey panels, blue
// grooves); then the paint wears where curvature plus a little noise passes a threshold that drops as wear grows:
// chips open on the edges, grey primer rings each chip, bare steel shines in the middle, and grime gathers in the
// grooves. The wear grows and recedes back to new paint while the chest turns on a slow turntable.
import { FONT, smoothstep } from '../lib/util.js';

const curv = t => smoothstep(0.45, 0.95, t) - smoothstep(1.75, 2.25, t);        // the curvature map, shown first
const wear = t => smoothstep(1.85, 3.1, t) - smoothstep(3.75, 4.9, t);          // then the wear grows and recedes

export default {
  name: 'Edge Wear',
  ko: '엣지 마모',
  uniforms: t => ({ uYaw: [0.55 + 0.38 * Math.sin(t / 5 * Math.PI * 2)], uCurv: [curv(t)], uWear: [wear(t)] }),
  frag: `
uniform float uYaw, uCurv, uWear;
const vec3 KEY = normalize(vec3(-0.55, 0.8, 0.5));
float rbox(vec3 p, vec3 b, float r) { vec3 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r; }
float capsule(vec3 p, vec3 a, vec3 b, float r) { vec3 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)) - r; }
float smax(float a, float b, float k) { float h = clamp(0.5 - 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) + k * h * (1.0 - h); }
// the chest in its own space (y up, front at +z); m: 0 red paint, 1 black handle, 2 rubber caster
float chest(vec3 p, out float m) {
  float d = rbox(p - vec3(0.0, 0.95, 0.0), vec3(0.6, 0.8, 0.35), 0.045);
  d = min(d, rbox(p - vec3(0.0, 1.84, 0.0), vec3(0.63, 0.09, 0.375), 0.035));      // lid
  for (int i = 1; i < 4; i++)                                                         // grooves between the drawers
    d = smax(d, -rbox(p - vec3(0.0, 0.15 + 0.4 * float(i), 0.36), vec3(0.54, 0.012, 0.04), 0.0), 0.012);
  for (int s = -1; s <= 1; s += 2)                                                    // and down both sides of them
    d = smax(d, -rbox(p - vec3(0.555 * float(s), 0.95, 0.36), vec3(0.012, 0.79, 0.04), 0.0), 0.012);
  m = 0.0;
  float h = 1e3;
  for (int i = 0; i < 4; i++) {                                                       // a bar handle on every drawer
    float y = 0.45 + 0.4 * float(i);
    h = min(h, capsule(p, vec3(-0.28, y, 0.43), vec3(0.28, y, 0.43), 0.022));
    h = min(h, capsule(p, vec3(-0.28, y, 0.34), vec3(-0.28, y, 0.43), 0.02));
    h = min(h, capsule(p, vec3(0.28, y, 0.34), vec3(0.28, y, 0.43), 0.02));
  }
  if (h < d) { d = h; m = 1.0; }
  vec3 q = vec3(abs(p.x) - 0.47, p.y - 0.075, abs(p.z) - 0.24);                    // casters
  float c = max(length(q.yz) - 0.07, abs(q.x) - 0.03);
  if (c < d) { d = c; m = 2.0; }
  return d;
}
mat2 R(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
vec3 toLocal(vec3 p) { p.xz = R(uYaw) * p.xz; return p; }
float map(vec3 p, out float m) { return chest(toLocal(p), m); }
float map(vec3 p) { float m; return map(p, m); }
vec3 normal(vec3 p) { vec2 e = vec2(0.0015, 0.0); return normalize(vec3(map(p + e.xyy) - map(p - e.xyy), map(p + e.yxy) - map(p - e.yxy), map(p + e.yyx) - map(p - e.yyx))); }
// the curvature: the second difference of the distance field along the normal, f(q + e n) + f(q - e n), over e.
// On a flat panel it is e - e = 0; near a convex edge the inner sample is closer to another face, so it is > 0;
// in a groove the outer sample is, so it is < 0. A step of 5.5 cm gives edge bands a few centimetres wide.
float curvature(vec3 q, vec3 n) {
  float m, e = 0.055;
  float k = (chest(q + n * e, m) + chest(q - n * e, m)) / e * 2.2;
  return sign(k) * max(abs(k) - 0.15, 0.0) / 0.85;                                    // a small dead zone keeps panels flat
}
float shadow(vec3 ro, vec3 rd) {
  float s = 1.0, t = 0.02;
  for (int i = 0; i < 40; i++) { float h = map(ro + rd * t); s = min(s, 10.0 * h / t); t += clamp(h, 0.02, 0.2); if (s < 0.01 || t > 4.0) break; }
  return clamp(s, 0.0, 1.0);
}
float ao(vec3 p, vec3 n) { float o = 0.0; for (int i = 1; i <= 4; i++) { float h = 0.03 * float(i); o += (h - map(p + n * h)) / h; } return clamp(1.0 - 0.3 * o, 0.0, 1.0); }
vec3 env(vec3 d) { return mix(vec3(0.16, 0.15, 0.15), vec3(0.85, 0.86, 0.9), smoothstep(-0.2, 0.7, d.y)) + vec3(1.2) * smoothstep(0.9, 0.97, dot(d, KEY)); }
vec3 curvColour(float k) {
  return k < 0.0 ? mix(vec3(0.16), vec3(0.03, 0.15, 1.0), clamp(-k * 1.5, 0.0, 1.0)) : mix(mix(vec3(0.16), vec3(1.0, 0.3, 0.03), clamp(k * 1.3, 0.0, 1.0)), vec3(1.0, 0.9, 0.55), clamp(k - 0.9, 0.0, 1.0));
}
vec3 shadeChest(vec3 p, vec3 rd) {
  float m; map(p, m);
  vec3 n = normal(p), q = toLocal(p), v = -rd, h = normalize(KEY + v);
  vec3 nq = n; nq.xz = R(uYaw) * nq.xz;
  float k = curvature(q, nq);
  float sh = shadow(p + n * 0.01, KEY), occ = ao(p, n);
  float dif = max(dot(n, KEY), 0.0) * sh;
  if (m > 1.5) return vec3(0.05) * (0.3 + dif) * occ;                                // rubber casters
  if (m > 0.5) return mix(vec3(0.7, 0.71, 0.73) * (env(reflect(rd, n)) * 0.8 + 0.2 * dif) * occ + pow(max(dot(n, h), 0.0), 60.0) * sh,
                          curvColour(k) * (0.35 + 0.65 * max(dot(n, KEY) * 0.5 + 0.5, 0.0)), uCurv);      // chrome handles do not wear
  // the wear mask: curvature plus breakup noise against a threshold that drops as wear grows
  float nz = 0.9 * fbm(q * 5.0) + 0.3 * snoise(q * 25.0);
  float v0 = 1.3 * k + nz + 0.3 * smoothstep(0.35, 0.15, q.y);                        // the bottom edge scuffs more
  float thr = 2.2 - 1.75 * uWear;
  float metal = smoothstep(thr - 0.02, thr + 0.02, v0), primer = smoothstep(thr - 0.17, thr - 0.13, v0);
  vec3 paint = vec3(0.6, 0.06, 0.04);
  paint *= 1.0 - 0.55 * smoothstep(-0.15, -0.6, k) * (0.4 + 0.6 * uWear);              // grime in the grooves
  float fr = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
  vec3 cPaint = paint * (0.12 + 0.95 * dif) * occ + vec3(1.0) * pow(max(dot(n, h), 0.0), 90.0) * 1.2 * sh + env(reflect(rd, n)) * fr * 0.5 * occ;
  vec3 cPrimer = vec3(0.12, 0.125, 0.13) * (0.2 + 0.8 * dif) * occ;
  float brush = 0.85 + 0.15 * snoise(vec3(q.x * 60.0, q.y * 3.0, q.z * 60.0));
  vec3 cSteel = vec3(0.56, 0.57, 0.6) * brush * (env(reflect(rd, n)) * 0.75 * occ + 0.6 * dif) + vec3(1.0) * pow(max(dot(n, h), 0.0), 30.0) * 0.8 * sh;
  vec3 c = mix(mix(cPaint, cPrimer, primer), cSteel, metal);
  return mix(c, curvColour(k) * (0.35 + 0.65 * max(dot(n, KEY) * 0.5 + 0.5, 0.0)), uCurv);
}
vec3 render(vec3 ro, vec3 rd, vec2 frag) {
  vec3 bg = mix(vec3(0.2, 0.2, 0.21), vec3(0.08, 0.085, 0.09), smoothstep(200.0, 1700.0, frag.y));
  // the chest's bounding box: march only rays that can hit it
  float t = 0.0; bool hit = false;
  vec3 b = vec3(0.9, 1.05, 0.9), oc = ro - vec3(0.0, 0.95, 0.0);
  vec3 t0 = (-b - oc) / rd, t1 = (b - oc) / rd, tmin = min(t0, t1), tmax = max(t0, t1);
  float tn = max(max(tmin.x, tmin.y), tmin.z), tf = min(min(tmax.x, tmax.y), tmax.z);
  if (tn < tf && tf > 0.0) {
    t = max(tn, 0.0);
    for (int i = 0; i < 120; i++) { float d = map(ro + rd * t); if (d < 0.0008) { hit = true; break; } t += d; if (t > tf) break; }
  }
  float tFloor = rd.y < 0.0 ? -ro.y / rd.y : 1e9;
  if (hit && t < tFloor) return shadeChest(ro + rd * t, rd);
  if (tFloor < 1e8) {                                                                 // floor: soft shadow and contact occlusion
    vec3 p = ro + rd * tFloor;
    float sh = length(p.xz) < 3.0 ? shadow(p + vec3(0, 0.002, 0), KEY) : 1.0;
    float occ = length(p.xz) < 2.0 ? clamp(0.35 + map(p + vec3(0, 0.15, 0)) * 3.0, 0.0, 1.0) : 1.0;
    vec3 c = vec3(0.3, 0.3, 0.31) * (0.45 + 0.55 * sh) * occ;
    return mix(c, bg, smoothstep(4.0, 9.0, tFloor));
  }
  return bg;
}
void main() {
  vec3 ro = vec3(0.0, 1.9, 5.9), ta = vec3(0.0, 0.9, 0.0);
  vec3 fw = normalize(ta - ro), rt = normalize(cross(fw, vec3(0, 1, 0))), up = cross(rt, fw);
  vec3 col = vec3(0.0);
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 fc = gl_FragCoord.xy + (vec2(i, j) + 0.5) / 2.0 - 0.5;
    vec2 uv = (fc - vec2(0.5 * uRes.x, 0.5 * uRes.y + 90.0)) / uRes.y;
    col += render(ro, normalize(fw * 1.55 + uv.x * rt + uv.y * up), vec2(fc.x, uRes.y - fc.y));
  }
  col /= 4.0;
  col = col * (2.51 * col + 0.03) / (col * (2.43 * col + 0.59) + 0.14);
  outColor = vec4(pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2)) + grain(gl_FragCoord.xy) / 255.0, 1.0);
}`,
  overlay(ctx, t, W, H) {
    const k = curv(t), w = wear(t), x = 60, y = 1600;
    ctx.fillStyle = 'rgba(10, 10, 12, 0.72)'; ctx.beginPath(); ctx.roundRect(x - 20, y - 60, W - 80, 280, 26); ctx.fill();
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    // the curvature legend
    ctx.globalAlpha = 0.35 + 0.65 * k;
    ctx.fillStyle = '#FFFFFF'; ctx.font = `700 26px ${FONT.sans}`; ctx.fillText('CURVATURE', x, y - 14);
    const g = ctx.createLinearGradient(x, 0, x + 420, 0);
    g.addColorStop(0, '#1F59FF'); g.addColorStop(0.5, '#808080'); g.addColorStop(0.85, '#FF7319'); g.addColorStop(1, '#FFF2BF');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y + 4, 420, 22, 11); ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; ctx.font = `500 21px ${FONT.sans}`;
    ctx.fillText('concave', x, y + 58); ctx.textAlign = 'center'; ctx.fillText('flat', x + 210, y + 58); ctx.textAlign = 'right'; ctx.fillText('convex', x + 420, y + 58);
    // the wear amount and the rule
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
    const wx = 560;
    ctx.fillStyle = '#FFFFFF'; ctx.font = `700 26px ${FONT.sans}`; ctx.fillText('WEAR', wx, y - 14);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'; ctx.beginPath(); ctx.roundRect(wx, y + 4, 420, 22, 11); ctx.fill();
    ctx.fillStyle = '#D9DCE0'; ctx.beginPath(); ctx.roundRect(wx, y + 4, Math.max(22, 420 * w), 22, 11); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.font = `700 34px ${FONT.mono}`; ctx.fillText(`${Math.round(w * 100)}%`, wx, y + 70);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)'; ctx.font = `500 22px ${FONT.sans}`;
    ctx.fillText('chip where  curvature + noise  >  threshold(wear)', x, y + 150);
    ctx.fillStyle = '#B5231C'; ctx.fillRect(x, y + 176, 22, 22); ctx.fillStyle = '#55595D'; ctx.fillRect(x + 150, y + 176, 22, 22); ctx.fillStyle = '#C9CCD0'; ctx.fillRect(x + 310, y + 176, 22, 22);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)'; ctx.fillText('paint', x + 32, y + 195); ctx.fillText('primer', x + 182, y + 195); ctx.fillText('bare steel', x + 342, y + 195);
  },
};
