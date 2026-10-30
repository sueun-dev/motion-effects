// Marching cubes: six metaballs make a scalar field on a 32^3 grid, and three.js MarchingCubes turns the cells that
// straddle the iso value into triangles (flat shaded, so the facets show). A scan plane marches up through the box
// (and drops back fast): below it the polygonised mesh, cut open; above it only a faint ghost; on it the field itself, as a
// heat map with the grid's sample points (lit inside the surface) and the iso contour, the slice the cubes march through.
import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { TAU, phase, span, ease } from '../lib/util.js';

const RES = 32, S = 2, STRENGTH = 2.6, SUB = 12, ISO = 80; // grid, half size of the box (world), metaball field
const COLORS = ['#FF6B6B', '#FFC145', '#2EC4B6', '#8E7DFF', '#FF7EDB', '#9BE564'];
// ball k at time t, in field units (0..1): small looping orbits with whole-number frequencies
function ball(k, a) {
  const p = k * 1.7;
  return [0.5 + 0.25 * Math.sin(a + p) + 0.05 * Math.cos(2 * a + p * 2),
    0.5 + 0.24 * Math.cos(a * (k % 2 ? 1 : -1) + p * 1.3),
    0.5 + 0.25 * Math.sin(a + p * 0.7 + 1.0) * Math.cos(a - p)];
}

