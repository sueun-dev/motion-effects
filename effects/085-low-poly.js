// Low poly: jittered, non-indexed triangle grids with flat shading (one normal per face), so every facet catches the
// light on its own. The sea's vertices ride integer-frequency sine waves, so the facets shimmer smoothly and loop.
import * as THREE from 'three';
import { TAU, rng, phase, fbm3 } from '../lib/util.js';

// a jittered grid turned into separate triangles; height(x, z) sets y
function facets(size, seg, seed, height) {
  const g = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2), p = g.attributes.position, r = rng(seed);
  const step = size / seg;
  for (let i = 0; i < p.count; i++) {
    const edge = Math.abs(p.getX(i)) > size / 2 - 0.01 || Math.abs(p.getZ(i)) > size / 2 - 0.01;
    if (!edge) p.setXYZ(i, p.getX(i) + (r() - 0.5) * step * 0.7, 0, p.getZ(i) + (r() - 0.5) * step * 0.7);
    p.setY(i, height(p.getX(i), p.getZ(i)));
  }
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}

export default {
  name: 'Low Poly',
  ko: '로우 폴리',
  three(renderer, W, H) {
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas'); bg.width = 4; bg.height = 256;
    const b = bg.getContext('2d'), grd = b.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#5B6EE1'); grd.addColorStop(0.55, '#F2A6B8'); grd.addColorStop(1, '#FFD9A8');
    b.fillStyle = grd; b.fillRect(0, 0, 4, 256);
    scene.background = new THREE.CanvasTexture(bg); scene.background.colorSpace = THREE.SRGBColorSpace;
    scene.fog = new THREE.Fog('#F6B9B5', 22, 48);

    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 100);
    const look = new THREE.Vector3(0, 3.0, 0);
    scene.add(new THREE.HemisphereLight('#FFF1E0', '#6A5A9A', 1.4));
    const sun = new THREE.DirectionalLight('#FFE2B8', 2.6);
    sun.position.set(-6, 9, 5);
    scene.add(sun);

    // island: a faceted mountain, coloured per face by its height (fixed, so colours never jump)
    const ground = (x, z, d2 = x * x + z * z * 1.2) => 5.4 * Math.exp(-d2 / 6) - 0.9 - 0.04 * d2;
    const island = facets(11, 18, 85, (x, z) => Math.max(-1.6, ground(x, z) + 0.8 * fbm3(x * 0.4, z * 0.4, 2.0) * Math.exp(-(x * x + z * z) / 20)));
    const p = island.attributes.position, cols = [];
    const band = h => h > 3.4 ? '#F4F1FA' : h > 2.0 ? '#8A7F9E' : h > 0.25 ? '#5FAE6E' : '#F0D79A';
    for (let i = 0; i < p.count; i += 3) {
      const c = new THREE.Color(band((p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3));
      for (let k = 0; k < 3; k++) cols.push(c.r, c.g, c.b);
    }
    island.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    scene.add(new THREE.Mesh(island, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 })));

    const r = rng(8); // a few faceted pine trees on the lower slopes
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * TAU + r() * 0.4, d = 2.2 + r() * 0.9, x = Math.cos(a) * d, z = Math.sin(a) * d * 0.9;
      const tree = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.2, 5), new THREE.MeshStandardMaterial({ color: '#2F8A5B', flatShading: true }));
      tree.position.set(x, 0.45 + ground(x, z), z);
      scene.add(tree);
    }

    const sea = facets(48, 48, 86, () => 0);
    const base = Float32Array.from(sea.attributes.position.array);
    const seaMesh = new THREE.Mesh(sea, new THREE.MeshStandardMaterial({ color: '#2E9CC4', flatShading: true, roughness: 0.3 }));
    scene.add(seaMesh);

    const clouds = [[-4.4, 6.9, -5, 0.8], [4.3, 7.6, -10, 1.0], [-1.8, 8.0, -20, 1.2]].map(([x, y, z, s], i) => {
      const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: '#FFFFFF', flatShading: true, roughness: 1 });
      for (const [dx, dy, rr] of [[0, 0, 1], [1.1, -0.2, 0.75], [-1.1, -0.25, 0.7]]) {
        const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(rr * s, 0), m);
        puff.position.set(dx * s, dy * s, 0); puff.rotation.set(i, i * 2, 0);
        g.add(puff);
      }
      g.position.set(x, y, z);
      scene.add(g);
      return { g, x, y, i };
    });

    return {
      scene, camera,
      update(t) {
        const a = phase(t) * TAU, pos = sea.attributes.position, yaw = 0.28 * Math.sin(a); // the camera sways round the island
        camera.position.set(19 * Math.sin(yaw), 6.5, 19 * Math.cos(yaw));
        camera.lookAt(look);
        for (let i = 0; i < pos.count; i++) {
          const x = base[i * 3], z = base[i * 3 + 2];
          pos.setY(i, -0.25 + 0.3 * Math.sin(0.9 * x + 0.5 * z - 2 * a) + 0.22 * Math.sin(0.8 * z - 0.6 * x + a + 1.3) + 0.12 * Math.sin(1.4 * (x + z) - 3 * a));
        }
        pos.needsUpdate = true;
        sea.computeVertexNormals();
        for (const c of clouds) { c.g.position.x = c.x + 0.6 * Math.sin(a + c.i * 2); c.g.position.y = c.y + 0.25 * Math.sin(2 * a + c.i); }
      },
    };
  },
};
