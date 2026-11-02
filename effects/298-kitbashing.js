// Kitbashing: a plain grey blockout of a starship (spine, bridge, nose, side pods, engine block) gets its detail from a
// kit of eight reusable parts shown in the tray below: plates, pipes, vents, greebles, bolts, antennas, sensor domes
// and thrusters. Each kit part is one instanced mesh; its copies drop onto the hull along the face normals and snap on
// in four waves (big plates, then pipes and vents, then greebles and bolts, then the hero parts) while the tray slot
// in use lights up; the thrusters fire, and the copies lift off again, tail first. Placements are seeded.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TAU, FONT, phase, span, ease, rng } from '../lib/util.js';

// the blockout: rounded boxes [centre x, y, z, size x, y, z]; the ship points up (+y), its top faces +z
const HULL = [
  [0, 0.2, 0, 1.5, 4.6, 0.9],        // spine
  [0, 1.1, 0.62, 0.8, 1.2, 0.36],    // bridge deck
  [1.35, -0.9, -0.05, 0.62, 2.6, 0.62], [-1.35, -0.9, -0.05, 0.62, 2.6, 0.62], // side pods
  [0.85, -0.6, -0.05, 0.6, 0.5, 0.3], [-0.85, -0.6, -0.05, 0.6, 0.5, 0.3],     // pylons
  [0, -2.55, -0.05, 2.1, 0.9, 1.1],  // engine block
];
// the kit: name, wave, flight start offset in the wave (s)
const KIT = ['PLATE', 'PIPE', 'VENT', 'GREEBLE', 'BOLT', 'ANTENNA', 'DOME', 'THRUSTER'];
const WAVE = [0.25, 0.95, 0.95, 1.65, 1.65, 2.4, 2.4, 2.4], SPREAD = [0.7, 0.7, 0.7, 0.7, 0.7, 0.45, 0.45, 0.45], SNAP = 0.42;
const BACK = 3.95, BACK_SPREAD = 0.62, BACK_SNAP = 0.3;  // the copies lift off again, tail first (w: 0 at the nose)
// wave of each kit part (for the tray highlight)
const waveOf = t => WAVE.map((w, k) => Math.sin(Math.PI * span(t, w - 0.1, w + SPREAD[k] + SNAP + 0.1)));

function kitGeometry(name) {
  const box = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  switch (name) {
    case 'PLATE': return new RoundedBoxGeometry(1, 1, 1, 2, 0.08).translate(0, 0.5, 0);             // scaled per copy
    case 'PIPE': return mergeGeometries([new THREE.CylinderGeometry(0.06, 0.06, 1, 16).rotateZ(Math.PI / 2).translate(0, 0.07, 0),
      ...[-0.42, 0, 0.42].map(x => new THREE.CylinderGeometry(0.085, 0.085, 0.05, 16).rotateZ(Math.PI / 2).translate(x, 0.07, 0))]);
    case 'VENT': return mergeGeometries([box(0.42, 0.04, 0.3, 0, 0.02, 0),
      ...[0, 1, 2, 3, 4].map(k => box(0.36, 0.035, 0.04, 0, 0.06, -0.11 + k * 0.055).rotateX(0))]);
    case 'GREEBLE': return mergeGeometries([box(1, 1, 1, 0, 0.5, 0), box(0.5, 0.4, 0.5, 0.15, 1.2, 0.1)]);
    case 'BOLT': return new THREE.CylinderGeometry(0.05, 0.05, 0.05, 6).translate(0, 0.025, 0);
    case 'ANTENNA': return mergeGeometries([new THREE.CylinderGeometry(0.06, 0.08, 0.08, 12).translate(0, 0.04, 0),
      new THREE.CylinderGeometry(0.012, 0.018, 0.7, 8).translate(0, 0.43, 0), new THREE.SphereGeometry(0.035, 12, 8).translate(0, 0.8, 0)]);
    case 'DOME': return mergeGeometries([new THREE.CylinderGeometry(0.2, 0.22, 0.05, 24).translate(0, 0.025, 0),
      new THREE.SphereGeometry(0.16, 24, 12, 0, TAU, 0, Math.PI / 2).translate(0, 0.05, 0)]);
    case 'THRUSTER': {
      const prof = [];
      for (let k = 0; k <= 12; k++) { const v = k / 12; prof.push(new THREE.Vector2(0.11 + 0.12 * v * v, 0.36 * v)); }
      return mergeGeometries([new THREE.LatheGeometry(prof, 24), new THREE.CylinderGeometry(0.14, 0.14, 0.08, 24).translate(0, 0.0, 0)]);
    }
  }
}
const KIT_COLOR = { PLATE: '#C6CBD3', PIPE: '#59606B', VENT: '#3B4049', GREEBLE: '#9AA2AD', BOLT: '#2E3239', ANTENNA: '#E9ECF0', DOME: '#FF8A3D', THRUSTER: '#4A505A' };
const TRAY_SCALE = { PLATE: 0.5, PIPE: 0.36, VENT: 0.85, GREEBLE: 0.55, BOLT: 1.7, ANTENNA: 0.33, DOME: 0.68, THRUSTER: 0.7 };
const SAMPLE = { PLATE: [0.5, 0.06, 0.4], GREEBLE: [0.2, 0.14, 0.2] }; // the tray copy of the scaled parts

