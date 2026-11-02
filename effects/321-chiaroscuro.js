// Chiaroscuro (tenebrism): a still life on an old table, a pewter jug, a wine bottle, apples, a pear, grapes, books, a cloth and
// a knife over the edge, lit by one candle and nothing else. The light falls off with the square of the distance and
// casts soft shadows, so whatever the flame comes near steps out of deep black and sinks back as it moves on. The
// candle glides across the front of the table and back; its flame is a smooth teardrop of constant size and brightness
// that only leans gently against the motion, so it never flickers. A fixed canvas weave and a vignette sit on top like varnish.
import * as THREE from 'three';
import { TAU, canvas, rng } from '../lib/util.js';

const LIGHT = '#FFB061';
let weave = null;

// the candle's path: across the front of the table and back, a little nearer at the ends
const path = t => {
  const a = TAU * t / 5;
  return [0.7 * Math.sin(a), 0.6 - 0.1 * Math.cos(2 * a)];
};

function woodTex() {
  const c = canvas(1024, 512), g = c.getContext('2d'), r = rng(321);
  g.fillStyle = '#3A2516'; g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 160; i++) {
    const y = r() * 512, a = 0.04 + 0.08 * r();
    g.strokeStyle = r() < 0.5 ? `rgba(110, 70, 40, ${a})` : `rgba(15, 8, 4, ${a * 1.5})`; g.lineWidth = 1 + r() * 4;
    g.beginPath();
    for (let x = 0; x <= 1024; x += 32) g.lineTo(x, y + 6 * Math.sin(x / 140 + i) + 3 * Math.sin(x / 37 + i * 2));
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export default {
  name: 'Chiaroscuro',
  ko: '키아로스쿠로',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#050403');
    const camera = new THREE.PerspectiveCamera(28, W / H, 0.1, 40);
    camera.position.set(0, 4.6, 7.6);
    camera.lookAt(0, 0.95, 0.15);

    const add = (geo, mat, x, y, z, parent = scene) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
    };
    const mat = (color, rough, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
    const lathe = (pts, n = 64) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), n);

    // the room: a dark plaster wall and a heavy table
    add(new THREE.PlaneGeometry(14, 8), mat('#3E3328', 0.95), 0, 3, -2.6);
    const table = add(new THREE.BoxGeometry(7, 0.24, 3.4), mat('#FFFFFF', 0.55, { map: woodTex() }), 0, -0.12, -0.3);
    table.receiveShadow = true;
    // a white cloth lying over the right of the table, its folds hanging over the front edge
    const cloth = new THREE.PlaneGeometry(1.8, 3.4, 90, 170), cp = cloth.attributes.position;
    for (let i = 0; i < cp.count; i++) {
      const x = cp.getX(i), u = cp.getY(i) + 1.7;                          // u: 0 at the back, 3.4 at the hem
      const flat = Math.min(u, 2.55), drop = Math.max(0, u - 2.55);
      const fold = 0.035 * Math.sin(x * 5 + u * 1.3) + 0.02 * Math.sin(x * 11 - u * 2.1);
      const hang = 0.07 * Math.sin(x * 7) + 0.03 * Math.sin(x * 15 + 1);
      cp.setXYZ(i, x + (x < -0.85 ? 0.03 * Math.sin(u * 6) : 0), 0.012 + Math.max(0, fold + 0.03) * 0.5 * (flat < 2.5 ? 1 : 0) - drop, -1.15 + flat + Math.min(drop, 0.25) * (hang + 0.11) / 0.25);
    }
    cloth.computeVertexNormals();
    add(cloth, mat('#B4AC9C', 0.9, { side: THREE.DoubleSide }), 0.95, 0, 0);

    // pewter jug with a handle
    const jug = add(lathe([[0, 0], [0.34, 0], [0.4, 0.06], [0.44, 0.35], [0.42, 0.7], [0.3, 1.0], [0.24, 1.18], [0.27, 1.38], [0.33, 1.5], [0.31, 1.52], [0.22, 1.42], [0.2, 1.2]]), mat('#9A968C', 0.38, { metalness: 0.75 }), -0.55, 0, -1.15);
    const handle = add(new THREE.TorusGeometry(0.3, 0.045, 16, 48, Math.PI * 1.15), jug.material, 0, 0, 0, jug);
    handle.position.set(-0.36, 1.0, 0); handle.rotation.z = Math.PI * 0.45;
    // a dark green wine bottle, apples, a pear, a pewter plate with grapes
    const r = rng(7);
    add(lathe([[0, 0], [0.22, 0], [0.24, 0.03], [0.24, 0.72], [0.2, 0.84], [0.1, 0.96], [0.075, 1.02], [0.075, 1.3], [0.09, 1.32], [0.09, 1.36], [0, 1.36]]),
      new THREE.MeshPhysicalMaterial({ color: '#2F5A35', roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12 }), 0.12, 0, -1.25);
    const apple = lathe([[0, -0.02], [0.12, 0], [0.2, 0.06], [0.24, 0.18], [0.22, 0.3], [0.15, 0.38], [0.05, 0.36], [0, 0.32]], 48);
    for (const [x, z, c] of [[-0.56, -0.3, '#9C1E14'], [-0.25, -0.1, '#C2391C'], [-0.8, -0.02, '#B58A26']]) {
      add(apple, mat(c, 0.42), x, 0, z).rotation.set(r() * 0.3, r() * TAU, r() * 0.2);
    }
    add(lathe([[0, 0], [0.16, 0.03], [0.2, 0.14], [0.15, 0.3], [0.09, 0.42], [0.07, 0.56], [0.03, 0.62], [0, 0.62]], 48), mat('#A89A3A', 0.5), 0.36, 0.05, -0.25).rotation.z = 0.12;
    add(lathe([[0, 0], [0.5, 0], [0.56, 0.04], [0.6, 0.06], [0.58, 0.07], [0.5, 0.03], [0, 0.03]], 64), mat('#8E8B84', 0.32, { metalness: 0.7 }), 0.72, 0.045, -0.32).scale.set(0.8, 1, 0.8);
    for (let k = 0; k < 22; k++) {
      const a = r() * TAU, rr = 0.2 * Math.sqrt(r()), y = 0.12 + 0.2 * r();
      add(new THREE.SphereGeometry(0.075, 20, 12), mat('#3A1A3E', 0.3), 0.74 + rr * Math.cos(a) * (1 - y), y + 0.03, -0.34 + rr * Math.sin(a) * 0.8);
    }
    // two old books, leather covers and cream page edges, and a knife over the table edge
    const book = (w, h, d, x, y, z, rot, c) => {
      const cover = mat(c, 0.6), pages = mat('#D9CDB0', 0.9);
      const b = add(new THREE.BoxGeometry(w, h, d), [pages, cover, cover, cover, pages, pages], x, y, z);
      b.rotation.y = rot; return b;
    };
    book(0.74, 0.2, 1.0, 0.72, 0.14, -1.35, Math.PI / 2 + 0.25, '#8A3A22');   // spines toward us
    book(0.62, 0.16, 0.86, 0.7, 0.32, -1.33, Math.PI / 2 + 0.06, '#4A5E34');
    const knife = new THREE.Group();
    add(new THREE.BoxGeometry(0.7, 0.012, 0.09), mat('#C9C6BE', 0.25, { metalness: 0.9 }), 0.35, 0, 0, knife);
    add(new THREE.BoxGeometry(0.42, 0.06, 0.07), mat('#3A2414', 0.6), -0.2, 0.01, 0, knife);
    knife.position.set(-0.25, 0.065, 1.3); knife.rotation.y = 0.35; scene.add(knife);

    // the candle: brass chamberstick, a cream candle, a wick, a teardrop flame and a soft halo
    const candle = new THREE.Group(); scene.add(candle);
    const brass = mat('#B08A3E', 0.45, { metalness: 0.85 });
    add(lathe([[0, 0], [0.24, 0], [0.26, 0.025], [0.24, 0.04], [0.07, 0.05], [0.05, 0.16], [0.09, 0.19], [0.09, 0.22], [0, 0.22]]), brass, 0, 0, 0, candle);
    const glowC = canvas(4, 256), gg = glowC.getContext('2d'), ggr = gg.createLinearGradient(0, 0, 0, 256); // wax lit from inside near the top
    ggr.addColorStop(0, '#FFC27A'); ggr.addColorStop(0.35, '#7A3A12'); ggr.addColorStop(1, '#000000');
    gg.fillStyle = ggr; gg.fillRect(0, 0, 4, 256);
    const glowTex = new THREE.CanvasTexture(glowC); glowTex.colorSpace = THREE.SRGBColorSpace;
    const wax = new THREE.MeshStandardMaterial({ color: '#EFE3C6', roughness: 0.6, emissive: '#FFFFFF', emissiveMap: glowTex, emissiveIntensity: 0.9 });
    add(new THREE.CylinderGeometry(0.06, 0.065, 0.46, 32, 1, true), wax, 0, 0.45, 0, candle).castShadow = false;
    const cap = add(new THREE.CircleGeometry(0.06, 32), wax, 0, 0.68, 0, candle);
    cap.rotation.x = -Math.PI / 2; cap.castShadow = false;
    add(new THREE.CylinderGeometry(0.005, 0.005, 0.04, 6), mat('#1A120C', 0.9), 0, 0.7, 0, candle).castShadow = false;
    const flameMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying float vY; varying vec3 vN; void main() { vY = position.y; vN = normalMatrix * normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying float vY; varying vec3 vN;
        void main() {
          float h = clamp(vY / 0.2, 0.0, 1.0), rim = abs(normalize(vN).z);
          vec3 c = mix(vec3(1.0, 0.98, 0.85), vec3(1.0, 0.55, 0.15), smoothstep(0.25, 1.0, h));
          c = mix(vec3(0.35, 0.45, 1.0), c, smoothstep(0.0, 0.12, h));          // the blue root
          gl_FragColor = vec4(c * (0.55 + 0.6 * rim), 0.9 * (0.4 + 0.6 * rim));
        }`,
    });
    const flamePivot = new THREE.Group(); flamePivot.position.y = 0.705; candle.add(flamePivot);
    const flame = new THREE.Mesh(lathe([[0, 0], [0.022, 0.015], [0.034, 0.05], [0.03, 0.1], [0.018, 0.15], [0, 0.2]], 32), flameMat);
    flamePivot.add(flame);
    const halo = document.createElement('canvas'); halo.width = halo.height = 256;
    const hg = halo.getContext('2d'), hgr = hg.createRadialGradient(128, 128, 0, 128, 128, 128);
    hgr.addColorStop(0, 'rgba(255, 200, 120, 0.5)'); hgr.addColorStop(0.15, 'rgba(255, 160, 80, 0.16)'); hgr.addColorStop(0.5, 'rgba(255, 140, 60, 0.04)'); hgr.addColorStop(1, 'rgba(255, 140, 60, 0)');
    hg.fillStyle = hgr; hg.fillRect(0, 0, 256, 256);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(halo), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    sprite.scale.setScalar(1.8); sprite.position.y = 0.06; flamePivot.add(sprite);
    // the only light in the room
    const light = new THREE.PointLight(LIGHT, 5.5, 0, 2);
    light.castShadow = true; light.shadow.mapSize.set(2048, 2048); light.shadow.bias = -0.002; light.shadow.normalBias = 0.02; light.shadow.radius = 4;
    light.position.y = 0.06; flamePivot.add(light);

    // varnish: a fixed canvas weave and a vignette, drawn over every frame
    weave = canvas(W, H);
    const wg = weave.getContext('2d'), wr = rng(11);
    const vig = wg.createRadialGradient(W / 2, H * 0.55, H * 0.2, W / 2, H * 0.55, H * 0.75);
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)'); vig.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
    wg.fillStyle = vig; wg.fillRect(0, 0, W, H);
    for (let i = 0; i < 9000; i++) {
      wg.fillStyle = wr() < 0.5 ? 'rgba(255, 230, 200, 0.025)' : 'rgba(0, 0, 0, 0.04)';
      wg.fillRect(wr() * W, wr() * H, 1 + wr() * 3, 1 + wr() * 3);
    }

    return {
      scene, camera,
      update(t) {
        const [x, z] = path(t), [x2, z2] = path(t + 0.05);
        candle.position.set(x, 0, z);
        const vx = (x2 - x) / 0.05, vz = (z2 - z) / 0.05;
        flamePivot.rotation.z = 0.06 * vx;                  // the flame leans back from the way it moves
        flamePivot.rotation.x = -0.06 * vz;
      },
    };
  },
  overlay(ctx) { ctx.drawImage(weave, 0, 0); },
};
