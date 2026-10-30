// Painterly (anisotropic Kuwahara): a lamp-lit still life is rendered, then repainted. A structure tensor (Sobel
// gradients, Gaussian-smoothed) gives each pixel the local edge direction; the filter averages colour inside an
// ellipse stretched along that direction, split into 8 sectors, and keeps mostly the calmest sectors, so flat areas
// become smooth dabs and edges stay sharp, like brush strokes. The result is embossed by its own brightness and
// laid on a fixed canvas weave.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TAU, phase, rng, canvas } from '../lib/util.js';

const HW = 540, HH = 960;                       // the paint is made at half size
const quadVert = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
// a mottled colour texture (blotches of lighter and darker paint), so the filter has something to turn into dabs
function mottle(seed, base, spread, n = 260) {
  const c = canvas(256, 256), g = c.getContext('2d'), r = rng(seed), col = new THREE.Color(base), hsl = {};
  col.getHSL(hsl);
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < n; i++) {
    const x = r() * 256, y = r() * 256, rad = 6 + 26 * r();
    g.fillStyle = new THREE.Color().setHSL(hsl.h + (r() - 0.5) * 0.06, hsl.s * (0.8 + 0.4 * r()), Math.max(0, hsl.l + (r() - 0.5) * spread)).getStyle();
    g.globalAlpha = 0.35; g.beginPath(); g.ellipse(x, y, rad, rad * (0.4 + 0.6 * r()), r() * TAU, 0, TAU); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const pass = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: quadVert, fragmentShader: frag, uniforms, toneMapped: false });

const TENSOR = `uniform sampler2D tSrc; varying vec2 vUv;
  void main() {
    vec2 d = 1.0 / vec2(${HW}.0, ${HH}.0);
    vec3 gx = (-1.0 * texture2D(tSrc, vUv + d * vec2(-1, -1)).rgb - 2.0 * texture2D(tSrc, vUv + d * vec2(-1, 0)).rgb - 1.0 * texture2D(tSrc, vUv + d * vec2(-1, 1)).rgb
             + 1.0 * texture2D(tSrc, vUv + d * vec2(1, -1)).rgb + 2.0 * texture2D(tSrc, vUv + d * vec2(1, 0)).rgb + 1.0 * texture2D(tSrc, vUv + d * vec2(1, 1)).rgb) / 4.0;
    vec3 gy = (-1.0 * texture2D(tSrc, vUv + d * vec2(-1, -1)).rgb - 2.0 * texture2D(tSrc, vUv + d * vec2(0, -1)).rgb - 1.0 * texture2D(tSrc, vUv + d * vec2(1, -1)).rgb
             + 1.0 * texture2D(tSrc, vUv + d * vec2(-1, 1)).rgb + 2.0 * texture2D(tSrc, vUv + d * vec2(0, 1)).rgb + 1.0 * texture2D(tSrc, vUv + d * vec2(1, 1)).rgb) / 4.0;
    gl_FragColor = vec4(dot(gx, gx), dot(gy, gy), dot(gx, gy), 1.0);
  }`;
const BLUR = `uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
  void main() {
    vec4 s = vec4(0.0); float n = 0.0;
    for (int i = -6; i <= 6; i++) { float w = exp(-float(i * i) / 18.0); s += w * texture2D(tSrc, vUv + uDir * float(i)); n += w; }
    gl_FragColor = s / n;
  }`;
