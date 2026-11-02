// Optical motion capture: a performer in a dark suit with 33 retro-reflective markers moves through a slow tai-chi
// loop (weight shift, squat, cloud hands; the legs are two-bone IK, so the feet stay planted) inside a ring of twelve
// infrared cameras with red LED rings. Rays from the cameras meet at two markers at a time: every marker seen
// from two or more cameras is triangulated to a 3D point. Then the suit fades and only the marker cloud is left, the
// solver joins the points into a skeleton bone by bone, a character is built on that skeleton and moves exactly as
// the performer did, and it hands back to the performer. The inset shows what camera 3 sees: bright dots on black.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TAU, clamp, smoothstep, FONT } from '../lib/util.js';

const RING = 12, RING_R = 3.4, RING_H = 2.6;
const STAGES = [['CAPTURE', 'cameras see the markers'], ['MARKERS', 'triangulated 3D points'], ['SOLVE', 'markers fitted to a skeleton'], ['CHARACTER', 'the skeleton drives a model']];
// how much of each layer shows at time t (0..1): the suit, the bones, the character
const suitA = t => 1 - smoothstep(1.3, 1.9, t) + smoothstep(4.3, 4.95, t);
const boneA = t => smoothstep(2.1, 2.9, t) * (1 - smoothstep(4.1, 4.6, t));
const charA = t => smoothstep(3.0, 3.6, t) * (1 - smoothstep(4.2, 4.8, t));
// how lit each step of the list is at time t: steps 2-4 have windows, step 1 is lit the rest of the loop
const lit = t => {
  const w = [[1.5, 2.15], [2.15, 3.05], [3.05, 4.4]].map(([a, b]) => smoothstep(a - 0.1, a + 0.1, t) * (1 - smoothstep(b - 0.1, b + 0.1, t)));
  return [1 - w[0] - w[1] - w[2], ...w];
};

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
// the performer's joints at time t (metres)
function pose(t) {
  const a = (TAU * t) / 5, J = {};
  const yaw = 0.42 * Math.sin(a), squat = 0.11 * (0.5 - 0.5 * Math.cos(2 * a));
  J.hips = v3(0.17 * Math.sin(a), 0.95 - squat, 0.02);
  const rot = new THREE.Euler(0.06 + 0.08 * (0.5 - 0.5 * Math.cos(2 * a)), yaw, -0.07 * Math.sin(a), 'YXZ');
  const up = v3(0, 1, 0).applyEuler(rot), right = v3(1, 0, 0).applyEuler(rot), fwd = v3(0, 0, 1).applyEuler(rot);
  J.chest = J.hips.clone().addScaledVector(up, 0.48);
  J.neck = J.chest.clone().addScaledVector(up, 0.12);
  J.head = J.neck.clone().addScaledVector(up, 0.13).addScaledVector(fwd, 0.02);
  J.fwd = fwd; J.right = right; J.up = up;
  for (const s of [-1, 1]) {
    const side = s < 0 ? 'L' : 'R', ph = a + (s < 0 ? 0 : Math.PI);       // cloud hands: the arms circle in turn
    const sh = J.chest.clone().addScaledVector(right, 0.19 * s).addScaledVector(up, -0.03);
    const raise = 0.75 + 0.55 * Math.sin(ph), sweep = 0.45 * Math.cos(ph) * -s;
    const dir = up.clone().negate().applyAxisAngle(right, -raise).applyAxisAngle(up, sweep).applyAxisAngle(fwd, s * 0.25);
    const el = sh.clone().addScaledVector(dir, 0.3);
    const fdir = dir.clone().applyAxisAngle(right, -(0.7 + 0.35 * Math.cos(ph)));
    J['sh' + side] = sh; J['el' + side] = el; J['wr' + side] = el.clone().addScaledVector(fdir, 0.27);
    J['ha' + side] = J['wr' + side].clone().addScaledVector(fdir, 0.08);
    // legs: the foot stays planted, the knee is found by two-bone IK (law of cosines, bending forward)
    const hip = J.hips.clone().addScaledVector(right, 0.1 * s), foot = v3(0.24 * s, 0.07, 0.06);
    const d = foot.clone().sub(hip), D = Math.min(d.length(), 0.899), dn = d.clone().normalize();
    const bend = v3(0, 0, 1).addScaledVector(dn, -dn.z).normalize(), al = Math.acos(clamp(D / 0.9));
    J['hp' + side] = hip; J['kn' + side] = hip.clone().addScaledVector(dn, 0.45 * Math.cos(al)).addScaledVector(bend, 0.45 * Math.sin(al));
    J['an' + side] = hip.clone().addScaledVector(dn, D); J['to' + side] = J['an' + side].clone().add(v3(0.02 * s, -0.05, 0.16));
  }
  return J;
}
// bones as joint pairs, and markers as points along bones with a small push outwards
const BONES = [['hips', 'chest'], ['chest', 'neck'], ['neck', 'head'], ...['L', 'R'].flatMap(s => [
  ['chest', 'sh' + s], ['sh' + s, 'el' + s], ['el' + s, 'wr' + s], ['wr' + s, 'ha' + s], ['hips', 'hp' + s], ['hp' + s, 'kn' + s], ['kn' + s, 'an' + s], ['an' + s, 'to' + s]])];
