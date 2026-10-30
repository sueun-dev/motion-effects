// Many lights: 336 coloured point lights swirl in six spiral arms over a black lacquer floor, inside a ring of pillars.
// Every light has a short reach (it fades to zero at 1.25 units), the way deferred and clustered renderers keep
// hundreds of lights cheap; the floor and pillars add up all of them per pixel (positions read from a float texture).
// The arms are identical, so turning them one or two arms' width per loop brings the picture back to the start.
import * as THREE from 'three';
import { TAU, phase, rng } from '../lib/util.js';

const ARMS = 6, PER = 56, N = ARMS * PER;
const COLORS = ['#FF2E88', '#21D4FD', '#FFB224', '#8C5CFF', '#3DFFA2', '#FF5F3D'];

// one arm's lights: radius, angle along the spiral, height, wobble phase, arms turned per loop (k), colour index
function lights(seed) {
  const r = rng(seed), base = [];
  for (let j = 0; j < PER; j++) {
    const rad = 0.5 + 4.6 * Math.sqrt(r());
    base.push({ rad, th: rad * 0.8 + (r() - 0.5) * 0.35, h: 0.14 + 0.5 * r(), ph: r() * TAU, k: rad < 2.4 ? 2 : 1, c: Math.floor(r() * COLORS.length) });
  }
  return base;
}

const VERT = 'varying vec3 vP; varying vec3 vN; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }';
const FRAG = `
uniform sampler2D uLights; // row 0: position, row 1: colour
uniform vec3 uBase; uniform float uGloss, uSpec;
varying vec3 vP; varying vec3 vN;
void main() {
  vec3 n = normalize(vN), v = normalize(cameraPosition - vP), col = uBase * 0.03;
  for (int i = 0; i < ${N}; i++) {
    vec3 lp = texelFetch(uLights, ivec2(i, 0), 0).xyz, lc = texelFetch(uLights, ivec2(i, 1), 0).rgb;
    vec3 l = lp - vP; float d = length(l);
    if (d > 1.25) continue;                       // outside this light's reach: skipped, as a clustered renderer would
    l /= d;
    float w = pow(clamp(1.0 - pow(d / 1.25, 4.0), 0.0, 1.0), 2.0) / (d * d + 0.04);
    float dif = max(dot(n, l), 0.0);
    float spe = pow(max(dot(n, normalize(l + v)), 0.0), uGloss) * uSpec * step(0.0, dot(n, l));
    col += lc * w * (uBase * dif + spe);
  }
  col = col / (1.0 + col);                      // soft tone map, so crowded spots glow instead of clipping
  vec3 q = fract(vec3(gl_FragCoord.xyx) * 0.1031); q += dot(q, q.yzx + 33.33);
  float dither = fract((q.x + q.y) * q.z) - 0.5;  // fixed per pixel: keeps the dark gradients from banding
  gl_FragColor = vec4(pow(col, vec3(1.0 / 2.2)) + dither / 255.0, 1.0);
}`;

export default {
  name: 'Many Lights',
  ko: '다수 광원',
  three(renderer, W, H) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#020206');
    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 100);
    camera.position.set(0, 12.0, 7.6);
    camera.lookAt(0, 0, -0.4);

    const base = lights(11);
    const data = new Float32Array(N * 2 * 4);                       // row 0: positions, row 1: light colours
    const tex = new THREE.DataTexture(data, N, 2, THREE.RGBAFormat, THREE.FloatType);
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3); // the visible dots
    for (let s = 0; s < ARMS; s++) base.forEach((b, j) => {
      const i = s * PER + j, c = new THREE.Color(COLORS[b.c]); // same in every arm, so the arms are interchangeable
      data.set([c.r * 0.22, c.g * 0.22, c.b * 0.22, 1], (N + i) * 4);
      col.set([c.r, c.g, c.b], i * 3);
    });
    const mat = (baseColor, gloss, spec) => new THREE.ShaderMaterial({
      uniforms: { uLights: { value: tex }, uBase: { value: new THREE.Color(baseColor) }, uGloss: { value: gloss }, uSpec: { value: spec } },
      vertexShader: VERT, fragmentShader: FRAG,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), mat('#15161D', 300, 3.2)); // black lacquer: tight highlights
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    const pillarMat = mat('#9A9DB0', 40, 0.5);
    for (let k = 0; k < 8; k++) {                                    // a ring of square pillars round the swirl
      const q = (k + 0.5) * TAU / 8, h = k % 2 ? 1.1 : 1.7;
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.45, h, 0.45), pillarMat);
      p.position.set(3.3 * Math.cos(q), h / 2, 3.3 * Math.sin(q));
      p.rotation.y = -q;
      scene.add(p);
    }
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.4, 48), pillarMat); // the swirl's axis
    core.position.y = 0.7;
    scene.add(core);

    // the lamps themselves: small additive glows
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const dots = new THREE.Points(geo, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
      vertexShader: 'varying vec3 vC; void main() { vC = color; vec4 m = modelViewMatrix * vec4(position, 1.0); gl_PointSize = 420.0 / -m.z; gl_Position = projectionMatrix * m; }',
      fragmentShader: 'varying vec3 vC; void main() { float r = length(gl_PointCoord - 0.5) * 2.0; float g = exp(-r * r * 9.0) + 0.6 * exp(-r * r * 60.0); gl_FragColor = vec4(mix(vC, vec3(1.0), 0.5 * exp(-r * r * 60.0)) * g, 1.0); }',
    }));
    scene.add(dots);

    return {
      scene, camera,
      update(t) {
        const a = phase(t) * TAU;
        for (let s = 0; s < ARMS; s++) base.forEach((b, j) => {
          const i = s * PER + j;
          // turn by k arms' width per loop: inner lights two, outer lights one, so the pattern repeats exactly
          const th = b.th + s * TAU / ARMS + b.k * (TAU / ARMS) * phase(t) + 0.12 * Math.sin(a + b.ph);
          const x = b.rad * Math.cos(th), z = b.rad * Math.sin(th), y = b.h + 0.08 * Math.sin(a + b.ph * 2);
          data.set([x, y, z], i * 4);
          pos.set([x, y, z], i * 3);
        });
        tex.needsUpdate = true;
        geo.attributes.position.needsUpdate = true;
      },
    };
  },
};
