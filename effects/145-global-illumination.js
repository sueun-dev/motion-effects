// Global illumination: a tall Cornell box path traced on the GPU once, before the first frame (2048 paths per pixel,
// fixed seeds, so the result is clean and identical every run). Each path's light is filed by how many times it
// bounced: direct light, one bounce, two, three or more. The loop then adds the bounces back one by one and removes
// them again: from hard direct light with black shadows and a black ceiling to soft light with red and green bleeding.
import * as THREE from 'three';
import { FONT, smoothstep } from '../lib/util.js';

const PASSES = 64, SPP = 32;
// weight of bounce k (1, 2, 3+) at time t: they come in one after another, hold, and leave in reverse
const weights = t => [0.55, 1.15, 1.75].map(s => smoothstep(s, s + 0.45, t) * (1 - smoothstep(5 - s - 0.2, 5 - s + 0.25, t)));

const TRACE = `
precision highp float;
uniform sampler2D uPrev0, uPrev1, uPrev2, uPrev3;
uniform float uPass; uniform vec2 uRes;
layout(location = 0) out vec4 o0;   // direct light (and the lamp itself)
layout(location = 1) out vec4 o1;   // light that bounced once more
layout(location = 2) out vec4 o2;   // twice
layout(location = 3) out vec4 o3;   // three times or more
const float HY = 1.75;              // room: x -0.5..0.5, y 0..HY, z -0.5..0.5, open at the front (z = +0.5)
const vec3 LE = vec3(16.0, 12.5, 7.5);
const vec2 LS = vec2(0.13, 0.13);   // half size of the ceiling lamp

uint seed;
uint pcg(uint v) { uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
float rnd() { seed = pcg(seed); return float(seed) / 4294967296.0; }

// a tall block, a short block and a ball resting on it
const vec3 SC = vec3(0.19, 0.45, 0.12); const float SR = 0.15;
float hitBlock(vec3 ro, vec3 rd, vec3 bc, vec3 bh, float ang, out vec3 n) {
  float c = cos(ang), s = sin(ang);
  mat3 m = mat3(c, 0, s, 0, 1, 0, -s, 0, c);              // world -> block
  vec3 o = m * (ro - bc), d = m * rd;
  vec3 inv = 1.0 / d, t1 = (-bh - o) * inv, t2 = (bh - o) * inv, tn = min(t1, t2), tf = max(t1, t2);
  float a = max(max(tn.x, tn.y), tn.z), b = min(min(tf.x, tf.y), tf.z);
  if (a > b || b < 0.0 || a < 1e-4) return 1e9;
  vec3 ln = a == tn.x ? vec3(-sign(d.x), 0, 0) : a == tn.y ? vec3(0, -sign(d.y), 0) : vec3(0, 0, -sign(d.z));
  n = transpose(m) * ln;
  return a;
}
float hitBox(vec3 ro, vec3 rd, out vec3 n) {
  vec3 n2; float a = hitBlock(ro, rd, vec3(-0.17, 0.5, -0.16), vec3(0.15, 0.5, 0.15), 0.3, n);
  float b = hitBlock(ro, rd, vec3(0.19, 0.15, 0.12), vec3(0.15, 0.15, 0.15), -0.3, n2);
  if (b < a) { n = n2; return b; }
  return a;
}
float hitBall(vec3 ro, vec3 rd) {
  vec3 oc = ro - SC; float b = dot(oc, rd), c = dot(oc, oc) - SR * SR, h = b * b - c;
  if (h < 0.0) return 1e9;
  float t = -b - sqrt(h);
  return t > 1e-4 ? t : 1e9;
}
// nearest hit: t, normal, albedo, and whether it is the lamp
float trace(vec3 ro, vec3 rd, out vec3 n, out vec3 alb, out bool lamp) {
  float t = 1e9; lamp = false;
  // the five walls, seen from inside
  float tw;
  tw = (0.0 - ro.y) / rd.y; if (tw > 1e-4 && tw < t) { vec3 p = ro + rd * tw; if (abs(p.x) <= 0.5 && abs(p.z) <= 0.5) { t = tw; n = vec3(0, 1, 0); alb = vec3(0.73); } }
  tw = (HY - ro.y) / rd.y;  if (tw > 1e-4 && tw < t) { vec3 p = ro + rd * tw; if (abs(p.x) <= 0.5 && abs(p.z) <= 0.5) { t = tw; n = vec3(0, -1, 0); alb = vec3(0.73); lamp = abs(p.x) < LS.x && abs(p.z) < LS.y; } }
  tw = (-0.5 - ro.z) / rd.z; if (tw > 1e-4 && tw < t) { vec3 p = ro + rd * tw; if (abs(p.x) <= 0.5 && p.y >= 0.0 && p.y <= HY) { t = tw; n = vec3(0, 0, 1); alb = vec3(0.73); lamp = false; } }
  tw = (-0.5 - ro.x) / rd.x; if (tw > 1e-4 && tw < t) { vec3 p = ro + rd * tw; if (abs(p.z) <= 0.5 && p.y >= 0.0 && p.y <= HY) { t = tw; n = vec3(1, 0, 0); alb = vec3(0.63, 0.065, 0.05); lamp = false; } }
  tw = (0.5 - ro.x) / rd.x;  if (tw > 1e-4 && tw < t) { vec3 p = ro + rd * tw; if (abs(p.z) <= 0.5 && p.y >= 0.0 && p.y <= HY) { t = tw; n = vec3(-1, 0, 0); alb = vec3(0.14, 0.45, 0.091); lamp = false; } }
  vec3 bn; float tb = hitBox(ro, rd, bn); if (tb < t) { t = tb; n = bn; alb = vec3(0.73); lamp = false; }
  float ts = hitBall(ro, rd); if (ts < t) { t = ts; n = normalize(ro + rd * ts - SC); alb = vec3(0.73); lamp = false; }
  return t;
}
bool blocked(vec3 ro, vec3 rd, float dist) { vec3 n; return hitBox(ro, rd, n) < dist || hitBall(ro, rd) < dist; }
vec3 cosineDir(vec3 n) {
  float r1 = rnd(), r2 = rnd(), r = sqrt(r1), ph = 6.2831853 * r2;
  vec3 t = normalize(abs(n.x) > 0.5 ? cross(n, vec3(0, 1, 0)) : cross(n, vec3(1, 0, 0))), b = cross(n, t);
  return normalize(t * r * cos(ph) + b * r * sin(ph) + n * sqrt(1.0 - r1));
}
void main() {
  ivec2 px = ivec2(gl_FragCoord.xy);
  vec3 acc[4]; acc[0] = vec3(0); acc[1] = vec3(0); acc[2] = vec3(0); acc[3] = vec3(0);
  for (int s = 0; s < ${SPP}; s++) {
    seed = pcg(uint(px.x) * 1973u + uint(px.y) * 9277u + uint(uPass * ${SPP}.0 + float(s)) * 26699u + 1u);
    vec2 uv = (2.0 * (gl_FragCoord.xy + vec2(rnd(), rnd()) - 0.5) - uRes) / uRes.x;   // jittered: antialiasing for free
    vec3 ro = vec3(0.0, HY * 0.5, 3.05), rd = normalize(vec3(uv * 0.2725, -1.0));
    vec3 thr = vec3(1.0);
    for (int k = 0; k < 8; k++) {
      vec3 n, alb; bool lamp;
      float t = trace(ro, rd, n, alb, lamp);
      if (t > 1e8) break;
      if (lamp) { if (k == 0) acc[0] += LE; break; }          // the lamp is counted by direct sampling below
      vec3 p = ro + rd * t + n * 1e-4;
      // direct light: one point on the lamp, with a shadow ray
      vec3 lp = vec3((rnd() * 2.0 - 1.0) * LS.x, HY, (rnd() * 2.0 - 1.0) * LS.y), l = lp - p;
      float d2 = dot(l, l), d = sqrt(d2); l /= d;
      float cx = dot(n, l), cl = l.y;
      if (cx > 0.0 && cl > 0.0 && !blocked(p, l, d)) acc[min(k, 3)] += thr * alb / 3.14159265 * LE * cx * cl / d2 * (4.0 * LS.x * LS.y);
      thr *= alb;                                              // cosine sampling: cos / pdf cancels the 1 / pi
      ro = p; rd = cosineDir(n);
    }
  }
  float k = 1.0 / float(${PASSES * SPP});
  o0 = texelFetch(uPrev0, px, 0) + vec4(acc[0] * k, 0);
  o1 = texelFetch(uPrev1, px, 0) + vec4(acc[1] * k, 0);
  o2 = texelFetch(uPrev2, px, 0) + vec4(acc[2] * k, 0);
  o3 = texelFetch(uPrev3, px, 0) + vec4(acc[3] * k, 0);
}`;

