// 3D phyllotaxis: a succulent rosette where every new leaf appears 137.5 degrees (the golden angle) round from the one
// before, 13 per loop. A leaf's size grows exponentially with its age and it unfurls from upright to flat, so the
// whole rosette is self-similar in time: after one loop every leaf has taken the place of an older one, turned by
// 13 golden angles. A slow counter-turn of 12.4 degrees per loop absorbs that, so the endless growth loops seamlessly.
// The interlocking spirals running both ways across the rosette are the golden angle at work.
import * as THREE from 'three';
import { TAU, rng, smoothstep } from '../lib/util.js';

const PHI = Math.PI * (3 - Math.sqrt(5));          // the golden angle, 137.508 degrees
const PER = 13, GAP = 5 / PER;                       // leaves per loop, seconds between leaves
const TURN = PER * PHI - Math.round(PER * PHI / TAU) * TAU;   // 13 golden angles, minus whole turns: -12.4 degrees
const GROW = 0.17;                                   // size grows by e^0.17 per second of age

// a fleshy, spoon-shaped leaf pointing along +x: a squashed sphere, widest near the tip, cupped and curling up
function leafGeometry() {
  const g = new THREE.SphereGeometry(1, 40, 24), p = g.attributes.position, col = [];
  for (let i = 0; i < p.count; i++) {
    const sx = p.getX(i), sy = p.getY(i), sz = p.getZ(i);
    const u = (sx + 1) / 2;                                              // 0 at the base, 1 at the tip
    const w = 0.30 * Math.pow(Math.sin(Math.PI * Math.min(u, 0.999) * 0.92 + 0.12), 0.7) * (0.45 + 0.75 * u) * (1 - 0.85 * Math.pow(u, 6));
    const th = 0.11 * (1 - 0.55 * u);
    const y = sy * th + 0.16 * u * u - 0.10 * (1 - (sz * w / 0.36) ** 2) * u * (sy > 0 ? 1 : 0.6);
    p.setXYZ(i, u, y, sz * w);
    const blush = Math.min(1, Math.pow(u, 3) * 1.3 + Math.abs(sz) * u * 0.6);
    const c = new THREE.Color('#8FC0A6').lerp(new THREE.Color('#EE8E98'), blush);
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

export default {
  name: '3D Phyllotaxis',
  ko: '3D 잎차례',
  three(renderer, W, H) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, W / H, 0.05, 60);
    camera.position.set(0, 6.2, 3.4);
    camera.lookAt(0, 0, 0.35);
    scene.add(new THREE.HemisphereLight('#E8EEFF', '#3A2E28', 0.75));
    const key = new THREE.DirectionalLight('#FFF0DC', 3.4);
    key.position.set(-5, 4.5, 1.5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 20 });
    key.shadow.radius = 5; key.shadow.bias = -0.0006;
    scene.add(key);

    // gravel top-dressing under the plant: a fixed canvas texture of little stones
    const gc = document.createElement('canvas'); gc.width = gc.height = 1024;
    const g = gc.getContext('2d'), r = rng(205);
    g.fillStyle = '#3A3330'; g.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 9000; i++) {
      const x = r() * 1024, y = r() * 1024, s = 2.5 + r() * 4, l = 24 + r() * 20, e = 0.6 + 0.4 * r(), a = r() * TAU;
      g.fillStyle = `hsl(${20 + r() * 25}, ${8 + r() * 12}%, ${l}%)`;
      for (const dx of [-1024, 0, 1024]) for (const dy of [-1024, 0, 1024]) {   // drawn wrapped, so the texture tiles
        g.beginPath(); g.ellipse(x + dx, y + dy, s, s * e, a, 0, TAU); g.fill();
      }
    }
    const tex = new THREE.CanvasTexture(gc);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(4, 4);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(14, 14).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
    ground.position.y = -0.55;
    ground.receiveShadow = true;
    scene.add(ground);

    const geo = leafGeometry(), mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.45, sheen: 0.6, sheenRoughness: 0.5, sheenColor: '#E8F0FF' });
    const plant = new THREE.Group();
    scene.add(plant);
    const MAX = 70, leaves = [];
    for (let j = 0; j < MAX; j++) {
      const pivot = new THREE.Group(), leaf = new THREE.Mesh(geo, mat);
      leaf.castShadow = leaf.receiveShadow = true;
      pivot.add(leaf); plant.add(pivot);
      leaves.push({ pivot, leaf });
    }

    return {
      scene, camera,
      update(t) {
        plant.rotation.y = TURN * t / 5;                         // undoes the 13 golden angles gained per loop
        const newest = Math.floor(t / GAP + 1e-9);               // index of the youngest leaf so far
        leaves.forEach(({ pivot, leaf }, j) => {
          const n = newest - j, age = t - n * GAP;               // leaf n was born at n * GAP seconds
          const size = 0.05 * Math.exp(GROW * age);
          const open = Math.exp(-age / 2.4);                     // 1 = still upright in the bud, 0 = laid open
          pivot.rotation.y = -n * PHI;
          const droop = smoothstep(17, 25.5, age);               // the oldest leaves bow down into the gravel
          pivot.position.set(0, -0.12 * size - 0.9 * droop * droop, 0);
          leaf.position.x = 0.1 * size;
          leaf.rotation.z = -0.12 + 1.45 * open - 0.55 * droop;  // tilt from upright to slightly drooping
          leaf.scale.set(size, size * (1.0 + 0.4 * open), size * (0.8 + 0.2 * (1 - open)));
          leaf.visible = age < 26;                               // by then it is under the gravel and the younger leaves
        });
      },
    };
  },
};
