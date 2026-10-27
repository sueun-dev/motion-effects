// Dolly zoom (vertigo effect): the camera slides back while the field of view narrows so that
// d * tan(fov / 2) stays constant. The character keeps its size; the tunnel of gates and the sun behind stretch.
import * as THREE from 'three';
import { TAU, phase, lerp } from '../lib/util.js';

const K = 3.1, EYE = 1.8; // half the visible height at the character's distance, camera height
const TAN_WIDE = Math.tan((104 / 2) * Math.PI / 180), TAN_TELE = Math.tan((15 / 2) * Math.PI / 180);

function gradientTexture(stops) {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 512;
  const g = c.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 512);
  stops.forEach(([k, col]) => grd.addColorStop(k, col));
  g.fillStyle = grd; g.fillRect(0, 0, 4, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default {
  name: 'Dolly Zoom',
  ko: '돌리 줌',
  three(renderer, W, H) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.background = gradientTexture([[0, '#3B2C6B'], [0.42, '#E8637A'], [0.5, '#FFB37A'], [1, '#FFD9A8']]);
    scene.fog = new THREE.Fog('#FFC08F', 45, 190);
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.3, 500);

    scene.add(new THREE.HemisphereLight('#FFE9D6', '#9A6A5A', 1.5));
    const sun = new THREE.DirectionalLight('#FFF0DC', 2.2);
    sun.position.set(-12, 30, -2);
    sun.target.position.set(0, 0, -20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 50, bottom: -50, far: 120 });
    sun.shadow.bias = -0.0004;
    scene.add(sun, sun.target);

    for (const [w, y, color] of [[600, -0.04, '#EDC79A'], [2.6, -0.015, '#F7DFBE']]) { // sand, and a paved path on top
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 400), new THREE.MeshStandardMaterial({ color, roughness: 0.95 }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(0, y, -150);
      m.receiveShadow = true;
      scene.add(m);
    }

    // a sun disc far behind the tunnel: tiny in the wide shot, huge in the long lens
    const disc = new THREE.Mesh(new THREE.CircleGeometry(15, 128), new THREE.MeshBasicMaterial({ color: '#FFF3C4', fog: false }));
    disc.position.set(0, 9.5, -170);
    scene.add(disc);

    // tunnel of torii gates
    const red = new THREE.MeshStandardMaterial({ color: '#E2462E', roughness: 0.6 });
    const black = new THREE.MeshStandardMaterial({ color: '#2B1D24', roughness: 0.7 });
    const post = new THREE.CylinderGeometry(0.11, 0.12, 3.0, 20), cap = new THREE.CylinderGeometry(0.15, 0.15, 0.3, 20);
    const top = new THREE.BoxGeometry(2.9, 0.2, 0.3), tie = new THREE.BoxGeometry(2.45, 0.13, 0.17);
    for (let z = 1.2; z > -42; z -= 1.7) {
      const add = (geo, mat, x, y) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; scene.add(m); };
      add(post, red, -1.05, 1.5); add(post, red, 1.05, 1.5);
      add(cap, black, -1.05, 0.15); add(cap, black, 1.05, 0.15);
      add(top, black, 0, 3.08); add(tie, red, 0, 2.62);
    }

    // the character stays the same size on screen
    const kid = new THREE.Group();
    const skin = (color, rough = 0.5) => new THREE.MeshStandardMaterial({ color, roughness: rough });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.55, 8, 24), skin('#2EC4B6'));
    body.position.y = 0.6;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 24), skin('#FFE3C8'));
    head.position.y = 1.36;
    const hat = new THREE.Mesh(new THREE.SphereGeometry(0.31, 32, 16, 0, TAU, 0, Math.PI / 2.2), skin('#FFCA3A'));
    hat.position.y = 1.4;
    kid.add(body, head, hat);
    for (const x of [-0.11, 0.11]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), skin('#22161C', 0.3));
      eye.position.set(x, 1.36, 0.27);
      kid.add(eye);
    }
    kid.traverse(m => { m.castShadow = true; });
    scene.add(kid);

    return {
      scene, camera,
      update(t) {
        const u = 0.5 - 0.5 * Math.cos(phase(t) * TAU);           // wide -> long lens -> wide
        const tanHalf = Math.exp(lerp(Math.log(TAN_WIDE), Math.log(TAN_TELE), u));
        camera.fov = 2 * Math.atan(tanHalf) * 180 / Math.PI;
        camera.position.set(0, EYE, K / tanHalf);                    // d * tan(fov / 2) = K
        camera.lookAt(0, EYE, 0);
        camera.updateProjectionMatrix();
      },
    };
  },
};
