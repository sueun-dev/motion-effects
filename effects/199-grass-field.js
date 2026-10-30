// Grass field: about 80,000 instanced blades in one draw call. Each blade is a tapered 6-segment strip; the vertex
// shader bends it along the wind by its height squared, with gusts as broad bands that roll across the meadow
// (whole cycles per loop) plus a small flutter of its own. Bent blades show their lighter, sunlit sides, so every gust
// reads as a bright wave. Backlit by a low sun: tips glow, far grass melts into the haze. Each frame averages 8 renders
// spread over its 1/30 s (motion blur), so the thin blades sweep instead of jittering.
import * as THREE from 'three';
import { rng } from '../lib/util.js';

const SKY = `
uniform vec3 uSun;
uniform float uPhase;
const float TAU = 6.28318530718;
const vec2 WIND = vec2(0.5432, 0.8396);                                 // blowing towards the camera, to the right
// gusts: two broad bands rolling along the wind, 1 and 2 cycles per loop
float gust(vec2 p) {
  float g1 = 0.5 + 0.5 * sin(dot(p, WIND) * 0.30 - TAU * uPhase + 1.2 * sin(p.x * 0.11));
  float g2 = 0.5 + 0.5 * sin(dot(p, vec2(0.85, 0.5)) * 0.21 - TAU * 2.0 * uPhase + 2.0);
  return g1 * g1 * 0.75 + g2 * g2 * 0.3;
}
// the colour a patch of grass averages to from afar (bent grass shows its brighter side)
vec3 field(float g) { return vec3(0.26, 0.35, 0.10) * (0.8 + 0.75 * g); }
vec3 sky(vec3 d) {
  float y = max(d.y, 0.0), s = max(dot(d, uSun), 0.0);
  vec3 c = mix(vec3(1.00, 0.72, 0.45), vec3(0.36, 0.46, 0.78), pow(y, 0.45));
  return c + vec3(1.0, 0.62, 0.32) * (0.45 * pow(s, 10.0) + 2.0 * pow(s, 900.0));
}
vec3 haze(vec3 col, vec3 world) {
  vec3 v = world - cameraPosition;
  float f = 1.0 - exp(-length(v) / 34.0);
  return mix(col, sky(normalize(vec3(v.x, 0.02, v.z))), f);
}
vec3 display(vec3 c) { c = 1.0 - exp(-max(c, 0.0) * 1.2); return pow(c, vec3(0.9)); }`;

