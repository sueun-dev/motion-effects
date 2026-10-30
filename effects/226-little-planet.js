// Little planet: a CubeCamera films the whole 360 degree surroundings from a point above a street, and a full-screen
// shader re-projects that cube map stereographically from the nadir (theta = 2 atan(r / 2)): the ground under the
// camera becomes a round planet, the sky wraps around it. The camera rolls one street-repeat down the road per loop,
// so houses rise over one side of the little world and sink behind the other.
import * as THREE from 'three';
import { TAU, rng, smoothstep } from '../lib/util.js';

const L = 24, EYE = 3.4, FAR = 62; // the street repeats every L units; camera height; things shrink away by FAR
const SCALE = 215;       // pixels per unit of the projection plane: the horizon is a circle of 2 * SCALE px

const fragmentShader = /* glsl */ `
uniform samplerCube tCube;
uniform vec2 uCenter;
uniform float uSpin;
varying vec2 vUv;
void main() {
  vec2 p = (vUv * vec2(1080.0, 1920.0) - uCenter) / ${SCALE.toFixed(1)};
  float theta = 2.0 * atan(length(p) * 0.5);       // angle from straight down
  float phi = atan(p.y, p.x) + uSpin;
  vec3 dir = vec3(sin(theta) * cos(phi), -cos(theta), -sin(theta) * sin(phi)); // screen up = down the road (-z)
  gl_FragColor = vec4(textureCube(tCube, dir).rgb, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export default {
  name: 'Little Planet',
  ko: '리틀 플래닛',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();

    // everything far away (sky, sun, hills, balloons) rides along with the camera, so it looks the same all loop
    const rig = new THREE.Group();
    scene.add(rig);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(150, 64, 32), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying vec3 vDir;
        void main() {
          float h = vDir.y;
          vec3 col = mix(vec3(0.81, 0.90, 0.96), vec3(0.28, 0.55, 0.92), smoothstep(0.0, 0.7, h));
          col = mix(col, vec3(0.62, 0.78, 0.62), smoothstep(0.0, -0.08, h));
          vec3 sun = normalize(vec3(-0.5, 0.55, -0.65));
          float d = max(dot(vDir, sun), 0.0);
          col += vec3(1.0, 0.9, 0.7) * (smoothstep(0.9993, 0.9996, d) * 4.0 + pow(d, 40.0) * 0.5);
          gl_FragColor = vec4(col, 1.0);
        }`,
    }));
    rig.add(sky);
    const r = rng(226);
    const hillMat = new THREE.MeshStandardMaterial({ color: '#7FB069', roughness: 1, fog: false, flatShading: true });
    for (let k = 0; k < 14; k++) { // a ring of soft hills on the horizon
      const a = k / 14 * TAU + r() * 0.2, h = new THREE.Mesh(new THREE.SphereGeometry(14 + 8 * r(), 12, 8), hillMat);
      h.position.set(Math.cos(a) * 95, -6, Math.sin(a) * 95);
      h.scale.y = 0.45 + 0.35 * r();
      rig.add(h);
    }
    const puff = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 1, emissive: '#C9D8EA', emissiveIntensity: 0.6 });
    for (let k = 0; k < 7; k++) { // clouds: clusters of white balls
      const c = new THREE.Group(), a = k / 7 * TAU + 0.3;
      for (let j = 0; j < 5; j++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(3 + 2 * r(), 20, 14), puff);
        b.position.set((j - 2) * 3.2, r() * 1.5, (r() - 0.5) * 2.5);
        c.add(b);
      }
      c.position.set(Math.cos(a) * 75, 26 + 14 * r(), Math.sin(a) * 75);
      c.lookAt(0, c.position.y, 0);
      rig.add(c);
    }
    const balloons = [];
    const stripes = ['#FF5D73', '#FFC145', '#3FA7D6', '#9B5DE5'];
    for (let k = 0; k < 4; k++) {
      const b = new THREE.Group(), a = k / 4 * TAU + 0.6;
      const env = new THREE.Mesh(new THREE.SphereGeometry(2.2, 32, 24), new THREE.MeshStandardMaterial({ color: stripes[k], roughness: 0.6 }));
      env.scale.y = 1.2;
      const basket = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), new THREE.MeshStandardMaterial({ color: '#8B5A2B' }));
      basket.position.y = -3.3;
      b.add(env, basket);
      b.position.set(Math.cos(a) * 30, 14 + 4 * (k % 2), Math.sin(a) * 30);
      b.userData = { y: b.position.y, ph: k };
      rig.add(b); balloons.push(b);
    }

    scene.add(new THREE.HemisphereLight('#EAF4FF', '#7A9A5A', 1.6));
    const sun = new THREE.DirectionalLight('#FFF0D6', 2.4);
    // the sun stays put in the world (a moving shadow box would make shadow edges crawl) and covers the whole road
    sun.position.set(-15, 30, -32);
    sun.target.position.set(0, 0, -12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    Object.assign(sun.shadow.camera, { left: -75, right: 75, top: 75, bottom: -75, near: 1, far: 160 });
    sun.shadow.bias = -0.0005;
    scene.add(sun, sun.target);

    // the ground and the road ride with the camera (they look the same everywhere); the road's dashes are a texture
    // slid against it, so they stay put in the world
    const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 });
    const grass = new THREE.Mesh(new THREE.CircleGeometry(900, 96), mat('#86C06C'));
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    rig.add(grass);
    const dash = document.createElement('canvas');
    dash.width = 64; dash.height = 128;
    const dg = dash.getContext('2d');
    dg.fillStyle = '#55596A'; dg.fillRect(0, 0, 64, 128);
    dg.fillStyle = '#F6F1DE'; dg.fillRect(30, 0, 4, 64);
    const dashTex = new THREE.CanvasTexture(dash);
    dashTex.colorSpace = THREE.SRGBColorSpace;
    dashTex.wrapT = THREE.RepeatWrapping;
    dashTex.repeat.set(1, 400); // one dash every 2 units along 800 units
    dashTex.anisotropy = 8;
    const road = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 800), new THREE.MeshStandardMaterial({ map: dashTex, roughness: 0.8 }));
    road.rotation.x = -Math.PI / 2; road.position.y = 0.02;
    road.receiveShadow = true;
    rig.add(road);
    for (const x of [-3.3, 3.3]) {
      const walk = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 800), mat('#D8D0C4'));
      walk.position.set(x, 0.06, 0); walk.receiveShadow = true;
      rig.add(walk);
    }

    // houses, trees and lamps: one period of the street, copied every L units; each piece shrinks into the ground
    // as it gets FAR away, so the little world's edge stays tidy and the copies at the ends never show
    const walls = ['#FFE0B5', '#FFC2A8', '#BDE3F5', '#FFE58A', '#D5C5F5', '#B8EBD0'], roofs = ['#E4572E', '#3A86FF', '#2EC4B6', '#FF8C42', '#8E6CDB'];
    const roofGeo = new THREE.CylinderGeometry(0.01, 1, 1, 4, 1);
    roofGeo.rotateY(Math.PI / 4);
    const period = [];
    for (const side of [-1, 1]) for (let k = 0; k < 3; k++) {
      period.push({ kind: 'house', x: side * (8.2 + r() * 0.8), z: k * 8 + r() * 1.5, w: 3.6 + r() * 1.2, h: 2.6 + r() * 2.2, wall: walls[Math.floor(r() * 6)], roof: roofs[Math.floor(r() * 5)] });
      period.push({ kind: 'tree', x: side * (5.2 + r() * 1.2), z: k * 8 + 4 + r(), s: 0.9 + 0.5 * r() });
      period.push({ kind: 'lamp', x: side * 3.9, z: k * 8 + 2 });
    }
    const trunk = mat('#7A5230'), leaf = [mat('#3E8E41'), mat('#5DB35A')], pole = mat('#3A3F55'), glow = new THREE.MeshStandardMaterial({ color: '#FFF4C2', emissive: '#FFE38A', emissiveIntensity: 0.8 });
    const pieces = [];
    const part = (g, geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
    for (let p = -4; p <= 4; p++) for (const o of period) {
      const g = new THREE.Group();
      g.position.set(o.x, 0, p * L + o.z);
      if (o.kind === 'house') {
        part(g, new THREE.BoxGeometry(o.w, o.h, o.w * 0.9), mat(o.wall), 0, o.h / 2, 0);
        part(g, roofGeo, mat(o.roof), 0, o.h + 0.7, 0).scale.set(o.w * 0.78, 1.4, o.w * 0.72);
        part(g, new THREE.BoxGeometry(0.06, 1.5, 0.9), mat('#6B4F3A'), -Math.sign(o.x) * o.w / 2, 0.75, 0);
      } else if (o.kind === 'tree') {
        part(g, new THREE.CylinderGeometry(0.15 * o.s, 0.2 * o.s, 1.6 * o.s, 10), trunk, 0, 0.8 * o.s, 0);
        part(g, new THREE.SphereGeometry(1.1 * o.s, 20, 14), leaf[(p + 10) % 2], 0, 2.2 * o.s, 0);
      } else {
        part(g, new THREE.CylinderGeometry(0.06, 0.08, 3.2, 10), pole, 0, 1.6, 0);
        part(g, new THREE.SphereGeometry(0.22, 16, 12), glow, 0, 3.3, 0);
      }
      scene.add(g);
      pieces.push(g);
    }

    const cubeRT = new THREE.WebGLCubeRenderTarget(1536, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    const cubeCam = new THREE.CubeCamera(0.1, 400, cubeRT);
    scene.add(cubeCam);

    const screen = new THREE.Scene(), flatCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const uniforms = { tCube: { value: cubeRT.texture }, uCenter: { value: new THREE.Vector2(540, 1920 - 1060) }, uSpin: { value: 0 } };
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms, fragmentShader, depthTest: false,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    }));
    quad.frustumCulled = false;
    screen.add(quad);

    return {
      scene, camera: flatCam,
      render(t) {
        const z = -t / 5 * L; // one repeat of the street per loop
        rig.position.set(0, 0, z);
        cubeCam.position.set(0, EYE, z);
        dashTex.offset.y = -z / 2;
        for (const g of pieces) g.scale.setScalar(Math.max(1e-3, smoothstep(FAR, FAR - 16, Math.abs(g.position.z - z))));
        balloons.forEach(b => { b.position.y = b.userData.y + 0.8 * Math.sin(t / 5 * TAU + b.userData.ph); });
        uniforms.uSpin.value = 0.18 * Math.sin(t / 5 * TAU); // the little world sways a little
        cubeCam.update(renderer, scene);
        renderer.setRenderTarget(null);
        renderer.render(screen, flatCam);
      },
    };
  },
};
