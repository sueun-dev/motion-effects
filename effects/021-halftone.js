// Halftone: the picture is printed only as a fixed 45-degree screen of dots; each dot's area follows the darkness
// at its cell centre, so as the picture moves under the screen the dots grow and shrink.
import { TAU, phase } from '../lib/util.js';

const BALLS = [['#FFE1D6', '#FF5A5F', '#7A0F2E'], ['#D9F0FF', '#2F8CFF', '#0B2466'], ['#FFF6C9', '#FFC21A', '#8A4B00']];

export default {
  name: 'Halftone',
  ko: '하프톤',
  tex(ctx, t, W, H) { // the picture: three shaded balls circling on a light floor
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#8C7FA8'); bg.addColorStop(0.3, '#F4EADB'); bg.addColorStop(0.75, '#E8D6BF'); bg.addColorStop(1, '#9A7E6E');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const a = phase(t) * TAU;
    const balls = BALLS.map((c, k) => {
      const u = a + k * TAU / 3, depth = 0.5 + 0.5 * Math.sin(u);  // 0 far .. 1 near
      return { c, x: W / 2 + 270 * Math.cos(u), y: 940 + 330 * depth, r: 150 + 100 * depth, hop: Math.abs(Math.sin(2 * u + k)) * 120 };
    }).sort((p, q) => p.y - q.y);
    for (const b of balls) { // soft floor shadows first
      const g = ctx.createRadialGradient(b.x, b.y + b.r, 0, b.x, b.y + b.r, b.r * 1.3);
      g.addColorStop(0, 'rgba(40, 20, 30, 0.55)'); g.addColorStop(1, 'rgba(40, 20, 30, 0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(b.x, b.y + b.r, b.r * 1.3, b.r * 0.35, 0, 0, TAU); ctx.fill();
    }
    for (const b of balls) {
      const y = b.y - b.hop, g = ctx.createRadialGradient(b.x - b.r * 0.4, y - b.r * 0.45, b.r * 0.05, b.x, y, b.r);
      g.addColorStop(0, b.c[0]); g.addColorStop(0.45, b.c[1]); g.addColorStop(1, b.c[2]);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(b.x, y, b.r, 0, TAU); ctx.fill();
    }
  },
  frag: `
const float CELL = 30.0;
void main() {
  vec2 px = gl_FragCoord.xy;
  mat2 R = rot(0.7854);                       // the dot screen sits at 45 degrees, fixed on the page
  vec2 q = R * px;
  vec2 cell = (floor(q / CELL) + 0.5) * CELL;
  vec3 c = vec3(0.0);                          // the picture averaged over the dot's cell
  for (int i = 0; i < 9; i++) c += texture(uTex, transpose(R) * (cell + (vec2(i % 3, i / 3) - 1.0) * CELL * 0.33) / uRes).rgb / 9.0;
  float dark = 1.0 - dot(c, vec3(0.299, 0.587, 0.114));
  float r = CELL * sqrt(clamp(0.04 + 0.82 * dark, 0.0, 1.0) / PI); // dot area = darkness
  float dotMask = 1.0 - smoothstep(r - 1.2, r + 1.2, length(q - cell));
  vec3 paper = vec3(0.97, 0.94, 0.88) + grain(px) * 0.04;
  vec3 ink = mix(vec3(0.12, 0.08, 0.22), pow(c, vec3(1.5)), 0.6); // dark ink tinted by the picture's colour
  outColor = vec4(mix(paper, ink, dotMask), 1.0);
}`,
};
