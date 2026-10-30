// Image-based lighting: no lamps at all. A chrome ball, a glossy pearl knot, a gold ring and a matte clay ball are lit
// only by a 360° HDR picture that turns once per loop and changes from sunset to studio to night. Each picture is made
// here as floating-point pixels, blended, then prefiltered (PMREM) so rough surfaces see a blurred version of it.
import * as THREE from 'three';
import { TAU, phase, rng, smoothstep, FONT } from '../lib/util.js';

const EW = 512, EH = 256;
const NAMES = ['SUNSET', 'STUDIO', 'NIGHT CITY'];
// weights of the three pictures: each holds, then cross-fades into the next (0.65 s), round and back to the start
function weights(t) {
  const u = (t / 5) * 3, k = Math.floor(u) % 3, f = smoothstep(0.61, 1, u - Math.floor(u));
  const w = [0, 0, 0]; w[k] += 1 - f; w[(k + 1) % 3] += f;
  return w;
}

// one HDR panorama: f(x, y, z) -> [r, g, b] in linear light, sampled on the equirect grid three.js expects
function panorama(f) {
  const d = new Float32Array(EW * EH * 4);
  for (let j = 0; j < EH; j++) {
    const lat = ((j + 0.5) / EH - 0.5) * Math.PI;
    for (let i = 0; i < EW; i++) {
      const lon = ((i + 0.5) / EW - 0.5) * TAU;
      const c = f(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon), lon, lat);
      d.set([c[0], c[1], c[2], 1], (j * EW + i) * 4);
    }
  }
  return d;
}
const mix3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const glow = (x, y, z, s, sharp) => Math.exp((x * s[0] + y * s[1] + z * s[2] - 1) * sharp); // a soft disc round direction s
const box = (lon, lat, l0, l1, b0, b1, e = 0.03) =>
  smoothstep(l0 - e, l0 + e, lon) * (1 - smoothstep(l1 - e, l1 + e, lon)) * smoothstep(b0 - e, b0 + e, lat) * (1 - smoothstep(b1 - e, b1 + e, lat));

function sunset() {
  const sun = [Math.cos(0.12) * Math.cos(1.4), Math.sin(0.12), Math.cos(0.12) * Math.sin(1.4)]; // low, in front of the objects while it shows
  return panorama((x, y, z) => {
    if (y < 0) return mix3([0.5, 0.22, 0.12], [0.06, 0.035, 0.04], Math.min(1, -y * 3));
    let c = mix3([2.2, 0.75, 0.26], [0.05, 0.08, 0.26], Math.pow(y, 0.4));
    const g = glow(x, y, z, sun, 900) * 600 + glow(x, y, z, sun, 14) * 2.2;
    return [c[0] + g, c[1] + g * 0.62, c[2] + g * 0.3];
  });
}
function studio() {
  return panorama((x, y, z, lon, lat) => {
    const base = 0.035 + 0.03 * Math.max(0, y);
    const key = box(lon, lat, -0.55, 0.35, 0.1, 0.8) * 7;            // a big warm softbox
    const strip = box(lon, lat, 2.35, 2.55, -0.15, 0.85) * 5;         // a tall cool strip light opposite
    const top = glow(x, y, z, [0, 1, 0], 18) * 2.2;                   // an overhead dome
    return [base + key * 1.0 + strip * 0.75 + top, base + key * 0.94 + strip * 0.88 + top, base + key * 0.86 + strip * 1.0 + top];
  });
}
function night() {
  const r = rng(77), lights = [];
  for (let i = 0; i < 140; i++) {
    const lon = r() * TAU - Math.PI, lat = -0.03 + r() * r() * 0.16;
    lights.push([[Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)], r() < 0.7 ? [5, 2.6, 0.9] : [0.8, 3, 5], 2500 + r() * 4000]);
  }
  const moon = [Math.cos(0.55) * Math.cos(2.1), Math.sin(0.55), Math.cos(0.55) * Math.sin(2.1)];
  return panorama((x, y, z, lon, lat) => {
    let c = y < 0 ? [0.012, 0.012, 0.022] : mix3([0.06, 0.05, 0.12], [0.004, 0.008, 0.03], Math.pow(y, 0.5));
    const m = glow(x, y, z, moon, 2500) * 30 + glow(x, y, z, moon, 30) * 0.15;
    c = [c[0] + m * 0.85, c[1] + m * 0.9, c[2] + m];
    const neonA = box(lon, lat, -1.2, -0.9, 0.02, 0.1, 0.01) * 6, neonB = box(lon, lat, 0.6, 0.75, 0.0, 0.16, 0.01) * 5;
    c = [c[0] + neonA * 1.0 + neonB * 0.1, c[1] + neonA * 0.1 + neonB * 0.9, c[2] + neonA * 0.6 + neonB * 1.0];
    if (lat > -0.1 && lat < 0.25) for (const [d, col, s] of lights) {
      const g = glow(x, y, z, d, s);
      if (g > 0.002) c = [c[0] + col[0] * g, c[1] + col[1] * g, c[2] + col[2] * g];
    }
    return c;
  });
}

