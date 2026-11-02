// Tensegrity tower: three stacked prisms of three struts each. No strut touches another; every strut end hangs in
// a net of 27 cables that only pull. The shape is found in setup by dynamic relaxation: struts are stiff springs,
// cables pull-only springs whose rest length is 82 % of their first length, and the nodes settle (heavy damping)
// into the prestressed equilibrium. Then the same model runs in time with light damping: a twisting push on the top
// triangle (0.5 .. 1.3 s) winds the tower down and round, it is let go and springs back, swaying a few times. Cable
// colour is its tension against its tension at rest (blue 15 % less .. white .. red 15 % more). In the last half second the
// tower is blended onto the rest pose, so frame 150 meets frame 0.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TAU, smoothstep, span, ease, clamp, FONT } from '../lib/util.js';

const S = 3, R = 0.55, HGT = 1.15, OVER = 0.35, TWIST = (150 * Math.PI) / 180;
const KS = 4000, KC = 300, DT = 0.002, FPS = 30;
const PUSH0 = 0.5, PUSH1 = 1.3, FORCE = 13, SETTLE0 = 4.45, SETTLE1 = 4.95;

// nodes, struts and cables of the tower (stage k: bottom triangle B, top triangle T turned by TWIST)
function build() {
  const nodes = [], struts = [], cables = [], B = [], T = [];
  const node = (a, y) => { nodes.push([R * Math.cos(a), y, R * Math.sin(a)]); return nodes.length - 1; };
  for (let k = 0; k < S; k++) {
    const th = (k * TAU) / 6, y0 = k * (HGT - OVER);
    B.push([0, 1, 2].map(i => node(th + (i * TAU) / 3, y0)));
    T.push([0, 1, 2].map(i => node(th + (i * TAU) / 3 + TWIST, y0 + HGT)));
    for (let i = 0; i < 3; i++) { struts.push([B[k][i], T[k][i]]); cables.push([B[k][i], T[k][(i + 2) % 3]]); }
  }
  for (let i = 0; i < 3; i++) cables.push([B[0][i], B[0][(i + 1) % 3]], [T[S - 1][i], T[S - 1][(i + 1) % 3]]);
  for (let k = 0; k < S - 1; k++) for (let j = 0; j < 3; j++) {   // each lower end of the next stage hangs from the two nearest tops
    const b = nodes[B[k + 1][j]];
    const near = T[k].map(t => [Math.hypot(nodes[t][0] - b[0], nodes[t][2] - b[2]), t]).sort((p, q) => p[0] - q[0]);
    cables.push([B[k + 1][j], near[0][1]], [B[k + 1][j], near[1][1]]);
  }
  return { nodes, struts, cables, base: B[0], top: T[S - 1] };
}

