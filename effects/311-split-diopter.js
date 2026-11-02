// Split diopter: a half-moon close-up lens covers the left half of the camera lens, so that half focuses at 1 m
// while the rest of the lens stays focused at 6.5 m: the detective's face in the foreground and the figure in the far
// doorway are both sharp at once, with a soft seam between them where the background goes from blurred to sharp (the
// De Palma shot). Depth of field is rendered the real way, by averaging 72 renders from points spread over a round
// aperture with the frustum sheared to keep one plane fixed, once focused far and once focused near; the picture takes
// the near-focus render left of the diopter's edge and the far-focus one right of it. First the normal lens (face
// blurred), then the diopter slides in from the left and the face snaps sharp, then it slides out again.
import * as THREE from 'three';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { TAU, FONT, ease, span, lerp, clamp } from '../lib/util.js';

const N = 72, APERTURE = 0.011, FOV = 40;                  // aperture samples per focus, aperture radius (m)
const NEAR_F = 1.02, FAR_F = 6.5;                           // focus of the diopter half and of the main lens
const SEAM_OUT = -160, SEAM_IN = 600, SOFT = 70;           // the diopter's edge on screen (px) and its blur
// 0 = diopter out, 1 = in: slides in 1.4-2.3 s, out 4.35-5.3 s (across the loop point)
const inK = t => ease.inOut(span(t, 1.4, 2.3)) - ease.inOut(span(t, 4.35, 5.3)) + 1 - ease.inOut(span(t, -0.65, 0.3));
const state = { k: 0 };

function canvasTex(w, h, paint, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o });
const add = (parent, geo, m, x, y, z, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); parent.add(o); return o; };

// a man's head in a fedora with the coat collar up, facing +z (built at the origin)
function detective() {
  const g = new THREE.Group();
  const skin = mat('#D9A27E', { roughness: 0.55 }), hat = mat('#2B2A30', { roughness: 0.8 }), coat = mat('#5A4A3A', { roughness: 0.9 });
  add(g, new THREE.SphereGeometry(0.1, 48, 36), skin, 0, 0, 0, 0.9, 1.15, 1.0);           // skull
  add(g, new THREE.SphereGeometry(0.07, 32, 24), skin, 0, -0.07, 0.025, 1.0, 0.9, 0.95);   // jaw
  const nose = add(g, new THREE.ConeGeometry(0.017, 0.06, 24), skin, 0, -0.005, 0.1, 1.0, 1.0, 0.8);  // a straight nose
  nose.rotation.x = -0.35;
  add(g, new THREE.SphereGeometry(0.012, 16, 12), skin, 0, -0.035, 0.112);                     // its tip
  add(g, new THREE.BoxGeometry(0.075, 0.016, 0.03), skin, 0, 0.045, 0.088);                  // brow ridge
  for (const s of [-1, 1]) {
    add(g, new THREE.SphereGeometry(0.011, 20, 14), mat('#E2DAD0', { roughness: 0.3 }), 0.034 * s, 0.026, 0.086, 1, 0.7, 0.6);
    add(g, new THREE.SphereGeometry(0.0062, 16, 12), mat('#1E140E', { roughness: 0.15 }), 0.034 * s, 0.026, 0.092);
    add(g, new THREE.CapsuleGeometry(0.0045, 0.028, 4, 10), mat('#2A1C14'), 0.035 * s, 0.05, 0.097).rotation.z = Math.PI / 2 + 0.15 * s;
    add(g, new THREE.SphereGeometry(0.024, 16, 12), skin, 0.092 * s, 0.0, -0.005, 0.45, 1.0, 0.75);   // ear
  }
  add(g, new THREE.CapsuleGeometry(0.0035, 0.04, 4, 10), mat('#6A3028'), 0, -0.068, 0.092).rotation.z = Math.PI / 2;   // mouth
  // fedora: brim and a pinched crown with a band
  const brim = add(g, new THREE.CylinderGeometry(0.17, 0.17, 0.008, 64), hat, 0, 0.085, 0.0);
  brim.rotation.x = 0.08;
  add(g, new THREE.CylinderGeometry(0.07, 0.1, 0.09, 48), hat, 0, 0.13, -0.005);
  add(g, new THREE.CylinderGeometry(0.101, 0.101, 0.025, 48), mat('#7A2E2A'), 0, 0.1, -0.005);
  // coat: shoulders and the turned-up collar
  add(g, new THREE.SphereGeometry(0.25, 40, 24), coat, 0, -0.33, -0.05, 1.0, 0.75, 0.6);
  for (const s of [-1, 1]) {
    const c = add(g, new THREE.BoxGeometry(0.11, 0.13, 0.015), coat, 0.07 * s, -0.12, 0.04);
    c.rotation.set(-0.2, -0.5 * s, 0.25 * s);
  }
  return g;
}

