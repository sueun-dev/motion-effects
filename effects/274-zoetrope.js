// 3D zoetrope: 30 bird sculptures stand on brass rods round a spinning platter, each frozen one step further through
// a wingbeat (the sheet below shows them in order). The platter turns 12 degrees per video frame, exactly one bird
// spacing (6 turns in 5 s). Under continuous light each frame averages 64 renders across its 1/30 s, so the birds smear into a
// ring; under the strobe each frame is one instant, the next bird has taken the previous one's place, and the still
// sculptures become one flock beating its wings. The strobe fades in and out; nothing flashes.
import * as THREE from 'three';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TAU, FONT, smoothstep } from '../lib/util.js';

const N = 30, R = 2.9;                                      // birds, ring radius
const STEP = TAU / N;                                       // platter turn per frame: one bird spacing
const SUB = 64;                                             // renders averaged per frame under continuous light
const SHEET = { x: 60, y: 1600, w: 960, h: 230 };           // the 30 poses in two rows of 15 (px)
// how much of the frame is strobe (1) rather than continuous light (0)
const strobe = t => smoothstep(0.7, 1.25, t) * (1 - smoothstep(4.15, 4.7, t));

// one bird at wingbeat phase p (0..1): body, head, beak, tail, two wings hinged at the shoulders
function bird(mats) {
  const g = new THREE.Group(), body = new THREE.Group();
  const add = (geo, mat, x, y, z, parent = body) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  add(new THREE.SphereGeometry(0.3, 32, 20), mats.white, 0, 0, 0).scale.set(0.95, 0.9, 1.45);
  add(new THREE.SphereGeometry(0.2, 32, 20), mats.white, 0, 0.17, 0.38);
  add(new THREE.ConeGeometry(0.07, 0.2, 16), mats.beak, 0, 0.15, 0.62).rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.032, 12, 8), mats.dark, s * 0.13, 0.23, 0.5);
  const tail = add(new THREE.ConeGeometry(0.17, 0.42, 4), mats.blue, 0, 0.04, -0.52);
  tail.rotation.x = -Math.PI / 2 - 0.25; tail.scale.set(1.4, 1, 0.3);
  const wingShape = new THREE.Shape();                       // a swept wing, root at the origin, tip along +x
  wingShape.moveTo(0, 0.2); wingShape.bezierCurveTo(0.5, 0.32, 0.95, 0.12, 1.15, -0.12);
  wingShape.bezierCurveTo(0.8, -0.1, 0.4, -0.28, 0, -0.18); wingShape.lineTo(0, 0.2);
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2, curveSegments: 24 });
  wingGeo.rotateX(Math.PI / 2);                              // lie flat: the wing spans x, its chord runs along z
  const wings = [-1, 1].map(s => {
    const hinge = new THREE.Group();
    hinge.position.set(s * 0.2, 0.1, 0.05);
    const w = new THREE.Mesh(wingGeo, mats.blue);
    w.castShadow = true;
    w.scale.x = s;
    hinge.add(w);
    body.add(hinge);
    return hinge;
  });
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 12), mats.brass);
  rod.castShadow = true;
  g.add(body, rod);
  g.userData.pose = p => {                                   // wings up at 0, down at 0.5; the body rises on the downstroke
    const a = TAU * p, y = 1.2 + 0.12 * Math.sin(a - 0.6);
    wings[0].rotation.z = -0.62 * Math.cos(a) - 0.1;
    wings[1].rotation.z = 0.62 * Math.cos(a) + 0.1;
    body.scale.setScalar(0.5);
    body.position.y = y;
    body.rotation.x = -0.12 * Math.sin(a);
    rod.scale.y = y - 0.1; rod.position.y = (y - 0.1) / 2;
  };
  return g;
}