const AKF = `uniform sampler2D tSrc, tTfm; varying vec2 vUv;
  const float RADIUS = 8.0, ALPHA = 1.0, Q = 8.0;
  void main() {
    vec2 size = vec2(${HW}.0, ${HH}.0);
    vec3 g = texture2D(tTfm, vUv).xyz;                                       // E = gx.gx, G = gy.gy, F = gx.gy
    float lambda1 = 0.5 * (g.y + g.x + sqrt(max(0.0, (g.y - g.x) * (g.y - g.x) + 4.0 * g.z * g.z)));
    float lambda2 = 0.5 * (g.y + g.x - sqrt(max(0.0, (g.y - g.x) * (g.y - g.x) + 4.0 * g.z * g.z)));
    vec2 v = vec2(lambda1 - g.x, -g.z);
    vec2 t = length(v) > 0.0 ? normalize(v) : vec2(0.0, 1.0);
    float A = (lambda1 + lambda2 > 0.0) ? (lambda1 - lambda2) / (lambda1 + lambda2) : 0.0;  // anisotropy 0..1
    float phi = -atan(t.y, t.x);
    float a = RADIUS * clamp((ALPHA + A) / ALPHA, 0.1, 2.0), b = RADIUS * clamp(ALPHA / (ALPHA + A), 0.1, 2.0);
    float cp = cos(phi), sp = sin(phi);
    mat2 SR = mat2(0.5 / a, 0.0, 0.0, 0.5 / b) * mat2(cp, -sp, sp, cp);
    int mx = int(sqrt(a * a * cp * cp + b * b * sp * sp)), my = int(sqrt(a * a * sp * sp + b * b * cp * cp));
    const float zeta = 0.33, eta = (zeta + 0.9238795) / 0.1464466;          // polynomial sector weights, 8 sectors
    vec4 m[8]; vec3 s[8];
    for (int k = 0; k < 8; k++) { m[k] = vec4(0.0); s[k] = vec3(0.0); }
    for (int j = -16; j <= 16; j++) for (int i = -16; i <= 16; i++) {
      if (abs(i) > mx || abs(j) > my) continue;
      vec2 p = SR * vec2(i, j);
      if (dot(p, p) > 0.25) continue;
      vec3 c = texture2D(tSrc, vUv + vec2(i, j) / size).rgb;
      float w[8], sum = 0.0, z, xx, yy;
      vec2 q = p * 2.0;
      xx = zeta - eta * q.x * q.x; yy = zeta - eta * q.y * q.y;
      z = max(0.0, q.y + xx); w[0] = z * z; z = max(0.0, -q.x + yy); w[2] = z * z;
      z = max(0.0, -q.y + xx); w[4] = z * z; z = max(0.0, q.x + yy); w[6] = z * z;
      q = 0.70710678 * vec2(q.x - q.y, q.x + q.y);
      xx = zeta - eta * q.x * q.x; yy = zeta - eta * q.y * q.y;
      z = max(0.0, q.y + xx); w[1] = z * z; z = max(0.0, -q.x + yy); w[3] = z * z;
      z = max(0.0, -q.y + xx); w[5] = z * z; z = max(0.0, q.x + yy); w[7] = z * z;
      for (int k = 0; k < 8; k++) sum += w[k];
      float gw = exp(-3.125 * dot(p, p)) / max(sum, 1e-6);
      for (int k = 0; k < 8; k++) { float wk = w[k] * gw; m[k] += vec4(c * wk, wk); s[k] += c * c * wk; }
    }
    vec4 o = vec4(0.0);
    for (int k = 0; k < 8; k++) {
      if (m[k].w <= 0.0) continue;
      vec3 mu = m[k].rgb / m[k].w, var = abs(s[k] / m[k].w - mu * mu);
      float w = 1.0 / (1.0 + pow(1000.0 * (var.r + var.g + var.b), 0.5 * Q));
      o += vec4(mu * w, w);
    }
    gl_FragColor = vec4(o.rgb / max(o.w, 1e-6), 1.0);
  }`;
