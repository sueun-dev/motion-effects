// Particle morph: 5,000 GPU points, each with a spot on a sphere, a cube and a torus taken from the same direction
// (so neighbours stay neighbours); the cloud eases sphere -> cube -> torus -> sphere. The points come in four copies
// 90 degrees apart, so a quarter turn in 5 s lands exactly on the start (slow spin, seamless loop).
import * as THREE from 'three';
import { TAU, phase, span, rng } from '../lib/util.js';

const N = 5000, SEG = 5 / 3, SUB = 6; // SUB copies of each point along its last four frames = motion blur
const sine = k => 0.5 - 0.5 * Math.cos(Math.PI * k);

export default {
  name: 'Particle Morph',
  ko: '파티클 모핑',
  three(renderer, W, H) {
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas'); bg.width = 4; bg.height = 256;
    const g = bg.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#0B0A2A'); grd.addColorStop(0.5, '#1B0F3F'); grd.addColorStop(1, '#05040F');
    g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
    scene.background = new THREE.CanvasTexture(bg);
    scene.background.colorSpace = THREE.SRGBColorSpace;
    const camera = new THREE.PerspectiveCamera(36, W / H, 0.1, 100);
    camera.position.set(0, 0, 9.5);

    const shapes = [new Float32Array(N * 3), new Float32Array(N * 3), new Float32Array(N * 3)];
    const col = new Float32Array(N * 3), dir = [];
    const c1 = new THREE.Color('#3EE6FF'), c2 = new THREE.Color('#FF4FD8'), c = new THREE.Color();
    const r = rng(77);
    let y = 0, rad = 0, th = 0;
    for (let i = 0; i < N; i++) {
      if (i % 4 === 0) { y = 2 * r() - 1; rad = Math.sqrt(1 - y * y); th = r() * TAU; } // a random direction ...
      const q = th + (i % 4) * Math.PI / 2; // ... and its three quarter-turn copies
      const d = [Math.cos(q) * rad, y, Math.sin(q) * rad];
      dir.push(d);
      const m = Math.max(...d.map(Math.abs));
      const u = Math.atan2(d[2], d[0]), v = Math.PI * (2 - y), R = 1.1 + 0.42 * Math.cos(v);
      const pts = [d.map(k => k * 1.45), d.map(k => k / m * 1.1), [R * Math.cos(u), 0.42 * Math.sin(v), R * Math.sin(u)]];
      pts.forEach((p, s) => shapes[s].set(p, i * 3));
      c.copy(c1).lerp(c2, 0.5 + 0.5 * y).toArray(col, i * 3);
    }
    const geo = new THREE.BufferGeometry();
    const cols = new Float32Array(N * 3 * SUB);
    for (let k = 0; k < SUB; k++) cols.set(col.map(v => v / SUB * 1.6), k * N * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3 * SUB), 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(cols, 3));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec3 aColor; varying vec3 vColor;
        void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vColor = aColor * (0.22 + 0.78 * smoothstep(-11.0, -8.2, mv.z)); // the far side is dim, the near side bright
          gl_PointSize = 15.0 * 9.5 / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vColor;
        void main() { float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vColor * smoothstep(0.5, 0.05, d) * 0.85, 1.0); }`,
    });
    const points = new THREE.Points(geo, mat);
    scene.add(points);
    const pos = geo.attributes.position.array;

    return {
      scene, camera,
      update(t) {
        for (let sub = 0; sub < SUB; sub++) {
          const ts = t - sub / SUB * 4 / 30, tw = (ts + 5) % 5;
          const seg = Math.min(2, Math.floor(tw / SEG)), local = tw - seg * SEG;
          const A = shapes[seg], B = shapes[(seg + 1) % 3];
          const ay = phase(ts) * Math.PI / 2, ax = 0.45 + 0.12 * Math.sin(phase(ts) * TAU); // spin + tilt, done here per sample
          const cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
          for (let i = 0; i < N; i++) {
            const d = dir[i], k = sine(span(local, 0.2 + 0.32 * (d[1] + 1) / 2, 1.3 + 0.32 * (d[1] + 1) / 2));
            const bulge = Math.sin(Math.PI * k) * 0.25; // puff outwards mid-morph
            const p = [0, 1, 2].map(j => A[i * 3 + j] + (B[i * 3 + j] - A[i * 3 + j]) * k + d[j] * bulge);
            const x = p[0] * cy + p[2] * sy, z = -p[0] * sy + p[2] * cy;
            pos.set([x, p[1] * cx - z * sx, p[1] * sx + z * cx], (sub * N + i) * 3);
          }
        }
        geo.attributes.position.needsUpdate = true;
      },
    };
  },
};
