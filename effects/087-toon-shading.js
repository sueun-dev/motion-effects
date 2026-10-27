// Toon shading: MeshToonMaterial with a 3-step gradient map (nearest filtered, so light falls in hard bands) plus an
// ink outline from an inverted hull (back faces pushed out along smooth normals). Comic halftone backdrop is fixed.
import * as THREE from 'three';
import { TeapotGeometry } from 'three/addons/geometries/TeapotGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { TAU, phase } from '../lib/util.js';

const steps = (() => {
  const t = new THREE.DataTexture(new Uint8Array([70, 150, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
  return t;
})();

function toon(geo, color, ink = 0.06) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color, gradientMap: steps })));
  const hull = mergeVertices(geo.clone().deleteAttribute('normal').deleteAttribute('uv'));
  hull.computeVertexNormals(); // smooth normals, so the pushed-out shell has no cracks
  g.add(new THREE.Mesh(hull, new THREE.ShaderMaterial({
    side: THREE.BackSide, uniforms: { uInk: { value: ink } },
    vertexShader: 'uniform float uInk; void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * uInk, 1.0); }',
    fragmentShader: 'void main() { gl_FragColor = vec4(0.11, 0.07, 0.16, 1.0); }',
  })));
  return g;
}

export default {
  name: 'Toon Shading',
  ko: '툰 셰이딩',
  three(renderer, W, H) {
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas'); bg.width = W / 2; bg.height = H / 2;
    const b = bg.getContext('2d');
    b.fillStyle = '#FFD54A'; b.fillRect(0, 0, bg.width, bg.height);
    for (let k = 0; k < 24; k++) { // speed-line burst
      b.fillStyle = k % 2 ? '#FFC93A' : '#FFDF6E';
      b.beginPath(); b.moveTo(270, 470);
      b.arc(270, 470, 900, k / 24 * TAU, (k + 1) / 24 * TAU); b.fill();
    }
    b.fillStyle = 'rgba(232, 90, 60, 0.32)'; // fixed halftone dots, larger towards the bottom
    for (let y = 8; y < bg.height; y += 16) for (let x = (y / 16) % 2 * 8; x < bg.width; x += 16) {
      const rad = 4.8 * Math.max(0, (y / bg.height - 0.45) / 0.55);
      if (rad > 0.4) { b.beginPath(); b.arc(x, y, rad, 0, TAU); b.fill(); }
    }
    scene.background = new THREE.CanvasTexture(bg); scene.background.colorSpace = THREE.SRGBColorSpace;

    const camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 100);
    camera.position.set(0, 1.8, 14);
    camera.lookAt(0, 0.35, 0);
    scene.add(new THREE.AmbientLight('#FFFFFF', 0.5));
    const sun = new THREE.DirectionalLight('#FFFFFF', 2.6);
    sun.position.set(-4, 6, 5);
    scene.add(sun);

    const teapot = toon(new TeapotGeometry(0.95, 12), '#FF5C6C', 0.055);
    scene.add(teapot);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.4, 48), new THREE.MeshBasicMaterial({ color: '#C9791E', transparent: true, opacity: 0.45 }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = -1.5; shadow.scale.y = 0.55;
    scene.add(shadow);

    const orbiters = [
      toon(new THREE.TorusGeometry(0.42, 0.18, 24, 48), '#4FC3F7', 0.04),
      toon(new THREE.SphereGeometry(0.38, 32, 20), '#8BD46E', 0.04),
      toon(new THREE.ConeGeometry(0.36, 0.8, 32), '#B48CFF', 0.04),
    ];
    orbiters.forEach(o => scene.add(o));

    return {
      scene, camera,
      update(t) {
        const a = phase(t) * TAU, bob = 0.18 * Math.sin(2 * a);
        teapot.rotation.set(0.12 * Math.sin(a), a, 0.08 * Math.sin(2 * a));
        teapot.position.y = bob;
        shadow.scale.set(1 - bob * 0.4, 0.55 * (1 - bob * 0.4), 1);
        orbiters.forEach((o, i) => {
          const q = a + i * TAU / 3;
          o.position.set(1.6 * Math.cos(q), 1.75 + 0.2 * Math.sin(2 * q), 1.0 * Math.sin(q)); // a little halo above the lid
          o.rotation.set(a * (i + 1), a * 2, 0.4 * i);
        });
      },
    };
  },
};
