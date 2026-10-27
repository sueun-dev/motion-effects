// Wireframe: only the edges of 3D shapes, drawn as 2-3 px anti-aliased fat lines (LineSegments2); fog fades every line
// by its depth. Both shapes turn about a symmetry axis (the shell's 5-fold axis, the (2,3) knot's 3-fold axis), so a
// fifth / a third of a turn per loop lands exactly on the start and the spin stays calm.
import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { TAU, phase } from '../lib/util.js';

function lines(geo, color, width, W, H) {
  const g = new LineSegmentsGeometry().setPositions(geo.attributes.position.array);
  const m = new LineMaterial({ color, linewidth: width, resolution: new THREE.Vector2(W, H), fog: true });
  return new LineSegments2(g, m);
}

export default {
  name: 'Wireframe',
  ko: '와이어프레임',
  three(renderer, W, H) {
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas'); bg.width = 4; bg.height = 256;
    const b = bg.getContext('2d'), grd = b.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#04050F'); grd.addColorStop(0.5, '#0B0E26'); grd.addColorStop(1, '#04050F');
    b.fillStyle = grd; b.fillRect(0, 0, 4, 256);
    scene.background = new THREE.CanvasTexture(bg); scene.background.colorSpace = THREE.SRGBColorSpace;
    scene.fog = new THREE.Fog('#0A0C22', 9, 15.5); // far lines melt into the background
    const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 100);
    camera.position.set(0, 0.6, 12);
    camera.lookAt(0, 0, 0);

    const ico = new THREE.IcosahedronGeometry(2.6, 1);
    const v = new THREE.Vector3(-1, (1 + Math.sqrt(5)) / 2, 0).normalize(); // an icosahedron vertex = a 5-fold axis
    ico.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(v, new THREE.Vector3(0, 1, 0)));
    const shell = lines(new THREE.EdgesGeometry(ico, 1), '#46E3FF', 3, W, H);
    const T = 60, R = 7, kp = new THREE.TorusKnotGeometry(1.05, 0.32, T, R, 2, 3).attributes.position, quad = [];
    const at = (j, i) => [kp.getX(j * (R + 1) + i), kp.getY(j * (R + 1) + i), kp.getZ(j * (R + 1) + i)];
    for (let j = 0; j < T; j++) for (let i = 0; i < R; i++) quad.push(...at(j, i), ...at(j, i + 1), ...at(j, i), ...at(j + 1, i)); // rings + lengthwise, no diagonals
    const knotGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(quad, 3));
    const knot = lines(knotGeo, '#FF5CD6', 2.2, W, H);
    const knotTilt = new THREE.Group();
    knotTilt.add(knot);
    const circle = [];
    for (let k = 0; k < 120; k++) for (const j of [k, k + 1]) circle.push(3.4 * Math.cos(j / 120 * TAU), 0, 3.4 * Math.sin(j / 120 * TAU));
    const ringGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(circle, 3));
    const ring = lines(ringGeo, '#9D8CFF', 2.2, W, H);

    const floor = new THREE.BufferGeometry(), pts = []; // a grid below, fading into the fog
    for (let k = -10; k <= 10; k++) { pts.push(k, 0, -10, k, 0, 10, -10, 0, k, 10, 0, k); }
    floor.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const grid = lines(floor, '#3B3F9E', 2, W, H);
    grid.position.y = -4.2;
    scene.add(shell, knotTilt, ring, grid);

    return {
      scene, camera,
      update(t) {
        const a = phase(t) * TAU;
        shell.rotation.y = a / 5;
        knotTilt.rotation.set(0.75 + 0.1 * Math.sin(a), 0.15 * Math.sin(a), 0);
        knot.rotation.z = -a / 3; // its tubular segments (60) divide by 3, so the mesh maps onto itself
        ring.rotation.set(0.35 + 0.12 * Math.sin(a), 0, 0.25 * Math.cos(a)); // an orbit ring that rocks gently
      },
    };
  },
};
