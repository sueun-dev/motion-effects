// Holographic foil card: a ray hits a tilting plane; thin-film colour comes from the viewing angle and the card
// position, a glitter mosaic catches the light per cell, and a glare band sweeps as the card tilts. Art from tex().
import { FONT, TAU } from '../lib/util.js';

const CW = 1080, CH = 1508; // the card face is drawn into the top of the tex canvas at this size

export default {
  name: 'Holographic',
  ko: '홀로그래픽',
  tex(ctx, t, W, H) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = '#0f0'; ctx.lineWidth = 16; // green = embossed foil lines
    ctx.beginPath(); ctx.roundRect(46, 46, CW - 92, CH - 92, 40); ctx.stroke();
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(CW / 2, CH * 0.5, 300, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#0f0'; // eight-point star emblem
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const r = i % 2 ? 110 : 260, a = i / 16 * TAU - Math.PI / 2;
      ctx.lineTo(CW / 2 + r * Math.cos(a), CH * 0.5 + r * Math.sin(a));
    }
    ctx.fill();
    ctx.fillStyle = '#f00'; // red = dark printed ink
    ctx.textAlign = 'center';
    ctx.font = `700 150px ${FONT.display}`; ctx.fillText('HOLO', CW / 2, 270);
    ctx.font = `600 54px ${FONT.display}`; ctx.fillText('LIMITED  EDITION', CW / 2, CH - 230);
    ctx.font = `500 44px ${FONT.mono}`; ctx.fillText('No. 002 / 100', CW / 2, CH - 150);
    ctx.beginPath(); ctx.arc(CW / 2, CH * 0.5, 70, 0, TAU); ctx.fill();
  },
  frag: `
const vec2 HALF = vec2(0.9, 1.257);
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1, 0, 0, 0, c, s, 0, -s, c); }
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0, -s, 0, 1, 0, s, 0, c); }
float box(vec2 q, vec2 b, float r) { vec2 d = abs(q) - b + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }
vec3 film(float h) { return pal(h, vec3(0.6), vec3(0.4), vec3(1.0), vec3(0.0, 0.33, 0.67)); }
void main() {
  vec2 p = (2.0 * gl_FragCoord.xy - uRes) / uRes.x;
  p.y += 0.07;                                   // card centre a little below the middle
  float a = uPhase * TAU;
  float rx = 0.30 * cos(a), ry = 0.42 * sin(a);  // the card tilts round in a circle
  mat3 R = rotY(ry) * rotX(rx);
  vec3 ro = vec3(0, 0, 5), rd = normalize(vec3(p, -4.0));
  vec3 n = R * vec3(0, 0, 1);
  vec3 q = transpose(R) * (ro + rd * (-dot(ro, n) / dot(rd, n)));
  vec2 uv = q.xy;

  // background: deep violet with a glow tinted by the card's current colour
  float h0 = 0.45 * ry + 0.3 * rx;
  vec3 bg = mix(vec3(0.05, 0.04, 0.12), vec3(0.16, 0.08, 0.26), gl_FragCoord.y / uRes.y);
  bg += film(h0 + 0.2) * 0.22 * exp(-dot(p, p) * 0.9);
  float sh = box(p - vec2(0.06, -0.10), vec2(0.70, 0.98), 0.08);
  bg *= 1.0 - 0.55 * (1.0 - smoothstep(-0.05, 0.22, sh));

  float d = box(uv, HALF, 0.09);
  vec4 art = texture(uTex, vec2(uv.x / HALF.x * 0.5 + 0.5, 1.0 - (0.5 - uv.y / HALF.y * 0.5) * ${CH / 1920}));
  vec3 v = -rd;
  float nv = dot(n, v);
  float wob = 0.12 * snoise(vec3(uv * 1.6, 3.0));             // fixed swirl printed in the foil
  float h = 1.6 * (1.0 - nv) + 0.35 * uv.x + 0.25 * uv.y + wob + 1.2 * ry - 0.8 * rx;
  vec3 col = film(h);

  // glitter mosaic: each cell has its own tiny tilt and lights up when it faces the light
  vec2 cell = floor(uv * 26.0);
  vec2 jit = hash22(cell) - 0.5;
  vec3 cn = normalize(n + R * vec3(jit * 0.35, 0.0));
  vec3 L = normalize(vec3(-0.4, 0.6, 1.0));
  float glit = pow(max(dot(reflect(-L, cn), v), 0.0), 60.0);
  vec2 f = fract(uv * 26.0) - 0.5;
  glit *= 1.0 - smoothstep(0.3, 0.5, max(abs(f.x), abs(f.y)));
  col += film(h + hash12(cell)) * glit * 0.9;

  col = mix(col, film(h + 0.5) * 1.15 + 0.1, art.g);           // embossed foil lines shift the colour
  col = mix(col, vec3(0.07, 0.06, 0.16) + film(h) * 0.12, art.r * 0.9); // printed ink
  float glare = exp(-pow((uv.x + uv.y * 0.6) - (2.4 * ry - 1.6 * rx), 2.0) * 3.0);
  col += glare * 0.35;
  col += 0.25 * smoothstep(-0.02, 0.0, d);                     // bright cut edge

  float aa = fwidth(d);
  outColor = vec4(mix(col, bg, smoothstep(-aa, aa, d)), 1.0);
}`,
};