// the far figure: a woman in a long coat and hat in the doorway, facing +z; returns the head for a slow turn
function figure() {
  const g = new THREE.Group();
  const coat = mat('#2E3A4A', { roughness: 0.8 }), skin = mat('#D9A27E');
  g.add(Object.assign(new THREE.Mesh(new THREE.LatheGeometry([[0, 0.02], [0.3, 0.05], [0.24, 0.6], [0.17, 1.05], [0.2, 1.38], [0.12, 1.46], [0, 1.48]].map(([r, y]) => new THREE.Vector2(r, y)), 48), coat)));
  const head = new THREE.Group();
  head.position.y = 1.6; g.add(head);
  add(head, new THREE.SphereGeometry(0.11, 32, 24), skin, 0, 0, 0, 0.9, 1.1, 1);
  add(head, new THREE.CylinderGeometry(0.2, 0.2, 0.01, 48), mat('#8A1E2A'), 0, 0.07, 0);
  add(head, new THREE.CylinderGeometry(0.09, 0.1, 0.09, 32), mat('#8A1E2A'), 0, 0.12, 0);
  for (const s of [-1, 1]) {
    const arm = add(g, new THREE.CapsuleGeometry(0.05, 0.5, 6, 12), coat, 0.21 * s, 1.08, 0.02);
    arm.rotation.z = 0.12 * s;
  }
  return { g, head };
}

