// Fractal flame (Scott Draves' IFS algorithm, the one behind Electric Sheep). Three transforms, each an affine
// map followed by nonlinear variations: horseshoe + linear, julia, swirl + disc, and a 2-fold symmetry (a
// half turn that keeps the colour, applied to half the points at each step). The chaos game runs on the GPU:
// each of 128 x 2^22 points (537 million) starts from its own fixed hash, applies 22 randomly chosen
// transforms (the choices are fixed too) and adds its colour to the 432 x 768 bin it lands in, with the
// colour index c <- (c + c_i) / 2. Bins are coloured by log density, and sparse bins are blurred wider than
// dense ones (density estimation). The affine coefficients drift on whole-number sines, so the flame morphs
// smoothly and loops; with the random choices fixed, nothing sparkles between frames.
import * as THREE from 'three';

const BW = 432, BH = 768, POINTS = 1 << 22, PASSES = 128;

const SPLAT = `precision highp float; precision highp int;
uniform float uPhase, uPass;
out vec3 vColor;
uint hash(uint x) { x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16; return x; }
float rnd(inout uint s) { s = hash(s); return float(s >> 8) / 16777216.0; }
vec3 palette(float c) {                                // gold -> ember -> violet -> blue -> ice
  vec3 a = mix(vec3(1.0, 0.78, 0.28), vec3(1.0, 0.36, 0.16), smoothstep(0.0, 0.3, c));
  a = mix(a, vec3(0.62, 0.22, 0.78), smoothstep(0.3, 0.55, c));
  a = mix(a, vec3(0.16, 0.38, 1.0), smoothstep(0.55, 0.8, c));
  return mix(a, vec3(0.45, 0.9, 1.0), smoothstep(0.8, 1.0, c));
}
vec2 swirl(vec2 p) { float r2 = dot(p, p); return vec2(p.x * sin(r2) - p.y * cos(r2), p.x * cos(r2) + p.y * sin(r2)); }
vec2 horseshoe(vec2 p) { float r = length(p) + 1e-6; return vec2((p.x - p.y) * (p.x + p.y), 2.0 * p.x * p.y) / r; }
vec2 disc(vec2 p) { float r = length(p), th = atan(p.x, p.y) / 3.14159265; return th * vec2(sin(3.14159265 * r), cos(3.14159265 * r)); }
vec2 julia(vec2 p, float pick) { float r = sqrt(length(p)), th = 0.5 * atan(p.y, p.x) + (pick < 0.5 ? 0.0 : 3.14159265); return r * vec2(cos(th), sin(th)); }
mat2 rs(float a, float s) { return s * mat2(cos(a), sin(a), -sin(a), cos(a)); }
void main() {
  uint s = hash(uint(gl_VertexID) * 16u + uint(uPass) + 7u);
  vec2 p = vec2(rnd(s), rnd(s)) * 2.0 - 1.0;
  float c = rnd(s), a = uPhase * 6.28318;
  float s1 = sin(a), c1 = cos(a), s2 = sin(2.0 * a), c2 = cos(2.0 * a);
  for (int k = 0; k < 22; k++) {
    float u = rnd(s), pick = rnd(s);                   // both fixed per point and step: never depend on t
    if (u < 0.5) {                                     // 1: horseshoe + linear, colour 0
      p = mat2(0.55 + 0.04 * c1, 0.3 + 0.05 * s2, -0.3 + 0.05 * s1, 0.55) * p + vec2(0.35 + 0.06 * s1, 0.1 + 0.06 * c2);
      p = 0.6 * horseshoe(p) + 0.4 * p;
      c = 0.5 * c;
    } else if (u < 0.8) {                              // 2: julia, colour 0.55
      p = rs(1.6 + 0.18 * s1, 0.65 + 0.03 * c2) * p + vec2(-0.3 + 0.05 * c1, 0.4 + 0.05 * s2);
      p = julia(p, pick);
      c = 0.5 * (c + 0.55);
    } else {                                           // 3: swirl + disc, colour 1
      p = mat2(0.35, -0.5 + 0.06 * c1, 0.5, 0.35 + 0.04 * s1) * p + vec2(0.1 + 0.08 * s2, -0.5 + 0.05 * c1);
      p = 0.5 * swirl(p) + 0.5 * disc(p);
      c = 0.5 * (c + 1.0);
    }
    if (rnd(s) < 0.5) p = -p;                          // 2-fold symmetry: a half turn that keeps the colour
  }
  gl_Position = vec4(1.04 * p.x, 0.585 * p.y - 0.06, 0.0, 1.0);   // flame -> clip space
  if (any(isnan(p)) || length(p) > 8.0) gl_Position = vec4(9.0, 9.0, 0.0, 1.0);
  gl_PointSize = 1.0;
  vColor = palette(c);
}`;

