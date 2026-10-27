// Tile flip: the frame is a 6 x 10 grid of thin boxes; front faces map their piece of scene A, back faces scene B
// (UVs cut per tile). A slanted wave runs down the rows, turning each tile 180 degrees about its vertical axis while
// lifting it toward the camera.
import * as THREE from 'three';
import { span, smoothstep, canvas } from '../lib/util.js';
import { landscape, city } from '../lib/scenes.js';

const COLS = 6, ROWS = 10, DEPTH = 16, LIFT = 140;

function texture(paint, W, H) {
  const c = canvas(W, H);
  paint(c.getContext('2d'), W, H);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// tile turn 0 -> 1 in A->B (0.4-2.1 s) and 1 -> 2 in B->A (2.9-4.6 s), later for tiles further along the diagonal
function turn(t, d) {
  const one = p => smoothstep(d, d + 0.4, p);
  return one(span(t, 0.4, 2.1)) + one(span(t, 2.9, 4.6));
}

export default {
  name: 'Tile Flip',
  ko: '타일 플립',
  three(renderer, W, H) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#151026');
    const fov = 25, dist = H / 2 / Math.tan((fov / 2) * Math.PI / 180); // front faces fill the frame exactly at rest
    const camera = new THREE.PerspectiveCamera(fov, W / H, 10, dist * 4);
    camera.position.set(0, 0, dist + DEPTH / 2);

    const texA = texture((c, w, h) => landscape(c, w, h, 0), W, H), texB = texture(city, W, H);
    const tw = W / COLS, th = H / ROWS, tiles = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const geo = new THREE.BoxGeometry(tw, th, DEPTH);
        const uv = geo.attributes.uv; // faces 4 (front) and 5 (back) = vertices 16..23: cut out this tile's piece
        for (let v = 16; v < 24; v++) uv.setXY(v, (c + uv.getX(v)) / COLS, 1 - (r + 1 - uv.getY(v)) / ROWS);
        const side = new THREE.MeshBasicMaterial({ color: '#4A3D6E' });
        const mats = [side, side, side, side, new THREE.MeshBasicMaterial({ map: texA }), new THREE.MeshBasicMaterial({ map: texB })];
        const mesh = new THREE.Mesh(geo, mats);
        mesh.position.set(-W / 2 + (c + 0.5) * tw, H / 2 - (r + 0.5) * th, 0);
        scene.add(mesh);
        tiles.push({ mesh, mats, d: 0.6 * (r + 0.4 * c) / (ROWS - 1 + 0.4 * (COLS - 1)) }); // a slanted wave down the rows
      }
    }
    return {
      scene, camera,
      update(t) {
        for (const { mesh, mats, d } of tiles) {
          const a = Math.PI * turn(t, d);
          mesh.rotation.y = a;
          mesh.position.z = LIFT * Math.sin(a) ** 2;
          const light = 0.4 + 0.6 * Math.cos(a) ** 2; // darker while edge-on
          mats[4].color.setScalar(light); mats[5].color.setScalar(light);
        }
      },
    };
  },
};
