// Pin art: 1,200 metal pins (one InstancedMesh) slide up through a board to follow a height field: ripples
// spreading from the middle, then a heart pressed up from below (a blurred canvas drawing used as a height map).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TAU, phase, smoothstep } from '../lib/util.js';

const NX = 30, NZ = 40, STEP = 0.22;

// a soft heart, NX x NZ values 0..1
function heartMap() {
  const c = document.createElement('canvas');
  c.width = NX * 4; c.height = NZ * 4;
  const g = c.getContext('2d');
  g.filter = 'blur(5px)';
  g.fillStyle = '#FFF';
  g.translate(c.width / 2, c.height * 0.53); g.scale(1.95, 1.95);
  g.beginPath();
  g.moveTo(0, 18);
  g.bezierCurveTo(-30, -2, -26, -26, -12, -26);
  g.bezierCurveTo(-4, -26, 0, -19, 0, -14);
  g.bezierCurveTo(0, -19, 4, -26, 12, -26);
  g.bezierCurveTo(26, -26, 30, -2, 0, 18);
  g.fill();
  const px = g.getImageData(0, 0, c.width, c.height).data, out = new Float32Array(NX * NZ);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) out[j * NX + i] = px[((j * 4 + 2) * c.width + i * 4 + 2) * 4] / 255;
  return out;
}

export default {
  name: 'Pin Art',
  ko: '핀 아트',
  three(renderer, W, H) {
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas');
    bg.width = 4; bg.height = 256;
    const bgc = bg.getContext('2d'), grd = bgc.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#1B2340'); grd.addColorStop(1, '#3B2F55');
    bgc.fillStyle = grd; bgc.fillRect(0, 0, 4, 256);
    scene.background = new THREE.CanvasTexture(bg);
    scene.background.colorSpace = THREE.SRGBColorSpace;
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.8;
    const key = new THREE.DirectionalLight('#FFF3E0', 2.2);
    key.position.set(-4, 8, 3);
    scene.add(key, new THREE.HemisphereLight('#C8D4FF', '#2A2440', 0.6));

    const camera = new THREE.PerspectiveCamera(36, W / H, 0.5, 80);
    camera.position.set(0, 17.5, 15.5);
    camera.lookAt(0, 0.2, 0.2);

    const board = new THREE.Mesh(new THREE.BoxGeometry(NX * STEP + 0.6, 2.6, NZ * STEP + 0.6), new THREE.MeshStandardMaterial({ color: '#16142A', roughness: 0.8 }));
    board.position.y = -1.3; // top face at y = 0; the hidden ends of the pins sit inside it
    scene.add(board);

    const geo = new THREE.CapsuleGeometry(0.075, 2.2, 4, 12);
    geo.translate(0, -1.175, 0); // the tip of the pin is at its local origin
    const pins = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: '#FFFFFF', metalness: 0.5, roughness: 0.45 }), NX * NZ);
    scene.add(pins);

    const heart = heartMap(), m = new THREE.Matrix4(), col = new THREE.Color(), low = new THREE.Color('#6F7BA0'), high = new THREE.Color('#FFD9A0');
    return {
      scene, camera,
      update(t) {
        const a = phase(t) * TAU;
        const show = smoothstep(1.3, 2.1, t) - smoothstep(3.5, 4.3, t); // 0: ripples, 1: heart
        for (let j = 0; j < NZ; j++) {
          for (let i = 0; i < NX; i++) {
            const x = (i - (NX - 1) / 2) * STEP, z = (j - (NZ - 1) / 2) * STEP, r = Math.hypot(x, z);
            const ripple = 0.42 + 0.38 * Math.sin(2.0 * r - 3 * a) * Math.exp(-r * 0.1);
            const hh = heart[j * NX + i] * (1.35 + 0.08 * Math.sin(2 * a)) + 0.05 * Math.sin(2.0 * r - 3 * a);
            const h = 0.06 + (1 - show) * ripple + show * hh;
            m.makeTranslation(x, h, z);
            pins.setMatrixAt(j * NX + i, m);
            pins.setColorAt(j * NX + i, col.copy(low).lerp(high, Math.min(1, h / 1.3)));
          }
        }
        pins.instanceMatrix.needsUpdate = true;
        pins.instanceColor.needsUpdate = true;
      },
    };
  },
};
