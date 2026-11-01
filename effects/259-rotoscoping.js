// Rotoscoping: a dancer is filmed as "live action" (a lit 3D figure in a studio with soft shadows), and the same
// dancer, pose for pose, is traced as flat colour cels with an ink outline on paper, the footage showing faintly
// through the paper the way it does on an animator's light box. A wipe slides back and forth across the frame:
// footage on the left, the tracing on the right, lining up exactly. Both figures share one pose function of t.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TAU, FONT } from '../lib/util.js';

const wipeX = t => 540 + 330 * Math.sin(TAU * t / 5); // px from the left

// the figure: capsules on a joint hierarchy; paint = { skin, top, pants, shoes, hair }, ink = outline width or 0
// a tapered capsule along Y: radius r1 at the top end, r2 at the bottom end, the two ends len apart
function taper(r1, r2, len) {
  const pts = [];
  for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + (i / 8) * Math.PI / 2; pts.push(new THREE.Vector2(r2 * Math.cos(a), -len / 2 + r2 * Math.sin(a))); }
  for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; pts.push(new THREE.Vector2(r1 * Math.cos(a), len / 2 + r1 * Math.sin(a))); }
  return new THREE.LatheGeometry(pts, 28);
}

// the figure: tapered capsules on a joint hierarchy; paint = { skin, top, pants, shoes, hair }, ink = outline width or 0
function figure(paint, ink) {
  const inkMat = new THREE.MeshBasicMaterial({ color: '#15121A', side: THREE.BackSide });
  // a part hanging down from its joint (or turned by rx), with its ink hull: the back faces of a slightly fatter copy
  const part = (parent, r1, r2, len, mat, y = -len / 2, scale = [1, 1, 1], z = 0, rx = 0) => {
    for (const [m, e] of [[mat, 0], [inkMat, ink]]) {
      if (m === inkMat && !ink) continue;
      const mesh = new THREE.Mesh(taper(r1 + e, r2 + e, len), m);
      mesh.position.set(0, y, z); mesh.rotation.x = rx; mesh.scale.set(...scale); mesh.castShadow = true;
      parent.add(mesh);
    }
  };
  const joint = (parent, x, y, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const root = new THREE.Group(), hips = joint(root, 0, 0.95);
  part(hips, 0.13, 0.15, 0.08, paint.pants, 0, [1.1, 1, 0.8]);
  const waist = joint(hips, 0, 0.06), chest = joint(waist, 0, 0.2);
  part(waist, 0.17, 0.125, 0.3, paint.top, 0.18, [1.1, 1, 0.72]);           // the torso narrows to the waist
  const neck = joint(chest, 0, 0.3);
  part(neck, 0.048, 0.055, 0.07, paint.skin, 0.03);
  const head = joint(neck, 0, 0.14);
  part(head, 0.1, 0.09, 0.05, paint.skin, 0, [0.95, 1.02, 1]);
  part(head, 0.11, 0.1, 0.035, paint.hair, 0.035, [1, 1, 0.98], -0.028);
  const arm = side => {
    const sh = joint(chest, side * 0.21, 0.24), el = joint(sh, 0, -0.29);
    part(sh, 0.052, 0.04, 0.29, paint.skin); part(el, 0.04, 0.032, 0.27, paint.skin); // each part reaches the next joint
    const hand = joint(el, 0, -0.27); part(hand, 0.04, 0.036, 0.05, paint.skin, -0.03, [1, 1, 0.6]);
    return { sh, el };
  };
  const leg = side => {
    const hip = joint(hips, side * 0.095, -0.05), knee = joint(hip, 0, -0.44), ankle = joint(knee, 0, -0.42);
    part(hip, 0.085, 0.056, 0.44, paint.pants); part(knee, 0.056, 0.042, 0.42, paint.pants);
    part(ankle, 0.045, 0.05, 0.13, paint.shoes, -0.03, [1, 1, 0.8], 0.05, Math.PI / 2); // the shoe points forward
    return { hip, knee, ankle };
  };
  const arms = [arm(1), arm(-1)], legs = [leg(1), leg(-1)];
  const q = new THREE.Quaternion(), down = new THREE.Vector3(0, -1, 0), v = new THREE.Vector3(), X = new THREE.Vector3(1, 0, 0);

  // a step-touch groove: two cycles a loop, the weight shifting side to side, the free foot tapping, arms swinging up
  function pose(t) {
    const f = TAU * 2 * t / 5, s = Math.sin(f);
    root.rotation.y = 0.45 * Math.sin(TAU * t / 5);
    hips.position.set(0.09 * s, 0.93 - 0.035 * (1 - Math.cos(2 * f)) / 2, 0);
    hips.rotation.z = 0.08 * s;
    waist.rotation.set(0.04, 0.25 * s, -0.12 * s);
    chest.rotation.set(0.03 * Math.sin(2 * f), 0.1 * s, -0.06 * s);
    head.rotation.set(0.08 * Math.sin(2 * f + 0.6), -0.2 * s, 0.1 * s);
    arms.forEach(({ sh, el }, i) => { // i = 0: the figure's left arm (screen right)
      const up = 0.5 + 0.5 * (i ? -s : s);
      sh.rotation.set(-0.3 - 0.5 * up, 0, (i ? -1 : 1) * (0.25 + 2.1 * up));
      el.rotation.set(-0.25 - 1.0 * (1 - up), 0, 0);
    });
    legs.forEach(({ hip, knee, ankle }, i) => { // two-bone IK to a foot target on the floor
      const side = i ? -1 : 1, lift = 0.09 * Math.max(0, i ? s : -s) ** 2;
      const target = new THREE.Vector3(side * 0.17 + 0.05 * s, 0.075 + lift, 0.02);
      hips.updateMatrix();
      const hipW = new THREE.Vector3(side * 0.095, -0.05, 0).applyMatrix4(hips.matrix);
      v.copy(target).sub(hipW).applyQuaternion(q.copy(hips.quaternion).invert());
      const d = Math.min(v.length(), 0.855), a1 = Math.acos((0.44 ** 2 + d * d - 0.42 ** 2) / (2 * 0.44 * d));
      const k = Math.PI - Math.acos((0.44 ** 2 + 0.42 ** 2 - d * d) / (2 * 0.44 * 0.42));
      hip.quaternion.setFromUnitVectors(down, v.normalize()).multiply(q.setFromAxisAngle(X, -a1));
      knee.quaternion.setFromAxisAngle(X, k);
      ankle.quaternion.copy(hips.quaternion).multiply(hip.quaternion).multiply(knee.quaternion).invert(); // flat on the floor
    });
  }
  return { root, pose };
}

export default {
  name: 'Rotoscoping',
  ko: '로토스코핑',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 50);
    camera.position.set(0, 1.1, 5.6);
    camera.lookAt(0, 1.02, 0);

    // the footage: a studio floor and wall, a warm key, a cool rim, real materials
    const studio = new THREE.Scene();
    studio.background = new THREE.Color('#2A2420');
    studio.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    studio.environmentIntensity = 0.35;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12, 1, 1), new THREE.MeshStandardMaterial({ color: '#B9A58E', roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(12, 8), new THREE.MeshStandardMaterial({ color: '#A8937C', roughness: 1 }));
    wall.position.set(0, 4, -2.2); wall.receiveShadow = true;
    studio.add(floor, wall);
    const key = new THREE.SpotLight('#FFE2C2', 60, 14, 0.55, 0.6, 2);
    key.position.set(-2.4, 3.6, 3.2); key.target.position.set(0, 0.9, 0);
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 6; key.shadow.bias = -0.0004;
    const rim = new THREE.DirectionalLight('#9CC8FF', 2.2); rim.position.set(3, 3, -3);
    studio.add(key, key.target, rim, new THREE.HemisphereLight('#FFF1E0', '#5A4A3C', 0.5));
    const live = figure({
      skin: new THREE.MeshPhysicalMaterial({ color: '#C98A66', roughness: 0.55, sheen: 0.4, sheenColor: '#FFB89A' }),
      top: new THREE.MeshStandardMaterial({ color: '#C8384D', roughness: 0.8 }),
      pants: new THREE.MeshStandardMaterial({ color: '#2E3D63', roughness: 0.9 }),
      shoes: new THREE.MeshStandardMaterial({ color: '#EDEDED', roughness: 0.6 }),
      hair: new THREE.MeshStandardMaterial({ color: '#2A1B14', roughness: 0.5 }),
    }, 0);
    studio.add(live.root);

    // the tracing: the same figure as flat cels with an ink line, on a transparent layer
    const cel = new THREE.Scene();
    const flat = c => new THREE.MeshBasicMaterial({ color: c });
    const traced = figure({ skin: flat('#F6C9A6'), top: flat('#FF5D6C'), pants: flat('#4B62C9'), shoes: flat('#FFFFFF'), hair: flat('#3B2A22') }, 0.011);
    cel.add(traced.root);

    const rt = () => new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
    const footRT = rt(), celRT = rt();
    const mix = new THREE.ShaderMaterial({
      uniforms: { uFoot: { value: footRT.texture }, uCel: { value: celRT.texture }, uWipe: { value: 0.5 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
uniform sampler2D uFoot, uCel; uniform float uWipe; varying vec2 vUv;
float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main() {
  vec3 foot = toneMapping(texture2D(uFoot, vUv).rgb); // three puts toneMapping() (ACES here) in front of the shader
  float vig = 1.0 - 0.35 * pow(length((vUv - 0.5) * vec2(1.0, 1.3)), 2.0);
  foot = foot * vig * (1.0 + 0.06 * (hash(gl_FragCoord.xy) - 0.5));          // a fixed film grain (also hides banding)
  vec4 cel = texture2D(uCel, vUv);
  vec3 paper = vec3(0.86, 0.80, 0.68) * (1.0 + 0.05 * (hash(floor(gl_FragCoord.xy / 2.0)) - 0.5)); // fixed paper tooth
  vec3 under = paper * (0.72 + 0.28 * dot(foot, vec3(0.3, 0.55, 0.15)) / 0.45);  // the footage through the paper
  vec3 trace = mix(under, cel.rgb, cel.a);
  gl_FragColor = vec4(vUv.x < uWipe ? foot : trace, 1.0);
  #include <colorspace_fragment>
}`,
      depthTest: false, depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mix);
    quad.frustumCulled = false;
    const post = new THREE.Scene(); post.add(quad);
    const flatCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    return {
      render(t) {
        live.pose(t); traced.pose(t);
        renderer.setRenderTarget(footRT); renderer.setClearColor('#000000', 1); renderer.render(studio, camera);
        renderer.setRenderTarget(celRT); renderer.setClearColor('#000000', 0); renderer.clear(); renderer.render(cel, camera);
        renderer.setRenderTarget(null);
        mix.uniforms.uWipe.value = wipeX(t) / W;
        renderer.render(post, flatCam);
      },
    };
  },
  overlay(ctx, t, W, H) {
    const x = wipeX(t);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x - 2, 280, 4, H - 280);
    ctx.beginPath(); ctx.arc(x, 1700, 24, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1A1714'; ctx.font = `700 22px ${FONT.sans}`; ctx.textAlign = 'center'; ctx.fillText('‹ ›', x, 1708);
    const tag = (text, ko, tx, align, light) => {
      ctx.textAlign = align;
      ctx.fillStyle = light ? '#FFFFFF' : '#2B241E'; ctx.font = `800 36px ${FONT.sans}`; ctx.fillText(text, tx, 1810);
      ctx.fillStyle = light ? 'rgba(255, 255, 255, 0.75)' : 'rgba(43, 36, 30, 0.75)'; ctx.font = `500 26px ${FONT.ko}`; ctx.fillText(ko, tx, 1848);
    };
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, x, H); ctx.clip(); tag('FOOTAGE', '실사 촬영', 44, 'left', true); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(x, 0, W - x, H); ctx.clip(); tag('ROTOSCOPED', '따라 그린 셀', W - 44, 'right', false); ctx.restore();
  },
};
