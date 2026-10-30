// Voronoi fracture: 40 seed points inside a ball split it into convex cells. Each cell starts as a cube, is cut by
// the bisecting plane between its seed and every other seed, then by the 5120 face planes of a geodesic sphere, which make the ball's round skin.
// Cut faces get a hot glowing material, skin faces a glossy dark one. The ball bursts apart, the chunks tumble
// and drift, then fly back together into a whole ball (A -> B -> A). An eight-sample shutter blurs the fast moves.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TAU, phase, ease, span, rng } from '../lib/util.js';

const CELLS = 40, RADIUS = 1.6;

// clip a convex polyhedron (faces: { pts: Vector3[], inner }) to the half-space n.p <= d; the cut gets a new face
function clip(faces, n, d, inner) {
  const out = [], cut = [];
  for (const f of faces) {
    const res = [];
    f.pts.forEach((a, i) => {
      const b = f.pts[(i + 1) % f.pts.length], da = n.dot(a) - d, db = n.dot(b) - d;
      if (da <= 0) res.push(a);
      if (Math.abs(da) < 1e-9) cut.push(a); // a corner lying on the plane belongs to the cut too
      if (da * db < 0) { const p = a.clone().lerp(b, da / (da - db)); res.push(p); cut.push(p); }
    });
    if (res.length >= 3) out.push({ pts: res, inner: f.inner });
  }
  if (cut.length >= 3) { // order the cut points around their centre so the new face is a proper polygon
    const c = cut.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(cut.length);
    const u = new THREE.Vector3().subVectors(cut[0], c).normalize(), v = new THREE.Vector3().crossVectors(n, u);
    const angle = p => Math.atan2(v.dot(p.clone().sub(c)), u.dot(p.clone().sub(c)));
    const pts = cut.filter((p, i) => cut.findIndex(q => q.distanceToSquared(p) < 1e-10) === i).sort((p, q) => angle(p) - angle(q));
    if (pts.length >= 3) out.push({ pts, inner });
  }
  return out;
}

function cube(s) {
  const v = (x, y, z) => new THREE.Vector3(x * s, y * s, z * s);
  return [ // counter-clockwise seen from outside
    [v(1, -1, -1), v(1, 1, -1), v(1, 1, 1), v(1, -1, 1)], [v(-1, -1, -1), v(-1, -1, 1), v(-1, 1, 1), v(-1, 1, -1)],
    [v(-1, 1, -1), v(-1, 1, 1), v(1, 1, 1), v(1, 1, -1)], [v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1)],
    [v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1)], [v(-1, -1, -1), v(-1, 1, -1), v(1, 1, -1), v(1, -1, -1)],
  ].map(pts => ({ pts, inner: false }));
}

