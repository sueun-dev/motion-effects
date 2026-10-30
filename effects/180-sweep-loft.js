// Sweep & loft: a cross-section travels along a 3D path (a trefoil knot) and leaves a solid behind it. The section is
// carried by a rotation-minimising frame (double reflection, closed up so the knot joins), twists 2/5 of a turn per
// lap and lofts between a round and a five-point star shape along the way. The glowing outline is the section at the
// head; the solid is rebuilt each frame between its tail and head, which chase each other round the knot.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { TAU, phase } from '../lib/util.js';

const K = 100, SEG = 520, M = 3000; // points round the section, rings along the solid, frame samples per lap
const path = s => new THREE.Vector3(Math.sin(s) + 2 * Math.sin(2 * s), Math.cos(s) - 2 * Math.cos(2 * s), -Math.sin(3 * s)).multiplyScalar(0.54);
const tangent = s => new THREE.Vector3(Math.cos(s) + 4 * Math.cos(2 * s), -Math.sin(s) + 4 * Math.sin(2 * s), -3 * Math.cos(3 * s)).normalize();
// the section at path parameter s: a star whose points grow and fade (the loft), turned by the twist
const radius = s => 0.34 + 0.05 * Math.sin(2 * s);
const starness = s => 0.2 - 0.18 * Math.cos(3 * s);
const section = (s, th) => radius(s) * (1 + starness(s) * Math.cos(5 * (th + 0.4 * s))) / (1 + starness(s) * 0.5);
const hue = s => new THREE.Color().setHSL(0.93 - 0.45 * (0.5 - 0.5 * Math.cos(s)), 0.9, 0.56);

