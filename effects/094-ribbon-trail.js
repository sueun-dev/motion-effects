// Ribbon trails: three ribbons chase their heads around closed 3D Lissajous loops. Each ribbon is a triangle strip
// rebuilt every frame along the last stretch of its path; a rotation-minimising frame plus a fixed twist turns it.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TAU, phase } from '../lib/util.js';

const N = 1024, SEG = 260, TRAIL = 2.3, WIDTH = 0.42; // samples per loop, strip segments, trail length (radians)
const RIBBONS = [
  { f: [1, 2, 3], ph: [0.0, 0.0, 0.7], amp: [2.3, 3.6, 1.8], twist: 3, colors: ['#FF5E8A', '#FFB86B'] },
  { f: [2, 1, 2], ph: [1.2, 2.1, 0.0], amp: [2.0, 3.3, 2.0], twist: 2, colors: ['#5B8CFF', '#7CF2E2'] },
  { f: [3, 2, 1], ph: [2.4, 4.0, 1.6], amp: [1.9, 3.0, 2.2], twist: 4, colors: ['#B26BFF', '#FF8BE0'] },
];

// sample one closed loop with a rotation-minimising (double reflection) frame, closed up by spreading the mismatch
function sampleLoop({ f, ph, amp, twist }) {
  const P = [], T = [], R = [];
  for (let i = 0; i < N; i++) {
    const s = (i / N) * TAU;
    P.push(new THREE.Vector3(...[0, 1, 2].map(k => amp[k] * Math.sin(f[k] * s + ph[k]))));
    T.push(new THREE.Vector3(...[0, 1, 2].map(k => amp[k] * f[k] * Math.cos(f[k] * s + ph[k]))).normalize());
  }
  R.push(new THREE.Vector3(0, 0, 1).cross(T[0]).normalize());
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N, v1 = P[j].clone().sub(P[i]), c1 = v1.dot(v1);
    const rL = R[i].clone().addScaledVector(v1, (-2 / c1) * v1.dot(R[i]));
    const tL = T[i].clone().addScaledVector(v1, (-2 / c1) * v1.dot(T[i]));
    const v2 = T[j].clone().sub(tL), c2 = v2.dot(v2) || 1;
    R.push(rL.addScaledVector(v2, (-2 / c2) * v2.dot(rL)));
  }
  const B0 = T[0].clone().cross(R[0]);
  const miss = Math.atan2(R[N].dot(B0), R[N].dot(R[0]));
  return { P, T, R: R.slice(0, N).map((r, i) => r.applyAxisAngle(T[i], -miss * i / N + twist * TAU * i / N)) };
}

export default {
  name: 'Ribbon Trail',
  ko: '리본 트레일',
  three(renderer, W, H) {
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas');
    bg.width = 4; bg.height = 512;
    const g = bg.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#0E0B2E'); grd.addColorStop(0.55, '#24124A'); grd.addColorStop(1, '#3A1440');
    g.fillStyle = grd; g.fillRect(0, 0, 4, 512);
    scene.background = new THREE.CanvasTexture(bg);
    scene.background.colorSpace = THREE.SRGBColorSpace;
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.7;
    scene.add(new THREE.HemisphereLight('#B9C6FF', '#3A1440', 1.0));
    const key = new THREE.DirectionalLight('#FFFFFF', 2.2);
    key.position.set(3, 5, 6);
    scene.add(key);

    const camera = new THREE.PerspectiveCamera(38, W / H, 0.5, 100);
    camera.position.set(0, 0.4, 16.8);
    camera.lookAt(0, 0, 0);
    const group = new THREE.Group();
    scene.add(group);

    const ribbons = RIBBONS.map(cfg => {
      const loop = sampleLoop(cfg);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEG + 1) * 6), 3));
      const col = new Float32Array((SEG + 1) * 6), head = new THREE.Color(cfg.colors[0]), tail = new THREE.Color(cfg.colors[1]);
      const dark = new THREE.Color('#1A1040');
      for (let k = 0; k <= SEG; k++) {
        const u = k / SEG, c = head.clone().lerp(tail, u).lerp(dark, u * u * 0.8);
        col.set([c.r, c.g, c.b, c.r, c.g, c.b], k * 6);
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const idx = [];
      for (let k = 0; k < SEG; k++) idx.push(2 * k, 2 * k + 1, 2 * k + 2, 2 * k + 1, 2 * k + 3, 2 * k + 2);
      geo.setIndex(idx);
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.3, metalness: 0.15 }));
      group.add(mesh);
      return { loop, geo };
    });

    const at = (arr, x) => { // linear interpolation in a looped sample array
      const i = Math.floor(x), k = x - i;
      return arr[((i % N) + N) % N].clone().lerp(arr[(((i + 1) % N) + N) % N], k);
    };
    return {
      scene, camera,
      update(t) {
        group.rotation.y = phase(t) * TAU;
        for (const { loop, geo } of ribbons) {
          const pos = geo.attributes.position;
          for (let k = 0; k <= SEG; k++) {
            const u = k / SEG, x = (phase(t) - (TRAIL / TAU) * u) * N;
            const p = at(loop.P, x), side = at(loop.R, x).normalize();
            const w = WIDTH * Math.min(1, u * 14) ** 0.5 * (1 - u) ** 0.7; // rounded head, thin tail
            pos.setXYZ(2 * k, p.x + side.x * w, p.y + side.y * w, p.z + side.z * w);
            pos.setXYZ(2 * k + 1, p.x - side.x * w, p.y - side.y * w, p.z - side.z * w);
          }
          pos.needsUpdate = true;
          geo.computeVertexNormals();
        }
      },
    };
  },
};
