// Skeletal skinning: a lathe-built noodle creature is a SkinnedMesh on a chain of 7 bones made in code. Every
// vertex is tied to the two nearest bones with smooth weights (shown as vertex colours, one colour per bone), so
// the skin bends softly as the bones turn in a wave that runs up the chain. The skin is see-through, so the
// octahedral bones and joints are visible inside it.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TAU, phase, smoothstep } from '../lib/util.js';

const N = 7, SEG = 1.2;                                       // bones, and the length of each

export default {
  name: 'Skeletal Skinning',
  ko: '스켈레탈 스키닝',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    const sky = document.createElement('canvas');
    sky.width = 2; sky.height = 512;
    const g = sky.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#1C2541'); grd.addColorStop(0.55, '#3A506B'); grd.addColorStop(1, '#F2C6A0');
    g.fillStyle = grd; g.fillRect(0, 0, 2, 512);
    scene.background = new THREE.CanvasTexture(sky);
    scene.background.colorSpace = THREE.SRGBColorSpace;
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.5;

    const camera = new THREE.PerspectiveCamera(27, W / H, 0.1, 100);
    camera.position.set(0, 5.2, 24);
    camera.lookAt(0, 4.4, 0);
    const key = new THREE.DirectionalLight('#FFE9D2', 2.6);
    key.position.set(-6, 12, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -7, right: 7, top: 12, bottom: -2 });
    key.shadow.radius = 5;
    scene.add(key, new THREE.HemisphereLight('#BFD8FF', '#6B4A3A', 1.0));
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.ShadowMaterial({ opacity: 0.25 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // the skin: a lathe profile from a wide foot to a round head, height N * SEG
    const Ht = N * SEG, prof = [];
    for (let i = 0; i <= 80; i++) {
      const y = (i / 80) * Ht, R = 0.68, top = Ht - R;
      const r = y < top ? R + 0.3 * Math.exp(-y * 1.6) : Math.sqrt(Math.max(R * R - (y - top) ** 2, 0)); // flared foot, round head
      prof.push(new THREE.Vector2(Math.max(r, 0.001), y));
    }
    const geo = new THREE.LatheGeometry(prof, 64);
    const pos = geo.attributes.position, idx = [], wts = [], col = [];
    const hues = Array.from({ length: N }, (_, k) => new THREE.Color().setHSL(0.98 - (k / (N - 1)) * 0.72, 0.9, 0.58));
    for (let i = 0; i < pos.count; i++) {
      const s = Math.min(Math.max(pos.getY(i) / SEG - 0.5, 0), N - 1);   // halfway along bone k = all bone k
      const k = Math.min(Math.floor(s), N - 2), f = smoothstep(0, 1, s - k);
      idx.push(k, k + 1, 0, 0);
      wts.push(1 - f, f, 0, 0);
      const c = hues[k].clone().lerp(hues[k + 1], f);           // the weights, painted as colour
      col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wts, 4));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));

    const bones = [];
    for (let k = 0; k < N; k++) {
      const b = new THREE.Bone();
      b.position.y = k === 0 ? 0 : SEG;
      if (k) bones[k - 1].add(b);
      bones.push(b);
    }
    const skin = new THREE.SkinnedMesh(geo, new THREE.MeshPhysicalMaterial({
      vertexColors: true, transparent: true, opacity: 0.58, roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.35, envMapIntensity: 0.6, depthWrite: false,
    }));
    skin.add(bones[0]);
    skin.bind(new THREE.Skeleton(bones));
    skin.castShadow = true;
    skin.renderOrder = 1;
    scene.add(skin);

    // what each bone looks like in an editor: an octahedron from its joint to the next, and a ball on the joint
    const og = new THREE.BufferGeometry();
    const w = 0.16, a = 0.22 * SEG;
    og.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, w, a, 0, 0, a, w, -w, a, 0, 0, a, -w, 0, SEG, 0], 3));
    og.setIndex([0, 2, 1, 0, 3, 2, 0, 4, 3, 0, 1, 4, 5, 1, 2, 5, 2, 3, 5, 3, 4, 5, 4, 1]);
    og.computeVertexNormals();
    const boneMat = new THREE.MeshStandardMaterial({ color: '#FFF4D6', emissive: '#FFB347', emissiveIntensity: 0.55, roughness: 0.4, flatShading: true });
    const jointMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', emissive: '#FFD27A', emissiveIntensity: 0.8 });
    for (let k = 0; k < N; k++) {
      if (k < N - 1) bones[k].add(new THREE.Mesh(og, boneMat));
      bones[k].add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 12), jointMat));
    }

    // two eyes on the head bone, so the noodle has a face
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 16), new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.2 }));
      eye.position.set(sx * 0.26, SEG * 0.05 + 0.25, 0.52);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12), new THREE.MeshStandardMaterial({ color: '#141824', roughness: 0.3 }));
      pupil.position.set(0, 0, 0.11);
      eye.add(pupil);
      bones[N - 1].add(eye);
    }

    return {
      scene, camera,
      update(t) {
        const p = phase(t) * TAU + 1.7;                         // start mid-sway
        bones[0].rotation.y = 0.5 * Math.sin(p);                   // the whole body turns a little
        for (let k = 1; k < N; k++) {                              // a wave that runs up the chain; one wavelength
          bones[k].rotation.z = 0.33 * Math.sin(p - (k * TAU) / (N - 1));   // over the 6 joints, so the body never leans off
          bones[k].rotation.x = 0.18 * Math.sin(2 * p - (k * TAU) / (N - 1));
        }
      },
    };
  },
};
