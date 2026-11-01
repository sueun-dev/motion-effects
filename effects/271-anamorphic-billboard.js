// Anamorphic billboard: an L-shaped LED screen wraps the corner of a building at night. A 3D scene (a gridded room
// sunk into the corner behind a fake strip of facade, a glossy ring and three spheres that float out over the street)
// is rendered from one point on the pavement, the sweet spot, and that image is projected back onto the two flat
// screen faces: each screen pixel shows what lies behind it on the line to the sweet spot. The fake facade matches the
// real cladding round the screen, so from the sweet spot the screen edge vanishes, the room has depth and the ring
// hangs in the air over the street. When the camera walks off to the side, the same pixels turn into a flat picture
// folded round the corner. The camera is motion-blurred over 16 sub-frames so the facade never shimmers as it moves.
import * as THREE from 'three';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TAU, FONT, ease, span, rng } from '../lib/util.js';

const FW = 9, Y0 = 8, Y1 = 20;                               // each screen face: 9 m wide, from 8 m to 20 m up
const A = 6.6, B0 = 9.4, B1 = 18.6;                          // the room's mouth: 6.6 m along each face, 9.4 to 18.6 m up
const FACADE = '#1B1E38';                                    // the cladding round the screen, real and painted
const SWEET = new THREE.Vector3(17.5, 1.7, 17.5);            // the sweet spot: eye height across the street
const OFF = new THREE.Vector3(24, 5.0, 9.6);                 // the off-axis view the camera walks to
const LOOK = new THREE.Vector3(-0.6, 13.6, -0.6);
const SUB = 16;                                              // sub-frames per frame (motion blur)
// 0 at the sweet spot, 1 off to the side: hold 0.4-1.9 s, walk out, hold 3.45-3.7 s, walk back across the loop point
const away = t => ease.inOut(span(t, 1.9, 3.45)) - ease.inOut(span(t, 3.7, 5.4)) + 1 - ease.inOut(span(t, -1.3, 0.4));
// 0 inside the room, 1 floating out over the street: it comes out at the sweet spot and goes back in off axis
const out = t => ease.inOut(span(t, 0.4, 1.5)) - ease.inOut(span(t, 3.9, 4.95));
const state = { k: 0, cam: new THREE.Vector3() };

function canvasTex(w, h, paint, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(...repeat); }
  return tex;
}
const plane = (mat, w, h, x, y, z, rotY = 0, rotX = 0) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z); m.rotation.set(rotX, rotY, 0, 'YXZ');
  return m;
};