export default {
  name: 'Sweep & Loft',
  ko: '스윕·로프트',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas'); bg.width = bg.height = 512;
    const b = bg.getContext('2d'), grd = b.createRadialGradient(256, 240, 10, 256, 256, 400);
    grd.addColorStop(0, '#3A1D4F'); grd.addColorStop(1, '#0E0818');
    b.fillStyle = grd; b.fillRect(0, 0, 512, 512);
    scene.background = new THREE.CanvasTexture(bg); scene.background.colorSpace = THREE.SRGBColorSpace;
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.5;
    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
    camera.position.set(0, 0, 16);
    camera.lookAt(0, 0, 0);
    const key = new THREE.DirectionalLight('#FFF2E6', 2.2);
    key.position.set(-3, 5, 6);
    scene.add(key, new THREE.HemisphereLight('#C9B8FF', '#2A0F30', 0.6));

    // rotation-minimising frame along one lap (double reflection), then the leftover twist spread out so it closes
    const Nf = [], ss = [];
    let r = new THREE.Vector3(0, 0, 1);
    r.sub(tangent(0).multiplyScalar(r.dot(tangent(0)))).normalize();
    for (let i = 0; i <= M; i++) {
      const s0 = (i / M) * TAU;
      ss.push(s0); Nf.push(r.clone());
      const s1 = ((i + 1) / M) * TAU, v1 = path(s1).sub(path(s0)), c1 = v1.dot(v1);
      const rL = r.clone().addScaledVector(v1, (-2 / c1) * v1.dot(r)), t0 = tangent(s0);
      const tL = t0.clone().addScaledVector(v1, (-2 / c1) * v1.dot(t0));
      const v2 = tangent(s1).sub(tL), c2 = v2.dot(v2);
      r = c2 > 1e-12 ? rL.addScaledVector(v2, (-2 / c2) * v2.dot(rL)) : rL;
    }
    const t0 = tangent(0), b0 = new THREE.Vector3().crossVectors(t0, Nf[0]);
    const gap = Math.atan2(Nf[M].dot(b0), Nf[M].dot(Nf[0]));
    Nf.forEach((n, i) => n.applyAxisAngle(tangent(ss[i]), -gap * i / M));
    const frame = s => { // T, N, B at any s
      const u = ((s % TAU) + TAU) % TAU / TAU * M, i = Math.floor(u), T = tangent(s);
      const N = Nf[i].clone().lerp(Nf[Math.min(M, i + 1)], u - i);
      N.sub(T.clone().multiplyScalar(N.dot(T))).normalize();
      return [T, N, new THREE.Vector3().crossVectors(T, N)];
    };

    // the swept solid: SEG + 1 rings of K points, wrapped round (no seam); each end has its own flat cap
    // (a copy of the end ring plus a centre point, so the caps keep sharp edges)
    const capT = (SEG + 1) * K, capH = capT + K + 1, nv = capH + K + 1;
    const pos = new Float32Array(nv * 3), col = new Float32Array(nv * 3), idx = [];
    for (let j = 0; j < SEG; j++) for (let k = 0; k < K; k++) {
      const a = j * K + k, b1 = j * K + (k + 1) % K;
      idx.push(a, b1, a + K, b1, b1 + K, a + K);
    }
    for (let k = 0; k < K; k++) {
      idx.push(capT + K, capT + (k + 1) % K, capT + k);
      idx.push(capH + K, capH + k, capH + (k + 1) % K);
    }
    const geo = new THREE.BufferGeometry();
    geo.setIndex(idx);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const solid = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.1 }));
    const knot = new THREE.Group();
    knot.add(solid);

    // the path ahead, as a dotted guide
    const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 12, 8), new THREE.MeshBasicMaterial({ color: '#E9D8FF', transparent: true, opacity: 0.55, toneMapped: false }), 180);
    for (let i = 0; i < 180; i++) dots.setMatrixAt(i, new THREE.Matrix4().setPosition(path((i / 180) * TAU)));
    knot.add(dots);
    // the cross-section at the head: a glowing outline
    const ringGeo = new LineGeometry().setPositions(new Float32Array((K + 1) * 3));
    const ring = new Line2(ringGeo, new LineMaterial({ color: '#FFFFFF', linewidth: 6, resolution: new THREE.Vector2(W, H), toneMapped: false }));
    knot.add(ring);
    scene.add(knot);

    const ringPos = new Float32Array((K + 1) * 3), p = new THREE.Vector3(), c = new THREE.Color();
    const point = (s, th, out) => {
      const [, N, B] = frame(s), rr = section(s, th);
      return out.copy(path(s)).addScaledVector(N, rr * Math.cos(th)).addScaledVector(B, rr * Math.sin(th));
    };

    return {
      scene, camera,
      update(t) {
        const a = phase(t) * TAU;
        const head = a + 0.6, len = TAU * (0.56 - 0.3 * Math.cos(a)); // the head laps once; the solid stretches and shrinks
        for (let j = 0; j <= SEG; j++) {
          const s = head - len + (len * j) / SEG;
          c.copy(hue(s));
          for (let k = 0; k < K; k++) {
            point(s, (k / K) * TAU, p).toArray(pos, (j * K + k) * 3);
            c.toArray(col, (j * K + k) * 3);
          }
        }
        // the caps: copies of the end rings plus their centres, in a pale tint so the profile reads
        pos.copyWithin(capT * 3, 0, K * 3); pos.copyWithin(capH * 3, SEG * K * 3, (SEG + 1) * K * 3);
        path(head - len).toArray(pos, (capT + K) * 3); path(head).toArray(pos, (capH + K) * 3);
        c.set('#FFE9F4');
        for (let k = 0; k <= K; k++) { c.toArray(col, (capT + k) * 3); c.toArray(col, (capH + k) * 3); }
        geo.attributes.position.needsUpdate = true;
        geo.attributes.color.needsUpdate = true;
        geo.computeVertexNormals();
        geo.computeBoundingSphere();
        for (let k = 0; k <= K; k++) point(head + 0.004, (k / K) * TAU, p).toArray(ringPos, k * 3);
        ringGeo.setPositions(ringPos);
        knot.rotation.set(0.35 + 0.12 * Math.sin(a), 0.4 * Math.sin(a), 0.1 * Math.cos(a));
      },
    };
  },
};
