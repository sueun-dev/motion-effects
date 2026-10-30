// Projected texture (light cookie / gobo): a SpotLight with a `map` projects a stained-glass rose window, drawn once
// on a canvas, onto a stone floor and white plaster shapes. The light circles slowly and the pattern turns 60°
// (the window repeats every 60°), so the coloured glass slides and wraps over the objects; they cast its shadows.
import * as THREE from 'three';
import { TAU, phase, canvas, rng } from '../lib/util.js';

// a 12-fold rose window: black stone tracery, lancets filled with small glass quarries in lead, round foils
function roseWindow(size) {
  const c = canvas(size, size), g = c.getContext('2d');
  const glass = { blue: '#2A5BFF', navy: '#2B2DB0', ruby: '#E0213A', amber: '#F5A623', green: '#1FA866', violet: '#8A3FD1', pale: '#F4E6C0' };
  g.fillStyle = '#000'; g.fillRect(0, 0, size, size);
  g.translate(size / 2, size / 2); g.scale(size / 1024, size / 1024);
  g.strokeStyle = '#000'; g.lineJoin = 'round';
  const N = 12, step = TAU / N;
  const lancet = () => { // local frame: x points outwards, the arch tip at x = 478
    g.beginPath(); g.moveTo(150, -22); g.lineTo(392, -74);
    g.quadraticCurveTo(452, -60, 478, 0); g.quadraticCurveTo(452, 60, 392, 74); g.lineTo(150, 22); g.closePath();
  };
  for (let i = 0; i < N; i++) {
    const r = rng(1 + (i % 2)); // lancets 0, 2, 4 ... share their colours, so the window repeats every 60°
    g.save(); g.rotate(i * step);
    lancet(); g.save(); g.clip();
    g.rotate(Math.PI / 4); // diamond quarries, 34 px
    for (let y = -560; y < 560; y += 34) for (let x = -560; x < 560; x += 34) {
      const lx = (x - y) * Math.SQRT1_2, ly = Math.abs(x + y + 34) * Math.SQRT1_2, k = r(); // cell centre, lancet frame
      g.fillStyle = ly < 22 ? (Math.floor(lx / 50) % 2 ? glass.ruby : glass.amber)
        : ly < 46 ? (k < 0.15 ? glass.violet : glass.blue)
        : k < 0.12 ? glass.green : k < 0.18 ? glass.pale : glass.navy;
      g.fillRect(x, y, 34, 34);
    }
    g.lineWidth = 5;
    for (let k = -560; k < 560; k += 34) { g.beginPath(); g.moveTo(k, -560); g.lineTo(k, 560); g.moveTo(-560, k); g.lineTo(560, k); g.stroke(); }
    g.restore();
    g.lineWidth = 14; lancet(); g.stroke();
    g.restore();
    // a gold roundel with a ruby heart between the lancet tips
    const a = (i + 0.5) * step, x = 445 * Math.cos(a), y = 445 * Math.sin(a);
    g.fillStyle = '#F5A623'; g.beginPath(); g.arc(x, y, 34, 0, TAU); g.fill();
    g.fillStyle = '#E0213A'; g.beginPath(); g.arc(x, y, 15, 0, TAU); g.fill();
    g.lineWidth = 6; g.beginPath(); g.arc(x, y, 15, 0, TAU); g.stroke();
    g.lineWidth = 10; g.beginPath(); g.arc(x, y, 34, 0, TAU); g.stroke();
  }
  // the heart: six emerald foils around a white-gold centre
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6, x = 78 * Math.cos(a), y = 78 * Math.sin(a);
    g.fillStyle = '#1FA866'; g.beginPath(); g.arc(x, y, 44, 0, TAU); g.fill();
    g.fillStyle = '#F5A623'; g.beginPath(); g.arc(x, y, 18, 0, TAU); g.fill();
    g.lineWidth = 6; g.beginPath(); g.arc(x, y, 18, 0, TAU); g.stroke();
    g.lineWidth = 10; g.beginPath(); g.arc(x, y, 44, 0, TAU); g.stroke();
  }
  g.fillStyle = '#FFF0CC'; g.beginPath(); g.arc(0, 0, 30, 0, TAU); g.fill();
  g.lineWidth = 10; g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export default {
  name: 'Projected Texture',
  ko: '투사 텍스처',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#07070C');
    scene.fog = new THREE.Fog('#07070C', 18, 30);

    const camera = new THREE.PerspectiveCamera(44, W / H, 0.1, 100);
    camera.position.set(0, 12.5, 12);
    camera.lookAt(0, 0.4, 0.4);

    scene.add(new THREE.HemisphereLight('#3A4A78', '#120E16', 0.6)); // dim blue room light, so the dark is not empty
    const fill = new THREE.DirectionalLight('#FFE9D6', 0.6); // a faint warm fill that shows the plaster shapes
    fill.position.set(6, 5, 7);
    scene.add(fill);

    const spot = new THREE.SpotLight('#FFFFFF', 9, 0, 0.36, 0.1, 0);
    spot.map = roseWindow(1024);
    spot.castShadow = true; // three needs a shadow map for the projected texture
    spot.shadow.mapSize.set(2048, 2048);
    spot.shadow.bias = -0.0004;
    spot.shadow.normalBias = 0.02;
    spot.shadow.camera.near = 4;
    spot.shadow.camera.far = 30;
    scene.add(spot, spot.target);

    // pale stone floor with fixed, barely visible tiles
    const fc = canvas(1024, 1024), f = fc.getContext('2d');
    f.fillStyle = '#A39C90'; f.fillRect(0, 0, 1024, 1024);
    f.strokeStyle = '#857F74'; f.lineWidth = 4;
    for (let k = 0; k <= 4; k++) { f.beginPath(); f.moveTo(k * 256, 0); f.lineTo(k * 256, 1024); f.moveTo(0, k * 256); f.lineTo(1024, k * 256); f.stroke(); }
    const floorTex = new THREE.CanvasTexture(fc);
    floorTex.colorSpace = THREE.SRGBColorSpace;
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(5, 5);
    floorTex.anisotropy = 8;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // white plaster shapes in the middle of the projection
    const plaster = new THREE.MeshStandardMaterial({ color: '#F2EEE6', roughness: 0.55 });
    const add = (geo, x, y, z, ry = 0) => {
      const m = new THREE.Mesh(geo, plaster);
      m.position.set(x, y, z); m.rotation.y = ry;
      m.castShadow = m.receiveShadow = true;
      scene.add(m);
      return m;
    };
    add(new THREE.SphereGeometry(1.25, 96, 64), 0.1, 1.25, 0.4);
    add(new THREE.CylinderGeometry(0.55, 0.62, 3.6, 64), -2.1, 1.8, -1.8);
    add(new THREE.BoxGeometry(1.4, 1.4, 1.4), 2.15, 0.7, -1.2, 0.6);
    add(new THREE.ConeGeometry(0.7, 1.9, 64), -1.9, 0.95, 2.4);
    const ring = add(new THREE.TorusGeometry(0.75, 0.26, 32, 96), 2.0, 0.26, 2.6);
    ring.rotation.x = Math.PI / 2;

    const axis = new THREE.Vector3(), u1 = new THREE.Vector3(), u2 = new THREE.Vector3();
    return {
      scene, camera,
      update(t) {
        const a = phase(t) * TAU;
        spot.position.set(-2.6 + 1.6 * Math.cos(a), 12.5, 3.2 + 1.6 * Math.sin(a));
        spot.target.position.set(0.25 * Math.cos(a), 0, 0.4 + 0.25 * Math.sin(a));
        spot.target.updateMatrixWorld();
        // turn the projected picture about the light's axis: the shadow camera's up vector sets its roll
        axis.subVectors(spot.target.position, spot.position).normalize();
        u1.set(1, 0, 0).addScaledVector(axis, -axis.x).normalize();
        u2.crossVectors(axis, u1);
        const roll = a / 6; // 60° per loop: the window looks the same again
        spot.shadow.camera.up.copy(u1).multiplyScalar(Math.cos(roll)).addScaledVector(u2, Math.sin(roll));
      },
    };
  },
};