export default {
  name: 'Global Illumination',
  ko: '전역 조명',
  three(renderer, W, H) {
    const opts = { type: THREE.FloatType, count: 4, depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter };
    let src = new THREE.WebGLRenderTarget(W, H, opts), dst = new THREE.WebGLRenderTarget(W, H, opts);
    const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    const quadScene = new THREE.Scene(); quadScene.add(quad);
    quad.frustumCulled = false;
    const vert = 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }';
    const trace = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: vert, fragmentShader: TRACE,
      uniforms: { uPrev0: { value: null }, uPrev1: { value: null }, uPrev2: { value: null }, uPrev3: { value: null }, uPass: { value: 0 }, uRes: { value: new THREE.Vector2(W, H) } },
    });
    quad.material = trace;
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(src); renderer.clear();
    for (let p = 0; p < PASSES; p++) {               // accumulate 32 x 32 paths per pixel, ping-ponging two targets
      for (let i = 0; i < 4; i++) trace.uniforms[`uPrev${i}`].value = src.textures[i];
      trace.uniforms.uPass.value = p;
      renderer.setRenderTarget(dst); renderer.render(quadScene, quadCam);
      [src, dst] = [dst, src];
    }
    renderer.setRenderTarget(null);
    const show = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: vert,
      uniforms: { uL0: { value: src.textures[0] }, uL1: { value: src.textures[1] }, uL2: { value: src.textures[2] }, uL3: { value: src.textures[3] }, uW: { value: new THREE.Vector3() } },
      fragmentShader: `precision highp float;
        uniform sampler2D uL0, uL1, uL2, uL3; uniform vec3 uW; out vec4 o;
        float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
        void main() {
          ivec2 px = ivec2(gl_FragCoord.xy);
          vec3 c = texelFetch(uL0, px, 0).rgb + uW.x * texelFetch(uL1, px, 0).rgb + uW.y * texelFetch(uL2, px, 0).rgb + uW.z * texelFetch(uL3, px, 0).rgb;
          c *= 2.3;
          c = c * (2.51 * c + 0.03) / (c * (2.43 * c + 0.59) + 0.14);   // ACES-like curve
          o = vec4(pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2)) + (hash(gl_FragCoord.xy) - 0.5) / 255.0, 1.0);
        }`,
    });
    const backdrop = new THREE.Scene();
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), show); plane.frustumCulled = false;
    backdrop.add(plane);
    return {
      scene: backdrop, camera: quadCam,
      update(t) { show.uniforms.uW.value.fromArray(weights(t)); },
    };
  },
  overlay(ctx, t, W, H) {
    const w = weights(t), steps = ['direct', '1 bounce', '2', '3+'];
    const x0 = 150, x1 = 930, y = 1800;
    ctx.fillStyle = 'rgba(16, 14, 20, 0.74)';
    ctx.beginPath(); ctx.roundRect(60, 1660, W - 120, 210, 28); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.font = `700 30px ${FONT.sans}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('light bounces', 100, 1712);
    const level = w[0] + w[1] + w[2];          // 0 .. 3
    ctx.textAlign = 'right'; ctx.font = `500 26px ${FONT.sans}`; ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.globalAlpha = 1 - smoothstep(0, 0.3, level); ctx.fillText('direct light only', W - 100, 1712); // one fades out,
    ctx.globalAlpha = smoothstep(0.3, 0.6, level); ctx.fillText('direct + indirect light', W - 100, 1712); // then the other in
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath(); ctx.roundRect(x0, y - 4, x1 - x0, 8, 4); ctx.fill();
    ctx.fillStyle = '#FFD58A';
    ctx.beginPath(); ctx.roundRect(x0, y - 4, (x1 - x0) * level / 3, 8, 4); ctx.fill();
    steps.forEach((s, i) => {
      const x = x0 + (x1 - x0) * i / 3, on = i === 0 ? 1 : w[i - 1];
      ctx.fillStyle = `rgba(255, 213, 138, ${0.35 + 0.65 * on})`;
      ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + 0.5 * on})`; ctx.font = `600 24px ${FONT.sans}`; ctx.textAlign = 'center';
      ctx.fillText(s, x, y + 42);
    });
  },
};
