// Procedural terrain: a heightmap made of fBm and ridged gradient noise, carved by a winding river valley. The noise
// repeats every 64 units along the flight, so the camera flies exactly one period per loop. Ground is coloured per
// pixel by height and slope (grass on gentle low ground, rock on steep faces, snow on high gentle slopes), with sun
// shadows marched across the heightmap once in setup, sky-coloured haze and a river that mirrors the sky. Each frame
// averages 6 renders spread over 3/4 of its 1/30 s, a little motion blur that keeps the fast fly-over smooth.
import * as THREE from 'three';
import { TAU, clamp, lerp, smoothstep } from '../lib/util.js';

const L = 64, SEG = 0.5, HALF = 110;         // tile length (one period), grid spacing, half width
const NX = HALF * 2 / SEG, NZ = L / SEG;
const SUN = new THREE.Vector3(0.78, 0.42, -0.22).normalize();

// gradient noise that repeats every `pz` lattice cells along z
function hash(i, j, seed) {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function pnoise(x, z, pz, seed) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const g = (i, j, dx, dz) => { const a = hash(i, ((j % pz) + pz) % pz, seed) * TAU; return Math.cos(a) * dx + Math.sin(a) * dz; };
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
  return lerp(lerp(g(ix, iz, fx, fz), g(ix + 1, iz, fx - 1, fz), u), lerp(g(ix, iz + 1, fx, fz - 1), g(ix + 1, iz + 1, fx - 1, fz - 1), u), v);
}
// octave k: lattice cells of 16 / 2^k units, 4 * 2^k of them per period, so every octave repeats after exactly L
const octave = (x, z, k, seed) => pnoise(x * 2 ** k / 16, z * 2 ** k / 16, 4 * 2 ** k, seed + k);
const valleyX = z => 8 * Math.sin(TAU * z / L) + 3 * Math.sin(2 * TAU * z / L + 1.3);

function height(x, z) {
  const wx = 5 * octave(x, z, 1, 21), wz = 5 * octave(x, z, 1, 29);            // warp the domain (still periodic)
  let big = 0, ridge = 0, w = 1, a = 0.5;
  for (let k = 0; k < 3; k++) big += 0.5 ** k * octave(x, z, k, 3);            // rolling land
  for (let k = 0; k < 4; k++) {                                                   // ridged multifractal: sharp crests
    const r = 1 - Math.sqrt(octave(x + wx, z + wz, k, 11) ** 2 + 0.002);
    ridge += a * r * r * w; w = clamp(r * 1.3); a *= 0.55;
  }
  const d = Math.abs(x - valleyX(z));
  const land = 2.5 + 8 * (big + 0.5) + 21 * smoothstep(-0.3, 0.4, big) * ridge ** 1.2;
  const h = lerp(1.2 + 0.5 * octave(x, z, 3, 7), land, smoothstep(4, 26, d));      // a meadow valley floor
  return lerp(-1.0, h, smoothstep(1.3, 4.0, d));                                   // and the river in it
}

// GLSL shared by sky, terrain fog and river reflections
const SKY = `
uniform vec3 uSun;
vec3 sky(vec3 d) {
  float y = max(d.y, 0.0);
  vec3 c = mix(vec3(0.80, 0.86, 0.94), vec3(0.22, 0.43, 0.85), pow(y, 0.5));
  float s = max(dot(d, uSun), 0.0);
  return c + vec3(1.0, 0.72, 0.45) * (0.30 * pow(s, 6.0) + 1.2 * pow(s, 600.0));
}
vec3 fogged(vec3 col, vec3 world) {
  vec3 v = world - cameraPosition;
  float d = length(v), f = 1.0 - exp(-pow(d / 230.0, 1.6));
  return mix(col, sky(normalize(vec3(v.x, max(v.y, 0.0) * 0.5 + 0.02 * d / 100.0, v.z))), f);
}
vec3 display(vec3 c) { c = 1.0 - exp(-max(c, 0.0) * 1.15); return pow(c, vec3(0.92)); }`;