export default {
  name: 'Grass Field',
  ko: '잔디밭',
  three(renderer, W, H) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, W / H, 0.1, 400);
    const sun = new THREE.Vector3(-0.25, 0.10, -1).normalize();
    const uni = { uSun: { value: sun }, uPhase: { value: 0 } };

    // blades: dense near the camera, thinner far away, inside a wedge a little wider than the view
    const r = rng(199), inst = [];
    for (let d = 1.2; d < 70; d += 0.1) {
      const density = 520 / (1 + (d / 5) ** 1.35), width = 0.8 * d + 3;
      const n = density * width * 0.1;
      for (let k = 0; k < n; k++) {
        const z = -(d + r() * 0.1), x = (r() - 0.5) * width;
        inst.push(x, z, r() * Math.PI, 0.32 + 0.32 * r() + 0.15 * r() * r(), r(), r());
      }
    }
    const count = inst.length / 6;
    const blade = new THREE.InstancedBufferGeometry();
    const pos = [], idx = [];
    for (let i = 0; i <= 6; i++) { const h = i / 6; pos.push(-0.5, h, 0, 0.5, h, 0); }
    for (let i = 0; i < 6; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    blade.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    blade.setIndex(idx);
    const buf = new THREE.InstancedInterleavedBuffer(new Float32Array(inst), 6);   // per blade: x, z, turn, height, 2 seeds
    blade.setAttribute('inst', new THREE.InterleavedBufferAttribute(buf, 4, 0));
    blade.setAttribute('seed', new THREE.InterleavedBufferAttribute(buf, 2, 4));
    blade.instanceCount = count;

    const grass = new THREE.Mesh(blade, new THREE.ShaderMaterial({
      uniforms: uni, side: THREE.DoubleSide,
      vertexShader: SKY + `
        attribute vec4 inst;   // x, z, turn, height
        attribute vec2 seed;
        varying float vH, vGust, vSeed, vDist; varying vec3 vW;
        void main() {
          vec2 root = inst.xy, wind = WIND;
          float h = position.y, tall = inst.w;
          float g = gust(root);
          float flutter = 0.015 * sin(seed.x * TAU + TAU * 2.0 * uPhase + root.y * 0.7);
          float bend = 0.3 + 0.38 * g + flutter + 0.2 * (seed.y - 0.5);
          float dist = length(root - cameraPosition.xz);
          float w = 0.028 * max(1.0, dist * 0.055) * (1.0 - 0.9 * h);     // tapered; wider far away so it never thins below a pixel
          vec2 side = vec2(cos(inst.z), sin(inst.z));
          vec2 lean = wind * bend + side.yx * vec2(-1.0, 1.0) * 0.25 * (seed.x - 0.5);
          vec3 p = vec3(root.x, 0.0, root.y);
          p.xz += side * position.x * w + lean * h * h * tall * 0.75;
          p.y = h * tall * (1.0 - 0.28 * dot(lean, lean) * h * h);
          vH = h; vGust = g; vSeed = seed.x; vW = p; vDist = dist;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: SKY + `
        varying float vH, vGust, vSeed, vDist; varying vec3 vW;
        void main() {
          vec3 root = vec3(0.12, 0.20, 0.05), tip = mix(vec3(0.40, 0.52, 0.14), vec3(0.58, 0.58, 0.20), vSeed * vSeed);
          vec3 col = mix(root, tip, smoothstep(0.0, 1.0, vH));
          col *= 0.72 + 0.85 * vGust * vH;                                 // bent blades show their bright sides
          col = mix(col, field(vGust), smoothstep(6.0, 22.0, vDist));     // far away, blades blend into the field's colour
          vec3 v = normalize(vW - cameraPosition);
          float back = pow(max(dot(v, uSun), 0.0), 4.0);                  // light shining through the blade
          col += vec3(1.0, 0.70, 0.30) * back * vH * vH * 0.6;
          gl_FragColor = vec4(display(haze(col, vW)), 1.0);
        }`,
    }));
    grass.frustumCulled = false;
    scene.add(grass);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
      uniforms: uni,
      vertexShader: 'varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: SKY + 'varying vec3 vW; void main() { gl_FragColor = vec4(display(haze(field(gust(vW.xz)) * 0.8, vW)), 1.0); }',
    }));
    scene.add(ground);
    // far hills: soft dark bumps on the horizon, seen through the haze
    const hills = new THREE.Mesh(new THREE.CylinderGeometry(150, 150, 1, 512, 1, true), new THREE.ShaderMaterial({
      uniforms: uni, side: THREE.BackSide,
      vertexShader: `varying vec3 vW; void main() {
        vec3 p = position; float a = atan(p.z, p.x);
        p.y = p.y > 0.0 ? 3.6 + 1.8 * sin(a * 17.0 + 1.0) + 1.0 * sin(a * 41.0) + 0.4 * sin(a * 89.0) : -1.0;
        vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: SKY + `varying vec3 vW; void main() {
        vec3 v = vW - cameraPosition; vec3 c = mix(vec3(0.08, 0.10, 0.10), sky(normalize(vec3(v.x, 0.02, v.z))), 0.72);
        gl_FragColor = vec4(display(c), 1.0); }`,
    }));
    scene.add(hills);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({
      uniforms: uni, side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vD; void main() { vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: SKY + 'varying vec3 vD; void main() { gl_FragColor = vec4(display(sky(normalize(vD))), 1.0); }',
    }));
    scene.add(dome);

    camera.position.set(0, 2.0, 1.0);
    camera.lookAt(-0.6, 0.0, -9.0);

    // motion blur: 8 renders spread over each frame's 1/30 s, averaged in a float target, so the blades sweep softly
    const N = 8;
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
          uni.uPhase.value = (t + (i + 0.5) / N / 30) / 5;
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