const CANVAS = `uniform sampler2D tSrc; varying vec2 vUv;
  float lum(vec2 uv) { return dot(texture2D(tSrc, uv).rgb, vec3(0.3, 0.59, 0.11)); }
  float h12(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    vec3 c = texture2D(tSrc, vUv).rgb;
    vec2 d = 1.0 / vec2(${HW}.0, ${HH}.0);
    vec2 grad = vec2(lum(vUv + vec2(d.x, 0.0)) - lum(vUv - vec2(d.x, 0.0)), lum(vUv + vec2(0.0, d.y)) - lum(vUv - vec2(0.0, d.y)));
    vec3 n = normalize(vec3(-grad * 9.0, 1.0));                            // impasto: the paint's own relief
    float light = 0.86 + 0.32 * max(dot(n, normalize(vec3(-0.5, 0.6, 0.65))), 0.0);
    vec2 f = gl_FragCoord.xy;                                              // linen weave, fixed to the frame
    float weave = 0.5 + 0.25 * sin(f.x * 1.15) * (0.6 + 0.4 * sin(f.y * 0.21)) + 0.25 * sin(f.y * 1.15) * (0.6 + 0.4 * sin(f.x * 0.19));
    weave += 0.12 * (h12(floor(f / 2.0)) - 0.5);
    c *= light * (0.93 + 0.1 * weave);
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }`;

