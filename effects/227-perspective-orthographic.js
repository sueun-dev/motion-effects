// Perspective <-> orthographic: one projection matrix with a knob s = 1 / (camera distance). The view stays the same
// size at the centre while s falls from a 70 degree wide angle to 0, which is a true orthographic (isometric) view:
// the converging guide lines through the block edges swing apart until they are parallel, and the vanishing points
// run off to infinity. Then it goes back.
import * as THREE from 'three';
import { TAU, FONT, rng } from '../lib/util.js';

const K = 13.4, R = 14, FOV0 = 70; // half the view height at the centre (world units), scene radius, widest angle
const fovAt = t => FOV0 * (0.5 + 0.5 * Math.cos(t / 5 * TAU + Math.PI / 2)); // 35 deg at 0 s, 0 at 1.25 s, 70 at 3.75 s
const VIEW = new THREE.Vector3(1, 0.816, 1).normalize(); // the isometric direction (35.26 degrees down)

// the projection: x, y scaled to the view, w = 1 - s z (s = 0: orthographic), depth kept inside [-R, R]
function projection(m, s, aspect) {
  m.set(1 / (K * aspect), 0, 0, 0,
    0, 1 / K, 0, 0,
    0, 0, -1 / R, s * R,
    0, 0, -s, 1);
}

let guides = null; // filled in by three(): the anchor points of the guide lines, and the camera to project them

