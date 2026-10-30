// Soft body by shape matching (Mueller et al. 2005): each jelly is a 4 x 4 x 4 lattice of particles. Every step the
// best-fit rotation plus a share of the stretch (polar decomposition of the moment matrix) gives each particle a
// goal position, and the particle is pulled part of the way there, so the cube can squash, shear and wobble but
// always springs back. Particles hit the belt with friction. Three jellies, each dropped with a different tilt,
// are simulated in setup (600 steps a second); on the belt they ride one every 5/3 s, so the loop closes exactly.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const L = 4, SIZE = 1.3, FRAMES = 150, SUB = 20, DT = 1 / 30 / SUB, GRAV = -9.8;
const ALPHA = 0.0015, BETA = 0.6;      // pull toward the goal per step (about a 4 Hz wobble), share of stretch kept
const SPEED = 1.8, RIB = 1.5;          // belt speed (units per second) and rib spacing: 1.8 x 5 s = 9 = 6 ribs
const FLAVOURS = [['#FF3D6E', '#FFB3C6'], ['#5FD43A', '#D2F7B0'], ['#3F86FF', '#B9D3FF']]; // [deep, light]

// rotation part of a 3x3 matrix A (row-major array), iterating a quaternion (Mueller et al. 2016)
function rotationOf(A, q) {
  const m = new THREE.Matrix3(), col = i => new THREE.Vector3(A[i], A[3 + i], A[6 + i]);
  for (let it = 0; it < 20; it++) {
    m.setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q));
    const e = m.elements, r = [0, 1, 2].map(i => new THREE.Vector3(e[i * 3], e[i * 3 + 1], e[i * 3 + 2]));
    const num = new THREE.Vector3(), den = r.reduce((s, ri, i) => s + ri.dot(col(i)), 0);
    r.forEach((ri, i) => num.add(ri.clone().cross(col(i))));
    const w = num.multiplyScalar(1 / (Math.abs(den) + 1e-9)), angle = w.length();
    if (angle < 1e-9) break;
    q.premultiply(new THREE.Quaternion().setFromAxisAngle(w.divideScalar(angle), angle)).normalize();
  }
  return q;
}

// particle positions (L^3 x 3) at every frame for a jelly dropped with the given tilt
function simulate(tilt) {
  const n = L * L * L, rest = [], x = [], v = [];
  const q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt[0], tilt[1], tilt[2]));
  for (let k = 0; k < L; k++) for (let j = 0; j < L; j++) for (let i = 0; i < L; i++) {
    const p = new THREE.Vector3(i, j, k).multiplyScalar(SIZE / (L - 1)).subScalar(SIZE / 2);
    rest.push(p);
    x.push(p.clone().applyQuaternion(q0).add(new THREE.Vector3(0, 5.2, 0)));
    v.push(new THREE.Vector3(0, -1.5, 0));
  }
  // Aqq^-1 for the linear part of the goal (rest is centred at the origin)
  const Aqq = new THREE.Matrix3().set(0, 0, 0, 0, 0, 0, 0, 0, 0), e = Aqq.elements;
  for (const p of rest) { const a = p.toArray(); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) e[c * 3 + r] += a[r] * a[c]; }
  Aqq.invert();
  const q = new THREE.Quaternion(), frames = [], goal = new THREE.Vector3(), cm = new THREE.Vector3(), vm = new THREE.Vector3();
  for (let f = 0; f < FRAMES; f++) {
    frames.push(Float32Array.from(x.flatMap(p => p.toArray())));
    for (let s = 0; s < SUB; s++) {
      cm.set(0, 0, 0); x.forEach(p => cm.add(p)); cm.divideScalar(n);
      const A = [0, 0, 0, 0, 0, 0, 0, 0, 0]; // Apq = sum (x - cm) rest^T, row-major
      x.forEach((p, i) => { const d = p.clone().sub(cm).toArray(), r = rest[i].toArray(); for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) A[a * 3 + b] += d[a] * r[b]; });
      rotationOf(A, q);
      const Apq = new THREE.Matrix3().set(...A), lin = Apq.clone().multiply(Aqq);
      lin.multiplyScalar(1 / Math.cbrt(Math.max(1e-6, lin.determinant()))); // keep the volume
      const R = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q));
      const M = R.clone(); for (let k = 0; k < 9; k++) M.elements[k] = BETA * lin.elements[k] + (1 - BETA) * R.elements[k];
      vm.set(0, 0, 0); v.forEach(w => vm.add(w)); vm.divideScalar(n);
      x.forEach((p, i) => {
        goal.copy(rest[i]).applyMatrix3(M).add(cm);
        v[i].addScaledVector(goal.sub(p), ALPHA / DT);
        v[i].sub(vm).multiplyScalar(0.98).add(vm); // damp the wobble, not the fall
        v[i].y += GRAV * DT;
        p.addScaledVector(v[i], DT);
        if (p.y < 0) { p.y = 0; v[i].y = Math.max(0, v[i].y); v[i].x *= 0.85; v[i].z *= 0.85; } // the belt, with friction
      });
    }
  }
  return frames;
}

function beltTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#2B2F3A'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#353A47'; g.fillRect(0, 0, 64, 10); // one rib per tile
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export default {
  name: 'Soft Body',
  ko: '소프트 바디',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#F3E7D9');
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.8;
    const key = new THREE.DirectionalLight('#FFF6EA', 2.4);
    key.position.set(-5, 9, 3);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -6, right: 6, top: 8, bottom: -8, near: 1, far: 30 });
    key.shadow.bias = -0.0005;
    key.shadow.radius = 5;
    scene.add(key, new THREE.HemisphereLight('#FFFFFF', '#CDB8A0', 0.5));

    const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 100);
    camera.position.set(3.6, 6.6, 8.6);
    camera.lookAt(0, 0.5, -1.4);

    // the belt runs along z, from far (-z) to near (+z)
    const map = beltTexture();
    map.repeat.set(1, 40 / RIB); // one rib every RIB along the 40-long belt
    const belt = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 40), new THREE.MeshStandardMaterial({ map, roughness: 0.8 }));
    belt.position.y = -0.15;
    belt.receiveShadow = true;
    scene.add(belt);
    const rail = new THREE.MeshStandardMaterial({ color: '#C9CED6', metalness: 0.85, roughness: 0.3 });
    for (const sx of [-2.15, 2.15]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.55, 40), rail);
      r.position.set(sx, -0.02, 0);
      r.castShadow = r.receiveShadow = true;
      scene.add(r);
    }
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: '#E9DCCB', roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.6;
    floor.receiveShadow = true;
    scene.add(floor);

    const tilts = [[0.5, 0.3, 0.35], [-0.35, 0.8, 0.55], [0.15, -0.6, -0.6]];
    const sims = tilts.map(simulate);

    // each jelly: a rounded box whose vertices follow the lattice (trilinear weights from the rest position)
    const jellies = FLAVOURS.map(([color, sheen], k) => {
      const geo = new RoundedBoxGeometry(SIZE, SIZE, SIZE, 6, 0.18), restPos = geo.attributes.position.array.slice();
      const mat = new THREE.MeshPhysicalMaterial({ color: sheen, roughness: 0.1, transmission: 0.75, thickness: 1.3, ior: 1.33,
        attenuationColor: new THREE.Color(color), attenuationDistance: 1.1, clearcoat: 1, clearcoatRoughness: 0.04, emissive: color, emissiveIntensity: 0.12 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      scene.add(mesh);
      return { mesh, geo, restPos, sim: sims[k], slot: k };
    });

    const lattice = (P, i, j, k, out) => { const b = ((k * L + j) * L + i) * 3; return out.set(P[b], P[b + 1], P[b + 2]); };
    const c = [...Array(8)].map(() => new THREE.Vector3()), tmp = new THREE.Vector3();
    return {
      scene, camera,
      update(t) {
        map.offset.y = (t * SPEED) / RIB; // the ribs move toward the camera with the jellies (6 whole ribs per loop)
        for (const jl of jellies) {
          const age = Math.round(((t - (jl.slot * 5) / 3 + 5) % 5) * 30) % FRAMES; // in frames, 0..149
          const P = jl.sim[age], z = -4.2 + (age / 30) * SPEED; // dropped at the back, carried forward
          const pos = jl.geo.attributes.position.array;
          for (let v = 0; v < pos.length; v += 3) {
            // lattice coordinates of this vertex at rest, 0..L-1
            const u = [0, 1, 2].map(a => Math.min(L - 1.0001, Math.max(0, ((jl.restPos[v + a] + SIZE / 2) / SIZE) * (L - 1))));
            const i = Math.floor(u[0]), j = Math.floor(u[1]), k = Math.floor(u[2]), fx = u[0] - i, fy = u[1] - j, fz = u[2] - k;
            lattice(P, i, j, k, c[0]); lattice(P, i + 1, j, k, c[1]); lattice(P, i, j + 1, k, c[2]); lattice(P, i + 1, j + 1, k, c[3]);
            lattice(P, i, j, k + 1, c[4]); lattice(P, i + 1, j, k + 1, c[5]); lattice(P, i, j + 1, k + 1, c[6]); lattice(P, i + 1, j + 1, k + 1, c[7]);
            tmp.set(0, 0, 0)
              .addScaledVector(c[0], (1 - fx) * (1 - fy) * (1 - fz)).addScaledVector(c[1], fx * (1 - fy) * (1 - fz))
              .addScaledVector(c[2], (1 - fx) * fy * (1 - fz)).addScaledVector(c[3], fx * fy * (1 - fz))
              .addScaledVector(c[4], (1 - fx) * (1 - fy) * fz).addScaledVector(c[5], fx * (1 - fy) * fz)
              .addScaledVector(c[6], (1 - fx) * fy * fz).addScaledVector(c[7], fx * fy * fz);
            pos[v] = tmp.x; pos[v + 1] = tmp.y; pos[v + 2] = tmp.z + z;
          }
          jl.geo.attributes.position.needsUpdate = true;
          jl.geo.computeVertexNormals();
        }
      },
    };
  },
};
