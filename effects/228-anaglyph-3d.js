// Anaglyph 3D: the scene is rendered twice, from a left and a right eye 0.2 units apart whose frusta converge on
// the plane of the white knot (three's StereoCamera), then merged: red from the left eye's brightness, green and
// blue from the right eye. The knot sits on the convergence plane and has no fringe; a helix of beads spirals out of
// the deep background (red on the left, cyan on the right) and through the screen towards you (the colours swap).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TAU, FONT, smoothstep } from '../lib/util.js';

const N = 72, PER_TURN = 12, STEP = 0.55, FOCUS = 13; // beads, beads per turn, depth between beads, convergence distance

const merge = /* glsl */ `
uniform sampler2D tL, tR;
varying vec2 vUv;
void main() {
  vec3 l = texture2D(tL, vUv).rgb, r = texture2D(tR, vUv).rgb;
  gl_FragColor = vec4(dot(l, vec3(0.299, 0.587, 0.114)), r.g, r.b, 1.0); // half-colour anaglyph
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export default {
  name: 'Anaglyph 3D',
  ko: '애너글리프 입체',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#101219');
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.7;
    const key = new THREE.DirectionalLight('#FFFFFF', 2.0);
    key.position.set(-4, 6, 10);
    scene.add(key);

    const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 100);
    camera.position.set(0, 0, FOCUS);
    camera.focus = FOCUS;
    const stereo = new THREE.StereoCamera();
    stereo.eyeSep = 0.2;

    // the knot on the convergence plane (z = 0): no parallax, so no colour fringe
    const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(1.1, 0.36, 300, 48, 2, 3), new THREE.MeshStandardMaterial({ color: '#F2F0EA', roughness: 0.3, metalness: 0.1 }));
    scene.add(knot);
    // a helix of beads from far behind (z = -30) to in front of the screen (z = +9)
    const beadGeo = new THREE.IcosahedronGeometry(0.42, 4);
    const tints = ['#FFFFFF', '#E9E4FF', '#FFF2D9', '#DDF3FF'];
    const beads = Array.from({ length: N }, (_, i) => {
      const m = new THREE.Mesh(beadGeo, new THREE.MeshStandardMaterial({ color: tints[i % 4], roughness: 0.35, metalness: 0.05 }));
      scene.add(m);
      return m;
    });
    // a few rings hanging at different depths
    const rings = [[-2.2, 2.6, -8, 1.3], [2.4, -3.0, -4, 1.0], [-2.0, -4.2, 4, 0.8], [2.1, 4.4, 2.5, 0.7]].map(([x, y, z, s], k) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(s, 0.12, 24, 96), new THREE.MeshStandardMaterial({ color: '#E8E6F0', roughness: 0.3 }));
      m.position.set(x, y, z); m.userData.k = k;
      scene.add(m);
      return m;
    });

    const opts = { type: THREE.HalfFloatType, samples: 4 };
    const left = new THREE.WebGLRenderTarget(W, H, opts), right = new THREE.WebGLRenderTarget(W, H, opts);
    const screen = new THREE.Scene(), flatCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: { tL: { value: left.texture }, tR: { value: right.texture } }, fragmentShader: merge, depthTest: false,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    }));
    quad.frustumCulled = false;
    screen.add(quad);

    return {
      scene, camera,
      render(t) {
        const u = t / 5;
        knot.rotation.set(0.5, 0.3, u * TAU / 3); // a third of a turn about its own axis: the knot looks the same again
        // the helix slides four beads towards the viewer per loop (the tints repeat every four), turning with it;
        // beads grow out of nothing far away and shrink away just before they reach the camera
        beads.forEach((b, i) => {
          const k = i + 4 * u, a = k / PER_TURN * TAU, z = -30 + k * STEP;
          b.position.set(2.2 * Math.cos(a), 3.3 * Math.sin(a), z);
          b.scale.setScalar(Math.max(1e-3, smoothstep(-30 + 4 * STEP, -24, z) * smoothstep(-30 + N * STEP, 6.5, z)));
        });
        rings.forEach(m => { m.rotation.set(0.6 * Math.sin(u * TAU + m.userData.k), u * TAU, 0); });
        // a gentle sway of the viewpoint shows the depth from slightly different angles
        camera.position.set(1.2 * Math.sin(u * TAU), 0.5 * Math.sin(2 * u * TAU), FOCUS);
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld();
        stereo.update(camera);
        renderer.setRenderTarget(left);
        renderer.render(scene, stereo.cameraL);
        renderer.setRenderTarget(right);
        renderer.render(scene, stereo.cameraR);
        renderer.setRenderTarget(null);
        renderer.render(screen, flatCam);
      },
    };
  },
  overlay(ctx, t, W, H) {
    // a pair of red / cyan glasses as a hint
    const x = W / 2, y = 1770;
    ctx.fillStyle = 'rgba(10, 12, 18, 0.7)';
    ctx.beginPath(); ctx.roundRect(x - 250, y - 70, 500, 205, 34); ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    for (const [dx, color] of [[-80, 'rgba(255, 40, 60, 0.9)'], [80, 'rgba(0, 220, 255, 0.9)']]) {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.roundRect(x + dx - 62, y - 36, 124, 72, 26); ctx.fill(); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(x - 18, y - 10); ctx.quadraticCurveTo(x, y - 26, x + 18, y - 10); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF'; ctx.font = `700 30px ${FONT.sans}`; ctx.fillText('RED / CYAN GLASSES', x, y + 82);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; ctx.font = `500 26px ${FONT.ko}`; ctx.fillText('빨강·청록 안경으로 보세요', x, y + 118);
  },
};
