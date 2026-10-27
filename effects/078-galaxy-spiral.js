// Galaxy: 60,000 GPU points on logarithmic spiral arms plus a bulge. Every star is copied three times, 120 degrees
// apart, so turning the disc a third of a circle in 5 s lands exactly on the start; stars twinkle with looping sines.
// The disc is drawn BLUR times at slightly earlier angles (each dimmer), a motion blur that keeps the stars from sparkling.
import * as THREE from 'three';
import { TAU, rng } from '../lib/util.js';

const BASE = 20000, R = 4.6, BLUR = 12;

function glowTexture(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  stops.forEach(([k, col]) => gr.addColorStop(k, col));
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default {
  name: 'Galaxy Spiral',
  ko: '은하 소용돌이',
  three(renderer, W, H) {
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas'); bg.width = 270; bg.height = 480;
    const b = bg.getContext('2d'), q = rng(5);
    b.fillStyle = '#03030C'; b.fillRect(0, 0, 270, 480);
    for (const [x, y, rad, col] of [[70, 120, 160, 'rgba(90, 40, 140, 0.35)'], [210, 380, 180, 'rgba(30, 60, 140, 0.35)'], [140, 250, 220, 'rgba(60, 30, 90, 0.3)']]) {
      const gr = b.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
      b.fillStyle = gr; b.fillRect(0, 0, 270, 480);
    }
    for (let i = 0; i < 220; i++) { b.fillStyle = `rgba(255,255,255,${0.15 + 0.45 * q()})`; b.fillRect(q() * 270, q() * 480, 0.6, 0.6); }
    scene.background = new THREE.CanvasTexture(bg);
    scene.background.colorSpace = THREE.SRGBColorSpace;

    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 100);
    camera.position.set(0, 10.5, 7.5);
    camera.lookAt(0, -0.6, 0);

    const r = rng(78), pos = [], col = [], seed = [];
    const inner = new THREE.Color('#FFD7A0'), outer = new THREE.Color('#5E7BFF'), pink = new THREE.Color('#FF6FB5'), c = new THREE.Color();
    for (let i = 0; i < BASE; i++) {
      const bulge = i < BASE * 0.12;
      const rad = bulge ? 0.9 * r() ** 1.5 : 0.25 + R * r() ** 1.35;
      const width = bulge ? 0.6 : 0.25 + 0.22 * rad, off = () => r() ** 2.2 * (r() < 0.5 ? -1 : 1) * width;
      const a = bulge ? r() * TAU : rad * 1.05; // one arm here; the copies make the other two
      const x = Math.cos(a) * rad + off(), z = Math.sin(a) * rad + off();
      const y = (r() - 0.5) * (bulge ? 0.7 : 0.18) * (1.2 - rad / R);
      c.copy(inner).lerp(outer, Math.min(1, rad / R * 1.3));
      if (!bulge && r() < 0.05) c.copy(pink);
      for (let k = 0; k < 3; k++) { // the three 120-degree copies
        const ca = Math.cos(k * TAU / 3), sa = Math.sin(k * TAU / 3);
        pos.push(x * ca - z * sa, y, x * sa + z * ca);
        col.push(c.r, c.g, c.b);
        seed.push(r() * TAU, 1 + Math.floor(r() * 3), 0.8 + 2.2 * r() ** 3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 3)); // phase, integer twinkle rate, size
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uPhase: { value: 0 } },
      vertexShader: `attribute vec3 aColor; attribute vec3 aSeed; uniform float uPhase; varying vec3 vColor;
        void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vColor = aColor * (0.75 + 0.25 * sin(uPhase * 6.2831853 * aSeed.y + aSeed.x));
          gl_PointSize = (3.4 + 2.0 * aSeed.z) * 13.0 / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vColor;
        void main() { float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vColor * smoothstep(0.5, 0.0, d) * 0.6 / ${BLUR}.0, 1.0); }`,
    });
    const galaxy = new THREE.Group();
    const discs = Array.from({ length: BLUR }, () => new THREE.Points(geo, mat));
    galaxy.add(...discs);
    const core = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture([[0, 'rgba(255,245,225,1)'], [0.15, 'rgba(255,200,140,0.7)'], [0.45, 'rgba(255,140,90,0.15)'], [1, 'rgba(255,120,80,0)']]),
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    core.scale.set(3.6, 3.6, 1);
    galaxy.add(core);
    galaxy.rotation.z = 0.12;
    scene.add(galaxy);

    return {
      scene, camera,
      update(t) {
        mat.uniforms.uPhase.value = t / 5;
        discs.forEach((d, k) => { d.rotation.y = (t - k * 0.45 / 30) / 5 * TAU / 3; }); // a third of a turn; arms trail
      },
    };
  },
};
