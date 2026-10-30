// The three-body figure-eight (Chenciner & Montgomery 2000): three equal masses chase each other round one
// figure-eight under Newtonian gravity. One period is integrated in setup (RK4, 24,000 steps) and played back
// once per 5 s, so the loop is the orbit itself. Glowing stars leave fading trails; a faint triangle joins them
// around the centre of mass, which never moves.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { TAU, phase, rng } from '../lib/util.js';

const PERIOD = 6.32591398, STEPS = 24000, SAMPLES = 2400, TRAIL = 0.3, TRAIL_PTS = 160;
const COLORS = ['#5BE7FF', '#FF5FA8', '#FFC857'];

// G = m = 1. state: [x1, y1, x2, y2, x3, y3, vx1, vy1, ...]
function accel(s) {
  const a = new Float64Array(6);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    if (i === j) continue;
    const dx = s[j * 2] - s[i * 2], dy = s[j * 2 + 1] - s[i * 2 + 1], r3 = Math.hypot(dx, dy) ** 3;
    a[i * 2] += dx / r3; a[i * 2 + 1] += dy / r3;
  }
  return a;
}
const deriv = s => { const d = new Float64Array(12); d.set(s.subarray(6), 0); d.set(accel(s), 6); return d; };

// positions of the three bodies at SAMPLES even steps through one period
function orbit() {
  const p = [0.97000436, -0.24308753], v = [-0.93240737, -0.86473146];
  let s = new Float64Array([p[0], p[1], -p[0], -p[1], 0, 0, -v[0] / 2, -v[1] / 2, -v[0] / 2, -v[1] / 2, v[0], v[1]]);
  const h = PERIOD / STEPS, out = [];
  for (let n = 0; n < STEPS; n++) {
    if (n % (STEPS / SAMPLES) === 0) out.push(s.slice(0, 6));
    const k1 = deriv(s), k2 = deriv(s.map((x, i) => x + h / 2 * k1[i]));
    const k3 = deriv(s.map((x, i) => x + h / 2 * k2[i])), k4 = deriv(s.map((x, i) => x + h * k3[i]));
    s = s.map((x, i) => x + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
  }
  return out;
}

function starfield(W, H) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d'), grd = g.createRadialGradient(W / 2, H * 0.55, 50, W / 2, H * 0.55, H * 0.75);
  grd.addColorStop(0, '#141A3A'); grd.addColorStop(0.6, '#090C1E'); grd.addColorStop(1, '#04050C');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  g.filter = 'blur(60px)';
  for (const [x, y, r, col] of [[220, 700, 260, 'rgba(90, 60, 160, 0.22)'], [860, 1400, 300, 'rgba(30, 90, 150, 0.2)'], [600, 1000, 200, 'rgba(150, 50, 110, 0.12)']]) {
    g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  g.filter = 'none';
  const r = rng(196);
  for (let i = 0; i < 700; i++) {
    const x = r() * W, y = r() * H, s = 0.5 + r() ** 3 * 1.8;
    g.fillStyle = `rgba(${200 + r() * 55}, ${210 + r() * 45}, 255, ${0.25 + r() * 0.6})`;
    g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default {
  name: 'N-Body Gravity',
  ko: '다체 중력',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    scene.background = starfield(W, H);
    const camera = new THREE.PerspectiveCamera(35, W / H, 0.1, 50);
    camera.position.set(0, 0.12, 5.7);
    camera.lookAt(0, 0.12, 0);

    const samples = orbit();
    // body i at orbit fraction u (0..1, wraps), linearly between the fine samples; the eight stands upright
    const at = (i, u) => {
      const f = (((u % 1) + 1) % 1) * SAMPLES, k = Math.floor(f), w = f - k;
      const a = samples[k], b = samples[(k + 1) % SAMPLES];
      return new THREE.Vector3(a[i * 2 + 1] + (b[i * 2 + 1] - a[i * 2 + 1]) * w, a[i * 2] + (b[i * 2] - a[i * 2]) * w, 0);
    };

    const group = new THREE.Group();
    scene.add(group);
    // trails are flat ribbons in the orbit plane with a soft edge-to-edge profile (no overlapping line caps)
    const soft = document.createElement('canvas');
    soft.width = 64; soft.height = 1;
    const sg = soft.getContext('2d'), sgrd = sg.createLinearGradient(0, 0, 64, 0);
    sgrd.addColorStop(0, 'rgba(255,255,255,0)'); sgrd.addColorStop(0.5, 'rgba(255,255,255,1)'); sgrd.addColorStop(1, 'rgba(255,255,255,0)');
    sg.fillStyle = sgrd; sg.fillRect(0, 0, 64, 1);
    const softMap = new THREE.CanvasTexture(soft);
    const ribbonMat = new THREE.MeshBasicMaterial({ map: softMap, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const ribbon = n => {
      const geo = new THREE.BufferGeometry(), idx = [];
      geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 6), 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 6), 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 4).map((_, i) => (i % 4 === 2 ? 1 : 0)), 2));
      for (let k = 0; k < n - 1; k++) idx.push(2 * k, 2 * k + 1, 2 * k + 2, 2 * k + 1, 2 * k + 3, 2 * k + 2);
      geo.setIndex(idx);
      const mesh = new THREE.Mesh(geo, ribbonMat);
      mesh.frustumCulled = false;
      group.add(mesh);
      return mesh;
    };
    // pts: Vector3 list in the plane, col(k) -> [r, g, b], half width w(k)
    const setRibbon = (mesh, pts, col, w) => {
      const P = mesh.geometry.attributes.position, C = mesh.geometry.attributes.color;
      pts.forEach((p, k) => {
        const q0 = pts[Math.max(0, k - 1)], q1 = pts[Math.min(pts.length - 1, k + 1)];
        const tx = q1.x - q0.x, ty = q1.y - q0.y, l = Math.hypot(tx, ty) || 1, nx = -ty / l * w(k), ny = tx / l * w(k);
        P.setXYZ(2 * k, p.x + nx, p.y + ny, 0); P.setXYZ(2 * k + 1, p.x - nx, p.y - ny, 0);
        const c = col(k); C.setXYZ(2 * k, ...c); C.setXYZ(2 * k + 1, ...c);
      });
      P.needsUpdate = C.needsUpdate = true;
    };

    // the whole orbit, faint
    const path = [];
    for (let k = 0; k <= 600; k++) path.push(at(0, k / 600));
    setRibbon(ribbon(601), path, () => [0.16, 0.18, 0.3], () => 0.012);

    const glow = document.createElement('canvas'); // a soft round glow for each star
    glow.width = glow.height = 128;
    const gg = glow.getContext('2d'), ggrd = gg.createRadialGradient(64, 64, 0, 64, 64, 64);
    ggrd.addColorStop(0, 'rgba(255,255,255,0.9)'); ggrd.addColorStop(0.25, 'rgba(255,255,255,0.35)'); ggrd.addColorStop(1, 'rgba(255,255,255,0)');
    gg.fillStyle = ggrd; gg.fillRect(0, 0, 128, 128);
    const glowMap = new THREE.CanvasTexture(glow);
    const bodies = COLORS.map(hex => {
      const color = new THREE.Color(hex);
      const star = new THREE.Mesh(new THREE.SphereGeometry(0.055, 32, 16), new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(2.2) }));
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap, color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.scale.setScalar(0.42);
      star.add(halo);
      group.add(star);
      return { star, trail: ribbon(TRAIL_PTS + 1), color };
    });
    const tri = new Line2(new LineGeometry(), new LineMaterial({ linewidth: 2, color: '#9AA6D8', transparent: true, opacity: 0.35, depthWrite: false, resolution: new THREE.Vector2(W, H) }));
    group.add(tri);
    const com = new THREE.Mesh(new THREE.RingGeometry(0.018, 0.028, 32), new THREE.MeshBasicMaterial({ color: '#AFC3FF', transparent: true, opacity: 0.7 }));
    group.add(com);

    const target = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
    const composer = new EffectComposer(renderer, target);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.9, 0.55, 0.35));
    composer.addPass(new OutputPass());

    return {
      render(t) {
        const a = phase(t) * TAU, u = phase(t);
        group.rotation.y = 0.42 * Math.sin(a); // a slow sway shows the orbit is a flat curve in space
        group.rotation.x = -0.18 + 0.08 * Math.sin(2 * a);
        const tri3 = [];
        bodies.forEach((b, i) => {
          b.star.position.copy(at(i, u));
          tri3.push(b.star.position.x, b.star.position.y, 0);
          const pts = [];
          for (let k = TRAIL_PTS; k >= 0; k--) pts.push(at(i, u - (k / TRAIL_PTS) * TRAIL));
          const fade = k => (k / TRAIL_PTS) ** 1.6; // k = 0 is the tail end
          setRibbon(b.trail, pts, k => [b.color.r * fade(k), b.color.g * fade(k), b.color.b * fade(k)], k => 0.012 + 0.03 * fade(k));
        });
        tri3.push(tri3[0], tri3[1], 0);
        tri.geometry.setPositions(tri3);
        composer.render();
      },
    };
  },
};