function simulate() {
  const { nodes, struts, cables, base, top } = build();
  const x = nodes.map(p => p.slice()), v = nodes.map(() => [0, 0, 0]), fixed = new Set(base);
  const dist = (a, b) => Math.hypot(x[a][0] - x[b][0], x[a][1] - x[b][1], x[a][2] - x[b][2]);
  const sRest = struts.map(([a, b]) => dist(a, b)), cRest = cables.map(([a, b]) => 0.82 * dist(a, b));
  const tension = new Float32Array(cables.length);
  const step = (damp, push) => {
    const f = x.map(() => [0, 0, 0]);
    const spring = (a, b, rest, k, pullOnly) => {
      const d = [0, 1, 2].map(c => x[b][c] - x[a][c]), L = Math.hypot(...d), e = L - rest;
      if (pullOnly && e < 0) return 0;
      for (let c = 0; c < 3; c++) { f[a][c] += (k * e * d[c]) / L; f[b][c] -= (k * e * d[c]) / L; }
      return k * e;
    };
    struts.forEach(([a, b], i) => spring(a, b, sRest[i], KS, false));
    cables.forEach(([a, b], i) => (tension[i] = spring(a, b, cRest[i], KC, true)));
    for (const i of top) {                                     // the push: round the axis and a little down
      const a = Math.atan2(x[i][2], x[i][0]);
      f[i][0] -= Math.sin(a) * push; f[i][2] += Math.cos(a) * push; f[i][1] -= 0.5 * push;
    }
    for (let i = 0; i < x.length; i++) {
      if (fixed.has(i)) continue;
      for (let c = 0; c < 3; c++) { v[i][c] = (v[i][c] + f[i][c] * DT) * damp; x[i][c] += v[i][c] * DT; }
    }
  };
  for (let s = 0; s < 40000; s++) step(0.98, 0);             // form-finding
  const rest = x.map(p => p.slice()), restT = Float32Array.from(tension);
  v.forEach(p => p.fill(0));
  const frames = [];
  const per = Math.round(1 / FPS / DT);
  for (let f = 0; f < 5 * FPS; f++) {
    frames.push({ x: Float32Array.from(x.flat()), ten: Float32Array.from(tension) });
    for (let s = 0; s < per; s++) {
      const t = (f * per + s) * DT, k = span(t, PUSH0, PUSH1);
      step(0.9972, FORCE * Math.sin(Math.PI * k) ** 2);
    }
  }
  return { struts, cables, rest: Float32Array.from(rest.flat()), restT, frames, top };
}