const MARKERS = [['head', 'head', 0, 0.12, 'up'], ['head', 'head', 0, 0.11, 'fwd'], ['neck', 'chest', 0.5, 0.11, 'fwd'], ['hips', 'chest', 0.4, 0.13, 'fwd'],
  ['hips', 'hips', 0, 0.14, 'fwd'], ['neck', 'neck', 0, 0.1, 'back'], ['hips', 'chest', 0.5, 0.12, 'back'],
  ...['L', 'R'].flatMap(s => [['sh' + s, 'sh' + s, 0, 0.06, 'up'], ['sh' + s, 'el' + s, 0.5, 0.05, 'fwd'], ['el' + s, 'el' + s, 0, 0.05, 'back'], ['el' + s, 'wr' + s, 0.5, 0.045, 'fwd'],
    ['wr' + s, 'wr' + s, 0, 0.04, 'up'], ['ha' + s, 'ha' + s, 0, 0.03, 'fwd'], ['hp' + s, 'hp' + s, 0, 0.08, 'fwd'], ['hp' + s, 'kn' + s, 0.5, 0.07, 'fwd'],
    ['kn' + s, 'kn' + s, 0, 0.06, 'fwd'], ['kn' + s, 'an' + s, 0.5, 0.05, 'fwd'], ['an' + s, 'an' + s, 0, 0.05, 'back'], ['to' + s, 'to' + s, 0, 0.03, 'up']])];
function markers(J) {
  return MARKERS.map(([a, b, k, r, dir]) => {
    const n = dir === 'up' ? J.up : dir === 'back' ? J.fwd.clone().negate() : J.fwd;
    return J[a].clone().lerp(J[b], k).addScaledVector(n, r);
  });
}
const lens = k => { const a = (k / RING) * TAU + Math.PI / RING; return v3(RING_R * Math.sin(a), RING_H, RING_R * Math.cos(a)); };
let irCam;   // camera 3's view, for the inset

