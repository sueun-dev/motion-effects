// Crowd simulation: 66 walkers in four colour-coded streams cross a plaza and steer around one another and the
// fountain (time-to-collision avoidance forces, Karamouzas et al. 2014). Each walker is simulated in turn against
// the looping paths of the walkers planned before it, so every path repeats every 5 s; a short fading trail shows it.
import * as THREE from 'three';
import { rng } from '../lib/util.js';

const S = 150, R = 0.3, SPEED = 2.5, SUB = 2, DT = 1 / 30 / SUB, TRAIL = 30;
const OBST = [[0, 0, 2.4], [9.6, 18.6, 1.5], [-9.6, 18.6, 1.5], [9.6, -18.6, 1.5], [-9.6, -18.6, 1.5]]; // fountain, corner planters
const COLORS = ['#FF5A5F', '#16BDB4', '#FFB400', '#7A6CF5'];

// walkers: start point, direction, speed, spawn frame g, lifetime L frames (twice the crossing time, so the slow
// ones are still off screen when they vanish)
function walkers() {
  const r = rng(8), defs = [];
  const add = (group, x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), v0 = SPEED * (0.9 + 0.2 * r());
    defs.push({ group, g: Math.floor(r() * S), L: Math.round(len / v0 * 60), x0, z0, ux: (x1 - x0) / len, uz: (z1 - z0) / len, v0 });
  };
  for (let i = 0; i < 20; i++) { const z = (r() - 0.5) * 30; add(0, -14, z, 14, z + (r() - 0.5) * 6); }
  for (let i = 0; i < 20; i++) { const z = (r() - 0.5) * 30; add(1, 14, z, -14, z + (r() - 0.5) * 6); }
  for (let i = 0; i < 13; i++) { const x = (r() - 0.5) * 14; add(2, x, -25, x + (r() - 0.5) * 4, 24); }
  for (let i = 0; i < 13; i++) { const x = (r() - 0.5) * 14; add(3, x, 24, x + (r() - 0.5) * 4, -25); }
  const order = defs.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return { defs, order };
}

