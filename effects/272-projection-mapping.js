// Projection mapping: a plain white neoclassical facade at night is lit by one projector (a SpotLight whose .map is
// the slide), so every colour on the stone is projected light. To line the light up with the stone, the facade is
// rendered once from the projector's own camera into a template (each part's id, type and depth). Every frame a
// shader draws the slide on that template: outlines trace up every edge, the windows fill one by one, a colour wave
// floods the parts, and a moving fake light throws drop shadows so the columns and frames seem to stand out further.
import * as THREE from 'three';
import { TAU } from '../lib/util.js';

const PROJ = new THREE.Vector3(0, 5.0, 30);                  // the projector, across the square (behind the camera)
const TS = 1024;                                             // template and slide size (texels)
const TYPES = { wall: 0, column: 1, window: 2, cornice: 3, door: 4, base: 5 };

// the facade: wall, steps, four columns over two floors, eight window frames, cornice, attic, pediment, arched door
function facade(white) {
  const parts = [];
  const g = new THREE.Group();
  const add = (geo, type, x, y, z, index = 0) => {
    const m = new THREE.Mesh(geo, white);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    m.userData = { type: TYPES[type], index };
    g.add(m); parts.push(m);
    return m;
  };
  add(new THREE.BoxGeometry(10.6, 12.6, 1), 'wall', 0, 7.5, -0.5);
  add(new THREE.BoxGeometry(12.4, 0.6, 2.2), 'base', 0, 0.3, 0.3);
  add(new THREE.BoxGeometry(11.8, 0.6, 1.6), 'base', 0, 0.9, 0.1);
  [-4.4, -1.7, 1.7, 4.4].forEach((x, i) => {
    add(new THREE.CylinderGeometry(0.4, 0.46, 7.4, 48), 'column', x, 5.0, 0.55, i);
    add(new THREE.BoxGeometry(1.1, 0.35, 1.1), 'column', x, 1.38, 0.55, i);
    add(new THREE.BoxGeometry(1.15, 0.4, 1.15), 'column', x, 8.85, 0.55, i);
  });
  [[-3.05, 3.4], [3.05, 3.4], [-3.05, 6.7], [0, 6.7], [3.05, 6.7], [-3.05, 11.1], [3.05, 11.1]].forEach(([x, y], i) => {
    add(new THREE.BoxGeometry(1.5, 2.2, 0.22), 'window', x, y, 0.11, i);       // frame
    add(new THREE.BoxGeometry(1.1, 1.8, 0.1), 'window', x, y, 0.2, i);         // pane, a step further out
    add(new THREE.BoxGeometry(1.9, 0.22, 0.4), 'cornice', x, y + 1.25, 0.2, i); // hood
  });
  const door = new THREE.Shape();
  door.moveTo(-1.0, 0); door.lineTo(1.0, 0); door.lineTo(1.0, 2.4); door.absarc(0, 2.4, 1.0, 0, Math.PI, false); door.lineTo(-1.0, 0);
  add(new THREE.ExtrudeGeometry(door, { depth: 0.18, bevelEnabled: false, curveSegments: 32 }), 'door', 0, 1.2, 0);
  add(new THREE.BoxGeometry(11.8, 0.55, 1.6), 'cornice', 0, 9.35, 0.1);
  add(new THREE.BoxGeometry(11.4, 0.4, 1.2), 'cornice', 0, 13.0, 0.0);
  add(new THREE.CylinderGeometry(0.85, 0.85, 0.3, 48), 'window', 0, 11.1, 0.05, 7).rotation.x = Math.PI / 2;   // clock
  const tri = new THREE.Shape();
  tri.moveTo(-5.9, 0); tri.lineTo(5.9, 0); tri.lineTo(0, 2.6); tri.lineTo(-5.9, 0);
  const oculus = new THREE.Path(); oculus.absarc(0, 1.0, 0.55, 0, TAU, true); tri.holes.push(oculus);
  add(new THREE.ExtrudeGeometry(tri, { depth: 0.9, bevelEnabled: false, curveSegments: 48 }), 'cornice', 0, 13.2, -0.6);
  return { group: g, parts };
}

