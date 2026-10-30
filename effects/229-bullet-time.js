// Bullet time: a strawberry dropped into milk, frozen at the instant of the crown splash (a wall with 18 spiked tips,
// beads breaking off them, a dome of flying droplets). Nothing in the scene moves; only the camera travels round it on
// the ring of a 24-camera rig. The splash and the three studio lights repeat every third of a turn, so a third of an
// orbit per loop meets itself seamlessly (and keeps the camera slow enough that the droplets stay crisp).
import * as THREE from 'three';
import { ParametricGeometry } from 'three/addons/geometries/ParametricGeometry.js';
import { TAU, phase, rng, canvas, FONT } from '../lib/util.js';

const N = 18;                                   // spikes on the crown
const R0 = 0.95;                                // where the crown wall leaves the pool
const pool = r => -0.3 * Math.exp(-((r / 0.7) ** 2)) + 0.07 * Math.exp(-(((r - 1.05) / 0.22) ** 2))
  + 0.035 * Math.sin(6.5 * r - 1.2) * Math.exp(-(r - 1.3) / 2.6) * Math.min(1, Math.max(0, (r - 1.2) / 0.4));
const spike = th => Math.pow(0.5 + 0.5 * Math.cos(N * th + 0.35 * Math.sin(3 * th)), 8);
const rimH = th => 0.95 + 0.1 * Math.sin(3 * th + 0.7) + 0.06 * Math.sin(6 * th) + 0.34 * spike(th);
const wall = (v, th) => {                       // a point on the crown wall: v 0 (base) .. 1 (rim)
  const r = R0 + 0.4 * v ** 1.8 + 0.08 * v ** 3 * spike(th);
  return new THREE.Vector3(r * Math.cos(th), pool(R0) + v * rimH(th), r * Math.sin(th));
};

function strawberryTexture() {
  const c = canvas(512, 512), g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 512, 0, 0);
  grd.addColorStop(0, '#7E0A1C'); grd.addColorStop(0.5, '#D3122F'); grd.addColorStop(0.9, '#E8324A'); grd.addColorStop(1, '#F5C4A0');
  g.fillStyle = grd; g.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 13; row++) for (let col = 0; col <= 18; col++) {
    const x = (col + (row % 2) * 0.5) * 512 / 18, y = 470 - row * 34;
    g.fillStyle = 'rgba(90, 0, 12, 0.55)'; g.beginPath(); g.ellipse(x, y, 7, 9, 0, 0, TAU); g.fill();
    g.fillStyle = '#F2D46B'; g.beginPath(); g.ellipse(x, y - 2, 3, 5, 0, 0, TAU); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

// a studio environment with the same symmetry: dark floor, rose-tinted dome, three soft boxes a third of a turn apart
function studio(renderer) {
  const env = new THREE.Scene();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vP; void main() { float y = normalize(vP).y; gl_FragColor = vec4(mix(vec3(0.06, 0.02, 0.03), vec3(0.6, 0.48, 0.48), smoothstep(-0.2, 0.8, y)), 1.0); }',
  }));
  env.add(dome);
  for (let k = 0; k < 3; k++) {
    const box = new THREE.Mesh(new THREE.PlaneGeometry(9, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.4, 2.25), side: THREE.DoubleSide }));
    const b = 0.75 * Math.PI + k * TAU / 3;
    box.position.set(12 * Math.cos(b), 8, 12 * Math.sin(b)); box.lookAt(0, 0, 0);
    env.add(box);
  }
  return new THREE.PMREMGenerator(renderer).fromScene(env, 0.03).texture;
}

