// Ambiguous cylinder (after Kokichi Sugihara): a thin tube stands on a turntable in front of a mirror. Seen at 45 degrees
// its rim looks like a circle, but the mirror, which shows it from behind at the same 45 degrees, shows a square. For
// every x across the tube the rim has a front and a back point; their heights and depths are solved so that from the
// front they land on the picture of a circle and from behind on the picture of a square (a diamond in plan): the plan is
// the average of the two shapes and the rim dips at the front and rises at the back. Turned 180 degrees, the two swap.
// The camera is orthographic, so the mirror shows exactly the opposite 45-degree view; the mirror is a mirrored copy
// of the room drawn behind a hole in the wall. Then the camera drops low to the side and shows the wavy rim.
import * as THREE from 'three';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { TAU, FONT, ease, span, lerp } from '../lib/util.js';

const A = 1, Y0 = 1.25, TH = Math.PI / 4;                  // tube half-width, mean rim height, viewing angle
const M = 1.9;                                             // the mirror stands 1.9 behind the tube's centre
const N = 256;                                             // points round the rim
const SUB = 24;                                            // sub-frames averaged per frame (motion blur)
// the turntable: half a turn 1.1-2.1 s (the views swap), the second half 2.9-5.0 s while the camera is away
const turn = t => Math.PI * (ease.inOut(span(t, 1.1, 2.1)) + ease.inOut(span(t, 2.9, 5.0)));
// 0 at the 45-degree view, 1 low at the side: out 2.8-3.7 s, hold, back 4.2-5.1 s (across the loop point)
const side = t => ease.inOut(span(t, 2.8, 3.7)) - ease.inOut(span(t, 4.2, 5.1)) + 1 - ease.inOut(span(t, -0.8, 0.1));
const state = { k: 0, s: 0 };

// rim point i (0..N-1): x = A cos u; the front half (sin u > 0) is low, the back half high
function rim(i) {
  const u = i / N * TAU, x = A * Math.cos(u), f = Math.sign(Math.sin(u)) || 0;
  const c = Math.sqrt(Math.max(0, A * A - x * x)), q = A - Math.abs(x);       // circle and diamond half-depths
  return new THREE.Vector3(x, Y0 - f * (c - q) * Math.tan(TH) / 2, f * (c + q) / 2);
}

function tube() {
  const g = new THREE.Group(), pts = [...Array(N)].map((_, i) => rim(i));
  const pos = [], nor = [], idx = [];
  pts.forEach((p, i) => {
    const a = pts[(i + N - 1) % N], b = pts[(i + 1) % N];
    const n = new THREE.Vector3(b.z - a.z, 0, a.x - b.x).normalize();           // horizontal, outward
    if (n.x * p.x + n.z * p.z < 0) n.negate();
    pos.push(p.x, p.y, p.z, p.x, 0, p.z);
    nor.push(n.x, 0, n.z, n.x, 0, n.z);
    const j = (i + 1) % N;
    idx.push(2 * i, 2 * j, 2 * i + 1, 2 * j, 2 * j + 1, 2 * i + 1);   // wound to face outward
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setIndex(idx);
  const outer = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#FFF1DC', roughness: 0.6 }));
  const inner = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#F08A5D', roughness: 0.6, side: THREE.BackSide }));
  outer.castShadow = inner.castShadow = true;
  const lip = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 512, 0.028, 10, true),
    new THREE.MeshStandardMaterial({ color: '#2B2238', roughness: 0.4 }));
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.5, 0.08, 96), new THREE.MeshStandardMaterial({ color: '#3A3350', roughness: 0.5 }));
  disc.position.y = -0.04;
  disc.receiveShadow = true;
  const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.01, 24), new THREE.MeshBasicMaterial({ color: '#FFD27A' }));
  dot.position.set(0, 0.005, 1.3);                          // a mark on the turntable shows the real turn
  const top = new THREE.Group();
  top.add(outer, inner, lip, dot);
  g.add(disc, top);
  return { g, top };
}

// one copy of the room: table, turntable and tube, lit by a key light (casting soft shadows) and a fill
function room(mirrored) {
  const s = new THREE.Group();
  const table = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.MeshStandardMaterial({ color: '#D9CDBE', roughness: 0.9 }));
  table.rotation.x = -Math.PI / 2;
  table.position.set(0, -0.08, -M + 20);
  table.receiveShadow = true;
  const t = tube();
  s.add(table, t.g);
  const key = new THREE.DirectionalLight('#FFF1E0', 2.4);
  key.position.set(-3, 7, 4);
  s.add(key.target);                                       // so the mirrored copy aims at the mirrored tube
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 20 });
  key.shadow.radius = 6;
  key.shadow.bias = -0.0005;
  const back = new THREE.DirectionalLight('#E8EEFF', 1.3);  // a softer light from the mirror side, for the tube's back
  back.position.set(2.5, 6, -6);
  s.add(back.target);
  s.add(key, back, new THREE.HemisphereLight('#E6E9FF', '#6A5A50', 1.1));
  if (mirrored) { s.scale.z = -1; s.position.z = -2 * M; }  // reflect everything in the plane z = -M
  return { s, top: t.top };
}

