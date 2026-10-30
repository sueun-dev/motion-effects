// Displacement mapping: a dense geodesic sphere (146,412 vertices) carries a greyscale height map (3D fractal noise with ridged
// peaks). Each vertex is pushed out along its normal by height × amount, normals are recomputed, and the painted grey
// map turns into a real planet whose mountains break the silhouette and cast shadows, then it sinks back to a ball.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { TAU, phase, rng, fbm3, noise3, smoothstep, lerp } from '../lib/util.js';

const R = 1.55, LIFT = 0.36, SEA = 0.46;

// height 0..1 at a point on the unit sphere: rolling continents plus ridged mountain chains
function height(x, y, z) {
  const c = fbm3(x * 1.2 + 4.1, y * 1.2, z * 1.2 - 2.7, 4);
  const ridge = 1 - Math.abs(noise3(x * 2.6, y * 2.6 + 8.3, z * 2.6));
  return Math.min(1, Math.max(0, 0.5 + 1.1 * c + 0.55 * ridge * ridge * Math.max(0, c + 0.04)));
}

// terrain colour for a height (sea, sand, grass, rock, snow)
const STOPS = [[0, '#0B2259'], [SEA - 0.02, '#2C78C2'], [SEA, '#E6D49C'], [SEA + 0.03, '#6BA552'], [0.66, '#3E6D35'], [0.76, '#80654A'], [0.86, '#B7AEA2'], [0.93, '#F4F6FA']]
  .map(([h, c]) => [h, new THREE.Color(c)]);
function terrain(h, out) {
  for (let i = 1; i < STOPS.length; i++) {
    if (h <= STOPS[i][0] || i === STOPS.length - 1) {
      const [h0, c0] = STOPS[i - 1], [h1, c1] = STOPS[i];
      return out.copy(c0).lerp(c1, Math.min(1, Math.max(0, (h - h0) / (h1 - h0))));
    }
  }
  return out;
}

export default {
  name: 'Displacement Mapping',
  ko: '디스플레이스먼트 매핑',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();

    // deep-space backdrop with fixed stars
    const bg = document.createElement('canvas'); bg.width = W; bg.height = H;
    const b = bg.getContext('2d'), r = rng(158);
    const sky = b.createRadialGradient(W * 0.5, H * 0.52, 80, W * 0.5, H * 0.52, H * 0.75);
    sky.addColorStop(0, '#1C2457'); sky.addColorStop(0.5, '#0D1030'); sky.addColorStop(1, '#05060F');
    b.fillStyle = sky; b.fillRect(0, 0, W, H);
    for (let i = 0; i < 420; i++) {
      b.fillStyle = `rgba(220, 230, 255, ${0.25 + 0.6 * r() ** 2})`;
      b.beginPath(); b.arc(r() * W, r() * H, 0.8 + 1.6 * r() ** 3, 0, TAU); b.fill();
    }
    scene.background = new THREE.CanvasTexture(bg); scene.background.colorSpace = THREE.SRGBColorSpace;

    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
    camera.position.set(0, 0.4, 13.6);
    camera.lookAt(0, 0.05, 0);

    scene.add(new THREE.HemisphereLight('#A9C2FF', '#2A1E3A', 1.0));
    const sun = new THREE.DirectionalLight('#FFE7C4', 3.0);
    sun.position.set(-6, 4, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    Object.assign(sun.shadow.camera, { left: -2.4, right: 2.4, top: 2.4, bottom: -2.4, near: 1, far: 20 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.012; sun.shadow.radius = 3;
    scene.add(sun);
    const rim = new THREE.DirectionalLight('#6FD3FF', 2.6);
    rim.position.set(6, 1.5, -5);
    scene.add(rim);

    // geodesic sphere, merged so neighbouring triangles share vertices (smooth recomputed normals, no seam)
    const geo = mergeVertices(new THREE.IcosahedronGeometry(1, 120).deleteAttribute('normal').deleteAttribute('uv'));
    const base = geo.attributes.position.array.slice(), n = base.length / 3;
    const hts = new Float32Array(n), grey = new Float32Array(n * 3), land = new Float32Array(n * 3), c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2];
      const h = height(x, y, z);
      hts[i] = Math.max(h, SEA);                   // the sea stays a flat level surface
      const g = 0.03 + 0.92 * smoothstep(0.22, 0.88, h); // the height map itself, painted on the ball
      grey.set([g, g, g], i * 3);
      terrain(h, c); land.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const ball = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 }));
    ball.castShadow = ball.receiveShadow = true;
    const tilt = new THREE.Group();
    tilt.rotation.set(0.32, 0, -0.18);
    tilt.add(ball);
    scene.add(tilt);

    // atmosphere: the back faces of a bigger shell glow just outside the silhouette (a halo behind the planet)
    const air = new THREE.Mesh(new THREE.SphereGeometry(R * 1.18, 96, 48), new THREE.ShaderMaterial({
      side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uA: { value: 0 } },
      vertexShader: 'varying vec3 vN, vV; void main() { vec4 p = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-p.xyz); gl_Position = projectionMatrix * p; }',
      fragmentShader: 'uniform float uA; varying vec3 vN, vV; void main() { float f = pow(clamp(-dot(vN, vV) / 0.53, 0.0, 1.0), 4.0); gl_FragColor = vec4(vec3(0.3, 0.6, 1.0) * f * uA, 1.0); }',
    }));
    scene.add(air);

    const pos = geo.attributes.position.array, col = geo.attributes.color.array;
    return {
      scene, camera,
      update(t) {
        const a = phase(t) * TAU;
        const amt = smoothstep(0.08, 0.92, 0.5 - 0.5 * Math.cos(a)); // 0 at 0 s and 5 s, full at 2.5 s
        for (let i = 0; i < n; i++) {
          const s = R * (1 + LIFT * amt * (hts[i] - SEA));            // vertex pushed out along its normal
          pos[i * 3] = base[i * 3] * s; pos[i * 3 + 1] = base[i * 3 + 1] * s; pos[i * 3 + 2] = base[i * 3 + 2] * s;
        }
        const k = smoothstep(0.1, 0.75, amt);
        for (let i = 0; i < n * 3; i++) col[i] = lerp(grey[i], land[i], k);
        geo.attributes.position.needsUpdate = true;
        geo.attributes.color.needsUpdate = true;
        geo.computeVertexNormals();
        geo.computeBoundingSphere();
        ball.rotation.y = 2.4 + 0.32 * Math.sin(a);                        // a slow sway, so the rising peaks stay in view
        air.material.uniforms.uA.value = 0.45 + 0.55 * k;
      },
    };
  },
};
