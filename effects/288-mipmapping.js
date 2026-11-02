// Mipmapping: one tiled floor runs to the horizon under a still camera, and a divider sweeps across it. Left of the
// divider the texture is read with nearest filtering and no mipmaps, so far away each pixel lands on one arbitrary
// texel and the tiles break into moiré; right of it the same texture is read trilinearly from its mip chain with
// 16x anisotropic filtering and stays clean to the horizon. The chain itself (1024 -> 1, every level a 2 x 2 box
// average of the one above) is drawn below. For a while a second texture whose levels are tinted one colour each
// fades in, so the floor shows which level the GPU picked at every distance (the left side never leaves level 0).
// Nothing in the picture moves except the divider and the tint, so the aliasing is visible but never crawls.
import * as THREE from 'three';
import { TAU, phase, FONT, smoothstep } from '../lib/util.js';

const N = 1024, LEVELS = 11;                              // 1024, 512, ... 1
const TINTS = ['#FF4D5E', '#FF8A3D', '#FFC23D', '#C9E84A', '#5FD873', '#3CCFB4', '#3DB5F0', '#5B7CFF', '#9466FF', '#D45BE8', '#FF66B3'];
const split = t => 0.5 + 0.21 * Math.sin(phase(t) * TAU + 0.4);   // the divider, as a share of the width
const tint = t => smoothstep(1.5, 2.0, t) - smoothstep(3.5, 4.0, t);
const PANEL = { x: 40, y: 1480, w: 1000, h: 400 };

// level 0: cream and teal tiles with thin grout, 16 x 16 tiles per texture
function baseLevel() {
  const c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), s = N / 16;
  for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
    g.fillStyle = (i + j) % 2 ? '#22525A' : '#EFE4CF';
    g.fillRect(i * s, j * s, s, s);
  }
  g.fillStyle = '#7C6A58';
  for (let k = 0; k < 16; k++) { g.fillRect(k * s, 0, 5, N); g.fillRect(0, k * s, N, 5); }
  return c;
}
// the next level down: every pixel is the mean of a 2 x 2 block (a box filter)
function halve(src) {
  const n = src.width / 2, d = document.createElement('canvas'); d.width = d.height = n;
  const a = src.getContext('2d').getImageData(0, 0, n * 2, n * 2).data, out = d.getContext('2d').createImageData(n, n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) for (let k = 0; k < 4; k++) {
    const i = ((y * 2) * n * 2 + x * 2) * 4 + k, r = n * 2 * 4;
    out.data[(y * n + x) * 4 + k] = (a[i] + a[i + 4] + a[i + r] + a[i + r + 4] + 2) >> 2;
  }
  d.getContext('2d').putImageData(out, 0, 0);
  return d;
}
function tinted(src, col) {
  const c = document.createElement('canvas'); c.width = c.height = src.width;
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalAlpha = 0.62; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height);
  return c;
}

let chain, tintChain;

