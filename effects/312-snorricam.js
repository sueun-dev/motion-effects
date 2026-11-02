// Snorricam: a camera rigged to the actor's body. A rod runs from a chest harness to a camera 1.15 m in front of him,
// pointing back at him, so the camera rides every step: his head and shoulders stay locked in the middle of the frame
// while the night street behind him lurches, bobs and rolls. The camera is literally a child of the torso: the walk
// (two bobs and one side-to-side sway per stride, a slow drunken roll and twist) moves the torso, and the view follows.
// Every motion is a sine with a whole number of cycles in 5 s, and the street repeats every 5 m, the distance he walks
// in 5 s, so the loop is seamless. The inset films the same walk from a dolly beside him: the world level, the rig seen.
// The main view averages 16 renders over the last two frame times: the swinging street is softly blurred, never
// jittery, and the man, fixed to the camera, stays sharp.
import * as THREE from 'three';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { TAU, FONT, rng } from '../lib/util.js';

const P = 5, SPEED = P / 5;                                // the street repeats every 5 m; he walks it in 5 s
const SUB = 16;
const INSET = { x: 676, y: 1236, w: 360, h: 480 };          // the outside view, in frame pixels (top-left origin)

// the torso's motion at time t: forward walk plus the sways, all smooth sines that loop in 5 s
function walkPose(t) {
  const a = TAU * t / 5;
  return {
    z: SPEED * t,
    x: 0.05 * Math.sin(5 * a),                              // side to side, once per stride (1 Hz)
    y: 0.95 + 0.03 * Math.cos(10 * a),                      // up and down, once per step (2 Hz)
    roll: 0.075 * Math.sin(2 * a) + 0.02 * Math.sin(5 * a), // a slow drunken lean plus the stride
    yaw: 0.06 * Math.sin(2 * a + 1.2) + 0.02 * Math.sin(5 * a + 0.5),
    pitch: 0.014 * Math.cos(10 * a) + 0.03 * Math.sin(3 * a + 0.4),
    stride: 5 * a,                                          // leg and arm phase
  };
}

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

