// Gerstner ocean at sunset: nine trochoidal waves summed in the vertex shader move every vertex in a circle,
// so crests sharpen and troughs widen; 24 shorter waves add ripples to the normal per pixel. Every wave fades out
// once it is shorter than about 10-15 pixels on screen (no glitter shimmer). Each swell wave makes a whole number
// of cycles in 5 s and its length follows deep-water dispersion (k = w^2 / g). Foam appears where the surface is
// squeezed (Jacobian < 1), the sea reflects the same sky it sits under (Fresnel), and backlit crests glow.
import * as THREE from 'three';
import { TAU, phase, rng } from '../lib/util.js';

const G = 9.81;
// [cycles per 5 s, direction in degrees (0 = toward the camera), amplitude, steepness]
const SWELL = [
  [1, 8, 1.0, 0.8], [2, -24, 0.32, 0.8], [2, 33, 0.26, 0.8], [3, -6, 0.15, 0.8], [3, 48, 0.12, 0.75],
  [4, -40, 0.07, 0.75], [4, 18, 0.06, 0.75], [5, 10, 0.03, 0.7], [5, -58, 0.025, 0.7],
];
// ripples for the normal only: 24 short waves (0.5 to 2 m) with a slope of 0.022 each, from spread
// directions. They drift slower than real ripples (2 to 8 cycles per 5 s), which keeps them from strobing at 30 fps.
const R = rng(194);
const RIPPLE = Array.from({ length: 24 }, (_, i) => {
  const k = 3 * Math.pow(12 / 3, i / 23), n = 2 + Math.round(4 * i / 23);
  return [n, (R() - 0.5) * 150, 0.022 / k, 0, k];
});

const SKY = /* glsl */ `
uniform vec3 uSun;
vec3 sky(vec3 d, float disc) {
  float h = max(d.y, 0.0), s = max(dot(d, uSun), 0.0);
  vec3 zen = vec3(0.018, 0.022, 0.08), mid = vec3(0.22, 0.06, 0.18), hor = vec3(1.0, 0.33, 0.1);
  vec3 c = mix(hor, mid, smoothstep(0.0, 0.2, h));
  c = mix(c, zen, smoothstep(0.12, 0.6, h));
  c += vec3(1.3, 0.48, 0.12) * pow(s, 70.0) * 0.9 + vec3(1.6, 0.95, 0.45) * pow(s, 700.0) * 1.8;
  c += disc * vec3(24.0, 15.0, 7.0) * smoothstep(0.99988, 0.99993, s);           // the sun disc (not in reflections)
  vec2 cp = d.xz / (d.y + 0.03);                                                  // a flat cloud layer: long streaks
  float streak = 0.5 + 0.5 * sin(cp.y * 0.9 + 2.0 * sin(cp.x * 0.11 + 1.3)) * sin(cp.y * 0.37 - cp.x * 0.05);
  float band = smoothstep(0.03, 0.08, h) * smoothstep(0.32, 0.12, h);
  vec3 cloud = vec3(0.07, 0.02, 0.06) + vec3(1.6, 0.55, 0.15) * pow(s, 60.0);
  return mix(c, cloud, band * smoothstep(0.45, 0.9, streak) * 0.8);
}
vec3 tonemap(vec3 x) { // ACES fit, then sRGB
  x *= 0.85;
  x = clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  return pow(x, vec3(1.0 / 2.2));
}`;

// per wave (dir.x, dir.z, k, w) and (amplitude, steepness / (k a N)); k follows w^2 / g unless given
function pack(list) {
  return list.map(([n, deg, amp, q, kk]) => {
    const w = (TAU * n) / 5, k = kk || (w * w) / G, r = (deg * Math.PI) / 180;
    return [new THREE.Vector4(Math.sin(r), Math.cos(r), k, w), new THREE.Vector2(amp, q / (k * amp * list.length))];
  });
}