export default {
  name: 'Perspective ↔ Orthographic',
  ko: '원근 ↔ 직교',
  three(renderer, W, H) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#F4EEE4');
    // the camera sits at the centre of the view; the matrix does the rest (Lambert shading has no view term)
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 1.6, 0);
    camera.lookAt(camera.position.clone().sub(VIEW));
    camera.updateMatrixWorld();

    scene.add(new THREE.HemisphereLight('#FFFFFF', '#C9B9A3', 1.5));
    const sun = new THREE.DirectionalLight('#FFF4E6', 2.2);
    sun.position.set(-10, 20, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 60 });
    sun.shadow.bias = -0.0005;
    scene.add(sun);

    const lam = c => new THREE.MeshLambertMaterial({ color: c });
    const base = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.6, 10.6), lam('#E7DCCB'));
    base.position.y = -0.3;
    base.receiveShadow = base.castShadow = true;
    scene.add(base);
    const top = new THREE.Mesh(new THREE.BoxGeometry(10, 0.02, 10), lam('#D8CDBB'));
    top.position.y = 0.01; top.receiveShadow = true;
    scene.add(top);
    // a 5 x 5 grid of towers; heights from a smooth bump so the skyline reads
    const colors = ['#FF6B6B', '#FFB84C', '#4ECDC4', '#5B7CFA', '#A78BFA', '#F7F3EA'];
    const r = rng(227), corners = [];
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
      const x = -4 + i * 2, z = -4 + j * 2;
      if (r() < 0.14) { // a tree instead
        const crown = new THREE.Mesh(new THREE.SphereGeometry(0.7, 20, 14), lam('#6BBF59'));
        crown.position.set(x, 1.05, z); crown.castShadow = true;
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.6, 10), lam('#8B5E3C'));
        trunk.position.set(x, 0.3, z); trunk.castShadow = true;
        scene.add(crown, trunk);
        continue;
      }
      const h = 0.8 + 4.4 * Math.exp(-((x - 1) ** 2 + (z + 1) ** 2) / 16) + 1.4 * r();
      const tower = new THREE.Mesh(new THREE.BoxGeometry(1.5, h, 1.5), lam(colors[Math.floor(r() * colors.length)]));
      tower.position.set(x, h / 2, z);
      tower.castShadow = tower.receiveShadow = true;
      scene.add(tower);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.12, 1.56), lam('#FFFFFF'));
      roof.position.set(x, h + 0.06, z); roof.castShadow = true;
      scene.add(roof);
      corners.push(new THREE.Vector3(x + 0.75, h, z + 0.75));
    }
    // guide lines run along x, y and z through the corners of a few tall towers and the base
    corners.sort((a, b) => b.y - a.y);
    guides = { camera, anchors: [new THREE.Vector3(5.3, 0, 5.3), corners[0], corners[3]] };

    return {
      scene, camera,
      update(t) {
        const s = Math.tan(fovAt(t) / 2 * Math.PI / 180) / K;
        projection(camera.projectionMatrix, s, W / H);
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      },
    };
  },
  overlay(ctx, t, W, H) {
    const { camera, anchors } = guides;
    // screen position of a point (x, y, z, w): w = 0 is a direction, whose image is its vanishing point
    const clip = (v, w) => new THREE.Vector4(v.x, v.y, v.z, w).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
    const px = c => [(c.x / c.w * 0.5 + 0.5) * W, (0.5 - c.y / c.w * 0.5) * H];
    const axes = [[new THREE.Vector3(1, 0, 0), 'rgba(239, 71, 111, 0.75)'], [new THREE.Vector3(0, 0, 1), 'rgba(48, 102, 230, 0.75)'], [new THREE.Vector3(0, 1, 0), 'rgba(28, 160, 110, 0.75)']];
    ctx.lineWidth = 2.5;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 280, W, 1340); ctx.clip(); // keep the guides between the title and the panel
    for (const [dir, color] of axes) {
      const d = clip(dir, 0);
      ctx.strokeStyle = color;
      for (const a of anchors) {
        const p = clip(a, 1), [x0, y0] = px(p);
        // direction on screen towards the vanishing point, also fine when it is at infinity (orthographic)
        let dx = d.x - d.w * p.x / p.w, dy = -(d.y - d.w * p.y / p.w);
        const l = Math.hypot(dx, dy) || 1;
        dx /= l; dy /= l;
        ctx.beginPath(); ctx.moveTo(x0 - dx * 4000, y0 - dy * 4000); ctx.lineTo(x0 + dx * 4000, y0 + dy * 4000); ctx.stroke();
      }
      if (Math.abs(d.w) > 1e-6) { // the vanishing point, when it is on screen
        const [vx, vy] = px(d);
        if (vx > -20 && vx < W + 20 && vy > 300 && vy < H + 20) {
          ctx.fillStyle = color.replace('0.75', '1'); ctx.beginPath(); ctx.arc(vx, vy, 12, 0, TAU); ctx.fill();
        }
      }
    }
    ctx.restore();
    // readout and a side view of the viewing volume: a pyramid that opens out into a box
    const fov = fovAt(t), y = 1700;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath(); ctx.roundRect(60, y - 60, W - 120, 200, 30); ctx.fill();
    ctx.fillStyle = '#2B2540'; ctx.font = `800 40px ${FONT.sans}`; ctx.textAlign = 'left';
    ctx.fillText(fov < 0.5 ? 'ORTHOGRAPHIC' : 'PERSPECTIVE', 100, y);
    ctx.font = `500 28px ${FONT.ko}`; ctx.fillStyle = 'rgba(43, 37, 64, 0.75)';
    ctx.fillText(fov < 0.5 ? '직교 투영 · 평행선이 만나지 않음' : '원근 투영 · 평행선이 한 점으로 모임', 100, y + 42);
    ctx.font = `700 34px ${FONT.mono}`; ctx.fillStyle = '#2B2540';
    ctx.fillText(`FOV ${fov.toFixed(1).padStart(4, ' ')}°`, 100, y + 100);
    // the frustum seen from the side: its edges meet at the eye, which slides out of the box as the angle closes
    const fx = 600, fw = 360, fh = 70, plane = fx + fw, ey = y + 40, k = Math.tan(fov / 2 * Math.PI / 180);
    const back = Math.min(fh / Math.max(k, 1e-6), fw), spread = fh - back * k;
    ctx.fillStyle = 'rgba(91, 124, 250, 0.12)';
    ctx.beginPath(); ctx.moveTo(plane - back, ey - spread); ctx.lineTo(plane, ey - fh); ctx.lineTo(plane, ey + fh); ctx.lineTo(plane - back, ey + spread); ctx.fill();
    ctx.strokeStyle = '#5B7CFA'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(plane - back, ey - spread); ctx.lineTo(plane, ey - fh); ctx.moveTo(plane - back, ey + spread); ctx.lineTo(plane, ey + fh); ctx.stroke();
    ctx.strokeStyle = '#2B2540'; ctx.beginPath(); ctx.moveTo(plane, ey - fh - 6); ctx.lineTo(plane, ey + fh + 6); ctx.stroke();
    if (back < fw) { ctx.fillStyle = '#2B2540'; ctx.beginPath(); ctx.arc(plane - back, ey, 9, 0, TAU); ctx.fill(); }
  },
};
