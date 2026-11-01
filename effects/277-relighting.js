// Relighting, imitated with deterministic code (no neural network): a photo of a marble bust is split into the maps
// a relighting model would estimate (albedo, surface normals, depth), and a light is moved round it in image space.
// Here the maps come from a sculpted signed-distance bust, ray-marched once at setup at 2 x 2 samples per pixel; each
// frame a shader re-lights those 2D maps (diffuse, gloss, a fill, and shadows marched through the depth map) for a
// coloured light orbiting the head. A divider sweeps across: the original photo on the left, the re-lit one on the right.
import * as THREE from 'three';
import { TAU, FONT } from '../lib/util.js';

const IW = 960, IH = 1180, SS = 2;                           // image size (px) and supersampling
const IX = 60, IY = 300;                                     // image position on screen (top-left)
const FOV = 0.3;                                             // tan(half vertical field of view) of the photo camera
const CAM = [0, -0.45, 6.4];
const state = { light: new THREE.Vector3(), col: new THREE.Color(), div: 0 };

// the light: swings across the front of the head on a sphere of radius 2.4, low and high, and shifts colour
function light(t) {
  const a = TAU * t / 5, az = 1.25 * Math.sin(a + 0.3), el = 0.55 * Math.sin(2 * a + 0.6);
  state.light.set(2.4 * Math.sin(az) * Math.cos(el), -0.2 + 2.4 * Math.sin(el), 2.4 * Math.cos(az) * Math.cos(el));
  const k = 0.5 + 0.5 * Math.sin(a - 0.6);
  state.col.setRGB(1.0, 0.62 + 0.25 * k, 0.4 + 0.5 * k).lerp(new THREE.Color(0.45, 0.7, 1.0), 0.5 + 0.5 * Math.cos(a + 1.2));
  state.div = IW * (0.4 + 0.28 * Math.sin(a));
}

const SDF = `
float sdE(vec3 p, vec3 r) { float k0 = length(p / r), k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
float sdCap(vec3 p, vec3 a, vec3 b, float r) { vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float smax(float a, float b, float k) { return -smin(-a, -b, k); }
mat2 rot(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }
// a sleeping marble head on a block, tilted to one side; id: 1 marble, 2 carved hair, 3 block, 4 wall
vec2 map(vec3 p) {
  vec3 h = p - vec3(0.0, -0.2, 0.0);
  h.xy = rot(0.42) * h.xy; h.yz = rot(-0.12) * h.yz; h.xz = rot(0.38) * h.xz;
  float d = sdE(h, vec3(0.78, 1.0, 0.86));                                       // the ovoid head
  d = smin(d, sdE(h - vec3(0.0, -0.45, 0.1), vec3(0.55, 0.6, 0.62)), 0.35);       // lower face
  vec3 m = vec3(abs(h.x), h.yz);
  d = smin(d, sdCap(m, vec3(0.05, 0.19, 0.8), vec3(0.42, 0.15, 0.66), 0.05), 0.15);   // brow
  d = smax(d, -sdE(m - vec3(0.27, 0.0, 0.88), vec3(0.2, 0.1, 0.12)), 0.08);      // eye hollows
  d = smin(d, sdE(m - vec3(0.27, -0.01, 0.775), vec3(0.17, 0.072, 0.08)), 0.05); // closed lids
  d = smax(d, -sdCap(m, vec3(0.13, -0.04, 0.85), vec3(0.4, -0.025, 0.77), 0.007), 0.01);   // lid crease
  d = smin(d, sdCap(h, vec3(0.0, 0.12, 0.86), vec3(0.0, -0.29, 0.95), 0.055), 0.1);   // nose
  d = smin(d, sdE(h - vec3(0.0, -0.31, 0.93), vec3(0.09, 0.065, 0.065)), 0.06);
  d = smin(d, sdCap(h, vec3(-0.12, -0.52, 0.76), vec3(0.12, -0.52, 0.76), 0.032), 0.04);   // lips
  d = smin(d, sdCap(h, vec3(-0.09, -0.59, 0.745), vec3(0.09, -0.59, 0.745), 0.036), 0.04);
  d = smax(d, -sdCap(h, vec3(-0.13, -0.556, 0.79), vec3(0.13, -0.556, 0.79), 0.006), 0.008);
  float hair = sdE(h - vec3(0.0, 0.1, -0.06), vec3(0.83, 0.99, 0.87)) - 0.02 + 0.016 * sin(atan(h.x, h.z) * 20.0 + h.y * 5.0);
  hair = smax(hair, 0.3 - (h.y * 0.85 - h.z * 0.55), 0.12);                     // hairline over the crown
  float id = hair < d ? 2.0 : 1.0;
  d = smin(d, hair, 0.03);
  vec3 bq = abs(p - vec3(0.0, -1.62, -0.05)) - vec3(1.05, 0.42, 0.75);
  float block = length(max(bq, 0.0)) + min(max(bq.x, max(bq.y, bq.z)), 0.0) - 0.03;
  if (block < d) { d = block; id = 3.0; }
  float wall = p.z + 2.4;
  if (wall < d) { d = wall; id = 4.0; }
  return vec2(d, id);
}`;

