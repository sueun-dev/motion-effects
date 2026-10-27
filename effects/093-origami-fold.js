// Origami fold: a cross-shaped net of six paper panels, each hinged to its neighbour (nested pivot groups),
// folds down one panel after another into a cube, turns, and unfolds flat again.
import * as THREE from 'three';
import { TAU, phase, span, ease, rng } from '../lib/util.js';

const G = 0.05, TH = 0.025; // gap between panels, paper thickness
const COLORS = ['#FF7A6B', '#FFC24B', '#3CC6B8', '#7C8CFF', '#FF8FC7', '#9BDB6A'];

// coloured paper with a fixed fibre texture and a white shape printed on it
function paper(color, shape) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, 256, 256);
  const r = rng(shape + 3);
  g.fillStyle = 'rgba(255, 255, 255, 0.08)';
  for (let i = 0; i < 260; i++) g.fillRect(r() * 256, r() * 256, 2 + r() * 10, 2);
  g.fillStyle = 'rgba(255, 255, 255, 0.92)';
  g.beginPath();
  const n = [0, 3, 4, 5, 6, 10][shape];
  if (!n) g.arc(128, 128, 62, 0, TAU);
  for (let k = 0; k < n; k++) {
    const rr = n === 10 && k % 2 ? 34 : 70, a = (k / n) * TAU - Math.PI / 2;
    g.lineTo(128 + rr * Math.cos(a), 128 + rr * Math.sin(a));
  }
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default {
  name: 'Origami Fold',
  ko: '오리가미 폴딩',
  three(renderer, W, H) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#D9BFA6');
    const camera = new THREE.PerspectiveCamera(36, W / H, 0.5, 60);
    camera.position.set(0, 11.2, 10.8);
    camera.lookAt(0, -0.15, 0);

    scene.add(new THREE.HemisphereLight('#FFFFFF', '#C9B8A6', 1.7));
    const sun = new THREE.DirectionalLight('#FFF7EE', 2.2);
    sun.position.set(-3, 9, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
    sun.shadow.radius = 6;
    scene.add(sun);
    const spot = document.createElement('canvas'); // a soft pool of light on the table
    spot.width = spot.height = 512;
    const sg = spot.getContext('2d'), grd = sg.createRadialGradient(256, 256, 20, 256, 256, 256);
    grd.addColorStop(0, '#FFF6EA'); grd.addColorStop(0.6, '#F1DDC8'); grd.addColorStop(1, '#D9BFA6');
    sg.fillStyle = grd; sg.fillRect(0, 0, 512, 512);
    const spotTex = new THREE.CanvasTexture(spot);
    spotTex.colorSpace = THREE.SRGBColorSpace;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ map: spotTex }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.4;
    floor.receiveShadow = true;
    scene.add(floor);

    // one panel: coloured on top, white underneath and on the edges
    const white = new THREE.MeshStandardMaterial({ color: '#FBF7F1', roughness: 0.9 });
    const panel = (k, center) => {
      const geo = new THREE.BoxGeometry(1 - G, TH, 1 - G);
      geo.translate(center ? 0 : 0.5, -TH / 2, 0);
      const top = new THREE.MeshStandardMaterial({ map: paper(COLORS[k], k), roughness: 0.85 });
      const m = new THREE.Mesh(geo, [white, white, top, white, white, white]);
      m.castShadow = true;
      return m;
    };
    // a hinge on the edge of `parent`: turned to face `dir`, holding a panel that folds down about it
    const hinges = [];
    const hinge = (parent, x, z, yaw, k, delay) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0, z);
      pivot.rotation.y = yaw;
      const fold = new THREE.Group();
      fold.add(panel(k, false));
      pivot.add(fold);
      parent.add(pivot);
      hinges.push({ fold, delay });
      return fold;
    };

    const paperObj = new THREE.Group();
    const lift = new THREE.Group();
    lift.add(paperObj);
    scene.add(lift);
    paperObj.add(panel(0, true));
    hinge(paperObj, 0.5, 0, 0, 1, 0.0);                 // right
    hinge(paperObj, 0, 0.5, -Math.PI / 2, 2, 0.18);     // front
    hinge(paperObj, -0.5, 0, Math.PI, 3, 0.36);         // left
    const back = hinge(paperObj, 0, -0.5, Math.PI / 2, 4, 0.54);
    hinge(back, 1, 0, 0, 5, 0.9);                      // the lid, on the far edge of the back panel

    return {
      scene, camera,
      update(t) {
        let folded = 0;
        for (const h of hinges) { // fold in order, unfold in reverse order
          const k = ease.inOut(span(t, 0.4 + h.delay, 1.1 + h.delay)) - ease.inOut(span(t, 4.15 - h.delay, 4.85 - h.delay));
          h.fold.rotation.z = -k * Math.PI / 2;
          folded += k / hinges.length;
        }
        paperObj.position.set(0, 0.5 * folded, 0.5 * (1 - folded)); // keep the net, then the cube, centred
        lift.position.y = 0.08 * Math.sin(phase(t) * TAU * 2);
        lift.rotation.y = TAU * ease.inOut(span(t, 1.7, 3.6)) + 0.3 * Math.sin(phase(t) * TAU);
        lift.scale.setScalar(1.55);
      },
    };
  },
};
