// Glitch without static: horizontal bands of the picture slide sideways and the R and B channels pull apart,
// all driven by smooth sines of t. Each band's strength is a fixed hash; two glitch bursts swell and fade per loop.
import { TAU, FONT } from '../lib/util.js';

export default {
  name: 'Glitch',
  ko: '글리치',
  tex(ctx, t, W, H) { // a still poster: striped sun, title and a status line
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0B0820'); bg.addColorStop(0.6, '#2A0F4A'); bg.addColorStop(1, '#0B0820');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const sun = ctx.createLinearGradient(0, 430, 0, 1090);
    sun.addColorStop(0, '#FFE66B'); sun.addColorStop(0.5, '#FF7A59'); sun.addColorStop(1, '#FF2E88');
    ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(W / 2, 760, 330, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2A0F4A';
    for (let k = 0; k < 7; k++) ctx.fillRect(0, 800 + k * 44, W, 6 + k * 4); // the sun's horizontal cuts
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF'; ctx.font = `900 196px ${FONT.black}`;
    ctx.fillText('GLITCH', W / 2, 1390);
    ctx.fillStyle = '#5CF2FF'; ctx.font = `700 48px ${FONT.mono}`;
    ctx.fillText('ERR_SIGNAL // 0x2F', W / 2, 1510);
  },
  frag: `
void main() {
  vec2 p = gl_FragCoord.xy;
  float a = uPhase * TAU;
  float g = 0.15 + 0.85 * pow(0.5 + 0.5 * sin(2.0 * a), 3.0);  // two smooth bursts per loop
  float y = p.y + 40.0 * sin(a);                                // band edges drift slowly
  float i1 = floor(y / 150.0), i2 = floor(y / 44.0);
  float off = 70.0 * (hash12(vec2(i1, 1.0)) - 0.5) * 2.0 * sin(a + TAU * hash12(vec2(i1, 2.0)));
  float thin = step(0.62, hash12(vec2(i2, 3.0)));               // only some thin bands jump
  off += thin * 110.0 * (hash12(vec2(i2, 4.0)) - 0.5) * 2.0 * sin(2.0 * a + TAU * hash12(vec2(i2, 5.0)));
  off *= g;
  float split = 5.0 + 26.0 * g;                                 // RGB split, a little vertical too
  vec2 uv = (p + vec2(off, 0.0)) / uRes, s = vec2(split, split * 0.25) / uRes;
  vec3 col = vec3(texture(uTex, uv + s).r, texture(uTex, uv).g, texture(uTex, uv - s).b);
  float swap = thin * step(0.5, hash12(vec2(i2, 6.0))) * g;     // a few bands swap channels while it peaks
  col = mix(col, col.brg * vec3(0.6, 1.2, 1.3), swap * 0.8);
  outColor = vec4(col, 1.0);
}`,
};
