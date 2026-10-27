// Liquid chrome: mirror-metal 3D letters (metalness 1, low roughness) reflect a painted sky / horizon / floor
// environment that turns once per loop, so the reflections run across the surface. Chrome sparkles orbit.
import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { TAU, phase, canvas } from '../lib/util.js';

function paint(w, h, stops, extra) {
  const c = canvas(w, h), g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, h);
  for (const [k, col] of stops) grd.addColorStop(k, col);
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  if (extra) extra(g);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default {
  name: 'Y2K Chrome',
  ko: 'Y2K 크롬',
  async three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    const scene = new THREE.Scene();
    scene.background = paint(W, H, [[0, '#0B0F3A'], [0.45, '#2B3FA8'], [0.75, '#B58BEA'], [1, '#FFD6F2']], g => {
      const glow = g.createRadialGradient(W / 2, H * 0.52, 50, W / 2, H * 0.52, 700);
      glow.addColorStop(0, 'rgba(190, 220, 255, 0.45)'); glow.addColorStop(1, 'rgba(190, 220, 255, 0)');
      g.fillStyle = glow; g.fillRect(0, 0, W, H);
    });
    // sky, bright horizon, dark floor, plus a few softboxes for the sharp highlights
    const env = paint(1024, 512, [[0, '#0A1E66'], [0.3, '#4C8CF0'], [0.47, '#DDF0FF'], [0.5, '#FFFFFF'], [0.53, '#6B5260'], [0.72, '#1C1218'], [1, '#050506']], g => {
      g.fillStyle = '#FFFFFF';
      for (const x of [80, 340, 610, 860]) g.fillRect(x, 90, 70, 150);
      g.fillStyle = '#FF7AD9'; g.fillRect(470, 300, 160, 60);
      g.fillStyle = '#62E6FF'; g.fillRect(150, 310, 140, 50);
    });
    env.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = new THREE.PMREMGenerator(renderer).fromEquirectangular(env).texture;

    const camera = new THREE.PerspectiveCamera(35, W / H, 0.1, 100);
    camera.position.set(0, 0, 16);
    const chrome = new THREE.MeshStandardMaterial({ color: '#FFFFFF', metalness: 1, roughness: 0.07 });

    const font = await new FontLoader().loadAsync('/node_modules/three/examples/fonts/helvetiker_bold.typeface.json');
    const word = (text, width, y) => {
      const geo = new TextGeometry(text, { font, size: 1, depth: 0.32, curveSegments: 20, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.06, bevelSegments: 12 });
      geo.center();
      geo.computeBoundingBox();
      const m = new THREE.Mesh(geo, chrome);
      m.scale.setScalar(width / (geo.boundingBox.max.x - geo.boundingBox.min.x));
      m.position.y = y;
      scene.add(m);
      return m;
    };
    const big = word('Y2K', 4.5, 0.55), small = word('CHROME', 3.9, -1.5);

    const star = new THREE.Shape(); // four-point sparkle with concave sides
    star.moveTo(0, 1);
    star.quadraticCurveTo(0, 0, 1, 0); star.quadraticCurveTo(0, 0, 0, -1);
    star.quadraticCurveTo(0, 0, -1, 0); star.quadraticCurveTo(0, 0, 0, 1);
    const starGeo = new THREE.ExtrudeGeometry(star, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.05, bevelSegments: 6, curveSegments: 24 });
    starGeo.center();
    const sparkles = [[-1.9, 3.0, 0.75, 0], [2.0, 2.6, 0.5, 2], [1.8, -3.1, 0.8, 4], [-2.0, -2.8, 0.45, 1]].map(([x, y, s, k]) => {
      const m = new THREE.Mesh(starGeo, chrome);
      m.scale.setScalar(s);
      scene.add(m);
      return { m, x, y, k };
    });

    return {
      scene, camera,
      update(t) {
        const a = phase(t) * TAU;
        scene.environmentRotation.set(0.15 * Math.sin(a), a, 0);
        big.rotation.set(0.10 * Math.sin(2 * a), 0.32 * Math.sin(a), 0.03 * Math.sin(a));
        small.rotation.set(-0.16 + 0.10 * Math.sin(2 * a + 0.6), 0.32 * Math.sin(a + 0.6), 0); // tipped back to catch the sky
        for (const s of sparkles) {
          s.m.position.set(s.x + 0.15 * Math.cos(a + s.k), s.y + 0.2 * Math.sin(a + s.k), 0.5);
          s.m.rotation.set(0.3 * Math.sin(a + s.k), 0.5 * Math.sin(a + s.k), a + s.k);
        }
      },
    };
  },
};