// the street: one 5 m module (road, pavements, two buildings a side, a lamp post, a neon sign)
// repeated from 85 m behind to 25 m ahead
function street(scene) {
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...o });
  const lane = canvasTex(64, 256, (g, w, h) => {
    g.fillStyle = '#26232C'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#C9B98A'; g.fillRect(28, 0, 8, h * 0.5);
  }, [1, 44]);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(14, 110), M('#FFFFFF', { map: lane, roughness: 0.6 }));
  road.rotation.x = -Math.PI / 2; road.position.z = -32.5;
  road.material.map.repeat.set(1, 44);                      // a dash every 2.5 m
  scene.add(road);
  for (const s of [-1, 1]) {
    const walk = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.15, 110), M('#4A4652'));
    walk.position.set(s * 8.25, 0.075, -32.5); scene.add(walk);
  }
  const facade = (seed, tone) => canvasTex(256, 512, (g, w, h) => {
    const r = rng(seed);
    g.fillStyle = tone; g.fillRect(0, 0, w, h);
    for (let j = 0; j < 6; j++) for (let i = 0; i < 3; i++) {   // few, large, soft windows: calm when they sweep past
      const lit = r() < 0.6;
      g.fillStyle = lit ? (r() < 0.7 ? '#B08A62' : '#7890A6') : '#2E2A3A';
      g.fillRect(24 + i * 78, 40 + j * 76, 56, 52);
    }
    g.fillStyle = '#FFB86B'; g.fillRect(10, h - 60, w - 20, 44);             // a lit shop front
  });
  const looks = [[facade(3, '#3B2F4A'), 13], [facade(5, '#2E3F4F'), 9], [facade(8, '#4A3036'), 11], [facade(13, '#33403A'), 15]];
  const signs = ['BAR', '24H', '노래방', 'CAFE'];
  const glows = ['#FF4FA0', '#4FE3FF', '#FFD24F', '#8BFF6A'];
  for (let m = -17; m <= 4; m++) {
    const z0 = m * P;
    for (const s of [-1, 1]) for (let b = 0; b < 2; b++) {
      const [tex, hgt] = looks[(b + (s > 0 ? 2 : 0)) % 4];
      const bld = new THREE.Mesh(new THREE.BoxGeometry(2.4, hgt, 2.45), [M('#1E1B26'), M('#1E1B26'), M('#1E1B26'), M('#1E1B26'), M('#1E1B26'), M('#1E1B26')]);
      bld.material[s > 0 ? 1 : 0] = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#FFFFFF', emissiveIntensity: 0.45, roughness: 0.8 });
      bld.position.set(s * 10.7, hgt / 2, z0 + b * 2.5 + 1.25);
      scene.add(bld);
    }
    const s = m % 2 ? 1 : -1, k = ((m % 4) + 4) % 4;        // a neon sign sticking out from the wall
    const sign = canvasTex(256, 96, (g, w, h) => {
      g.fillStyle = '#120E18'; g.fillRect(0, 0, w, h);
      g.font = `700 64px ${FONT.sans}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = glows[k]; g.shadowBlur = 18; g.fillStyle = glows[k]; g.fillText(signs[k], w / 2, h / 2 + 4);
    });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), new THREE.MeshBasicMaterial({ map: sign, side: THREE.DoubleSide }));
    board.position.set(s * 9.1, 4.2, z0 + 1.2); board.rotation.y = Math.PI / 2;
    scene.add(board);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.6, 12), M('#15141A', { metalness: 0.6, roughness: 0.4 }));
    post.position.set(-s * 7.3, 2.3, z0 + 3.8); scene.add(post);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 14), new THREE.MeshBasicMaterial({ color: '#FFE2B0' }));
    bulb.position.set(-s * 7.3, 4.65, z0 + 3.8); scene.add(bulb);
  }
}

// the actor, facing +z; returns the torso (everything hangs off it), the swinging limbs and the rig's camera body
function actor() {
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o });
  const skin = M('#E9B892'), jacket = M('#2F5D6E'), dark = M('#1D1A22'), hair = M('#2A1A14');
  const root = new THREE.Group(), torso = new THREE.Group();
  root.add(torso);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.42, 8, 24), jacket);
  body.position.y = 0.36; body.scale.set(1.05, 1, 0.7); torso.add(body);
  const scarf = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.09, 32), M('#C8423A'));
  scarf.position.set(0, 0.61, 0.0); torso.add(scarf);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.12, 16), skin);
  neck.position.y = 0.66; torso.add(neck);
  const head = new THREE.Group();
  head.position.y = 0.8; torso.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.115, 40, 30), skin);
  skull.scale.set(0.95, 1.12, 1); head.add(skull);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.122, 40, 20, 0, TAU, 0, Math.PI * 0.5), hair);
  cap.position.y = 0.02; cap.rotation.x = -0.25; cap.scale.set(0.98, 1.1, 1.05); head.add(cap);
  const fringe = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.12, 6, 12), hair);
  fringe.rotation.z = Math.PI / 2 + 0.25; fringe.position.set(0.02, 0.085, 0.09); head.add(fringe);
  for (const s of [-1, 1]) {
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.017, 20, 14), M('#F6F2EC', { roughness: 0.3 }));
    white.position.set(0.042 * s, 0.022, 0.098); head.add(white);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.011, 16, 12), M('#2B1C14', { roughness: 0.2 }));
    iris.scale.setScalar(0.85); iris.position.set(0.042 * s, 0.022, 0.111); head.add(iris);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.009, 0.01), hair);
    brow.position.set(0.043 * s, 0.056, 0.104); brow.rotation.z = -0.15 * s; head.add(brow);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.026, 16, 12), skin);
    ear.scale.set(0.5, 1, 0.8); ear.position.set(0.108 * s, 0.0, 0.0); head.add(ear);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 12), skin);
  nose.scale.set(0.8, 1.2, 1.1); nose.position.set(0, -0.012, 0.118); head.add(nose);
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.005, 8, 24, Math.PI), M('#8A3B33'));
  mouth.position.set(0, -0.055, 0.105); mouth.rotation.z = Math.PI; head.add(mouth);
  const arms = [-1, 1].map(s => {
    const a = new THREE.Group(), m = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.5, 6, 14), jacket);
    m.position.y = -0.3; a.add(m);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), skin);
    hand.position.y = -0.6; a.add(hand);
    a.position.set(0.25 * s, 0.56, 0); torso.add(a);
    return a;
  });
  const legs = [-1, 1].map(s => {
    const l = new THREE.Group(), m = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.72, 6, 14), dark);
    m.position.y = -0.44; l.add(m);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.26), M('#E8E2D6'));
    shoe.position.set(0, -0.86, 0.05); l.add(shoe);
    l.position.set(0.1 * s, 0.02, 0); root.add(l);
    return l;
  });
  // the rig: a harness plate on the chest, a rod forward and up, and the camera at its end, turned back to the face
  const steel = M('#9AA0AA', { metalness: 0.9, roughness: 0.3 });
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.05), M('#111015'));
  plate.position.set(0, 0.3, 0.16); plate.layers.set(1); torso.add(plate);
  const bar = (from, to, r, parent) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, from.distanceTo(to), 12), steel);
    m.position.lerpVectors(from, to, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    parent.add(m);
    return m;
  };
  bar(new THREE.Vector3(0, 0.2, 0.18), new THREE.Vector3(0, 0.3, 0.95), 0.014, torso);    // the rod from the harness
  const camBody = new THREE.Group();                         // the camera and its mount: seen only from outside (layer 1)
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.22), M('#1A1A1E', { roughness: 0.4 }));
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.08, 20), M('#0E0E10', { roughness: 0.2 }));
  lens.rotation.x = Math.PI / 2; lens.position.z = -0.14;
  const tally = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), new THREE.MeshBasicMaterial({ color: '#FF3B3B' }));
  tally.position.set(0.05, 0.065, 0.05);
  camBody.add(box, lens, tally);
  bar(new THREE.Vector3(0, -0.2, -0.2), new THREE.Vector3(0, -0.05, 0.0), 0.014, camBody);
  camBody.position.set(0, 0.56, 1.15);
  camBody.traverse(o => o.layers.set(1));
  torso.add(camBody);
  return { root, torso, arms, legs };
}

export default {
  name: 'Snorricam',
  ko: '스노리캠',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const sky = canvasTex(4, 512, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, '#0B0D24'); grd.addColorStop(0.6, '#2A1E48'); grd.addColorStop(1, '#4A2A50');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
    });
    scene.background = sky;
    scene.fog = new THREE.Fog('#2A1E40', 18, 75);
    scene.add(new THREE.HemisphereLight('#8F9BFF', '#2A1A24', 1.1));
    const key = new THREE.DirectionalLight('#FFD9B0', 1.6);   // warm light from the shop fronts ahead of him
    key.position.set(-3, 5, 8);
    scene.add(key, key.target);
    street(scene);
    // the far skyline and the moon: a backdrop 100 m behind him that keeps pace (it is at the horizon, so it never
    // slides past, but the swinging camera swings it)
    const back = canvasTex(1024, 512, (g, w, h) => {      // 120 x 80 m: the horizon at row 448, 6.4 px per metre
      const grd = g.createLinearGradient(0, 0, 0, 448);
      grd.addColorStop(0, '#0B0D24'); grd.addColorStop(0.75, '#2C2050'); grd.addColorStop(1, '#3A2650');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      const glow = g.createRadialGradient(384, 192, 20, 384, 192, 170);
      glow.addColorStop(0, 'rgba(255, 236, 200, 0.45)'); glow.addColorStop(1, 'rgba(255, 236, 200, 0)');
      g.fillStyle = glow; g.fillRect(0, 0, w, h);
      g.fillStyle = '#FFF0D2'; g.beginPath(); g.arc(384, 192, 34, 0, TAU); g.fill();
      const r = rng(21);
      for (let x = 0; x < w;) {
        const bw = 36 + r() * 60, bh = 50 + r() * 130;
        g.fillStyle = '#1C1532'; g.fillRect(x, 448 - bh, bw - 3, bh + 2);
        g.fillStyle = 'rgba(255, 200, 130, 0.5)';
        for (let y = 448 - bh + 12; y < 440; y += 18) for (let wx = x + 7; wx < x + bw - 12; wx += 13) if (r() < 0.22) g.fillRect(wx, y, 6, 8);
        x += bw;
      }
      g.fillStyle = '#2A1E40'; g.fillRect(0, 448, w, h - 448);   // below the horizon: the fog colour
    });
    const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(120, 80), new THREE.MeshBasicMaterial({ map: back, fog: false }));
    scene.add(backdrop);
    const man = actor();
    scene.add(man.root);

    // the snorricam: a child of the torso, 0.95 m in front of the chest, looking back at the face
    const cam = new THREE.PerspectiveCamera(46, W / H, 0.05, 160);
    cam.position.set(0, 0.56, 1.15);
    man.torso.add(cam);
    man.root.updateMatrixWorld(true);
    cam.lookAt(new THREE.Vector3(0, 0.82, 0));              // set once in torso space (the torso sits at the origin now)
    // the outside camera: a dolly beside him, level, keeping pace
    const dolly = new THREE.PerspectiveCamera(34, INSET.w / INSET.h, 0.1, 160);
    dolly.layers.enable(1);
    const pose = t => {
      const p = walkPose(t);
      man.root.position.set(p.x, 0, p.z);
      man.torso.position.set(0, p.y, 0);
      man.torso.rotation.set(p.pitch, p.yaw, p.roll, 'YXZ');
      man.arms.forEach((a, i) => { a.rotation.x = 0.45 * Math.sin(p.stride + i * Math.PI); });
      man.legs.forEach((l, i) => { l.rotation.x = -0.5 * Math.sin(p.stride + i * Math.PI); });
      key.position.set(-3, 5, p.z + 8); key.target.position.set(0, 1, p.z);
      backdrop.position.set(0, 30, p.z - 110);
      dolly.position.set(2.5, 1.55, p.z + 3.1);
      dolly.lookAt(0, 1.05, p.z - 0.1);
      scene.updateMatrixWorld();
    };

    const frame = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
    const sum = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
    const inset = new THREE.WebGLRenderTarget(INSET.w * 2, INSET.h * 2, { type: THREE.HalfFloatType, samples: 4 });
    const quad = (tex, rect, blend) => {                    // a full-frame (or inset) textured quad
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
        uniforms: { tex: { value: tex }, uRect: { value: new THREE.Vector4(...rect) }, uW: { value: 1 } }, depthTest: false, depthWrite: false,
        vertexShader: 'uniform vec4 uRect; varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(mix(uRect.xy, uRect.zw, uv), 0.0, 1.0); }',
        fragmentShader: 'uniform sampler2D tex; uniform float uW; varying vec2 vUv; void main() { gl_FragColor = vec4(texture2D(tex, vUv).rgb * uW, 1.0); }',
        ...(blend ? { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor } : {}),
      }));
      const s = new THREE.Scene(); s.add(m);
      return { s, m };
    };
    const acc = quad(frame.texture, [-1, -1, 1, 1], true);
    acc.m.material.uniforms.uW.value = 1 / SUB;
    const nx = x => x / W * 2 - 1, ny = y => 1 - y / H * 2;
    const pip = quad(inset.texture, [nx(INSET.x), ny(INSET.y + INSET.h), nx(INSET.x + INSET.w), ny(INSET.y)], false);
    const flat = new THREE.Camera(), output = new OutputPass();
    output.renderToScreen = true;
    renderer.autoClear = false;
    return {
      render(t) {
        renderer.setRenderTarget(sum);
        renderer.setClearColor('#000000', 0);
        renderer.clear();
        for (let i = 0; i < SUB; i++) {
          pose(t - (i + 0.5) / SUB / 15);                  // a two-frame shutter
          renderer.setRenderTarget(frame);
          renderer.setClearColor('#0B0D24', 1);
          renderer.clear();
          renderer.render(scene, cam);
          renderer.setRenderTarget(sum);
          renderer.render(acc.s, flat);
        }
        pose(t);
        renderer.setRenderTarget(inset);
        renderer.clear();
        renderer.render(scene, dolly);
        renderer.setRenderTarget(sum);
        renderer.render(pip.s, flat);
        output.render(renderer, null, sum);
      },
    };
  },
  // the inset's frame and captions, and a pill for the main view
  overlay(ctx, t, W, H) {
    const { x, y, w, h } = INSET;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'; ctx.lineWidth = 4;
    ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = 'rgba(10, 10, 22, 0.78)';
    ctx.beginPath(); ctx.roundRect(x - 2, y - 64, w + 4, 62, [18, 18, 0, 0]); ctx.fill();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFD27A'; ctx.font = `700 26px ${FONT.sans}`;
    ctx.fillText('THE RIG FROM OUTSIDE', x + w / 2, y - 44);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'; ctx.font = `500 22px ${FONT.ko}`;
    ctx.fillText('밖에서 본 장비', x + w / 2, y - 18);
    ctx.fillStyle = 'rgba(10, 10, 22, 0.72)';
    ctx.beginPath(); ctx.roundRect(44, 1636, 560, 80, 40); ctx.fill();
    ctx.strokeStyle = '#FF7A7A'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#FF3B3B'; ctx.beginPath(); ctx.arc(92, 1676, 11, 0, TAU); ctx.fill();   // a steady REC dot
    ctx.textAlign = 'left'; ctx.fillStyle = '#FFFFFF'; ctx.font = `700 30px ${FONT.sans}`;
    ctx.fillText('BODY CAMERA · 몸에 단 카메라', 118, 1678);
  },
};