export default {
  name: 'Zoetrope',
  ko: '조이트로프',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas');
    bg.width = 4; bg.height = 512;
    const g = bg.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#0E2430'); grd.addColorStop(0.55, '#1C4250'); grd.addColorStop(1, '#0A1A22');
    g.fillStyle = grd; g.fillRect(0, 0, 4, 512);
    scene.background = new THREE.CanvasTexture(bg);
    scene.background.colorSpace = THREE.SRGBColorSpace;
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.35;

    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
    camera.position.set(0, 18.6, 16.6);
    const key = new THREE.SpotLight('#FFE6C4', 900, 40, 0.5, 0.6, 2);
    key.position.set(-5, 14, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.radius = 5;
    scene.add(key, new THREE.HemisphereLight('#BFE3F0', '#20140C', 0.9));

    const mats = {
      white: new THREE.MeshStandardMaterial({ color: '#FFF6E8', roughness: 0.45 }),
      blue: new THREE.MeshStandardMaterial({ color: '#5FB6D9', roughness: 0.4 }),
      beak: new THREE.MeshStandardMaterial({ color: '#FF8A3D', roughness: 0.4 }),
      dark: new THREE.MeshStandardMaterial({ color: '#1A1A22', roughness: 0.2 }),
      brass: new THREE.MeshStandardMaterial({ color: '#D9A54A', roughness: 0.3, metalness: 1 }),
    };
    // the turntable: walnut disc, brass rim and spindle, on a pedestal
    const platter = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: '#6B3F26', roughness: 0.55 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.24, 128), wood);
    disc.position.y = -0.12; disc.receiveShadow = disc.castShadow = true;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.07, 16, 160), mats.brass);
    rim.rotation.x = Math.PI / 2;
    const inlay = new THREE.Mesh(new THREE.RingGeometry(R - 0.3, R + 0.3, 128), new THREE.MeshStandardMaterial({ color: '#4A2817', roughness: 0.6 }));
    inlay.rotation.x = -Math.PI / 2; inlay.position.y = 0.004; inlay.receiveShadow = true;
    const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.9, 32), mats.brass);
    spindle.position.y = 0.45; spindle.castShadow = true;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.28, 32, 16), mats.brass);
    knob.position.y = 1.0; knob.castShadow = true;
    platter.add(disc, rim, inlay, spindle, knob);
    const birds = [];
    for (let j = 0; j < N; j++) {                          // bird j is frozen at phase -j/30: one step behind the next
      const b = bird(mats), a = j * TAU / N;
      b.position.set(R * Math.cos(a), 0, -R * Math.sin(a));
      b.rotation.y = a + Math.PI;                           // facing along the turn (counter-clockwise from above)
      b.userData.pose(((-j / N) % 1 + 1) % 1);
      platter.add(b);
      birds.push(b);
    }
    scene.add(platter);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.6, 1.6, 64), wood);
    base.position.y = -1.04; base.castShadow = base.receiveShadow = true;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.35 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -1.84; floor.receiveShadow = true;
    scene.add(base, floor);

    // the poses in order, side by side, for the strip under the turntable
    const lineup = new THREE.Scene();
    lineup.environment = scene.environment;
    lineup.environmentIntensity = 0.5;
    lineup.add(new THREE.HemisphereLight('#FFFFFF', '#3A2A20', 1.6));
    const sun = new THREE.DirectionalLight('#FFF1DC', 2.2);
    sun.position.set(-2, 5, 6);
    lineup.add(sun);
    for (let k = 0; k < N; k++) {                          // two rows of 15 in wingbeat order, bigger and without rods
      const b = bird(mats);
      b.userData.pose(k / N);
      b.children[1].visible = false;
      b.scale.setScalar(1.7);
      b.position.set(((k % 15) - 7) * 1.28, (k < 15 ? 0.95 : -1.45) - 2.2, 0);
      b.rotation.set(0.3, -1.25, 0);
      lineup.add(b);
    }
    const half = 9.6, aspect = SHEET.w / SHEET.h;
    const lineCam = new THREE.OrthographicCamera(-half, half, half / aspect, -half / aspect, 0.1, 50);
    lineCam.position.set(0, 0, 20);

    // continuous light: average SUB renders across the frame; strobe: one render at the frame's instant
    const frame = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
    const sum = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType });
    const addMat = new THREE.ShaderMaterial({
      uniforms: { tex: { value: frame.texture }, k: { value: 1 } }, depthTest: false, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: 'uniform sampler2D tex; uniform float k; varying vec2 vUv; void main() { gl_FragColor = texture2D(tex, vUv) * k; }',
    });
    const addScene = new THREE.Scene(), flat = new THREE.Camera();
    addScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), addMat));
    const output = new OutputPass();
    output.renderToScreen = true;
    const shot = (time, weight) => {                         // render the turntable at a time and add it to the sum
      platter.rotation.y = STEP * time * 30;
      frame.viewport.set(0, 0, W, H); frame.scissorTest = false;
      renderer.setRenderTarget(frame);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(scene, camera);
      addMat.uniforms.k.value = weight;
      renderer.setRenderTarget(sum);
      renderer.render(addScene, flat);
    };
    renderer.autoClear = false;
    return {
      render(t) {
        const s = strobe(t), sway = 0.13 * Math.sin(TAU * t / 5);   // the camera drifts slowly round the platter
        camera.position.set(Math.sin(sway) * 16.6, 18.6, Math.cos(sway) * 16.6);
        camera.lookAt(0, -0.5, 0);
        renderer.setRenderTarget(sum);
        renderer.setClearColor(0x000000, 0);
        renderer.clear();
        if (s < 1) for (let k = 0; k < SUB; k++) shot(t - (k + 0.5) / SUB / 30, (1 - s) / SUB);
        if (s > 0) shot(t, s);
        output.render(renderer, null, sum);
        renderer.setRenderTarget(null);                      // the pose sheet, drawn once, straight on top
        renderer.setViewport(SHEET.x, H - SHEET.y - SHEET.h, SHEET.w, SHEET.h);
        renderer.setScissor(SHEET.x, H - SHEET.y - SHEET.h, SHEET.w, SHEET.h);
        renderer.setScissorTest(true);
        renderer.setClearColor('#F3E6CF', 1);
        renderer.clear();
        renderer.render(lineup, lineCam);
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, W, H);
      },
    };
  },
  // the light switch (continuous / strobe) and the frame of the pose sheet
  overlay(ctx, t, W, H) {
    const s = strobe(t);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    [['CONTINUOUS LIGHT', 1 - s, '#FFC978', 300], ['STROBE 30 Hz', s, '#8FE6FF', 780]].forEach(([txt, on, col, x]) => {
      ctx.fillStyle = `rgba(10, 20, 26, ${0.55 + 0.3 * on})`;
      ctx.beginPath(); ctx.roundRect(x - 210, 1440, 420, 76, 38); ctx.fill();
      ctx.strokeStyle = col; ctx.globalAlpha = 0.25 + 0.75 * on; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = col; ctx.font = `700 34px ${FONT.sans}`;
      ctx.fillText(txt, x, 1479);
      ctx.globalAlpha = 1;
    });
    ctx.font = `500 26px ${FONT.sans}`; ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText('30 sculptures, one pose each · the platter turns one spacing per flash', W / 2, 1560);
    const { x, y, w, h } = SHEET;
    ctx.strokeStyle = 'rgba(60, 45, 30, 0.35)'; ctx.lineWidth = 2;
    for (let k = 1; k < 15; k++) { ctx.beginPath(); ctx.moveTo(x + k * w / 15, y + 6); ctx.lineTo(x + k * w / 15, y + h - 6); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(x + 6, y + h / 2); ctx.lineTo(x + w - 6, y + h / 2); ctx.stroke();
    ctx.fillStyle = 'rgba(60, 45, 30, 0.7)'; ctx.font = `600 17px ${FONT.mono}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    for (let k = 0; k < N; k++) ctx.fillText(String(k + 1), x + (k % 15) * w / 15 + 6, y + (k < 15 ? 21 : h / 2 + 21));
    ctx.strokeStyle = '#D9A54A'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(x - 2, y - 2, w + 4, h + 4, 14); ctx.stroke();
  },
};
