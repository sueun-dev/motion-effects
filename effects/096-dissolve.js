// Burn dissolve: fragments of the teapot are discarded where (object-space noise + depth from the top) is below a threshold
// that rises and falls; the surface just above it glows white-hot to orange, and embers drift up from the burning edge.
import * as THREE from 'three';
import { TeapotGeometry } from 'three/addons/geometries/TeapotGeometry.js';
import { TAU, phase, span, smoothstep, fract, rng } from '../lib/util.js';

// threshold: below 0 the pot is whole, above 1 it is gone. Burns away, stays gone a moment, then grows back
const burn = t => -0.05 + 1.1 * (span(t, 0.3, 2.2) - span(t, 2.6, 4.6));
const screen = { bottom: 1300, top: 800 }; // where the pot is on screen, for the embers

const DIR = new THREE.Vector3(-0.55, 1, 0.35).normalize(); // burn direction, tilted so no flat surface goes up at once
const NOISE = `
const vec3 DIR = vec3(${DIR.x}, ${DIR.y}, ${DIR.z});
float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise3(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float burnField(vec3 p) {
  float n = 0.7 * vnoise3(p * 1.5) + 0.3 * vnoise3(p * 3.1 + 7.0);
  return 0.32 * n + 0.68 * clamp((uY.y - dot(p, DIR)) / (uY.y - uY.x), 0.0, 1.0); // sweeps down from the upper left
}
`;

export default {
  name: 'Dissolve',
  ko: '디졸브 번',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas'); // a dim stage with a warm pool of light behind the pot
    bg.width = 270; bg.height = 480;
    const bgc = bg.getContext('2d'), grd = bgc.createRadialGradient(135, 230, 10, 135, 230, 300);
    grd.addColorStop(0, '#4A2A4E'); grd.addColorStop(0.5, '#25142C'); grd.addColorStop(1, '#0C0710');
    bgc.fillStyle = grd; bgc.fillRect(0, 0, 270, 480);
    scene.background = new THREE.CanvasTexture(bg);
    scene.background.colorSpace = THREE.SRGBColorSpace;
    const camera = new THREE.PerspectiveCamera(36, W / H, 0.5, 60);
    camera.position.set(0, 2.8, 12.5);
    camera.lookAt(0, 0.15, 0);

    scene.add(new THREE.HemisphereLight('#E9D9FF', '#2A1420', 1.2));
    const key = new THREE.DirectionalLight('#FFFFFF', 2.6);
    key.position.set(-4, 6, 5);
    const rim = new THREE.DirectionalLight('#FF9A5A', 2.0);
    rim.position.set(5, 2, -4);
    scene.add(key, rim);

    const geo = new TeapotGeometry(1.0, 16, true, true, true, false, true);
    geo.center();
    geo.computeBoundingBox();
    const along = [], vp = geo.attributes.position;
    for (let i = 0; i < vp.count; i++) along.push(vp.getX(i) * DIR.x + vp.getY(i) * DIR.y + vp.getZ(i) * DIR.z);
    const uniforms = { uThr: { value: 0 }, uY: { value: new THREE.Vector2(Math.min(...along), Math.max(...along)) } };
    const mat = new THREE.MeshStandardMaterial({ color: '#7FD3E8', roughness: 0.28, metalness: 0.1, side: THREE.DoubleSide });
    mat.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = 'varying vec3 vObj;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
      shader.fragmentShader = 'uniform float uThr;\nuniform vec2 uY;\nvarying vec3 vObj;\n' + NOISE + shader.fragmentShader
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
          float burnV = burnField(vObj) - uThr;
          if (burnV < 0.0) discard;`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          if (!gl_FrontFacing) diffuseColor.rgb *= 0.35;
          diffuseColor.rgb = mix(vec3(0.08, 0.03, 0.02), diffuseColor.rgb, smoothstep(0.03, 0.09, burnV)); // charred rim`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float core = exp(-burnV / 0.012), heat = exp(-burnV / 0.05);
          totalEmissiveRadiance += core * vec3(5.0, 3.2, 1.2) + heat * vec3(1.6, 0.35, 0.05);`);
    };
    const pot = new THREE.Mesh(geo, mat);
    const S = 1.0;
    pot.scale.setScalar(S);
    scene.add(pot);
    camera.updateMatrixWorld();
    const toScreen = y => (1 - (new THREE.Vector3(0, y * S, 0).project(camera).y + 1) / 2) * H;
    screen.bottom = toScreen(geo.boundingBox.min.y); screen.top = toScreen(geo.boundingBox.max.y);

    const floor = new THREE.Mesh(new THREE.CircleGeometry(3.2, 96), new THREE.MeshStandardMaterial({ color: '#4A3046', roughness: 0.7 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = geo.boundingBox.min.y * S - 0.04;
    scene.add(floor);

    return {
      scene, camera,
      update(t) {
        uniforms.uThr.value = burn(t);
        pot.rotation.y = phase(t) * TAU + 0.6;
      },
    };
  },

  // embers: each one is born on the burning edge, rises and fades; brightness follows how much edge there is
  overlay(ctx, t, W, H) {
    ctx.globalCompositeOperation = 'lighter';
    const r = rng(9);
    for (let i = 0; i < 70; i++) {
      const seed = r(), x0 = W / 2 + (r() - 0.5) * 560, drift = (r() - 0.5) * 120, rate = 1 + Math.floor(r() * 2), size = 3 + r() * 5;
      const life = fract(seed + t * rate), born = t - life / rate, b = burn(born);
      const active = smoothstep(0.02, 0.12, b) * smoothstep(1.0, 0.85, b);
      if (active <= 0) continue;
      const y = screen.top + (screen.bottom - screen.top) * b - life * 380, x = x0 + drift * life + 18 * Math.sin(life * 6 + i);
      const a = active * Math.sin(Math.PI * life) * 0.9;
      const g = ctx.createRadialGradient(x, y, 0, x, y, size * 3);
      g.addColorStop(0, `rgba(255, 220, 140, ${a})`); g.addColorStop(0.35, `rgba(255, 120, 40, ${a * 0.6})`); g.addColorStop(1, 'rgba(255, 80, 20, 0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, size * 3, 0, TAU); ctx.fill();
    }
  },
};
