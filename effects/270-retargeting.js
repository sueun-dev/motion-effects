// Retargeting: one dance clip (a step-touch to the right and back, then to the left and back, eight beats) recorded
// on a source skeleton is played on three bodies with other proportions: a tall slim figure, a short round one and
// a robot. The upper body copies the source's joint rotations as they are (torso sway and twist, arm swings, elbow
// bends, head nod). The root path and the foot targets are scaled by the ratio of leg lengths, so a longer-legged
// body takes wider steps at the same beat, and each leg is solved by two-bone IK (law of cosines, knee forward) to
// reach its target: a planted foot stays exactly where it landed. The rings on the floor light under planted feet.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TAU, smoothstep, ease, FONT } from '../lib/util.js';

const BEAT = 0.625;                                                   // eight beats in the 5 s loop
// the bodies: leg = hip height, [thigh, shin] share of it, spine, neck, head radius, shoulder and hip half-widths,
// upper arm, forearm, the stage x and the scale it is drawn at
const BODIES = {
  source: { leg: 0.9, spine: 0.5, neck: 0.1, head: 0.11, sw: 0.19, hw: 0.1, ua: 0.29, fa: 0.27, x: 0.25, y: 2.75, s: 0.8 },
  tall: { leg: 1.12, spine: 0.62, neck: 0.14, head: 0.12, sw: 0.18, hw: 0.1, ua: 0.38, fa: 0.36, x: -1.45, y: 0, s: 1 },
  round: { leg: 0.5, spine: 0.42, neck: 0.04, head: 0.2, sw: 0.27, hw: 0.14, ua: 0.22, fa: 0.2, x: 0.05, y: 0, s: 1 },
  robot: { leg: 0.78, spine: 0.55, neck: 0.1, head: 0.15, sw: 0.3, hw: 0.14, ua: 0.36, fa: 0.36, x: 1.5, y: 0, s: 1 },
};

// the source clip: per beat, which foot moves and by how much (in source leg lengths); feet start 0.13 apart
const MOVES = [[1, 0.36], [0, 0.36], [0, -0.36], [1, -0.36], [0, -0.36], [1, -0.36], [1, 0.36], [0, 0.36]];
// foot positions [x, lift] for both feet at time t, in leg lengths, and how planted each is (0..1)
function feet(t) {
  const x = [-0.13, 0.13], lift = [0, 0], planted = [1, 1], b = Math.floor(t / BEAT) % 8, u = (t - Math.floor(t / BEAT) * BEAT) / BEAT;
  for (let i = 0; i < b; i++) x[MOVES[i][0]] += MOVES[i][1];
  const [f, d] = MOVES[b], k = ease.inOut(smoothstep(0.1, 0.8, u));
  x[f] += d * k; lift[f] = 0.14 * Math.sin(Math.PI * smoothstep(0.1, 0.8, u));
  planted[f] = 1 - Math.sin(Math.PI * smoothstep(0.05, 0.85, u));
  return { x, lift, planted };
}
// the rest of the source clip, as joint rotations (radians) and the root's bounce and sway (leg lengths)
function clip(t) {
  const a = (TAU * t) / (2 * BEAT), { x } = feet(t);                 // a = one swing per two beats
  return {
    rootX: (x[0] + x[1]) / 2 + 0.03 * Math.sin(a), bounce: 0.035 * (1 - Math.cos(2 * a)),
    lean: 0.09 * Math.sin(a), twist: 0.22 * Math.sin(a), nod: 0.12 * Math.sin(2 * a + 0.6),
    arm: [0.55 * Math.sin(a), -0.55 * Math.sin(a)], spread: 0.3 + 0.12 * Math.cos(2 * a), elbow: [1.0 + 0.45 * Math.cos(a), 1.0 - 0.45 * Math.cos(a)],
  };
}