export default {
  name: 'Ocean Waves',
  ko: '바다 파도',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.NoToneMapping;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 2000);
    const sun = new THREE.Vector3(0.0, 0.055, -1).normalize();
    const swell = pack(SWELL), ripple = pack(RIPPLE);
    const uniforms = {
      uTime: { value: 0 }, uSun: { value: sun }, uCam: { value: new THREE.Vector3() },
      uA: { value: swell.map(w => w[0]) }, uB: { value: swell.map(w => w[1]) },
      uRA: { value: ripple.map(w => w[0]) }, uRB: { value: ripple.map(w => w[1]) },
    };

    const skyMat = new THREE.ShaderMaterial({
      uniforms, side: THREE.BackSide, depthWrite: false,
      vertexShader: `varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `${SKY}
varying vec3 vDir;
void main() { gl_FragColor = vec4(tonemap(sky(normalize(vDir), 1.0)), 1.0); }`,
    });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(1500, 64, 32), skyMat));

    // a fan of vertices in front of the camera, dense near it and sparse toward the horizon
    const NI = 400, NJ = 480, pos = [], idx = [];
    for (let j = 0; j <= NJ; j++) {
      const d = 1.2 * Math.pow(1200 / 1.2, j / NJ);
      for (let i = 0; i <= NI; i++) pos.push(d * 0.7 * (i / NI - 0.5) * 2, 0, -d + 3);
    }
    for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) {
      const a = j * (NI + 1) + i;
      idx.push(a, a + 1, a + NI + 1, a + 1, a + NI + 2, a + NI + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);

    const NS = SWELL.length, NR = RIPPLE.length;
    const seaMat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `
uniform float uTime; uniform vec4 uA[${NS}]; uniform vec2 uB[${NS}]; uniform vec3 uCam;
varying vec3 vPos; varying vec2 vRest;
void main() {
  vec2 p0 = position.xz;
  float dist = length(p0 - uCam.xz), px = dist * dist * 4.5e-4 / uCam.y;  // about how much sea one pixel covers
  vec3 p = vec3(p0.x, 0.0, p0.y);
  for (int i = 0; i < ${NS}; i++) {
    float k = uA[i].z, a = uB[i].x * smoothstep(6.0, 14.0, 6.2832 / k / px); // waves shorter than ~14 px flatten out
    float th = k * dot(uA[i].xy, p0) - uA[i].w * uTime;
    p.xz += uB[i].y * a * uA[i].xy * cos(th);
    p.y += a * sin(th);
  }
  vPos = p; vRest = p0;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`,
      fragmentShader: `${SKY}
uniform float uTime; uniform vec3 uCam;
uniform vec4 uA[${NS}]; uniform vec2 uB[${NS}]; uniform vec4 uRA[${NR}]; uniform vec2 uRB[${NR}];
varying vec3 vPos; varying vec2 vRest;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
void main() {
  vec2 p0 = vRest;
  float dist = length(uCam - vPos);
  float px = max(length(dFdx(p0)), length(dFdy(p0)));  // metres of sea under one pixel
  vec3 nrm = vec3(0.0, 1.0, 0.0);
  float jac = 1.0;
  for (int i = 0; i < ${NS}; i++) {
    float k = uA[i].z, a = uB[i].x * smoothstep(6.0, 14.0, 6.2832 / k / px), q = uB[i].y;
    float th = k * dot(uA[i].xy, p0) - uA[i].w * uTime, c = cos(th), s = sin(th);
    nrm.xz -= uA[i].xy * k * a * c;
    nrm.y -= q * k * a * s;
    jac -= q * k * a * s;
  }
  for (int i = 0; i < ${NR}; i++) {
    float k = uRA[i].z, fade = smoothstep(8.0, 18.0, 6.2832 / k / px);   // only ripples wider than ~18 px
    float th = k * dot(uRA[i].xy, p0) - uRA[i].w * uTime;
    nrm.xz -= uRA[i].xy * k * uRB[i].x * fade * cos(th);
  }
  vec3 v = normalize(uCam - vPos), n = normalize(mix(normalize(nrm), vec3(0.0, 1.0, 0.0), 0.5 * smoothstep(80.0, 500.0, dist)));
  vec3 r = reflect(-v, n);
  r.y = abs(r.y);
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.12), 5.0);  // capped at grazing: no hot rims
  // deep water, a little sun through the faces turned to it, and a glow on the high, thin crests
  float diffuse = pow(max(dot(n, uSun) * 0.4 + 0.6, 0.0), 40.0);
  vec3 water = vec3(0.24, 0.42, 0.3);
  vec3 body = vec3(0.004, 0.02, 0.04) + water * diffuse * 0.1;
  vec3 col = mix(body, sky(r, 0.0), fres);
  col += water * clamp(vPos.y - 0.4, 0.0, 2.0) * 0.12 * pow(max(dot(-v, uSun), 0.0), 3.0);
  // sun glitter
  col += vec3(9.0, 5.6, 2.6) * pow(max(dot(r, uSun), 0.0), mix(300.0, 90.0, smoothstep(5.0, 300.0, dist))) * 0.7;
  // foam on the crests where the surface is squeezed together, broken up by a pattern fixed to the water
  float pattern = vnoise(p0 * vec2(0.9, 3.0)) * 0.5 + vnoise(p0 * vec2(2.5, 7.0) + 7.0) * 0.3 + vnoise(p0 * vec2(7.0, 16.0) + 3.0) * 0.2;
  float foam = smoothstep(0.7, 0.4, jac + 0.4 * (pattern - 0.5)) * smoothstep(0.35, 0.65, pattern);
  foam *= 1.0 - smoothstep(40.0, 120.0, dist);
  vec3 foamCol = vec3(0.5, 0.33, 0.34) + vec3(1.0, 0.55, 0.28) * pow(max(dot(-v, uSun), 0.0), 2.0);
  col = mix(col, foamCol, foam * 0.7);
  // haze toward the horizon
  col = mix(col, sky(normalize(vec3(-v.x, 0.01, -v.z)), 0.0), smoothstep(60.0, 600.0, dist));
  gl_FragColor = vec4(tonemap(col), 1.0);
}`,
    });
    const sea = new THREE.Mesh(geo, seaMat);
    sea.frustumCulled = false;
    scene.add(sea);

    const pose = t => {
      const a = phase(t) * TAU;
      uniforms.uTime.value = t;
      // riding the swell a little, like a camera on a buoy
      camera.position.set(0.3 * Math.sin(a), 7.0 + 0.3 * Math.sin(a + 0.6), 3);
      camera.up.set(0.025 * Math.sin(a + 1.2), 1, 0);
      camera.lookAt(0, 6.0 + 0.2 * Math.sin(a), -40);
      uniforms.uCam.value.copy(camera.position);
    };

    // a film-like shutter: each frame is the average of SUB renders spread over the frame time (1/30 s), so the
    // sun glints smear a little instead of popping on and off between frames
    const SUB = 6, targets = Array.from({ length: SUB }, () => new THREE.WebGLRenderTarget(W, H, { samples: 4 }));
    const blend = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: { uT: { value: targets.map(rt => rt.texture) } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D uT[${SUB}]; varying vec2 vUv;
void main() { vec4 c = vec4(0.0); ${targets.map((_, i) => `c += texture2D(uT[${i}], vUv);`).join(' ')} gl_FragColor = c / ${SUB}.0; }`,
    }));
    const blendScene = new THREE.Scene(), blendCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    blendScene.add(blend);

    return {
      render(t) {
        targets.forEach((rt, i) => {
          pose(t + ((i + 0.5) / SUB - 0.5) / 30);
          renderer.setRenderTarget(rt);
          renderer.render(scene, camera);
        });
        renderer.setRenderTarget(null);
        renderer.render(blendScene, blendCam);
      },
    };
  },
};
