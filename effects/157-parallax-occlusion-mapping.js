// Parallax occlusion mapping: a brick floor that is one flat plane. On the right of the moving divider each view ray,
// after it hits the plane, keeps marching down through the brick height field (48 to 96 layers, then a linear
// refinement) until it meets the surface, so bricks hide the mortar behind them and the relief shifts with the camera;
// a second march towards the torch gives self-shadows. On the left the same normals and colours are read straight at
// the plane (plain normal mapping), which lights the bumps but stays flat. The camera drifts a little, the torch circles
// low over the floor and the divider sweeps across, so the same bricks are seen both ways. 2x2 samples.
import { FONT } from '../lib/util.js';

const split = t => 0.5 + 0.15 * Math.sin(t / 5 * Math.PI * 2 + 0.6); // the divider, as a share of the width

export default {
  name: 'Parallax Occlusion Mapping',
  ko: '시차 차폐 매핑',
  uniforms: t => {
    const a = t / 5 * Math.PI * 2;
    return {
      uCam: [0.06 * Math.sin(a), 1.35 + 0.02 * Math.sin(2 * a), -0.06 * Math.cos(a)], uYaw: [0.025 * Math.sin(a)],
      uTorch: [0.75 * Math.cos(a), 0.95, -1.35 + 0.45 * Math.sin(a)], uSplit: [split(t)],
    };
  },
  frag: `
uniform vec3 uCam, uTorch; uniform float uYaw, uSplit;
const float D = 0.085;                       // how deep the mortar lies below the plane
const vec2 BRICK = vec2(0.42, 0.2);
// running-bond bricks: x = height 0..1 (1 = the plane), yz = brick id
vec3 bricks(vec2 p) {
  float row = floor(p.y / BRICK.y);
  vec2 q = vec2(p.x + 0.5 * BRICK.x * mod(row, 2.0), p.y);
  vec2 id = floor(q / BRICK), f = q - id * BRICK;
  float e = min(min(f.x, BRICK.x - f.x), min(f.y, BRICK.y - f.y));           // distance to the brick's edge
  float r = hash12(id + 7.0);
  float top = 0.86 + 0.1 * r + 0.06 * (f.x / BRICK.x - 0.5) * (hash12(id + 3.0) - 0.5) * 2.0;
  float body = sqrt(smoothstep(0.011, 0.04, e));                            // rounded edges
  float pits = 0.06 * vnoise(p * 14.0 + r * 9.0);
  return vec3(mix(0.08 + 0.04 * vnoise(p * 12.0), top - pits, body), id);
}
float H(vec2 p) { return bricks(p).x; }
vec3 albedo(vec2 p) {
  vec3 b = bricks(p);
  float r = hash12(b.yz), body = step(0.2, b.x);
  vec3 brick = mix(vec3(0.42, 0.13, 0.08), vec3(0.62, 0.28, 0.14), r);
  brick = mix(brick, vec3(0.3, 0.2, 0.16), step(0.82, hash12(b.yz + 11.0)) * 0.6);   // a few darker bricks
  brick *= 0.85 + 0.25 * vnoise(p * 9.0 + r * 5.0);
  return mix(vec3(0.5, 0.47, 0.42), brick, body);
}
vec3 normalAt(vec2 p) {
  vec2 e = vec2(0.0015, 0.0);
  return normalize(vec3(-(H(p + e.xy) - H(p - e.xy)) / (2.0 * e.x) * D, 1.0, -(H(p + e.yx) - H(p - e.yx)) / (2.0 * e.x) * D));
}
vec3 shade(vec2 uv, float y, vec3 lp, vec3 rd, float sh) {
  vec3 p = vec3(uv.x, y, uv.y), n = normalAt(uv), l = lp - p;
  float d = length(l); l /= d;
  float dif = max(dot(n, l), 0.0) * sh, att = 1.0 / (1.0 + 0.55 * d * d);
  float spe = pow(max(dot(reflect(-l, n), -rd), 0.0), 18.0) * 0.25 * sh;
  vec3 c = albedo(uv);
  return c * (vec3(1.0, 0.72, 0.45) * 3.2 * dif * att + vec3(0.05, 0.06, 0.09)) + vec3(1.0, 0.8, 0.6) * spe * att;
}
vec3 render(vec2 uv, float side) {
  vec3 ro = uCam;
  vec3 fw = normalize(vec3(sin(uYaw), -1.0, -cos(uYaw))), rt = normalize(cross(fw, vec3(0, 1, 0))), up = cross(rt, fw);
  vec3 rd = normalize(fw + 0.45 * (uv.x * rt + uv.y * up));
  vec3 lp = uTorch;                                                               // a torch circling low over the floor
  if (rd.y > -0.02) return vec3(0.0);
  vec3 p0 = ro + rd * (-ro.y / rd.y);                                            // where the ray meets the plane
  float fade = exp(-0.3 * length(p0 - ro));
  if (side < 0.5) return shade(p0.xz, 0.0, lp, rd, 1.0) * fade;                   // plain normal mapping
  // parallax occlusion: march down the layers until the ray is below the height field
  float n = mix(96.0, 48.0, clamp(-rd.y, 0.0, 1.0)), step1 = 1.0 / n;
  vec3 dp = rd * (D / -rd.y) * step1;                                            // one layer deeper
  vec3 p = p0, prev = p0;
  float depth = 0.0, prevGap = 1.0 - H(p0.xz);
  for (int i = 0; i < 96; i++) {
    float gap = (1.0 - H(p.xz)) - depth;                                          // > 0: still above the surface
    if (gap <= 0.0 || float(i) >= n) {
      float k = prevGap / (prevGap - gap);                                         // refine between the last two layers
      p = mix(prev, p, clamp(k, 0.0, 1.0));
      break;
    }
    prev = p; prevGap = gap;
    p += dp; depth += step1;
  }
  // self-shadow: march from the hit towards the torch, through the same height field
  vec3 l = normalize(lp - p);
  float sh = 1.0;
  for (int i = 1; i <= 36; i++) {
    float s = float(i) * 0.004;
    vec3 q = p + l * s;
    float clear = q.y - (H(q.xz) - 1.0) * D;                                       // height above the bricks there
    sh = min(sh, clamp(0.5 + 6.0 * clear / s, 0.0, 1.0));                          // soft: near misses darken a little
    if (q.y > 0.0) break;
  }
  return shade(p.xz, p.y, lp, rd, 0.3 + 0.7 * sh) * fade;
}
void main() {
  float split = uSplit * uRes.x;
  float side = step(split, gl_FragCoord.x);
  vec3 col = vec3(0.0);
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 uv = (2.0 * (gl_FragCoord.xy + vec2(i, j) * 0.5 - 0.25) - uRes) / uRes.x;
    col += render(uv, side);
  }
  col /= 4.0;
  col = col * (2.51 * col + 0.03) / (col * (2.43 * col + 0.59) + 0.14);
  col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));
  col = mix(col, vec3(1.0, 0.93, 0.8), 0.85 * exp(-pow((gl_FragCoord.x - split) / 2.2, 2.0)));   // the divider
  outColor = vec4(col + grain(gl_FragCoord.xy) / 255.0, 1.0);
}`,
  // a label on each side, riding along with the divider
  overlay(ctx, t, W, H) {
    const x = split(t) * W;
    ctx.font = `600 30px ${FONT.sans}`;
    ctx.fillStyle = 'rgba(255, 244, 225, 0.92)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)'; ctx.shadowBlur = 10;
    ctx.textAlign = 'right'; ctx.fillText('normal map', x - 28, H - 110);
    ctx.textAlign = 'left'; ctx.fillText('parallax occlusion', x + 28, H - 110);
  },
};
