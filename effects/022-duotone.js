// Duotone: the picture's brightness is mapped onto a gradient between just two inks (shadow colour -> highlight
// colour). Four colour pairs take turns, blending smoothly from one to the next while the picture drifts.
import { TAU, phase } from '../lib/util.js';
import { landscape } from '../lib/scenes.js';

export default {
  name: 'Duotone',
  ko: '듀오톤',
  tex(ctx, t, W, H) {
    const a = phase(t) * TAU, z = 1.18 + 0.08 * Math.cos(a);
    ctx.translate(W / 2 + 40 * Math.sin(a), H * 0.5);
    ctx.scale(z, z);
    ctx.translate(-W / 2, -H / 2);
    landscape(ctx, W, H, t);
  },
  frag: `
const vec3 DARK[4] = vec3[4](vec3(0.10, 0.09, 0.36), vec3(0.03, 0.20, 0.16), vec3(0.24, 0.04, 0.34), vec3(0.45, 0.02, 0.12));
const vec3 LIGHT[4] = vec3[4](vec3(1.00, 0.45, 0.68), vec3(0.80, 1.00, 0.36), vec3(1.00, 0.72, 0.30), vec3(1.00, 0.92, 0.80));
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float lum = dot(texture(uTex, uv).rgb, vec3(0.299, 0.587, 0.114));
  lum = smoothstep(0.08, 0.86, lum);                 // stretch the levels so both inks get used
  float x = uPhase * 4.0;                            // four pairs per loop, each blends into the next
  int i = int(floor(x)), j = (i + 1) % 4;
  float k = smoothstep(0.55, 1.0, fract(x));
  vec3 dark = mix(DARK[i], DARK[j], k), light = mix(LIGHT[i], LIGHT[j], k);
  vec3 col = mix(dark, light, lum) + grain(gl_FragCoord.xy) * 0.025;
  outColor = vec4(col, 1.0);
}`,
};