export default {
  name: 'Procedural Terrain',
  ko: '절차적 지형',
  three(renderer, W, H) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, W / H, 0.5, 900);
    const sunU = { value: SUN };

    // one tile of heights (plus wrap), its normals from central differences and its sun shadows
    const hs = new Float32Array((NX + 1) * NZ);
    for (let j = 0; j < NZ; j++) for (let i = 0; i <= NX; i++) hs[j * (NX + 1) + i] = height(-HALF + i * SEG, -j * SEG);
    const at = (i, j) => hs[(((j % NZ) + NZ) % NZ) * (NX + 1) + clamp(Math.round(i), 0, NX)];
    const bil = (fi, fj) => {
      const i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j;
      return lerp(lerp(at(i, j), at(i + 1, j), u), lerp(at(i, j + 1), at(i + 1, j + 1), u), v);
    };
    const geo = new THREE.BufferGeometry();
    const pos = [], nor = [], sh = [], idx = [];
    for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
      const y = at(i, j);
      pos.push(-HALF + i * SEG, y, -j * SEG);
      const n = new THREE.Vector3(at(i - 1, j) - at(i + 1, j), 2 * SEG, at(i, j + 1) - at(i, j - 1)).normalize();
      nor.push(n.x, n.y, n.z);
      // soft shadow: march towards the sun over the heightmap (z wraps, so the tiles join without seams)
      let vis = 1;
      for (let s = 1; s < 120; s++) {
        const d = s * 1.2, ry = y + SUN.y * d, ty = bil(i + SUN.x * d / SEG, j - SUN.z * d / SEG);
        vis = Math.min(vis, clamp((ry - ty) / (0.05 * d) + 0.5));
        if (vis <= 0 || ry > 60) break;
      }
      const cav = clamp(0.5 + (at(i - 2, j) + at(i + 2, j) + at(i, j - 2) + at(i, j + 2) - 4 * y) * 0.12);
      sh.push(vis, cav);
    }
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('shade', new THREE.Float32BufferAttribute(sh, 2));
    geo.setIndex(idx);

    const ground = new THREE.ShaderMaterial({
      uniforms: { uSun: sunU },
      vertexShader: `attribute vec2 shade; varying vec3 vW, vN; varying vec2 vS;
        void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normal; vS = shade; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: SKY + `
        varying vec3 vW, vN; varying vec2 vS;
        void main() {
          vec3 n = normalize(vN);
          float slope = 1.0 - n.y, h = vW.y, wob = vS.y * 6.0 - 3.0;   // hollows (low cavity) hold grass and snow lower
          vec3 grass = mix(vec3(0.17, 0.33, 0.10), vec3(0.40, 0.45, 0.20), smoothstep(2.0, 14.0, h + wob));
          vec3 rock = mix(vec3(0.33, 0.29, 0.26), vec3(0.50, 0.46, 0.42), smoothstep(10.0, 30.0, h));
          float rocky = clamp(smoothstep(0.34, 0.48, slope + 0.03 * wob) + smoothstep(12.0, 17.0, h + wob), 0.0, 1.0);
          vec3 alb = mix(grass, rock, rocky);
          alb = mix(vec3(0.70, 0.62, 0.48), alb, smoothstep(0.2, 1.2, h));                         // river bank
          alb = mix(alb, vec3(0.96, 0.97, 1.0), smoothstep(16.0, 21.0, h + wob) * (1.0 - smoothstep(0.45, 0.75, slope)));   // snow
          float dif = max(dot(n, uSun), 0.0) * vS.x;
          vec3 col = alb * (vec3(2.3, 1.95, 1.5) * dif + vec3(0.26, 0.36, 0.55) * (0.55 + 0.45 * n.y) * (0.4 + 0.6 * vS.y));
          gl_FragColor = vec4(display(fogged(col, vW)), 1.0);
        }`,
    });
    for (let k = -1; k < 7; k++) {
      const m = new THREE.Mesh(geo, ground);
      m.position.z = -k * L;
      m.frustumCulled = false;
      scene.add(m);
    }
    const river = new THREE.Mesh(new THREE.PlaneGeometry(2 * HALF, 10 * L).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
      uniforms: { uSun: sunU },
      vertexShader: 'varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: SKY + `
        varying vec3 vW;
        void main() {
          vec3 v = normalize(vW - cameraPosition), r = reflect(v, vec3(0, 1, 0));
          float F = 0.03 + 0.97 * pow(1.0 - abs(v.y), 5.0);
          vec3 col = mix(vec3(0.05, 0.16, 0.20), sky(r), F);
          gl_FragColor = vec4(display(fogged(col, vW)), 1.0);
        }`,
    }));
    river.position.set(0, 0.0, -4 * L);
    scene.add(river);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), new THREE.ShaderMaterial({
      uniforms: { uSun: sunU }, side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vD; void main() { vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: SKY + 'varying vec3 vD; void main() { gl_FragColor = vec4(display(sky(normalize(vD))), 1.0); }',
    }));
    scene.add(dome);

    // camera: along the valley, 46 units up, looking ahead and down; it banks into the bends
    const look = new THREE.Vector3();
    const place = t => {
      const z = -L * t / 5, x = 0.6 * valleyX(z);
      camera.position.set(x, 46 + 2 * Math.sin(TAU * t / 5), z);
      look.set(0.3 * x, 5, z - 95);                                     // a steady heading: the far range barely turns
      camera.up.set(0.006 * (valleyX(z - 30) - valleyX(z)), 1, 0).normalize();
      camera.lookAt(look);
      dome.position.copy(camera.position);
    };

    // motion blur: 6 renders spread over 3/4 of each frame's 1/30 s, averaged in a float target
    const N = 6;
    const one = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
    const sum = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: { tex: { value: null }, k: { value: 1 } }, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: 'uniform sampler2D tex; uniform float k; varying vec2 vUv; void main() { gl_FragColor = vec4(texture2D(tex, vUv).rgb * k, 1.0); }',
    }));
    const flat = new THREE.Scene(), flatCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    flat.add(quad);
    renderer.autoClear = false;
    return {
      scene, camera,
      render(t) {
        renderer.setRenderTarget(sum); renderer.clear();
        quad.material.blending = THREE.AdditiveBlending; quad.material.uniforms.k.value = 1 / N;
        quad.material.uniforms.tex.value = one.texture;
        for (let i = 0; i < N; i++) {
          place(t + (i + 0.5) / N * 0.75 / 30);
          renderer.setRenderTarget(one); renderer.clear(); renderer.render(scene, camera);
          renderer.setRenderTarget(sum); renderer.render(flat, flatCam);
        }
        quad.material.blending = THREE.NoBlending; quad.material.uniforms.k.value = 1;
        quad.material.uniforms.tex.value = sum.texture;
        renderer.setRenderTarget(null); renderer.clear(); renderer.render(flat, flatCam);
      },
    };
  },
};
