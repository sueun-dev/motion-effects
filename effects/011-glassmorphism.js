// Frosted glass: bright colour blobs drift behind three glass panels. Outside a panel the blobs are crisp; inside,
// the same blobs are evaluated with a wide soft edge (an exact blur for discs), tinted white, with fixed frost grain.
import { FONT } from '../lib/util.js';

// panels in shader units (x -1..1 across, y up, 1 unit = 540 px): centre x, y, half width, half height, radius
const PANELS = [[0, 0.98, 0.80, 0.15, 0.15], [0, 0.10, 0.80, 0.50, 0.10], [0, -0.66, 0.44, 0.12, 0.12]];
const DROP = 0.2; // everything sits this much below the middle of the frame
const px = (x, y) => [540 + x * 540, 960 - (y - DROP) * 540];

export default {
  name: 'Glassmorphism',
  ko: '글래스모피즘',
  frag: `
float box(vec2 q, vec2 b, float r) { vec2 d = abs(q) - b + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }
float glass(vec2 p) {
  float d = 1e3;
  ${PANELS.map(([x, y, w, h, r]) => `d = min(d, box(p - vec2(${x}, ${y}), vec2(${w}, ${h}), ${r}));`).join('\n  ')}
  return d;
}
vec3 scene(vec2 p, float soft) {
  float a = uPhase * TAU;
  vec3 col = mix(vec3(0.06, 0.05, 0.16), vec3(0.15, 0.08, 0.30), gl_FragCoord.y / uRes.y);
  vec2 cs[5] = vec2[5](vec2(-0.55 + 0.45 * cos(a), 0.55 + 0.35 * sin(a)), vec2(0.6 * cos(a + 2.0), -0.1 + 0.6 * sin(2.0 * a)),
                        vec2(0.55 + 0.3 * sin(a), 0.9 + 0.4 * cos(a)), vec2(-0.45 * cos(2.0 * a), -0.9 + 0.3 * sin(a)),
                        vec2(0.7 * sin(a + 4.0), 0.25 * cos(a + 1.0) - 0.2));
  float rs[5] = float[5](0.42, 0.34, 0.30, 0.40, 0.22);
  vec3 ks[5] = vec3[5](vec3(1.0, 0.35, 0.65), vec3(0.25, 0.85, 1.0), vec3(1.0, 0.65, 0.25), vec3(0.55, 0.35, 1.0), vec3(0.3, 1.0, 0.65));
  for (int i = 0; i < 5; i++) {
    vec2 q = p - cs[i];
    float d = length(q) - rs[i];
    vec3 k = ks[i] * (0.8 + 0.35 * dot(q / rs[i], vec2(-0.5, 0.6)));
    col = mix(col, k, 1.0 - smoothstep(-soft, soft, d));
  }
  return col;
}
void main() {
  vec2 p = (2.0 * gl_FragCoord.xy - uRes) / uRes.x + vec2(0.0, ${DROP});
  float d = glass(p), aa = 1.5 / 540.0;
  vec3 col = scene(p, aa);
  col *= 1.0 - 0.45 * (1.0 - smoothstep(-0.02, 0.14, glass(p + vec2(0.0, 0.05))));   // soft shadow under the glass
  vec3 frost = scene(p, 0.2);
  frost = mix(frost, vec3(1.0), 0.16) + grain(gl_FragCoord.xy) * 0.05;
  col = mix(col, frost, 1.0 - smoothstep(-aa, aa, d));
  float rim = 1.0 - smoothstep(0.0, 2.2 / 540.0, abs(d + 1.2 / 540.0));                  // thin bright edge, stronger top-left
  vec2 n = normalize(vec2(dFdx(d), dFdy(d)) + 1e-6);
  col += rim * (0.2 + 0.55 * max(dot(n, vec2(-0.707, 0.707)), 0.0));
  outColor = vec4(col, 1.0);
}`,
  overlay(ctx) {
    ctx.fillStyle = '#FFFFFF'; ctx.textBaseline = 'middle';
    let [x, y] = px(-0.66, 0.98); // notification
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(x + 10, y, 44, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7A4DFF'; ctx.font = `700 44px ${FONT.sans}`; ctx.textAlign = 'center'; ctx.fillText('₩', x + 10, y + 2);
    ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'left';
    ctx.font = `600 38px ${FONT.sans}`; ctx.fillText('Payment received', x + 80, y - 22);
    ctx.font = `400 32px ${FONT.sans}`; ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillText('just now  ·  +240,000', x + 80, y + 24);

    [x, y] = px(-0.68, 0.48); // card
    ctx.fillStyle = '#FFFFFF'; ctx.font = `700 48px ${FONT.display}`; ctx.fillText('GLASS', x, y);
    ctx.font = `500 34px ${FONT.sans}`; ctx.textAlign = 'right'; ctx.fillText('debit', px(0.68, 0)[0], y);
    ctx.textAlign = 'left';
    const chip = ctx.createLinearGradient(x, y + 80, x + 120, y + 170);
    chip.addColorStop(0, '#FFE7A3'); chip.addColorStop(1, '#D9A441');
    ctx.fillStyle = chip; ctx.beginPath(); ctx.roundRect(x, y + 80, 120, 90, 16); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.font = `500 54px ${FONT.mono}`;
    ctx.fillText('4821 0090 7316', x, y + 270);
    ctx.font = `500 32px ${FONT.sans}`; ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('ALEX KIM', x, y + 380); ctx.textAlign = 'right'; ctx.fillText('09 / 29', px(0.68, 0)[0], y + 380);

    [x, y] = px(0, -0.66); // button
    ctx.textAlign = 'center'; ctx.fillStyle = '#FFFFFF'; ctx.font = `600 46px ${FONT.sans}`; ctx.fillText('Pay now', x, y);
  },
};
