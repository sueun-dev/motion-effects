// Motion blur from a real shutter: the right half of every frame is the average of 32 renders spread over the time
// a 180 degree shutter is open (1/60 s), the left half is a single instant. A six-blade pinwheel spins up to
// 744 degrees a second and back down while a pendulum ball swings across the split: sharp and stepping on the left,
// smeared along its path on the right.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TAU, FONT } from '../lib/util.js';

const SUB = 32, SHUTTER = 1 / 60; // sub-frames per frame, and how long the shutter stays open (half a frame)
const TURNS = 20 / 6;              // the wheel turns 20 sixths of a turn per loop (it has six blades)
const wheelAngle = t => TURNS * TAU * (t / 5 + (Math.cos(t / 5 * TAU) - 1) / TAU); // still at 1.25 s, fastest at 3.75 s
const swing = t => 1.15 * Math.sin(2 * t / 5 * TAU);                             // pendulum angle, two swings a loop

export default {
  name: 'Motion Blur',
  ko: '모션 블러',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas');
    bg.width = 540; bg.height = 960;
    const g = bg.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 960);
    grd.addColorStop(0, '#1C1F3A'); grd.addColorStop(1, '#0E1022');
    g.fillStyle = grd; g.fillRect(0, 0, 540, 960);
    g.strokeStyle = 'rgba(255, 255, 255, 0.05)'; g.lineWidth = 2; // a faint fixed grid
    for (let x = 15; x < 540; x += 45) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 960); g.stroke(); }
    for (let y = 15; y < 960; y += 45) { g.beginPath(); g.moveTo(0, y); g.lineTo(540, y); g.stroke(); }
    scene.background = new THREE.CanvasTexture(bg);
    scene.background.colorSpace = THREE.SRGBColorSpace;
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.6;
    const key = new THREE.DirectionalLight('#FFFFFF', 2.2);
    key.position.set(-3, 5, 8);
    scene.add(key, new THREE.AmbientLight('#8890C0', 0.4));
    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
    camera.position.set(0, 0, 16);

    // the pinwheel: six coloured blades, a white rim and a gold hub
    const wheel = new THREE.Group();
    wheel.position.set(0, 1.3, 0);
    const colors = ['#FF5A5F', '#FFC233', '#2EC4B6', '#5B7CFA', '#FF8FAB', '#9BE564'];
    const paddle = new THREE.Shape(); // narrow at the hub, wide at the rim
    paddle.moveTo(-0.12, 0.2); paddle.lineTo(0.12, 0.2); paddle.lineTo(0.38, 1.42); paddle.quadraticCurveTo(0, 1.52, -0.38, 1.42); paddle.closePath();
    const bladeGeo = new THREE.ExtrudeGeometry(paddle, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3 });
    bladeGeo.translate(0, 0, -0.04);
    colors.forEach((c, i) => {
      const blade = new THREE.Mesh(bladeGeo, new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.1 }));
      blade.rotation.z = i / 6 * TAU;
      wheel.add(blade);
    });
    const white = new THREE.MeshStandardMaterial({ color: '#F4F4FA', roughness: 0.3, metalness: 0.2 });
    wheel.add(new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.07, 20, 160), white));
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.3, 48), new THREE.MeshStandardMaterial({ color: '#E8C26A', metalness: 1, roughness: 0.25 }));
    hub.rotation.x = Math.PI / 2;
    wheel.add(hub);
    scene.add(wheel);

    // the pendulum: a rod and a glossy ball hanging from a fixed pin
    const pendulum = new THREE.Group();
    pendulum.position.set(0, -1.15, 0.4);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.3, 16), white);
    rod.position.y = -1.15;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.34, 48, 32), new THREE.MeshPhysicalMaterial({ color: '#FF6B3D', roughness: 0.2, clearcoat: 1 }));
    ball.position.y = -2.3;
    pendulum.add(rod, ball);
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 16), hub.material);
    pin.position.copy(pendulum.position);
    scene.add(pendulum, pin);

    const pose = t => { wheel.rotation.z = -wheelAngle(t); pendulum.rotation.z = swing(t); };

    // the blurred half: average SUB renders spread over the open shutter
    renderer.getContext().getExtension('EXT_float_blend');
    const one = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
    const sum = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType });
    const still = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
    const fullscreen = mat => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
      m.frustumCulled = false;
      if (mat.isMeshBasicMaterial) mat.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', 'gl_Position = vec4(position.xy, 0.0, 1.0);'); };
      const s = new THREE.Scene(); s.add(m);
      return s;
    };
    const addPass = fullscreen(new THREE.ShaderMaterial({ // adds one sub-frame, weighted 1 / SUB
      uniforms: { uTex: { value: one.texture } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D uTex; varying vec2 vUv; void main() { gl_FragColor = vec4(texture2D(uTex, vUv).rgb / ${SUB}.0, 1.0); }`,
      blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false,
    }));
    const showBlur = fullscreen(new THREE.MeshBasicMaterial({ map: sum.texture, depthTest: false }));
    const showStill = fullscreen(new THREE.MeshBasicMaterial({ map: still.texture, depthTest: false }));
    const flatCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    return {
      scene, camera,
      render(t) {
        // right half: the shutter-averaged image
        renderer.setRenderTarget(sum);
        renderer.setClearColor('#000000', 1);
        renderer.clear();
        for (let k = 0; k < SUB; k++) {
          pose(t + ((k + 0.5) / SUB - 0.5) * SHUTTER);
          renderer.setRenderTarget(one);
          renderer.render(scene, camera);
          renderer.setRenderTarget(sum);
          renderer.autoClear = false;
          renderer.render(addPass, flatCam);
          renderer.autoClear = true;
        }
        renderer.setRenderTarget(null);
        renderer.setScissorTest(true);
        renderer.setScissor(W / 2, 0, W / 2, H);
        renderer.render(showBlur, flatCam);
        // left half: one instant
        renderer.setScissorTest(false);
        pose(t);
        renderer.setRenderTarget(still);
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);
        renderer.setScissorTest(true);
        renderer.setScissor(0, 0, W / 2, H);
        renderer.autoClear = false;
        renderer.render(showStill, flatCam);
        renderer.autoClear = true;
        renderer.setScissorTest(false);
      },
    };
  },
  overlay(ctx, t, W, H) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(W / 2 - 1.5, 280, 3, H - 280); // the split
    const caption = (x, title, ko, sub, color) => {
      ctx.textAlign = 'center';
      ctx.fillStyle = color; ctx.font = `800 40px ${FONT.sans}`; ctx.fillText(title, x, 1790);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'; ctx.font = `500 28px ${FONT.ko}`; ctx.fillText(ko, x, 1832);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'; ctx.font = `500 26px ${FONT.mono}`; ctx.fillText(sub, x, 1874);
    };
    caption(W / 4, 'NO BLUR', '블러 없음', '1 instant', '#9FB4FF');
    caption(W * 3 / 4, 'MOTION BLUR', '모션 블러', '180° · 1/60 s', '#FFC233');
  },
};