export default {
  name: 'Split Diopter',
  ko: '스플릿 디옵터',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0C0B10');
    const ZB = -7.5;                                        // the back wall
    // the room: floorboards, a back wall with a doorway and a window with blinds, a ceiling
    const boards = canvasTex(256, 256, (g, w, h) => {
      for (let i = 0; i < 4; i++) { g.fillStyle = ['#3A2A20', '#42301F', '#36261C', '#3E2C22'][i]; g.fillRect(i * 64, 0, 64, h); g.fillStyle = '#21160F'; g.fillRect(i * 64, 0, 3, h); }
    }, [6, 8]);
    add(scene, new THREE.PlaneGeometry(8, 9), mat('#FFFFFF', { map: boards }), 0, 0, -4).rotation.x = -Math.PI / 2;
    add(scene, new THREE.PlaneGeometry(8, 9), mat('#1A1716'), 0, 3.3, -4).rotation.x = Math.PI / 2;
    const wall = mat('#4C5A58', { roughness: 0.9 });
    const D0 = 0.1, D1 = 1.15, DH = 2.3;                    // the doorway: x from 0.1 to 1.15, 2.3 m high
    add(scene, new THREE.PlaneGeometry(4, 3.3), wall, D0 - 2, 1.65, ZB);
    add(scene, new THREE.PlaneGeometry(3, 3.3), wall, D1 + 1.5, 1.65, ZB);
    add(scene, new THREE.PlaneGeometry(D1 - D0, 3.3 - DH), wall, (D0 + D1) / 2, DH + (3.3 - DH) / 2, ZB);
    const trim = mat('#2A2420');
    add(scene, new THREE.BoxGeometry(0.08, DH, 0.08), trim, D0 - 0.04, DH / 2, ZB + 0.02);
    add(scene, new THREE.BoxGeometry(0.08, DH, 0.08), trim, D1 + 0.04, DH / 2, ZB + 0.02);
    add(scene, new THREE.BoxGeometry(D1 - D0 + 0.16, 0.08, 0.08), trim, (D0 + D1) / 2, DH + 0.04, ZB + 0.02);
    // the lit hallway beyond the door
    add(scene, new THREE.PlaneGeometry(2.2, 3), new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFC98A').multiplyScalar(1.6) }), (D0 + D1) / 2, 1.5, ZB - 1.6);
    for (const s of [0, 1]) add(scene, new THREE.PlaneGeometry(1.6, 3), mat('#B88A5A', { emissive: '#7A5030', emissiveIntensity: 1 }), s ? D1 : D0, 1.5, ZB - 0.8).rotation.y = s ? -Math.PI / 2 : Math.PI / 2;
    // the window with venetian blinds: bright slats of street light
    const blinds = canvasTex(64, 256, (g, w, h) => {
      g.fillStyle = '#1C2230'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 16) { g.fillStyle = '#E8EEF8'; g.fillRect(0, y + 3, w, 9); }
    });
    add(scene, new THREE.PlaneGeometry(1.1, 1.3), new THREE.MeshBasicMaterial({ map: blinds, color: new THREE.Color(1.4, 1.4, 1.5) }), -1.0, 1.55, ZB + 0.01);
    add(scene, new THREE.BoxGeometry(1.2, 0.06, 0.1), trim, -1.0, 0.88, ZB + 0.05);
    // a string of small warm bulbs along the wall: points when sharp, round bokeh when not
    for (let i = 0; i < 17; i++) {
      const x = -1.75 + i * 0.22, y = 2.5 - 0.06 * Math.sin(i * 0.9) - 0.12 * (1 - ((i - 8) / 8) ** 2);
      add(scene, new THREE.SphereGeometry(0.022, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(['#FFB25A', '#FFD08A', '#FF8A5A'][i % 3]).multiplyScalar(6) }), x, y, ZB + 0.15);
    }
    // a desk lamp on a table halfway back, left
    add(scene, new THREE.BoxGeometry(1.4, 0.06, 0.7), mat('#3A2418', { roughness: 0.5 }), -1.15, 0.78, -3.6);
    const shade = add(scene, new THREE.ConeGeometry(0.13, 0.16, 32, 1, true), mat('#2E5A3A', { side: THREE.DoubleSide, emissive: '#1A3A20' }), -1.0, 1.2, -3.6);
    shade.rotation.z = 0.2;
    add(scene, new THREE.SphereGeometry(0.035, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFE0A0').multiplyScalar(5) }), -1.0, 1.13, -3.6);
    add(scene, new THREE.CylinderGeometry(0.012, 0.012, 0.35, 12), trim, -1.0, 0.98, -3.6);

    const man = detective();
    man.position.set(-0.15, 1.42, -1.0);
    man.rotation.y = 0.75;                                  // three-quarters, looking off to the right of the lens
    man.rotation.x = 0.05;
    scene.add(man);
    const her = figure();
    her.g.position.set(0.63, 0, ZB - 0.35);
    scene.add(her.g);

    scene.add(new THREE.HemisphereLight('#9AB0C8', '#2A1E18', 0.55));
    const key = new THREE.SpotLight('#FFD2A0', 7, 6, 0.6, 0.7, 1.6);   // warm key on his face from the right
    key.position.set(0.7, 1.9, -0.1); key.target.position.set(-0.15, 1.42, -1.0);
    scene.add(key, key.target);
    const rim = new THREE.PointLight('#FFC07A', 9, 6, 1.5);           // the hallway light behind her
    rim.position.set(0.63, 1.9, ZB - 1.1);
    scene.add(rim);
    const fill = new THREE.PointLight('#8FB4FF', 2.5, 8, 1.5);
    fill.position.set(-1.2, 2.2, -2.5);
    scene.add(fill);

    // depth of field by aperture sampling, as in a real lens: one accumulation per focus distance
    const camera = new THREE.PerspectiveCamera(FOV, W / H, 0.05, 40);
    camera.position.set(0, 1.6, 0);
    camera.lookAt(0, 1.52, -3);
    camera.updateMatrixWorld();
    const eye = camera.position.clone();
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    renderer.getContext().getExtension('EXT_float_blend');
    const one = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
    const accNear = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType }), accFar = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType });
    const out = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
    const flat = new THREE.Camera();
    const quadScene = m => { const s = new THREE.Scene(); s.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m)); return s; };
    const vs = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
    const accumulate = quadScene(new THREE.ShaderMaterial({
      uniforms: { tex: { value: one.texture } }, vertexShader: vs, depthTest: false, depthWrite: false,
      fragmentShader: `uniform sampler2D tex; varying vec2 vUv; void main() { gl_FragColor = vec4(texture2D(tex, vUv).rgb / ${N}.0, 1.0); }`,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    }));
    const splitMat = new THREE.ShaderMaterial({
      uniforms: { tNear: { value: accNear.texture }, tFar: { value: accFar.texture }, uSeam: { value: 0 } }, vertexShader: vs, depthTest: false, depthWrite: false,
      fragmentShader: `uniform sampler2D tNear, tFar; uniform float uSeam; varying vec2 vUv;
        void main() {
          float x = vUv.x * ${W}.0, k = 1.0 - smoothstep(uSeam - ${SOFT}.0, uSeam + ${SOFT}.0, x);   // 1 behind the diopter
          gl_FragColor = vec4(mix(texture2D(tFar, vUv).rgb, texture2D(tNear, vUv).rgb, k), 1.0);
        }`,
    });
    const split = quadScene(splitMat);
    const output = new OutputPass();
    output.renderToScreen = true;
    const top = 0.05 * Math.tan(FOV / 2 * Math.PI / 180), aspect = W / H, GOLD = Math.PI * (3 - Math.sqrt(5));
    const focusPass = (target, F) => {
      renderer.setRenderTarget(target);
      renderer.setClearColor('#000000', 1);
      renderer.clear();
      for (let i = 0; i < N; i++) {
        const r = APERTURE * Math.sqrt((i + 0.5) / N), a = i * GOLD;          // Vogel spiral over the aperture
        const dx = r * Math.cos(a), dy = r * Math.sin(a);
        const jx = ((i * 0.7548776662) % 1 - 0.5) * 2 / W, jy = ((i * 0.5698402910) % 1 - 0.5) * 2 / H;
        camera.position.copy(eye).addScaledVector(right, dx).addScaledVector(up, dy);
        const sx = -dx * 0.05 / F + jx * top * aspect, sy = -dy * 0.05 / F + jy * top;   // keep the plane at F fixed
        camera.projectionMatrix.makePerspective(-top * aspect + sx, top * aspect + sx, top + sy, -top + sy, 0.05, 40);
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
        camera.updateMatrixWorld();
        renderer.setRenderTarget(one);
        renderer.setClearColor('#0C0B10', 1);
        renderer.clear();
        renderer.render(scene, camera);
        renderer.setRenderTarget(target);
        renderer.render(accumulate, flat);
      }
    };
    renderer.autoClear = false;
    return {
      render(t) {
        const k = inK(t), seam = lerp(SEAM_OUT, SEAM_IN, k);
        her.head.rotation.y = 0.35 * Math.sin(TAU * t / 5);            // she turns her head slowly
        man.rotation.y = 0.75 + 0.04 * Math.sin(TAU * t / 5 + 1);       // he barely moves
        focusPass(accFar, FAR_F);
        if (seam > -SOFT) focusPass(accNear, NEAR_F);                   // only needed once the diopter is in the picture
        else { renderer.setRenderTarget(accNear); renderer.clear(); }
        splitMat.uniforms.uSeam.value = seam;
        renderer.setRenderTarget(out);
        renderer.render(split, flat);
        output.render(renderer, null, out);
        state.k = k; state.seam = seam;
      },
    };
  },
  // the lens seen from the front with the half diopter sliding over its left half, focus tags and two pills
  overlay(ctx, t, W, H) {
    const { k, seam } = state;
    const cx = W / 2, cy = 370, R = 62;
    ctx.save();
    ctx.fillStyle = 'rgba(10, 10, 16, 0.72)';
    ctx.beginPath(); ctx.roundRect(cx - 250, cy - 82, 500, 164, 28); ctx.fill();
    ctx.fillStyle = '#16181E'; ctx.beginPath(); ctx.arc(cx - 110, cy, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#8A8F9A'; ctx.lineWidth = 5; ctx.stroke();
    const g = ctx.createRadialGradient(cx - 130, cy - 20, 5, cx - 110, cy, R);
    g.addColorStop(0, 'rgba(120, 170, 255, 0.55)'); g.addColorStop(1, 'rgba(40, 60, 110, 0.2)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx - 110, cy, R - 8, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(cx - 110, cy, R - 4, 0, TAU); ctx.clip();      // the half-moon diopter slides in from the left
    const dx = lerp(-2 * R, 0, k);
    ctx.fillStyle = 'rgba(255, 210, 130, 0.55)';
    ctx.beginPath(); ctx.rect(cx - 110 - R + dx, cy - R, R, 2 * R); ctx.fill();
    ctx.strokeStyle = '#FFD27A'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(cx - 110 + dx, cy - R); ctx.lineTo(cx - 110 + dx, cy + R); ctx.stroke();
    ctx.restore();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFD27A'; ctx.font = `700 28px ${FONT.sans}`;
    ctx.fillText('HALF DIOPTER', cx - 10, cy - 40);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'; ctx.font = `500 25px ${FONT.ko}`;
    ctx.fillText('렌즈 반쪽에 돋보기', cx - 10, cy - 4);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; ctx.font = `600 24px ${FONT.sans}`;
    ctx.fillText(`left ${NEAR_F} m · right ${FAR_F} m`, cx - 10, cy + 36);
    // focus tags either side of the seam
    ctx.textAlign = 'center';
    const tag = (txt, x, a, col) => {
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(10, 10, 16, 0.7)'; ctx.beginPath(); ctx.roundRect(x - 120, 540, 240, 56, 28); ctx.fill();
      ctx.fillStyle = col; ctx.font = `700 26px ${FONT.sans}`; ctx.fillText(txt, x, 569);
      ctx.globalAlpha = 1;
    };
    tag(`FOCUS ${NEAR_F} m`, clamp(seam - 170, 140, W), clamp((seam - 300) / 200), '#FFD27A');
    tag(`FOCUS ${FAR_F} m`, clamp(seam + 170, W / 2 + 130, W - 140), 1, '#9FD3FF');
    ctx.textAlign = 'center';
    [['NORMAL LENS · 일반 렌즈', 1 - k, '#9FD3FF', 290], ['SPLIT DIOPTER · 스플릿 디옵터', k, '#FFD27A', 790]].forEach(([txt, on, col, x]) => {
      ctx.fillStyle = `rgba(10, 10, 16, ${0.6 + 0.25 * on})`;
      ctx.beginPath(); ctx.roundRect(x - 240, 1740, 480, 76, 38); ctx.fill();
      ctx.globalAlpha = 0.3 + 0.7 * on;
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = col; ctx.font = `700 30px ${FONT.sans}`; ctx.fillText(txt, x, 1779);
      ctx.globalAlpha = 1;
    });
  },
};
