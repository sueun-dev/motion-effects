// Ames room: seen through a peephole, an ordinary room with a checkered floor and two windows; twin A stands tiny in
// the left corner, twin B is a giant in the right one, then walks left and shrinks to A's size. The room is really a
// distorted one: every point of a normal box room is slid along its line of sight to the eye, P' = P / (1 + 0.25 x),
// which keeps planes flat and leaves the picture from the eye unchanged, but pushes the left corner 8.7 m away and
// pulls the right one in to 3.7 m, tilting floor and ceiling. Floor, walls and windows are painted in the shader from
// the undistorted coordinates P = P' / (1 - 0.25 x'), so from the eye they look square. Then the peephole view closes
// like an iris into the peephole itself, and a second camera above the roofless room shows the real trapezoid.
import * as THREE from 'three';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { TAU, FONT, ease, span, lerp, clamp, smoothstep } from '../lib/util.js';

const AL = 0.25;                                           // the distortion: P' = P / (1 + AL x)
const X0 = 1.6, FY = -1.55, CY = 1.25, BZ = -5.2, FZ = 0.05;  // the room as seen: half-width, floor, ceiling, back, front
const real = (x, y, z) => new THREE.Vector3(x, y, z).multiplyScalar(1 / (1 + AL * x));
// the iris: 0 = the peephole view fills the frame, 1 = closed into the peephole, the outside view shows.
// Closes 2.25-3.2 s, opens 4.25-5.2 s (across the loop point)
const S = (t, a, b) => smoothstep(a, b, t);
const away = t => S(t, 2.25, 3.2) - S(t, 4.25, 5.2) + 1 - S(t, -0.75, 0.2);
// twin B along the back wall: 0 in the right corner, 1 next to A. Left 0.3-1.85 s, back 2.75-4.25 s
const walk = t => ease.inOut(span(t, 0.3, 1.85)) - ease.inOut(span(t, 2.75, 4.25));
const A_AT = [-1.25, -4.6], B_FROM = [1.22, -4.55], B_TO = [-0.48, -4.55];   // (x, z) as seen from the peephole
const state = { k: 0, cam: null, heads: [] };

