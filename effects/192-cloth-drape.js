// Cloth drape with a small position-based (PBD / Verlet) solver: a 56 x 56 grid of particles held together by
// stretch, shear and bend constraints falls onto a ball on a post and hangs round it in folds (collisions
// with friction). Then a hook pinches its middle and pulls it up out of frame. The whole 5 s run is simulated in setup
// with a fixed step (16 substeps per frame) and played back frame by frame; the cloth is off-screen at 0 s and 5 s.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TAU, phase, ease, span, rng } from '../lib/util.js';

const N = 64, SIZE = 3.4, FRAMES = 150, SUB = 16, DT = 1 / 30 / SUB, GRAV = -9.8;
const BALL = new THREE.Vector3(0, 2.3, 0), R = 0.95, POST = 0.2; // a ball on a slim post
const LIFT_START = 2.9, LIFT_END = 4.95; // seconds

// the cloth's particle positions for every frame
function simulate() {
  const n = N * N, h = SIZE / (N - 1);
  const p = new Float32Array(n * 3), prev = new Float32Array(n * 3);
  const rot = 0.5; // the cloth starts flat, turned a little and slightly off-centre, high above the ball
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = (i - (N - 1) / 2) * h, v = (j - (N - 1) / 2) * h, k = (j * N + i) * 3;
    p[k] = Math.cos(rot) * u - Math.sin(rot) * v - 0.25;
    p[k + 1] = 6.1 + 0.12 * u;
    p[k + 2] = Math.sin(rot) * u + Math.cos(rot) * v + 0.15;
  }
  prev.set(p);
  for (let k = 1; k < n * 3; k += 3) prev[k] += 4.5 * DT; // already falling at 4.5 m/s when it enters the frame
  // constraints: [a, b, rest length, stiffness per substep]; at 480 substeps a second even 0.001 adds up
  const cons = [];
  const link = (i0, j0, i1, j1, s) => {
    if (i1 < 0 || j1 < 0 || i1 >= N || j1 >= N) return;
    const a = j0 * N + i0, b = j1 * N + i1;
    cons.push([a, b, Math.hypot(p[a * 3] - p[b * 3], p[a * 3 + 1] - p[b * 3 + 1], p[a * 3 + 2] - p[b * 3 + 2]), s]);
  };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    link(i, j, i + 1, j, 1); link(i, j, i, j + 1, 1);              // stretch
    link(i, j, i + 1, j + 1, 0.04); link(i + 1, j, i, j + 1, 0.04); // shear
    link(i, j, i + 2, j, 0.0003); link(i, j, i, j + 2, 0.0003);     // bend: soft, so it folds
  }
  const HOOK = (N / 2) * N + N / 2, hookStart = new THREE.Vector3(); // the middle of the cloth
  const frames = [];
  for (let f = 0; f < FRAMES; f++) {
    frames.push(p.slice());
    for (let s = 0; s < SUB; s++) {
      const t = (f * SUB + s + 1) * DT;
      for (let k = 0; k < n * 3; k += 3) { // Verlet step with a little air drag
        for (let c = 0; c < 3; c++) {
          const x = p[k + c], v = (x - prev[k + c]) * 0.995;
          prev[k + c] = x;
          p[k + c] = x + v + (c === 1 ? GRAV * DT * DT : 0);
        }
      }
      const hooked = t > LIFT_START;
      if (hooked) { // a hook pinches the middle of the cloth and pulls it straight up, speeding up, out of frame
        if (!hookStart.lengthSq()) hookStart.set(p[HOOK * 3], p[HOOK * 3 + 1], p[HOOK * 3 + 2]);
        const k = span(t, LIFT_START, LIFT_END) ** 2;
        p[HOOK * 3] = hookStart.x;
        p[HOOK * 3 + 1] = hookStart.y + (9.5 - hookStart.y) * k;
        p[HOOK * 3 + 2] = hookStart.z;
      }
      for (let it = 0; it < (hooked ? 6 : 2); it++) for (const [a, b, rest, st] of cons) {
        if (it >= 2 && st < 1) continue; // extra passes on the stretch links only, while the hook carries the weight
        const wa = hooked && a === HOOK ? 0 : 1, wb = hooked && b === HOOK ? 0 : 1; // the hooked point does not give
        if (wa + wb === 0) continue;
        const ax = a * 3, bx = b * 3;
        const dx = p[bx] - p[ax], dy = p[bx + 1] - p[ax + 1], dz = p[bx + 2] - p[ax + 2];
        const d = Math.hypot(dx, dy, dz) || 1e-9, corr = ((d < rest ? 0.008 : 1) * st * (d - rest)) / d / (wa + wb); // gives way under compression, so it buckles into folds
        p[ax] += dx * corr * wa; p[ax + 1] += dy * corr * wa; p[ax + 2] += dz * corr * wa;
        p[bx] -= dx * corr * wb; p[bx + 1] -= dy * corr * wb; p[bx + 2] -= dz * corr * wb;
      }
      for (let k = 0; k < n * 3; k += 3) { // ball and floor, with friction (cancel most of the sliding)
        const dx = p[k] - BALL.x, dy = p[k + 1] - BALL.y, dz = p[k + 2] - BALL.z, d = Math.hypot(dx, dy, dz);
        if (d < R + 0.02) {
          const nx = dx / d, ny = dy / d, nz = dz / d, push = R + 0.02 - d;
          p[k] += nx * push; p[k + 1] += ny * push; p[k + 2] += nz * push;
          // Coulomb-style friction: cancel sliding up to 0.8 x how far the ball pushed the particle out
          const mx = p[k] - prev[k], my = p[k + 1] - prev[k + 1], mz = p[k + 2] - prev[k + 2], mn = mx * nx + my * ny + mz * nz;
          const tx = mx - mn * nx, ty = my - mn * ny, tz = mz - mn * nz, tl = Math.hypot(tx, ty, tz), f = Math.min(1, (0.8 * push) / (tl || 1e-9));
          p[k] -= tx * f; p[k + 1] -= ty * f; p[k + 2] -= tz * f;
        }
        const rr = Math.hypot(p[k], p[k + 2]);
        if (p[k + 1] < BALL.y && rr < POST + 0.02) { // the post
          const push = (POST + 0.02) / (rr || 1e-6);
          p[k] *= push; p[k + 2] *= push;
        }
        if (p[k + 1] < 0.015) {
          p[k + 1] = 0.015;
          p[k] -= 0.6 * (p[k] - prev[k]); p[k + 2] -= 0.6 * (p[k + 2] - prev[k + 2]);
        }
      }
    }
  }
  return frames;
}