// the joints of body B at time t, in metres in its own space: the same rotations, the root and feet scaled by leg
// length, and each leg solved by two-bone IK
function joints(B, t) {
  const c = clip(t), F = feet(t), L = B.leg, v = (x, y, z) => new THREE.Vector3(x, y, z);
  const root = v(c.rootX * L, L * (0.97 - c.bounce), 0);
  const up = v(0, 1, 0).applyAxisAngle(v(0, 0, 1), -c.lean), right = v(1, 0, 0).applyAxisAngle(v(0, 1, 0), c.twist).applyAxisAngle(v(0, 0, 1), -c.lean);
  const fwd = new THREE.Vector3().crossVectors(right, up);
  const chest = root.clone().addScaledVector(up, B.spine), neck = chest.clone().addScaledVector(up, B.neck);
  const headUp = up.clone().applyAxisAngle(right, -c.nod), head = neck.clone().addScaledVector(headUp, B.head * 1.1);
  const J = { root, chest, neck, head, fwd, right, arms: [], legs: [], planted: F.planted };
  [-1, 1].forEach((s, i) => {
    const sh = chest.clone().addScaledVector(right, s * B.sw).addScaledVector(up, -0.04);
    const dir = up.clone().negate().applyAxisAngle(right, -c.arm[i]).applyAxisAngle(fwd, s * c.spread * 0.6);
    const el = sh.clone().addScaledVector(dir, B.ua);
    const fdir = dir.clone().applyAxisAngle(right.clone().multiplyScalar(1), -c.elbow[i]);
    J.arms.push([sh, el, el.clone().addScaledVector(fdir, B.fa)]);
    const hip = root.clone().addScaledVector(right, s * B.hw);
    const foot = v(F.x[i] * L + s * 0.0, F.lift[i] * L + 0.05 * L, 0.04 * L);
    const thigh = 0.5 * L * 0.98, shin = 0.5 * L * 0.98, d = foot.clone().sub(hip), D = Math.min(d.length(), thigh + shin - 1e-4);
    const dn = d.normalize(), bend = v(0, 0, 1).addScaledVector(dn, -dn.z).normalize();
    const al = Math.acos(Math.min(1, (thigh * thigh + D * D - shin * shin) / (2 * thigh * D)));
    const knee = hip.clone().addScaledVector(dn, thigh * Math.cos(al)).addScaledVector(bend, thigh * Math.sin(al));
    J.legs.push([hip, knee, hip.clone().addScaledVector(dn, D)]);
  });
  return J;
}