export default {
  name: 'Bullet Time',
  ko: '불릿 타임',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    const bg = canvas(4, 512), b = bg.getContext('2d'), grd = b.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#12040A'); grd.addColorStop(0.45, '#2E0918'); grd.addColorStop(1, '#5E1832');
    b.fillStyle = grd; b.fillRect(0, 0, 4, 512);
    scene.background = new THREE.CanvasTexture(bg); scene.background.colorSpace = THREE.SRGBColorSpace;
    scene.fog = new THREE.Fog('#4E142A', 11, 22);
    scene.environment = studio(renderer);
    scene.environmentIntensity = 1.0;

    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 60);
    for (let k = 0; k < 3; k++) {                // three identical key lights, a third of a turn apart
      const key = new THREE.SpotLight('#FFF1E4', 150, 30, 0.4, 0.8, 2), b = 0.75 * Math.PI + k * TAU / 3;
      key.position.set(5 * Math.cos(b), 11, 5 * Math.sin(b));
      key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0006; key.shadow.normalBias = 0.03; key.shadow.radius = 4;
      scene.add(key);
    }
    scene.add(new THREE.HemisphereLight('#FFF4EE', '#6A3040', 1.1));

    const milk = new THREE.MeshPhysicalMaterial({ color: '#F7F1E8', roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.35, side: THREE.DoubleSide });
    const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; scene.add(m); return m; };

    // the milk pool: a lathe of the cavity + ripple profile out into the fog
    const prof = [];
    for (let i = 0; i <= 260; i++) { const r = 18 * (i / 260) ** 2; prof.push(new THREE.Vector2(r, pool(r))); }
    add(new THREE.LatheGeometry(prof, 256), milk);
    // the crown wall and a thick bead along its rim
    add(new ParametricGeometry((u, v, p) => p.copy(wall(v, u * TAU)), 360, 48), milk);
    const rimPts = Array.from({ length: 720 }, (_, i) => wall(1, i / 720 * TAU));
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts, true), 1440, 0.045, 12, true), milk);

    // droplets for a third of the circle, each copied a third and two thirds of a turn round:
    // beads leaving every spike tip, then a frozen ballistic spray
    const r = rng(229), drops = [], turn = new THREE.Quaternion();
    const twin = d => [0, 1, 2].forEach(k => {
      turn.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -k * TAU / 3);
      drops.push({ ...d, p: d.p.clone().applyQuaternion(turn), d: d.d.clone().applyQuaternion(turn) });
    });
    const step = TAU / 2052;
    for (let i = 0; i < 684; i++) {             // the spike tips are the local maxima of the rim height
      const th = i * step, h = rimH(th);
      if (!(h > rimH(th - step) && h >= rimH(th + step) && spike(th) > 0.5)) continue;
      const tip = wall(1, th);
      const dir = new THREE.Vector3(0.55 * Math.cos(th), 1, 0.55 * Math.sin(th)).normalize();
      const gap = 0.12 + 0.16 * r(), size = 0.055 + 0.035 * r();
      twin({ p: tip.clone().addScaledVector(dir, gap + size), d: dir, s: size, k: 1.35 });
      twin({ p: tip.clone().addScaledVector(dir, 0.05), d: dir, s: 0.026, k: 1.6 });
      if (r() < 0.5) twin({ p: tip.clone().addScaledVector(dir, gap + 2.6 * size + 0.1), d: dir, s: 0.025, k: 1 });
    }
    for (let i = 0; i < 42; i++) {
      const th = r() * TAU / 3, vr = 1.2 + 2.4 * r(), vy = 1.1 + 2.2 * r(), tau = 0.04 + 0.34 * r();
      const rad = 1.3 + vr * tau, y = 1.15 + vy * tau - 4.9 * tau * tau;
      if (y < pool(rad) + 0.08) continue;
      const vel = new THREE.Vector3(vr * Math.cos(th), vy - 9.8 * tau, vr * Math.sin(th)).normalize();
      twin({ p: new THREE.Vector3(rad * Math.cos(th), y, rad * Math.sin(th)), d: vel, s: (0.03 + 0.04 * r() ** 2) * (1.6 - tau * 1.4), k: 1 + 1.1 * r() });
    }
    const dropMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 24, 16), milk, drops.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    drops.forEach((d, i) => dropMesh.setMatrixAt(i, m4.compose(d.p, q.setFromUnitVectors(up, d.d), new THREE.Vector3(d.s, d.s * d.k, d.s))));
    scene.add(dropMesh);

    // the strawberry, dropped tip first and half sunk in the cavity, with a green calyx
    const berry = new THREE.Group();
    const bp = [];
    for (let i = 0; i <= 48; i++) {
      const s = i / 48;
      bp.push(new THREE.Vector2(0.46 * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.72)), 0.75) * (1 - 0.12 * s) + 0.001, -0.55 + 1.02 * s));
    }
    berry.add(new THREE.Mesh(new THREE.LatheGeometry(bp, 64),
      new THREE.MeshPhysicalMaterial({ map: strawberryTexture(), roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.2 })));
    const leafMat = new THREE.MeshStandardMaterial({ color: '#3E8E2E', roughness: 0.55 });
    for (let k = 0; k < 9; k++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), leafMat);
      leaf.scale.set(0.07, 0.018, 0.27);
      leaf.position.set(0, 0.47 + 0.004 * k, 0.17); leaf.rotation.x = 0.5;
      const arm = new THREE.Group();
      arm.add(leaf); arm.rotation.y = k / 9 * TAU + 0.2;
      berry.add(arm);
    }
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 12), leafMat);
    cap.position.y = 0.5; cap.scale.y = 0.6;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.034, 0.3, 12), leafMat);
    stem.position.y = 0.64;
    berry.add(cap, stem);
    berry.scale.setScalar(1.35);
    berry.position.y = 0.62;
    berry.traverse(o => { o.castShadow = true; });
    scene.add(berry);

    const place = t => {
      const a = phase(t) * TAU / 3;               // a third of an orbit per loop
      camera.position.set(10.4 * Math.cos(a), 3.6 + 0.3 * Math.sin(phase(t) * TAU), 10.4 * Math.sin(a));
      camera.lookAt(0, 1.05, 0);
    };
    // a camera-shutter blur: 6 renders spread over one frame, summed in a float buffer, then tone mapped once
    const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
    const acc = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: rt.texture, transparent: true, opacity: 1 / 6, blending: THREE.AdditiveBlending, depthTest: false }));
    const out = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: acc.texture, depthTest: false }));
    const post = new THREE.Scene(), final = new THREE.Scene(), flat = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    post.add(quad); final.add(out);
    renderer.autoClear = false;
    return {
      render(t) {
        renderer.setRenderTarget(acc); renderer.clear();
        for (let k = 0; k < 6; k++) {
          place(t + (k / 5 - 0.5) / 30);
          renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, camera);
          renderer.setRenderTarget(acc); renderer.render(post, flat);
        }
        renderer.setRenderTarget(null); renderer.clear(); renderer.render(final, flat);
      },
    };
  },
  overlay(ctx, t, W, H) {
    // the rig seen from above: 24 cameras on a ring that turns under our camera (the white marker at the bottom)
    const cx = W / 2, cy = 1725, R = 62, a = phase(t) * TAU / 3;
    ctx.fillStyle = 'rgba(34, 8, 20, 0.82)';
    ctx.beginPath(); ctx.roundRect(cx - 330, cy - 98, 660, 196, 40); ctx.fill();
    ctx.strokeStyle = 'rgba(255, 220, 232, 0.3)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    for (let k = 0; k < 24; k++) {
      const b = k / 24 * TAU - a;
      ctx.fillStyle = 'rgba(255, 220, 232, 0.6)';
      ctx.beginPath(); ctx.arc(cx + R * Math.cos(b), cy + R * Math.sin(b), 4, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.beginPath(); ctx.moveTo(cx, cy + R); ctx.lineTo(cx - 24, cy); ctx.lineTo(cx + 24, cy); ctx.fill();
    ctx.fillStyle = '#E8324A'; ctx.beginPath(); ctx.arc(cx, cy, 9, 0, TAU); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(cx, cy + R, 10, 0, TAU); ctx.fill();
    ctx.font = `600 30px ${FONT.mono}`; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(255, 236, 242, 0.9)';
    ctx.textAlign = 'right'; ctx.fillText('TIME ×0', cx - R - 40, cy);
    ctx.textAlign = 'left'; ctx.fillText('24 CAMS', cx + R + 40, cy);
  },
};