// a small tone-mapped picture of a panorama, for the strip at the bottom
function thumb(data) {
  const c = document.createElement('canvas'); c.width = EW; c.height = EH;
  const g = c.getContext('2d'), img = g.createImageData(EW, EH);
  for (let j = 0; j < EH; j++) for (let i = 0; i < EW; i++) {
    const s = ((EH - 1 - j) * EW + i) * 4, o = (j * EW + i) * 4;
    for (let k = 0; k < 3; k++) { const v = data[s + k] * 1.4; img.data[o + k] = 255 * Math.pow(v / (1 + v), 1 / 2.2); }
    img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
let thumbs = [];

export default {
  name: 'Image-Based Lighting',
  ko: '이미지 기반 조명',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const envs = [sunset(), studio(), night()];
    thumbs = envs.map(thumb);
    const mixData = new Float32Array(EW * EH * 4);
    const hdr = new THREE.DataTexture(mixData, EW, EH, THREE.RGBAFormat, THREE.FloatType);
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    hdr.magFilter = hdr.minFilter = THREE.LinearFilter;
    const pmrem = new THREE.PMREMGenerator(renderer);
    let target = null;

    const scene = new THREE.Scene();
    scene.backgroundBlurriness = 0.45; // the backdrop is the same picture, blurred, so it reads as light rather than scenery
    scene.backgroundIntensity = 0.5;
    const camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 100);
    camera.position.set(0, 1.0, 15);
    camera.lookAt(0, 0.1, 0);

    // mirror, glossy, brushed and matte: each shows a different blur of the same picture
    const chrome = new THREE.Mesh(new THREE.SphereGeometry(1.1, 128, 64), new THREE.MeshStandardMaterial({ color: '#FFFFFF', metalness: 1, roughness: 0.03 }));
    chrome.position.set(0.95, 0.15, 0);
    const clay = new THREE.Mesh(new THREE.SphereGeometry(0.82, 128, 64), new THREE.MeshStandardMaterial({ color: '#E8E2D8', roughness: 0.95 }));
    clay.position.set(-1.3, -0.65, 0.5);
    const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.6, 0.21, 300, 48), new THREE.MeshPhysicalMaterial({ color: '#F4EEF7', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.04 }));
    knot.position.set(-0.75, 1.95, -0.3);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.17, 64, 160), new THREE.MeshStandardMaterial({ color: '#FFC46B', metalness: 1, roughness: 0.32 }));
    ring.position.set(0.85, -2.05, 0.6);
    scene.add(chrome, clay, knot, ring);

    return {
      scene, camera,
      update(t) {
        const a = phase(t) * TAU, w = weights(t);
        for (let i = 0; i < mixData.length; i++) mixData[i] = w[0] * envs[0][i] + w[1] * envs[1][i] + w[2] * envs[2][i];
        hdr.needsUpdate = true;
        target = pmrem.fromEquirectangular(hdr, target); // prefiltered every frame from the blended picture
        scene.environment = scene.background = target.texture;
        scene.environmentRotation.y = scene.backgroundRotation.y = a; // the whole picture turns once per loop
        knot.rotation.set(0.4, a, 0.2 * Math.sin(a));
        ring.rotation.set(0.55 + 0.2 * Math.sin(a), 0.5 * Math.sin(a), 0);
      },
    };
  },
  overlay(ctx, t, W, H) {
    // the light source: the panorama itself, turning, with the current name
    const w = weights(t), x = 90, y = 1610, pw = 900, ph = 225;
    const off = (phase(t) * pw) % pw;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x, y, pw, ph, 22); ctx.clip();
    let sum = 0;
    w.forEach((k, i) => {                  // a true cross-fade: each picture drawn with its share of what is there so far
      if (k <= 0) return;
      sum += k; ctx.globalAlpha = k / sum;
      ctx.drawImage(thumbs[i], x - off, y, pw, ph);
      ctx.drawImage(thumbs[i], x - off + pw, y, pw, ph);
    });
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(x, y, pw, ph, 22); ctx.stroke();
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; ctx.font = `600 26px ${FONT.sans}`;
    ctx.fillText('the only light: a 360° HDR image', x + 4, y - 22);
    w.forEach((k, i) => {                  // names swap through nothing, never drawn on top of each other
      if (k <= 0.5) return;
      ctx.globalAlpha = smoothstep(0.5, 1, k);
      ctx.textAlign = 'right'; ctx.font = `800 34px ${FONT.sans}`; ctx.fillStyle = '#FFFFFF';
      ctx.fillText(NAMES[i], x + pw - 4, y - 20);
    });
    ctx.globalAlpha = 1;
  },
};