// the virtual scene that only the sweet spot ever sees
function virtualScene(renderer) {
  const v = new THREE.Scene();
  v.background = new THREE.Color(FACADE);
  v.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  v.environmentIntensity = 0.8;
  const grid = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#0E1846'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#3FD2FF'; g.lineWidth = 8; g.strokeRect(0, 0, w, h);
  });
  const wallMat = (rx, ry) => {
    const map = grid.clone(); map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(rx, ry);
    return new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: '#FFFFFF', emissiveIntensity: 0.5, roughness: 0.8 });
  };
  const cy = (B0 + B1) / 2, side = wallMat(A / 1.65, (B1 - B0) / 1.65), flat = wallMat(A / 1.65, A / 1.65);
  const walls = [
    plane(side, A, B1 - B0, -A / 2, cy, -A), plane(side, A, B1 - B0, -A, cy, -A / 2, Math.PI / 2),
    plane(flat, A, A, -A / 2, B1, -A / 2, 0, Math.PI / 2), plane(flat, A, A, -A / 2, B0, -A / 2, 0, -Math.PI / 2),
  ];
  walls.forEach(w => { w.receiveShadow = true; v.add(w); });
  // the painted facade round the mouth, at the screen planes; a shadow layer on top catches the ring's shadow
  const paint = new THREE.MeshBasicMaterial({ color: FACADE }), shade = new THREE.ShadowMaterial({ opacity: 0.6 });
  for (const mat of [paint, shade]) {
    const d = mat === paint ? 0.06 : 0.08, sides = [
      [FW - A, Y1 - Y0, -(A + FW) / 2, (Y0 + Y1) / 2], [A + d, B0 - Y0, (d - A) / 2, (Y0 + B0) / 2], [A + d, Y1 - B1, (d - A) / 2, (B1 + Y1) / 2]];
    for (const [w, h, u, y] of sides) {
      const a = plane(mat, w, h, u, y, d), b = plane(mat, w, h, d, y, u, Math.PI / 2);
      a.receiveShadow = b.receiveShadow = true;
      v.add(a, b);
    }
  }
  const glow = new THREE.MeshBasicMaterial({ color: '#E8FBFF' });                // bright edges round the mouth
  const beam = (sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), glow); m.position.set(x, y, z); v.add(m); };
  for (const y of [B0, B1]) { beam(A, 0.2, 0.2, -A / 2, y, 0); beam(0.2, 0.2, A, 0, y, -A / 2); }
  beam(0.2, B1 - B0, 0.2, -A, cy, 0); beam(0.2, B1 - B0, 0.2, 0, cy, -A); beam(0.2, B1 - B0, 0.2, -A, cy, -A);
  const sun = new THREE.DirectionalLight('#FFF0E0', 2.6);
  sun.position.set(16, 34, 12); sun.target.position.set(-3, 11, -3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 70 });
  sun.shadow.radius = 8;
  v.add(sun, sun.target, new THREE.HemisphereLight('#9FB8FF', '#1A1030', 0.6));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.95, 64, 160),
    new THREE.MeshPhysicalMaterial({ color: '#FF4F8B', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 }));
  ring.castShadow = true;
  v.add(ring);
  const balls = ['#F2F2F2', '#2FD4C4', '#FFC93C'].map((c, i) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.75, 64, 32),
      new THREE.MeshPhysicalMaterial({ color: c, metalness: i === 0 ? 1 : 0.1, roughness: i === 0 ? 0.08 : 0.25, clearcoat: 1 }));
    m.castShadow = true;
    v.add(m);
    return m;
  });
  const inside = new THREE.Vector3(-3.6, 14.4, -3.6), outside = new THREE.Vector3(2.6, 11.9, 2.6);
  const tmp = new THREE.Vector3(), tiltAxis = new THREE.Vector3(1, 0, -1).normalize();
  return {
    scene: v,
    update(t) {
      const a = TAU * t / 5, k = out(t);
      ring.position.lerpVectors(inside, outside, k);
      ring.position.y += 0.3 * Math.sin(2 * a);
      ring.rotation.set(0.45 + 0.2 * Math.sin(a), Math.PI / 4 + 0.45 * Math.sin(a + 1), a);
      balls.forEach((b, i) => {
        const p = a + i * TAU / 3;
        tmp.set(3.6 * Math.cos(p), 0.8 * Math.sin(2 * p + i), 3.6 * Math.sin(p)).applyAxisAngle(tiltAxis, 0.45);
        b.position.copy(ring.position).add(tmp);
      });
    },
  };
}