// the slide, drawn in the projector's view from the template (id, type, depth, window index)
const slideFrag = `
uniform sampler2D tTmpl; uniform float uTime; varying vec2 vUv;
const float TS = ${TS}.0;
vec4 at(vec2 o) { return texture2D(tTmpl, vUv + o / TS); }
float idEdge() {                                             // 1 on the border between two parts, soft over 2 texels
  float id = at(vec2(0)).r, e = 0.0;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785398;
    vec2 o = vec2(cos(a), sin(a));
    e += step(0.0005, abs(at(o * 1.5).r - id)) * 0.6 + step(0.0005, abs(at(o * 3.0).r - id)) * 0.4;
  }
  return clamp(e / 4.0, 0.0, 1.0);
}
void main() {
  vec4 c = at(vec2(0));
  float t = uTime, id = c.r, type = c.g * 10.0, idx = c.a * 10.0;
  if (id <= 0.0) { gl_FragColor = vec4(0.0); return; }      // sky: the projector shows black
  vec2 p = vUv;
  float edge = idEdge();
  // 1) outlines trace up the building (0 - 1.3 s), then dim
  float front = smoothstep(0.0, 1.3, t) * 1.25 - 0.1;
  float trace = smoothstep(front + 0.04, front - 0.02, p.y) * (1.0 - 0.6 * smoothstep(1.4, 2.0, t)) * (1.0 - smoothstep(4.4, 4.9, t));
  vec3 col = vec3(0.55, 0.95, 1.0) * edge * trace * 1.6;
  // 2) windows fill one after another, warm (1.3 - 2.4 s)
  float isWin = step(1.5, type) * step(type, 2.5);
  float wOn = smoothstep(1.3 + idx * 0.13, 1.55 + idx * 0.13, t) * (1.0 - smoothstep(4.3, 4.8, t));
  col += isWin * wOn * mix(vec3(1.0, 0.62, 0.2), vec3(1.0, 0.85, 0.45), p.y) * 1.3;
  // 3) a colour wave sweeps across every part (2.0 - 3.4 s), each part its own hue
  float wave = smoothstep(-0.25, 0.05, (t - 2.0) * 0.9 - (p.x * 0.5 + p.y * 0.3)) * (1.0 - smoothstep(3.4, 3.9, t));
  vec3 hue = 0.5 + 0.5 * cos(6.2831 * (id * 7.31 + vec3(0.0, 0.33, 0.67)));
  hue = mix(hue * hue, vec3(0.45, 0.2, 1.0), 0.3);
  col = mix(col, hue * 0.9 + edge * 0.6, wave * (1.0 - isWin * wOn * 0.6));
  // 4) a white wash with a fake light swinging round: parts that stand out cast drop shadows (3.4 - 4.6 s)
  float lit = smoothstep(3.3, 3.7, t) * (1.0 - smoothstep(4.1, 4.95, t));
  float ang = (t - 3.3) * 2.2;
  vec2 off = vec2(cos(ang), sin(ang) * 0.6 - 0.5) * 26.0;
  float shadow = 0.0;
  for (int i = 1; i <= 10; i++) {                            // anything raised up-light of this texel shades it
    vec4 q = at(off * float(i) / 10.0);
    shadow = max(shadow, step(0.0005, q.b - c.b - 0.002) * (1.0 - float(i) / 14.0));
  }
  float glow = 0.75 + 0.35 * dot(normalize(p - vec2(0.5)), normalize(-off + 1e-4));   // brighter towards the fake light
  vec3 wash = vec3(1.0, 0.95, 0.88) * glow * (1.0 - 0.88 * shadow) + edge * 0.2;
  col = mix(col, wash, lit);
  gl_FragColor = vec4(col, 1.0);
}`;