export default {
  name: 'Tensegrity',
  ko: '텐세그리티',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas');
    bg.width = 2; bg.height = 512;
    const g = bg.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#0B1024'); grd.addColorStop(0.6, '#1B2446'); grd.addColorStop(1, '#2A2440');
    g.fillStyle = grd; g.fillRect(0, 0, 2, 512);
    scene.background = new THREE.CanvasTexture(bg);
    scene.background.colorSpace = THREE.SRGBColorSpace;
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
    const key = new THREE.DirectionalLight('#FFF0DC', 2.4);
    key.position.set(-4, 9, 5);
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 30 });
    key.shadow.radius = 5; key.shadow.bias = -0.0005;
    scene.add(key, new THREE.HemisphereLight('#AFC2FF', '#2A2030', 0.7));

    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.35 }));
    floor.position.y = -0.06; floor.receiveShadow = true; scene.add(floor);   // only the shadow shows
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.78, 0.06, 64), new THREE.MeshStandardMaterial({ color: '#C9CFDD', roughness: 0.3, metalness: 0.7 }));
    plinth.position.y = -0.03; plinth.receiveShadow = true; scene.add(plinth);

    const sim = simulate(), up = new THREE.Vector3(0, 1, 0);
    const strutGeo = new THREE.CylinderGeometry(0.045, 0.045, 1, 20), cableGeo = new THREE.CylinderGeometry(0.012, 0.012, 1, 10);
    const wood = new THREE.MeshStandardMaterial({ color: '#E9A85A', roughness: 0.45, metalness: 0.1 });
    const struts = sim.struts.map(() => { const m = new THREE.Mesh(strutGeo, wood); m.castShadow = true; scene.add(m); return m; });
    const cables = sim.cables.map(() => { const m = new THREE.Mesh(cableGeo, new THREE.MeshStandardMaterial({ roughness: 0.4, emissive: '#000000' })); scene.add(m); return m; });
    const caps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 20, 14), new THREE.MeshStandardMaterial({ color: '#F4F1EA', roughness: 0.3, metalness: 0.6 }), sim.struts.length * 2);
    caps.castShadow = true; scene.add(caps);

    // the push, shown as a curved arrow round the top that appears while the force acts
    const arrowMat = new THREE.MeshBasicMaterial({ color: '#FFD36B', transparent: true, depthWrite: false });
    const arrow = new THREE.Group();
    arrow.add(new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.035, 12, 64, 2.2).rotateX(Math.PI / 2), arrowMat));
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.26, 20), arrowMat);
    head.position.set(0.95 * Math.cos(2.2), 0, 0.95 * Math.sin(2.2));      // at the arc's end, pointing along it
    head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-Math.sin(2.2), 0, Math.cos(2.2)));
    arrow.add(head);
    scene.add(arrow);

    const a = new THREE.Vector3(), b = new THREE.Vector3(), m = new THREE.Matrix4(), col = new THREE.Color();
    const SLACK = new THREE.Color('#3D7BFF'), REST = new THREE.Color('#E8F4FF'), TAUT = new THREE.Color('#FF4A3D');
    const place = (mesh, p, q, out) => {                        // stretch a unit cylinder from p to q
      out.subVectors(q, p);
      mesh.position.copy(p).addScaledVector(out, 0.5);
      mesh.quaternion.setFromUnitVectors(up, out.clone().normalize());
      mesh.scale.set(1, out.length(), 1);
    };
    const tmp = new THREE.Vector3();
    return {
      scene, camera,
      update(t) {
        const ang = 0.55 * Math.sin((TAU * t) / 5) + 0.3;      // the camera swings round the tower and back
        camera.position.set(10 * Math.sin(ang), 6.2, 10 * Math.cos(ang));
        camera.lookAt(0, 1.32, 0);
        const fr = sim.frames[Math.round(t * FPS) % (5 * FPS)], w = ease.inOut(span(t, SETTLE0, SETTLE1));
        const X = fr.x.map((v, i) => v + (sim.rest[i] - v) * w), Tn = fr.ten.map((v, i) => v + (sim.restT[i] - v) * w);
        const P = i => a.set(X[i * 3], X[i * 3 + 1], X[i * 3 + 2]), Q = i => b.set(X[i * 3], X[i * 3 + 1], X[i * 3 + 2]);
        sim.struts.forEach(([i, j], k) => {
          place(struts[k], P(i), Q(j), tmp);
          caps.setMatrixAt(k * 2, m.makeTranslation(a)); caps.setMatrixAt(k * 2 + 1, m.makeTranslation(b));
        });
        caps.instanceMatrix.needsUpdate = true;
        sim.cables.forEach(([i, j], k) => {
          place(cables[k], P(i), Q(j), tmp);
          const r = clamp((Tn[k] / sim.restT[k] - 1) / 0.15, -1, 1);  // tension against rest: -1 at 85 %, +1 at 115 %
          col.copy(REST).lerp(r < 0 ? SLACK : TAUT, Math.abs(r));
          cables[k].material.color.copy(col);
          cables[k].material.emissive.copy(col).multiplyScalar(0.7);
        });
        const push = Math.sin(Math.PI * span(t, PUSH0, PUSH1)) ** 2;
        const c = sim.top.reduce((s, i) => s.add(P(i)), new THREE.Vector3()).multiplyScalar(1 / 3);
        arrow.position.copy(c).y += 0.18;
        arrow.rotation.y = -0.6 * span(t, PUSH0, PUSH1);
        arrowMat.opacity = 0.95 * smoothstep(0, 0.3, push) * (t < PUSH1 ? 1 : 0);
      },
    };
  },
  overlay(ctx, t, W, H) {
    // the tension scale
    const x0 = 250, x1 = 830, y = 1730;
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, '#3D7BFF'); g.addColorStop(0.5, '#E8F4FF'); g.addColorStop(1, '#FF4A3D');
    ctx.lineCap = 'round'; ctx.lineWidth = 12; ctx.strokeStyle = g;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    ctx.font = `600 26px ${FONT.sans}`; ctx.fillStyle = 'rgba(225, 232, 255, 0.75)';
    ctx.textAlign = 'center'; ctx.fillText('CABLE TENSION vs. AT REST', W / 2, y - 34);
    ctx.font = `500 24px ${FONT.sans}`; ctx.fillStyle = 'rgba(225, 232, 255, 0.6)';
    ctx.textAlign = 'left'; ctx.fillText('−15 %', x0 - 10, y + 44);
    ctx.textAlign = 'center'; ctx.fillText('at rest', W / 2, y + 44);
    ctx.textAlign = 'right'; ctx.fillText('+15 %', x1 + 10, y + 44);
  },
};
