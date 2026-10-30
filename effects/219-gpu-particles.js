// GPU particles: 250,000 soft points, all moved in the vertex shader. Each one is born on a trefoil knot and rides a
// curl-noise flow (the curl of three simplex-noise fields, integrated from its birth on a fixed 1/15 s clock shared by
// every particle) with a strength that swells and fades over the loop, so the knot dissolves into swirling smoke and
// gathers again as new particles are born on it. Every particle is also drawn at its last 11 frame times, fainter
// each step back (a long exposure), so the smoke is made of fine streaks that flow instead of sparkling grain.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { TAU, rng } from '../lib/util.js';

const N = 250000, TRAIL = 12;               // particles; each is drawn at its last TRAIL frame times, fading
const SIZE = 5, SOFT = 9, GAIN = 0.064;     // sprite size (px at the knot), Gaussian falloff, light per particle
const VEL = 0.16, UPV = 0.08, NRM = 0.1;    // flow speed: curl noise, drift up, push off the surface
const DIM = 0.6, FARLIGHT = 0.7;            // a particle fades to FARLIGHT x brightness as it drifts DIM away
const SWAY = 0.06;                          // the knot's sway (rad)

const vertexShader = /* glsl */ `
uniform float uTime, uWeight;
uniform mat3 uTurn;  // knot space -> world (a tilt and a slow sway)
uniform vec3 uUp;    // world up, in knot space
attribute vec3 aNormal;
attribute vec2 aSeed;
varying vec3 vColor;
varying float vAlpha;

// 3D simplex noise with its gradient (Ian McEwan, Ashima Arts / Stefan Gustavson, MIT license)
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v, out vec3 grad) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy)), x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz), l = 1.0 - g, i1 = min(g.xyz, l.zxy), i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx, x2 = x0 - i2 + C.yyy, x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  vec3 ns = 0.142857142857 * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z), x_ = floor(j * ns.z), y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy, y = y_ * ns.x + ns.yyyy, h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy), b1 = vec4(x.zw, y.zw), s0 = floor(b0) * 2.0 + 1.0, s1 = floor(b1) * 2.0 + 1.0, sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy, a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x), p1 = vec3(a0.zw, h.y), p2 = vec3(a1.xy, h.z), p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0), m2 = m * m, m4 = m2 * m2;
  vec4 pdotx = vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)), tmp = m2 * m * pdotx;
  grad = 42.0 * (-8.0 * (tmp.x * x0 + tmp.y * x1 + tmp.z * x2 + tmp.w * x3) + m4.x * p0 + m4.y * p1 + m4.z * p2 + m4.w * p3);
  return 42.0 * dot(m4, pdotx);
}
// curl of a vector potential made of three noise fields: a divergence-free flow (no sinks, so the smoke swirls)
vec3 curl(vec3 p, float time) {
  vec2 o = 0.6 * vec2(cos(time / 5.0 * 6.2831853), sin(time / 5.0 * 6.2831853)); // the field drifts on a loop
  vec3 g1, g2, g3;
  snoise(p + vec3(o, 0.0), g1);
  snoise(p + vec3(31.4, o.y, o.x) , g2);
  snoise(p + vec3(o.x, 17.2, o.y + 5.1), g3);
  return vec3(g3.y - g2.z, g1.z - g3.x, g2.x - g1.y);
}

// how strongly the flow pulls particles off the knot at a given time: 0 at 0 s and 5 s, 1 at 2.5 s
float strength(float time) { return pow(0.5 - 0.5 * cos(time / 5.0 * 6.2831853), 1.2); }

void main() {
  float life = 2.5, age = fract(uTime / life + aSeed.x) * life, born = uTime - age;
  // ride the flow from birth to now (knot space) in steps on a fixed 1/15 s clock shared by every particle, so
  // particles in the same place always move the same way (the grain flows instead of boiling)
  vec3 q = position;
  float dt = 1.0 / 15.0, time = born, next = (floor(born / dt) + 1.0) * dt;
  for (int k = 0; k < 40; k++) {
    if (time >= uTime) break;
    float end = min(next, uTime);
    q += (end - time) * strength(time) * (${VEL.toFixed(3)} * curl(q * 0.6, time) + uUp * ${UPV.toFixed(3)} + aNormal * ${NRM.toFixed(3)});
    time = end; next += dt;
  }
  float d = length(q - position), s = strength(uTime);
  // on the knot: lit by a soft key from the upper left; out in the flow: magenta, then deep violet
  vec3 n = uTurn * aNormal;
  float lit = 0.3 + 0.7 * max(dot(n, normalize(vec3(-0.5, 0.7, 0.6))), 0.0);
  vec3 hot = vec3(0.72, 0.93, 1.0) * lit, mid = vec3(1.0, 0.32, 0.78), far = vec3(0.32, 0.22, 1.0);
  vColor = mix(hot, mix(mid, far, smoothstep(0.3, 1.0, d)), smoothstep(0.02, 0.3, d));
  vAlpha = mix(1.0, smoothstep(0.0, 0.35, age) * smoothstep(life, life - 0.7, age), smoothstep(0.0, 0.25, s));
  vAlpha *= uWeight * (0.8 + 0.4 * aSeed.y) * mix(1.0, ${FARLIGHT.toFixed(3)}, smoothstep(0.0, ${DIM.toFixed(3)}, d));
  q = uTurn * q;
  vec4 mv = modelViewMatrix * vec4(q, 1.0);
  gl_PointSize = ${SIZE.toFixed(2)} * 10.0 / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const fragmentShader = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = exp(-dot(c, c) * ${SOFT.toFixed(2)}) * vAlpha;
  gl_FragColor = vec4(vColor * a * ${GAIN.toFixed(4)}, 1.0);
}`;