export default {
  name: 'Painterly',
  ko: '페인터리',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#1D1A14');
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.12;
    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 60);

    const key = new THREE.SpotLight('#FFD9A8', 260, 30, 0.55, 0.8, 2);
    key.position.set(-5, 6.5, 3.5); key.target.position.set(0, 0.6, 0);
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.radius = 6;
    const glow = new THREE.SpotLight('#E8A060', 90, 20, 0.6, 1, 2);       // a warm pool of light on the wall behind
    glow.position.set(-1.5, 5, 2); glow.target.position.set(0.6, 2.2, -3.2);
    scene.add(key, key.target, glow, glow.target, new THREE.HemisphereLight('#8090A0', '#2A2016', 0.35));
    const add = (geo, c, pos, rough = 0.6, extra = {}) => {
      const m = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ map: mottle(Math.round(pos[0] * 97 + pos[2] * 13) + 238, c, 0.3), roughness: rough, ...extra }));
      m.position.set(...pos); m.castShadow = m.receiveShadow = true; scene.add(m); return m;
    };
    // a backdrop and a table with a red cloth whose folds hang over the front edge
    add(new THREE.PlaneGeometry(30, 16), '#3A3324', [0, 4, -3.2], 0.95);
    add(new THREE.BoxGeometry(8, 0.3, 4.5), '#5A3A22', [0, -0.15, -0.6], 0.7);
    const cloth = new THREE.PlaneGeometry(3.4, 4.6, 120, 160), cp = cloth.attributes.position;
    for (let i = 0; i < cp.count; i++) {
      const x = cp.getX(i), y = cp.getY(i);                       // y runs from the back of the table, over the edge, down
      const u = (y + 2.3);                                         // 0 .. 4.6 along the cloth
      const fold = 0.06 * Math.sin(x * 4.0 + u * 1.7) + 0.03 * Math.sin(x * 9.0 - u * 2.3), hang = 0.1 * Math.sin(x * 6.0) + 0.04 * Math.sin(x * 13.0 + 1.0);
      const flat = Math.min(u, 3.85), drop = Math.max(0, u - 3.85);
      cp.setXYZ(i, x * (1 + 0.04 * drop), 0.02 + (fold + 0.09) * 0.35 - drop, -2.2 + flat + Math.min(drop, 0.3) * (hang + 0.14) / 0.3 * 0.9);
    }
    cloth.computeVertexNormals();
    add(cloth, '#8E1B22', [0.4, 0, 0], 0.8, { side: THREE.DoubleSide, sheen: 1, sheenColor: '#E05050', sheenRoughness: 0.5 });
    // the objects: a glazed jug, a wine bottle, apples, lemons, grapes
    const lathe = (pts, c, pos, rough, extra) => add(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 64), c, pos, rough, extra);
    lathe([[0, 0], [0.42, 0], [0.55, 0.25], [0.58, 0.6], [0.48, 0.95], [0.36, 1.15], [0.38, 1.35], [0.44, 1.42], [0.4, 1.44]], '#E8DCC2', [-0.95, 0, -1.1], 0.25, { clearcoat: 1 });
    lathe([[0, 0], [0.3, 0], [0.32, 0.05], [0.32, 1.25], [0.28, 1.45], [0.12, 1.65], [0.1, 2.2], [0.12, 2.25], [0.1, 2.28]], '#1F3B22', [0.55, 0, -1.55], 0.12, { clearcoat: 1, transmission: 0 });
    const r = rng(238);
    [[0.25, -0.15, '#B4231C'], [0.95, 0.15, '#C7432A'], [-0.25, 0.55, '#8F1E18']].forEach(([x, z, c]) => {
      const a = add(new THREE.SphereGeometry(0.34, 48, 32), c, [x, 0.3, z], 0.4, { clearcoat: 0.6 });
      a.scale.y = 0.88;
      add(new THREE.CylinderGeometry(0.015, 0.02, 0.18, 8), '#4A3018', [x + 0.02, 0.62, z], 0.8).rotation.z = 0.3;
    });
    [[1.55, 0.35], [1.25, 0.8]].forEach(([x, z]) => add(new THREE.SphereGeometry(0.22, 40, 24), '#E9C43A', [x, 0.2, z], 0.5).scale.set(1.35, 0.95, 1));
    for (let k = 0; k < 26; k++) {
      const b = r() * TAU, rr = 0.25 * Math.sqrt(r()), y = 0.12 + 0.32 * r();
      add(new THREE.SphereGeometry(0.09, 20, 12), '#4B2A55', [-1.1 + rr * Math.cos(b) * (1 - y * 0.6), y, 0.35 + rr * Math.sin(b)], 0.25, { clearcoat: 1 });
    }

    // passes
    const target = (w, h, type = THREE.HalfFloatType) => new THREE.WebGLRenderTarget(w, h, { type, samples: 0 });
    const rtScene = new THREE.WebGLRenderTarget(HW, HH, { type: THREE.HalfFloatType, samples: 4 });
    const rtA = target(HW, HH), rtB = target(HW, HH), rtPaint = target(HW, HH);
    const tensor = pass(TENSOR, { tSrc: { value: rtScene.texture } });
    const blur = pass(BLUR, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } });
    const akf = pass(AKF, { tSrc: { value: rtScene.texture }, tTfm: { value: rtA.texture } });
    const canvasPass = pass(CANVAS, { tSrc: { value: rtPaint.texture } });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)), post = new THREE.Scene(), flat = new THREE.Camera();
    post.add(quad);
    const run = (mat, to) => { quad.material = mat; renderer.setRenderTarget(to); renderer.render(post, flat); };
    // the scene render goes to a target, so tone map it ourselves before painting
    const tone = pass(`uniform sampler2D tSrc; varying vec2 vUv;
      void main() { gl_FragColor = vec4(ACESFilmicToneMapping(texture2D(tSrc, vUv).rgb), 1.0); }`, { tSrc: { value: null } });
    tone.onBeforeCompile = sh => { sh.fragmentShader = '#include <tonemapping_pars_fragment>\n' + sh.fragmentShader; };
    const rtTone = target(HW, HH);

    return {
      render(t) {
        const a = phase(t) * TAU;
        camera.position.set(0.9 * Math.sin(a), 3.9 + 0.12 * Math.sin(2 * a), 9.4 + 0.25 * Math.cos(a));
        camera.lookAt(-0.05, 0.75, -0.5);
        renderer.setRenderTarget(rtScene); renderer.clear(); renderer.render(scene, camera);
        tone.uniforms.tSrc.value = rtScene.texture; run(tone, rtTone);
        tensor.uniforms.tSrc.value = rtTone.texture; run(tensor, rtA);
        blur.uniforms.tSrc.value = rtA.texture; blur.uniforms.uDir.value.set(1 / HW, 0); run(blur, rtB);
        blur.uniforms.tSrc.value = rtB.texture; blur.uniforms.uDir.value.set(0, 1 / HH); run(blur, rtA);
        akf.uniforms.tSrc.value = rtTone.texture; run(akf, rtPaint);
        run(canvasPass, null);
      },
    };
  },
};
