// Fresnel rim (x-ray / hologram): a ShaderMaterial whose brightness is (1 − |N·V|)^p, added on top of the scene, so
// surfaces seen edge-on glow and surfaces facing you vanish. A white ceramic pod is cut by a scan plane that sweeps
// down and back up: above it the pod is solid (clipping planes), below it the same pod is drawn in Fresnel x-ray and
// shows what is inside, a spinning knot and three orbiting beads. A cyan ring marks the cut.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TAU, phase, canvas } from '../lib/util.js';

const xray = (color, power, gain, plane) => new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color(color) }, uPow: { value: power }, uGain: { value: gain } },
  vertexShader: `
    #include <clipping_planes_pars_vertex>
    varying vec3 vN; varying vec3 vV; varying float vY;
    void main() {
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal); vV = normalize(-mvPosition.xyz); vY = (modelMatrix * vec4(position, 1.0)).y;
      gl_Position = projectionMatrix * mvPosition;
      #include <clipping_planes_vertex>
    }`,
  fragmentShader: `
    #include <clipping_planes_pars_fragment>
    uniform vec3 uColor; uniform float uPow, uGain;
    varying vec3 vN; varying vec3 vV; varying float vY;
    void main() {
      #include <clipping_planes_fragment>
      float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPow);
      float lines = 0.92 + 0.08 * sin(vY * 160.0);              // faint hologram lines, fixed in the world
      gl_FragColor = vec4(uColor * (f * uGain + 0.025) * lines, 1.0);
    }`,
  clipping: true, clippingPlanes: [plane], transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
});

export default {
  name: 'Fresnel Rim',
  ko: '프레넬 림',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.localClippingEnabled = true;
    const scene = new THREE.Scene();
    const bg = canvas(W / 4, H / 4), b = bg.getContext('2d');
    const grd = b.createRadialGradient(W / 8, H / 8 * 1.05, 10, W / 8, H / 8, H / 6);
    grd.addColorStop(0, '#12233A'); grd.addColorStop(1, '#03060C');
    b.fillStyle = grd; b.fillRect(0, 0, W / 4, H / 4);
    scene.background = new THREE.CanvasTexture(bg);
    scene.background.colorSpace = THREE.SRGBColorSpace;
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.8;

    const camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 100);
    camera.position.set(0, 2.2, 10.5);
    camera.lookAt(0, 0.05, 0);

    // the cut: solid keeps y > h, x-ray keeps y < h
    const above = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), below = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);

    // the pod: a lathe profile, an egg (wider below) with three raised bands
    const band = (y, c) => 0.04 * Math.exp(-(((y - c) / 0.06) ** 2));
    const R = y => 1.18 * Math.sqrt(Math.max(0, 1 - (y / 1.9) ** 2)) * (1 - 0.1 * y / 1.9) + band(y, 0.75) + band(y, -0.1) + band(y, -0.95);
    const prof = [];
    for (let k = 0; k <= 200; k++) { const y = -1.9 + 3.8 * k / 200; prof.push(new THREE.Vector2(Math.max(R(y), 0.001), y)); }
    const podGeo = new THREE.LatheGeometry(prof, 160);
    const solid = new THREE.MeshPhysicalMaterial({ color: '#F4F1EC', roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08, clippingPlanes: [above], side: THREE.DoubleSide });
    const pod = new THREE.Group();
    pod.add(new THREE.Mesh(podGeo, solid), new THREE.Mesh(podGeo, xray('#38D9FF', 4.0, 2.4, below)));
    // inside: a torus knot, a core and three beads, only ever drawn in x-ray
    const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.62, 0.17, 300, 40, 2, 3), xray('#FF4FD8', 1.6, 1.5, below));
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.24, 64, 32), xray('#FFE36E', 1.5, 1.6, below));
    const beads = [0, 1, 2].map(() => new THREE.Mesh(new THREE.SphereGeometry(0.11, 48, 24), xray('#9CFFB5', 1.4, 1.8, below)));
    pod.add(knot, core, ...beads);
    scene.add(pod);

    // the scan ring and a faint laser sheet at the cut
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.018, 16, 200), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.2, 3) }));
    ring.rotation.x = Math.PI / 2;
    const sheetTex = (() => {
      const c = canvas(256, 256), g = c.getContext('2d'), r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      r.addColorStop(0, 'rgba(80, 220, 255, 0.35)'); r.addColorStop(0.55, 'rgba(80, 220, 255, 0.12)'); r.addColorStop(1, 'rgba(80, 220, 255, 0)');
      g.fillStyle = r; g.fillRect(0, 0, 256, 256);
      return new THREE.CanvasTexture(c);
    })();
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), new THREE.MeshBasicMaterial({
      map: sheetTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    sheet.rotation.x = -Math.PI / 2;
    scene.add(ring, sheet);

    // a dark plinth with a glowing rim
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.42, 0.24, 128),
      new THREE.MeshStandardMaterial({ color: '#0B1118', roughness: 0.6, metalness: 0.3, envMap: scene.environment, envMapIntensity: 0.12 }));
    plinth.position.y = -2.12;
    const glow = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.018, 12, 200), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.2, 1.8) }));
    glow.rotation.x = Math.PI / 2; glow.position.y = -2.0;
    scene.add(plinth, glow);
    const key = new THREE.DirectionalLight('#FFFFFF', 1.6);
    key.position.set(-4, 6, 6);
    scene.add(key);

    return {
      scene, camera,
      update(t) {
        const a = phase(t) * TAU;
        const h = 2.05 - 4.1 * (0.5 - 0.5 * Math.cos(a));                // cut from the top to the bottom and back: x-ray, solid, x-ray
        above.constant = -h; below.constant = h;
        ring.position.y = sheet.position.y = h;
        const r = Math.abs(h) < 1.9 ? R(h) : 0.001;
        ring.scale.set(r + 0.01, r + 0.01, 1);
        ring.visible = sheet.visible = r > 0.01;
        sheet.scale.setScalar(0.4 + r * 0.6);
        knot.rotation.set(0.4, a, 0.2 * Math.sin(a));
        beads.forEach((m, i) => {
          const q = a * (i === 1 ? -1 : 1) + i * TAU / 3;
          m.position.set(0.95 * Math.cos(q), 0.55 * Math.sin(q + i), 0.95 * Math.sin(q));
        });
      },
    };
  },
};