export default {
  name: 'Projection Mapping',
  ko: '프로젝션 매핑',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    const sky = document.createElement('canvas');
    sky.width = 4; sky.height = 512;
    const g = sky.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#03040E'); grd.addColorStop(0.7, '#0E1430'); grd.addColorStop(1, '#1C1A38');
    g.fillStyle = grd; g.fillRect(0, 0, 4, 512);
    scene.background = new THREE.CanvasTexture(sky);
    scene.background.colorSpace = THREE.SRGBColorSpace;
    scene.add(new THREE.HemisphereLight('#5A6AB0', '#1A1626', 0.35));

    const white = new THREE.MeshStandardMaterial({ color: '#F4F1EA', roughness: 0.85 });
    const { group, parts } = facade(white);
    scene.add(group);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#4A4652', roughness: 0.8 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    scene.add(ground);

    // the projector: a spot light whose map is the slide; its shadow camera is the projector's lens
    const slide = new THREE.WebGLRenderTarget(TS, TS, { type: THREE.HalfFloatType });
    const proj = new THREE.SpotLight('#FFFFFF', 5.5, 0, 0.37, 0.02, 0);
    proj.position.copy(PROJ);
    proj.target.position.set(0, 8.2, 0);
    proj.map = slide.texture;
    proj.castShadow = true;
    proj.shadow.mapSize.set(2048, 2048);
    proj.shadow.bias = -0.0004;
    scene.add(proj, proj.target);
    proj.updateMatrixWorld(); proj.target.updateMatrixWorld();
    proj.shadow.updateMatrices(proj);

    // the template: the facade seen from the projector, one colour per part (id, type, depth, index)
    const tmpl = new THREE.WebGLRenderTarget(TS, TS, { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    const tmplScene = new THREE.Scene();
    parts.forEach((m, i) => {
      const c = m.clone();
      c.material = new THREE.ShaderMaterial({
        uniforms: { uId: { value: (i + 1) / 64 }, uType: { value: m.userData.type / 10 }, uIdx: { value: m.userData.index / 10 } },
        vertexShader: 'varying float vZ; void main() { vec4 v = modelViewMatrix * vec4(position, 1.0); vZ = -v.z; gl_Position = projectionMatrix * v; }',
        fragmentShader: 'uniform float uId, uType, uIdx; varying float vZ; void main() { gl_FragColor = vec4(uId, uType, 1.0 - vZ / 40.0, uIdx); }',
      });
      c.position.copy(m.position); c.rotation.copy(m.rotation);
      tmplScene.add(c);
    });
    renderer.setRenderTarget(tmpl);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(tmplScene, proj.shadow.camera);
    renderer.setRenderTarget(null);
    const slideMat = new THREE.ShaderMaterial({
      uniforms: { tTmpl: { value: tmpl.texture }, uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: slideFrag,
    });
    const slideScene = new THREE.Scene(), flat = new THREE.Camera();
    slideScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), slideMat));

    // a soft pool of bounced light on the square, and people watching
    const pool = new THREE.Mesh(new THREE.CircleGeometry(14, 64), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec2 vP; void main() { float d = length(vP / vec2(1.0, 0.55)) / 14.0; gl_FragColor = vec4(vec3(0.42, 0.36, 0.75) * 0.22 * (1.0 - smoothstep(0.0, 1.0, d)), 1.0); }',
    }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.01, 3);
    scene.add(pool);
    const crowd = new THREE.MeshStandardMaterial({ color: '#0B0B12', roughness: 0.8 });      // people watching
    [[-5.5, 13, 1.0], [-4.4, 14.4, 0.94], [-1.4, 12.2, 1.04], [1.8, 15.0, 1.0], [4.6, 13.6, 0.95], [6.6, 12.4, 0.97]].forEach(([x, z, s]) => {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.27 * s, 0.95 * s, 6, 12), crowd);
      body.position.set(x, 0.75 * s, z);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16 * s, 16, 12), crowd);
      head.position.set(x, 1.58 * s, z);
      scene.add(body, head);
    });
    const camera = new THREE.PerspectiveCamera(46, W / H, 0.3, 300);
    return {
      scene, camera,
      update(t) {
        const a = TAU * t / 5;
        slideMat.uniforms.uTime.value = (t + 0.6) % 5;          // the show's clock: the loop starts mid-trace
        renderer.setRenderTarget(slide);
        renderer.render(slideScene, flat);
        renderer.setRenderTarget(null);
        camera.position.set(8 + 1.5 * Math.sin(a), 2.2 + 0.3 * Math.sin(2 * a), 26);
        camera.lookAt(0.4, 8.6, 0);
      },
    };
  },
};
