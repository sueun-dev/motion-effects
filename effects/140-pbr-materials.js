// PBR materials: a 5 x 6 chart of MeshStandardMaterial spheres with one base colour, roughness rising to the right
// and metalness rising downwards. One white light orbits the view axis and the room environment turns, so every
// sphere shows how its highlight spreads (roughness) and whether it reflects in colour (metalness).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TAU, phase, FONT } from '../lib/util.js';

const COLS = [0, 0.25, 0.5, 0.75, 1];          // roughness
const ROWS = [0, 0.2, 0.4, 0.6, 0.8, 1];       // metalness
const X0 = 580, DX = 190, Y0 = 590, DY = 196;  // sphere centres in pixels

export default {
  name: 'PBR Materials',
  ko: 'PBR 재질',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas'); bg.width = 4; bg.height = 512;
    const b = bg.getContext('2d'), grd = b.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#1B1C26'); grd.addColorStop(1, '#0C0C12');
    b.fillStyle = grd; b.fillRect(0, 0, 4, 512);
    scene.background = new THREE.CanvasTexture(bg); scene.background.colorSpace = THREE.SRGBColorSpace;
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.42;

    // orthographic, 1 unit = 100 px, so the chart lines up with the overlay labels
    const camera = new THREE.OrthographicCamera(-W / 200, W / 200, H / 200, -H / 200, 0.1, 100);
    camera.position.set(0, 0, 20);
    const px = (x, y) => [(x - W / 2) / 100, (H / 2 - y) / 100];

    const light = new THREE.DirectionalLight('#FFF4E6', 3.6);
    scene.add(light);
    const geo = new THREE.SphereGeometry(0.8, 96, 64);
    ROWS.forEach((metalness, r) => COLS.forEach((roughness, c) => {
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#E0A23A', roughness, metalness }));
      const [x, y] = px(X0 + (c - 2) * DX, Y0 + r * DY);
      m.position.set(x, y, 0);
      m.rotation.y = 0.3;
      scene.add(m);
    }));

    return {
      scene, camera,
      update(t) {
        const a = phase(t) * TAU;
        light.position.set(Math.cos(a) * 6, Math.sin(a) * 6, 4.5); // circles round the view axis once per loop
        scene.environmentRotation.y = a;                          // reflections slide round on the smooth spheres
      },
    };
  },
  overlay(ctx, t, W, H) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'; ctx.font = `700 34px ${FONT.sans}`;
    ctx.fillText('ROUGHNESS  →', X0, 360);
    ctx.font = `500 26px ${FONT.mono}`; ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    COLS.forEach((v, c) => ctx.fillText(String(v), X0 + (c - 2) * DX, 420));
    ROWS.forEach((v, r) => ctx.fillText(String(v), 88, Y0 + r * DY));
    ctx.save();
    ctx.translate(34, Y0 + 2.5 * DY); ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'; ctx.font = `700 34px ${FONT.sans}`;
    ctx.fillText('←  METALNESS', 0, 0);
    ctx.restore();
    ctx.font = `500 28px ${FONT.ko}`; ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fillText('one base colour · one light · one environment', W / 2, 1810);
  },
};
