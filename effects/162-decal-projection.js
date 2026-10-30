// Decal projection: a projector box flies onto a curvy ceramic vase and stamps a sticker or paint splat. DecalGeometry
// keeps the vase triangles inside the box, clips them to it and maps the box's x/y to the decal's UVs, so each picture
// wraps over the belly, waist and lip. Six stamps land one after another, stay, then peel away to loop.
import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { TAU, phase, rng, span, ease, FONT } from '../lib/util.js';

// the six decal pictures, drawn on transparent 512 px canvases
function picture(kind, seed) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d'), r = rng(seed);
  g.translate(256, 256);
  const sticker = (path, fill) => {
    g.lineJoin = 'round';
    path(); g.lineWidth = 44; g.strokeStyle = '#FFFFFF'; g.stroke(); // white die-cut border
    path(); g.fillStyle = fill; g.fill();
  };
  if (kind === 'splat') {
    const col = ['#FF2D87', '#FFD21F', '#3EE6B0'][seed % 3];
    g.fillStyle = col;
    g.beginPath(); g.arc(0, 0, 120, 0, TAU); g.fill();
    for (let i = 0; i < 16; i++) {                 // splashes and droplets around the main blob
      const a = r() * TAU, d = 90 + r() * 90, s = 26 + r() * 40;
      g.beginPath(); g.ellipse(Math.cos(a) * d, Math.sin(a) * d, s, s * 0.7, a, 0, TAU); g.fill();
      const e = d + 50 + r() * 60, q = 8 + r() * 14;
      g.beginPath(); g.arc(Math.cos(a) * e, Math.sin(a) * e, q, 0, TAU); g.fill();
    }
  } else if (kind === 'star') {
    sticker(() => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -TAU / 4 + i * TAU / 10, d = i % 2 ? 90 : 200; g.lineTo(Math.cos(a) * d, Math.sin(a) * d); } g.closePath(); }, '#FFC51E');
  } else if (kind === 'heart') {
    sticker(() => { g.beginPath(); g.moveTo(0, 170); g.bezierCurveTo(-260, 10, -150, -200, 0, -80); g.bezierCurveTo(150, -200, 260, 10, 0, 170); g.closePath(); }, '#FF3B4E');
  } else if (kind === 'badge') {
    sticker(() => { g.beginPath(); g.arc(0, 0, 190, 0, TAU); }, '#FF7A1A');
    g.fillStyle = '#FFFFFF'; g.font = `900 120px ${FONT.black}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('WOW', 0, 8);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return tex;
}

// [picture, seed, angle around the vase, height, size, spin, stamp time]
const STAMPS = [
  ['splat', 0, -0.25, -0.8, 1.5, 0.3, 0.45],
  ['star', 1, 0.95, -0.15, 1.0, -0.2, 0.85],
  ['splat', 0, 0.2, 0.95, 1.2, 1.1, 1.25],
  ['heart', 2, -1.0, 0.25, 0.95, 0.25, 1.65],
  ['badge', 3, 0.5, -1.3, 0.85, -0.15, 2.05],
  ['splat', 2, -0.45, 1.65, 0.8, 2.0, 2.45],
];

export default {
  name: 'Decal Projection',
  ko: '데칼 투영',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas'); bg.width = W; bg.height = H;
    const b = bg.getContext('2d'), grd = b.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#F6E3CF'); grd.addColorStop(0.6, '#EFC9AE'); grd.addColorStop(1, '#D9A88C');
    b.fillStyle = grd; b.fillRect(0, 0, W, H);
    scene.background = new THREE.CanvasTexture(bg); scene.background.colorSpace = THREE.SRGBColorSpace;
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.8;

    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
    camera.position.set(0, 0.9, 14.6);
    camera.lookAt(0, -0.1, 0);
    const key = new THREE.DirectionalLight('#FFF1E0', 2.4);
    key.position.set(-4, 7, 6); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 });
    key.shadow.radius = 8; key.shadow.bias = -0.0005;
    scene.add(key);

    // a lathed vase: foot, round belly, narrow waist, flared lip
    const prof = new THREE.SplineCurve([[0.5, -2.0], [0.95, -1.75], [1.28, -0.9], [1.15, 0.0], [0.62, 0.95], [0.58, 1.45], [0.85, 1.95]].map(([x, y]) => new THREE.Vector2(x, y)));
    const vaseGeo = new THREE.LatheGeometry(prof.getPoints(160), 220);
    const vase = new THREE.Mesh(vaseGeo, new THREE.MeshPhysicalMaterial({ color: '#173F5F', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06, side: THREE.DoubleSide }));
    vase.castShadow = true;
    const group = new THREE.Group();
    group.add(vase);
    scene.add(group);

    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 0.5, 96), new THREE.MeshStandardMaterial({ color: '#C46A4A', roughness: 0.6 }));
    plinth.position.y = -2.25; plinth.receiveShadow = true;
    scene.add(plinth);

    // build each decal with the vase at rest (so world space = vase space), then hang it on the vase
    vase.updateMatrixWorld();
    const lineMat = () => new LineMaterial({ color: '#FFFFFF', linewidth: 4, transparent: true, depthTest: false, resolution: new THREE.Vector2(W, H) });
    const stamps = STAMPS.map(([kind, seed, ang, y, size, spin, at], i) => {
      const rad = prof.getPoints(160).reduce((best, p) => (Math.abs(p.y - y) < Math.abs(best.y - y) ? p : best)).x;
      const pos = new THREE.Vector3(Math.sin(ang) * rad, y, Math.cos(ang) * rad);
      const dir = new THREE.Vector3(Math.sin(ang), 0.15, Math.cos(ang)).normalize();
      const aim = new THREE.Object3D(); aim.position.copy(pos); aim.lookAt(pos.clone().add(dir)); aim.rotateZ(spin);
      const dims = new THREE.Vector3(size, size, 0.75);
      const mat = new THREE.MeshPhysicalMaterial({
        map: picture(kind, seed + i), transparent: true, depthWrite: false, roughness: kind === 'splat' ? 0.18 : 0.4, clearcoat: kind === 'splat' ? 1 : 0.3,
        polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
      });
      const decal = new THREE.Mesh(new DecalGeometry(vase, pos, aim.rotation, dims), mat);
      decal.renderOrder = 1 + i;
      group.add(decal);
      // the projector: a box outline of the same size that flies in along the decal's axis
      const box = new THREE.BoxGeometry(dims.x, dims.y, dims.z);
      const lines = new LineSegments2(new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(box)), lineMat());
      const fill = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: '#CFEFFF', transparent: true, opacity: 0, depthWrite: false }));
      const proj = new THREE.Group(); proj.add(fill, lines); fill.renderOrder = lines.renderOrder = 20;
      proj.quaternion.copy(aim.quaternion);
      group.add(proj);
      return { decal, proj, lines, fill, pos, dir, at, peel: 3.7 + i * 0.12 };
    });

    return {
      scene, camera,
      update(t) {
        const a = phase(t) * TAU;
        group.rotation.y = 0.32 * Math.sin(a);
        for (const s of stamps) {
          const fly = span(t, s.at - 0.35, s.at);                 // the projector travels in ...
          const show = span(t, s.at - 0.04, s.at + 0.12) * (1 - span(t, s.peel, s.peel + 0.4));
          const box = Math.min(fly, 1 - span(t, s.at, s.at + 0.3)) * (t < s.at + 0.3 ? 1 : 0);
          s.proj.position.copy(s.pos).addScaledVector(s.dir, 1.6 * (1 - ease.out(fly)));
          s.lines.material.opacity = box;
          s.fill.material.opacity = 0.16 * box;
          s.proj.visible = box > 0.001;
          s.decal.material.opacity = show;                         // ... and the decal appears where it lands
          s.decal.visible = show > 0.001;
        }
      },
    };
  },
};
