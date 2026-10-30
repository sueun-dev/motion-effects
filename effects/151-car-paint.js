// Car paint: a concept-car body (ParametricGeometry) in a two-layer MeshPhysicalMaterial: a red metallic base whose
// normal map is a sprinkle of tiny tilted flakes (they glitter in the key light), under a mirror-smooth clearcoat that
// keeps the plain body normal. The studio is a ring of long light strips round the car's length axis; turning it rolls
// the highlights up the flanks and over the roof, sharp in the clearcoat and soft in the base coat. Dark tinted glass.
import * as THREE from 'three';
import { ParametricGeometry } from 'three/addons/geometries/ParametricGeometry.js';
import { TAU, phase, rng, canvas, smoothstep, lerp } from '../lib/util.js';

const g = (x, mu, s) => Math.exp(-(((x - mu) / s) ** 2));
// side profile along s (-1 tail .. 1 nose), in metres: low nose, long hood, windscreen, roof, fastback, cut-off tail
const roofline = s => 0.45 + 0.42 * smoothstep(1, 0.45, s) + 0.36 * g(s, -0.15, 0.4);
const BELT = 0.9;                                                                     // where the glasshouse starts
const halfWidth = s => 0.95 - 0.14 * smoothstep(0.4, 1, s) - 0.06 * smoothstep(-0.6, -1, s);
const cabin = s => smoothstep(0.45, 0.15, s) * smoothstep(-0.8, -0.45, s);         // 1 where there is a glasshouse
const arch = s => g(s, 0.6, 0.15) + g(s, -0.6, 0.15);                              // wheel arches at both axles

// u along the body (0 tail, 1 nose), v round the cross-section: a rounded superellipse that pulls in above the belt
// line (the glasshouse) and below the fenders at the axles (the wheel arches)
function carBody(u, v, target) {
  const s = 2 * u - 1, phi = -v * TAU, end = Math.pow(Math.max(1 - s ** 8, 0), 0.25);
  const c = Math.cos(phi), sn = Math.sin(phi), bottom = 0.15;
  const top = roofline(s), y0 = (top + bottom) / 2, hh = (top - bottom) / 2;
  const y = y0 + hh * end * Math.sign(sn) * Math.abs(sn) ** (sn > 0 ? 0.5 : 0.36);
  const glass = smoothstep(BELT, top + 0.01, y) * cabin(s);
  const w = halfWidth(s) * lerp(1, 0.64, glass) * (1 - 0.3 * arch(s) * smoothstep(0.72, 0.5, y)) * end;
  target.set(w * Math.sign(c) * Math.abs(c) ** 0.36, y, 2.2 * s);
}

