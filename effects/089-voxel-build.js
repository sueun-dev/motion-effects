// Voxel build: a tree's cubes (grass, trunk, leaves, apples) are listed bottom-up; cube k drops in at time k * GAP with
// an accelerating fall and a little squash on landing, so the shape assembles layer by layer, then pops away to loop.
import * as THREE from 'three';
import { TAU, rng, phase, clamp, ease } from '../lib/util.js';

const GAP = 0.025, FALL = 0.55, DROP = 5;

function treeVoxels() {
  const r = rng(89), v = [];
  for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) {
    if (Math.abs(x) === 3 && Math.abs(z) === 3) continue; // rounded corners
    v.push([x, 0, z, r() < 0.5 ? '#6CC24A' : '#5DB33F']);
  }
  for (let y = 1; y <= 3; y++) v.push([0, y, 0, '#8B5A2B']);
  for (let y = 4; y <= 7; y++) for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) {
    if (x * x + z * z + (y - 5.4) ** 2 * 1.3 > 6.2) continue;
    const apple = r() < 0.08 && (Math.abs(x) === 2 || Math.abs(z) === 2);
    v.push([x, y, z, apple ? '#E8443A' : ['#3FA34D', '#4CB85A', '#2F8F44'][Math.floor(r() * 3)]]);
  }
  return v.sort((a, b) => a[1] - b[1] || (a[0] + a[2]) - (b[0] + b[2]));
}

export default {
  name: 'Voxel Build',
  ko: '복셀 빌드',
  three(renderer, W, H) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas'); bg.width = 4; bg.height = 256;
    const b = bg.getContext('2d'), grd = b.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#8FCBEA'); grd.addColorStop(1, '#E6F4F1');
    b.fillStyle = grd; b.fillRect(0, 0, 4, 256);
    scene.background = new THREE.CanvasTexture(bg); scene.background.colorSpace = THREE.SRGBColorSpace;
    const camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 100);
    scene.add(new THREE.HemisphereLight('#FFFFFF', '#8FB3C2', 1.5));
    const sun = new THREE.DirectionalLight('#FFF4E0', 2.4);
    sun.position.set(-6, 14, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
    scene.add(sun);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshStandardMaterial({ color: '#CDE7E3' }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -1.6; floor.receiveShadow = true;
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 5.8, 1.0, 48), new THREE.MeshStandardMaterial({ color: '#8C7B6B', roughness: 0.9 }));
    stand.position.y = -1.05; // a stone pedestal the build stands on (its top sits 0.07 below the cubes)
    stand.castShadow = stand.receiveShadow = true;
    scene.add(floor, stand);

    const geo = new THREE.BoxGeometry(0.96, 0.96, 0.96);
    const cubes = treeVoxels().map(([x, y, z, color], k) => {
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
      m.castShadow = m.receiveShadow = true;
      scene.add(m);
      return { m, x, y, z, k };
    });
    const N = cubes.length;

    return {
      scene, camera,
      update(t) {
        const a = phase(t) * TAU, yaw = 0.7 + 0.35 * Math.sin(a);
        camera.position.set(25 * Math.sin(yaw), 15.5, 25 * Math.cos(yaw));
        camera.lookAt(0, 2.3, 0);
        for (const c of cubes) {
          const k = (t - 0.15 - c.k * GAP) / FALL;             // 0 .. 1 while falling
          const out = clamp((t - 4.3 - (N - c.k) * 0.0032) / 0.22); // pop away from the top down
          const fall = clamp(k), land = clamp((k - 1) / 0.35);
          const squash = land > 0 && land < 1 ? 0.18 * Math.sin(Math.PI * land) : 0;
          const s = (k <= 0 ? 0 : Math.min(1, k * 4)) * (1 - ease.in(out));
          c.m.visible = s > 0.001;
          c.m.position.set(c.x, c.y + DROP * (1 - fall * fall) - squash * 0.48, c.z);
          c.m.scale.set(s * (1 + squash * 0.6), s * (1 - squash), s * (1 + squash * 0.6));
        }
      },
    };
  },
};
