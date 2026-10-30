// Bloom: seven neon arches and a floating orb over a black mirror floor, rendered in HDR. Their emissive intensity
// rises and falls in a pulse that runs down the corridor (0.3x to 6x); UnrealBloomPass with no threshold (physically
// based: every pixel scatters a share of its light through a blurred mip chain), so the glow grows smoothly with
// intensity and only the HDR-bright arches throw wide halos. A hard threshold would make whole arches pop on.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { TAU, phase } from '../lib/util.js';

const N = 7, GAP = 2.7;
const level = (t, k) => 0.3 + 5.7 * (0.5 + 0.5 * Math.cos(phase(t) * TAU - k * 0.9)) ** 4; // 0.3 .. 6, a pulse running back

export default {
  name: 'Bloom',
  ko: '블룸',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#05040A');
    scene.fog = new THREE.Fog('#05040A', 8, 26);
    const camera = new THREE.PerspectiveCamera(48, W / H, 0.1, 100);

    // the arches: two legs and a half circle, swept as a thin tube
    const pts = [];
    for (let i = 0; i <= 20; i++) pts.push(new THREE.Vector3(-1.6, 2.2 * i / 20, 0));
    for (let i = 1; i < 60; i++) { const q = Math.PI * (1 - i / 60); pts.push(new THREE.Vector3(1.6 * Math.cos(q), 2.2 + 1.6 * Math.sin(q), 0)); }
    for (let i = 0; i <= 20; i++) pts.push(new THREE.Vector3(1.6, 2.2 * (1 - i / 20), 0));
    const path = new THREE.CatmullRomCurve3(pts);
    const archGeo = new THREE.TubeGeometry(path, 300, 0.055, 12, false);
    const hue = k => new THREE.Color().setHSL(0.94 - 0.44 * k / (N - 1), 1, 0.5); // magenta -> violet -> blue -> cyan
    const arches = Array.from({ length: N }, (_, k) => {
      const m = new THREE.Mesh(archGeo, new THREE.MeshBasicMaterial());
      m.position.z = -3.6 - k * GAP;
      scene.add(m);
      return m;
    });
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 48, 32), new THREE.MeshBasicMaterial());
    scene.add(orb);
    const halo = new THREE.PointLight('#FFD9B0', 6, 10, 2);
    scene.add(halo);

    // a black mirror floor (a planar reflector, dimmed by a plain multiply)
    const mirror = new Reflector(new THREE.PlaneGeometry(14, 40), { textureWidth: W / 2, textureHeight: H / 2, color: new THREE.Color(0.32, 0.3, 0.36) });
    mirror.material.fragmentShader = mirror.material.fragmentShader.replace('blendOverlay( base.rgb, color )', 'base.rgb * color'); // keep HDR hues
    mirror.rotation.x = -Math.PI / 2; mirror.position.z = -12;
    scene.add(mirror);

    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(1);
    composer.setSize(W, H);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.6, 0.65, 0));
    composer.addPass(new OutputPass());

    return {
      render(t) {
        const a = phase(t) * TAU;
        camera.position.set(1.25 + 0.3 * Math.sin(a), 1.05 + 0.08 * Math.sin(2 * a), 5.6 + 0.4 * Math.cos(a));
        camera.lookAt(-0.25, 1.6, -9);
        arches.forEach((m, k) => m.material.color.copy(hue(k)).multiplyScalar(level(t, k)));
        const glow = 0.6 + level(t, 3) * 0.9;
        orb.material.color.setRGB(1, 0.86, 0.7).multiplyScalar(glow);
        orb.position.set(0, 1.7 + 0.12 * Math.sin(a), -3.6 - 3 * GAP + 0.6);
        halo.position.copy(orb.position); halo.intensity = glow * 1.5;
        composer.render();
      },
    };
  },
};