export default {
  name: 'Mipmapping',
  ko: '밉매핑',
  three(renderer, W, H) {
    chain = [baseLevel()];
    for (let l = 1; l < LEVELS; l++) chain.push(halve(chain[l - 1]));
    tintChain = chain.map((c, l) => tinted(c, TINTS[l]));
    const aniso = Math.min(16, renderer.capabilities.getMaxAnisotropy());
    const make = (levels, mips) => {
      const tx = new THREE.Texture(levels[0]);
      tx.colorSpace = THREE.SRGBColorSpace;
      tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
      tx.magFilter = THREE.LinearFilter;
      tx.generateMipmaps = false;
      if (mips) { tx.mipmaps = levels; tx.minFilter = THREE.LinearMipmapLinearFilter; tx.anisotropy = aniso; } else tx.minFilter = THREE.NearestFilter;
      tx.needsUpdate = true;
      return tx;
    };

    const scene = new THREE.Scene();
    const sky = document.createElement('canvas'); sky.width = 4; sky.height = 512;
    const sg = sky.getContext('2d'), grd = sg.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#141B36'); grd.addColorStop(0.18, '#2C2F5C'); grd.addColorStop(0.3, '#B9798A'); grd.addColorStop(0.33, '#F3C49A'); grd.addColorStop(1, '#F3C49A');
    sg.fillStyle = grd; sg.fillRect(0, 0, 4, 512);
    scene.background = new THREE.CanvasTexture(sky); scene.background.colorSpace = THREE.SRGBColorSpace;

    const camera = new THREE.PerspectiveCamera(50, W / H, 0.05, 5000);
    camera.position.set(0, 1.5, 0);
    camera.rotation.set(-0.2009, 0, 0);                  // horizon about 540 px from the top

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.ShaderMaterial({
      uniforms: {
        uNear: { value: make(chain, false) }, uMip: { value: make(chain, true) },
        uTintNear: { value: make(tintChain, false) }, uTintMip: { value: make(tintChain, true) },
        uSplit: { value: 0.5 }, uTint: { value: 0 }, uHaze: { value: new THREE.Color('#F3C49A') },
      },
      vertexShader: `varying vec2 vUv; varying float vDist;
        void main() { vUv = uv * 3000.0; vec4 mv = modelViewMatrix * vec4(position, 1.0); vDist = -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D uNear, uMip, uTintNear, uTintMip; uniform float uSplit, uTint; uniform vec3 uHaze;
        varying vec2 vUv; varying float vDist;
        void main() {
          // read all four every pixel (no texture reads inside a branch), then pick the side
          vec3 a = mix(texture2D(uNear, vUv).rgb, texture2D(uTintNear, vUv).rgb, uTint);
          vec3 b = mix(texture2D(uMip, vUv).rgb, texture2D(uTintMip, vUv).rgb, uTint);
          vec3 col = gl_FragCoord.x < uSplit ? a : b;
          col *= 0.8 + 0.2 * smoothstep(1.5, 9.0, vDist);  // a little darker right under the camera
          col = mix(col, uHaze, smoothstep(600.0, 2800.0, vDist));
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    }));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    return {
      scene, camera,
      update(t) {
        floor.material.uniforms.uSplit.value = split(t) * W;
        floor.material.uniforms.uTint.value = tint(t);
      },
    };
  },
  overlay(ctx, t, W, H) {
    const x = split(t) * W, k = tint(t);
    // the divider
    const glow = ctx.createLinearGradient(x - 14, 0, x + 14, 0);
    glow.addColorStop(0, 'rgba(255, 246, 230, 0)'); glow.addColorStop(0.5, 'rgba(255, 246, 230, 0.5)'); glow.addColorStop(1, 'rgba(255, 246, 230, 0)');
    ctx.fillStyle = glow; ctx.fillRect(x - 14, 538, 28, PANEL.y - 538 - 20);
    ctx.fillStyle = '#FFF6E6'; ctx.fillRect(x - 1.5, 538, 3, PANEL.y - 538 - 20);

    // side labels riding with the divider
    const tag = (lines, right) => {
      ctx.font = `700 30px ${FONT.sans}`;
      const w = Math.max(...lines.map((s, i) => { ctx.font = i ? `500 24px ${FONT.sans}` : `700 30px ${FONT.sans}`; return ctx.measureText(s).width; })) + 36;
      const bx = right ? x + 22 : x - 22 - w, by = 1330;
      ctx.fillStyle = 'rgba(12, 16, 30, 0.72)'; ctx.beginPath(); ctx.roundRect(bx, by, w, 96, 18); ctx.fill();
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      lines.forEach((s, i) => {
        ctx.font = i ? `500 24px ${FONT.sans}` : `700 30px ${FONT.sans}`;
        ctx.fillStyle = i ? 'rgba(255, 255, 255, 0.72)' : '#FFFFFF';
        ctx.fillText(s, bx + 18, by + 40 + i * 36);
      });
    };
    tag(['NO MIPMAPS', 'nearest, level 0'], false);
    tag(['TRILINEAR', '+ 16× anisotropic'], true);

    // the mip chain panel
    const P = PANEL;
    ctx.fillStyle = 'rgba(12, 16, 30, 0.84)'; ctx.beginPath(); ctx.roundRect(P.x, P.y, P.w, P.h, 26); ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#FFFFFF'; ctx.font = `700 28px ${FONT.sans}`; ctx.textAlign = 'left';
    ctx.fillText('MIP CHAIN', P.x + 32, P.y + 52);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; ctx.font = `500 24px ${FONT.sans}`;
    ctx.fillText('each level = 2 × 2 average of the one above', P.x + 210, P.y + 52);
    ctx.globalAlpha = k; ctx.fillStyle = '#FFD9A8'; ctx.textAlign = 'right'; ctx.font = `700 24px ${FONT.sans}`;
    ctx.fillText('LEVEL TINT ON', P.x + P.w - 32, P.y + 52);
    ctx.globalAlpha = 1;
    const size = l => (l < 4 ? 264 / 2 ** l : 16), gap = l => (l < 4 ? 28 : 16);
    let total = 0;
    for (let l = 0; l < LEVELS; l++) total += size(l) + (l < LEVELS - 1 ? gap(l) : 0);
    let px = P.x + (P.w - total) / 2;
    const base = P.y + 372;                                // squares sit on one baseline
    for (let l = 0; l < LEVELS; l++) {
      const s = size(l);
      ctx.imageSmoothingEnabled = l < 4;                  // the tiny levels are shown as their real pixels
      ctx.drawImage(chain[l], px, base - s, s, s);
      if (k > 0) { ctx.globalAlpha = k; ctx.drawImage(tintChain[l], px, base - s, s, s); ctx.globalAlpha = 1; }
      ctx.strokeStyle = TINTS[l]; ctx.lineWidth = 3; ctx.strokeRect(px - 1.5, base - s - 1.5, s + 3, s + 3);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; ctx.font = `600 ${l < 4 ? 20 : 17}px ${FONT.mono}`; ctx.textAlign = 'center';
      ctx.fillText(String(N >> l), px + s / 2, base - s - 14);
      px += s + gap(l);
    }
  },
};
