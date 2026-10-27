// Demoscene tunnel: every pixel maps to (angle, depth = 1 / radius) on the inside of a cylinder; the tile texture
// scrolls in depth by whole tiles per loop. Lines are anti-aliased by their screen-space width and fade into the light.
export default {
  name: 'Tunnel',
  ko: '터널',
  frag: `
const float NA = 14.0;   // tiles around
const float NV = 4.0;    // tiles flown through per loop
const float DEPTH = 1.0;

void main() {
  float a0 = uPhase * TAU;
  vec2 c = uRes * vec2(0.5, 0.5) + uRes.x * vec2(0.05 * cos(a0), 0.04 * sin(2.0 * a0));
  vec2 p = (gl_FragCoord.xy - c) / uRes.x;
  float r = max(length(p), 1e-4);
  float u = (atan(p.y, p.x) / TAU + 0.5) * NA + uPhase * 2.0;   // two tiles of spin per loop
  float v = DEPTH / r + uPhase * NV;
  vec2 id = vec2(mod(floor(u), 2.0), mod(floor(v), NV));   // colours repeat every 2 tiles around, so the spin loops
  vec2 f = fract(vec2(u, v)) - 0.5;
  float du = NA / (TAU * r * uRes.x), dv = DEPTH / (r * r * uRes.x);   // tile units per pixel

  float h = hash12(id + 3.0);
  vec3 tile = mix(vec3(0.05, 0.03, 0.16), vec3(0.16, 0.05, 0.3), h);
  vec3 neon = mix(vec3(0.2, 0.95, 1.0), vec3(1.0, 0.3, 0.85), 0.5 + 0.5 * sin(id.y / NV * TAU + id.x * 1.3));
  float lw = 0.05;   // half line width in tile units, measured from the tile border
  float lu = 1.0 - smoothstep(lw - du, lw + du, 0.5 - abs(f.x));
  float lv = 1.0 - smoothstep(lw - dv, lw + dv, 0.5 - abs(f.y));
  float line = max(lu * clamp(1.5 - du * 6.0, 0.0, 1.0), lv * clamp(1.5 - dv * 6.0, 0.0, 1.0));
  vec3 col = mix(tile, neon, line);

  float z = DEPTH / r;
  float fog = exp(-z * 0.09);
  vec3 glow = vec3(1.0, 0.82, 0.95);
  col = mix(glow * 0.9, col, fog);
  col += glow * 0.55 * exp(-r * 9.0);
  col *= 0.75 + 0.25 * smoothstep(0.9, 0.3, r);
  outColor = vec4(col, 1.0);
}`,
};