export default {
  name: 'Retargeting',
  ko: '리타기팅',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#1A1D2B');
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
    const key = new THREE.DirectionalLight('#FFF0DE', 2.3);
    key.position.set(-3, 7, 6); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -4, right: 4, top: 5, bottom: -2, near: 1, far: 30 });
    key.shadow.bias = -0.0004; key.shadow.radius = 4;
    scene.add(key, new THREE.HemisphereLight('#BFD0FF', '#3A2A3A', 0.8));
    const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 100);
    camera.position.set(0, 2.6, 11.2);
    camera.lookAt(0, 2.05, 0);

    // the stage, and the source's floating platform
    const stage = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.5, 0.2, 96), new THREE.MeshStandardMaterial({ color: '#2B3045', roughness: 0.6 }));
    stage.position.y = -0.1; stage.receiveShadow = true; scene.add(stage);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.05, 64), new THREE.MeshStandardMaterial({ color: '#232A3D', emissive: '#2D7FA8', emissiveIntensity: 0.35 }));
    pad.position.set(BODIES.source.x, BODIES.source.y - 0.03, 0); scene.add(pad);

    const up = new THREE.Vector3(0, 1, 0);
    const along = (m, a, b) => { const d = b.clone().sub(a); m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(up, d.normalize()); };
    // a body: a mesh for each bone (placed along it every frame), plus head, torso and feet; style picks the look
    const build = (name, mat, dark, kind) => {
      const B = BODIES[name], g = new THREE.Group(), add = (geo, m) => { const x = new THREE.Mesh(geo, m); x.castShadow = true; g.add(x); return x; };
      g.position.set(B.x, B.y, 0); g.scale.setScalar(B.s); g.rotation.y = -0.5; scene.add(g);   // turned three-quarters to us
      const bone = (len, r) => kind === 'robot' ? add(new RoundedBoxGeometry(r * 2, len, r * 2, 2, r * 0.4), mat) : add(new THREE.CapsuleGeometry(r, len, 6, 14), mat);
      const r = kind === 'source' ? 0.018 : kind === 'round' ? 0.07 : 0.055;
      const parts = {
        B, g,
        spine: kind === 'round' ? add(new THREE.SphereGeometry(0.3, 40, 28).scale(1, 1.05, 0.9), mat) : kind === 'robot' ? add(new RoundedBoxGeometry(0.5, B.spine + 0.08, 0.3, 3, 0.05), mat) : bone(B.spine, kind === 'source' ? r : 0.12),
        head: kind === 'robot' ? add(new RoundedBoxGeometry(0.26, 0.24, 0.24, 3, 0.04), mat) : add(new THREE.SphereGeometry(kind === 'source' ? 0.07 : B.head, 32, 20), kind === 'source' ? dark : mat),
        arms: [0, 1].map(() => [bone(B.ua, r * 0.9), bone(B.fa, r * 0.85)]),
        legs: [0, 1].map(() => [bone(0.49 * B.leg, r * 1.1), bone(0.49 * B.leg, r)]),
        dots: Array.from({ length: 12 }, () => add(new THREE.SphereGeometry(kind === 'source' ? 0.035 : r * 1.25, 16, 10), dark)),
        feet: [0, 1].map(() => add(new RoundedBoxGeometry(0.12, 0.06, 0.2 * Math.max(0.8, B.leg), 2, 0.02), dark)),
        eyes: kind === 'tall' || kind === 'round' ? [0, 1].map(() => add(new THREE.SphereGeometry(B.head * 0.16, 12, 8), dark)) : [],
        visor: kind === 'robot' ? add(new THREE.BoxGeometry(0.2, 0.05, 0.02), new THREE.MeshStandardMaterial({ color: '#7DF9FF', emissive: '#3DE8FF', emissiveIntensity: 1.5 })) : null,
        rings: kind === 'source' ? [] : [0, 1].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(0.11, 0.15, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#7DF9FF', transparent: true })); g.add(m); return m; }),
      };
      return parts;
    };
    const bodies = [
      build('source', new THREE.MeshStandardMaterial({ color: '#7DF9FF', emissive: '#29B6D8', emissiveIntensity: 1.2 }), new THREE.MeshStandardMaterial({ color: '#E8FBFF', emissive: '#7DF9FF', emissiveIntensity: 1 }), 'source'),
      build('tall', new THREE.MeshStandardMaterial({ color: '#B9A7FF', roughness: 0.45 }), new THREE.MeshStandardMaterial({ color: '#3B3266', roughness: 0.5 }), 'tall'),
      build('round', new THREE.MeshStandardMaterial({ color: '#FF9F5A', roughness: 0.45 }), new THREE.MeshStandardMaterial({ color: '#6B3418', roughness: 0.5 }), 'round'),
      build('robot', new THREE.MeshStandardMaterial({ color: '#B7C0CC', roughness: 0.3, metalness: 0.8 }), new THREE.MeshStandardMaterial({ color: '#2E3440', roughness: 0.4, metalness: 0.6 }), 'robot'),
    ];

    return {
      scene, camera,
      update(t) {
        for (const P of bodies) {
          const J = joints(P.B, t);
          along(P.spine, J.root, J.neck); P.spine.position.lerpVectors(J.root, J.neck, 0.5);
          P.head.position.copy(J.head); P.head.quaternion.setFromUnitVectors(up, J.head.clone().sub(J.neck).normalize());
          if (P.visor) { P.visor.position.copy(J.head).addScaledVector(J.fwd, 0.125).addScaledVector(up, 0.02); P.visor.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(J.right, up, J.fwd)); }
          P.eyes.forEach((e, i) => e.position.copy(J.head).addScaledVector(J.fwd, P.B.head * 0.88).addScaledVector(J.right, (i ? 1 : -1) * P.B.head * 0.36).addScaledVector(up, P.B.head * 0.15));
          const pts = [];
          J.arms.forEach(([s, e, h], i) => { along(P.arms[i][0], s, e); along(P.arms[i][1], e, h); pts.push(s, e, h); });
          J.legs.forEach(([hp, k, f], i) => {
            along(P.legs[i][0], hp, k); along(P.legs[i][1], k, f); pts.push(hp, k);
            P.feet[i].position.copy(f).add(new THREE.Vector3(0, -0.02 * P.B.leg, 0.05));
            if (P.rings[i]) { P.rings[i].position.set(f.x, 0.012, f.z); P.rings[i].material.opacity = 0.9 * J.planted[i]; }
          });
          pts.push(J.neck, J.root);
          P.dots.forEach((d, i) => d.position.copy(pts[i]));
        }
      },
    };
  },
  overlay(ctx) {
    ctx.textAlign = 'center';
    const tag = (x, y, name, sub) => {
      ctx.font = `800 30px ${FONT.sans}`; ctx.fillStyle = '#FFFFFF'; ctx.fillText(name, x, y);
      ctx.font = `500 24px ${FONT.sans}`; ctx.fillStyle = 'rgba(255, 255, 255, 0.62)'; ctx.fillText(sub, x, y + 34);
    };
    tag(540, 860, 'SOURCE CLIP', 'leg 0.90 m');
    tag(205, 1555, 'TALL', 'leg 1.12 m · ×1.24');
    tag(560, 1555, 'ROUND', 'leg 0.50 m · ×0.56');
    tag(905, 1555, 'ROBOT', 'leg 0.78 m · ×0.87');
  },
};
