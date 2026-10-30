// Gimbal lock: the same two orientations, interpolated two ways. Top: three gimbal rings driven by Euler angles
// (yaw, then pitch, then roll) blended linearly; halfway the pitch ring reaches -90 degrees, the yaw and pitch rings
// fold into one plane, and the plane makes a needless barrel roll. Bottom: quaternion slerp turns it about one
// fixed axis at a steady rate. The traced paths of each nose and wingtip show the difference.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TAU, FONT, clamp } from '../lib/util.js';

const D = Math.PI / 180;
const A = [-90, -45, -90], B = [-15, -135, 90]; // yaw, pitch, roll in degrees: the pitch passes -90 halfway
const TOP = 1.4, BOTTOM = -3.05;                 // heights of the two rigs
const blend = t => 0.5 - 0.5 * Math.sin(t / 5 * TAU); // halfway (locked) at 0 s, A at 1.25 s, B at 3.75 s
const euler = k => A.map((a, i) => a + (B[i] - a) * k);
const quat = e => new THREE.Quaternion().setFromEuler(new THREE.Euler(e[1] * D, e[0] * D, e[2] * D, 'YXZ'));
const qA = quat(A), qB = quat(B);
const lock = k => clamp(1 - Math.abs(euler(k)[1] + 90) / 14); // 1 at pitch -90

function plane() {
  const g = new THREE.Group(), m = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.15 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.95, 8, 24), m('#F5F2EA'));
  body.rotation.x = Math.PI / 2;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.28, 24), m('#FF6B4A'));
  nose.rotation.x = Math.PI / 2; nose.position.z = 0.68;
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 0.3), m('#FF6B4A'));
  wing.position.set(0, 0, 0.05);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.03, 0.14), m('#FFC93C'));
  tail.position.set(0, 0, -0.52);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.2), m('#FFC93C'));
  fin.position.set(0, 0.17, -0.5);
  g.add(body, nose, wing, tail, fin);
  return g;
}

// a thin tube through the points a local point (nose or wingtip) passes, from A to B
function trace(points, color) {
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 200, 0.022, 10);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }));
}

