// Domino chain without a physics engine: each domino tips over on a schedule (accelerating like a fall) but is
// stopped by the one in front, using the exact lean angle at which its top edge rests on its neighbour's back.
// After the run the whole chain stands back up (the same motion played backwards), so the loop closes.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { span, ease, clamp } from '../lib/util.js';

const HT = 1.0, TH = 0.17, WD = 0.52, GAP = 0.46; // height, thickness, width, spacing (front edge to front edge)
const START = 0.3, STEP = 0.075, FALL = 0.17;     // when the first one goes, delay between neighbours, fall time

// lean of a domino whose top rests on the back of a neighbour leaning at phi
const rest = phi => phi + Math.asin(clamp((GAP * Math.cos(phi) - TH) / HT, -1, 1));

// an S-shaped path on the floor, resampled every GAP along its length
function path() {
  const dense = [];
  for (let i = 0; i <= 2000; i++) {
    const u = i / 2000;
    dense.push(new THREE.Vector2(-1.8 * Math.sin(u * Math.PI * 2), 4.3 - 10.2 * u));
  }
  const pts = [dense[0]];
  let acc = 0;
  for (let i = 1; i < dense.length; i++) {
    acc += dense[i].distanceTo(dense[i - 1]);
    if (acc >= GAP) { pts.push(dense[i]); acc -= GAP; }
  }
  return pts;
}

export default {
  name: 'Domino Chain',
  ko: '도미노',
  three(renderer, W, H) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#1E2A44');
    const camera = new THREE.PerspectiveCamera(40, W / H, 1, 80);
    camera.position.set(0, 13, 9.5);
    camera.lookAt(0, 0, -0.7);

    scene.add(new THREE.HemisphereLight('#EAF0FF', '#46506A', 1.6));
    const sun = new THREE.DirectionalLight('#FFF4E2', 2.4);
    sun.position.set(-5, 10, 3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9 });
    sun.shadow.bias = -0.0005;
    scene.add(sun);
    const spot = document.createElement('canvas'); // the table: a soft pool of light under the chain
    spot.width = spot.height = 256;
    const sg = spot.getContext('2d'), grd = sg.createRadialGradient(128, 128, 8, 128, 128, 128);
    grd.addColorStop(0, '#4A5F8E'); grd.addColorStop(0.55, '#33456E'); grd.addColorStop(1, '#1E2A44');
    sg.fillStyle = grd; sg.fillRect(0, 0, 256, 256);
    const map = new THREE.CanvasTexture(spot);
    map.colorSpace = THREE.SRGBColorSpace;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.MeshStandardMaterial({ map, roughness: 0.85 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    floor.receiveShadow = true;
    scene.add(floor);

    const geo = new RoundedBoxGeometry(WD, HT, TH, 3, 0.04);
    geo.translate(0, HT / 2, -TH / 2); // pivot on the front bottom edge
    const pts = path(), dominoes = [];
    pts.forEach((p, i) => {
      const next = pts[Math.min(i + 1, pts.length - 1)], prev = pts[Math.max(i - 1, 0)];
      const group = new THREE.Group();
      group.position.set(p.x, 0, p.y);
      group.rotation.y = Math.atan2(next.x - prev.x, next.y - prev.y);
      const color = new THREE.Color().setHSL(0.98 - 0.75 * (i / pts.length), 0.75, 0.6);
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.35 }));
      m.castShadow = m.receiveShadow = true;
      group.add(m);
      scene.add(group);
      dominoes.push(m);
    });

    return {
      scene, camera,
      update(t) {
        const ft = t < 3.3 ? t : 3.0 * (1 - ease.inOut(span(t, 3.3, 4.7))); // run, then rewind
        let lean = Math.PI / 2; // the last domino can lie flat
        for (let i = dominoes.length - 1; i >= 0; i--) {
          const k = clamp((ft - START - i * STEP) / FALL);
          lean = Math.min((Math.PI / 2) * k * k, i === dominoes.length - 1 ? Math.PI / 2 : rest(lean));
          dominoes[i].rotation.x = lean;
        }
      },
    };
  },
};
