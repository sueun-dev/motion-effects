// 3D extruded type: TextGeometry (helvetiker bold) pulled into depth with a rounded bevel, glossy faces and
// darker sides, lit by a room environment and a warm key light; it swings side to side on the loop.
import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TAU, phase } from '../lib/util.js';

export default {
  name: '3D Extruded Text',
  ko: '3D 돌출 텍스트',
  async three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    const sky = document.createElement('canvas');
    sky.width = 2; sky.height = 512;
    const g = sky.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#2A1B55'); grd.addColorStop(0.6, '#6B3FA0'); grd.addColorStop(1, '#F29BB3');
    g.fillStyle = grd; g.fillRect(0, 0, 2, 512);
    scene.background = new THREE.CanvasTexture(sky);
    scene.background.colorSpace = THREE.SRGBColorSpace;
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.7;

    const camera = new THREE.PerspectiveCamera(32, W / H, 0.1, 100);
    camera.position.set(0, 1.8, 20);
    camera.lookAt(0, 0.5, 0);

    const key = new THREE.DirectionalLight('#FFE6C8', 3.2);
    key.position.set(-6, 9, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
    key.shadow.radius = 6;
    scene.add(key);
    const rim = new THREE.DirectionalLight('#7FD8FF', 2.2);
    rim.position.set(7, 2, -6);
    scene.add(rim);

    // only shadows show on the floor (ShadowMaterial), so the background gradient stays clean
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.28 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -3.4;
    floor.receiveShadow = true;
    scene.add(floor);

    const font = await new FontLoader().loadAsync('/node_modules/three/examples/fonts/helvetiker_bold.typeface.json');
    const word = (text, size, depth, faceColor, sideColor, y) => {
      const geo = new TextGeometry(text, { font, size, depth, curveSegments: 18, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.06, bevelSegments: 6 });
      geo.center();
      const face = new THREE.MeshPhysicalMaterial({ color: faceColor, roughness: 0.22, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.15 });
      const side = new THREE.MeshStandardMaterial({ color: sideColor, roughness: 0.35, metalness: 0.25 });
      const m = new THREE.Mesh(geo, [face, side]);
      m.position.y = y;
      m.castShadow = true;
      return m;
    };
    const group = new THREE.Group();
    group.add(word('3D', 2.9, 1.3, '#FFD166', '#E2557A', 0.9));
    group.add(word('TYPE', 1.15, 0.55, '#FFFFFF', '#5B6CFF', -1.8));
    scene.add(group);

    return {
      scene, camera,
      update(t) {
        const a = phase(t) * TAU;
        group.rotation.y = 0.75 * Math.sin(a);     // swing side to side, so the words never read backwards
        group.rotation.x = 0.12 * Math.sin(2 * a); // with a gentle nod
        group.position.y = 0.15 * Math.sin(2 * a);
      },
    };
  },
};