export default {
  name: 'Marching Cubes',
  ko: '마칭 큐브',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.localClippingEnabled = true;
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas'); bg.width = 4; bg.height = 256;
    const b = bg.getContext('2d'), grd = b.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#0A1022'); grd.addColorStop(0.55, '#14213F'); grd.addColorStop(1, '#0B1326');
    b.fillStyle = grd; b.fillRect(0, 0, 4, 256);
    scene.background = new THREE.CanvasTexture(bg); scene.background.colorSpace = THREE.SRGBColorSpace;
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.45;
    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
    const key = new THREE.DirectionalLight('#FFF3E8', 2.4);
    key.position.set(-4, 7, 5);
    scene.add(key, new THREE.HemisphereLight('#BFD4FF', '#20182E', 0.5));

    // the mesh below the plane: outside faces lit, inside faces (seen through the cut) a flat warm section colour
    const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    const solid = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.55, clippingPlanes: [clip] });
    // thin dark triangle edges: the geometry is a plain triangle list, so corner k of every triangle is vertex i % 3
    solid.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('void main() {', 'attribute vec3 bary; varying vec3 vBary;\nvoid main() { vBary = bary;');
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'varying vec3 vBary;\nvoid main() {')
        .replace('#include <dithering_fragment>', `#include <dithering_fragment>
          vec3 e3 = vBary / fwidth(vBary); float e = min(min(e3.x, e3.y), e3.z);
          gl_FragColor.rgb *= mix(0.68, 1.0, smoothstep(0.3, 1.5, e));`);
    };
    const mc = new MarchingCubes(RES, solid, false, true, 60000);
    const bary = new Float32Array(60000 * 9);
    for (let i = 0; i < 60000 * 3; i++) bary[i * 3 + (i % 3)] = 1;
    mc.geometry.setAttribute('bary', new THREE.BufferAttribute(bary, 3));
    mc.isolation = ISO;
    mc.scale.setScalar(S);
    const inside = new THREE.Mesh(mc.geometry, new THREE.MeshBasicMaterial({ color: '#FFD9B0', side: THREE.BackSide, clippingPlanes: [clip] }));
    inside.scale.setScalar(S);
    const above = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const ghost = new THREE.Mesh(mc.geometry, new THREE.MeshStandardMaterial({ color: '#C3CCFF', transparent: true, opacity: 0.28, roughness: 0.5, depthWrite: false, clippingPlanes: [above] }));
    ghost.scale.setScalar(S);
    mc.frustumCulled = inside.frustumCulled = ghost.frustumCulled = false;
    scene.add(mc, inside, ghost);

    // the scan plane: the field on that slice, evaluated with the same formula as the grid
    const uBalls = { value: Array.from({ length: 6 }, () => new THREE.Vector3()) };
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(2 * S, 2 * S), new THREE.ShaderMaterial({
      transparent: true, side: THREE.DoubleSide, depthWrite: false,
      uniforms: { uBalls, uY: { value: 0.5 }, uFade: { value: 1 } },
      vertexShader: `varying vec2 vF; void main() { vF = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 uBalls[6]; uniform float uY, uFade; varying vec2 vF;
        float field(vec3 f) { float s = 0.0; for (int k = 0; k < 6; k++) { vec3 d = f - uBalls[k]; s += max(${STRENGTH.toFixed(1)} / (0.000001 + dot(d, d)) - ${SUB.toFixed(1)}, 0.0); } return s; }
        void main() {
          vec3 f = vec3(vF.x, uY, 1.0 - vF.y);           // field coordinates of this point of the slice
          float v = field(f) / ${ISO.toFixed(1)};
          vec3 cold = mix(vec3(0.05, 0.1, 0.25), vec3(0.25, 0.2, 0.75), clamp(v, 0.0, 1.0));
          vec3 hot = mix(vec3(1.0, 0.45, 0.25), vec3(1.0, 0.9, 0.55), clamp(v - 1.0, 0.0, 1.5) / 1.5);
          vec3 col = v < 1.0 ? cold : hot;
          float a = v < 1.0 ? 0.72 : 0.92;
          float w = fwidth(v);                                 // the iso contour f = 80
          col = mix(col, vec3(1.0), 1.0 - smoothstep(0.0, 1.6 * w, abs(v - 1.0)));
          vec2 g = vF * ${RES.toFixed(1)}, cell = abs(fract(g + 0.5) - 0.5);  // grid sample points, lit where inside
          float r = length(cell) / length(fwidth(g)) * 1.414;
          float dot = 1.0 - smoothstep(2.5, 4.5, r);
          vec3 dc = vec3(1.0, 1.0, 0.85);
          col = mix(col, dc, dot * (v > 1.0 ? 0.9 : 0.0));
          float edge = max(abs(vF.x - 0.5), abs(vF.y - 0.5)) * 2.0;
          col = mix(col, vec3(0.7, 0.85, 1.0), 1.0 - smoothstep(0.0, 2.0 * fwidth(edge), abs(edge - 0.995)));
          gl_FragColor = vec4(pow(col, vec3(1.0 / 2.2)), a * uFade);
        }`,
    }));
    plane.rotation.x = -Math.PI / 2;
    scene.add(plane);

    // the box the grid fills
    const e = [];
    for (const x of [-S, S]) for (const y of [-S, S]) e.push(x, y, -S, x, y, S, x, -S, y, x, S, y, -S, x, y, S, x, y);
    const box = new LineSegments2(new LineSegmentsGeometry().setPositions(e), new LineMaterial({ color: '#7F95D6', linewidth: 3, resolution: new THREE.Vector2(W, H), transparent: true, opacity: 0.45 }));
    scene.add(box);

    const cols = COLORS.map(c => new THREE.Color(c));
    return {
      scene, camera,
      update(t) {
        const a = phase(t) * TAU;
        const sway = 0.6 + 0.12 * Math.sin(a);
        camera.position.set(19.5 * Math.sin(sway), 10.3, 19.5 * Math.cos(sway));
        camera.lookAt(0, 0.45, 0);

        mc.reset();
        for (let k = 0; k < 6; k++) {
          const [x, y, z] = ball(k, a);
          mc.addBall(x, y, z, STRENGTH, SUB, cols[k]);
          uBalls.value[k].set(x, y, z);
        }
        mc.update();
        const P = mc.positionArray, C = mc.colorArray, B = uBalls.value;
        for (let i = 0; i < mc.count * 3; i += 3) { // colour by the nearest balls (weights 1 / d^4), so each keeps its hue
          let r = 0, g = 0, bl = 0, sum = 0;
          for (let k = 0; k < 6; k++) {
            const dx = (P[i] + 1) / 2 - B[k].x, dy = (P[i + 1] + 1) / 2 - B[k].y, dz = (P[i + 2] + 1) / 2 - B[k].z;
            const w = 1 / (1e-6 + (dx * dx + dy * dy + dz * dz) ** 2);
            r += w * cols[k].r; g += w * cols[k].g; bl += w * cols[k].b; sum += w;
          }
          C[i] = r / sum; C[i + 1] = g / sum; C[i + 2] = bl / sum;
        }
        // the plane: marches up from the floor of the box to just above its top (0.2 - 3.2 s on the cycle clock),
        // the full mesh holds, then the plane sinks back down (3.85 - 4.9 s)
        const u = (t + 1.8) % 5; // the cycle clock: the loop starts 1.8 s into the march
        const h = -S + 2.16 * S * (ease.inOut(span(u, 0.2, 3.2)) - ease.inOut(span(u, 3.85, 4.9)));
        clip.constant = h; above.constant = -h;
        plane.position.y = h;
        plane.material.uniforms.uY.value = h / (2 * S) + 0.5;
        plane.material.uniforms.uFade.value = Math.min(1, Math.max(0, (S + 0.02 - h) / 0.12));
        plane.visible = h < S + 0.02;
      },
    };
  },
};
