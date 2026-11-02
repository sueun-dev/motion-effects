// Retroreflection: a night road lit only by a lamp beside the viewer's eye. Retroreflective sheeting (glass beads,
// corner cubes) sends light back toward where it came from, in a narrow cone around the lamp, so to an eye next to
// the lamp the warning sign, the cone sleeves, the cat's eyes and the vest tape blaze, while the same paint without
// it stays dim. Every surface uses one shader: diffuse = albedo / pi times the lamp's irradiance (spot cone, inverse
// square, cosine), plus for retro surfaces a lobe that falls off with the observation angle alpha between the
// directions to the lamp and to the eye: R0 exp(-(alpha / 3 deg)^2). Then the lamp swings 5.5 m away from the eye:
// alpha grows, the retro glow drops (near objects first), the plain paint barely changes, and the lamp swings back.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { TAU, FONT, clamp } from '../lib/util.js';

const EYE = new THREE.Vector3(2.0, 1.2, 0), LAMP0 = new THREE.Vector3(2.25, 0.95, -0.2), SIGMA = 3 * Math.PI / 180;
const SWING = 5.5, PH = 0.95;                                     // how far the lamp swings, and where in its swing the loop starts
const swing = t => SWING * (0.5 - 0.5 * Math.cos(t / 5 * TAU + PH)) ** 2;
const lampAt = t => LAMP0.clone().add(new THREE.Vector3(swing(t), 0, 0));
const SIGN_RETRO = new THREE.Vector3(4.8, 2.05, -24), SIGN_PAINT = new THREE.Vector3(6.2, 2.05, -24);
let camera = null;                                                // shared with the overlay for the labels

const vertexShader = `varying vec3 vW, vN; varying vec2 vUv;
  void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = mat3(modelMatrix) * normal; vUv = uv; gl_Position = projectionMatrix * viewMatrix * w; }`;
const fragmentShader = `uniform vec3 uAlbedo, uLamp, uEye; uniform float uRetro, uUseMap, uRoad; uniform sampler2D uMap;
  varying vec3 vW, vN; varying vec2 vUv;
  void main() {
    vec3 alb = uAlbedo; float retro = uRetro;
    if (uUseMap > 0.5) alb *= texture2D(uMap, vUv).rgb;
    if (uRoad > 0.5) {                                             // lane paint (with glass beads) on the asphalt
      float x = vW.x, z = -vW.z;
      float centre = step(abs(x), 0.07) * step(fract(z / 9.0), 0.36), edge = step(abs(abs(x) - 3.45), 0.08);
      float paint = max(centre, edge);
      alb = mix(alb * (0.85 + 0.15 * step(0.5, fract(z * 0.37 + x * 0.21))), vec3(0.75), paint);
      retro = 3.0 * paint;
    }
    vec3 n = normalize(vN), l = uLamp - vW, v = normalize(uEye - vW);
    if (dot(n, v) < 0.0) n = -n;
    float d = length(l); l /= d;
    float spot = smoothstep(0.84, 0.97, dot(-l, normalize(vec3(0.03, -0.035, -1.0))));
    float E = 300.0 * spot * max(dot(n, l), 0.0) / (d * d);
    float alpha = acos(clamp(dot(l, v), -1.0, 1.0));
    vec3 col = alb * (E * (0.3183 + retro * exp(-pow(alpha / ${SIGMA.toFixed(5)}, 2.0))) + 0.012);
    gl_FragColor = vec4(col, 1.0);
  }`;

function signTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#F4C21A'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#111'; g.lineWidth = 16; g.strokeRect(14, 14, 228, 228);
  g.save(); g.translate(128, 128); g.rotate(-Math.PI / 4);                // the diamond is the square turned 45 degrees
  g.fillStyle = '#111'; g.beginPath();                                   // a bend-ahead arrow
  g.moveTo(-14, 70); g.lineTo(14, 70); g.lineTo(14, 0); g.quadraticCurveTo(14, -20, 34, -26); g.lineTo(34, -6); g.lineTo(70, -40);
  g.lineTo(34, -74); g.lineTo(34, -54); g.quadraticCurveTo(-14, -46, -14, 0); g.closePath(); g.fill();
  g.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export default {
  name: 'Retroreflection',
  ko: '재귀반사',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 2.4;
    const scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 600);
    camera.position.copy(EYE); camera.lookAt(3.3, 0.3, -30);

    const lamp = { value: LAMP0.clone() };
    const mats = [];
    const mat = (albedo, retro = 0, map = null, road = 0) => {
      const m = new THREE.ShaderMaterial({ vertexShader, fragmentShader, side: THREE.DoubleSide, uniforms: {
        uAlbedo: { value: new THREE.Color(albedo) }, uRetro: { value: retro }, uMap: { value: map }, uUseMap: { value: map ? 1 : 0 },
        uRoad: { value: road }, uLamp: lamp, uEye: { value: EYE },
      } });
      mats.push(m); return m;
    };
    const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); scene.add(o); return o; };

    // night sky with a tree line, on a big inverted sphere
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(500, 64, 32), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vD; void main() { vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }',
      fragmentShader: `varying vec3 vD;
        void main() {
          vec3 d = normalize(vD); float az = atan(d.x, -d.z);
          vec3 c = mix(vec3(0.03, 0.045, 0.1), vec3(0.004, 0.006, 0.018), smoothstep(0.0, 0.35, d.y));
          float trees = 0.022 + 0.012 * sin(az * 23.0) * sin(az * 7.0 + 1.0) + 0.008 * sin(az * 61.0 + 2.0);
          if (d.y < trees) c = vec3(0.004, 0.006, 0.008);
          gl_FragColor = vec4(c, 1.0);
        }`,
    })));

    // road, verges, lane paint; cat's eyes on the centre line every 9 m
    add(new THREE.PlaneGeometry(7.2, 400), mat('#22232A', 0, null, 1), 0, 0, -200, -Math.PI / 2);
    for (const s of [-1, 1]) add(new THREE.PlaneGeometry(40, 400), mat('#10160F'), s * 23.6, -0.01, -200, -Math.PI / 2);
    const studBody = mat('#2A2A2E'), studLens = mat('#FFFFFF', 14);
    for (let z = -4.5; z > -300; z -= 9) {
      add(new THREE.BoxGeometry(0.14, 0.04, 0.1), studBody, 0, 0.02, z);
      add(new THREE.PlaneGeometry(0.1, 0.022), studLens, 0, 0.022, z + 0.051);
    }

    // two identical warning signs: retroreflective sheeting on the left one, plain paint on the right one
    const face = signTexture(), post = mat('#8A8D93');
    for (const [p, retro] of [[SIGN_RETRO, 9], [SIGN_PAINT, 0]]) {
      add(new THREE.PlaneGeometry(0.95, 0.95), mat('#FFFFFF', retro, face), p.x, p.y, p.z, 0, -0.12, Math.PI / 4);
      add(new THREE.CylinderGeometry(0.035, 0.035, p.y, 12), post, p.x, p.y / 2 - 0.35, p.z - 0.03);
    }
    // traffic cones on the shoulder: sleeves alternate retro / plain white
    const orange = mat('#E8541E'), white = mat('#E8E8E8'), retroWhite = mat('#E8E8E8', 9);
    [-14, -18, -22, -27, -33, -40].forEach((z, i) => {
      add(new THREE.ConeGeometry(0.17, 0.7, 32), orange, 3.85, 0.35, z);
      add(new THREE.CylinderGeometry(0.083, 0.115, 0.14, 32, 1, true), i % 2 ? white : retroWhite, 3.85, 0.33, z);
      add(new THREE.BoxGeometry(0.4, 0.04, 0.4), orange, 3.85, 0.02, z);
    });
    // a worker in a high-vis vest with retro tape
    const person = new THREE.Group(); person.position.set(5.7, 0, -19); person.rotation.y = -0.25; scene.add(person);
    const part = (geo, m, x, y, z, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.z = rz; person.add(o); };
    const trousers = mat('#1C2230'), skin = mat('#9A6B52'), vest = mat('#A6CC1E'), tape = mat('#C9CCD2', 9);
    for (const s of [-1, 1]) part(new THREE.CapsuleGeometry(0.09, 0.72, 6, 16), trousers, s * 0.11, 0.47, 0);
    part(new THREE.CapsuleGeometry(0.2, 0.42, 8, 24), vest, 0, 1.18, 0);
    for (const s of [-1, 1]) part(new THREE.CapsuleGeometry(0.06, 0.52, 6, 16), vest, s * 0.27, 1.2, 0, s * 0.12);
    part(new THREE.SphereGeometry(0.12, 24, 16), skin, 0, 1.68, 0);
    for (const y of [1.0, 1.2]) part(new THREE.CylinderGeometry(0.205, 0.205, 0.05, 32, 1, true), tape, 0, y, 0);
    for (const s of [-1, 1]) part(new THREE.BoxGeometry(0.045, 0.36, 0.02), tape, s * 0.1, 1.37, 0.19);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.5, 0.3, 1.0);
    bloom.highPassUniforms.smoothWidth.value = 0.6;               // a soft knee, so glows fade in instead of switching on
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    return {
      scene, camera,
      update(t) { lamp.value.copy(lampAt(t)); },
      render() { composer.render(); },
    };
  },
  overlay(ctx, t, W, H) {
    const lamp = lampAt(t);
    // labels under the twin signs and the first two cones
    const tag = (p, text, col, dy) => {
      const v = p.clone().project(camera), x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H + dy;
      ctx.font = `700 22px ${FONT.sans}`; const w = ctx.measureText(text).width + 22;
      ctx.fillStyle = 'rgba(6, 8, 16, 0.7)'; ctx.beginPath(); ctx.roundRect(x - w / 2, y - 17, w, 34, 10); ctx.fill();
      ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + 1);
    };
    tag(new THREE.Vector3(SIGN_RETRO.x, 2.75, SIGN_RETRO.z), 'RETRO', '#FFE08A', -6);
    tag(new THREE.Vector3(SIGN_PAINT.x, 2.75, SIGN_PAINT.z), 'PAINT', 'rgba(255, 255, 255, 0.75)', -6);
    tag(new THREE.Vector3(3.85, 0, -14), 'RETRO', '#FFE08A', 30);
    tag(new THREE.Vector3(3.85, 0, -18), 'PAINT', 'rgba(255, 255, 255, 0.75)', 28);

    // top view: lamp, eye, sign, the light's path and the narrow cone it comes back in
    const x0 = 40, y0 = 1540, w = 1000, h = 340;
    ctx.fillStyle = 'rgba(6, 8, 16, 0.82)'; ctx.beginPath(); ctx.roundRect(x0, y0, w, h, 26); ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'; ctx.lineWidth = 2; ctx.stroke();
    const S = 36, ex = x0 + 150, ez = y0 + 290, sx = ex + (SIGN_RETRO.x - EYE.x) * S * 1.6, sz = y0 + 70;   // x stretched to read
    const lx = ex + (lamp.x - EYE.x) * S * 1.6, lz = ez - 6;
    const ang = Math.atan2(lx - sx, lz - sz), spread = 0.07;
    ctx.fillStyle = 'rgba(255, 216, 120, 0.22)'; ctx.beginPath(); ctx.moveTo(sx, sz);                    // the return cone
    ctx.lineTo(sx + 260 * Math.sin(ang - spread), sz + 260 * Math.cos(ang - spread));
    ctx.lineTo(sx + 260 * Math.sin(ang + spread), sz + 260 * Math.cos(ang + spread)); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#FFD878'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(lx, lz); ctx.lineTo(sx, sz); ctx.stroke();
    ctx.fillStyle = '#F4C21A'; ctx.save(); ctx.translate(sx, sz); ctx.rotate(Math.PI / 4); ctx.fillRect(-11, -11, 22, 22); ctx.restore();
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.ellipse(ex, ez, 16, 10, 0, 0, TAU); ctx.fill();         // the eye
    ctx.fillStyle = '#0A0C14'; ctx.beginPath(); ctx.arc(ex, ez, 6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#FFE9A8'; ctx.beginPath(); ctx.arc(lx, lz, 11, 0, TAU); ctx.fill();                      // the lamp
    ctx.font = `600 20px ${FONT.sans}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.textAlign = 'right'; ctx.fillText('eye', ex - 26, ez + 7);
    ctx.textAlign = 'left'; ctx.fillText('lamp', lx + 20, lz + 30);

    // readout: observation angle and the two signs' brightness
    const toL = lamp.clone().sub(SIGN_RETRO).normalize(), toE = EYE.clone().sub(SIGN_RETRO).normalize();
    const alpha = Math.acos(clamp(toL.dot(toE), -1, 1)), retro = Math.exp(-((alpha / SIGMA) ** 2));
    const tx = x0 + 560;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; ctx.font = `600 21px ${FONT.sans}`; ctx.fillText('OBSERVATION ANGLE α', tx, y0 + 52);
    ctx.fillStyle = '#FFFFFF'; ctx.font = `700 40px ${FONT.mono}`; ctx.fillText(`${(alpha * 180 / Math.PI).toFixed(1)}°`, tx, y0 + 100);
    const bars = [['retro sign', '#FFD878', 0.06 + 0.94 * retro], ['painted sign', '#9AA0AA', 0.06]];
    bars.forEach(([name, col, v], i) => {
      const by = y0 + 160 + i * 74;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; ctx.font = `600 21px ${FONT.sans}`; ctx.fillText(name, tx, by);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'; ctx.beginPath(); ctx.roundRect(tx, by + 14, 380, 16, 8); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(tx, by + 14, 380 * v, 16, 8); ctx.fill();
    });
  },
};
