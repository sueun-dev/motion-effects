// GPU instancing: 40,000 cubes are one InstancedMesh, so the whole field is a single draw call. Each frame only
// the per-instance matrices (height) and colours change; three interfering ripple sources lift the columns and
// tint them from deep blue through teal to warm pink at the crests. Each video frame averages five renders spread
// over the frame time (a film shutter), so the fine stair-steps of the cube tops blur a little instead of crawling.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TAU, phase, FONT } from '../lib/util.js';

const NX = 200, NZ = 200, COUNT = NX * NZ, STEP = 1;
// ripple sources: [x, z, wave number, cycles per 5 s, amplitude]
const SOURCES = [[-45, -40, 0.3, 1, 1.1], [50, 20, 0.24, 1, 0.9], [-10, 60, 0.36, 1, 0.6]];
const PALETTE = ['#0B1B4D', '#1F5FAF', '#2FC6C9', '#C8F2E6', '#FF8FB1'];

export default {
  name: 'GPU Instancing',
  ko: 'GPU 인스턴싱',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const bg = new THREE.Color('#070A1C');
    scene.background = bg;
    scene.fog = new THREE.Fog(bg, 120, 260);
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.45;
    const sun = new THREE.DirectionalLight('#FFF1E0', 2.6);
    sun.position.set(-30, 60, 20);
    scene.add(sun, new THREE.HemisphereLight('#9FB8FF', '#141026', 0.5));

    const camera = new THREE.PerspectiveCamera(38, W / H, 1, 600);

    const geo = new THREE.BoxGeometry(0.97, 1, 0.97);
    geo.translate(0, 0.5, 0); // base on the floor, so scaling y grows the column upward
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.38, metalness: 0.15 }), COUNT);
    mesh.rotation.y = Math.PI / 4; // a diamond: one corner points away into the fog
    scene.add(mesh);
    const ramp = PALETTE.map(c => new THREE.Color(c));
    const colorAt = (k, out) => { // k 0..1 along the palette
      const f = Math.min(0.9999, Math.max(0, k)) * (ramp.length - 1), i = Math.floor(f);
      return out.copy(ramp[i]).lerp(ramp[i + 1], f - i);
    };

    const dist = SOURCES.map(([sx, sz]) => { // each cube's distance to each ripple source
      const d = new Float32Array(COUNT);
      for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) d[j * NX + i] = Math.hypot((i - (NX - 1) / 2) * STEP - sx, (j - (NZ - 1) / 2) * STEP - sz);
      return d;
    });
    const m = new THREE.Matrix4(), col = new THREE.Color();
    const pose = t => {
      const a = phase(t) * TAU;
      camera.position.set(0, 120, 120); // a still camera: moving it would slide the fine cube grid across the pixels
      camera.lookAt(0, 0, -34);
      for (let j = 0; j < NZ; j++) {
        for (let i = 0; i < NX; i++) {
          const idx = j * NX + i;
          let h = 0;
          SOURCES.forEach(([, , k, n, amp], s) => { h += amp * Math.sin(k * dist[s][idx] - n * a); });
          const y = 1.6 + h; // about 0.0 .. 4.2
          m.makeScale(1, Math.max(0.15, y), 1).setPosition((i - (NX - 1) / 2) * STEP, 0, (j - (NZ - 1) / 2) * STEP);
          mesh.setMatrixAt(idx, m);
          mesh.setColorAt(idx, colorAt(y / 4.0, col));
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    };

    // film shutter: average SUB linear renders spread over one frame (1/30 s), then tone map
    const SUB = 5, targets = Array.from({ length: SUB }, () => new THREE.WebGLRenderTarget(W, H, { samples: 4 }));
    const blendScene = new THREE.Scene(), blendCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    blendScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: { uT: { value: targets.map(rt => rt.texture) } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D uT[${SUB}]; varying vec2 vUv;
void main() {
  vec4 c = vec4(0.0); ${targets.map((_, i) => `c += texture2D(uT[${i}], vUv);`).join(' ')}
  gl_FragColor = c / ${SUB}.0;
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
    })));
    return {
      render(t) {
        targets.forEach((rt, i) => {
          pose(t + ((i + 0.5) / SUB - 0.5) / 30);
          renderer.setRenderTarget(rt);
          renderer.render(scene, camera);
        });
        renderer.setRenderTarget(null);
        renderer.render(blendScene, blendCam);
      },
    };
  },
  overlay(ctx, t, W, H) {
    ctx.font = `600 34px ${FONT.mono}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(220, 235, 255, 0.82)';
    ctx.fillText(`${COUNT.toLocaleString('en-US')} cubes · 1 draw call`, W / 2, 330);
  },
};