const SHOW = `precision highp float;
uniform sampler2D uAcc; uniform vec2 uRes; uniform float uNorm;
out vec4 o;
vec4 tap(vec2 uv) { return texture(uAcc, uv); }
void main() {
  vec2 uv = gl_FragCoord.xy / uRes, px = 1.0 / vec2(${BW}.0, ${BH}.0);
  float d0 = tap(uv).a;
  float r = mix(2.6, 0.8, smoothstep(2.0, 70.0, d0 * uNorm));   // density estimation: sparse = wider blur
  vec4 acc = vec4(0.0); float w = 0.0;
  for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) {
    vec2 o2 = vec2(x, y) * r * 0.5;
    float k = exp(-dot(o2, o2) / (r * r * 0.5));
    acc += k * tap(uv + o2 * px); w += k;
  }
  acc /= w;
  float dens = acc.a * uNorm;
  vec3 col = acc.a > 0.0 ? acc.rgb / acc.a : vec3(0.0);
  float alpha = log(1.0 + dens) / log(1.0 + 500.0) * smoothstep(0.5, 4.0, acc.a);   // log density, strays fade
  vec3 bg = mix(vec3(0.010, 0.008, 0.025), vec3(0.03, 0.02, 0.06), uv.y);
  vec3 c = col * pow(clamp(alpha, 0.0, 1.0), 1.25) * 2.9;          // dense cores glow, thin veils stay dim
  c += vec3(1.0, 0.95, 0.85) * pow(clamp(alpha, 0.0, 1.0), 4.0) * 0.6;   // the densest threads burn white
  o = vec4(bg + c, 1.0);
}`;

export default {
  name: 'Fractal Flame',
  ko: '프랙탈 플레임',
  three(renderer, W, H) {
    renderer.getContext().getExtension('EXT_float_blend');   // additive blending into a float target
    const acc = new THREE.WebGLRenderTarget(BW, BH, { type: THREE.FloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Uint8Array(POINTS), 1));   // only sets the count
    const splat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: SPLAT,
      fragmentShader: 'precision highp float; in vec3 vColor; out vec4 o; void main() { o = vec4(vColor, 1.0); }',
      uniforms: { uPhase: { value: 0 }, uPass: { value: 0 } },
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      depthTest: false, depthWrite: false, transparent: true,
    });
    const points = new THREE.Points(geo, splat);
    points.frustumCulled = false;
    const splatScene = new THREE.Scene(); splatScene.add(points);
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const show = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: 'in vec3 position; void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: SHOW,
      uniforms: { uAcc: { value: acc.texture }, uRes: { value: new THREE.Vector2(W, H) }, uNorm: { value: (BW * BH) / (POINTS * PASSES) * 100 } },
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), show);
    quad.frustumCulled = false;
    const showScene = new THREE.Scene(); showScene.add(quad);
    return {
      render(t) {
        splat.uniforms.uPhase.value = t / 5;
        renderer.setRenderTarget(acc);
        renderer.setClearColor(0x000000, 0); renderer.clear();
        for (let p = 0; p < PASSES; p++) { splat.uniforms.uPass.value = p; renderer.render(splatScene, cam); }
        renderer.setRenderTarget(null);
        renderer.render(showScene, cam);
      },
    };
  },
};
