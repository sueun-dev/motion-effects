// Ferrofluid: a pool of glossy black magnetic fluid in an aluminium dish raised on three legs. A neodymium magnet
// lifts up under the dish; as the field grows the surface first bulges into a smooth mound, then, past the critical
// field (the Rosensweig instability), sharp spikes rise in a hexagonal pattern, the middle ones first and tallest.
// The magnet lowers again and the spikes sink back into a flat mirror. The fluid is a height field (mound + one
// concave cone per hexagonal lattice point, tips rounded) marched along each ray and refined by bisection; it is
// almost pure reflection (Fresnel from 5 %) of a studio with three soft boxes. 2 x 2 supersampling.
import { smoothstep, FONT } from '../lib/util.js';

// the magnet's lift (0 down .. 1 up), and the field the fluid feels (a little behind it)
const lift = t => smoothstep(0.0, 1.4, t) * (1 - smoothstep(3.0, 4.4, t));
const field = t => smoothstep(0.15, 1.6, t) * (1 - smoothstep(3.1, 4.5, t));
const START = 0.6; // the video starts as the spikes begin, so the loop seam is in motion

export default {
  name: 'Ferrofluid',
  ko: '자성 유체',
  uniforms(time) {
    const t = (time + START) % 5;
    return { uLift: lift(t), uField: field(t) };
  },
  frag: `
uniform float uLift, uField;
const float R = 1.0, SPACE = 0.165, TABLE = -0.95;

// one concave cone per hexagonal lattice point; inner spikes start growing at a lower field than outer ones
float spikes(vec2 p) {
  vec2 a1 = vec2(SPACE, 0.0), a2 = vec2(SPACE * 0.5, SPACE * 0.8660254);
  mat2 inv = inverse(mat2(a1, a2));
  vec2 q = floor(inv * p);
  float h = 0.0;
  for (int j = -1; j <= 2; j++) for (int i = -1; i <= 2; i++) {
    vec2 c = mat2(a1, a2) * (q + vec2(i, j));
    float rc = length(c);
    if (rc > 0.86) continue;
    float grow = smoothstep(0.42 + 0.42 * rc, 0.72 + 0.42 * rc, uField);
    float amp = grow * (0.34 - 0.2 * rc * rc);
    float d = sqrt(dot(p - c, p - c) + 0.00012) / (SPACE * 0.6);
    h = max(h, amp * pow(max(0.0, 1.0 - d), 2.2));
  }
  return h;
}
// height of the fluid surface over (x, z)
float height(vec2 p) {
  float r = length(p);
  float mound = 0.07 * uField * (1.0 - r * r) - 0.012 * uField;
  float meniscus = 0.018 * exp(-(R - r) / 0.03);
  return mound + meniscus + spikes(p);
}
vec3 fluidNormal(vec2 p) {
  vec2 e = vec2(0.0015, 0.0);
  return normalize(vec3(height(p - e.xy) - height(p + e.xy), 2.0 * e.x, height(p - e.yx) - height(p + e.yx)));
}

// studio surroundings for reflections: dark walls, a big soft box overhead, warm and cool strips at the sides
vec3 env(vec3 d, float soft) {
  vec3 c = mix(vec3(0.018, 0.02, 0.028), vec3(0.07, 0.075, 0.09), clamp(d.y * 0.6 + 0.5, 0.0, 1.0));
  if (d.y > 0.0) {
    vec2 p = d.xz / d.y;
    float b = smoothstep(0.75 + soft, 0.75 - soft, abs(p.x)) * smoothstep(0.42 + soft, 0.42 - soft, abs(p.y - 0.15));
    c += vec3(3.2, 3.1, 2.9) * b;
  }
  if (d.z < 0.0) {                                                         // a strip light behind the dish
    vec2 p = d.xy / -d.z;
    float b = smoothstep(0.8 + soft, 0.8 - soft, abs(p.x)) * smoothstep(0.035 + soft, 0.035 - soft, abs(p.y - 0.2));
    c += vec3(2.4, 2.4, 2.6) * b;
  }
  vec2 s = d.yz / max(abs(d.x), 1e-3);
  if (abs(d.x) > 0.2) {
    float b = smoothstep(0.1 + soft, 0.1 - soft, abs(s.y + 0.25)) * smoothstep(0.9 + soft, 0.9 - soft, abs(s.x - 0.25));
    c += (d.x < 0.0 ? vec3(2.6, 1.7, 1.0) : vec3(1.0, 1.7, 2.8)) * b;
  }
  return c;
}

// the solid parts as distances: the dish (a shallow cylinder with a hollow), three legs, the magnet on its rod
float sdCyl(vec3 p, float r, float h) { vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h); return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)); }
float magnetTop() { return mix(-0.66, -0.165, uLift); }
float solids(vec3 p, out int id) {
  float dish = sdCyl(p - vec3(0.0, -0.035, 0.0), 1.1, 0.09) - 0.012;
  dish = max(dish, -sdCyl(p - vec3(0.0, 0.06, 0.0), R, 0.1));
  float legs = 1e3;
  for (int k = 0; k < 3; k++) {
    float a = float(k) * TAU / 3.0 + 0.5;
    vec3 q = p - vec3(0.86 * cos(a), (TABLE - 0.13) * 0.5, 0.86 * sin(a));
    legs = min(legs, sdCyl(q, 0.035, (-0.13 - TABLE) * 0.5));
  }
  float mt = magnetTop();
  float magnet = sdCyl(p - vec3(0.0, mt - 0.13, 0.0), 0.32, 0.13) - 0.01;
  float rod = sdCyl(p - vec3(0.0, (mt - 0.26 + TABLE) * 0.5, 0.0), 0.07, max(0.001, (mt - 0.26 - TABLE) * 0.5));
  float base = sdCyl(p - vec3(0.0, TABLE + 0.03, 0.0), 0.42, 0.03) - 0.01;
  float d = dish; id = 1;
  if (legs < d) { d = legs; id = 2; }
  if (magnet < d) { d = magnet; id = 3; }
  if (min(rod, base) < d) { d = min(rod, base); id = 2; }
  return d;
}
float solids(vec3 p) { int id; return solids(p, id); }
vec3 solidNormal(vec3 p) {
  vec2 e = vec2(0.001, 0.0);
  return normalize(vec3(solids(p + e.xyy) - solids(p - e.xyy), solids(p + e.yxy) - solids(p - e.yxy), solids(p + e.yyx) - solids(p - e.yyx)));
}

vec3 render(vec2 uv) {
  vec3 ro = vec3(0.0, 0.78, 3.2), ta = vec3(0.0, -0.3, 0.0);
  vec3 fw = normalize(ta - ro), rt = normalize(cross(fw, vec3(0, 1, 0))), up = cross(rt, fw);
  vec3 rd = normalize(fw + 0.4 * (uv.x * rt + uv.y * up));
  // the backdrop: a soft graphite sweep with a pool of light behind the dish
  vec3 col = mix(vec3(0.03, 0.032, 0.045), vec3(0.11, 0.115, 0.14), smoothstep(-0.9, 0.5, uv.y));
  col += vec3(0.07, 0.065, 0.08) * exp(-dot(uv - vec2(0.0, 0.25), uv - vec2(0.0, 0.25)) * 2.0);
  float best = 1e9;
  // the table
  if (rd.y < 0.0) {
    float tt = (TABLE - ro.y) / rd.y;
    vec3 p = ro + rd * tt;
    float r = length(p.xz);
    vec3 tc = vec3(0.045, 0.043, 0.05) * (0.45 + 0.55 * smoothstep(0.2, 1.4, r));   // darker under the dish
    tc += env(reflect(rd, vec3(0, 1, 0)), 0.35) * 0.05;
    col = mix(tc, col, smoothstep(5.0, 9.0, tt));
    best = tt;
  }
  // the solids
  float t = 0.0; int id = 0; bool solid = false;
  for (int i = 0; i < 160; i++) {
    vec3 p = ro + rd * t;
    float d = solids(p, id);
    if (d < 0.0006) { solid = true; break; }
    t += d;
    if (t > min(best, 12.0)) break;
  }
  if (solid && t < best) {
    vec3 p = ro + rd * t, n = solidNormal(p), rf = reflect(rd, n);
    float fr = pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
    if (id == 1) col = env(rf, 0.3) * vec3(0.62, 0.64, 0.68) + vec3(0.03);                  // brushed aluminium
    else if (id == 2) col = env(rf, 0.08) * vec3(0.8) + vec3(0.01);                          // chrome
    else {                                                                                   // the magnet: red north face
      vec3 paint = p.y > magnetTop() - 0.12 ? vec3(0.62, 0.05, 0.05) : vec3(0.75);
      col = p.y > magnetTop() - 0.12 ? paint * (0.25 + 0.6 * max(n.y, 0.0) + 0.3 * max(n.z, 0.0)) + env(rf, 0.12) * (0.06 + 0.9 * fr)
                                     : env(rf, 0.08) * 0.8;
    }
    best = t;
  }
  // the fluid: march the height field inside the dish, refine the crossing by bisection
  vec3 oc = ro; float b = dot(oc.xz, rd.xz), a = dot(rd.xz, rd.xz), c = dot(oc.xz, oc.xz) - R * R, disc = b * b - a * c;
  if (disc > 0.0) {
    float t0 = max(0.0, (-b - sqrt(disc)) / a), t1 = (-b + sqrt(disc)) / a;
    float ty = (0.45 - ro.y) / rd.y; t0 = max(t0, ty);
    t1 = min(t1, (-0.04 - ro.y) / rd.y);                                   // the dish floor
    float tl = t0, prev = 1.0;
    bool hit = false;
    for (int i = 0; i < 200; i++) {
      if (tl > min(t1, best)) break;
      vec3 p = ro + rd * tl;
      float d = p.y - height(p.xz);
      if (d < 0.0) { hit = p.y > -0.045; break; }                         // entering from below the floor is not fluid
      prev = tl;
      tl += max(0.0015, d * 0.22);
    }
    if (hit) {
      float lo = prev, hi = tl;
      for (int i = 0; i < 8; i++) { float m = 0.5 * (lo + hi); vec3 p = ro + rd * m; if (p.y - height(p.xz) < 0.0) hi = m; else lo = m; }
      vec3 p = ro + rd * hi, n = fluidNormal(p.xz), rf = reflect(rd, n);
      float fr = 0.05 + 0.95 * pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
      col = env(rf, 0.04) * fr + vec3(0.006, 0.006, 0.008);
    }
  }
  return col;
}
void main() {
  vec3 col = vec3(0.0);
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 uv = (2.0 * (gl_FragCoord.xy + vec2(i, j) * 0.5 - 0.25) - uRes) / uRes.x;
    col += render(uv + vec2(0.0, 0.06));
  }
  col /= 4.0;
  col = col * (2.51 * col + 0.03) / (col * (2.43 * col + 0.59) + 0.14);    // ACES fit
  outColor = vec4(pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2)) + grain(gl_FragCoord.xy) / 255.0, 1.0);   // fixed dither
}`,
  // a gauge under the dish: the field at the fluid, with the critical field marked
  overlay(ctx, time, W, H) {
    const t = (time + START) % 5, f = field(t);
    const x0 = 170, x1 = 910, y = 1690, crit = 0.42;  // the middle spikes start at 0.42
    ctx.textAlign = 'left';
    ctx.font = `600 26px ${FONT.sans}`; ctx.fillStyle = 'rgba(225, 230, 245, 0.62)';
    ctx.fillText('MAGNETIC FIELD AT THE FLUID', x0, y - 52);
    ctx.textAlign = 'right'; ctx.fillStyle = '#FFFFFF'; ctx.font = `700 30px ${FONT.sans}`;
    ctx.fillText(`${Math.round(f * 42)} mT`, x1, y - 52);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)'; ctx.lineWidth = 14;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    if (f > 0.004) {
      const g = ctx.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, '#5F7BFF'); g.addColorStop(crit, '#B26BFF'); g.addColorStop(1, '#FF5C7A');
      ctx.strokeStyle = g; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + (x1 - x0) * f, y); ctx.stroke();
    }
    const xc = x0 + (x1 - x0) * crit;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(xc, y - 22); ctx.lineTo(xc, y + 22); ctx.stroke(); ctx.setLineDash([]);
    ctx.textAlign = 'center'; ctx.font = `500 24px ${FONT.sans}`; ctx.fillStyle = 'rgba(225, 230, 245, 0.7)';
    ctx.fillText('critical field: spikes appear', xc, y + 58);
  },
};
