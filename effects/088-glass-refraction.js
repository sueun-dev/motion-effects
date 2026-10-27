// Glass refraction: MeshPhysicalMaterial with full transmission (three renders the scene behind into a texture and
// bends it through the thickness, with dispersion) over a bold striped backdrop; a room environment gives the reflections.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TAU, phase, FONT } from '../lib/util.js';

export default {
  name: 'Glass Refraction',
  ko: '유리 굴절',
  three(renderer, W, H) {
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas'); bg.width = W; bg.height = H;
    const b = bg.getContext('2d'), cols = ['#FF4D6D', '#FFB703', '#06D6A0', '#118AB2', '#7B2CBF', '#F8F4EC'];
    for (let i = 0; i < 18; i++) { b.fillStyle = cols[i % cols.length]; b.fillRect(i * 60, 0, 60, H); } // bold stripes
    b.fillStyle = '#14121F'; b.fillRect(0, 820, W, 280);
    b.fillStyle = '#F8F4EC'; b.font = `900 190px ${FONT.black}`; b.textAlign = 'center'; b.textBaseline = 'middle';
    b.fillText('GLASS', W / 2, 966);
    scene.background = new THREE.CanvasTexture(bg); scene.background.colorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    renderer.toneMapping = THREE.NoToneMapping;

    const camera = new THREE.PerspectiveCamera(35, W / H, 0.1, 100);
    camera.position.set(0, 0, 16);
    const glass = new THREE.MeshPhysicalMaterial({
      color: '#FFFFFF', transmission: 1, roughness: 0.02, thickness: 1.6, ior: 1.5, dispersion: 3,
      specularIntensity: 1, envMapIntensity: 1.2, clearcoat: 1, clearcoatRoughness: 0.05,
    });
    const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(1.05, 0.42, 220, 40), glass);
    const cube = new THREE.Mesh(new RoundedBoxGeometry(1.5, 1.5, 1.5, 6, 0.28), glass);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.85, 64, 32), glass);
    knot.position.y = 0; cube.position.set(-0.9, 2.75, -0.6); ball.position.set(1.0, -3.0, 0.4);
    scene.add(knot, cube, ball);

    return {
      scene, camera,
      update(t) {
        const a = phase(t) * TAU;
        knot.rotation.set(0.5 + 0.25 * Math.sin(a), a, 0);
        cube.rotation.set(a, a + 0.6, 0.3);
        cube.position.y = 2.75 + 0.15 * Math.sin(a);
        ball.position.x = 1.0 + 0.5 * Math.sin(a + 1);
      },
    };
  },
};