export default {
  name: 'Ambiguous Cylinder',
  ko: '모호한 원기둥 착시',
  three(renderer, W, H) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const real = room(false), image = room(true);
    const scene = new THREE.Scene(), behind = new THREE.Scene();
    scene.add(real.s);
    behind.add(image.s);

    // the wall with a tall hole for the mirror, a brass frame and a faint tint on the glass
    const wallMat = new THREE.MeshStandardMaterial({ color: '#1F3B4A', roughness: 0.85 });
    const HW = 1.75, HT = 4.7;
    const panel = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat); m.position.set(x, y, -M); scene.add(m); };
    panel(30, 16, -15 - HW, 7); panel(30, 16, 15 + HW, 7); panel(2 * HW, 12, 0, HT + 6);
    const brass = new THREE.MeshStandardMaterial({ color: '#C9A15A', roughness: 0.3, metalness: 0.8 });
    const bar = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), brass); m.position.set(x, y, -M + 0.04); scene.add(m); };
    bar(0.1, HT, -HW - 0.05, HT / 2 - 0.08); bar(0.1, HT, HW + 0.05, HT / 2 - 0.08); bar(2 * HW + 0.2, 0.1, 0, HT - 0.03);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(2 * HW, HT), new THREE.MeshBasicMaterial({ color: '#CFE2F0', transparent: true, opacity: 0.1, depthWrite: false }));
    glass.position.set(0, HT / 2 - 0.08, -M + 0.002);
    scene.add(glass);

    const vh = 8.3, camera = new THREE.OrthographicCamera(-vh * W / H / 2, vh * W / H / 2, vh / 2, -vh / 2, 0.1, 80);
    const aim = new THREE.Vector3();
    const pose = t => {
      const k = side(t), r = turn(t);
      real.top.rotation.y = image.top.rotation.y = r;
      // from the 45-degree view to a low view from the right; the aim drops from between tube and mirror to the tube
      const yaw = lerp(0, 0.85, k), pitch = lerp(TH, 0.16, k);
      aim.set(0, lerp(1.365, 0.95, k), lerp(-1.365, -0.2, k));
      camera.position.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(30).add(aim);
      camera.lookAt(aim);
      camera.zoom = 1 + 0.25 * k;
      camera.updateProjectionMatrix();
    };

    // each frame averages SUB renders spread over its 1/30 s, so the turn and the camera move are motion-blurred
    const frame = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
    const sum = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
    const add = new THREE.Scene(), flat = new THREE.Camera();
    add.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: { tex: { value: frame.texture } }, depthTest: false, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D tex; varying vec2 vUv; void main() { gl_FragColor = texture2D(tex, vUv) / ${SUB}.0; }`,
    })));
    const output = new OutputPass();
    output.renderToScreen = true;
    renderer.autoClear = false;
    return {
      render(t) {
        renderer.setRenderTarget(sum);
        renderer.setClearColor(0x000000, 0);
        renderer.clear();
        for (let i = 0; i < SUB; i++) {
          pose(t - (i + 0.5) / SUB / 30);
          renderer.setRenderTarget(frame);
          renderer.setClearColor('#141826', 1);
          renderer.clear();
          renderer.render(behind, camera);                  // the reflection, behind the wall
          renderer.render(scene, camera);                   // the real room; the wall hides the copy except in the hole
          renderer.setRenderTarget(sum);
          renderer.render(add, flat);
        }
        output.render(renderer, null, sum);
        state.k = side(t);
        state.s = (1 - Math.cos(turn(t))) / 2;
      },
    };
  },
  // two pills whose icons morph between circle and square, and a caption while the camera is at the side
  overlay(ctx, t, W, H) {
    const { k, s } = state;
    const icon = (x, y, r, n, col) => {                     // superellipse |x|^n + |y|^n = 1: n = 1 square on its corner, n = 2 circle
      ctx.beginPath();
      for (let i = 0; i <= 64; i++) {
        const a = i / 64 * TAU, c = Math.cos(a), sn = Math.sin(a);
        const X = x + r * Math.sign(c) * Math.abs(c) ** (2 / n), Y = y + r * Math.sign(sn) * Math.abs(sn) ** (2 / n);
        if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
      }
      ctx.closePath();
      ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.stroke();
    };
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const on = 1 - k;
    [['DIRECT · 정면', 2 - s, 70], ['MIRROR · 거울', 1 + s, 560]].forEach(([txt, n, x]) => {
      ctx.globalAlpha = 0.35 + 0.65 * on;
      ctx.fillStyle = 'rgba(12, 14, 26, 0.75)';
      ctx.beginPath(); ctx.roundRect(x, 1700, 450, 96, 48); ctx.fill();
      ctx.strokeStyle = 'rgba(255, 210, 140, 0.6)'; ctx.lineWidth = 3; ctx.stroke();
      icon(x + 62, 1748, 24, n, '#FFD27A');
      ctx.fillStyle = '#FFF4E6'; ctx.font = `700 34px ${FONT.sans}`; ctx.fillText(txt, x + 110, 1749);
      ctx.globalAlpha = 1;
    });
    if (k > 0.01) {
      ctx.globalAlpha = Math.min(1, k * 1.5);
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(12, 14, 26, 0.72)';
      ctx.beginPath(); ctx.roundRect(W / 2 - 330, 300, 660, 92, 46); ctx.fill();
      ctx.fillStyle = '#FFD27A'; ctx.font = `700 34px ${FONT.sans}`;
      ctx.fillText('SIDE VIEW: THE RIM IS WAVY', W / 2, 334);
      ctx.fillStyle = 'rgba(255, 244, 230, 0.85)'; ctx.font = `500 26px ${FONT.ko}`;
      ctx.fillText('옆에서 보면 테두리가 물결친다', W / 2, 370);
      ctx.globalAlpha = 1;
    }
  },
};
