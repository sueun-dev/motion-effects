// A flag on a pole: a finely divided plane whose vertices ride travelling sine waves that grow toward the free
// edge (wave speeds are whole cycles per 5 s); normals are recomputed every frame so the folds catch the light.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TAU, phase, rng } from '../lib/util.js';

const FW = 7.6, FH = 5.0; // flag size

function flagTexture() {
  const c = document.createElement('canvas');
  c.width = 1216; c.height = 800;
  const g = c.getContext('2d');
  g.fillStyle = '#FF6B5A'; g.fillRect(0, 0, 1216, 800);
  g.fillStyle = '#FFF1DC'; // polka dots: they show every fold of the cloth
  for (let row = 0; row < 7; row++) {
    for (let col = -1; col < 12; col++) {
      g.beginPath(); g.arc(60 + col * 110 + (row % 2) * 55, 58 + row * 114, 30, 0, TAU); g.fill();
    }
  }
  g.fillStyle = '#FFC94A'; g.fillRect(0, 0, 1216, 26); g.fillRect(0, 774, 1216, 26);
  const r = rng(5); // a few soft slubs in the weave, fixed to the cloth
  g.globalAlpha = 0.05; g.fillStyle = '#000';
  for (let i = 0; i < 160; i++) g.fillRect(r() * 1216, r() * 800, 60 + r() * 100, 6);
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 540; c.height = 960;
  const g = c.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 960);
  grd.addColorStop(0, '#4E8FE0'); grd.addColorStop(0.7, '#A9D3F5'); grd.addColorStop(1, '#E9F4FB');
  g.fillStyle = grd; g.fillRect(0, 0, 540, 960);
  g.fillStyle = 'rgba(255, 255, 255, 0.75)';
  g.filter = 'blur(8px)';
  for (const [x, y, s] of [[110, 260, 1], [430, 520, 0.8], [180, 760, 1.2]]) { // soft clouds
    for (const [dx, dy, rr] of [[0, 0, 40], [45, -18, 50], [95, 0, 38], [48, 14, 44]]) {
      g.beginPath(); g.ellipse(x + dx * s, y + dy * s, rr * s * 1.3, rr * s, 0, 0, TAU); g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default {
  name: 'Cloth Wave',
  ko: '깃발 물결',
  three(renderer, W, H) {
    const scene = new THREE.Scene();
    scene.background = skyTexture();
    const camera = new THREE.PerspectiveCamera(34, W / H, 0.5, 100);
    camera.position.set(9, -1.2, 24);
    camera.lookAt(0.2, 2.3, 0);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.3;
    scene.add(new THREE.HemisphereLight('#FFFFFF', '#8FA4C0', 0.6));
    const sun = new THREE.DirectionalLight('#FFF5E6', 3.6);
    sun.position.set(-9, 5, 6);
    scene.add(sun);

    const geo = new THREE.PlaneGeometry(FW, FH, 120, 80);
    geo.translate(FW / 2, 0, 0);
    const base = geo.attributes.position.array.slice();
    const flag = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: flagTexture(), side: THREE.DoubleSide, roughness: 0.85 }));
    const x0 = -FW / 2 + 0.1, y0 = 2.6;
    flag.position.set(x0, y0, 0);
    scene.add(flag);

    const metal = new THREE.MeshStandardMaterial({ color: '#D8DDE6', metalness: 0.7, roughness: 0.3 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 30, 24), metal);
    pole.position.set(x0 - 0.12, y0 + FH / 2 + 0.3 - 15, 0);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 16), new THREE.MeshStandardMaterial({ color: '#F2B632', metalness: 0.8, roughness: 0.25 }));
    knob.position.set(x0 - 0.12, y0 + FH / 2 + 0.55, 0);
    scene.add(pole, knob);

    const pos = geo.attributes.position;
    return {
      scene, camera,
      update(t) {
        const a = phase(t) * TAU;
        for (let i = 0; i < pos.count; i++) {
          const x = base[i * 3], y = base[i * 3 + 1], u = x / FW; // u: 0 at the pole, 1 at the free edge
          const amp = 0.12 + 0.88 * Math.pow(u, 1.2);
          const z = amp * (1.25 * Math.sin(1.05 * x - 4 * a + 0.25 * y)
            + 0.42 * Math.sin(2.2 * x - 6 * a + 0.5 * y + 1.3));
          const sway = amp * (0.18 * Math.sin(1.25 * x - 4 * a + 1.2) + 0.08 * Math.sin(3 * a + y));
          pos.setXYZ(i, x - 0.25 * amp * amp - 0.06 * amp * Math.cos(2.2 * x - 8 * a + y), y - 0.22 * u * u + sway, z);
        }
        pos.needsUpdate = true;
        geo.computeVertexNormals();
      },
    };
  },
};
