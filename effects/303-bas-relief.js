// Bas-relief: a tree of life (trunk, roots, five levels of branches, about 1,000 almond leaves, fruit, sun and birds)
// is built as a height field over a square plate: every part is a round solid (capsule, ellipsoid) and the plate
// keeps the nearest surface at each point, so at full depth it stands out as a deep, rounded sculpture. A bas-relief
// keeps the picture but squeezes the depth: heights go through a log curve (big steps shrink far more than small
// ones) and the fine detail (height minus its blur) is added back, so 8 % of the depth still reads as the full form.
// The camera looks from the side while the depth is squeezed, turns to face the plate, and a low raking light
// circles it, its shadows revealing the form; then the depth swells back. The section below plots the profile.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TAU, rng, clamp, smoothstep, FONT } from '../lib/util.js';

const N = 512, SIZE = 2, FLAT = 0.08;                  // grid, plate width (units), relief depth against full
const SECTION = 0.6;                                     // the profile below is cut at this height of the plate
const START = 0.5;                                       // the video starts as the depth is squeezed: the loop seam moves
let full, relief;                                        // height fields (units, plate width 2)

// the tree as a height field: max of round solids; heights in plate widths (1 = as deep as the plate is wide)
function tree() {
  const h = new Float32Array(N * N), r = rng(303);
  const put = (u0, v0, u1, v1, fn) => {                  // run fn over the cells of a box, keep the highest surface
    for (let j = Math.max(0, Math.floor(v0 * N)); j <= Math.min(N - 1, Math.ceil(v1 * N)); j++) {
      for (let i = Math.max(0, Math.floor(u0 * N)); i <= Math.min(N - 1, Math.ceil(u1 * N)); i++) {
        const z = fn(i / (N - 1), j / (N - 1));
        if (z > h[j * N + i]) h[j * N + i] = z;
      }
    }
  };
  const capsule = (ax, ay, bx, by, ra, rb, ca, cb) => put(Math.min(ax, bx) - ra, Math.min(ay, by) - ra, Math.max(ax, bx) + ra, Math.max(ay, by) + ra, (u, v) => {
    const dx = bx - ax, dy = by - ay, k = clamp(((u - ax) * dx + (v - ay) * dy) / (dx * dx + dy * dy || 1));
    const d = Math.hypot(u - ax - dx * k, v - ay - dy * k), rr = ra + (rb - ra) * k;
    return d < rr ? ca + (cb - ca) * k + Math.sqrt(rr * rr - d * d) : 0;
  });
  const ellipsoid = (cx, cy, a, b, ang, c, depth) => put(cx - a, cy - a, cx + a, cy + a, (u, v) => {
    const x = (u - cx) * Math.cos(ang) + (v - cy) * Math.sin(ang), y = -(u - cx) * Math.sin(ang) + (v - cy) * Math.cos(ang);
    const q = (x / a) ** 2 + (y / b) ** 2;
    return q < 1 ? c + depth * Math.sqrt(1 - q) : 0;
  });
  // the canopy: one rounded mass the leaves sit on, a half-dome resting on the plate
  const dome = (u, v) => 0.17 * Math.sqrt(Math.max(0, 1 - ((u - 0.5) / 0.37) ** 2 - ((v - 0.64) / 0.24) ** 2));
  put(0.1, 0.36, 0.9, 0.92, dome);
  // the ground: a low hill along the bottom, rising gently out of the plate
  put(0.04, 0.04, 0.96, 0.24, (u, v) => { const top = 0.16 + 0.025 * Math.sin(u * 7 + 1); return 0.04 * smoothstep(top + 0.02, top - 0.06, v); });
  // the trunk and roots, half-round
  capsule(0.5, 0.15, 0.5, 0.5, 0.06, 0.042, 0, 0.02);
  for (const s of [-1, 1]) for (const k of [0.6, 1]) capsule(0.5, 0.18, 0.5 + s * 0.14 * k, 0.11 + 0.02 * k, 0.032, 0.012, 0.01, 0);
  // branches: each splits in two (sometimes three), shorter and thinner; their tips end on the canopy
  const tips = [];
  const branch = (x, y, ang, len, rad, depth) => {
    const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
    capsule(x, y, ex, ey, rad, rad * 0.72, 0.02 + 0.8 * dome(x, y), 0.02 + 0.8 * dome(ex, ey));
    if (depth === 0) { tips.push([ex, ey]); return; }
    const n = r() < 0.3 ? 3 : 2;
    for (let k = 0; k < n; k++) {
      const a = ang + (n === 2 ? (k ? 0.48 : -0.48) : (k - 1) * 0.55) + (r() - 0.5) * 0.3;
      branch(ex, ey, a, len * (0.7 + r() * 0.12), rad * 0.72, depth - 1);
    }
  };
  branch(0.5, 0.46, Math.PI / 2 - 0.55, 0.09, 0.032, 4);
  branch(0.5, 0.46, Math.PI / 2 + 0.55, 0.09, 0.032, 4);
  branch(0.5, 0.48, Math.PI / 2, 0.1, 0.028, 3);
  // leaves all over the canopy's surface, and round every twig tip; a fruit here and there
  for (let k = 0; k < 520; k++) {
    let x, y;
    do { x = 0.1 + r() * 0.8; y = 0.38 + r() * 0.52; } while (((x - 0.5) / 0.4) ** 2 + ((y - 0.64) / 0.27) ** 2 > 1);
    ellipsoid(x, y, 0.024 + r() * 0.01, 0.011 + r() * 0.004, r() * TAU, Math.max(0, dome(x, y) - 0.006), 0.022);
  }
  for (const [tx, ty] of tips) {
    for (let k = 0; k < 7; k++) {
      const a = r() * TAU, d = 0.01 + r() * 0.03, x = clamp(tx + Math.cos(a) * d, 0.07, 0.93), y = clamp(ty + Math.sin(a) * d, 0.2, 0.93);
      ellipsoid(x, y, 0.024 + r() * 0.01, 0.011 + r() * 0.004, a + (r() - 0.5), Math.max(0, dome(x, y) - 0.008), 0.022);
    }
    if (r() < 0.25) ellipsoid(tx, ty - 0.02, 0.016, 0.016, 0, Math.max(0, dome(tx, ty - 0.02) - 0.004), 0.02);
  }
  // the sun with rays, and two birds
  ellipsoid(0.17, 0.86, 0.055, 0.055, 0, 0, 0.05);
  for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; capsule(0.17 + Math.cos(a) * 0.07, 0.86 + Math.sin(a) * 0.07, 0.17 + Math.cos(a) * 0.1, 0.86 + Math.sin(a) * 0.1, 0.007, 0.004, 0, 0); }
  for (const [bx, by, s] of [[0.8, 0.88, 1], [0.87, 0.84, 0.7]]) {
    capsule(bx - 0.035 * s, by + 0.012 * s, bx, by, 0.007 * s, 0.008 * s, 0, 0.004);
    capsule(bx, by, bx + 0.035 * s, by + 0.014 * s, 0.008 * s, 0.007 * s, 0.004, 0);
  }
  // the raised rim of the plate
  put(0, 0, 1, 1, (u, v) => { const e = Math.min(u, v, 1 - u, 1 - v); return 0.045 * smoothstep(0.045, 0.03, e); });
  return h;
}

