// Risograph: three ink plates (fluorescent pink, blue, yellow) are drawn as masks into the R, G, B channels of one
// canvas; the shader prints each with a slight, slowly drifting misregistration, multiplies the inks on paper and
// breaks them up with a fixed screen-space ink texture and halftone for the soft tones.
import { TAU, phase, FONT } from '../lib/util.js';

export default {
  name: 'Risograph',
  ko: '리소그래프',
  tex(ctx, t, W, H) {
    const a = phase(t) * TAU;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    // yellow plate (blue channel): the big sun
    ctx.fillStyle = '#0000FF';
    ctx.beginPath(); ctx.arc(540 + 70 * Math.cos(a), 730 + 40 * Math.sin(a), 300, 0, TAU); ctx.fill();
    // pink plate (red channel): a soft halftone glow and the title
    const gx = 700 - 90 * Math.sin(a), gy = 950 + 60 * Math.cos(a);
    const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, 300);
    glow.addColorStop(0, '#FF0000'); glow.addColorStop(0.35, '#FF0000'); glow.addColorStop(1, '#000000');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#FF0000';
    ctx.font = `900 300px ${FONT.black}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('RISO', 540, 1550);
    // blue plate (green channel): a circle, scrolling stripes and a second line of type
    ctx.fillStyle = '#00FF00';
    ctx.beginPath(); ctx.arc(360 + 80 * Math.sin(a), 890 - 70 * Math.cos(a), 210, 0, TAU); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.rect(120, 1090, 840, 220); ctx.clip();
    for (let k = -1; k < 6; k++) ctx.fillRect(120, 1090 + (k + phase(t) * 2 % 1) * 44, 840, 20);
    ctx.restore();
    ctx.font = `700 84px ${FONT.display}`;
    ctx.fillText('OVERPRINT', 540, 1680);
    ctx.font = `900 300px ${FONT.black}`; ctx.lineWidth = 9; ctx.strokeStyle = '#00FF00';
    ctx.strokeText('RISO', 540, 1550); // the title's outline sits on the blue plate, so misregistration shows
  },
  frag: `
// halftone screen: tone 0..1 -> ink 0/1 with soft 1 px edges, grid rotated by ang
float screen(float tone, vec2 px, float ang) {
  vec2 q = rot(ang) * px * (TAU / 11.0);
  float d = 0.5 + 0.25 * (cos(q.x) + cos(q.y));       // 0..1 dot field
  float w = fwidth(d) + 1e-3;
  return smoothstep(d - w, d + w, tone * 1.08 - 0.04);
}
void main() {
  vec2 px = gl_FragCoord.xy, uv = px / uRes;
  float a = uPhase * TAU;
  // each plate lands a little off register, and the error drifts
  vec2 oP = vec2(13.0 * sin(a), 8.0 * cos(2.0 * a)), oB = vec2(-12.0 * cos(a), 12.0 * sin(a + 1.0)), oY = vec2(8.0 * sin(2.0 * a + 2.0), -9.0 * cos(a));
  float pink = texture(uTex, uv + oP / uRes).r, blue = texture(uTex, uv + oB / uRes).g, yellow = texture(uTex, uv + oY / uRes).b;
  pink = screen(pink, px, 0.26); blue = screen(blue, px, 1.31); yellow = screen(yellow, px, 0.0);
  // uneven ink: fixed blotches and specks where the drum did not cover
  float tex = 0.78 + 0.22 * vnoise(px / 7.0) - 0.25 * step(0.93, hash12(floor(px / 2.0)));
  vec3 col = vec3(0.965, 0.945, 0.90) + grain(px) * 0.035;
  col *= mix(vec3(1.0), vec3(1.0, 0.28, 0.66), pink * tex);
  col *= mix(vec3(1.0), vec3(0.0, 0.50, 0.80), blue * tex);
  col *= mix(vec3(1.0), vec3(1.0, 0.90, 0.0), yellow * tex);
  outColor = vec4(col, 1.0);
}`,
};
