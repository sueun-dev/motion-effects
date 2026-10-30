// Triplanar mapping: a twisted three-lobed blob has no UVs at all. The tile texture is projected along the object's
// X, Y and Z axes and the three samples are blended by |normal|^8, so it wraps with no seams or stretching. At the
// start and end of the loop each projection is shown in grey tinted by its axis (X red, Y green, Z blue).
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { TAU, phase, rng, smoothstep } from '../lib/util.js';

// a seamless 6 × 6 grid of glazed tiles with a small motif in each
function tiles() {
  const S = 1200, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), r = rng(159), cell = S / 6;
  const glaze = ['#F2E8D5', '#F2E8D5', '#E9B44C', '#1B998B', '#E4572E', '#2E4057', '#F2E8D5'];
  g.fillStyle = '#3B3340'; g.fillRect(0, 0, S, S); // grout
  for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
    const col = glaze[Math.floor(r() * glaze.length)], cx = x * cell + cell / 2, cy = y * cell + cell / 2;
    g.fillStyle = col;
    g.beginPath(); g.roundRect(x * cell + 10, y * cell + 10, cell - 20, cell - 20, 26); g.fill();
    g.fillStyle = col === '#F2E8D5' ? '#2E4057' : '#F2E8D5';
    const m = (x + y) % 3;
    g.beginPath();
    if (m === 0) g.arc(cx, cy, cell * 0.2, 0, TAU);
    else if (m === 1) { g.moveTo(cx, cy - cell * 0.26); g.lineTo(cx + cell * 0.26, cy); g.lineTo(cx, cy + cell * 0.26); g.lineTo(cx - cell * 0.26, cy); }
    else g.roundRect(cx - cell * 0.28, cy - cell * 0.08, cell * 0.56, cell * 0.16, 12);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 16;
  return tex;
}

const vertexShader = `
varying vec3 vP, vN, vWN, vWP;
void main() {
  vP = position; vN = normal;                       // object space: the texture sticks to the object
  vWN = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const fragmentShader = `
uniform sampler2D uMap; uniform float uTint, uScale;
varying vec3 vP, vN, vWN, vWP;
void main() {
  vec3 w = pow(abs(normalize(vN)), vec3(8.0)); w /= w.x + w.y + w.z;    // blend weights by axis
  vec3 tx = texture(uMap, vP.zy * uScale).rgb;                          // projected along X
  vec3 ty = texture(uMap, vP.xz * uScale).rgb;                          // along Y
  vec3 tz = texture(uMap, vP.xy * uScale).rgb;                          // along Z
  // debug view: each projection as its own grey texture tinted by its axis colour
  vec3 grey = vec3(0.2126, 0.7152, 0.0722);
  vec3 dx = vec3(0.95, 0.12, 0.14) * (0.25 + dot(tx, grey)), dy = vec3(0.12, 0.85, 0.32) * (0.25 + dot(ty, grey)), dz = vec3(0.12, 0.3, 0.95) * (0.25 + dot(tz, grey));
  vec3 albedo = mix(tx * w.x + ty * w.y + tz * w.z, dx * w.x + dy * w.y + dz * w.z, uTint);
  vec3 n = normalize(vWN), v = normalize(cameraPosition - vWP);
  vec3 l = normalize(vec3(-0.5, 0.8, 0.55)), h = normalize(l + v);
  float dif = max(dot(n, l), 0.0);
  float hemi = 0.5 + 0.5 * n.y;
  float spe = pow(max(dot(n, h), 0.0), 60.0) * 0.55;
  float fre = pow(1.0 - max(dot(n, v), 0.0), 4.0);
  vec3 col = albedo * (0.22 + 0.3 * hemi + 1.0 * dif) + vec3(1.0, 0.97, 0.9) * spe + vec3(0.55, 0.6, 0.75) * fre * 0.12;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export default {
  name: 'Triplanar Mapping',
  ko: '트라이플래너 매핑',
  three(renderer, W, H) {
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas'); bg.width = W; bg.height = H;
    const b = bg.getContext('2d');
    const grd = b.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#2B2733'); grd.addColorStop(0.62, '#4A4250'); grd.addColorStop(1, '#1E1B24');
    b.fillStyle = grd; b.fillRect(0, 0, W, H);
    const spot = b.createRadialGradient(W / 2, H * 0.5, 50, W / 2, H * 0.5, H * 0.55);
    spot.addColorStop(0, 'rgba(255, 236, 214, 0.22)'); spot.addColorStop(1, 'rgba(255, 236, 214, 0)');
    b.fillStyle = spot; b.fillRect(0, 0, W, H);
    b.save(); b.translate(W / 2, H * 0.79); b.scale(1, 0.16); // soft contact shadow under the blob
    const sh = b.createRadialGradient(0, 0, 0, 0, 0, 340);
    sh.addColorStop(0, 'rgba(8, 6, 12, 0.6)'); sh.addColorStop(1, 'rgba(8, 6, 12, 0)');
    b.fillStyle = sh; b.beginPath(); b.arc(0, 0, 340, 0, TAU); b.fill(); b.restore();
    scene.background = new THREE.CanvasTexture(bg); scene.background.colorSpace = THREE.SRGBColorSpace;

    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
    camera.position.set(0, 0.6, 13);
    camera.lookAt(0, 0, 0);

    // a sphere pushed into three lobes that twist up its height, then smooth normals
    const geo = mergeVertices(new THREE.IcosahedronGeometry(1, 90).deleteAttribute('normal').deleteAttribute('uv'));
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const lobes = 1 + 0.3 * Math.cos(3 * Math.atan2(z, x) + 2.4 * y);
      p.setXYZ(i, 1.25 * x * lobes, 1.95 * y, 1.25 * z * lobes);
    }
    geo.computeVertexNormals();
    const mat = new THREE.ShaderMaterial({ uniforms: { uMap: { value: tiles() }, uTint: { value: 1 }, uScale: { value: 0.3 } }, vertexShader, fragmentShader });
    const blob = new THREE.Mesh(geo, mat);
    scene.add(blob);

    return {
      scene, camera,
      update(t) {
        const a = phase(t) * TAU;
        blob.rotation.set(0.2 + 0.14 * Math.sin(a), 0.42 * Math.sin(a), 0.1 * Math.cos(a)); // a slow sway and wobble
        blob.position.y = 0.08 * Math.sin(2 * a);
        // tinted projections at 0 s, plain seamless texture 1.6–3.4 s, tinted again at 5 s
        mat.uniforms.uTint.value = 1 - smoothstep(0.6, 1.6, t) + smoothstep(3.4, 4.4, t);
      },
    };
  },
};
