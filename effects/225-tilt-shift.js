// Tilt-shift: a small 3D town seen from high up, blurred above and below a sharp horizontal band (a separable
// Gaussian whose radius grows with distance from the band, by screen row, not by depth) and pushed to stronger colour.
// That is what a tilted lens does to a real street, and it makes the town read as a tabletop model. Toy cars circle
// the blocks and a Ferris wheel turns.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { TAU, rng } from '../lib/util.js';

const BLOCK = 6, ROAD = 1.6, NB = 7; // block pitch, road width, blocks per side
const BAND = 1080, HALF = 150, RAMP = 560, MAXBLUR = 15; // sharp band centre and half height, ramp, max sigma (px)

// one blur direction; the radius depends on the pixel's row; the second pass also lifts the saturation
const blurShader = (dir, saturate) => ({
  uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2(...dir) }, uSize: { value: new THREE.Vector2(1080, 1920) } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 uDir, uSize; varying vec2 vUv;
    void main() {
      float row = (1.0 - vUv.y) * uSize.y;                       // pixels from the top
      float sigma = ${MAXBLUR.toFixed(1)} * smoothstep(${HALF.toFixed(1)}, ${(HALF + RAMP).toFixed(1)}, abs(row - ${BAND.toFixed(1)}));
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      if (sigma > 0.25) {
        float step = max(1.0, sigma / 6.0), wsum = 0.0;
        col = vec3(0.0);
        for (int i = -18; i <= 18; i++) {
          float x = float(i) * step, w = exp(-0.5 * x * x / (sigma * sigma));
          col += w * texture2D(tDiffuse, vUv + uDir * x / uSize).rgb;
          wsum += w;
        }
        col /= wsum;
      }
      ${saturate ? 'float l = dot(col, vec3(0.2126, 0.7152, 0.0722)); col = max(mix(vec3(l), col, 1.35), 0.0);' : ''}
      gl_FragColor = vec4(col, 1.0);
    }`,
});

// a rounded-rectangle lap round the block centred at (cx, cz), in the lane nearest it, by distance travelled
function loopPath(cx, cz) {
  const h = (BLOCK - ROAD) / 2 + ROAD * 0.27, r = 0.7, side = 2 * (h - r), arc = Math.PI / 2 * r;
  const len = 4 * (side + arc);
  return {
    len,
    at(s) { // position and heading at distance s (counter-clockwise seen from above)
      s = ((s % len) + len) % len;
      const k = Math.floor(s / (side + arc)), u = s - k * (side + arc);
      let x, z, a;
      if (u < side) { x = h; z = -(h - r) + u; a = 0; } // straight up the +x side, heading +z
      else { const q = (u - side) / r; x = h - r + r * Math.cos(q); z = h - r + r * Math.sin(q); a = q; }
      const c = Math.cos(k * Math.PI / 2), s2 = Math.sin(k * Math.PI / 2); // rotate the side into place
      return [cx + x * c - z * s2, cz + x * s2 + z * c, -(a + k * Math.PI / 2)];
    },
  };
}

export default {
  name: 'Tilt-Shift',
  ko: '틸트 시프트',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#BFE3F2');
    scene.fog = new THREE.Fog('#BFE3F2', 40, 75);
    const camera = new THREE.PerspectiveCamera(32, W / H, 0.5, 200);
    camera.position.set(-6, 30, 27);
    camera.lookAt(0, 0, -1);

    scene.add(new THREE.HemisphereLight('#FFFFFF', '#7FA36B', 1.3));
    const sun = new THREE.DirectionalLight('#FFF1DC', 2.6);
    sun.position.set(-18, 30, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 90 });
    sun.shadow.bias = -0.0004;
    scene.add(sun);

    const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 });
    const add = (geo, m, x, y, z, ry = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = o.receiveShadow = true; scene.add(o); return o; };
    const ground = add(new THREE.PlaneGeometry(120, 120), mat('#8DBF6E'), 0, 0, 0);
    ground.rotation.x = -Math.PI / 2;
    const span = NB * BLOCK;
    const asphalt = mat('#5C5F6B'), stripe = new THREE.MeshBasicMaterial({ color: '#F4E9C8' });
    for (let k = 0; k <= NB; k++) { // roads both ways, with a dashed centre line
      const p = -span / 2 + k * BLOCK;
      add(new THREE.BoxGeometry(span + ROAD, 0.04, ROAD), asphalt, 0, 0.02, p).receiveShadow = true;
      add(new THREE.BoxGeometry(ROAD, 0.04, span + ROAD), asphalt, p, 0.021, 0).receiveShadow = true;
      for (let d = -span / 2; d < span / 2; d += 1.2) {
        add(new THREE.BoxGeometry(0.5, 0.01, 0.07), stripe, d + 0.6, 0.045, p).castShadow = false;
        add(new THREE.BoxGeometry(0.07, 0.01, 0.5), stripe, p, 0.045, d + 0.6).castShadow = false;
      }
    }

    // blocks: houses with pitched roofs, a few taller flats, parks with round trees; one block holds the Ferris wheel
    const r = rng(225), walls = ['#FFF4E0', '#FCE1D4', '#E4F1F7', '#FFF0B8', '#E9E1F7'], roofs = ['#E4572E', '#3A86FF', '#2EC4B6', '#FF8C42', '#8E6CDB'];
    const roofGeo = new THREE.CylinderGeometry(0.01, 1.0, 0.8, 4, 1);
    roofGeo.rotateY(Math.PI / 4);
    const trunk = mat('#7A5230'), leaves = [mat('#4E9F3D'), mat('#6BBF59'), mat('#3D8B37')];
    const tree = (x, z, s) => { add(new THREE.CylinderGeometry(0.08 * s, 0.1 * s, 0.6 * s, 8), trunk, x, 0.3 * s, z); add(new THREE.SphereGeometry(0.5 * s, 16, 12), leaves[Math.floor(r() * 3)], x, 0.85 * s, z); };
    let wheel = null;
    for (let i = 0; i < NB; i++) for (let j = 0; j < NB; j++) {
      const cx = -span / 2 + (i + 0.5) * BLOCK, cz = -span / 2 + (j + 0.5) * BLOCK, kind = r();
      add(new THREE.BoxGeometry(BLOCK - ROAD, 0.12, BLOCK - ROAD), mat(kind < 0.18 ? '#7DBA5B' : '#D9D2C3'), cx, 0.06, cz);
      if (i === 3 && j === 3) { // the fair: a Ferris wheel with eight cabins
        wheel = new THREE.Group();
        wheel.position.set(cx, 2.6, cz);
        const ringM = mat('#F25C54');
        wheel.add(new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.07, 10, 64), ringM));
        for (let k = 0; k < 8; k++) {
          const a = k / 8 * TAU, spoke = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.1, 0.06), mat('#FFFFFF'));
          spoke.position.set(Math.cos(a) * 1.05, Math.sin(a) * 1.05, 0); spoke.rotation.z = a - Math.PI / 2;
          const cab = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), mat(k % 2 ? '#3A86FF' : '#FFC93C'));
          cab.position.set(Math.cos(a) * 2.1, Math.sin(a) * 2.1 - 0.25, 0); cab.userData.a = a;
          wheel.add(spoke, cab);
        }
        wheel.traverse(o => { o.castShadow = true; });
        scene.add(wheel);
        for (const x of [-0.9, 0.9]) add(new THREE.BoxGeometry(0.12, 2.8, 0.12), mat('#FFFFFF'), cx, 1.3, cz + x * 0.5).rotation.x = x * 0.25;
        continue;
      }
      if (kind < 0.18) { for (let k = 0; k < 5; k++) tree(cx + (r() - 0.5) * 3.4, cz + (r() - 0.5) * 3.4, 0.9 + 0.5 * r()); continue; }
      if (kind < 0.3) { // a block of flats
        const hgt = 2.5 + 2.5 * r();
        add(new THREE.BoxGeometry(3.2, hgt, 3.0), mat(walls[Math.floor(r() * 5)]), cx, 0.12 + hgt / 2, cz);
        add(new THREE.BoxGeometry(3.3, 0.15, 3.1), mat('#9AA0AE'), cx, 0.12 + hgt + 0.07, cz);
        continue;
      }
      for (const [dx, dz] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) {
        if (r() < 0.15) { tree(cx + dx, cz + dz, 1.1); continue; }
        const w = 1.4 + 0.3 * r(), hh = 0.9 + 0.5 * r(), x = cx + dx, z = cz + dz, ry = r() < 0.5 ? 0 : Math.PI / 2;
        add(new THREE.BoxGeometry(w, hh, w), mat(walls[Math.floor(r() * 5)]), x, 0.12 + hh / 2, z, ry);
        const roof = add(roofGeo, mat(roofs[Math.floor(r() * 5)]), x, 0.12 + hh + 0.4, z, ry);
        roof.scale.set(w * 0.75, 1, w * 0.75);
      }
    }

    // toy cars: two per block loop, so every road carries traffic both ways; one lap per 5 s loop
    const carColors = ['#E63946', '#F1C40F', '#2A9D8F', '#3A86FF', '#FFFFFF', '#FF7F50', '#6A4C93'];
    const body = new THREE.BoxGeometry(0.5, 0.26, 0.95), cabin = new THREE.BoxGeometry(0.42, 0.2, 0.5);
    const cars = [];
    for (let i = 0; i < NB; i++) for (let j = 0; j < NB; j++) {
      const path = loopPath(-span / 2 + (i + 0.5) * BLOCK, -span / 2 + (j + 0.5) * BLOCK);
      for (let k = 0; k < 2; k++) {
        const car = new THREE.Group();
        const b = new THREE.Mesh(body, mat(carColors[Math.floor(r() * carColors.length)])); b.position.y = 0.22;
        const c = new THREE.Mesh(cabin, mat('#DCE8F2')); c.position.set(0, 0.45, -0.05);
        car.add(b, c);
        car.traverse(o => { o.castShadow = true; });
        scene.add(car);
        cars.push({ car, path, s0: k / 2 * path.len + r() * 2 });
      }
    }

    const target = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
    const composer = new EffectComposer(renderer, target);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new ShaderPass(blurShader([1, 0], false)));
    composer.addPass(new ShaderPass(blurShader([0, 1], true)));
    composer.addPass(new OutputPass());

    return {
      scene, camera,
      render(t) {
        const u = t / 5;
        for (const { car, path, s0 } of cars) {
          const [x, z, a] = path.at(s0 + u * path.len);
          car.position.set(x, 0.04, z);
          car.rotation.y = a;
        }
        wheel.rotation.z = u * TAU / 4; // a quarter turn: cabins alternate in two colours, so it lines up again
        wheel.children.forEach(o => { if (o.userData.a !== undefined) o.rotation.z = -wheel.rotation.z; });
        composer.render();
      },
    };
  },
};
