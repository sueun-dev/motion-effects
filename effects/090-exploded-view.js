// Exploded view: a phone built from separate parts (back, battery, board with chips, frame, screen, glass). Each part
// has its own lift; one eased value e(t) slides them apart along the stack axis, holds, and reassembles them.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TAU, phase, span, FONT } from '../lib/util.js';

const sine = k => 0.5 - 0.5 * Math.cos(Math.PI * k);
// a centred rounded rectangle w x d with corner radius r
function rrect(path, w, d, r) {
  const x = -w / 2, z = -d / 2;
  path.moveTo(x + r, z); path.lineTo(x + w - r, z); path.quadraticCurveTo(x + w, z, x + w, z + r);
  path.lineTo(x + w, z + d - r); path.quadraticCurveTo(x + w, z + d, x + w - r, z + d);
  path.lineTo(x + r, z + d); path.quadraticCurveTo(x, z + d, x, z + d - r); path.lineTo(x, z + r); path.quadraticCurveTo(x, z, x + r, z);
  return path;
}
// a flat part: the rounded rectangle extruded h upwards from y = 0 (with a hole of wall thickness `hole`, for the frame)
function slab(w, d, h, r, mat, hole = 0) {
  const shape = rrect(new THREE.Shape(), w, d, r);
  if (hole) shape.holes.push(rrect(new THREE.Path(), w - 2 * hole, d - 2 * hole, r - hole));
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 10 }).rotateX(-Math.PI / 2);
  return new THREE.Mesh(g, mat);
}

export default {
  name: 'Exploded View',
  ko: '분해도',
  three(renderer, W, H) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#E9ECF5');
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
    const sun = new THREE.DirectionalLight('#FFFFFF', 2.2);
    sun.position.set(3, 12, 4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
    scene.add(sun, new THREE.AmbientLight('#FFFFFF', 0.4));
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.18 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -1.2; ground.receiveShadow = true;
    scene.add(ground);

    const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, ...o });
    const wall = document.createElement('canvas'); wall.width = 280; wall.height = 580;
    const w = wall.getContext('2d'), gr = w.createLinearGradient(0, 0, 280, 580);
    gr.addColorStop(0, '#7B5CFF'); gr.addColorStop(0.55, '#FF5FA2'); gr.addColorStop(1, '#FFB36B');
    w.fillStyle = gr; w.fillRect(0, 0, 280, 580);
    w.fillStyle = '#FFFFFF'; w.font = `600 64px ${FONT.sans}`; w.textAlign = 'center'; w.fillText('9:41', 140, 130);
    const wallTex = new THREE.CanvasTexture(wall); wallTex.colorSpace = THREE.SRGBColorSpace;

    // parts and their lift when exploded; the phone lies flat (long side along z), parts stack up in y.
    // Inner parts are 0.04 smaller than the frame's hole, so no two faces ever share a plane.
    const parts = [];
    const add = (mesh, y, lift, z = 0) => { mesh.position.set(0, y, z); mesh.castShadow = mesh.receiveShadow = true; parts.push({ mesh, y, lift }); };
    add(slab(2.8, 5.8, 0.12, 0.3, std('#9AA8FF', { roughness: 0.3 })), 0.02, 0);         // back cover
    add(slab(2.2, 3.0, 0.16, 0.12, std('#2B2F3A')), 0.16, 1.1, 0.7);                       // battery
    const board = slab(2.4, 1.6, 0.06, 0.1, std('#1E8A6E'));
    for (const [x, z, sz] of [[-0.6, -0.25, 0.55], [0.35, -0.3, 0.4], [0.55, 0.35, 0.3], [-0.45, 0.45, 0.32]]) {
      const chip = slab(sz, sz, 0.08, 0.03, std('#20222B', { roughness: 0.3 })); chip.position.set(x, 0.06, z); board.add(chip);
    }
    add(board, 0.17, 1.1, -1.95);                                                           // logic board, beside the battery
    add(slab(3.0, 6.0, 0.42, 0.42, std('#C9CED8', { metalness: 1, roughness: 0.25 }), 0.08), 0, 2.1); // metal frame
    const screen = slab(2.8, 5.8, 0.05, 0.3, std('#0B0D14', { roughness: 0.2 }));
    const wallpaper = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 5.6), new THREE.MeshBasicMaterial({ map: wallTex }));
    wallpaper.rotation.x = -Math.PI / 2; wallpaper.position.y = 0.06; screen.add(wallpaper);
    add(screen, 0.335, 3.0);                                                                // display
    add(slab(3.0, 6.0, 0.05, 0.42, new THREE.MeshPhysicalMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.22, roughness: 0.05, clearcoat: 1 })), 0.43, 3.9); // cover glass
    parts.at(-1).mesh.castShadow = false;
    const phone = new THREE.Group();
    parts.forEach(p => phone.add(p.mesh));
    scene.add(phone);

    return {
      scene, camera,
      update(t) {
        const a = phase(t) * TAU, e = sine(span(t, 0.5, 1.7)) - sine(span(t, 3.2, 4.4));
        for (const p of parts) p.mesh.position.y = p.y + p.lift * 1.7 * e;
        phone.rotation.y = Math.PI / 2 - 0.25 + 0.25 * Math.sin(a); // long side across the screen, gently swaying
        phone.position.y = -3.3 * e; // keep the growing stack centred
        camera.position.set(0, 11, 23.6);
        camera.lookAt(0, 0.2, 0);
      },
    };
  },
};
