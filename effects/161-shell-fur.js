// Shell fur: the fuzzball is 80 copies of one sphere, each pushed a little further out along the normal. Every shell
// keeps only the pixels inside a strand (a dot jittered anywhere in its 3D cell, shrinking toward the tip), so the stacked dots
// read as hairs; tips fade out softly. The outer shells are pushed by a slow sway (k² × lag), so the fur leans in a breeze.
// The frame is drawn at twice the size and filtered down, so the sub-pixel strand tips stay smooth instead of crawling.
import * as THREE from 'three';
import { TAU, phase } from '../lib/util.js';

const SHELLS = 80, LEN = 0.32;

const vertexShader = `
uniform float uK; uniform vec3 uLag;
varying vec3 vRest, vN, vV;
void main() {
  vRest = normalize(position);                       // the strand a shell pixel belongs to is set by the rest direction
  vec3 wN = normalize(mat3(modelMatrix) * normal);
  vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz + wN * (${LEN} * uK);
  float clump = 0.85 + 0.15 * sin(dot(vRest, vec3(1.6, 1.1, 1.3)) * 2.0);   // broad tufts: neighbours move together
  wp += uLag * uK * uK * clump;                      // tips swing more than roots
  vN = wN; vV = cameraPosition - wp;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;
const fragmentShader = `
uniform float uK; uniform vec3 uRoot, uTip;
varying vec3 vRest, vN, vV;
vec3 hash33(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
// the strand lattice is turned so the view axis runs along a cube diagonal: no lattice axis faces the camera
const mat3 LATTICE = mat3(0.7071, -0.7071, 0.0, 0.4082, 0.4082, -0.8165, 0.5774, 0.5774, 0.5774);
// coverage of the strands near q (in cell units): each cell holds one strand anywhere inside it, so the 2 × 2 × 2 cells
// around q are checked (a strand is at most 0.3 wide); each strand has its own length and tapers and fades at its tip
float strands(vec3 q) {
  float w = min(length(fwidth(q)) * 1.2, 0.08), cover = 0.0;
  vec3 b = floor(q - 0.5);
  for (int i = 0; i < 8; i++) {
    vec3 c = b + vec3(i & 1, (i >> 1) & 1, i >> 2), h = hash33(c);
    float d = length(q - (c + 0.1 + 0.8 * h));       // jittered over the whole cell: no regular grid
    float k = uK / (0.7 + 0.3 * h.z);                 // shorter strands end sooner
    float r = 0.3 * (1.0 - pow(min(k, 1.0), 1.3));    // thick root, tapering tip
    float fade = 1.0 - smoothstep(0.45, 1.0, k);      // the tip fades out instead of ending in a hard point
    cover = max(cover, (1.0 - smoothstep(r - w, r + w, d)) * fade);
  }
  return cover;
}
void main() {
  vec3 d = LATTICE * vRest;
  float cover = max(strands(d * 18.0), strands(d * 23.0 + 17.3));   // two offset layers of thick strands
  if (uK == 0.0) cover = 1.0;                        // the innermost shell is the solid skin
  if (cover < 0.01) discard;
  vec3 n = normalize(vN), v = normalize(vV), l = normalize(vec3(-0.5, 0.75, 0.6));
  float wrap = max(dot(n, l) * 0.6 + 0.4, 0.0);
  vec3 h = normalize(l + v);
  float th = dot(n, h);                              // Kajiya-Kay sheen along the strand direction
  float spec = pow(sqrt(max(1.0 - th * th, 0.0)), 60.0) * 0.18 * uK;
  float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  vec3 col = mix(uRoot, uTip, pow(uK, 0.8)) * (0.35 + 0.85 * wrap) * (0.82 + 0.18 * uK);   // roots a little darker
  col += vec3(1.0, 0.9, 0.75) * spec + vec3(0.65, 0.85, 1.0) * rim * 0.35 * uK;
  gl_FragColor = vec4(col, cover);
  #include <colorspace_fragment>
}`;

export default {
  name: 'Shell Fur',
  ko: '셸 털',
  three(renderer, W, H) {
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas'); bg.width = W; bg.height = H;
    const b = bg.getContext('2d');
    const grd = b.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#16324F'); grd.addColorStop(0.55, '#2E6E8E'); grd.addColorStop(1, '#9BD3DB');
    b.fillStyle = grd; b.fillRect(0, 0, W, H);
    scene.background = new THREE.CanvasTexture(bg); scene.background.colorSpace = THREE.SRGBColorSpace;

    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
    camera.position.set(0, 0.5, 13.5);
    camera.lookAt(0, 0.1, 0);

    const body = new THREE.Group();
    scene.add(body);
    const geo = new THREE.IcosahedronGeometry(1.25, 40);   // a geodesic sphere: no poles to pinch
    const shells = [];
    for (let i = 0; i < SHELLS; i++) {
      const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({
        vertexShader, fragmentShader, transparent: true,
        uniforms: { uK: { value: i / (SHELLS - 1) }, uLag: { value: new THREE.Vector3() }, uRoot: { value: new THREE.Color('#C9693A') }, uTip: { value: new THREE.Color('#FFD39A') } },
      }));
      m.renderOrder = 10 + i;                         // inner shells first
      body.add(m); shells.push(m);
    }

    // two glossy eyes that poke out of the fur
    const lights = new THREE.Group();
    lights.add(new THREE.HemisphereLight('#FFFFFF', '#55607A', 1.4));
    const key = new THREE.DirectionalLight('#FFFFFF', 2.2); key.position.set(-3, 5, 6); lights.add(key);
    scene.add(lights);
    const white = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.15 });
    const black = new THREE.MeshStandardMaterial({ color: '#141018', roughness: 0.1 });
    for (const s of [-1, 1]) {
      const eye = new THREE.Group();
      eye.add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 48, 32), white));
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.17, 48, 32), black);
      pupil.position.z = 0.17; eye.add(pupil);
      const dir = new THREE.Vector3(0.36 * s, 0.22, 1).normalize();
      eye.position.copy(dir).multiplyScalar(1.38);
      eye.lookAt(dir.clone().multiplyScalar(3).add(new THREE.Vector3(0, -0.4, 2)));
      body.add(eye);
    }

    // soft shadow on the ground
    const sc = document.createElement('canvas'); sc.width = sc.height = 256;
    const sg = sc.getContext('2d'), rg = sg.createRadialGradient(128, 128, 0, 128, 128, 128);
    rg.addColorStop(0, 'rgba(6, 18, 30, 0.55)'); rg.addColorStop(1, 'rgba(6, 18, 30, 0)');
    sg.fillStyle = rg; sg.fillRect(0, 0, 256, 256);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = -1.95;
    scene.add(shadow);

    // 2× supersampling: render into a 2160 × 3840 target, then average it down onto the canvas
    const rt = new THREE.WebGLRenderTarget(W * 2, H * 2, { type: THREE.HalfFloatType, samples: 4 });
    const down = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: { uSrc: { value: rt.texture }, uTexel: { value: new THREE.Vector2(1 / (W * 2), 1 / (H * 2)) } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D uSrc; uniform vec2 uTexel; varying vec2 vUv;
        void main() {
          vec4 c = vec4(0.0);
          for (int j = -1; j <= 1; j += 2) for (int i = -1; i <= 1; i += 2) c += texture2D(uSrc, vUv + vec2(i, j) * uTexel * 0.75);
          gl_FragColor = c * 0.25;
          #include <colorspace_fragment>
        }`,
    }));
    down.frustumCulled = false;
    const downScene = new THREE.Scene(); downScene.add(down);
    const downCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    return {
      scene, camera,
      render() {
        renderer.setRenderTarget(rt);
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);
        renderer.render(downScene, downCam);
      },
      update(t) {
        const a = phase(t) * TAU;
        const x = 0.03 * Math.sin(a), y = 0.035 * Math.sin(a + 0.6);   // one gentle bob per loop
        body.position.set(x, y, 0);
        body.rotation.set(0.015 * Math.sin(a), 0.05 * Math.sin(a + 0.5), -0.02 * Math.cos(a));
        // the fur lags against the ball's acceleration, sways in a slow breeze and droops a little
        // one slow sway of the fur per loop: the push circles round once, plus a little droop
        const lag = new THREE.Vector3(0.07 * Math.sin(a + 1), -0.04 + 0.015 * Math.sin(a), 0.04 * Math.cos(a + 1));
        for (const m of shells) m.material.uniforms.uLag.value.copy(lag);
        shadow.position.x = x;
        shadow.scale.setScalar(1 - 0.06 * Math.sin(a + 0.6));
      },
    };
  },
};