// simulate walker `self` from spawn to exit against the planned walkers that share each looping frame
function simulate(self, defs, at) {
  const d = defs[self], path = new Float32Array((d.L + 1) * 2);
  let x = d.x0, z = d.z0, vx = d.ux * d.v0, vz = d.uz * d.v0;
  for (let j = 0; j <= d.L; j++) {
    path[j * 2] = x; path[j * 2 + 1] = z;
    const others = at[(d.g + j) % S];
    for (let sub = 0; sub < SUB; sub++) {
      // head for the exit; an obstacle ahead bends the heading to pass beside it
      let ex = d.x0 + d.ux * 80 - x, ez = d.z0 + d.uz * 80 - z, el = Math.hypot(ex, ez);
      ex /= el; ez /= el;
      for (const [ox, oz, or] of OBST) {
        const cx = ox - x, cz = oz - z, along = cx * ex + cz * ez, perp = -cx * ez + cz * ex, clear = or + R + 0.45;
        if (along > -0.5 && along < 7 && Math.abs(perp) < clear) {
          const s = perp > 0 ? -1 : 1, tx = ox - ez * s * clear - x, tz = oz + ex * s * clear - z, tl = Math.hypot(tx, tz);
          const w = Math.min(1, (7 - along) / 3);
          ex = ex * (1 - w) + tx / tl * w; ez = ez * (1 - w) + tz / tl * w;
          el = Math.hypot(ex, ez); ex /= el; ez /= el;
        }
      }
      let fx = (ex * d.v0 - vx) / 0.54, fz = (ez * d.v0 - vz) / 0.54; // relax towards the wanted velocity
      const tt = sub / SUB, near = [];
      for (let k = 0; k < others.length; k += 2) {
        const b = defs[others[k]], oj = others[k + 1], bp = b.path, j1 = Math.min(b.L, oj + 1);
        const bvx = (bp[j1 * 2] - bp[oj * 2]) * 30, bvz = (bp[j1 * 2 + 1] - bp[oj * 2 + 1]) * 30;
        const bx = bp[oj * 2] + bvx * tt / 30, bz = bp[oj * 2 + 1] + bvz * tt / 30;
        const px = x - bx, pz = z - bz, c0 = px * px + pz * pz;
        if (c0 > 36) continue;
        near.push(bx, bz);
        // time-to-collision force: strong when a collision is close in time, zero when none is coming
        const rr = 2 * R + 0.12, rvx = vx - bvx, rvz = vz - bvz;
        const A = rvx * rvx + rvz * rvz, B = -(px * rvx + pz * rvz), C = c0 - rr * rr;
        if (C < 0) { const dd = Math.sqrt(c0) || 1e-6; fx -= 60 * C * px / dd; fz -= 60 * C * pz / dd; continue; }
        const disc = B * B - A * C;
        if (A < 1e-6 || disc <= 0) continue;
        const sq = Math.sqrt(disc), tau = (B - sq) / A;
        if (tau <= 0 || tau > 3) continue;
        const K = 1.5 * Math.exp(-tau / 3) / (A * tau * tau) * (2 / tau + 1 / 3);
        let gx = -K * (rvx - (A * px + B * rvx) / sq), gz = -K * (rvz - (A * pz + B * rvz) / sq);
        const gl = Math.hypot(gx, gz);
        if (gl > 3) { gx *= 3 / gl; gz *= 3 / gl; }
        fx += gx; fz += gz;
      }
      for (const [ox, oz, or] of OBST) {
        const px = x - ox, pz = z - oz, dist = Math.hypot(px, pz), need = or + R + 0.5;
        if (dist < need) { fx += 30 * (need - dist) * px / dist; fz += 30 * (need - dist) * pz / dist; }
      }
      vx += fx * DT; vz += fz * DT;
      const v = Math.hypot(vx, vz), vm = d.v0 * 1.3;
      if (v > vm) { vx *= vm / v; vz *= vm / v; }
      x += vx * DT; z += vz * DT;
      for (let k = 0; k < near.length; k += 2) { // never overlap a planned walker
        const px = x - near[k], pz = z - near[k + 1], dd = Math.hypot(px, pz), need = 2 * R + 0.04;
        if (dd < need && dd > 1e-6) { x = near[k] + px / dd * need; z = near[k + 1] + pz / dd * need; }
      }
    }
  }
  for (let pass = 0; pass < 3; pass++) { // iron out the last small kinks
    const q = Float32Array.from(path);
    for (let j = 1; j < d.L; j++) for (let c = 0; c < 2; c++) path[j * 2 + c] = 0.5 * q[j * 2 + c] + 0.25 * (q[j * 2 - 2 + c] + q[j * 2 + 2 + c]);
  }
  d.path = path;
  for (let j = 0; j <= d.L; j++) at[(d.g + j) % S].push(self, j);
}