export default {
  name: 'Motion Capture',
  ko: '모션 캡처',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0E1118');
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.35;
    const key = new THREE.SpotLight('#FFFFFF', 60, 20, 0.6, 0.6);
    key.position.set(1.5, 7, 3); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
    scene.add(key, new THREE.HemisphereLight('#9FB4E8', '#1A1A22', 0.6));

    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 100);
    camera.position.set(0, 2.4, 6.4);
    camera.lookAt(0, 0.95, 0);
    irCam = new THREE.PerspectiveCamera(40, 1, 0.1, 30);
    irCam.position.copy(lens(2)); irCam.lookAt(0, 1.0, 0); irCam.updateMatrixWorld();

    // the floor: dark grey with taped capture area and a soft grid
    const fc = document.createElement('canvas');
    fc.width = fc.height = 2048;
    const g = fc.getContext('2d');
    g.fillStyle = '#20232B'; g.fillRect(0, 0, 2048, 2048);
    g.strokeStyle = 'rgba(255, 255, 255, 0.07)'; g.lineWidth = 4;
    for (let k = 0; k <= 16; k++) { g.beginPath(); g.moveTo(k * 128, 0); g.lineTo(k * 128, 2048); g.moveTo(0, k * 128); g.lineTo(2048, k * 128); g.stroke(); }
    g.strokeStyle = '#D9B648'; g.lineWidth = 9; g.beginPath(); g.arc(1024, 1024, 256, 0, TAU); g.stroke();   // the 4 m capture circle
    const ftex = new THREE.CanvasTexture(fc);
    ftex.colorSpace = THREE.SRGBColorSpace; ftex.anisotropy = 8;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: ftex, roughness: 0.85 }));
    floor.receiveShadow = true; scene.add(floor);

    // the camera ring: tripods, bodies and red LED rings round the lenses
    const dark = new THREE.MeshStandardMaterial({ color: '#2B2F3A', roughness: 0.4, metalness: 0.6 });
    const led = new THREE.MeshStandardMaterial({ color: '#FF3B3B', emissive: '#FF2A2A', emissiveIntensity: 2.2 });
    for (let k = 0; k < RING; k++) {
      const p = lens(k), cam = new THREE.Group();
      cam.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.32), dark));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 10, 32), led); ring.position.z = -0.17; cam.add(ring);
      cam.position.copy(p); cam.lookAt(0, 1.0, 0); cam.rotateY(Math.PI);
      scene.add(cam);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, RING_H, 10), dark);
      pole.position.set(p.x, RING_H / 2 - 0.1, p.z); scene.add(pole);
    }

    // a capsule we can stretch between two points (unit length along y)
    const unitCapsule = r => new THREE.CapsuleGeometry(r, 1, 6, 16);
    const up = v3(0, 1, 0), tmp = new THREE.Vector3();
    const stretch = (m, a, b, r) => { tmp.subVectors(b, a); m.position.copy(a).addScaledVector(tmp, 0.5); m.quaternion.setFromUnitVectors(up, tmp.clone().normalize()); m.scale.set(1, Math.max(0.001, tmp.length() - 2 * r) , 1); };
    const RADII = { hips: 0.15, chest: 0.13, neck: 0.05, head: 0.05, sh: 0.055, el: 0.045, wr: 0.035, hp: 0.075, kn: 0.06, an: 0.05 };
    const radius = ([a, b]) => RADII[b.replace(/[LR]$/, '')] || 0.04;
    // the suit
    const suitMat = new THREE.MeshStandardMaterial({ color: '#30343F', roughness: 0.85, transparent: true });
    const suit = BONES.map(bn => { const m = new THREE.Mesh(unitCapsule(radius(bn)), suitMat); m.castShadow = true; scene.add(m); return { m, bn, r: radius(bn) }; });
    const suitHead = new THREE.Mesh(new THREE.SphereGeometry(0.115, 32, 20), suitMat); suitHead.castShadow = true; scene.add(suitHead);
    // the character: chunky teal limbs, orange joints, a helmet with a glowing visor
    const charMat = new THREE.MeshPhysicalMaterial({ color: '#2EC4B6', roughness: 0.35, clearcoat: 0.6, transparent: true });
    const jointMat = new THREE.MeshPhysicalMaterial({ color: '#FF9F1C', roughness: 0.3, clearcoat: 0.6, transparent: true });
    const visorMat = new THREE.MeshStandardMaterial({ color: '#BFF8FF', emissive: '#6FF2FF', emissiveIntensity: 1.6, transparent: true });
    const chars = BONES.map(bn => { const r = radius(bn) * 1.25; const m = new THREE.Mesh(unitCapsule(r), charMat); scene.add(m); return { m, bn, r }; });
    const charJoints = ['chest', 'hips', 'shL', 'shR', 'elL', 'elR', 'knL', 'knR', 'hpL', 'hpR'].map(j => { const m = new THREE.Mesh(new THREE.SphereGeometry(j === 'chest' || j === 'hips' ? 0.1 : 0.07, 20, 14), jointMat); scene.add(m); return { m, j }; });
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.15, 32, 20), charMat); scene.add(helmet);
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.152, 32, 16, -0.9, 1.8, 1.1, 0.75), visorMat); scene.add(visor);
    // the solved skeleton: thin glowing bones
    const boneMat = new THREE.MeshBasicMaterial({ color: '#7DF9FF', transparent: true });
    const bones = BONES.map(bn => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1, 10), boneMat); scene.add(m); return { m, bn }; });
    // markers: bright spheres; rays: thin red beams from the lenses
    const markerMat = new THREE.MeshStandardMaterial({ color: '#F4F6FF', emissive: '#DDE6FF', emissiveIntensity: 0.9, roughness: 0.2 });
    const dots = MARKERS.map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.024, 16, 12), markerMat); scene.add(m); return m; });
    const rays = [...Array(2 * RING)].map(() => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 1, 8), new THREE.MeshBasicMaterial({ color: '#FF5A4E', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      scene.add(m); return m;
    });
    const hits = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.065, 32), new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, side: THREE.DoubleSide, depthWrite: false })); scene.add(m); return m; });

    return {
      scene, camera,
      update(t) {
        const J = pose(t), M = markers(J), sA = suitA(t), bA = boneA(t), cA = charA(t);
        suitMat.opacity = sA; suitMat.depthWrite = sA > 0.99;
        for (const { m, bn, r } of suit) { stretch(m, J[bn[0]], J[bn[1]], r); m.visible = sA > 0.005; }
        suitHead.position.copy(J.head); suitHead.visible = sA > 0.005;
        for (const mat of [charMat, jointMat, visorMat]) { mat.opacity = cA; mat.depthWrite = cA > 0.99; }
        for (const { m, bn, r } of chars) { stretch(m, J[bn[0]], J[bn[1]], r); m.visible = cA > 0.005; }
        for (const { m, j } of charJoints) { m.position.copy(J[j]); m.visible = cA > 0.005; }
        helmet.position.copy(J.head); visor.position.copy(J.head);
        visor.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(J.right, J.up, J.fwd));
        helmet.visible = visor.visible = cA > 0.005;
        // bones grow out one after another, from the hips outwards
        bones.forEach(({ m, bn }, i) => {
          const g = clamp((t - 2.1 - i * 0.035) / 0.25) * (1 - smoothstep(4.1, 4.6, t));
          m.visible = g > 0.01;
          if (m.visible) stretch(m, J[bn[0]], J[bn[0]].clone().lerp(J[bn[1]], g), 0);
        });
        boneMat.opacity = Math.max(0.15, bA);
        dots.forEach((d, i) => { d.position.copy(M[i]); d.scale.setScalar(1 - 0.6 * cA); });
        // two markers at a time are triangulated: rays from all eight lenses, faded in and out
        for (let q = 0; q < 2; q++) {
          const slot = t * 2.4 + q * 0.5, idx = ((Math.floor(slot) % 12) * 7 + q * 11) % MARKERS.length, u = slot - Math.floor(slot);   // 12 per loop
          const a = Math.sin(Math.PI * u) ** 2 * (1 - 0.85 * smoothstep(2.2, 3.0, t) * (1 - smoothstep(4.3, 4.9, t)));
          for (let k = 0; k < RING; k++) {
            const ray = rays[q * RING + k], p = lens(k);
            stretch(ray, p, M[idx], 0); ray.material.opacity = 0.55 * a; ray.visible = a > 0.01;
          }
          hits[q].position.copy(M[idx]); hits[q].lookAt(camera.position);
          hits[q].scale.setScalar(1 + 0.6 * u); hits[q].material.opacity = a;
        }
      },
    };
  },
  overlay(ctx, t, W, H) {
    // a dark band behind the read-outs, so floor lines never run through the text
    const band = ctx.createLinearGradient(0, 1340, 0, 1460);
    band.addColorStop(0, 'rgba(14, 17, 24, 0)'); band.addColorStop(1, 'rgba(14, 17, 24, 0.92)');
    ctx.fillStyle = band; ctx.fillRect(0, 1340, W, H - 1340);
    // the IR view of camera 3: the markers as bright dots on black
    const x0 = 70, y0 = 1400, S = 380, M = markers(pose(t));
    ctx.fillStyle = 'rgba(0, 0, 0, 0.88)'; ctx.strokeStyle = 'rgba(255, 90, 78, 0.6)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(x0, y0, S, S, 22); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.roundRect(x0, y0, S, S, 22); ctx.clip();
    for (const p of M) {
      const q = p.clone().project(irCam), x = x0 + (q.x * 0.5 + 0.5) * S, y = y0 + (0.5 - q.y * 0.5) * S;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 11);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(235,240,255,0.85)'); g.addColorStop(1, 'rgba(200,215,255,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 11, y - 11, 22, 22);
    }
    ctx.restore();
    ctx.font = `700 24px ${FONT.mono}`; ctx.fillStyle = '#FF7A6E'; ctx.textAlign = 'left';
    ctx.fillText('CAM 3 · IR', x0 + 20, y0 + 40);
    // the pipeline, with the current step lit
    const on = lit(t), lx = 500;
    STAGES.forEach(([name, sub], k) => {
      const y = 1440 + k * 92;
      ctx.globalAlpha = 0.38 + 0.62 * on[k];
      ctx.fillStyle = on[k] > 0.5 ? '#7DF9FF' : '#8D96AE';
      ctx.beginPath(); ctx.arc(lx + 14, y - 10, 14, 0, TAU); ctx.fill();
      ctx.fillStyle = '#0E1118'; ctx.font = `800 18px ${FONT.sans}`; ctx.textAlign = 'center'; ctx.fillText(`${k + 1}`, lx + 14, y - 3);
      ctx.textAlign = 'left'; ctx.fillStyle = '#FFFFFF'; ctx.font = `700 30px ${FONT.sans}`; ctx.fillText(name, lx + 44, y);
      ctx.fillStyle = 'rgba(220, 228, 245, 0.75)'; ctx.font = `500 22px ${FONT.sans}`; ctx.fillText(sub, lx + 44, y + 30);
    });
    ctx.globalAlpha = 1;
  },
};
