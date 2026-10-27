// Gray-Scott reaction-diffusion on a 180 x 320 grid, stepped 36 times per frame from a fixed seed (frames are drawn
// in order). The grid goes to the shader in a corner of the texture; a cubic B-spline upsample + threshold makes smooth
// coral edges. In the last second the colony recedes to the middle and melts into frame 0's field, so the loop closes.
import { rng, smoothstep } from '../lib/util.js';

const GW = 180, GH = 320, N = GW * GH, F = 0.042, K = 0.059, STEPS = 36, PRE = 400, MORPH = 30;
let A, B, A2, B2, first, img, frame;

function init() {
  A = new Float32Array(N).fill(1); B = new Float32Array(N); A2 = new Float32Array(N); B2 = new Float32Array(N);
  const r = rng(60);
  for (let s = 0; s < 14; s++) {               // a loose cluster of seed dots around the middle
    const cx = GW / 2 + (r() - 0.5) * 30, cy = GH / 2 + (r() - 0.5) * 40, rad = 2 + r() * 2;
    for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
      const i = Math.round(cy + y) * GW + Math.round(cx + x);
      if (x * x + y * y <= rad * rad) { A[i] = 0.5; B[i] = 0.25; }   // Pearson's seed values (B = 1 can blow up)
    }
  }
  for (let s = 0; s < PRE; s++) step();
  frame = 0;
}

function step() {
  for (let y = 0; y < GH; y++) {
    const yu = (y > 0 ? y - 1 : y) * GW, yd = (y < GH - 1 ? y + 1 : y) * GW, yc = y * GW;
    for (let x = 0; x < GW; x++) {
      const xl = x > 0 ? x - 1 : x, xr = x < GW - 1 ? x + 1 : x, i = yc + x, a = A[i], b = B[i];
      const la = 0.2 * (A[yc + xl] + A[yc + xr] + A[yu + x] + A[yd + x]) + 0.05 * (A[yu + xl] + A[yu + xr] + A[yd + xl] + A[yd + xr]) - a;
      const lb = 0.2 * (B[yc + xl] + B[yc + xr] + B[yu + x] + B[yd + x]) + 0.05 * (B[yu + xl] + B[yu + xr] + B[yd + xl] + B[yd + xr]) - b;
      const ab2 = a * b * b;
      A2[i] = a + la - ab2 + F * (1 - a);
      B2[i] = b + 0.5 * lb + ab2 - (K + F) * b;
    }
  }
  [A, A2, B, B2] = [A2, A, B2, B];
}

export default {
  name: 'Reaction-Diffusion',
  ko: '반응 확산',
  tex(ctx, t) {
    if (t === 0 || !A) init();
    else for (let s = 0; s < STEPS; s++) step();
    if (frame === 0) first = B.slice();
    const w = smoothstep(150 - MORPH, 150, frame); // 0 .. 1 over the last second
    const R = 190 - 150 * w, melt = smoothstep(0.55, 1, w);   // edge recedes (cells from the middle), then melts
    img ||= ctx.createImageData(GW, GH);
    for (let i = 0; i < N; i++) {
      const r = Math.hypot(i % GW - GW / 2, Math.floor(i / GW) - GH / 2);
      const v = B[i] * smoothstep(R + 5, R - 5, r) * (1 - melt) + first[i] * melt;
      img.data[i * 4] = Math.min(255, v * 600); img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    frame++;
  },
  frag: `
const int GW = 180, GH = 320;
float cell(ivec2 g) {
  g = clamp(g, ivec2(0), ivec2(GW - 1, GH - 1));
  return texelFetch(uTex, ivec2(g.x, int(uRes.y) - 1 - g.y), 0).r;  // the grid sits at the canvas top-left
}
vec4 bspline(float t) {
  float t2 = t * t, t3 = t2 * t, s = 1.0 - t;
  return vec4(s * s * s, 3.0 * t3 - 6.0 * t2 + 4.0, -3.0 * t3 + 3.0 * t2 + 3.0 * t + 1.0, t3) / 6.0;
}
float field(vec2 q) {   // q in grid cells, smooth cubic upsample
  vec2 i = floor(q - 0.5), f = q - 0.5 - i;
  vec4 wx = bspline(f.x), wy = bspline(f.y);
  float s = 0.0;
  for (int y = 0; y < 4; y++) for (int x = 0; x < 4; x++) s += wx[x] * wy[y] * cell(ivec2(i) + ivec2(x - 1, y - 1));
  return s;
}
void main() {
  vec2 q = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes.x * float(GW);
  float v = field(q);
  float e = 0.6;
  vec2 g = vec2(field(q + vec2(e, 0)) - field(q - vec2(e, 0)), field(q + vec2(0, e)) - field(q - vec2(0, e)));
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 bg = mix(vec3(0.03, 0.08, 0.14), vec3(0.06, 0.16, 0.22), uv.y);
  vec3 coral = mix(vec3(1.0, 0.42, 0.38), vec3(1.0, 0.72, 0.42), uv.y);
  coral = mix(coral, vec3(0.95, 0.35, 0.6), smoothstep(0.3, 0.9, length(uv - vec2(0.5, 0.5)) * 1.6));
  float aa = fwidth(v) + 0.004;
  float m = smoothstep(0.37 - aa, 0.37 + aa, v);
  float light = clamp(0.75 + 2.2 * dot(g, vec2(-0.6, -0.8)), 0.4, 1.3);   // emboss from the field slope
  vec3 col = mix(bg + coral * 0.12 * smoothstep(0.1, 0.34, v), coral * light, m);
  col += vec3(1.0, 0.9, 0.8) * 0.25 * pow(smoothstep(0.42, 0.9, v), 2.0);
  outColor = vec4(col, 1.0);
}`,
};
