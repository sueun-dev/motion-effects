// Impossible object: a real 3D Penrose triangle. Three square beams run along x, then y, then z, so the path is open:
// its two ends lie 4 m apart on one line through the camera. Seen along that line with an orthographic camera they
// overlap exactly and the tribar closes. The near end is notched (two cuts parallel to the line of sight, so they are
// edge-on in that view) wherever the far beam should pass in front of it, so the false corner looks like the other two.
// Each face is painted flat by its direction, like the classic drawing. The camera orbits off the line and the gap opens.
import * as THREE from 'three';
import { TAU, FONT, ease, span } from '../lib/util.js';

const L = 4, S = 1;                                        // corner-to-corner beam length, beam width
const YAW = 0.9, PITCH = -0.3;                           // how far the camera swings off the magic view (rad)
// 0 on the magic line, 1 off it: hold 0.15-1.9 s, swing out, hold 3.0-4.12 s, swing back across the loop point
const off = t => ease.inOut(span(t, 1.9, 3.0)) - ease.inOut(span(t, 4.12, 5.15)) + 1 - ease.inOut(span(t, -0.88, 0.15));
const state = { cam: null, ends: [] };

const frag = `
varying vec3 vN; uniform float uOff;
void main() {
  vec3 n = normalize(vN), q = n * n;
  if (uOff == 0.0 && max(q.x, max(q.y, q.z)) < 0.9) discard; // the cuts are edge-on on the magic line: draw no sliver
  vec3 col = vec3(0.97, 0.93, 0.85) * q.x + vec3(0.91, 0.45, 0.33) * q.y + vec3(0.16, 0.37, 0.46) * q.z;
  float axis = smoothstep(0.86, 0.96, max(q.x, max(q.y, q.z)));
  col = mix(vec3(0.50, 0.22, 0.24), col, axis);            // the notch cuts get their own darker tone
  col = pow(col, vec3(2.2));                               // the tones above are sRGB
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

// The near z-beam, in coordinates (a, b, c) round its end P3: the box a, b in [-S/2, S/2], c in [S/2 - L, S/2] minus
// the notch {a > b and c > b - S}. One closed mesh from eight flat faces, every edge shared whole (no T-junctions,
// so no pinhole cracks); faces 7 and 8 are the two cuts, both parallel to the line of sight (1, 1, 1).
function nearBeam(mat) {
  const h = S / 2, c0 = h - L - 0.02, d = -h - S, e = h - S, v = (a, b, c) => [a, b, c];
  const faces = [                                          // [outward normal, polygon fanned from its first corner]
    [[-1, 0, 0], [v(-h, h, h), v(-h, h, c0), v(-h, -h, c0), v(-h, -h, d), v(-h, -h, h)]],
    [[0, 1, 0], [v(-h, h, h), v(-h, h, c0), v(h, h, c0), v(h, h, e), v(h, h, h)]],
    [[1, 0, 0], [v(h, -h, c0), v(h, h, c0), v(h, h, e), v(h, -h, d)]],
    [[0, -1, 0], [v(-h, -h, c0), v(h, -h, c0), v(h, -h, d), v(-h, -h, d)]],
    [[0, 0, -1], [v(-h, -h, c0), v(-h, h, c0), v(h, h, c0), v(h, -h, c0)]],
    [[0, 0, 1], [v(-h, -h, h), v(h, h, h), v(-h, h, h)]],
    [[1, -1, 0], [v(-h, -h, d), v(h, h, e), v(h, h, h), v(-h, -h, h)]],
    [[0, -1, 1], [v(-h, -h, d), v(h, -h, d), v(h, h, e)]],
  ];
  const pos = [], nor = [];
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), n = new THREE.Vector3();
  for (const [nv, poly] of faces) {
    n.set(...nv).normalize();
    for (let i = 1; i < poly.length - 1; i++) {
      A.set(...poly[0]); B.set(...poly[i]); C.set(...poly[i + 1]);
      const g = B.clone().sub(A).cross(C.clone().sub(A));
      if (g.length() < 1e-9) continue;
      const tri = g.dot(n) > 0 ? [A, B, C] : [A, C, B];   // wind every triangle to face outward
      for (const p of tri) { pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  const m = new THREE.Mesh(geo, mat);
  m.position.set(L, L, L);
  return m;
}

export default {
  name: 'Impossible Object',
  ko: '불가능한 도형',
  three(renderer, W, H) {
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas');
    bg.width = 540; bg.height = 960;
    const g = bg.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 960);
    grd.addColorStop(0, '#1A2238'); grd.addColorStop(0.55, '#2C3552'); grd.addColorStop(1, '#141A2C');
    g.fillStyle = grd; g.fillRect(0, 0, 540, 960);
    const glow = g.createRadialGradient(270, 470, 20, 270, 470, 380);
    glow.addColorStop(0, 'rgba(255, 214, 170, 0.28)'); glow.addColorStop(1, 'rgba(255, 214, 170, 0)');
    g.fillStyle = glow; g.fillRect(0, 0, 540, 960);
    scene.background = new THREE.CanvasTexture(bg);
    scene.background.colorSpace = THREE.SRGBColorSpace;

    const mat = new THREE.ShaderMaterial({
      uniforms: { uOff: { value: 0 } },
      vertexShader: 'varying vec3 vN; void main() { vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: frag,
    });
    // the object, in its own axes: x-beam P0 -> P1, y-beam P1 -> P2, z-beam P2 -> P3 = P0 + L(1,1,1)
    const obj = new THREE.Group();
    const box = (sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat); m.position.set(x, y, z); obj.add(m); };
    box(L + S, S, S, L / 2, 0, 0);                         // x-beam with both its corner blocks
    box(S, L + 0.02, S, L, L / 2 + S / 2 - 0.01, 0);       // y-beam with the corner block at P2 (dips 0.02 into the x-beam)
    obj.add(nearBeam(mat));
    // turn the object so that its line of sight (1,1,1) points at the camera (+z) and the x-beam lies level
    const Q = new THREE.Matrix4().set(
      2 / Math.sqrt(6), -1 / Math.sqrt(6), -1 / Math.sqrt(6), 0,
      0, 1 / Math.SQRT2, -1 / Math.SQRT2, 0,
      1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3), 0,
      0, 0, 0, 1);
    const center = new THREE.Vector3(10 / 3, 2, 2 / 3).applyMatrix4(Q); // the triangle's middle, halfway in depth
    obj.applyMatrix4(Q);
    obj.position.sub(center).add(new THREE.Vector3(0, 0.15, 0));
    scene.add(obj);
    obj.updateMatrixWorld(true);
    const P0 = new THREE.Vector3(0, 0, 0).applyMatrix4(obj.matrixWorld), P3 = new THREE.Vector3(L, L, L).applyMatrix4(obj.matrixWorld);
    state.ends = [P0, P3];

    const vh = 10.6, camera = new THREE.OrthographicCamera(-vh * W / H / 2, vh * W / H / 2, vh / 2, -vh / 2, 1, 80);
    state.cam = camera;
    const eye = new THREE.Vector3();
    return {
      scene, camera,
      update(t) {
        const k = off(t);
        eye.set(0, 0, 40).applyAxisAngle(new THREE.Vector3(1, 0, 0), -PITCH * k).applyAxisAngle(new THREE.Vector3(0, 1, 0), YAW * k);
        camera.position.copy(eye);
        camera.lookAt(0, 0, 0);
        camera.zoom = 1 / (1 + 0.55 * k);                  // pull back a little so both ends stay in frame
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        mat.uniforms.uOff.value = k;
        state.k = k;
      },
    };
  },
  // two state pills, and once off axis a dashed line joining the two ends: the line of sight of the magic view
  overlay(ctx, t, W, H) {
    const k = state.k, cam = state.cam;
    const px = p => { const q = p.clone().project(cam); return [(q.x + 1) / 2 * W, (1 - q.y) / 2 * H]; };
    if (k > 0.02) {
      const [a, b] = state.ends.map(px);
      ctx.save();
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.strokeStyle = '#FFD79A'; ctx.lineWidth = 5; ctx.setLineDash([16, 14]); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
      ctx.setLineDash([]);
      for (const [x, y] of [a, b]) { ctx.fillStyle = '#FFD79A'; ctx.beginPath(); ctx.arc(x, y, 11, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    [['ONE VIEW · CLOSED 닫힘', 1 - k, '#9FE3D2', 290], ['OFF AXIS · OPEN 열림', k, '#FFB59A', 790]].forEach(([txt, on, col, x]) => {
      ctx.fillStyle = `rgba(10, 12, 24, ${0.55 + 0.3 * on})`;
      ctx.beginPath(); ctx.roundRect(x - 230, 1690, 460, 80, 40); ctx.fill();
      ctx.globalAlpha = 0.3 + 0.7 * on;
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = col; ctx.font = `700 32px ${FONT.sans}`; ctx.fillText(txt, x, 1731);
      ctx.globalAlpha = 1;
    });
  },
};
