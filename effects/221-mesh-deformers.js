// Mesh deformers: a striped, rounded square column is bent out of shape by three classic deformers stacked one on
// another, each a small function of the vertex height: twist (turn each slice), bend (curl the column round an arc)
// and taper (shrink towards the top). They switch on one after another, hold together, then let go.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { TAU, FONT, smoothstep } from '../lib/util.js';

const HC = 5.2, TWIST = 200, BEND = 70, TAPER = 0.55; // column height; full twist and bend in degrees; taper share
const BANDS = ['#FF7A59', '#FFD166', '#06D6A0', '#118AB2', '#7B61FF'];

// how much of each deformer is switched on at time t (0..1); the loop starts 0.6 s in, with the twist under way
const amounts = t => {
  t = (t + 0.6) % 5;
  const off = smoothstep(3.4, 4.7, t);
  return [smoothstep(0.15, 1.0, t) - off, smoothstep(1.0, 1.85, t) - off, smoothstep(1.85, 2.7, t) - off];
};

// the deformer stack: twist and taper turn and scale each slice, then bend curls the column about the z axis
function deform(x, y, z, [tw, be, ta]) {
  const h = y / HC;
  const a = tw * TWIST * Math.PI / 180 * h, c = Math.cos(a), s = Math.sin(a);
  const k = 1 - ta * TAPER * h;
  let px = (x * c - z * s) * k, pz = (x * s + z * c) * k, py = y;
  const th = be * BEND * Math.PI / 180;
  if (th > 1e-4) { // bend: the column's centre line becomes an arc of radius HC / th
    const R = HC / th, phi = h * th;
    const nx = R - (R - px) * Math.cos(phi);
    py = (R - px) * Math.sin(phi);
    px = nx;
  }
  return [px, py, pz];
}

export default {
  name: 'Mesh Deformers',
  ko: '메시 변형',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas');
    bg.width = 4; bg.height = 512;
    const g = bg.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#F3E9FF'); grd.addColorStop(0.6, '#FBEFE6'); grd.addColorStop(1, '#F1DCCF');
    g.fillStyle = grd; g.fillRect(0, 0, 4, 512);
    scene.background = new THREE.CanvasTexture(bg);
    scene.background.colorSpace = THREE.SRGBColorSpace;
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);

    const key = new THREE.DirectionalLight('#FFF4E8', 2.4);
    key.position.set(-5, 9, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, far: 40 });
    key.shadow.radius = 5;
    scene.add(key, new THREE.HemisphereLight('#FFFFFF', '#E3C9B8', 0.6));
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.18 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.65, 0.3, 96), new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.5 }));
    plinth.position.y = 0.15;
    plinth.castShadow = plinth.receiveShadow = true;
    scene.add(plinth);

    // a rounded square, extruded up in 200 thin steps so it can bend smoothly
    const shape = new THREE.Shape(), w = 0.62, r = 0.2;
    shape.moveTo(-w + r, -w); shape.lineTo(w - r, -w); shape.quadraticCurveTo(w, -w, w, -w + r);
    shape.lineTo(w, w - r); shape.quadraticCurveTo(w, w, w - r, w); shape.lineTo(-w + r, w);
    shape.quadraticCurveTo(-w, w, -w, w - r); shape.lineTo(-w, -w + r); shape.quadraticCurveTo(-w, -w, -w + r, -w);
    let geo = new THREE.ExtrudeGeometry(shape, { depth: HC, steps: 200, curveSegments: 10, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2); // extrusion now runs up the y axis, from 0 to HC
    geo.deleteAttribute('normal');
    geo.deleteAttribute('uv');
    geo = mergeVertices(geo);
    const rest = Float32Array.from(geo.attributes.position.array);
    // stripes: a tall band texture read by height
    const uv = new Float32Array(rest.length / 3 * 2);
    for (let i = 0; i < rest.length / 3; i++) uv[i * 2 + 1] = rest[i * 3 + 1] / HC;
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const bands = document.createElement('canvas');
    bands.width = 4; bands.height = 2048;
    const bc = bands.getContext('2d');
    for (let b = 0; b < 10; b++) { bc.fillStyle = BANDS[b % BANDS.length]; bc.fillRect(0, 2048 - (b + 1) * 204.8, 4, 205); }
    bc.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (let b = 1; b < 10; b++) bc.fillRect(0, 2048 - b * 204.8 - 6, 4, 12); // thin white seams between bands
    const tex = new THREE.CanvasTexture(bands);
    tex.colorSpace = THREE.SRGBColorSpace;
    const column = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.25 }));
    column.position.y = 0.3;
    column.castShadow = true;
    scene.add(column);
    const pos = geo.attributes.position.array;

    return {
      scene, camera,
      update(t) {
        const amt = amounts(t);
        // the column also turns a quarter turn per loop on its plinth (it looks the same every 90 degrees);
        // the turn is applied before the deformers, so the bend always leans the same way
        const rho = t / 5 * TAU / 4, c = Math.cos(rho), s = Math.sin(rho);
        for (let i = 0; i < rest.length; i += 3) {
          const x = rest[i], z = rest[i + 2];
          pos.set(deform(x * c - z * s, rest[i + 1], x * s + z * c, amt), i);
        }
        geo.attributes.position.needsUpdate = true;
        geo.computeVertexNormals();
        geo.computeBoundingSphere();
        const az = -0.55 + 0.3 * Math.sin(t / 5 * TAU); // the camera sways gently round the column
        camera.position.set(17.5 * Math.sin(az), 4.6, 17.5 * Math.cos(az));
        camera.lookAt(0.9, 3.0, 0);
      },
    };
  },
  overlay(ctx, t, W, H) {
    const amt = amounts(t);
    const items = [['TWIST', '비틀기', `${Math.round(amt[0] * TWIST)}°`, '#FF7A59'], ['BEND', '구부리기', `${Math.round(amt[1] * BEND)}°`, '#118AB2'], ['TAPER', '테이퍼', `${Math.round(amt[2] * TAPER * 100)}%`, '#7B61FF']];
    items.forEach(([name, ko, value, color], i) => {
      const x = 60 + i * 330, y = 1690, a = amt[i];
      ctx.fillStyle = `rgba(255, 255, 255, ${0.55 + 0.4 * a})`;
      ctx.beginPath(); ctx.roundRect(x, y, 300, 150, 26); ctx.fill();
      ctx.strokeStyle = color; ctx.globalAlpha = 0.25 + 0.75 * a; ctx.lineWidth = 4; ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillStyle = '#2A2340'; ctx.font = `800 36px ${FONT.sans}`; ctx.fillText(name, x + 26, y + 50);
      ctx.fillStyle = color; ctx.font = `700 36px ${FONT.sans}`; ctx.fillText(value, x + 300 - 26 - ctx.measureText(value).width, y + 50);
      ctx.fillStyle = 'rgba(42, 35, 64, 0.7)'; ctx.font = `500 26px ${FONT.ko}`; ctx.fillText(ko, x + 26, y + 88);
      ctx.fillStyle = 'rgba(42, 35, 64, 0.12)'; ctx.beginPath(); ctx.roundRect(x + 26, y + 108, 248, 14, 7); ctx.fill();
      ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x + 26, y + 108, Math.max(14, 248 * a), 14, 7); ctx.fill();
    });
  },
};