export default {
  name: 'GPU Particles',
  ko: 'GPU 파티클',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas');
    bg.width = 4; bg.height = 512;
    const g = bg.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#07051A'); grd.addColorStop(0.55, '#120A2E'); grd.addColorStop(1, '#040312');
    g.fillStyle = grd; g.fillRect(0, 0, 4, 512);
    scene.background = new THREE.CanvasTexture(bg);
    scene.background.colorSpace = THREE.SRGBColorSpace;
    const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 100);
    camera.position.set(0, 0, 10);

    const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(1.15, 0.36, 600, 64, 2, 3));
    const r = rng(219), sampler = new MeshSurfaceSampler(knot).setRandomGenerator(r).build();
    const pos = new Float32Array(N * 3), nor = new Float32Array(N * 3), seed = new Float32Array(N * 2);
    const p = new THREE.Vector3(), nv = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      sampler.sample(p, nv);
      pos.set([p.x, p.y, p.z], i * 3);
      nor.set([nv.x, nv.y, nv.z], i * 3);
      seed.set([r(), r()], i * 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aNormal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 2));
    // the same points drawn at the last TRAIL frame times, weights falling in a straight line from the newest to the
    // oldest (adding up to 1): draw k of this frame is exactly draw k - 1 of the previous one, so a pixel only fades
    // gently as a particle moves on, and the grain stretches into fibres along the flow instead of sparkling
    const total = TRAIL * (TRAIL + 1) / 2;
    const shots = Array.from({ length: TRAIL }, (_, k) => {
      const uniforms = { uTime: { value: 0 }, uWeight: { value: (TRAIL - k) / total }, uTurn: { value: new THREE.Matrix3() }, uUp: { value: new THREE.Vector3() } };
      const points = new THREE.Points(geo, new THREE.ShaderMaterial({
        uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      }));
      points.frustumCulled = false;
      scene.add(points);
      return uniforms;
    });

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.45, 0.6, 0.2));
    composer.addPass(new OutputPass());

    const tilt = new THREE.Matrix4().makeRotationX(-0.95), turn = new THREE.Matrix4();
    return {
      scene, camera,
      render(t) {
        shots.forEach((uniforms, k) => {
          const ts = t - k / 30, a = ts / 5 * TAU;
          uniforms.uTime.value = ts;
          turn.makeRotationY(SWAY * Math.sin(a)).multiply(tilt).multiply(new THREE.Matrix4().makeRotationZ(SWAY * Math.sin(a)));
          uniforms.uTurn.value.setFromMatrix4(turn);
          uniforms.uUp.value.set(0, 1, 0).applyMatrix3(uniforms.uTurn.value.clone().transpose());
        });
        composer.render();
      },
    };
  },
};
