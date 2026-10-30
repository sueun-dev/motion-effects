// Normal mapping: a stone tile that is one flat quad (two triangles) looks deeply carved, because a normal map, baked
// on a canvas from a height field (frame, rosette, rings, studs), tilts the lighting normal per pixel. A lamp circles
// low over it and the carving answers; mid-loop the tile tips to a grazing angle, its two triangles drawn on top, and
// the silhouette is a dead straight line: there is no relief at all. The normal map itself is shown below.
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { TAU, phase, canvas, smoothstep, fbm3, FONT } from '../lib/util.js';

const N = 1024;
// height 0..1 at (x, y) in -1..1: raised frame, sunken field, a petal rosette in a ring, a carved groove, corner studs
function height(x, y) {
  const r = Math.hypot(x, y), th = Math.atan2(y, x);
  const dome = (d, w) => Math.sqrt(Math.max(0, 1 - (d / w) ** 2));
  let h = 0.35 + 0.04 * fbm3(x * 4, y * 4, 1.7);                                   // the field, a little rough
  const edge = Math.max(Math.abs(x), Math.abs(y));
  h = Math.max(h, smoothstep(0.84, 0.88, edge) * 0.9);                            // the frame, with a bevel
  h = Math.max(h, 0.35 + 0.5 * dome(r - 0.62, 0.05));                             // a rounded ring
  h -= 0.28 * dome(r - 0.72, 0.035);                                              // a carved groove outside it
  const petal = r - (0.2 + 0.26 * Math.abs(Math.cos(4 * th)) ** 1.5);
  h = Math.max(h, 0.35 + 0.45 * smoothstep(0.03, -0.06, petal) * (1 - 0.35 * r));  // eight petals
  h = Math.max(h, 0.35 + 0.6 * dome(r, 0.11));                                    // the boss in the middle
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) h = Math.max(h, 0.35 + 0.45 * dome(Math.hypot(x - 0.7 * sx, y - 0.7 * sy), 0.07));
  return h;
}

// the normal map, drawn once: slopes of the height field turned into RGB normals (x right, y up, z out)
function bakeNormals() {
  const hf = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) hf[j * N + i] = height((i + 0.5) / N * 2 - 1, 1 - (j + 0.5) / N * 2);
  const c = canvas(N, N), g = c.getContext('2d'), img = g.createImageData(N, N), d = img.data, k = 22;
  const at = (i, j) => hf[Math.min(N - 1, Math.max(0, j)) * N + Math.min(N - 1, Math.max(0, i))];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const dx = (at(i + 1, j) - at(i - 1, j)) * k, dy = (at(i, j - 1) - at(i, j + 1)) * k; // y up in the texture
    const l = Math.hypot(dx, dy, 1), p = (j * N + i) * 4;
    d[p] = (-dx / l * 0.5 + 0.5) * 255; d[p + 1] = (-dy / l * 0.5 + 0.5) * 255; d[p + 2] = (1 / l * 0.5 + 0.5) * 255; d[p + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

const NORMALS = bakeNormals();
const tipAt = t => smoothstep(1.3, 2.3, t) * (1 - smoothstep(2.9, 3.9, t));    // 0 = facing the camera, 1 = grazing

export default {
  name: 'Normal Mapping',
  ko: '노멀 매핑',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0E0F13');
    const normalMap = new THREE.CanvasTexture(NORMALS);
    normalMap.anisotropy = 8;

    const camera = new THREE.PerspectiveCamera(32, W / H, 0.1, 100);
    camera.position.set(0, 0.2, 10.5);
    camera.lookAt(0, 0.45, 0);

    const tile = new THREE.Group();
    tile.position.y = 0.55;
    scene.add(tile);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 2.7, 1, 1), new THREE.MeshStandardMaterial({ color: '#D2C2A6', roughness: 0.62, normalMap }));
    const slab = new THREE.Mesh(new THREE.BoxGeometry(2.7, 2.7, 0.08), new THREE.MeshStandardMaterial({ color: '#8C7E68', roughness: 0.8 }));
    slab.position.z = -0.043;
    tile.add(top, slab);

    // the two triangles, drawn as fat lines just above the surface
    const wire = new LineGeometry();
    wire.setPositions([-1.35, -1.35, 0.004, 1.35, -1.35, 0.004, 1.35, 1.35, 0.004, -1.35, 1.35, 0.004, -1.35, -1.35, 0.004, 1.35, 1.35, 0.004]);
    const wireMat = new LineMaterial({ color: '#4FE3FF', linewidth: 4, transparent: true, opacity: 0, depthTest: false });
    wireMat.resolution.set(W, H);
    tile.add(new Line2(wire, wireMat));

    // a lamp circling low over the tile, in the tile's own frame
    const lamp = new THREE.PointLight('#FFE6C2', 7, 0, 2);
    lamp.add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 12), new THREE.MeshBasicMaterial({ color: '#FFF4DE' })));
    tile.add(lamp);
    scene.add(new THREE.HemisphereLight('#8C9BC0', '#2A2018', 0.35));

    return {
      scene, camera,
      update(t) {
        const a = phase(t) * TAU, tip = tipAt(t);
        lamp.position.set(1.05 * Math.cos(a), 1.05 * Math.sin(a), 0.65);
        tile.rotation.set(-0.3 - 1.08 * tip, 0.26 * Math.sin(a), 0);
        wireMat.opacity = smoothstep(0.15, 0.6, tip);
      },
    };
  },
  // the normal map itself, as a card below the tile
  overlay(ctx, t, W, H) {
    const s = 250, x = (W - s) / 2, y = 1500;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x, y, s, s, 18); ctx.clip();
    ctx.drawImage(NORMALS, x, y, s, s);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x, y, s, s, 18); ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'; ctx.font = `600 30px ${FONT.sans}`; ctx.textAlign = 'center';
    ctx.fillText('normal map', W / 2, y + s + 52);
  },
};