// box blur, radius k, run twice (close to a Gaussian)
function blur(src, k) {
  let a = Float32Array.from(src);
  for (let pass = 0; pass < 2; pass++) for (const horiz of [true, false]) {
    const out = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      let s = 0, n = 0;
      for (let d = -k; d <= k; d++) {
        const x = horiz ? i + d : i, y = horiz ? j : j + d;
        if (x >= 0 && y >= 0 && x < N && y < N) { s += a[y * N + x]; n++; }
      }
      out[j * N + i] = s / n;
    }
    a = out;
  }
  return a;
}

export default {
  name: 'Bas-Relief',
  ko: '부조',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;       // soft and free of acne at a grazing light
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas');
    bg.width = 2; bg.height = 512;
    const g = bg.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#16130F'); grd.addColorStop(0.5, '#2A241D'); grd.addColorStop(1, '#141210');
    g.fillStyle = grd; g.fillRect(0, 0, 2, 512);
    scene.background = new THREE.CanvasTexture(bg);
    scene.background.colorSpace = THREE.SRGBColorSpace;
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.06;

    // the two height fields in scene units: full depth, and the bas-relief (log curve + fine detail added back)
    const hf = blur(tree(), 1), soft = blur(hf, 5), top = hf.reduce((m, v) => Math.max(m, v), 0), H0 = 0.025;
    full = hf.map(v => v * SIZE);
    relief = hf.map((v, i) => SIZE * FLAT * top * (Math.log1p(v / H0) / Math.log1p(top / H0) + 1.2 * (v - soft[i]) / top));

    const geo = new THREE.PlaneGeometry(SIZE, SIZE, N - 1, N - 1);
    const pos = geo.attributes.position, nrm = geo.attributes.normal, colors = new Float32Array(N * N * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const step = SIZE / (N - 1), grad = f => {                // slopes of a field, for the normals
      const gx = new Float32Array(N * N), gy = new Float32Array(N * N);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const k = j * N + i;
        gx[k] = (f[j * N + Math.min(N - 1, i + 1)] - f[j * N + Math.max(0, i - 1)]) / (2 * step);
        gy[k] = (f[Math.min(N - 1, j + 1) * N + i] - f[Math.max(0, j - 1) * N + i]) / (2 * step);
      }
      return [gx, gy];
    };
    const [fx, fy] = grad(full), [rx, ry] = grad(relief);
    // bronze: dark green-brown patina on the ground of the plate, warm bronze on the figure, polished on the crests
    const PATINA = new THREE.Color('#3B4636'), BRONZE = new THREE.Color('#B07D45'), POLISH = new THREE.Color('#F0C27A'), c = new THREE.Color();
    for (let k = 0; k < N * N; k++) {
      const v = (k / N) | 0, row = N - 1 - v;                // the plane's rows run top to bottom; the field's bottom up
      const src = row * N + (k % N);
      c.copy(PATINA).lerp(BRONZE, smoothstep(0.0, 0.02, hf[src])).lerp(POLISH, clamp((hf[src] - soft[src]) * 60));
      colors[k * 3] = c.r; colors[k * 3 + 1] = c.g; colors[k * 3 + 2] = c.b;
    }
    const plate = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.55, roughness: 0.5 }));
    plate.castShadow = plate.receiveShadow = true;
    scene.add(plate);
    const back = new THREE.Mesh(new THREE.BoxGeometry(SIZE, SIZE, 0.16), new THREE.MeshStandardMaterial({ color: '#4A3A26', metalness: 0.7, roughness: 0.5 }));
    back.position.z = -0.08; scene.add(back);

    const sun = new THREE.DirectionalLight('#FFE7C4', 5.5);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -1.6, right: 1.6, top: 1.6, bottom: -1.6, near: 0.5, far: 12 });
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.01; sun.shadow.radius = 6; sun.shadow.blurSamples = 12;
    scene.add(sun, sun.target, new THREE.HemisphereLight('#9AA6C8', '#2A2018', 0.22));
    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);

    return {
      scene, camera,
      update(time) {
        const t = (time + START) % 5, k = depthMix(t), yaw = (42 - 34 * smoothstep(1.45, 2.3, t) * (1 - smoothstep(3.2, 4.0, t))) * Math.PI / 180;
        camera.position.set(8.4 * Math.sin(yaw), -0.25, 8.4 * Math.cos(yaw));
        camera.lookAt(0, -0.32, 0);
        const az = (TAU * t) / 5 + 2.2, el = (13 * Math.PI) / 180;   // the raking light circles the plate, low
        sun.position.set(6 * Math.cos(az) * Math.cos(el), 6 * Math.sin(az) * Math.cos(el), 6 * Math.sin(el));
        for (let v = 0; v < N; v++) for (let i = 0; i < N; i++) {
          const kk = v * N + i, src = (N - 1 - v) * N + i;
          pos.setZ(kk, full[src] + (relief[src] - full[src]) * k);
          const gx = fx[src] + (rx[src] - fx[src]) * k, gy = fy[src] + (ry[src] - fy[src]) * k, l = Math.hypot(gx, gy, 1);
          nrm.setXYZ(kk, -gx / l, -gy / l, 1 / l);
        }
        pos.needsUpdate = true; nrm.needsUpdate = true;
        geo.computeBoundingSphere();
      },
    };
  },
  // the section through the plate: full depth dashed, the current depth filled
  overlay(ctx, time, W, H) {
    const k = depthMix((time + START) % 5), x0 = 110, x1 = 970, base = 1780, PX = (x1 - x0) / SIZE, row = Math.round(SECTION * (N - 1));
    ctx.textAlign = 'left';
    ctx.font = `600 26px ${FONT.sans}`; ctx.fillStyle = 'rgba(240, 222, 196, 0.62)';
    ctx.fillText('SECTION THROUGH THE PLATE', x0, 1500);
    ctx.textAlign = 'right'; ctx.font = `700 30px ${FONT.sans}`; ctx.fillStyle = '#F6E3C4';
    const depth = (1 - k) * 1 + k * FLAT;
    ctx.fillText(`depth × ${depth.toFixed(2)}`, x1, 1500);
    const prof = f => { ctx.beginPath(); ctx.moveTo(x0, base); for (let i = 0; i < N; i++) ctx.lineTo(x0 + (i / (N - 1)) * (x1 - x0), base - f(row * N + i) * PX); ctx.lineTo(x1, base); };
    prof(i => full[i] + (relief[i] - full[i]) * k);
    const fill = ctx.createLinearGradient(0, base - 200, 0, base);
    fill.addColorStop(0, '#E0AE66'); fill.addColorStop(1, '#7A5530');
    ctx.fillStyle = fill; ctx.fill();
    ctx.setLineDash([10, 8]); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(246, 227, 196, 0.55)';
    prof(i => full[i]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(246, 227, 196, 0.35)'; ctx.fillRect(x0, base, x1 - x0, 3);
  },
};

// 0 = full depth, 1 = bas-relief: squeezed while seen from the side, swelling back at the end
function depthMix(t) { return smoothstep(0.4, 1.4, t) * (1 - smoothstep(4.0, 4.95, t)); }