// one geometry per cell, centred on its centroid; groups 0 = skin, 1 = cut faces
function fracture() {
  const r = rng(189), seeds = [];
  while (seeds.length < CELLS) {
    const p = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
    if (p.length() < 1) seeds.push(p.multiplyScalar(RADIUS * 0.95));
  }
  const skin = new THREE.IcosahedronGeometry(1, 15).attributes.position, planes = [];
  for (let i = 0; i < skin.count; i += 3) { // the 5120 face normals of a geodesic sphere
    const n = new THREE.Vector3().fromBufferAttribute(skin, i).add(new THREE.Vector3().fromBufferAttribute(skin, i + 1))
      .add(new THREE.Vector3().fromBufferAttribute(skin, i + 2)).normalize();
    planes.push(n);
  }
  return seeds.map((s, i) => {
    let faces = cube(RADIUS * 1.1);
    seeds.forEach((o, j) => {
      if (i === j) return;
      const n = o.clone().sub(s).normalize();
      faces = clip(faces, n, n.dot(s.clone().add(o).multiplyScalar(0.5)), true);
    });
    for (const n of planes) {
      if (faces.some(f => f.pts.some(p => n.dot(p) > RADIUS))) faces = clip(faces, n, RADIUS, false);
    }
    const centre = new THREE.Vector3(), all = faces.flatMap(f => f.pts);
    all.forEach(p => centre.add(p));
    centre.divideScalar(all.length);
    const pos = [], nrm = [], geo = new THREE.BufferGeometry();
    for (const inner of [false, true]) {
      const start = pos.length / 3;
      for (const f of faces.filter(f => f.inner === inner)) {
        const fn = new THREE.Vector3().crossVectors(f.pts[1].clone().sub(f.pts[0]), f.pts[2].clone().sub(f.pts[0])).normalize();
        for (let k = 1; k < f.pts.length - 1; k++) {
          for (const p of [f.pts[0], f.pts[k], f.pts[k + 1]]) {
            pos.push(p.x - centre.x, p.y - centre.y, p.z - centre.z);
            const n = inner ? fn : p.clone().normalize(); // the skin is shaded as a smooth ball
            nrm.push(n.x, n.y, n.z);
          }
        }
      }
      geo.addGroup(start, pos.length / 3 - start, inner ? 1 : 0);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    return { geo, centre };
  });
}

export default {
  name: 'Voronoi Fracture',
  ko: '보로노이 파쇄',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas');
    bg.width = 4; bg.height = 512;
    const g = bg.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#0A0C1A'); grd.addColorStop(0.55, '#1A1530'); grd.addColorStop(1, '#2A1622');
    g.fillStyle = grd; g.fillRect(0, 0, 4, 512);
    scene.background = new THREE.CanvasTexture(bg);
    scene.background.colorSpace = THREE.SRGBColorSpace;
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.6;
    const key = new THREE.DirectionalLight('#FFFFFF', 2.0);
    key.position.set(-3, 5, 4);
    const rim = new THREE.DirectionalLight('#7FA8FF', 1.6);
    rim.position.set(4, 1, -3);
    scene.add(key, rim);

    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
    camera.position.set(0, 0.6, 16);
    camera.lookAt(0, -0.1, 0);

    const shell = new THREE.MeshPhysicalMaterial({ color: '#1C2A4A', roughness: 0.22, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 });
    const core = new THREE.MeshStandardMaterial({ color: '#F7A04F', emissive: '#FF5A1F', emissiveIntensity: 0.22, roughness: 0.6 });
    const group = new THREE.Group();
    scene.add(group);
    const r = rng(42);
    const chunks = fracture().map(({ geo, centre }) => {
      const mesh = new THREE.Mesh(geo, [shell, core]);
      group.add(mesh);
      const dir = centre.clone().normalize().add(new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.5)).normalize().multiply(new THREE.Vector3(0.75, 1.5, 0.75)); // spread taller than wide, to fit the frame
      const axis = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
      return { mesh, centre, dir, axis, dist: 0.6 + r() * 0.7, spin: (r() - 0.5) * 3.2, drift: r() * TAU };
    });

    const q = new THREE.Quaternion();
    const pose = t => {
      const a = phase(t) * TAU;
      group.rotation.y = 0.6 * Math.sin(a); // a slow swing
      group.rotation.x = 0.25;
      // local time u starts with the whole ball (at 2.5 s), so the loop point falls while the pieces drift:
      // u 0-0.3 whole, 0.3-2.2 break apart, drift, 2.7-4.6 fly back together, whole again from 4.6
      const u = (((t + 2.5) % 5) + 5) % 5;
      const out = ease.inOut(span(u, 0.3, 2.2)) * (1 - ease.inOut(span(u, 2.7, 4.6)));
      const tumble = span(u, 0.3, 4.6), bob = Math.sin(Math.PI * tumble);
      for (const c of chunks) {
        const d = c.dist * out + 0.1 * bob * Math.sin(a + c.drift);
        c.mesh.position.copy(c.centre).addScaledVector(c.dir, d);
        c.mesh.quaternion.copy(q.setFromAxisAngle(c.axis, c.spin * bob * out));
      }
    };

    // film shutter: average SUB linear renders spread over one frame (1/30 s), then tone map
    const SUB = 8, targets = Array.from({ length: SUB }, () => new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType }));
    const blendScene = new THREE.Scene(), blendCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    blendScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: { uT: { value: targets.map(rt => rt.texture) } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D uT[${SUB}]; varying vec2 vUv;
void main() {
  vec4 c = vec4(0.0); ${targets.map((_, i) => `c += texture2D(uT[${i}], vUv);`).join(' ')}
  gl_FragColor = c / ${SUB}.0;
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
    })));
    return {
      render(t) {
        targets.forEach((rt, i) => {
          pose(t + ((i + 0.5) / SUB - 0.5) / 30);
          renderer.setRenderTarget(rt);
          renderer.render(scene, camera);
        });
        renderer.setRenderTarget(null);
        renderer.render(blendScene, blendCam);
      },
    };
  },
};
