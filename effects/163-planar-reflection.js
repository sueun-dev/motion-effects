// Planar reflection: the ground is a three.js Reflector. Every frame it renders the scene a second time from a camera
// mirrored below the plane (clipped at the plane) into a texture, and the floor shows that texture through the
// projected screen coordinates, so the arch, cube, spheres and sunset sky are doubled in a still salt-flat mirror.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TAU, phase } from '../lib/util.js';

// the floor shader: the mirrored image, darker where we look straight down (like water), brighter toward the horizon
const MirrorShader = {
  uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null } },
  vertexShader: `
    uniform mat4 textureMatrix;
    varying vec4 vUv; varying vec3 vWorld;
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform vec3 color; uniform sampler2D tDiffuse;
    varying vec4 vUv; varying vec3 vWorld;
    void main() {
      vec3 refl = texture2DProj(tDiffuse, vUv).rgb;
      vec3 v = normalize(cameraPosition - vWorld);
      float fres = 0.42 + 0.53 * pow(1.0 - v.y, 4.0);
      gl_FragColor = vec4(refl * color * fres + vec3(0.012, 0.01, 0.03), 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

export default {
  name: 'Planar Reflection',
  ko: '평면 반사',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.45;

    // sunset sky dome (a real mesh, so the mirror camera sees it flipped the right way)
    const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 64, 32), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vD; void main() { vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying vec3 vD;
        void main() {
          float y = max(vD.y, 0.0);
          vec3 c = mix(vec3(1.0, 0.55, 0.28), vec3(0.85, 0.25, 0.42), smoothstep(0.0, 0.12, y));
          c = mix(c, vec3(0.30, 0.12, 0.42), smoothstep(0.1, 0.32, y));
          c = mix(c, vec3(0.06, 0.05, 0.20), smoothstep(0.3, 0.75, y));
          float sun = max(dot(vD, normalize(vec3(0.0, 0.06, -1.0))), 0.0);
          c += vec3(1.0, 0.62, 0.32) * (pow(sun, 900.0) * 3.0 + pow(sun, 40.0) * 0.5);   // low sun and its glow
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    scene.add(sky);

    const camera = new THREE.PerspectiveCamera(35, W / H, 0.1, 200);

    const sun = new THREE.DirectionalLight('#FFB98A', 2.6);
    sun.position.set(0, 1.5, -10);
    scene.add(sun, new THREE.HemisphereLight('#B89BFF', '#40204A', 0.7));
    const front = new THREE.DirectionalLight('#9FB4FF', 0.6);
    front.position.set(3, 4, 8);
    scene.add(front);

    const mirror = new Reflector(new THREE.PlaneGeometry(160, 160), {    // smaller than the sky dome, so its edge never shows
      textureWidth: W, textureHeight: H, color: 0xE6E0F0, clipBias: 0.003, shader: MirrorShader,
    });
    mirror.rotation.x = -Math.PI / 2;
    scene.add(mirror);

    const mat = (color, rough = 0.3, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.2, 48, 160), mat('#FFE3D3', 0.25));
    arch.position.set(0, 2.05, -3.2);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.62, 64, 48), mat('#7C6CFF', 0.18, 0.2));
    ball.position.set(-1.25, 0.62, -0.9);                       // resting on the mirror: it touches its reflection
    const cube = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.85), mat('#FF7A8A', 0.35));
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.3, 64), mat('#FFC46B', 0.4));
    cone.position.set(1.35, 0.65, -0.2);
    const orbs = [0, 1, 2].map(i => {
      const o = new THREE.Mesh(new THREE.SphereGeometry(0.12, 32, 24), new THREE.MeshStandardMaterial({ color: '#FFE2B8', emissive: '#FFB36B', emissiveIntensity: 3.0 }));
      scene.add(o);
      return o;
    });
    scene.add(arch, ball, cube, cone);

    return {
      scene, camera,
      update(t) {
        const a = phase(t) * TAU;
        camera.position.set(1.3 * Math.sin(a), 0.85 + 0.1 * Math.sin(2 * a), 16.5);   // a slow sideways drift, low over the mirror
        camera.lookAt(0, 1.55, -1.5);
        arch.rotation.y = 0.45 * Math.sin(a);
        cube.position.set(0.55, 1.75 + 0.22 * Math.sin(a + 1), 0.4);
        cube.rotation.set(0.6 + a, a, 0.4);
        orbs.forEach((o, i) => {
          const b = a + i * TAU / 3;
          o.position.set(1.9 * Math.cos(b), 2.05 + 0.35 * Math.sin(2 * b), -3.2 + 0.9 * Math.sin(b));
        });
      },
    };
  },
};