export default {
  name: 'Anamorphic Billboard',
  ko: '아나모픽 빌보드',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // the content: rendered from the sweet spot into a square image every frame
    const virt = virtualScene(renderer);
    const sweetCam = new THREE.PerspectiveCamera(36, 1, 0.5, 200);
    sweetCam.position.copy(SWEET);
    sweetCam.lookAt(-1, 13.6, -1);
    sweetCam.updateMatrixWorld();
    const view = new THREE.WebGLRenderTarget(2048, 2048, { type: THREE.HalfFloatType, samples: 4, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    view.texture.anisotropy = 8;
    const viewProj = new THREE.Matrix4().multiplyMatrices(sweetCam.projectionMatrix, sweetCam.matrixWorldInverse);

    // ---- the real street ----
    const scene = new THREE.Scene();
    scene.background = canvasTex(4, 512, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, '#05061A'); grd.addColorStop(0.6, '#191846'); grd.addColorStop(1, '#46285A');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
    });
    scene.add(new THREE.HemisphereLight('#6E7FD0', '#1A1424', 0.5));
    const windows = canvasTex(1024, 1024, (g, w, h) => {      // dark glass, a few lit windows
      g.fillStyle = '#0D0F24'; g.fillRect(0, 0, w, h);
      const r = rng(4), cols = 16, rows = 36, cw = w / cols, ch = h / rows;
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const lit = r() < 0.22;
        g.fillStyle = lit ? (r() < 0.75 ? '#B88A56' : '#6F96B8') : '#141731';
        g.fillRect(i * cw + cw * 0.15, j * ch + ch * 0.2, cw * 0.7, ch * 0.6);
      }
    }, [4, 1]);
    const building = new THREE.Mesh(new THREE.BoxGeometry(40, 36, 40),
      new THREE.MeshStandardMaterial({ color: '#FFFFFF', map: windows, emissiveMap: windows, emissive: '#FFFFFF', emissiveIntensity: 0.3, roughness: 0.6, metalness: 0.3 }));
    building.position.set(-20, 18, -20);
    scene.add(building);
    const clad = new THREE.MeshBasicMaterial({ color: FACADE });                  // plain cladding round the screen
    scene.add(plane(clad, 11.5, 16, -5.75, 14, 0.03), plane(clad, 11.5, 16, 0.03, 14, -5.75, Math.PI / 2));
    const screenMat = new THREE.ShaderMaterial({
      uniforms: { tView: { value: view.texture }, uVP: { value: viewProj } },
      vertexShader: 'varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform sampler2D tView; uniform mat4 uVP; varying vec3 vW;
        void main() {
          vec4 c = uVP * vec4(vW, 1.0);                       // where this screen pixel lands in the sweet-spot image
          gl_FragColor = vec4(texture2D(tView, c.xy / c.w * 0.5 + 0.5).rgb, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const cy = (Y0 + Y1) / 2;
    scene.add(plane(screenMat, FW + 0.06, Y1 - Y0, -FW / 2 + 0.03, cy, 0.06),          // the two faces meet at the corner
      plane(screenMat, FW + 0.06, Y1 - Y0, 0.06, cy, -FW / 2 + 0.03, Math.PI / 2));
    const shops = canvasTex(1024, 128, (g, w, h) => {         // the ground floor: warm shop windows under awnings
      g.fillStyle = '#100D1C'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 8; i++) {
        const x = i * 128 + 14;
        g.fillStyle = ['#8A6444', '#9A7A58', '#5E7690', '#8A5E70'][i % 4];
        g.fillRect(x, 44, 100, 70);
        g.fillStyle = '#2A2140'; g.fillRect(x - 6, 26, 112, 14);
      }
    }, [3, 1]);
    const shop = new THREE.Mesh(new THREE.BoxGeometry(40.2, 4.4, 40.2), new THREE.MeshStandardMaterial({ color: '#7A7A8A', map: shops, emissiveMap: shops, emissive: '#FFFFFF', emissiveIntensity: 0.28, roughness: 0.8 }));
    shop.position.set(-20, 2.2, -20);
    scene.add(shop);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#17162A', roughness: 0.5, metalness: 0.2 }));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    const walk = new THREE.MeshStandardMaterial({ color: '#25233A', roughness: 0.8 });
    const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(60, 0.2, 5), walk);
    sidewalk.position.set(-20, 0.1, 2.5);
    const sidewalk2 = new THREE.Mesh(new THREE.BoxGeometry(5, 0.2, 60), walk);
    sidewalk2.position.set(2.5, 0.1, -20);
    scene.add(sidewalk, sidewalk2);
    const dark = new THREE.MeshStandardMaterial({ color: '#0A0B16', roughness: 0.6, metalness: 0.4 });
    for (const [x, z] of [[-12, 4.2], [4.2, -12]]) {                              // street lamps
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6.5, 12), dark);
      pole.position.set(x, 3.25, z);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 12), new THREE.MeshBasicMaterial({ color: '#FFE2B0' }));
      lamp.position.set(x, 6.6, z);
      const l = new THREE.PointLight('#FFD39A', 40, 14, 1.8);
      l.position.set(x, 6.4, z);
      scene.add(pole, lamp, l);
    }

    // the street camera is averaged over SUB instants across each frame
    const camera = new THREE.PerspectiveCamera(52, W / H, 0.3, 300);
    const frame = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
    const sum = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
    const addScene = new THREE.Scene(), flat = new THREE.Camera();
    addScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: { tex: { value: frame.texture } }, depthTest: false, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D tex; varying vec2 vUv; void main() { gl_FragColor = texture2D(tex, vUv) / ${SUB}.0; }`,
    })));
    const output = new OutputPass();
    output.renderToScreen = true;
    const place = t => {
      const k = away(t);
      camera.position.lerpVectors(SWEET, OFF, k);
      camera.position.y += 2.5 * Math.sin(Math.PI * k);     // a slight rise on the way
      camera.lookAt(LOOK);
      return k;
    };
    renderer.autoClear = false;
    return {
      render(t) {
        virt.update(t);
        renderer.setRenderTarget(view);
        renderer.setClearColor(0x000000, 1);
        renderer.clear();
        renderer.render(virt.scene, sweetCam);
        renderer.setRenderTarget(sum);
        renderer.setClearColor(0x000000, 0);
        renderer.clear();
        for (let i = SUB - 1; i >= 0; i--) {
          state.k = place(t - (i + 0.5) / SUB / 30);
          renderer.setRenderTarget(frame);
          renderer.clear();
          renderer.render(scene, camera);
          renderer.setRenderTarget(sum);
          renderer.render(addScene, flat);
        }
        state.cam.copy(camera.position);
        output.render(renderer, null, sum);
      },
    };
  },
  // the state pills and a small plan: the corner screen, the sweet spot and where the camera stands
  overlay(ctx, t, W, H) {
    const k = state.k;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    [['SWEET SPOT · 3D', 1 - k, '#7DF3FF', 300], ['OFF AXIS · FLAT', k, '#FF8FB8', 780]].forEach(([txt, on, col, x]) => {
      ctx.fillStyle = `rgba(8, 8, 24, ${0.6 + 0.25 * on})`;
      ctx.beginPath(); ctx.roundRect(x - 210, 1730, 420, 76, 38); ctx.fill();
      ctx.globalAlpha = 0.25 + 0.75 * on;
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = col; ctx.font = `700 34px ${FONT.sans}`; ctx.fillText(txt, x, 1769);
      ctx.globalAlpha = 1;
    });
    const cx = 900, cy = 1430, s = 5;                          // plan view turned 45 degrees, 5 px per metre
    const P = (x, z) => [cx + (x - z) * s * 0.707, cy + (x + z) * s * 0.707];
    ctx.fillStyle = 'rgba(8, 8, 24, 0.82)';
    ctx.beginPath(); ctx.roundRect(cx - 140, cy - 70, 280, 270, 24); ctx.fill();
    const [sx, sy] = P(SWEET.x, SWEET.z), [px, py] = P(state.cam.x, state.cam.z);
    ctx.strokeStyle = 'rgba(255, 143, 184, 0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(...P(-FW, 0)); ctx.moveTo(px, py); ctx.lineTo(...P(0, -FW)); ctx.stroke();
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(...P(-FW, 0)); ctx.lineTo(...P(0, 0)); ctx.lineTo(...P(0, -FW)); ctx.stroke();
    ctx.fillStyle = '#7DF3FF'; ctx.beginPath(); ctx.arc(sx, sy, 10, 0, TAU); ctx.fill();
    ctx.fillStyle = '#FF8FB8'; ctx.beginPath(); ctx.arc(px, py, 7, 0, TAU); ctx.fill();
    ctx.font = `600 22px ${FONT.sans}`; ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText('screen', cx, cy - 46);
    ctx.fillStyle = '#7DF3FF'; ctx.fillText('sweet spot', sx, sy + 30);
  },
};