function plazaTexture() {
  const c = document.createElement('canvas'), U = 64; // 64 px per unit, 44 x 60 units
  c.width = 44 * U; c.height = 60 * U;
  const g = c.getContext('2d'), r = rng(9);
  g.fillStyle = '#CDBCA2'; g.fillRect(0, 0, c.width, c.height); // grout
  for (let z = 0; z < 30; z++) for (let x = 0; x < 22; x++) { // 2 x 2 slabs, a little different each
    const l = 82 + 5 * r(), h = 34 + 6 * r();
    g.fillStyle = `hsl(${h}, 32%, ${l}%)`;
    g.fillRect(x * 2 * U + 3, z * 2 * U + 3, 2 * U - 6, 2 * U - 6);
  }
  const cx = 22 * U, cz = 30 * U;
  for (let k = 9; k >= 0; k--) { // ring mosaic round the fountain
    g.fillStyle = k % 2 ? '#E9D6B8' : '#D39A7A';
    g.beginPath(); g.arc(cx, cz, (3.0 + k * 0.42) * U, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = 'rgba(120, 90, 60, 0.35)'; g.lineWidth = 3;
  for (let k = 0; k < 48; k++) { // radial joints
    const a = k / 48 * Math.PI * 2;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * 3.0 * U, cz + Math.sin(a) * 3.0 * U); g.lineTo(cx + Math.cos(a) * 7.2 * U, cz + Math.sin(a) * 7.2 * U); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export default {
  name: 'Crowd Simulation',
  ko: '군중 시뮬레이션',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const { defs, order } = walkers();
    const at = Array.from({ length: S }, () => []);
    for (const i of order) simulate(i, defs, at);
    for (const d of defs) { // distance walked, for the stride
      d.dist = new Float32Array(d.L + 1);
      for (let j = 1; j <= d.L; j++) d.dist[j] = d.dist[j - 1] + Math.hypot(d.path[j * 2] - d.path[j * 2 - 2], d.path[j * 2 + 1] - d.path[j * 2 - 1]);
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#CDBCA2');
    const camera = new THREE.PerspectiveCamera(30, W / H, 1, 200);
    camera.position.set(0, 56, 33);
    camera.lookAt(0, 0, 0.6);

    scene.add(new THREE.HemisphereLight('#FFF4E6', '#9C8A74', 1.5));
    const sun = new THREE.DirectionalLight('#FFE2BF', 2.6);
    sun.position.set(-18, 34, -10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 30, bottom: -30, near: 1, far: 100 });
    sun.shadow.bias = -0.0003;
    sun.shadow.radius = 3;
    scene.add(sun);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(44, 60), new THREE.MeshStandardMaterial({ map: plazaTexture(), roughness: 0.9 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // fountain: stone rim, water, a pedestal with a bowl
    const stone = new THREE.MeshStandardMaterial({ color: '#E4DACB', roughness: 0.7 });
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; scene.add(m); return m; };
    add(new THREE.CylinderGeometry(2.4, 2.5, 0.5, 96), stone, 0, 0.25, 0);
    const water = new THREE.MeshStandardMaterial({ color: '#58B7E0', roughness: 0.15, metalness: 0.1, emissive: '#1C6E9A', emissiveIntensity: 0.25 });
    add(new THREE.CylinderGeometry(2.12, 2.12, 0.1, 96), water, 0, 0.47, 0).castShadow = false;
    add(new THREE.CylinderGeometry(0.28, 0.4, 1.3, 32), stone, 0, 1.1, 0);
    add(new THREE.CylinderGeometry(1.0, 0.3, 0.35, 48), stone, 0, 1.85, 0);
    add(new THREE.CylinderGeometry(0.88, 0.88, 0.06, 48), water, 0, 2.0, 0);
    add(new THREE.SphereGeometry(0.22, 24, 16), new THREE.MeshStandardMaterial({ color: '#EAF8FF', roughness: 0.2 }), 0, 2.2, 0);
    const ripples = [0, 1, 2].map(() => {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 96), new THREE.MeshBasicMaterial({ color: '#E8F7FF', transparent: true, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.y = 0.53;
      scene.add(m);
      return m;
    });
    // corner planters with round shrubs
    const leaf = new THREE.MeshStandardMaterial({ color: '#5E9E58', roughness: 0.8 });
    for (const [ox, oz, or] of OBST.slice(1)) {
      add(new THREE.CylinderGeometry(or, or + 0.05, 0.6, 64), stone, ox, 0.3, oz);
      add(new THREE.SphereGeometry(or * 0.92, 32, 20), leaf, ox, 1.1, oz).scale.y = 0.75;
    }

    // walkers: one InstancedMesh per body part; a walker can be on the plaza twice at once (5 s apart)
    const total = defs.reduce((s, d) => s + Math.floor(d.L / S) + 1, 0);
    const part = (geo, mat) => { const m = new THREE.InstancedMesh(geo, mat, total); m.castShadow = true; m.frustumCulled = false; scene.add(m); return m; };
    const body = part(new THREE.CapsuleGeometry(0.2, 0.42, 6, 16), new THREE.MeshStandardMaterial({ roughness: 0.6 }));
    const head = part(new THREE.SphereGeometry(0.15, 20, 14), new THREE.MeshStandardMaterial({ roughness: 0.6 }));
    const hair = part(new THREE.SphereGeometry(0.16, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ roughness: 0.8 }));
    const legGeo = new THREE.CapsuleGeometry(0.07, 0.32, 4, 10);
    legGeo.translate(0, -0.23, 0); // pivot at the hip
    const legL = part(legGeo, new THREE.MeshStandardMaterial({ color: '#3A3550', roughness: 0.7 }));
    const legR = part(legGeo, legL.material);
    const r = rng(5), c = new THREE.Color();
    const skins = ['#F3CDB0', '#E2AE88', '#C68B62', '#8D5A3B', '#F7D9BF'], hairs = ['#2B211C', '#4A3326', '#151216', '#8A5A2E', '#D9B26A'];
    let n = 0;
    for (const d of defs) for (let k = 0; k * S <= d.L; k++, n++) {
      body.setColorAt(n, c.set(COLORS[d.group]).offsetHSL(0, 0, (r() - 0.5) * 0.12));
      head.setColorAt(n, c.set(skins[Math.floor(r() * skins.length)]));
      hair.setColorAt(n, c.set(hairs[Math.floor(r() * hairs.length)]));
    }

    // trails: a ribbon over the last 1 s of each walker, fading out behind it
    const tPos = new Float32Array(total * TRAIL * 2 * 3), tCol = new Float32Array(total * TRAIL * 2 * 4), tIdx = [];
    for (let i = 0; i < total; i++) for (let k = 0; k < TRAIL - 1; k++) {
      const a = (i * TRAIL + k) * 2;
      tIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
    trailGeo.setAttribute('color', new THREE.BufferAttribute(tCol, 4));
    trailGeo.setIndex(tIdx);
    const trails = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    trails.frustumCulled = false;
    trails.renderOrder = 1;
    scene.add(trails);

    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    const place = (mesh, i, x, y, z, yaw, pitch = 0) => {
      q.setFromEuler(e.set(pitch, yaw, 0, 'YXZ'));
      mesh.setMatrixAt(i, m4.compose(pos.set(x, y, z), q, one));
    };
    return {
      scene, camera,
      update(t) {
        const f = Math.round(t * 30) % S;
        ripples.forEach((m, k) => { // three rings spreading out over the basin, one every 5/3 s
          const u = ((t / 5 * 3 + k / 3) % 1);
          m.scale.setScalar(0.95 + 1.1 * u);
          m.material.opacity = 0.5 * Math.sin(Math.PI * u);
        });
        let n = 0;
        for (const d of defs) for (let k = 0; k * S <= d.L; k++, n++) {
          const j = ((f - d.g) % S + S) % S + k * S, p = d.path;
          if (j > d.L) { // this copy is not on the plaza now
            for (const m of [body, head, hair, legL, legR]) m.setMatrixAt(n, m4.makeScale(0, 0, 0));
            for (let s = 0; s < TRAIL * 2; s++) tCol[((n * TRAIL) * 2 + s) * 4 + 3] = 0;
            continue;
          }
          const a = Math.max(0, j - 3), b = Math.min(d.L, j + 3);
          const vx = p[b * 2] - p[a * 2], vz = p[b * 2 + 1] - p[a * 2 + 1];
          const yaw = Math.atan2(vx, vz), x = p[j * 2], z = p[j * 2 + 1];
          const step = d.dist[j] / 0.62 * Math.PI, swing = 0.55 * Math.sin(step), bob = 0.04 * Math.abs(Math.cos(step));
          const fx = Math.sin(yaw), fz = Math.cos(yaw);
          place(body, n, x, 0.88 + bob, z, yaw, 0.08);
          place(head, n, x + fx * 0.04, 1.36 + bob, z + fz * 0.04, yaw);
          place(hair, n, x - fx * 0.02, 1.38 + bob, z - fz * 0.02, yaw, -0.35);
          place(legL, n, x - fz * 0.1, 0.62 + bob, z + fx * 0.1, yaw, swing);
          place(legR, n, x + fz * 0.1, 0.62 + bob, z - fx * 0.1, yaw, -swing);
          c.set(COLORS[d.group]);
          for (let s = 0; s < TRAIL; s++) {
            const js = Math.max(0, j - (TRAIL - 1 - s) * 1), j0 = Math.max(0, js - 1), j1 = Math.min(d.L, js + 1);
            let tx = p[j1 * 2] - p[j0 * 2], tz = p[j1 * 2 + 1] - p[j0 * 2 + 1];
            const tl = Math.hypot(tx, tz) || 1, w = 0.08 * (0.3 + 0.7 * s / (TRAIL - 1));
            tx /= tl; tz /= tl;
            const o = (n * TRAIL + s) * 2, alpha = 0.8 * (s / (TRAIL - 1)) ** 1.5;
            tPos.set([p[js * 2] - tz * w, 0.02, p[js * 2 + 1] + tx * w, p[js * 2] + tz * w, 0.02, p[js * 2 + 1] - tx * w], o * 3);
            tCol.set([c.r, c.g, c.b, alpha, c.r, c.g, c.b, alpha], o * 4);
          }
        }
        for (const m of [body, head, hair, legL, legR]) m.instanceMatrix.needsUpdate = true;
        trailGeo.attributes.position.needsUpdate = true;
        trailGeo.attributes.color.needsUpdate = true;
      },
    };
  },
};
