// Anisotropic metal: MeshPhysicalMaterial with `anisotropy`, so the roughness is high along one direction and low
// across it and highlights stretch into streaks. On the spun discs and knob tops an anisotropyMap points that direction
// outwards from the centre (lathe grooves run round), so each light makes a radial bar through the middle that turns
// like a clock hand as the light circles; the brushed plate below stretches the same lights into long sideways streaks.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TAU, phase } from '../lib/util.js';

// anisotropy direction map: RG = direction in uv space (here outwards from the centre), B = strength
function radialMap(size) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x + 0.5) / size - 0.5, dy = (y + 0.5) / size - 0.5, l = Math.hypot(dx, dy) || 1, i = (y * size + x) * 4;
    data[i] = (dx / l * 0.5 + 0.5) * 255; data[i + 1] = (dy / l * 0.5 + 0.5) * 255;
    data[i + 2] = 255 * Math.min(1, l * 40); data[i + 3] = 255;   // fades out at the very centre
  }
  const t = new THREE.DataTexture(data, size, size);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

// fine concentric lathe rings as a roughness map (fixed, a few pixels apart on screen)
function ringMap(size, rings) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.hypot((x + 0.5) / size - 0.5, (y + 0.5) / size - 0.5) * 2, i = (y * size + x) * 4;
    const v = 205 + 28 * Math.sin(r * rings * TAU) + 12 * Math.sin(r * rings * 0.37 * TAU);
    data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

export default {
  name: 'Anisotropic Metal',
  ko: '이방성 금속',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#07080B');
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.1;

    const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 100);
    camera.position.set(0, 10.6, 6.6);
    camera.lookAt(0, 0, 0.05);

    const radial = radialMap(512), rings = ringMap(1024, 90);
    const spun = new THREE.MeshPhysicalMaterial({
      color: '#E4E7EC', metalness: 1, roughness: 0.32, roughnessMap: rings, anisotropy: 0.95, anisotropyMap: radial,
    });
    const side = new THREE.MeshPhysicalMaterial({ color: '#9EA3AB', metalness: 1, roughness: 0.36, anisotropy: 0.9, anisotropyRotation: Math.PI / 2 });
    // brushed plate: straight brushing, highlights stretch along x
    const plate = new THREE.Mesh(new THREE.BoxGeometry(9, 0.2, 16), new THREE.MeshPhysicalMaterial({
      color: '#7D838C', metalness: 1, roughness: 0.38, anisotropy: 0.92, anisotropyRotation: 0,
    }));
    plate.position.y = -0.1;
    scene.add(plate);

    // a spun disc / knob: open cylinder side plus a circle on top that carries the radial anisotropy
    const knob = (r, h, x, z) => {
      const g = new THREE.Group();
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.02, h, 128, 1, true), side);
      wall.position.y = h / 2;
      const top = new THREE.Mesh(new THREE.CircleGeometry(r, 128), spun);
      top.rotation.x = -Math.PI / 2;
      top.position.y = h;
      g.add(wall, top);
      g.position.set(x, 0, z);
      scene.add(g);
    };
    knob(1.55, 0.16, 0, -1.25);   // the big platter
    knob(0.62, 0.5, -1.05, 1.55);
    knob(0.46, 0.36, 1.05, 1.95);
    knob(0.32, 0.26, 1.55, 0.75);

    // three small lamps circling low over the metal, each drawn as a glowing bead
    const lamps = ['#FFD9A8', '#A8D4FF', '#FFFFFF'].map(c => {
      const l = new THREE.PointLight(c, 9, 0, 2);
      l.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 24, 12), new THREE.MeshBasicMaterial({ color: c })));
      scene.add(l);
      return l;
    });

    return {
      scene, camera,
      update(t) {
        const a = phase(t) * TAU;
        lamps.forEach((l, i) => {
          const q = a + i * TAU / 3;
          l.position.set(2.0 * Math.cos(q), 0.85 + 0.2 * Math.sin(2 * q), 0.55 + 2.2 * Math.sin(q));
        });
      },
    };
  },
};
