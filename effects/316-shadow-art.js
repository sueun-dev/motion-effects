// Shadow art: one carved block hangs in a room corner between three lights, and casts a G on the left wall, an E on
// the back wall and a B on the floor (after the cover of Hofstadter's Goedel, Escher, Bach). The block is the
// intersection of three letters pushed straight through a cube, one along each axis, so its shadow along each axis
// is that letter. It is raymarched as max(box, G(y, z), E(x, y), B(x, z)), each letter a 2D signed distance field
// built once from a canvas (16-bit); the walls find their shadows by marching toward their light through the block. Then the
// block lifts and turns once on a tilted axis, the shadows melt into blobs, and the letters lock back in place.
import { TAU, FONT, ease, span } from '../lib/util.js';

const N = 256;                                             // distance-field resolution per letter
const T0 = 2.75, T1 = 5.3;                                  // the turn, ending just after the loop point
// 0..1 through the turn (1 = 0: square to the lights again); the turn runs across the loop point
const turn = t => (span(t, T0, T1) > 0 ? ease.inOut(span(t, T0, T1)) : ease.inOut(span(t, T0 - 5, T1 - 5)));
let field = null;                                          // the three distance fields packed in R, G, B (built once)

// signed distance (in pixels) to the inside of an S x S mask, by the exact Euclidean distance transform (Felzenszwalb)
function edt(inside, S) {
  const INF = 1e12, f = new Float64Array(S), d = new Float64Array(S), v = new Int32Array(S), z = new Float64Array(S + 1);
  const pass1d = () => {
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < S; q++) {
      let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < S; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) ** 2 + f[v[k]]; }
  };
  const dist = target => {                                 // squared distance from every pixel to the nearest target pixel
    const g = new Float64Array(S * S);
    for (let x = 0; x < S; x++) {
      for (let y = 0; y < S; y++) f[y] = target(x + y * S) ? 0 : INF;
      pass1d();
      for (let y = 0; y < S; y++) g[x + y * S] = d[y];
    }
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) f[x] = g[x + y * S];
      pass1d();
      for (let x = 0; x < S; x++) g[x + y * S] = d[x];
    }
    return g;
  };
  const toIn = dist(i => inside[i]), toOut = dist(i => !inside[i]);
  return Float32Array.from({ length: S * S }, (_, i) => Math.sqrt(toIn[i]) - Math.sqrt(toOut[i]));
}

// a letter stretched to fill 86 % of the square both ways, as an S x S inside/outside mask. Filling the square both
// ways is what lets the three letters support each other: every shadow pixel then has some depth where the other two
// letters are solid too, so each shadow is the whole letter
function letter(ch, S) {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
  g.font = `900 ${S}px ${FONT.black}`;
  const m = g.measureText(ch), w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight, h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  g.translate(S * 0.07, S * 0.07); g.scale(S * 0.86 / w, S * 0.86 / h);
  g.fillStyle = '#FFF'; g.textBaseline = 'alphabetic';
  g.fillText(ch, m.actualBoundingBoxLeft, m.actualBoundingBoxAscent);
  const px = g.getImageData(0, 0, S, S).data;
  return Uint8Array.from({ length: S * S }, (_, i) => (px[i * 4] > 127 ? 1 : 0));
}

// the field at N x N: the distance transform of a 4x finer mask, averaged over 4 x 4 blocks, so the letter outline is
// smooth instead of following the pixel staircase (which would show as stripes on the block and nicks in the shadows)
function smoothField(ch) {
  const S = 4 * N, fine = edt(letter(ch, S), S), out = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let sum = 0;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) sum += fine[(4 * x + i) + (4 * y + j) * S];
    out[x + y * N] = sum / 16 / 4;                         // in N-pixel units
  }
  return out;
}

function build() {
  // left wall: canvas x runs along -z, canvas y down; back wall: canvas x along +x; floor: canvas x along +x and
  // canvas y along +z, so the B stands with its top toward the back wall
  const sd = ['G', 'E', 'B'].map(smoothField);
  // 16-bit distances (+-16 px in 1/2048 px steps): high bytes in the left square, low bytes in the square beside it
  field = new ImageData(2 * N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = x + y * N, hi = (x + y * 2 * N) * 4, lo = hi + N * 4;
    for (let c = 0; c < 3; c++) {
      const v = Math.max(0, Math.min(65535, Math.round((128 + sd[c][i] * 8) * 256)));
      field.data[hi + c] = v >> 8; field.data[lo + c] = v & 255;
    }
    field.data[hi + 3] = field.data[lo + 3] = 255;
  }
}

