// Rolling shutter, slowed down so you can watch it: the same three-blade propeller twice. Top: a global shutter, every
// row of the picture taken at the same instant, so the blades stay straight. Bottom: a rolling shutter, a read-out
// line sweeps down the frame and each row keeps the propeller as it was when the line passed it. The blades turn
// while the line travels, so the rows disagree and the blades bend into curves; above the line is the new picture,
// below it the previous one, with the live propeller drawn faintly so you can see the line sampling it.
import { FONT } from '../lib/util.js';

const TOP1 = 300, TOP2 = 1110, PH = 760; // panel tops and height (px, y down)
const SWEEP = 2.5;                       // seconds for the line to cross the panel (two sweeps per loop)

export default {
  name: 'Rolling Shutter',
  ko: '롤링 셔터',
  frag: `
const float TOP1 = ${TOP1}.0, TOP2 = ${TOP2}.0, PH = ${PH}.0, SWEEP = ${SWEEP};
const float R = 300.0, HUB = 54.0, TURNS = 1.0 / 3.0; // blade length, hub radius, turns per second (5/3 per loop, 5/6 per sweep)

// signed distance (px) to one blade lying along +x: a paddle, widest a third of the way out, with a rounded tip
float blade(vec2 q) {
  float s = clamp(q.x / R, 0.0, 1.0);
  float w = 16.0 + 40.0 * s * pow(1.0 - s, 0.7);
  vec2 d = vec2(abs(q.x - R * 0.5) - R * 0.5 + 14.0, abs(q.y) - w + 14.0); // a rounded box from the hub (x = 0) to the tip
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - 14.0;
}
// the propeller turned by angle a: distance, and how far along the blade (0 hub .. 1 tip)
vec2 prop(vec2 d, float a) {
  float best = 1e5, along = 0.0;
  for (int k = 0; k < 3; k++) {
    vec2 q = rot(a + float(k) * TAU / 3.0) * d; // d in the blade's frame (rot(x) turns a vector by -x)
    float b = blade(q);
    if (b < best) { best = b; along = q.x / R; }
  }
  return vec2(best, along);
}
float angle(float t) { return TAU * TURNS * t; }

vec3 background(vec2 p, float top) {
  vec3 col = mix(vec3(0.075, 0.09, 0.13), vec3(0.05, 0.06, 0.09), (p.y - top) / PH);
  vec2 g = mod(p - vec2(0.0, top), 40.0);
  if (g.x < 2.0 || g.y < 2.0) col += 0.025; // a fixed 40 px grid
  return col;
}
// the propeller shaded over col: cream blades with yellow tips, tint = colour of the blade body
vec3 drawProp(vec3 col, vec2 d, float a, vec3 tint) {
  vec2 pr = prop(d, a);
  float cover = clamp(0.5 - pr.x, 0.0, 1.0);
  vec3 body = tint * (0.82 + 0.18 * clamp(-pr.x / 30.0, 0.0, 1.0));
  vec3 blade = pr.y > 0.84 ? vec3(1.0, 0.72, 0.1) : body;
  col = mix(col, blade, cover);
  float h = length(d) - HUB; // the hub sits on top
  vec3 hub = mix(vec3(0.55, 0.58, 0.64), vec3(0.2, 0.22, 0.26), clamp((d.x + d.y) / (2.0 * HUB) + 0.5, 0.0, 1.0));
  vec2 mark = rot(-a) * vec2(30.0, 0.0);
  hub = mix(hub, vec3(1.0, 0.72, 0.1), clamp(0.5 - (length(d - vec2(mark.x, mark.y)) - 9.0), 0.0, 1.0));
  return mix(col, hub, clamp(0.5 - h, 0.0, 1.0));
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y); // px, y down
  vec3 col = vec3(0.035, 0.04, 0.06);
  vec3 cream = vec3(0.95, 0.92, 0.86);

  // top panel: global shutter, the propeller right now
  if (p.y > TOP1 && p.y < TOP1 + PH) {
    col = background(p, TOP1);
    col = drawProp(col, p - vec2(540.0, TOP1 + PH * 0.5), angle(uTime), cream);
  }

  // bottom panel: rolling shutter
  if (p.y > TOP2 && p.y < TOP2 + PH) {
    col = background(p, TOP2);
    float f = (p.y - TOP2) / PH, line = fract(uTime / SWEEP), k = floor(uTime / SWEEP);
    float tc = (f <= line ? k : k - 1.0) * SWEEP + f * SWEEP; // when the line passed this row
    vec3 tint = mix(vec3(0.62, 0.86, 1.0), vec3(1.0, 0.62, 0.78), f); // capture time, top row to bottom row
    vec2 d = p - vec2(540.0, TOP2 + PH * 0.5);
    col = drawProp(col, d, angle(tc), tint);
    if (f > line) { // not read yet: the live propeller as a faint outline
      float sd = prop(d, angle(uTime)).x;
      col = mix(col, vec3(0.75, 0.9, 1.0), 0.45 * clamp(1.6 - abs(sd + 1.5), 0.0, 1.0));
    }
    float y = TOP2 + line * PH, fade = smoothstep(0.0, 0.05, line) * smoothstep(1.0, 0.95, line);
    float glow = exp(-pow((p.y - y) / 7.0, 2.0)) * 0.55 + clamp(1.5 - abs(p.y - y), 0.0, 1.0) * 0.6;
    col += vec3(1.0, 0.3, 0.42) * glow * fade;
  }
  outColor = vec4(col, 1.0);
}`,
  overlay(ctx, t, W, H) {
    const line = (t / SWEEP) % 1;
    const head = (top, title, ko, sub, color) => {
      ctx.textAlign = 'left';
      ctx.fillStyle = color; ctx.font = `800 36px ${FONT.sans}`; ctx.fillText(title, 44, top + 56);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; ctx.font = `500 26px ${FONT.ko}`; ctx.fillText(ko, 44, top + 94);
      ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'; ctx.font = `500 24px ${FONT.mono}`;
      ctx.fillText(sub, W - 44, top + 56);
    };
    head(TOP1, 'GLOBAL SHUTTER', '글로벌 셔터', 'all rows at once', '#F2EBDD');
    head(TOP2, 'ROLLING SHUTTER', '롤링 셔터', 'one row at a time', '#FF7A93');
    // the capture-time scale on the left of the rolling panel: filled down to the line
    const x = 44, y0 = TOP2 + 130, h = PH - 180;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'; ctx.fillRect(x, y0, 10, h);
    const g = ctx.createLinearGradient(0, TOP2, 0, TOP2 + PH);
    g.addColorStop(0, '#9EDBFF'); g.addColorStop(1, '#FF9EC7');
    ctx.fillStyle = g; ctx.fillRect(x, y0, 10, Math.max(0, Math.min(h, TOP2 + line * PH - y0)));
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'; ctx.font = `500 22px ${FONT.mono}`; ctx.textAlign = 'left';
    ctx.fillText('earlier', x + 20, y0 + 20); ctx.fillText('later', x + 20, y0 + h);
  },
};
