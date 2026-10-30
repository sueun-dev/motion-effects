// Turntable: a hero product shot. An amber glass perfume bottle with a faceted gold cap turns once on a black
// mirror turntable in a seamless studio sweep. The reflections come from an environment built from three softboxes
// (a big key, two tall strips), so bright strips slide across the glass and gold as it turns.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { TAU, FONT } from '../lib/util.js';

const TOP = 0.62; // height of the turntable surface

// a dark studio with three glowing softboxes, used only for reflections (prefiltered into an environment map)
function studio() {
  const env = new THREE.Scene();
  env.background = new THREE.Color('#0B0806');
  const box = (w, h, x, y, z, color, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 1, 0);
    env.add(m);
  };
  box(7, 5, -7, 4, 6, '#FFF3E4', 5);   // key softbox, front left
  box(1.3, 9, 7, 3, 2, '#FFFFFF', 7);  // strip, right
  box(1.3, 9, -4, 3, -7, '#FFE2C2', 5); // strip, back left
  box(5, 5, 0, 10, 0, '#FFFFFF', 2);   // overhead
  return env;
}

// the seamless paper sweep: a floor that curves up into a back wall
function sweep() {
  const geo = new THREE.PlaneGeometry(40, 1, 1, 160), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const s = (p.getY(i) + 0.5) * 34; // distance along the profile, from the front edge
    let y = 0, z = 12 - s;
    if (s > 16) { const a = Math.min((s - 16) / 6, Math.PI / 2); y = 6 - 6 * Math.cos(a); z = -4 - 6 * Math.sin(a); }
    if (s > 16 + 3 * Math.PI) { y = 6 + (s - 16 - 3 * Math.PI); z = -10; }
    p.setXYZ(i, p.getX(i), y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

function labelTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 320;
  const g = c.getContext('2d');
  g.fillStyle = '#D9B672'; g.fillRect(0, 0, 512, 320);
  g.strokeStyle = '#7A5A24'; g.lineWidth = 4; g.strokeRect(18, 18, 476, 284);
  g.fillStyle = '#3A2810'; g.textAlign = 'center';
  g.font = `600 112px ${FONT.serif}`; g.fillText('AMBRE', 256, 170);
  g.font = `500 30px ${FONT.sans}`; g.fillText('E A U   D E   P A R F U M', 256, 240);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export default {
  name: 'Turntable',
  ko: '턴테이블',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#1A120E');
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(studio(), 0.02).texture;

    const camera = new THREE.PerspectiveCamera(26, W / H, 0.1, 100);
    camera.position.set(0, 3.4, 17);
    camera.lookAt(0, 2.05, 0);

    const paper = new THREE.Mesh(sweep(), new THREE.MeshStandardMaterial({ color: '#6B4C3E', roughness: 0.9, envMapIntensity: 0.15 }));
    paper.receiveShadow = true;
    scene.add(paper);
    // a warm spot makes a pool of light on the sweep and the soft shadow; a cool rim from behind
    const spot = new THREE.SpotLight('#FFE6C9', 260, 30, 0.42, 0.9, 1.6);
    spot.position.set(-3.5, 9, 6);
    spot.target.position.set(0, 0.8, -0.8);
    spot.castShadow = true;
    spot.shadow.mapSize.set(2048, 2048);
    spot.shadow.radius = 6;
    spot.shadow.bias = -0.0002;
    const rim = new THREE.DirectionalLight('#BFD8FF', 1.2);
    rim.position.set(4, 5, -6);
    scene.add(spot, spot.target, rim, new THREE.HemisphereLight('#FFEEDD', '#2A1A12', 0.25));

    // podium: a fixed base and a turning black mirror disc with a brushed gold rim
    const black = new THREE.MeshPhysicalMaterial({ color: '#0E0C0B', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 });
    const gold = new THREE.MeshStandardMaterial({ color: '#E3BE73', metalness: 1, roughness: 0.22 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.15, 0.4, 128), black);
    base.position.y = 0.2;
    base.castShadow = base.receiveShadow = true;
    scene.add(base);
    const table = new THREE.Group();
    table.position.y = 0.4;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, TOP - 0.4 - 0.004, 128), black);
    disc.position.y = (TOP - 0.4) / 2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.035, 16, 200), gold);
    ring.rotation.x = Math.PI / 2; ring.position.y = TOP - 0.4;
    const mirror = new Reflector(new THREE.CircleGeometry(1.73, 128), { textureWidth: 1024, textureHeight: 1024, color: '#5E5A57', multisample: 4 });
    mirror.rotation.x = -Math.PI / 2; mirror.position.y = TOP - 0.4;
    // gold dots round the rim show the turn
    for (let k = 0; k < 24; k++) {
      const a = k / 24 * TAU, dot = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 16), gold);
      dot.position.set(1.6 * Math.cos(a), TOP - 0.4 + 0.004, 1.6 * Math.sin(a));
      table.add(dot);
    }
    table.add(disc, ring, mirror);
    scene.add(table);

    // the bottle: amber glass body (transmission), gold collar, faceted gold cap, label on the front
    const bottle = new THREE.Group();
    bottle.position.y = TOP - 0.4;
    const glass = new THREE.MeshPhysicalMaterial({
      color: '#FFFFFF', transmission: 1, thickness: 0.9, roughness: 0.03, ior: 1.5,
      attenuationColor: '#F0A040', attenuationDistance: 1.3, clearcoat: 1, clearcoatRoughness: 0.02, specularIntensity: 1,
    });
    const body = new THREE.Mesh(new RoundedBoxGeometry(1.45, 1.8, 0.8, 8, 0.24), glass);
    body.position.y = 0.9;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.2, 48), gold);
    collar.position.y = 1.88;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.78, 8), gold);
    cap.position.y = 2.36;
    cap.rotation.y = Math.PI / 8;
    const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.06, 8), new THREE.MeshStandardMaterial({ color: '#2A1E14', metalness: 0.6, roughness: 0.25 }));
    capTop.position.y = 2.78; capTop.rotation.y = Math.PI / 8;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), new THREE.MeshStandardMaterial({ map: labelTexture(), metalness: 0.7, roughness: 0.35 }));
    label.position.set(0, 0.95, 0.402);
    for (const m of [body, collar, cap, capTop]) m.castShadow = true;
    bottle.add(body, collar, cap, capTop, label);
    table.add(bottle);

    return {
      scene, camera,
      update(t) {
        table.rotation.y = t / 5 * TAU; // one full turn per loop
      },
    };
  },
};
