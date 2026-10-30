// Area lights: three tall neon panels (RectAreaLight, lit with linearly transformed cosines) circle a glossy sphere,
// a ring and a block on a dark lacquer floor. Unlike point lights they give long, soft-edged reflections that
// keep the shape of the panel, stretched across the floor and wrapped around the curved objects.
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TAU, phase } from '../lib/util.js';

// colour, centre angle (0 = straight behind the sphere), orbit radius, height, phase of the sweep
const PANELS = [['#FF2E7E', -1.1, 3.3, 2.6, 0], ['#22D8FF', 0.0, 4.2, 2.9, 2.1], ['#FFA62B', 1.1, 3.75, 2.5, 4.2]];

export default {
  name: 'Area Lights',
  ko: '면 광원',
  three(renderer, W, H) {
    RectAreaLightUniformsLib.init();
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#06060B');
    scene.fog = new THREE.Fog('#06060B', 17, 34); // the floor fades into the backdrop, no hard horizon

    const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 100);
    camera.position.set(0, 3.4, 13.5);
    camera.lookAt(0, 1.75, 0);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60),
      new THREE.MeshStandardMaterial({ color: '#16161E', roughness: 0.16, metalness: 0.2 }));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor, new THREE.HemisphereLight('#3A3F66', '#000000', 0.35)); // a faint sky, so the dark sides keep their form

    const white = new THREE.MeshStandardMaterial({ color: '#F2F0EC', roughness: 0.12, metalness: 0 });
    const steel = new THREE.MeshStandardMaterial({ color: '#C9CCD6', roughness: 0.22, metalness: 1 });
    const ink = new THREE.MeshStandardMaterial({ color: '#2A2C3A', roughness: 0.3, metalness: 0.1 });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1.05, 128, 64), white);
    ball.position.set(0.15, 1.05, 0.9);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.24, 64, 160), steel);
    ring.position.set(1.15, 1.09, -1.1);
    ring.rotation.y = -0.55;
    const block = new THREE.Mesh(new RoundedBoxGeometry(1.0, 3.0, 1.0, 6, 0.16), ink);
    block.position.set(-1.2, 1.5, -0.9);
    block.rotation.y = 0.45;
    scene.add(ball, ring, block);

    // each panel = a RectAreaLight plus a visible plane of the same size and colour
    const panels = PANELS.map(([color, c, r, y, p]) => {
      const light = new THREE.RectAreaLight(color, 12, 0.45, 4.4);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 4.4), // drawn without tone mapping, so it stays saturated
        new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, toneMapped: false }));
      light.add(face);
      scene.add(light);
      return { light, c, r, y, p };
    });

    return {
      scene, camera,
      update(t) {
        const a = phase(t) * TAU;
        for (const { light, c, r, y, p } of panels) {
          // the three sweep together as a fan round the back; past the sides the path bends forward (out of frame),
          // so one panel is always out at a side lighting the fronts
          const q = c + 0.95 * Math.sin(a) + 0.2 * Math.sin(2 * a + p), h = y + 0.25 * Math.sin(2 * a + p);
          light.position.set(r * Math.sin(q), h, -r * Math.cos(q) + 1.4 * (1 - Math.cos(q)));
          light.lookAt(0, h, 0); // stays upright, facing the centre
        }
      },
    };
  },
};
