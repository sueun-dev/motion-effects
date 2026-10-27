// An isometric grid of blocks (orthographic camera at the classic 35.264 degree angle) rising and falling in a ripple.
import * as THREE from 'three';
import { TAU, phase } from '../lib/util.js';

export default {
  name: 'Isometric',
  ko: '아이소메트릭',
  three(renderer, W, H) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#F3EEE6');
    const view = 9.5, aspect = W / H;
    const camera = new THREE.OrthographicCamera(-view * aspect, view * aspect, view, -view, 0.1, 100);
    camera.position.set(20, 22.5, 20); // looking down (1, 1, 1): true isometric
    camera.lookAt(0, 2.5, 0);

    scene.add(new THREE.HemisphereLight('#FFFFFF', '#B9A88F', 1.6));
    const sun = new THREE.DirectionalLight('#FFF6E8', 2.4);
    sun.position.set(-8, 16, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 });
    scene.add(sun);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: '#EDE5D8' }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    floor.receiveShadow = true;
    scene.add(floor);

    const N = 7, size = 0.9, colors = ['#FF6B6B', '#FFB84C', '#4ECDC4', '#5B7CFA', '#A78BFA'];
    const blocks = [];
    const geo = new THREE.BoxGeometry(size, 1, size);
    geo.translate(0, 0.5, 0); // grow from the floor up
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const x = i - (N - 1) / 2, z = j - (N - 1) / 2;
        const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: colors[(i + j) % colors.length], roughness: 0.55 }));
        m.position.set(x, 0, z);
        m.castShadow = m.receiveShadow = true;
        scene.add(m);
        blocks.push({ m, d: Math.hypot(x, z) });
      }
    }
    return {
      scene, camera,
      update(t) {
        for (const b of blocks) b.m.scale.y = 0.35 + 2.6 * (0.5 + 0.5 * Math.sin(phase(t) * TAU - b.d * 0.9));
      },
    };
  },
};