function fabric() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = '#C8344F'; g.fillRect(0, 0, 1024, 1024);
  for (let k = 0; k < 16; k++) { // a woven check: crossing bands of two tones
    g.fillStyle = k % 4 === 0 ? 'rgba(255, 214, 140, 0.55)' : 'rgba(80, 10, 40, 0.28)';
    const w = k % 4 === 0 ? 14 : 30;
    g.fillRect(k * 64 + 25, 0, w, 1024); g.fillRect(0, k * 64 + 25, 1024, w);
  }
  g.strokeStyle = 'rgba(255, 230, 190, 0.9)'; g.lineWidth = 10; // a border
  g.strokeRect(22, 22, 980, 980);
  const r = rng(192); g.globalAlpha = 0.06; g.fillStyle = '#000'; // faint slubs, fixed to the weave
  for (let i = 0; i < 300; i++) g.fillRect(r() * 1024, r() * 1024, 40 + r() * 80, 3);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export default {
  name: 'Cloth Drape',
  ko: '천 드레이프',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#E9E1D6');
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
    const key = new THREE.DirectionalLight('#FFF4E6', 2.8);
    key.position.set(-4, 8, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 30 });
    key.shadow.bias = -0.0004;
    key.shadow.radius = 4;
    scene.add(key, new THREE.HemisphereLight('#FFFFFF', '#B9A994', 0.6));

    const camera = new THREE.PerspectiveCamera(32, W / H, 0.1, 100);

    // a studio sweep: the floor curves up into a back wall, so there is no horizon line
    const floorGeo = new THREE.PlaneGeometry(40, 1, 1, 80), fp = floorGeo.attributes.position;
    for (let k = 0; k < fp.count; k++) {
      const d = (0.5 - fp.getY(k)) * 30, flat = 14, rc = 5; // distance from the front edge
      const th = Math.min(Math.PI / 2, Math.max(0, d - flat) / rc), rest = Math.max(0, d - flat - rc * Math.PI / 2);
      fp.setXYZ(k, fp.getX(k), d <= flat ? 0 : rc * (1 - Math.cos(th)) + rest, d <= flat ? 10 - d : 10 - flat - rc * Math.sin(th));
    }
    floorGeo.computeVertexNormals();
    const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ color: '#E9E1D6', roughness: 0.95, side: THREE.DoubleSide }));
    floor.receiveShadow = true;
    scene.add(floor);

    const ball = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), new THREE.MeshPhysicalMaterial({ color: '#2E5E8C', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 }));
    ball.position.copy(BALL);
    ball.castShadow = ball.receiveShadow = true;
    scene.add(ball);
    const metal = new THREE.MeshStandardMaterial({ color: '#C9CED6', metalness: 0.9, roughness: 0.25 });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(POST, POST, BALL.y, 32), metal);
    post.position.y = BALL.y / 2;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.75, 0.1, 64), metal);
    base.position.y = 0.05;
    for (const m of [post, base]) { m.castShadow = m.receiveShadow = true; scene.add(m); }

    const frames = simulate();
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, N - 1, N - 1);
    const cloth = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ map: fabric(), side: THREE.DoubleSide, roughness: 0.75, sheen: 1, sheenColor: new THREE.Color('#FFC9C0'), sheenRoughness: 0.45 }));
    cloth.castShadow = cloth.receiveShadow = true;
    cloth.frustumCulled = false;
    scene.add(cloth);

    const pos = geo.attributes.position.array;
    const pose = t => {
      const a = phase(t) * TAU;
      const yaw = 0.3 + 0.22 * Math.sin(a); // a slow sway round the stand
      camera.position.set(11 * Math.sin(yaw), 4.2, 11 * Math.cos(yaw));
      camera.lookAt(0, 2.2, 0);
      // the cloth between the two stored frames around t (the grid rows match PlaneGeometry's vertex order)
      const f = Math.min(FRAMES - 1.001, Math.max(0, t * 30)), i = Math.floor(f), w = f - i;
      const A = frames[i], B = frames[i + 1];
      for (let k = 0; k < pos.length; k++) pos[k] = A[k] + (B[k] - A[k]) * w;
      geo.attributes.position.needsUpdate = true;
      geo.computeVertexNormals();
    };

    // film shutter: average SUB linear renders spread over one frame (1/30 s), then tone map, so the fast lift
    // at the end blurs like a real camera would see it instead of strobing
    const SUB = 5, targets = Array.from({ length: SUB }, () => new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType }));
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
};