// once: ray-march the bust into albedo, normal and position buffers (2 x 2 samples per pixel)
const gbufFrag = `
layout(location = 0) out vec4 gAlbedo;
layout(location = 1) out vec4 gNormal;
layout(location = 2) out vec4 gPos;
${SDF}
float h3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float vn(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
void main() {
  vec2 uv = (gl_FragCoord.xy / vec2(${IW * SS}.0, ${IH * SS}.0)) * 2.0 - 1.0;
  vec3 ro = vec3(${CAM[0]}, ${CAM[1]}, ${CAM[2]}), rd = normalize(vec3(uv.x * ${FOV} * ${IW / IH}, uv.y * ${FOV}, -1.0));
  float t = 0.0; vec2 h = vec2(1.0);
  for (int i = 0; i < 220; i++) { h = map(ro + rd * t); if (h.x < 0.0004 || t > 20.0) break; t += h.x * 0.8; }
  vec3 p = ro + rd * t;
  vec2 e = vec2(0.0008, 0.0);
  vec3 n = normalize(vec3(map(p + e.xyy).x - map(p - e.xyy).x, map(p + e.yxy).x - map(p - e.yxy).x, map(p + e.yyx).x - map(p - e.yyx).x));
  float turb = vn(p * 1.6) * 0.65 + vn(p * 3.4) * 0.35;                           // marble: a sine bent by noise
  float vein = (1.0 - smoothstep(0.0, 0.12, abs(sin((p.x * 0.8 + p.y * 0.5 - p.z * 0.3) * 4.0 + turb * 7.0)))) * 0.09;
  vec3 alb = h.y < 1.5 ? vec3(0.92, 0.89, 0.84) - vein
           : h.y < 2.5 ? vec3(0.86, 0.81, 0.74) - vein
           : h.y < 3.5 ? vec3(0.42, 0.39, 0.37) : vec3(0.2, 0.19, 0.22);
  gAlbedo = vec4(alb, h.y);
  gNormal = vec4(n, 1.0);
  gPos = vec4(p, 1.0);
}`;