// where every copy goes: a seeded layout over the visible faces of the blockout
function layout() {
  const r = rng(298), out = [];
  const add = (kit, pos, normal, spin, scale) => out.push({ kit, pos, normal, spin, scale });
  const faces = [];
  for (const [cx, cy, cz, sx, sy, sz] of HULL) {
    faces.push({ c: [cx, cy, cz + sz / 2], n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], su: sx, sv: sy });
    for (const s of [1, -1]) faces.push({ c: [cx + s * sx / 2, cy, cz], n: [s, 0, 0], u: [0, 0, 1], v: [0, 1, 0], su: sz, sv: sy });
  }
  const P = (f, a, b, lift = 0) => new THREE.Vector3(...f.c).addScaledVector(new THREE.Vector3(...f.u), a).addScaledVector(new THREE.Vector3(...f.v), b).addScaledVector(new THREE.Vector3(...f.n), lift);
  for (const f of faces) {
    const cu = Math.max(1, Math.floor(f.su / 0.36)), cv = Math.max(1, Math.floor(f.sv / 0.36)), du = f.su / cu, dv = f.sv / cv;
    for (let i = 0; i < cu; i++) for (let j = 0; j < cv; j++) {
      const a = -f.su / 2 + du * (i + 0.5), b = -f.sv / 2 + dv * (j + 0.5), roll = r();
      const n = new THREE.Vector3(...f.n);
      if (roll < 0.42) {                                           // a plate, sometimes with a greeble or bolts on it
        add('PLATE', P(f, a, b), n, f.n[2] ? 0 : Math.PI / 2, [du * 0.86, 0.035 + 0.04 * r(), dv * 0.86]);
        if (r() < 0.4) add('GREEBLE', P(f, a + (r() - 0.5) * du * 0.4, b + (r() - 0.5) * dv * 0.4, 0.06), n, Math.floor(r() * 4) * Math.PI / 2, [0.06 + 0.08 * r(), 0.04 + 0.08 * r(), 0.06 + 0.08 * r()]);
        else if (r() < 0.5) for (const s of [-1, 1]) add('BOLT', P(f, a + s * du * 0.32, b + s * dv * 0.32, 0.06), n, 0, [1, 1, 1]);
      } else if (roll < 0.55) add('VENT', P(f, a, b), n, f.n[2] ? 0 : Math.PI / 2, [1, 1, 1]);
      else if (roll < 0.85) {                                      // a cluster of greebles
        for (let k = 0; k < 3; k++) add('GREEBLE', P(f, a + (r() - 0.5) * du * 0.6, b + (r() - 0.5) * dv * 0.6), n, Math.floor(r() * 4) * Math.PI / 2, [0.05 + 0.09 * r(), 0.03 + 0.1 * r(), 0.05 + 0.09 * r()]);
      }
    }
    if (f.sv > 2) for (const s of [-1, 1]) {                         // pipes along the long faces
      if (f.su < 0.7 && s > 0) continue;
      add('PIPE', P(f, s * (f.su / 2 - 0.08), 0, 0), new THREE.Vector3(...f.n), f.n[2] ? Math.PI / 2 : 0, [f.sv * 0.9, 1, 1]);
    }
  }
  for (const [x, y] of [[0.25, 1.6], [-0.2, 1.45], [0.1, 0.4]]) add('ANTENNA', new THREE.Vector3(x, y, x === 0.1 ? 0.45 : 0.8), new THREE.Vector3(0, 0, 1), 0, [1, 1, 1]);
  for (const [x, y, z] of [[0, 0.75, 0.8], [1.35, -0.2, 0.26], [-1.35, -0.2, 0.26]]) add('DOME', new THREE.Vector3(x, y, z), new THREE.Vector3(0, 0, 1), 0, [1, 1, 1]);
  for (const x of [-0.65, 0, 0.65]) add('THRUSTER', new THREE.Vector3(x, -3.0, -0.05), new THREE.Vector3(0, -1, 0), 0, [1.3, 1.3, 1.3]);
  for (const x of [-1.35, 1.35]) add('THRUSTER', new THREE.Vector3(x, -2.2, -0.05), new THREE.Vector3(0, -1, 0), 0, [0.9, 0.9, 0.9]);
  // the order in each wave: from the nose down
  out.forEach((p, i) => (p.order = -p.pos.y + 0.001 * i));
  return out;
}