export default {
  name: 'Gimbal Lock',
  ko: '짐벌 락',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas');
    bg.width = 4; bg.height = 512;
    const g = bg.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#10162B'); grd.addColorStop(0.5, '#1B2444'); grd.addColorStop(1, '#0E1326');
    g.fillStyle = grd; g.fillRect(0, 0, 4, 512);
    scene.background = new THREE.CanvasTexture(bg);
    scene.background.colorSpace = THREE.SRGBColorSpace;
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.8;
    scene.add(new THREE.HemisphereLight('#DDE6FF', '#202640', 0.6));
    const key = new THREE.DirectionalLight('#FFFFFF', 1.6);
    key.position.set(-4, 6, 8);
    scene.add(key);

    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
    camera.position.set(1.8, 1.4, 19.4);
    camera.lookAt(0, 0, 0);

    // --- top: the gimbal. Outer ring turns about Y (yaw), middle about X (pitch), inner about Z (roll).
    const ringMat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, metalness: 0.55, emissive: '#FFB020', emissiveIntensity: 0 });
    const ring = (r, mat) => new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 20, 160), mat);
    const pin = (x, y, z, rot) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.26, 16), new THREE.MeshStandardMaterial({ color: '#D9C27A', metalness: 0.8, roughness: 0.3 }));
      m.position.set(x, y, z); m.rotation.set(...rot);
      return m;
    };
    const yawMat = ringMat('#5BD27A'), pitchMat = ringMat('#FF5A5F'), rollMat = ringMat('#4C8DFF');
    const yawG = new THREE.Group(), pitchG = new THREE.Group(), rollG = new THREE.Group();
    yawG.add(ring(1.62, yawMat), pin(0, 1.75, 0, [0, 0, 0]), pin(0, -1.75, 0, [0, 0, 0]));        // ring in XY, axis Y
    const pitchRing = ring(1.4, pitchMat); pitchRing.rotation.x = Math.PI / 2;                     // ring in XZ, axis X
    pitchG.add(pitchRing, pin(1.51, 0, 0, [0, 0, Math.PI / 2]), pin(-1.51, 0, 0, [0, 0, Math.PI / 2]));
    const rollRing = ring(1.18, rollMat); rollRing.rotation.y = Math.PI / 2;                       // ring in YZ, axis Z
    rollG.add(rollRing, pin(0, 0, 1.29, [Math.PI / 2, 0, 0]), pin(0, 0, -1.29, [Math.PI / 2, 0, 0]));
    const planeTop = plane();
    rollG.add(planeTop); pitchG.add(rollG); yawG.add(pitchG);
    const rigTop = new THREE.Group();
    rigTop.position.y = TOP;
    rigTop.rotation.y = 0.6; // both rigs are seen from the same three-quarter angle
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 4.1, 12), new THREE.MeshBasicMaterial({ color: '#5BD27A', transparent: true, opacity: 0.45 }));
    rigTop.add(yawG, axle); // the fixed yaw axis
    scene.add(rigTop);

    // --- bottom: slerp. The plane turns about one axis (the arrow) inside a glass ball.
    const rigBottom = new THREE.Group();
    rigBottom.position.y = BOTTOM;
    rigBottom.rotation.y = 0.6;
    const planeBottom = plane();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1.45, 64, 48), new THREE.MeshStandardMaterial({ color: '#9FD8FF', transparent: true, opacity: 0.1, roughness: 0.1, metalness: 0.2, depthWrite: false }));
    const dq = qA.clone().invert().premultiply(qB); // qB = dq * qA
    const axis = new THREE.Vector3(dq.x, dq.y, dq.z).normalize();
    const axisG = new THREE.Group();
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.3, 16), new THREE.MeshBasicMaterial({ color: '#7FF3FF' }));
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.26, 24), rod.material);
    tip.position.y = 1.75;
    const equator = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.012, 8, 200), new THREE.MeshBasicMaterial({ color: '#7FF3FF', transparent: true, opacity: 0.45 }));
    equator.rotation.x = Math.PI / 2;
    axisG.add(rod, tip, equator);
    axisG.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
    rigBottom.add(planeBottom, ball, axisG);
    scene.add(rigBottom);

    // traced paths of the nose and the left wingtip, Euler (top) and slerp (bottom)
    const noseP = new THREE.Vector3(0, 0, 0.82), wingP = new THREE.Vector3(0.75, 0, 0.05);
    for (const [local, cE, cS] of [[noseP, '#FFE08A', '#BDF6FF'], [wingP, '#FF9A6B', '#6FD3FF']]) {
      const pe = [], ps = [];
      for (let i = 0; i <= 120; i++) {
        const k = i / 120;
        pe.push(local.clone().applyQuaternion(quat(euler(k))));
        ps.push(local.clone().applyQuaternion(qA.clone().slerp(qB, k)));
      }
      rigTop.add(trace(pe, cE));
      rigBottom.add(trace(ps, cS));
    }

    return {
      scene, camera,
      update(t) {
        const k = blend(t), [yaw, pitch, roll] = euler(k);
        yawG.rotation.y = yaw * D;
        pitchG.rotation.x = pitch * D;
        rollG.rotation.z = roll * D;
        const l = lock(k);
        yawMat.emissiveIntensity = pitchMat.emissiveIntensity = 0.75 * l; // the two rings that fold into one plane
        planeBottom.quaternion.copy(qA).slerp(qB, k);
      },
    };
  },
  overlay(ctx, t, W, H) {
    const k = blend(t), e = euler(k), l = lock(k);
    const deg = v => `${v < 0 ? '−' : ''}${Math.abs(Math.round(v))}°`;
    const pill = (x, y, text, sub, color) => {
      ctx.font = `700 34px ${FONT.sans}`;
      const w = Math.max(ctx.measureText(text).width, (ctx.font = `500 26px ${FONT.ko}`, ctx.measureText(sub).width)) + 56;
      ctx.fillStyle = 'rgba(8, 12, 28, 0.55)';
      ctx.beginPath(); ctx.roundRect(x, y, w, 96, 22); ctx.fill();
      ctx.fillStyle = color; ctx.font = `700 34px ${FONT.sans}`; ctx.fillText(text, x + 28, y + 44);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'; ctx.font = `500 26px ${FONT.ko}`; ctx.fillText(sub, x + 28, y + 80);
    };
    pill(56, 300, 'EULER ANGLES', '오일러 각 · 선형 보간', '#FFE08A');
    pill(56, 1134, 'QUATERNION SLERP', '쿼터니언 구면 보간', '#8FEFFF');
    ctx.font = `600 32px ${FONT.mono}`;
    [['yaw', e[0], '#5BD27A'], ['pitch', e[1], '#FF7A7E'], ['roll', e[2], '#6FA4FF']].forEach(([n, v, c], i) => {
      const x = 90 + i * 330;
      ctx.fillStyle = c; ctx.fillText(n, x, 1094);
      ctx.fillStyle = '#FFFFFF'; ctx.fillText(deg(v), x + ctx.measureText(n + ' ').width, 1094);
    });
    const turn = qA.angleTo(qB) / D;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(`turn ${deg(k * turn)} of ${deg(turn)} · one axis`, 90, 1872);
    if (l > 0) { // the warning badge fades in around pitch -90
      ctx.globalAlpha = l;
      ctx.fillStyle = '#FFB020';
      ctx.beginPath(); ctx.roundRect(W - 56 - 330, 300, 330, 96, 22); ctx.fill();
      ctx.fillStyle = '#1A1206';
      ctx.font = `800 36px ${FONT.sans}`; ctx.fillText('GIMBAL LOCK', W - 56 - 300, 346);
      ctx.font = `600 26px ${FONT.ko}`; ctx.fillText('축 2개가 겹침', W - 56 - 300, 382);
      ctx.globalAlpha = 1;
    }
  },
};
