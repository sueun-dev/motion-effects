// Solid texture: the wood is a function of 3D position (rings around a vertical pith, warped by noise, plus fibres),
// not an image wrapped on the surface. A raymarched block is cut into five slices that lift and fan out; every
// fresh cut face shows end-grain rings that line up with the long grain on the sides, then the block closes again.
export default {
  name: 'Solid Texture',
  ko: '솔리드 텍스처',
  frag: `
const vec3 HALF = vec3(0.95, 1.5, 0.95);   // the whole block, resting on the floor (y 0 .. 3)
const float SLICE = 0.6;                   // five slices, 0.6 thick
float sdRoundBox(vec3 p, vec3 b, float r) { vec3 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r; }

float open() { return smoothstep(0.08, 0.92, 0.5 - 0.5 * cos(uPhase * TAU)); } // 0 at 0 s and 5 s, 1 at 2.5 s

// a point in slice i's frame back to the block's rest position (where the wood pattern lives)
vec3 toRest(vec3 p, float i, float s) {
  float yaw = 0.22 * sin(uPhase * TAU);              // the whole stack sways
  p.xz = rot(-yaw) * p.xz;
  float lift = i * 0.32 * s, turn = i * 0.24 * s;    // each slice lifts and turns a little more than the one below
  vec3 c = vec3(0.0, (i + 0.5) * SLICE, 0.0);
  vec3 q = p - c - vec3(0.0, lift, 0.0);
  q.xz = rot(turn) * q.xz;
  q.yz = rot(-i * 0.07 * s) * q.yz;                  // and tips toward the camera so its cut face shows
  return q + c;
}
float slab(vec3 p, float i, float s) {
  vec3 r = toRest(p, i, s);
  float block = sdRoundBox(r - vec3(0.0, HALF.y, 0.0), HALF, 0.06);
  return max(block, abs(r.y - (i + 0.5) * SLICE) - 0.5 * SLICE);   // flat cut faces, rounded outer edges
}
float map(vec3 p, out float id) {
  float s = open(), d = 1e3;
  for (int i = 0; i < 5; i++) { float k = slab(p, float(i), s); if (k < d) { d = k; id = float(i); } }
  return d;
}
float map(vec3 p) { float id; return map(p, id); }
vec3 normal(vec3 p) {
  vec2 e = vec2(0.001, 0.0);
  return normalize(vec3(map(p + e.xyy) - map(p - e.xyy), map(p + e.yxy) - map(p - e.yxy), map(p + e.yyx) - map(p - e.yyx)));
}
float shadow(vec3 ro, vec3 rd) {
  float res = 1.0, t = 0.02;
  for (int i = 0; i < 48; i++) { float h = map(ro + rd * t); res = min(res, 10.0 * h / t); t += clamp(h, 0.02, 0.25); if (h < 0.0005 || t > 7.0) break; }
  return clamp(res, 0.0, 1.0);
}

// the solid texture: wood rings around a pith at (x, z) = (-0.3, 0.2), warped by noise, with fine fibres along y
vec3 wood(vec3 p) {
  vec2 d = p.xz - vec2(-0.3, 0.2);
  float r = length(d) + 0.07 * snoise(vec3(p.xz * 1.1, p.y * 0.3)) + 0.015 * snoise(p * vec3(3.0, 0.6, 3.0));
  r += 0.05 * sin(atan(d.y, d.x) * 3.0 + p.y * 0.8) * r;          // slightly out-of-round growth
  float ring = r * 7.0 + 0.5 * snoise(vec3(r * 2.0, 0.0, 3.0));    // uneven ring widths
  float late = pow(0.5 + 0.5 * cos(TAU * ring), 5.0);              // thin dark latewood bands
  float fibre = snoise(vec3(p.x * 14.0, p.y * 1.2, p.z * 14.0));
  vec3 col = mix(vec3(0.78, 0.40, 0.16), vec3(0.30, 0.11, 0.035), late * 0.9);   // linear colours: light oak, dark latewood
  col *= 0.93 + 0.07 * fibre;
  col = mix(col, vec3(0.16, 0.055, 0.02), smoothstep(0.12, 0.0, length(d)) * 0.7); // dark pith
  return col;
}

vec3 render(vec2 uv) {
  vec3 ro = vec3(6.5, 6.4, 10.2), ta = vec3(0.0, 2.15, 0.0);
  vec3 f = normalize(ta - ro), rt = normalize(cross(f, vec3(0, 1, 0))), up = cross(rt, f);
  vec3 rd = normalize(f * 3.3 + uv.x * rt + uv.y * up);
  vec3 bg = mix(vec3(0.003, 0.009, 0.014), vec3(0.022, 0.05, 0.065), clamp(0.55 + uv.y * 0.6, 0.0, 1.0));
  bg *= 1.0 - 0.35 * dot(uv, uv);                                  // vignette
  vec3 l = normalize(vec3(-0.55, 0.85, 0.35));
  float t = 0.0, id = 0.0;
  for (int i = 0; i < 140; i++) { float h = map(ro + rd * t, id); if (h < 0.0005 || t > 30.0) break; t += h * 0.9; }
  float tf = rd.y < 0.0 ? -ro.y / rd.y : 1e3;                      // the floor at y = 0
  if (t > 30.0 || tf < t) {
    vec3 p = ro + rd * tf;
    float sh = shadow(p + vec3(0.0, 0.002, 0.0), l);
    float ao = clamp(0.35 + 0.65 * smoothstep(0.0, 1.6, map(p)), 0.0, 1.0);
    vec3 fc = vec3(0.03, 0.06, 0.072) * (0.3 + 0.7 * sh) * ao;
    return mix(fc, bg, smoothstep(6.0, 22.0, length(p.xz)));
  }
  vec3 p = ro + rd * t, n = normal(p);
  vec3 rp = toRest(p, id, open());
  vec3 alb = wood(rp);
  float dif = max(dot(n, l), 0.0) * shadow(p + n * 0.004, l);
  float ao = clamp(0.5 + 0.5 * map(p + n * 0.15) / 0.15, 0.0, 1.0);
  float spe = pow(max(dot(reflect(-l, n), -rd), 0.0), 40.0) * 0.18;
  vec3 col = alb * (vec3(0.07, 0.09, 0.11) + vec3(1.0, 0.86, 0.68) * 1.25 * dif) * ao + spe;
  col += alb * vec3(0.10, 0.15, 0.17) * max(n.y, 0.0);            // cool skylight on the up faces
  col += alb * vec3(0.16, 0.22, 0.26) * max(dot(n, normalize(vec3(0.9, 0.1, -0.2))), 0.0); // cool fill from the right
  return col;
}
void main() {
  vec3 col = vec3(0.0);
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 uv = (2.0 * (gl_FragCoord.xy + vec2(i, j) * 0.5 - 0.25) - uRes) / uRes.y;
    col += render(uv);
  }
  col /= 4.0;
  col = col / (1.0 + col * 0.15);                                  // gentle highlight roll-off
  outColor = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);
}`,
};
