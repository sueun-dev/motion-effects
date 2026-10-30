// Camera rail: a point-of-view ride on a roller coaster over a sunset lagoon. The track is one closed Catmull-Rom spline
// over three hills; the camera rides a frame along it, banked by the turn rate and looking 10 m ahead, at a speed set
// by height like a real coaster (slow over the crests, fast in the dips), and laps the whole circuit once per loop.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TAU, rng } from '../lib/util.js';

// control points of the closed spline: a slightly squashed circle over three rolling hills
const PTS = Array.from({ length: 18 }, (_, i) => {
  const a = i / 18 * TAU, r = 27 + 3 * Math.cos(2 * a);
  return [r * Math.cos(a), 7 + 2.2 * Math.sin(3 * a) + 0.8 * Math.sin(a), r * Math.sin(a)];
});
const M = 4000; // samples along the track

const SKY = {
  vertexShader: 'varying vec3 vD; void main() { vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `varying vec3 vD;
    void main() {
      float y = max(vD.y, 0.0);
      vec3 c = mix(vec3(1.0, 0.7, 0.45), vec3(0.93, 0.55, 0.55), smoothstep(0.0, 0.12, y));
      c = mix(c, vec3(0.3, 0.32, 0.62), smoothstep(0.1, 0.6, y));
      float d = max(dot(vD, normalize(vec3(-0.75, 0.07, -0.66))), 0.0);   // the low sun
      c += vec3(1.0, 0.7, 0.4) * (pow(d, 600.0) * 1.2 + pow(d, 24.0) * 0.4);
      gl_FragColor = vec4(c, 1.0);
    }`,
};

export default {
  name: 'Camera Rail',
  ko: '카메라 레일',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#F2B48C', 80, 520);
    const camera = new THREE.PerspectiveCamera(100, W / H, 0.1, 1200);

    // --- the track: arc-length samples of the spline, smoothed (a running mean, twice) so curvature has no kinks at
    // the knots; "up" is world up tilted into the turns by the smoothed turn rate
    const curve = new THREE.CatmullRomCurve3(PTS.map(p => new THREE.Vector3(...p)), true, 'centripetal');
    let P = curve.getSpacedPoints(M).slice(0, M);
    const mean = (arr, k) => arr.map((_, i) => {
      const v = new THREE.Vector3();
      for (let j = -k; j <= k; j++) v.add(arr[(i + j + M) % M]);
      return v.divideScalar(2 * k + 1);
    });
    P = mean(mean(P, 60), 60);
    const T = P.map((_, i) => P[(i + 1) % M].clone().sub(P[(i - 1 + M) % M]).normalize());
    const seg = P.map((p, i) => p.distanceTo(P[(i + 1) % M])), ds = seg.reduce((a, b) => a + b) / M;
    const yaw = T.map((t, i) => { const n = T[(i + 1) % M]; return (t.z * n.x - t.x * n.z) / ds; });
    const up = new THREE.Vector3(0, 1, 0), U = T.map((t, i) => {
      let s = 0;
      for (let k = -150; k <= 150; k++) s += yaw[(i + k + M) % M];
      return up.clone().projectOnPlane(t).normalize().applyAxisAngle(t, THREE.MathUtils.clamp(-s / 301 * 5, -0.5, 0.5));
    });
    const B = T.map((t, i) => new THREE.Vector3().crossVectors(t, U[i]).normalize());

    // speed from height (slow over the crests, fast in the dips), integrated so one lap takes exactly 5 s
    const top = Math.max(...P.map(p => p.y)), time = [0];
    for (let i = 0; i < M; i++) time.push(time[i] + seg[i] / Math.sqrt(64 + 2 * 9.8 * (top - P[i].y)));
    const lap = time[M];
    const at = t => {                                                     // t (s) -> arc-length sample (fractional)
      const want = (((t / 5) % 1 + 1) % 1) * lap;
      let lo = 0, hi = M;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (time[mid] <= want) lo = mid; else hi = mid; }
      return lo + (want - time[lo]) / (time[lo + 1] - time[lo]);
    };
    const sample = (arr, f) => { const i = Math.floor(f), k = f - i; return arr[((i % M) + M) % M].clone().lerp(arr[(((i + 1) % M) + M) % M], k); };

    // rails, spine and white columns down into the water
    const tube = (off, r, color, segs) => {
      const pts = [];
      for (let i = 0; i < M; i += 4) pts.push(P[i].clone().addScaledVector(B[i], off[0]).addScaledVector(U[i], off[1]));
      return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), M, r, segs, true), new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
    };
    scene.add(tube([-0.62, 0], 0.13, '#E8443A', 8), tube([0.62, 0], 0.13, '#E8443A', 8), tube([0, -0.42], 0.28, '#F2B33D', 12));
    const m4 = new THREE.Matrix4(), one = new THREE.Quaternion(), posts = [];
    for (let i = 0; i < M; i += Math.round(M / 9)) posts.push(i);
    const columns = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.6, 1, 16), new THREE.MeshStandardMaterial({ color: '#F6F1E7', roughness: 0.6 }), posts.length);
    posts.forEach((i, k) => {
      const tip = P[i].clone().addScaledVector(U[i], -0.6), h = tip.y + 1;
      columns.setMatrixAt(k, m4.compose(new THREE.Vector3(tip.x, tip.y - h / 2, tip.z), one, new THREE.Vector3(1, h, 1)));
    });
    scene.add(columns);

    // --- scenery: a sunset sky, a mirror-calm lagoon that reflects it, round islands with round trees, balloons
    // (big soft shapes only, so nothing thin flickers as the view sweeps round)
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), new THREE.ShaderMaterial({ ...SKY, side: THREE.BackSide, depthWrite: false, fog: false }));
    scene.add(sky);
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 48, 24), new THREE.ShaderMaterial({ ...SKY, side: THREE.BackSide })));
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(envScene, 0).texture;
    scene.add(new THREE.HemisphereLight('#FFD8C0', '#3A5878', 1.1));
    const sun = new THREE.DirectionalLight('#FFC690', 2.6);
    sun.position.set(-75, 7, -66);
    scene.add(sun);

    const water = new THREE.Mesh(new THREE.CircleGeometry(1100, 96), new THREE.MeshStandardMaterial({ color: '#7FA6D6', metalness: 1, roughness: 0.14 }));
    water.rotation.x = -Math.PI / 2;
    scene.add(water);

    const r = rng(230), col = new THREE.Color();
    const grass = new THREE.MeshLambertMaterial({ color: '#86A86C' });
    const dome = new THREE.SphereGeometry(1, 48, 24, 0, TAU, 0, Math.PI / 2);
    const trees = [];
    [[0, 0, 14, 7], [-75, -45, 30, 16], [80, -55, 26, 14], [-45, 85, 28, 15], [95, 60, 32, 17]].forEach(([x, z, rad, h]) => {
      const hill = new THREE.Mesh(dome, grass);
      hill.position.set(x, -0.4, z); hill.scale.set(rad, h, rad);
      scene.add(hill);
      for (let k = 0; k < rad / 7; k++) {                              // round trees on the top of the island
        const a = r() * TAU, d = Math.sqrt(r()) * rad * 0.7, tx = x + d * Math.cos(a), tz = z + d * Math.sin(a);
        const ty = h * Math.sqrt(Math.max(0, 1 - (d / rad) ** 2)) - 0.4;
        trees.push([tx, ty, tz, 5 + 3 * r(), r()]);
      }
    });
    const canopy = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshLambertMaterial({ color: '#FFFFFF' }), trees.length);
    trees.forEach(([x, y, z, s, c], k) => {
      canopy.setMatrixAt(k, m4.compose(new THREE.Vector3(x, y + 0.7 * s, z), one, new THREE.Vector3(s, 0.9 * s, s)));
      canopy.setColorAt(k, col.setHSL(c < 0.25 ? 0.07 : 0.27 + 0.05 * c, 0.45, c < 0.25 ? 0.55 : 0.36 + 0.08 * c));
    });
    scene.add(canopy);
    [[-60, 46, -110, '#E8443A'], [120, 55, -60, '#F2B33D'], [-20, 64, 140, '#6F8CFF']].forEach(([x, y, z, c]) => {
      const b = new THREE.Group();
      const env = new THREE.Mesh(new THREE.SphereGeometry(6, 32, 20), new THREE.MeshLambertMaterial({ color: c }));
      env.scale.y = 1.2;
      const basket = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.9, 1.8, 12), new THREE.MeshLambertMaterial({ color: '#7A5234' }));
      basket.position.y = -9.5;
      b.add(env, basket); b.position.set(x, y, z);
      scene.add(b);
    });

    // the front of our car, fixed to the camera along the bottom edge: a red hood with a yellow trim
    const car = new THREE.Group();
    const hood = new THREE.Mesh(new RoundedBoxGeometry(1.7, 0.5, 1.6, 6, 0.24), new THREE.MeshStandardMaterial({ color: '#C8282E', roughness: 0.3 }));
    hood.position.set(0, -1.32, -1.0);
    const trim = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 1.3, 6, 16).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#FFC83D', roughness: 0.5 }));
    trim.position.set(0, -1.08, -1.72);
    car.add(hood, trim);
    camera.add(car);
    scene.add(camera);

    const look = new THREE.Vector3(), place = t => {
      const f = at(t), g = f + 10 / ds;
      camera.position.copy(sample(P, f)).addScaledVector(sample(U, f).normalize(), 1.35);
      camera.up.copy(sample(U, f + 1.5 / ds)).normalize();
      look.copy(sample(P, g)).addScaledVector(sample(U, g).normalize(), 1.1);
      camera.lookAt(look);
      sky.position.copy(camera.position);
    };

    // a 360-degree shutter: 12 renders over the whole frame, summed in a float buffer, then tone mapped once
    const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
    const acc = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: rt.texture, transparent: true, opacity: 1 / 12, blending: THREE.AdditiveBlending, depthTest: false }));
    const out = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: acc.texture, depthTest: false }));
    const post = new THREE.Scene(), final = new THREE.Scene(), flat = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    post.add(quad); final.add(out);
    renderer.autoClear = false;
    return {
      render(t) {
        renderer.setRenderTarget(acc); renderer.clear();
        for (let k = 0; k < 12; k++) {
          place(t + (k / 11 - 0.5) / 30);
          renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, camera);
          renderer.setRenderTarget(acc); renderer.render(post, flat);
        }
        renderer.setRenderTarget(null); renderer.clear(); renderer.render(final, flat);
      },
    };
  },
};