const vert = `
varying vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
// kind: 0 floor, 1 back wall, 2 side walls, 3 ceiling, 4 front wall
const frag = `
uniform int uKind; uniform vec3 uFootA, uFootB;
varying vec3 vW;
float band(float x, float a, float b, float w) { return smoothstep(a - w, a + w, x) - smoothstep(b - w, b + w, x); }
vec3 paper(vec2 p) {                                       // striped wallpaper above a dark wainscot with a rail
  vec3 c = mix(vec3(0.31, 0.54, 0.52), vec3(0.35, 0.59, 0.56), 0.5 + 0.5 * cos(p.x * 6.2831 / 0.3));
  float w = fwidth(p.y);
  c = mix(c, vec3(0.20, 0.27, 0.36), smoothstep(-0.62 + w, -0.62 - w, p.y));
  c = mix(c, vec3(0.93, 0.88, 0.78), band(p.y, -0.66, -0.58, w));
  c = mix(c, vec3(0.93, 0.88, 0.78), band(p.y, 1.08, 1.25, w));                 // cornice
  return c;
}
void main() {
  vec3 q = vW / (1.0 - ${AL} * vW.x);                      // back to the undistorted room
  vec3 col; float ao = 1.0;
  if (uKind == 0) {
    vec2 g = q.xz / 0.5; vec2 w = fwidth(g);
    vec2 s = clamp((abs(fract(g) - 0.5) - 0.25) / max(w, 1e-4) + 0.5, 0.0, 1.0); // anti-aliased checker
    float ch = s.x + s.y - 2.0 * s.x * s.y;
    col = mix(vec3(0.90, 0.85, 0.76), vec3(0.30, 0.22, 0.22), ch);
    ao = 1.0 - 0.3 * exp(-min(${X0} - abs(q.x), q.z - ${BZ}) / 0.25);
    float sa = length(vW.xz - uFootA.xz), sb = length(vW.xz - uFootB.xz);       // soft contact shadows, real size
    ao *= 1.0 - 0.45 * exp(-sa * sa / 0.08) - 0.45 * exp(-sb * sb / 0.08);
  } else if (uKind == 1) {
    col = paper(q.xy);
    for (int i = 0; i < 2; i++) {                          // two windows with mullions and a sky
      float cx = i == 0 ? -0.82 : 0.82;
      vec2 d = abs(q.xy - vec2(cx, 0.32)); vec2 w = fwidth(q.xy);
      float frame = (1.0 - smoothstep(0.33 - w.x, 0.33 + w.x, d.x)) * (1.0 - smoothstep(0.47 - w.y, 0.47 + w.y, d.y));
      float glass = (1.0 - smoothstep(0.28 - w.x, 0.28 + w.x, d.x)) * (1.0 - smoothstep(0.42 - w.y, 0.42 + w.y, d.y));
      float mull = min(1.0 - smoothstep(0.018 - w.x, 0.018 + w.x, abs(q.x - cx)) + 1.0 - smoothstep(0.018 - w.y, 0.018 + w.y, abs(q.y - 0.32)), 1.0);
      vec3 sky = mix(vec3(1.0, 0.80, 0.62), vec3(0.55, 0.72, 0.95), smoothstep(-0.1, 0.7, q.y));
      col = mix(col, vec3(0.95, 0.91, 0.84), frame);
      col = mix(col, mix(sky, vec3(0.95, 0.91, 0.84), mull), glass);
    }
    ao = 1.0 - 0.3 * exp(-(${X0} - abs(q.x)) / 0.25);
  } else if (uKind == 2) {
    col = paper(q.zy);
    ao = 1.0 - 0.3 * exp(-(q.z - ${BZ}) / 0.25);
  } else if (uKind == 3) {
    float w = fwidth(q.z);                                 // ceiling boards running across the room
    col = mix(vec3(0.95, 0.92, 0.86), vec3(0.80, 0.74, 0.66), band(fract(q.z / 0.45 + 0.5), 0.47, 0.53, w / 0.45));
    ao = 1.0 - 0.25 * exp(-min(${X0} - abs(q.x), q.z - ${BZ}) / 0.3);
  }
  // the outer side of the set, only seen from the second camera: bare plywood boards
  vec3 n = normalize(cross(dFdx(vW), dFdy(vW)));
  bool outside = uKind == 4 || dot(n, cameraPosition - vW) * dot(n, -vW) < 0.0;
  if (outside) {
    float u = (uKind == 2 ? q.z : q.x) / 0.32, w = fwidth(u);
    col = vec3(0.68, 0.55, 0.40) * (0.94 + 0.06 * sin(u * 1.7 + 2.0 * sin(u * 0.7)));
    col *= 1.0 - 0.35 * band(fract(u + 0.5), 0.48, 0.52, w);
    ao = 1.0;
  }
  if (uKind == 4) {
    float r = length(q.xy);                                // the peephole and its brass ring
    col = mix(col, vec3(0.78, 0.6, 0.3), 1.0 - smoothstep(0.075, 0.085, r));
    col = mix(col, vec3(0.03), 1.0 - smoothstep(0.04, 0.05, r));
  }
  if (uKind != 3 && !outside) ao *= 1.0 - 0.25 * exp(-(q.y - ${FY}) / 0.2) - 0.18 * exp(-(${CY} - q.y) / 0.2);
  float light = 0.85 + 0.15 * exp(-dot(q.xz - vec2(0.0, -2.8), q.xz - vec2(0.0, -2.8)) / 6.0);
  gl_FragColor = vec4(pow(col, vec3(2.2)) * ao * light, 1.0);
  #include <colorspace_fragment>
}`;

// a stylised person, feet at the origin, facing +z; returns the parts that swing
function person() {
  const g = new THREE.Group(), M = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 });
  const skin = M('#F1C7A5'), red = M('#E5533D'), navy = M('#2E3A59'), dark = M('#24180F');
  const limb = (r, l, mat, y) => { const p = new THREE.Group(), m = new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 6, 16), mat); m.position.y = -l / 2 - r * 0.3; p.add(m); p.position.y = y; return p; };
  const legs = [-1, 1].map(s => { const l = limb(0.07, 0.72, navy, 0.86); l.position.x = 0.09 * s; const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.22), dark); shoe.position.set(0, -0.83, 0.04); l.add(shoe); g.add(l); return l; });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.36, 8, 20), red);
  torso.position.y = 1.18; torso.scale.set(1, 1, 0.72);
  const arms = [-1, 1].map(s => { const a = limb(0.05, 0.5, red, 1.44); a.position.x = 0.23 * s; const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), skin); hand.position.y = -0.62; a.add(hand); g.add(a); return a; });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 32, 24), skin);
  head.position.y = 1.62;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.128, 32, 16, 0, TAU, 0, Math.PI * 0.55), dark);
  hair.position.set(0, 1.635, -0.01); hair.rotation.x = -0.35;
  const eyes = [-1, 1].map(s => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), dark); e.position.set(0.042 * s, 1.63, 0.112); return e; });
  g.add(torso, head, hair, ...eyes);
  g.traverse(m => { if (m.isMesh) m.castShadow = false; });
  return { g, legs, arms };
}

export default {
  name: 'Ames Room',
  ko: '에임스 방',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#141428');
    scene.add(new THREE.HemisphereLight('#FFF4E8', '#4A4050', 1.4));
    const sun = new THREE.DirectionalLight('#FFF0DD', 1.6);
    sun.position.set(1, 3, 2);
    scene.add(sun);

    const feet = { a: new THREE.Vector3(), b: new THREE.Vector3() };
    // a wall of the room as seen (a flat rectangle), cut into a grid and slid along the lines of sight
    const wall = (kind, corner, du, dv) => {
      const n = 24, pos = [];
      for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
        const p = corner.clone().addScaledVector(du, i / n).addScaledVector(dv, j / n);
        pos.push(...real(p.x, p.y, p.z).toArray());
      }
      const idx = [];
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i; idx.push(a, a + 1, a + n + 1, a + 1, a + n + 2, a + n + 1); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx);
      const mat = new THREE.ShaderMaterial({
        uniforms: { uKind: { value: kind }, uFootA: { value: feet.a }, uFootB: { value: feet.b } },
        vertexShader: vert, fragmentShader: frag, side: THREE.DoubleSide,
      });
      const m = new THREE.Mesh(geo, mat);
      scene.add(m);
      return m;
    };
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    wall(0, V(-X0, FY, FZ), V(2 * X0, 0, 0), V(0, 0, BZ - FZ));
    wall(1, V(-X0, FY, BZ), V(2 * X0, 0, 0), V(0, CY - FY, 0));
    wall(2, V(-X0, FY, FZ), V(0, 0, BZ - FZ), V(0, CY - FY, 0));
    wall(2, V(X0, FY, FZ), V(0, 0, BZ - FZ), V(0, CY - FY, 0));
    const ceiling = wall(3, V(-X0, CY, FZ), V(2 * X0, 0, 0), V(0, 0, BZ - FZ));
    const front = wall(4, V(-X0, FY, FZ), V(2 * X0, 0, 0), V(0, CY - FY, 0));   // with the peephole; only shown outside

    const A = person(), B = person();
    scene.add(A.g, B.g);
    const footAt = ([x, z]) => real(x, FY, z);
    A.g.position.copy(footAt(A_AT));
    A.g.rotation.y = Math.atan2(-A.g.position.x, -A.g.position.z);   // A faces the peephole
    feet.a.copy(A.g.position);

    const eyeCam = new THREE.PerspectiveCamera(64, W / H, 0.02, 100);   // at the peephole, fixed
    eyeCam.lookAt(0, -0.15, -3);
    const outCam = new THREE.PerspectiveCamera(55, W / H, 0.5, 100);    // above and in front, drifting slowly
    const LOOK_OUT = V(-0.9, -1.5, -4.5);
    const pose = t => {
      const a = TAU * t / 5;
      outCam.position.set(-0.3 + 0.9 * Math.sin(a), 8.6, 3.6 + 0.4 * Math.cos(a));
      outCam.lookAt(LOOK_OUT);
      // B walks along a straight line in the seen room, which is a straight line in the real one too
      const u = walk(t), dir = Math.sign(walk(t + 0.02) - walk(t - 0.02)) || 1;
      const at = u2 => footAt([lerp(B_FROM[0], B_TO[0], u2), lerp(B_FROM[1], B_TO[1], u2)]);
      const p = at(u), ahead = at(u + 0.01).sub(at(u - 0.01)).multiplyScalar(dir);
      const speed = clamp(Math.abs(walk(t + 0.02) - walk(t - 0.02)) / 0.04 / 0.9);  // 0 standing .. 1 full stride
      B.g.position.copy(p);
      const facing = Math.atan2(-p.x, -p.z), heading = Math.atan2(ahead.x, ahead.z);
      let d = heading - facing; d = Math.atan2(Math.sin(d), Math.cos(d));
      B.g.rotation.y = facing + d * Math.min(1, speed * 1.6);  // faces the peephole when standing, the way it walks when walking
      const stride = u * at(1).distanceTo(at(0)) / 0.72 * Math.PI;  // leg phase follows the distance walked
      B.legs.forEach((l, i) => { l.rotation.x = 0.5 * speed * Math.sin(stride + i * Math.PI); });
      B.arms.forEach((m, i) => { m.rotation.x = -0.4 * speed * Math.sin(stride + i * Math.PI); });
      B.g.position.y += 0.025 * speed * Math.abs(Math.cos(stride));
      feet.b.copy(p);
    };

    // both views every frame, then the iris: the peephole view inside a circle that shrinks onto the peephole
    const opts = { type: THREE.HalfFloatType, samples: 4 };
    const viewIn = new THREE.WebGLRenderTarget(W, H, opts), viewOut = new THREE.WebGLRenderTarget(W, H, opts);
    const sum = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
    const irisMat = new THREE.ShaderMaterial({
      uniforms: { tIn: { value: viewIn.texture }, tOut: { value: viewOut.texture }, uC: { value: new THREE.Vector2() }, uR: { value: 0 } },
      depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D tIn, tOut; uniform vec2 uC; uniform float uR; varying vec2 vUv;
        void main() {
          float d = length(vUv * vec2(${W}.0, ${H}.0) - uC);
          float inside = 1.0 - smoothstep(uR - 4.0, uR + 4.0, d);
          vec2 e = (vUv - 0.5) * vec2(1.0, ${H / W});
          vec3 seen = texture2D(tIn, vUv).rgb * (1.0 - 0.6 * smoothstep(0.45, 1.0, length(e)));   // the peephole's dark rim
          gl_FragColor = vec4(mix(texture2D(tOut, vUv).rgb, seen, inside), 1.0);
        }`,
    });
    const quad = new THREE.Scene(), flat = new THREE.Camera();
    quad.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), irisMat));
    const output = new OutputPass();
    output.renderToScreen = true;
    const headA = A.g.position.clone().add(V(0, 1.62, 0)), eyePx = new THREE.Vector3();
    // the radius at which the circle round (cx, cy) covers a share f of the frame (on a 54 x 96 grid), so that the
    // picture changes by the same amount every frame of the iris
    const radiusFor = (f, cx, cy) => {
      if (f <= 0) return 0;
      let lo = 0, hi = 2400;
      for (let it = 0; it < 22; it++) {
        const r = (lo + hi) / 2;
        let n = 0;
        for (let j = 0; j < 96; j++) for (let i = 0; i < 54; i++) if (Math.hypot((i + 0.5) * W / 54 - cx, (j + 0.5) * H / 96 - cy) < r) n++;
        if (n / (54 * 96) < f) lo = r; else hi = r;
      }
      return f >= 1 ? 2400 : hi;
    };
    return {
      render(t) {
        const k = away(t);
        pose(t);
        renderer.setClearColor('#141428', 1);
        ceiling.visible = true; front.visible = false;      // the peephole view: inside the closed room
        renderer.setRenderTarget(viewIn);
        renderer.render(scene, eyeCam);
        ceiling.visible = false; front.visible = true;      // the outside view: roof off, front wall with the hole
        renderer.setRenderTarget(viewOut);
        renderer.render(scene, outCam);
        eyePx.set(0, 0, 0).project(outCam);
        const ex = (eyePx.x + 1) / 2 * W, ey = (eyePx.y + 1) / 2 * H;   // the peephole on screen (y up)
        const cx = lerp(W / 2, ex, k), cy = lerp(H / 2, ey, k);
        irisMat.uniforms.uC.value.set(cx, cy);
        irisMat.uniforms.uR.value = radiusFor(1 - k, cx, cy);
        renderer.setRenderTarget(sum);
        renderer.render(quad, flat);
        output.render(renderer, null, sum);
        state.k = k;
        state.cam = outCam;
        state.heads = [headA, B.g.position.clone().add(V(0, 1.62, 0))];
      },
    };
  },
  // two state pills, and outside: sight lines from the peephole to both heads
  overlay(ctx, t, W, H) {
    const k = state.k;
    if (k > 0.01) {
      const P = p => { const q = p.clone().project(state.cam); return [(q.x + 1) / 2 * W, (1 - q.y) / 2 * H]; };
      const eye = P(new THREE.Vector3(0, 0, 0));
      ctx.save();
      ctx.globalAlpha = clamp((k - 0.75) / 0.2);
      ctx.strokeStyle = '#FFE08A'; ctx.lineWidth = 4; ctx.setLineDash([14, 12]); ctx.lineCap = 'round';
      for (const h of state.heads) { ctx.beginPath(); ctx.moveTo(...eye); ctx.lineTo(...P(h)); ctx.stroke(); }
      ctx.setLineDash([]);
      ctx.fillStyle = '#FFE08A'; ctx.beginPath(); ctx.arc(...eye, 10, 0, TAU); ctx.fill();
      ctx.font = `700 30px ${FONT.sans}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('EYE · 눈', eye[0] + 22, eye[1] + 4);
      ctx.restore();
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    [['PEEPHOLE · 구멍으로 본 방', 1 - k, '#FFE08A', 290], ['REAL ROOM · 실제 방', k, '#8FE3D0', 790]].forEach(([txt, on, col, x]) => {
      ctx.fillStyle = `rgba(10, 10, 22, ${0.6 + 0.25 * on})`;
      ctx.beginPath(); ctx.roundRect(x - 235, 1716, 470, 80, 40); ctx.fill();
      ctx.globalAlpha = 0.3 + 0.7 * on;
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = col; ctx.font = `700 32px ${FONT.sans}`; ctx.fillText(txt, x, 1757);
      ctx.globalAlpha = 1;
    });
  },
};