// every frame: light the maps, for the photo (fixed soft light) or the re-lit image (the orbiting light)
const lightFrag = `
uniform sampler2D tA, tN, tP; uniform vec3 uL, uC; uniform float uDiv;
varying vec2 vUv;
vec3 proj(vec3 p) { vec3 v = p - vec3(${CAM[0]}, ${CAM[1]}, ${CAM[2]}); return vec3(v.xy / (-v.z) / vec2(${FOV * IW / IH}, ${FOV}) * 0.5 + 0.5, -v.z); }
float shadowTo(vec3 p, vec3 n, vec3 lp) {                     // march towards the light through the depth map
  vec3 d = lp - p; float len = length(d); d /= len;
  float occ = 0.0, j = fract(52.98 * fract(dot(gl_FragCoord.xy, vec2(0.0671, 0.0058))));   // fixed per-pixel offset
  for (int i = 1; i <= 40; i++) {
    float s = len * pow((float(i) - j) / 40.0, 1.5) * 0.95;
    vec3 q = p + n * 0.01 + d * s, sp = proj(q);
    if (sp.x < 0.0 || sp.y < 0.0 || sp.x > 1.0 || sp.y > 1.0) break;
    float depth = proj(texture2D(tP, sp.xy).xyz).z;
    occ = max(occ, smoothstep(0.02, 0.08, sp.z - depth) * smoothstep(0.9, 0.3, sp.z - depth));
  }
  return 1.0 - occ;
}
vec3 shade(ivec2 px, bool relit) {
  vec4 A = texelFetch(tA, px, 0); vec3 N = texelFetch(tN, px, 0).xyz, P = texelFetch(tP, px, 0).xyz;
  vec3 V = normalize(vec3(${CAM[0]}, ${CAM[1]}, ${CAM[2]}) - P);
  float gloss = A.a < 2.5 ? 1.0 : 0.15;
  if (!relit) {                                                 // the "photo": soft key from the upper left, warm fill
    vec3 L = normalize(vec3(-0.6, 0.7, 0.55));
    float sh = shadowTo(P, N, P + L * 6.0);
    vec3 c = A.rgb * (vec3(1.0, 0.95, 0.88) * 1.25 * max(dot(N, L), 0.0) * sh + vec3(0.32, 0.3, 0.34) * (0.6 + 0.4 * N.y));
    return c + gloss * 0.12 * pow(max(dot(N, normalize(L + V)), 0.0), 30.0) * sh;
  }
  vec3 d = uL - P; float dist = length(d); vec3 L = d / dist;
  float sh = shadowTo(P, N, uL), fall = 9.0 / (dist * dist + 1.0);
  vec3 c = A.rgb * (uC * fall * max(dot(N, L), 0.0) * sh + vec3(0.07, 0.07, 0.1) * (0.6 + 0.4 * N.y));
  return c + gloss * uC * fall * 0.35 * pow(max(dot(N, normalize(L + V)), 0.0), 40.0) * sh;
}
void main() {
  ivec2 base = ivec2(vUv * vec2(${IW}.0, ${IH}.0)) * ${SS};
  bool relit = vUv.x * ${IW}.0 > uDiv;
  vec3 c = vec3(0.0);
  for (int y = 0; y < ${SS}; y++) for (int x = 0; x < ${SS}; x++) c += shade(base + ivec2(x, y), relit);
  c /= ${SS * SS}.0;
  if (relit) {                                                  // the light itself, hidden when it is behind the bust
    vec3 lp = proj(uL);
    float r = length((vUv - lp.xy) * vec2(${IW}.0, ${IH}.0));
    float depth = proj(texture2D(tP, lp.xy).xyz).z;
    float seen = step(lp.z, depth + 0.05);
    c += seen * (uC * exp(-r * r / 300.0) * 3.0 + uC * exp(-r * r / 6000.0) * 0.35 + vec3(1.0) * exp(-r * r / 60.0) * 2.0);
  }
  float edge = 1.0 - smoothstep(0.0, 1.5, abs(vUv.x * ${IW}.0 - uDiv));
  c = mix(c, vec3(2.0), edge);
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// the small panels: albedo, normals (as colours) and a sphere lit by the light
const mapFrag = `
uniform sampler2D tA, tN; uniform int uMode; uniform vec3 uL, uC; varying vec2 vUv;
void main() {
  if (uMode == 2) {
    vec2 p = vUv * 2.0 - 1.0; float r2 = dot(p, p);
    if (r2 > 1.0) { gl_FragColor = vec4(0.04, 0.04, 0.06, 1.0); return; }
    vec3 n = vec3(p, sqrt(1.0 - r2)), L = normalize(uL - n * 0.0);
    vec3 c = vec3(0.85) * (uC * max(dot(n, normalize(uL)), 0.0) + 0.06) * (1.0 - smoothstep(0.96, 1.0, r2));
    gl_FragColor = vec4(c, 1.0);
  } else {
    vec3 c = vec3(0.0);
    ivec2 base = ivec2(vUv * vec2(${IW * SS}.0, ${IH * SS}.0));
    for (int y = -2; y < 2; y++) for (int x = -2; x < 2; x++) {   // a small box filter for the reduced view
      ivec2 q = base + ivec2(x, y) * 2;
      c += uMode == 0 ? texelFetch(tA, q, 0).rgb : pow(texelFetch(tN, q, 0).xyz * 0.5 + 0.5, vec3(2.2));
    }
    gl_FragColor = vec4(c / 16.0, 1.0);
  }
  #include <colorspace_fragment>
}`;

export default {
  name: 'Relighting',
  ko: '리라이팅',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const gbuf = new THREE.WebGLRenderTarget(IW * SS, IH * SS, { count: 3, type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)), post = new THREE.Scene(), flat = new THREE.Camera();
    post.add(quad);
    const vert = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
    quad.material = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: vert, fragmentShader: gbufFrag });
    renderer.setRenderTarget(gbuf);
    renderer.render(post, flat);
    renderer.setRenderTarget(null);
    const tex = { tA: { value: gbuf.textures[0] }, tN: { value: gbuf.textures[1] }, tP: { value: gbuf.textures[2] } };
    const lit = new THREE.ShaderMaterial({ uniforms: { ...tex, uL: { value: state.light }, uC: { value: state.col }, uDiv: { value: 0 } }, vertexShader: vert, fragmentShader: lightFrag });
    const maps = new THREE.ShaderMaterial({ uniforms: { ...tex, uMode: { value: 0 }, uL: { value: state.light }, uC: { value: state.col } }, vertexShader: vert, fragmentShader: mapFrag });
    renderer.autoClear = false;
    const region = (x, y, w, h) => { renderer.setViewport(x, H - y - h, w, h); renderer.setScissor(x, H - y - h, w, h); };
    return {
      render(t) {
        light(t);
        lit.uniforms.uDiv.value = state.div;
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, W, H);
        renderer.setClearColor('#0B0B10', 1);
        renderer.clear();
        renderer.setScissorTest(true);
        quad.material = lit; region(IX, IY, IW, IH); renderer.render(post, flat);
        quad.material = maps;
        [[60, 0], [380, 1], [760, 2]].forEach(([x, m]) => {
          maps.uniforms.uMode.value = m;
          if (m === 2) region(x + 20, 1560, 220, 220); else region(x, 1540, 220, 270);
          renderer.render(post, flat);
        });
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, W, H);
      },
    };
  },
  overlay(ctx, t, W, H) {
    const x = IX + state.div;
    ctx.textBaseline = 'alphabetic'; ctx.font = `700 26px ${FONT.sans}`;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath(); ctx.roundRect(IX + 20, IY + 20, 160, 46, 12); ctx.roundRect(IX + IW - 150, IY + 20, 130, 46, 12); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center';
    ctx.fillText('PHOTO', IX + 100, IY + 52); ctx.fillText('RE-LIT', IX + IW - 85, IY + 52);
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(x, IY + IH / 2, 22, 0, TAU); ctx.fill();   // divider handle
    ctx.fillStyle = '#20202A'; ctx.font = `700 22px ${FONT.sans}`; ctx.fillText('‹ ›', x, IY + IH / 2 + 8);
    ctx.font = `700 22px ${FONT.sans}`; ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText('ALBEDO', 170, 1840); ctx.fillText('NORMALS', 490, 1840); ctx.fillText('LIGHT', 890, 1840);
    ctx.font = `300 54px ${FONT.sans}`; ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText('+', 330, 1690); ctx.fillText('+', 690, 1690);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'; ctx.lineWidth = 2;
    ctx.strokeRect(60, 1540, 220, 270); ctx.strokeRect(380, 1540, 220, 270);
  },
};