// metal flakes: about one texel in five is a flake tilted a little in a random direction, the rest is flat paint
function flakes(size) {
  const r = rng(151), data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const flake = r() < 0.2, a = r() * TAU, k = flake ? 0.25 + 0.35 * r() : 0, z = Math.sqrt(1 - k * k);
    data[i * 4] = (k * Math.cos(a) * 0.5 + 0.5) * 255; data[i * 4 + 1] = (k * Math.sin(a) * 0.5 + 0.5) * 255;
    data[i * 4 + 2] = (z * 0.5 + 0.5) * 255; data[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1.5, 1.5);
  t.anisotropy = 8;
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

export default {
  name: 'Car Paint',
  ko: '카 페인트',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    const bg = canvas(4, 512), b = bg.getContext('2d'), grd = b.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#040508'); grd.addColorStop(0.5, '#171A22'); grd.addColorStop(0.62, '#0B0C10'); grd.addColorStop(1, '#050507');
    b.fillStyle = grd; b.fillRect(0, 0, 4, 512);
    scene.background = new THREE.CanvasTexture(bg);
    scene.background.colorSpace = THREE.SRGBColorSpace;
    scene.fog = new THREE.Fog('#0D0E12', 14, 30);

    // the studio for reflections: eight long light strips (wide, thin, wide ...) parallel to the car, in a ring round
    // its length axis, and two round softboxes on that axis itself (cool in front, warm behind), which stay put while it turns
    const studio = new THREE.Scene();
    studio.background = new THREE.Color('#06070A');
    const lamp = new THREE.MeshBasicMaterial({ color: new THREE.Color(12, 12, 13) });
    for (let k = 0; k < 8; k++) {
      const q = k * TAU / 8, strip = new THREE.Mesh(new THREE.BoxGeometry(0.1, k % 2 ? 0.5 : 1.6, 40), lamp);
      strip.position.set(9 * Math.cos(q), 9 * Math.sin(q), 0);
      strip.rotation.z = q;
      studio.add(strip);
    }
    const disc = (color, z) => { // round, so turning about the axis leaves them as they are
      const m = new THREE.Mesh(new THREE.CircleGeometry(4, 64), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
      m.position.z = z;
      studio.add(m);
    };
    disc(new THREE.Color(1.2, 1.3, 1.5), 13);
    disc(new THREE.Color(1.6, 0.9, 0.45), -13);
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(studio, 0.0).texture;

    const camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 100);
    camera.position.set(5.6, 2.9, 9.2);
    camera.lookAt(0, 0.2, 0.2);

    // the body: paint, and a glasshouse with its own material (its triangles go in a second group); vertex colours
    // darken the paint towards the glass so the edge between them stays soft
    const geo = new ParametricGeometry(carBody, 360, 240);
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), glass = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      glass[i] = cabin(pos.getZ(i) / 2.2) * smoothstep(BELT + 0.03, BELT + 0.07, pos.getY(i));
      const intake = smoothstep(0.955, 0.975, Math.abs(pos.getZ(i)) / 2.2) * smoothstep(0.62, 0.5, pos.getY(i)); // black nose and tail panels
      col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = lerp(1, 0.05, Math.max(glass[i], intake));
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const tris = [[], []], idx = geo.index.array;
    for (let i = 0; i < idx.length; i += 3) {
      const k = glass[idx[i]] + glass[idx[i + 1]] + glass[idx[i + 2]] > 1.5 ? 1 : 0;
      tris[k].push(idx[i], idx[i + 1], idx[i + 2]);
    }
    geo.setIndex([...tris[0], ...tris[1]]);
    geo.addGroup(0, tris[0].length, 0);
    geo.addGroup(tris[0].length, tris[1].length, 1);
    // even texture coordinates for the flakes: length along the body and arc length round each cross-section
    const uv = geo.attributes.uv, ring = 361;
    for (let j = 0; j < ring; j++) {
      let arc = 0;
      for (let i = 0; i <= 240; i++) {
        const k = i * ring + j;
        if (i > 0) arc += Math.hypot(pos.getX(k) - pos.getX(k - ring), pos.getY(k) - pos.getY(k - ring));
        uv.setXY(k, pos.getZ(k) / 4.4, arc / 4.4);
      }
    }
    const paint = new THREE.MeshPhysicalMaterial({
      color: '#900A16', vertexColors: true, metalness: 0.6, roughness: 0.4,
      normalMap: flakes(512), normalScale: new THREE.Vector2(0.7, 0.7),
      clearcoat: 1, clearcoatRoughness: 0.01,
    });
    const tinted = new THREE.MeshPhysicalMaterial({ color: '#040506', roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.01 });
    const car = new THREE.Group();
    const body = new THREE.Mesh(geo, [paint, tinted]);
    body.castShadow = true;
    car.add(body);

    // tyres with silver hubs, tucked under the fenders
    const tyre = new THREE.MeshStandardMaterial({ color: '#0C0C0E', roughness: 0.75 });
    const hub = new THREE.MeshStandardMaterial({ color: '#C9CDD4', metalness: 1, roughness: 0.25 });
    for (const zs of [-1, 1]) for (const xs of [-1, 1]) {
      const wheel = new THREE.Group();
      wheel.add(new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.24, 64), tyre));
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.25, 64), hub);
      wheel.add(disc);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(xs * 0.8, 0.33, zs * 2.2 * 0.6);
      wheel.traverse(m => { m.castShadow = true; });
      car.add(wheel);
    }
    const mirror = car.clone(); // seen through the glossy, half-clear floor: the car's reflection
    mirror.scale.y = -1;
    scene.add(car, mirror);

    const sun = new THREE.DirectionalLight('#FFF6EA', 1.6); // key light: makes the flakes glitter
    sun.position.set(2, 7, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 20 });
    sun.shadow.radius = 8;
    scene.add(sun);
    // a dark glossy floor, partly see-through so the mirrored car shows as its reflection; its own dim reflections
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({
      color: '#0E0F13', roughness: 0.45, envMap: scene.environment, envMapIntensity: 0.05, transparent: true, opacity: 0.86,
    }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    return {
      scene, camera,
      update(t) {
        // the strip ring turns 90° per loop (it repeats every 90°): the long highlights roll up the flank and over the roof
        scene.environmentRotation.z = phase(t) * TAU / 4;
      },
    };
  },
};
