// Ambient occlusion: a white clay still life in a room corner, lit by soft sky light (raymarched distance fields).
// A wipe slides back and forth: on the left the sky light reaches every point equally (AO off) and the shapes look
// pasted on; on the right each point is darkened by how much of the sky the nearby geometry hides (AO on), so
// contacts, creases, gaps and corners fill with soft shadow. AO here: 16 hemisphere directions marched through the field.
import { TAU, phase, FONT } from '../lib/util.js';

const wipe = t => 0.5 + 0.36 * Math.sin(phase(t) * TAU); // 0..1 across the screen

export default {
  name: 'Ambient Occlusion',
  ko: '앰비언트 오클루전',
  uniforms: t => ({ uWipe: wipe(t), uA: phase(t) * TAU }),
  frag: `
uniform float uWipe, uA;
float sdBox(vec3 p, vec3 b, float r) { vec3 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r; }
float sdTorus(vec3 p, vec2 t) { vec2 q = vec2(length(p.xz) - t.x, p.y); return length(q) - t.y; }
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) { vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }

float map(vec3 p) {
  float room = min(p.y, min(p.z + 3.0, p.x + 1.9));                    // floor, back wall, left wall
  vec3 n = p - vec3(0.75, 1.15, -3.0);                                   // an arched niche in the back wall
  float niche = max(min(sdBox(n - vec3(0, -0.35, 0), vec3(0.55, 0.8, 0.5), 0.0), length(n.xy - vec2(0, 0.45)) - 0.55), -p.z - 3.45);
  float d = max(room, -niche);
  d = min(d, length(p - vec3(0.75, 0.42, -3.0)) - 0.42);                 // a ball sitting in the niche
  d = min(d, length(p - vec3(-1.15, 0.75, -2.25)) - 0.75);               // a big ball in the corner
  d = min(d, sdBox(p - vec3(0.85, 0.35, -1.25), vec3(0.62, 0.35, 0.62), 0.04)); // a stack of three blocks
  d = min(d, sdBox(p - vec3(0.85, 0.95, -1.25), vec3(0.4, 0.25, 0.4), 0.04));
  d = min(d, sdBox(p - vec3(0.85, 1.4, -1.25), vec3(0.2, 0.2, 0.2), 0.04));
  for (int i = 0; i < 4; i++)                                            // a row of pegs leaning on the left wall
    d = min(d, sdCapsule(p, vec3(-1.9 + 0.38, 0.12, -1.2 + 0.4 * float(i)), vec3(-1.9 + 0.13, 1.25, -1.2 + 0.4 * float(i)), 0.13));
  d = min(d, sdTorus(p - vec3(-0.3, 0.2, 0.55), vec2(0.62, 0.2)));       // a ring lying flat, a ball in its hole
  d = min(d, length(p - vec3(-0.3, 0.42, 0.55)) - 0.42);
  for (int i = 0; i < 3; i++) {                                          // three pebbles huddled together
    float k = float(i) * TAU / 3.0 + 0.4;
    d = min(d, length(p - vec3(1.0 + 0.33 * cos(k), 0.3, 1.25 + 0.33 * sin(k))) - 0.3);
  }
  for (int i = 0; i < 4; i++) {                                          // four slabs standing close, like books
    vec3 q = p - vec3(-1.05 + 0.36 * float(i), 0.55 - 0.08 * float(i), 2.35);
    q.xy = rot(0.06 * float(i)) * q.xy;
    d = min(d, sdBox(q, vec3(0.15, 0.55 - 0.08 * float(i), 0.5), 0.03));
  }
  return d;
}
vec3 normal(vec3 p) {
  vec2 e = vec2(0.0008, 0.0);
  return normalize(vec3(map(p + e.xyy) - map(p - e.xyy), map(p + e.yxy) - map(p - e.yxy), map(p + e.yyx) - map(p - e.yyx)));
}
// how much of the sky the nearby geometry hides: 16 cosine-weighted directions, each marched out to 1.6 units
float ao(vec3 p, vec3 n, float seed) {
  vec3 t1 = normalize(abs(n.y) < 0.9 ? cross(n, vec3(0, 1, 0)) : cross(n, vec3(1, 0, 0))), t2 = cross(n, t1);
  float vis = 0.0;
  for (int i = 0; i < 16; i++) {
    float fi = (float(i) + 0.5) / 16.0;
    float r = sqrt(fi), phi = float(i) * 2.39996 + seed * TAU;
    vec3 d = normalize(t1 * r * cos(phi) + t2 * r * sin(phi) + n * sqrt(1.0 - fi));
    float v = 1.0, t = 0.04;
    for (int j = 0; j < 12; j++) {
      float h = map(p + d * t);
      v = min(v, clamp(h / (0.5 * t), 0.0, 1.0));
      t += clamp(h, 0.03, 0.2);
      if (t > 1.6 || v < 0.01) break;
    }
    vis += v;
  }
  return pow(vis / 16.0, 1.25);
}
vec3 render(vec2 uv, float seed, bool withAO) {
  vec3 ro = vec3(0.5, 7.6, 6.9), ta = vec3(-0.15, 0.35, -0.25);
  vec3 f = normalize(ta - ro), r = normalize(cross(f, vec3(0, 1, 0))), u = cross(r, f);
  vec3 rd = normalize(uv.x * r + uv.y * u + 3.7 * f);
  float t = 0.0;
  for (int i = 0; i < 160; i++) { float h = map(ro + rd * t); if (h < 0.0005 || t > 40.0) break; t += h; }
  vec3 p = ro + rd * t, n = normal(p);
  float occ = withAO ? ao(p + n * 0.002, n, seed) : 1.0;
  vec3 sky = mix(vec3(0.62, 0.60, 0.58), vec3(1.0, 0.98, 0.95), 0.5 + 0.5 * n.y);   // soft light from all round
  vec3 key = normalize(vec3(0.5 + 0.3 * sin(uA), 0.9, 0.55));                      // a faint, slowly swaying key
  vec3 col = vec3(0.93, 0.90, 0.86) * (sky * 0.9 * occ + vec3(1.0, 0.95, 0.88) * 0.22 * max(dot(n, key), 0.0));
  return mix(col, vec3(0.86, 0.84, 0.82), smoothstep(14.0, 30.0, t));
}
void main() {
  float split = uWipe * uRes.x;
  bool right = gl_FragCoord.x > split;
  vec3 col = vec3(0.0);
  float seed = hash12(gl_FragCoord.xy);   // fixed per pixel, so the sampling pattern never changes between frames
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 uv = (2.0 * (gl_FragCoord.xy + vec2(i, j) * 0.5 - 0.25) - uRes) / uRes.x;
    col += render(uv + vec2(0.0, 0.0), fract(seed + 0.25 * float(i + 2 * j)), right);
  }
  col /= 4.0;
  col = mix(col, vec3(1.0), smoothstep(3.0, 0.0, abs(gl_FragCoord.x - split)) * 0.9); // the wipe line
  outColor = vec4(pow(col, vec3(1.0 / 2.2)) + grain(gl_FragCoord.xy) / 255.0, 1.0);
}`,
  overlay(ctx, t, W, H) {
    const x = wipe(t) * W;
    const pill = (text, cx, alpha) => {
      ctx.globalAlpha = alpha;
      ctx.font = `800 30px ${FONT.sans}`;
      const w = ctx.measureText(text).width + 48;
      ctx.fillStyle = 'rgba(30, 28, 34, 0.78)';
      ctx.beginPath(); ctx.roundRect(cx - w / 2, 1720, w, 64, 32); ctx.fill();
      ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, cx, 1753);
      ctx.globalAlpha = 1;
    };
    pill('AO OFF', x - 140, Math.min(1, Math.max(0, (x - 140) / 120)));        // each label rides beside the line
    pill('AO ON', x + 140, Math.min(1, Math.max(0, (W - x - 140) / 120)));
  },
};
