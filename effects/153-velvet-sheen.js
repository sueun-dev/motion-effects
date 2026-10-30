// Velvet sheen: MeshPhysicalMaterial with `sheen` (the Charlie sheen lobe): a dark, fully rough base plus a soft,
// lighter lobe that grows towards grazing angles, so velvet glows along every rounded edge and silhouette and stays deep
// where it faces you. An emerald armchair, a sapphire cushion and a mustard pouf, with a faint crushed-velvet normal map;
// a warm key light circles the room and the camera drifts, so the sheen slides along the edges.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TAU, phase, rng } from '../lib/util.js';

// crushed velvet: a tileable height field of 24 overlapping waves (whole-number frequencies) turned into a normal map
function crushed(size) {
  const r = rng(153), waves = Array.from({ length: 24 }, () => [Math.round(2 + r() * 6) * (r() < 0.5 ? -1 : 1), Math.round(r() * 7), r() * TAU, 0.4 + r()]);
  const h = (x, y) => waves.reduce((s, [fx, fy, p, a]) => s + a * Math.sin(TAU * (fx * x + fy * y) / size + p), 0);
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sx = (h(x + 1, y) - h(x - 1, y)) / 2, sy = (h(x, y + 1) - h(x, y - 1)) / 2;
    const n = new THREE.Vector3(-sx * 0.15, -sy * 0.15, 1).normalize(), i = (y * size + x) * 4;
    data[i] = (n.x * 0.5 + 0.5) * 255; data[i + 1] = (n.y * 0.5 + 0.5) * 255; data[i + 2] = (n.z * 0.5 + 0.5) * 255; data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

export default {
  name: 'Velvet Sheen',
  ko: '벨벳 광택',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0D0B0A');
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.3;

    const nap = crushed(256);
    const velvet = (color, sheenColor) => new THREE.MeshPhysicalMaterial({
      color, roughness: 1, metalness: 0, sheen: 1, sheenColor, sheenRoughness: 0.38, normalMap: nap, normalScale: new THREE.Vector2(0.6, 0.6), dithering: true,
    });
    const emerald = velvet('#032A19', '#A6FFE0'), sapphire = velvet('#08113D', '#BCCDFF'), mustard = velvet('#3D2404', '#FFDF9C');

    // room: a dark wall and a dark wooden floor (their own, dimmer reflections)
    const room = (color, roughness) => new THREE.MeshStandardMaterial({ color, roughness, envMap: scene.environment, envMapIntensity: 0.1, dithering: true });
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 12), room('#2A2724', 0.95));
    wall.position.set(0, 6, -2.2);
    wall.receiveShadow = true;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), room('#1C120C', 0.7));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(wall, floor);

    const part = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
      m.castShadow = m.receiveShadow = true;
      return m;
    };
    // the armchair, built from rounded boxes; the seat cushion is puffed up in the middle
    const seat = new RoundedBoxGeometry(1.42, 0.3, 1.36, 8, 0.14);
    const sp = seat.attributes.position;
    for (let i = 0; i < sp.count; i++) {
      const x = sp.getX(i) / 0.71, z = sp.getZ(i) / 0.68;
      if (sp.getY(i) > 0) sp.setY(i, sp.getY(i) + 0.08 * Math.max(0, 1 - x * x) * Math.max(0, 1 - z * z));
    }
    seat.computeVertexNormals();
    const chair = new THREE.Group();
    chair.add(
      part(new RoundedBoxGeometry(2.0, 0.5, 1.8, 6, 0.12), emerald, 0, 0.45, 0),
      part(seat, emerald, 0, 0.85, 0.12),
      part(new RoundedBoxGeometry(2.0, 1.3, 0.42, 6, 0.2), emerald, 0, 1.25, -0.72, -0.1),
      part(new RoundedBoxGeometry(0.32, 0.78, 1.78, 6, 0.15), emerald, -0.86, 0.86, 0),
      part(new RoundedBoxGeometry(0.32, 0.78, 1.78, 6, 0.15), emerald, 0.86, 0.86, 0),
      part(new RoundedBoxGeometry(0.72, 0.62, 0.22, 6, 0.1), sapphire, 0.28, 1.28, -0.36, -0.25, -0.35, 0.18),
    );
    const wood = new THREE.MeshStandardMaterial({ color: '#3B2414', roughness: 0.45 });
    for (const x of [-0.85, 0.85]) for (const z of [-0.75, 0.75]) chair.add(part(new THREE.CylinderGeometry(0.05, 0.035, 0.22, 16), wood, x, 0.11, z));
    chair.rotation.y = 0.35;
    scene.add(chair);

    // a round pouf: a lathe profile with soft rolled edges
    const prof = [];
    for (let k = 0; k < 12; k++) prof.push(new THREE.Vector2(0.001 + 0.48 * k / 12, 0.03 * (1 - (k / 12) ** 2)));      // underside
    for (let k = 0; k <= 30; k++) {
      const a = -Math.PI / 2 + k / 30 * Math.PI;
      prof.push(new THREE.Vector2(0.48 + 0.16 * Math.cos(a) ** 0.6, 0.27 + 0.27 * Math.sin(a)));
    }
    for (let k = 11; k >= 0; k--) prof.push(new THREE.Vector2(0.001 + 0.48 * k / 12, 0.54 + 0.05 * (1 - (k / 12) ** 2))); // domed top
    scene.add(part(new THREE.LatheGeometry(prof, 96), mustard, 0.3, 0, 2.0));

    const key = new THREE.SpotLight('#FFE0BD', 70, 0, 0.7, 0.7, 2);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0003;
    key.shadow.radius = 8;
    key.target.position.set(0, 0.6, 0.3);
    scene.add(key, key.target);
    const rim = new THREE.DirectionalLight('#BFD0FF', 0.9); // cool light from behind and above: lights the far edges
    rim.position.set(3, 6, -5);
    scene.add(rim);

    const camera = new THREE.PerspectiveCamera(36, W / H, 0.1, 100);
    return {
      scene, camera,
      update(t) {
        const a = phase(t) * TAU;
        key.position.set(4.5 * Math.cos(a + 2.4), 4.5, 1.5 + 3.5 * Math.sin(a + 2.4));
        const ca = -0.3 + 0.22 * Math.sin(a);                                  // camera drifts round the chair and back
        camera.position.set(9.6 * Math.sin(ca), 3.6, 9.6 * Math.cos(ca) + 0.6);
        camera.lookAt(-0.05, 0.8, 0.7);
      },
    };
  },
};