export default {
  name: 'Shadow Art',
  ko: '그림자 아트',
  tex(ctx) {
    if (!field) build();
    ctx.putImageData(field, 0, 0);                         // the fields sit in the top-left 512 x 256 of uTex
  },
  uniforms(t) {
    const k = turn(t), a = TAU * k, ax = [0.42, 1, 0.3], n = Math.hypot(...ax);
    const s = Math.sin(a / 2);
    return { uQ: [ax[0] / n * s, ax[1] / n * s, ax[2] / n * s, Math.cos(a / 2)], uLift: 0.35 * Math.sin(Math.PI * k) };
  },
  frag: `
uniform vec4 uQ; uniform float uLift;
const float HB = 0.7;
const vec3 LX = vec3(1.0, 0.0, 0.0), LY = vec3(0.0, 1.0, 0.0), LZ = vec3(0.0, 0.0, 1.0);   // toward each light
const vec3 CX = vec3(1.0, 0.58, 0.24), CY = vec3(0.98, 0.36, 0.56), CZ = vec3(0.22, 0.74, 0.86); // their colours
vec3 C() { return vec3(2.35, 2.35 + uLift, 2.35); }
vec3 qrot(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
vec3 toLocal(vec3 v) { return qrot(vec4(-uQ.xyz, uQ.w), v); }
float letterSD(vec2 ab, int i) {                           // world-unit signed distance from one letter field
  vec2 uv = clamp(ab / (2.0 * HB) + 0.5, 0.5 / ${N}.0, 1.0 - 0.5 / ${N}.0);
  vec2 tc = vec2(uv.x * ${N}.0 / uRes.x, 1.0 - (1.0 - uv.y) * ${N}.0 / uRes.y);
  vec3 h = texture(uTex, tc).rgb, l = texture(uTex, tc + vec2(${N}.0 / uRes.x, 0.0)).rgb;
  float e = (i == 0 ? h.r * 256.0 + l.r : i == 1 ? h.g * 256.0 + l.g : h.b * 256.0 + l.b) * 255.0 / 256.0;
  return (e - 128.0) / 8.0 * (2.0 * HB / ${N}.0);
}
float sdBlock(vec3 p) {                                    // p in block coordinates
  vec3 q = abs(p) - HB;
  float box = length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
  float g = letterSD(vec2(-p.z, p.y), 0), e = letterSD(vec2(p.x, p.y), 1), b = letterSD(vec2(p.x, -p.z), 2);
  return max(box, max(g, max(e, b)));
}
vec2 boxHit(vec3 ro, vec3 rd) {                            // entry and exit of the bounding cube (block coordinates)
  vec3 inv = 1.0 / rd, t0 = (-vec3(HB + 0.02) - ro) * inv, t1 = (vec3(HB + 0.02) - ro) * inv;
  vec3 tn = min(t0, t1), tf = max(t0, t1);
  return vec2(max(max(tn.x, tn.y), tn.z), min(min(tf.x, tf.y), tf.z));
}
vec3 blockNormal(vec3 p) {                                 // the normal of whichever surface is outermost here
  vec3 q = abs(p) - HB;
  float box = max(q.x, max(q.y, q.z));
  vec2 ag = vec2(-p.z, p.y), ae = p.xy, ab = vec2(p.x, -p.z);
  float g = letterSD(ag, 0), e = letterSD(ae, 1), b = letterSD(ab, 2), m = max(box, max(g, max(e, b)));
  vec2 k = vec2(0.03, 0.0);
  if (m == g) { vec2 d = vec2(letterSD(ag + k, 0) - letterSD(ag - k, 0), letterSD(ag + k.yx, 0) - letterSD(ag - k.yx, 0)); return normalize(vec3(0.0, d.y, -d.x)); }
  if (m == e) { vec2 d = vec2(letterSD(ae + k, 1) - letterSD(ae - k, 1), letterSD(ae + k.yx, 1) - letterSD(ae - k.yx, 1)); return normalize(vec3(d.x, d.y, 0.0)); }
  if (m == b) { vec2 d = vec2(letterSD(ab + k, 2) - letterSD(ab - k, 2), letterSD(ab + k.yx, 2) - letterSD(ab - k.yx, 2)); return normalize(vec3(d.x, 0.0, -d.y)); }
  return q.x == box ? vec3(sign(p.x), 0, 0) : q.y == box ? vec3(0, sign(p.y), 0) : vec3(0, 0, sign(p.z));
}
// shadow of the block from world point p toward light L: walk through the block in even steps, keep the closest
// approach, and turn it into an edge 0.02 wide, so the letters stay crisp and never jagged
float shade(vec3 p, vec3 L) {
  vec3 ro = toLocal(p - C()), rd = toLocal(L);
  vec2 h = boxHit(ro, rd);
  if (h.y < max(h.x, 0.0)) return 1.0;
  float t0 = max(h.x, 0.0) + 0.004, dt = (h.y - t0) / 90.0, m = 1.0;
  for (int i = 0; i <= 90; i++) m = min(m, sdBlock(ro + rd * (t0 + dt * float(i))));
  return smoothstep(-0.006, 0.016, m);
}
vec3 render(vec2 uv) {
  vec3 ro = vec3(7.4, 5.3, 7.4), ta = vec3(1.5, 1.62, 1.5);
  vec3 fw = normalize(ta - ro), rt = normalize(cross(fw, vec3(0, 1, 0))), up = cross(rt, fw);
  vec3 rd = normalize(fw * 3.6 + rt * uv.x + up * uv.y);
  vec3 col = mix(vec3(0.05, 0.05, 0.09), vec3(0.12, 0.10, 0.17), uv.y * 0.5 + 0.5);
  float tw = 1e9; vec3 n = vec3(0); int wall = -1;          // the corner: left wall x = 0, back wall z = 0, floor y = 0
  if (rd.x < 0.0) { float s = -ro.x / rd.x; vec3 p = ro + rd * s; if (p.y > 0.0 && p.y < 7.0 && p.z > 0.0 && p.z < 7.5 && s < tw) { tw = s; n = LX; wall = 0; } }
  if (rd.z < 0.0) { float s = -ro.z / rd.z; vec3 p = ro + rd * s; if (p.y > 0.0 && p.y < 7.0 && p.x > 0.0 && p.x < 7.5 && s < tw) { tw = s; n = LZ; wall = 1; } }
  if (rd.y < 0.0) { float s = -ro.y / rd.y; vec3 p = ro + rd * s; if (p.x > 0.0 && p.z > 0.0 && p.x < 7.5 && p.z < 7.5 && s < tw) { tw = s; n = LY; wall = 2; } }
  // the block
  vec3 bo = toLocal(ro - C()), bd = toLocal(rd);
  vec2 h = boxHit(bo, bd);
  float tb = 1e9;
  if (h.y > max(h.x, 0.0)) {
    float t = max(h.x, 0.0);
    for (int i = 0; i < 110; i++) {
      float d = sdBlock(bo + bd * t);
      if (d < 0.0015) { tb = t; break; }
      t += max(d, 0.003);
      if (t > h.y) break;
    }
  }
  if (tb < tw) {
    vec3 p = bo + bd * tb;
    vec3 nw = qrot(uQ, blockNormal(p)), pw = ro + rd * tb;
    vec3 lit = vec3(0.16, 0.15, 0.2);
    lit += CX * max(dot(nw, LX), 0.0) * shade(pw + nw * 0.03, LX);
    lit += CY * max(dot(nw, LY), 0.0) * shade(pw + nw * 0.03, LY);
    lit += CZ * max(dot(nw, LZ), 0.0) * shade(pw + nw * 0.03, LZ);
    return vec3(0.93, 0.91, 0.88) * lit;
  }
  if (wall >= 0) {
    vec3 p = ro + rd * tw;
    vec3 L = wall == 0 ? LX : wall == 1 ? LZ : LY, LC = wall == 0 ? CX : wall == 1 ? CZ : CY;
    float s = shade(p + n * 0.002, L);
    float edge = wall == 0 ? min(p.y, p.z) : wall == 1 ? min(p.x, p.y) : min(p.x, p.z);
    float ao = 1.0 - 0.35 * exp(-edge / 0.5);
    vec3 c = vec3(0.92) * (vec3(0.13, 0.12, 0.16) + LC * 0.95 * s) * ao;
    float fade = smoothstep(9.0, 5.0, length(p.xz) + p.y * 0.6);   // the room fades into the dark far from the corner
    return mix(col, c, fade);
  }
  return col;
}
void main() {
  vec3 c = vec3(0.0);
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 f = gl_FragCoord.xy + (vec2(i, j) - 0.5) * 0.5;
    c += render((2.0 * f - uRes) / uRes.x);
  }
  c /= 4.0;
  outColor = vec4(pow(c, vec3(0.4545)), 1.0);
}`,
  // two pills: the three letters while the block is square to the lights, the one block while it turns
  overlay(ctx, t, W, H) {
    const k = turn(t), on = Math.sin(Math.PI * k) ** 0.5;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    [['THREE SHADOWS · 그림자 셋', 1 - on, '#FFC07A', 300], ['ONE BLOCK · 블록 하나', on, '#8FE6F2', 790]].forEach(([txt, a, col, x]) => {
      ctx.fillStyle = `rgba(12, 10, 20, ${0.6 + 0.25 * a})`;
      ctx.beginPath(); ctx.roundRect(x - 240, 1726, 480, 80, 40); ctx.fill();
      ctx.globalAlpha = 0.3 + 0.7 * a;
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = col; ctx.font = `700 32px ${FONT.sans}`; ctx.fillText(txt, x, 1767);
      ctx.globalAlpha = 1;
    });
  },
};