export default {
  name: 'Kitbashing',
  ko: '킷배싱',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    // space: a soft violet-blue glow and fixed stars
    const bg = document.createElement('canvas'); bg.width = 540; bg.height = 960;
    const b = bg.getContext('2d');
    const g1 = b.createRadialGradient(330, 330, 20, 300, 420, 700);
    g1.addColorStop(0, '#2A2F5E'); g1.addColorStop(0.5, '#141733'); g1.addColorStop(1, '#07080F');
    b.fillStyle = g1; b.fillRect(0, 0, 540, 960);
    const sr = rng(7);
    for (let i = 0; i < 260; i++) { b.fillStyle = `rgba(255,255,255,${0.25 + 0.6 * sr()})`; b.beginPath(); b.arc(sr() * 540, sr() * 960, 0.4 + sr() * 1.1, 0, TAU); b.fill(); }
    scene.background = new THREE.CanvasTexture(bg); scene.background.colorSpace = THREE.SRGBColorSpace;
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
    camera.position.set(0, 0, 22.5);
    const key = new THREE.DirectionalLight('#FFE9D2', 2.6); key.position.set(-6, 8, 9);
    const rim = new THREE.DirectionalLight('#7FA8FF', 2.2); rim.position.set(7, 2, -6);
    scene.add(key, rim, new THREE.HemisphereLight('#9AA8D8', '#14121C', 0.5));

    // the ship
    const ship = new THREE.Group(), tilt = new THREE.Group();
    tilt.add(ship); scene.add(tilt);
    tilt.position.set(0, 0.85, 0);
    const hullMat = new THREE.MeshStandardMaterial({ color: '#737A86', roughness: 0.6, metalness: 0.55 });
    for (const [cx, cy, cz, sx, sy, sz] of HULL) {
      const m = new THREE.Mesh(new RoundedBoxGeometry(sx, sy, sz, 3, 0.05), hullMat);
      m.position.set(cx, cy, cz); ship.add(m);
    }
    const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 1.06, 1.5, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 0.6), hullMat);
    nose.position.set(0, 3.25, 0); ship.add(nose);

    // the kit: one instanced mesh per part, with every copy it will place
    const parts = layout();
    const kits = KIT.map(name => {
      const list = parts.filter(p => p.kit === name);
      const mat = new THREE.MeshStandardMaterial({ color: KIT_COLOR[name], roughness: name === 'DOME' ? 0.25 : 0.45, metalness: name === 'DOME' ? 0.1 : 0.7, side: name === 'THRUSTER' ? THREE.DoubleSide : THREE.FrontSide });
      const mesh = new THREE.InstancedMesh(kitGeometry(name), mat, list.length + 1); // + the copy that stays in the tray
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      scene.add(mesh);
      return { name, list, mesh };
    });
    // a little accent: some plates in orange
    const plateKit = kits[0], accent = new THREE.Color('#E36E3A'), plain = new THREE.Color('#FFFFFF');
    plateKit.list.forEach((p, i) => plateKit.mesh.setColorAt(i, i % 9 === 4 ? accent : plain));
    plateKit.mesh.setColorAt(plateKit.list.length, plain);
    // the thruster glow
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.17, 24), new THREE.MeshBasicMaterial({ color: '#6FD8FF', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    const glows = kits[7].list.map(p => { const g = glow.clone(); g.material = glow.material; ship.add(g); g.position.copy(p.pos).add(new THREE.Vector3(0, -0.34 * p.scale[1], 0)); g.scale.setScalar(p.scale[0]); g.rotation.x = Math.PI / 2; return g; });
    // the plume: a cone that fades out along its length
    const plumeMat = new THREE.ShaderMaterial({
      uniforms: { uFire: { value: 0 } }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: 'varying float vV; void main() { vV = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uFire; varying float vV; void main() { gl_FragColor = vec4(vec3(0.3, 0.7, 1.0) * pow(1.0 - vV, 1.6) * 0.55 * uFire, 1.0); }',
    });
    const plumeGeo = new THREE.ConeGeometry(0.19, 0.65, 24, 1, true).rotateX(Math.PI).translate(0, -0.325, 0);
    kits[7].list.forEach(p => { const g = new THREE.Mesh(plumeGeo, plumeMat); ship.add(g); g.position.copy(p.pos).add(new THREE.Vector3(0, -0.36 * p.scale[1], 0)); g.scale.setScalar(p.scale[0]); });

    // the tray: a panel in front of the camera, eight slots in two rows
    const trayDepth = 8;
    const toCam = (sx, sy, d) => { const hh = d * Math.tan(THREE.MathUtils.degToRad(15)); return new THREE.Vector3((sx / W * 2 - 1) * hh * W / H, -(sy / H * 2 - 1) * hh, -d); };
    const slot = k => toCam(165 + (k % 4) * 250, 1540 + Math.floor(k / 4) * 200, trayDepth);
    const tc = document.createElement('canvas'); tc.width = 1040; tc.height = 440;
    const tx = tc.getContext('2d');
    tx.fillStyle = 'rgba(12, 14, 26, 0.78)'; tx.beginPath(); tx.roundRect(4, 4, 1032, 432, 34); tx.fill();
    tx.strokeStyle = 'rgba(160, 180, 230, 0.35)'; tx.lineWidth = 3; tx.stroke();
    for (let k = 0; k < 8; k++) {
      tx.fillStyle = 'rgba(120, 140, 200, 0.10)';
      tx.beginPath(); tx.roundRect(28 + (k % 4) * 250, 26 + Math.floor(k / 4) * 200, 234, 186, 20); tx.fill();
    }
    const trayTex = new THREE.CanvasTexture(tc); trayTex.colorSpace = THREE.SRGBColorSpace;
    const trayDepthBack = trayDepth + 0.6, hh = trayDepthBack * Math.tan(THREE.MathUtils.degToRad(15)), pxu = hh * 2 / H;
    const tray = new THREE.Mesh(new THREE.PlaneGeometry(1040 * pxu, 440 * pxu), new THREE.MeshBasicMaterial({ map: trayTex, transparent: true, depthWrite: false, toneMapped: false }));
    tray.position.copy(toCam(540, 1652, trayDepthBack)); tray.renderOrder = -1;
    camera.add(tray); scene.add(camera);

    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qs = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    const s = new THREE.Vector3(), to = new THREE.Vector3(), nrm = new THREE.Vector3();
    const waveIdx = kits.map(k => { const sorted = [...k.list].sort((a, c) => a.order - c.order); return new Map(sorted.map((p, i) => [p, i / Math.max(1, sorted.length - 1)])); });

    return {
      scene, camera,
      update(t) {
        const a = phase(t) * TAU;
        tilt.rotation.set(-0.5 + 0.05 * Math.sin(a), 0.4 * Math.sin(a + 0.6), -0.42 + 0.04 * Math.sin(a));
        scene.updateMatrixWorld(true);
        // thrusters light up once they are all on, and go out before they leave
        const fire = ease.inOut(span(t, 3.15, 3.5)) * (1 - ease.inOut(span(t, 3.8, 4.05)));
        glows.forEach(g => (g.material.opacity = fire));
        plumeMat.uniforms.uFire.value = fire;
        kits.forEach((kit, ki) => {
          const sampleAt = camera.localToWorld(slot(ki));
          const ts = TRAY_SCALE[kit.name], sample = SAMPLE[kit.name] || [1, 1, 1];
          // the copy that stays in the tray, turning slowly
          qs.setFromEuler(new THREE.Euler(0.55, a + ki, 0)).premultiply(camera.quaternion);
          kit.mesh.setMatrixAt(kit.list.length, m4.compose(sampleAt, qs, s.set(...sample).multiplyScalar(ts)));
          kit.list.forEach((p, i) => {
            const w = waveIdx[ki].get(p);
            // a copy drops onto the hull along the face normal and snaps on (a small overshoot), then later lifts off
            const go = span(t, WAVE[ki] + w * SPREAD[ki], WAVE[ki] + w * SPREAD[ki] + SNAP);
            const off = ease.inOut(span(t, BACK + (1 - w) * BACK_SPREAD, BACK + (1 - w) * BACK_SPREAD + BACK_SNAP));
            const k = go < 1 ? go : 1 - off;
            if (k <= 0) { kit.mesh.setMatrixAt(i, m4.makeScale(0, 0, 0)); return; }
            const grow = go < 1 ? ease.outBack(k) : ease.out(k), drop = go < 1 ? ease.out(k) : ease.inOut(k);
            nrm.copy(p.normal).transformDirection(ship.matrixWorld);
            to.copy(p.pos).applyMatrix4(ship.matrixWorld).addScaledVector(nrm, 0.45 * (1 - drop));
            q.setFromUnitVectors(up, p.normal).multiply(new THREE.Quaternion().setFromAxisAngle(up, p.spin)).premultiply(ship.getWorldQuaternion(new THREE.Quaternion()));
            kit.mesh.setMatrixAt(i, m4.compose(to, q, s.set(...p.scale).multiplyScalar(Math.max(0, grow))));
          });
          kit.mesh.instanceMatrix.needsUpdate = true;
        });
      },
    };
  },
  // tray labels, the slot of the kit being placed, and the count of placed copies
  overlay(ctx, t, W, H) {
    const on = waveOf(t);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    KIT.forEach((name, k) => {
      const x = 48 + (k % 4) * 250, y = 1458 + Math.floor(k / 4) * 200;
      if (on[k] > 0.01) {
        ctx.strokeStyle = `rgba(255, 170, 90, ${0.9 * on[k]})`; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.roundRect(x, y, 234, 186, 20); ctx.stroke();
      }
      ctx.font = `600 22px ${FONT.sans}`; ctx.fillStyle = `rgba(${200 + 55 * on[k]}, ${212 - 30 * on[k]}, ${245 - 110 * on[k]}, ${0.8 + 0.2 * on[k]})`;
      ctx.fillText(name, x + 117, y + 160);
    });
    ctx.font = `700 30px ${FONT.sans}`; ctx.fillStyle = 'rgba(230, 236, 255, 0.92)';
    ctx.fillText('KIT PARTS', W / 2, 1404);
  },
};
