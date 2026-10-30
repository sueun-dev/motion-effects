// Tree growth by space colonization: 1000 attraction points (the glowing dots) fill the crown's volume. Every step,
// each point pulls the branch node nearest to it; each pulled node grows one short segment towards the average pull,
// and points that a branch reaches are removed. The whole growth is computed once in setup and replayed by t: the
// tree climbs into the cloud and eats it, branch thickness follows the pipe model, leaves pop open at the twigs,
// then everything retracts back into the ground and the cloud returns.
import * as THREE from 'three';
import { TAU, rng, clamp, ease, span, smoothstep } from '../lib/util.js';

const D = 0.2, REACH = 2.0, KILL = 0.36;   // segment length, how far a point pulls, how close a branch must come to take it

function colonize() {
  const r = rng(200), V = THREE.Vector3;
  const points = [];
  while (points.length < 1000) {
    const p = new V((r() * 2 - 1) * 3.4, (r() * 2 - 1) * 2.6, (r() * 2 - 1) * 3.4);
    if ((p.x * p.x + p.z * p.z) / 11.6 + (p.y * p.y) / 6.8 < 1 - 0.25 * Math.max(0, -p.y / 2.6)) points.push({ p: p.add(new V(0, 5.4, 0)), taken: Infinity, seed: r() });
  }
  const nodes = [{ p: new V(0, 0, 0), parent: -1, born: 0 }];
  let step = 0;
  const near = (p, d) => points.some(a => a.taken === Infinity && a.p.distanceTo(p) < d);
  while (!near(nodes[nodes.length - 1].p, REACH)) {            // the trunk grows straight up until the cloud pulls it
    const last = nodes[nodes.length - 1];
    step++;
    nodes.push({ p: last.p.clone().add(new V(0.03 * Math.sin(step * 1.7), D, 0.03 * Math.cos(step * 1.3))), parent: nodes.length - 1, born: step });
  }
  while (step < 400) {
    step++;
    const pull = new Map();
    for (const a of points) {
      if (a.taken !== Infinity) continue;
      let best = -1, bd = REACH;
      nodes.forEach((n, i) => { const d = n.p.distanceTo(a.p); if (d < bd) { bd = d; best = i; } });
      if (best >= 0) pull.set(best, (pull.get(best) || new V()).add(a.p.clone().sub(nodes[best].p).normalize()));
    }
    const grown = [];
    for (const [i, dir] of pull) {
      if (dir.length() < 0.15) continue;                          // pulled from opposite sides: stay put
      dir.normalize().add(new V(0, 0.12, 0)).normalize();         // a little light-seeking lift
      const p = nodes[i].p.clone().addScaledVector(dir, D);
      if (nodes.some(n => n.parent === i && n.p.distanceTo(p) < 0.5 * D)) continue;   // that twig is already there
      grown.push({ p, parent: i, born: step });
    }
    if (!grown.length) break;
    nodes.push(...grown);
    for (const a of points) if (a.taken === Infinity && grown.some(n => n.p.distanceTo(a.p) < KILL)) a.taken = step;
  }
  return { nodes, points, steps: step };
}

export default {
  name: 'Tree Growth',
  ko: '나무 성장',
  three(renderer, W, H) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas'); bg.width = 4; bg.height = 256;
    const g = bg.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#9FC3E8'); grd.addColorStop(0.62, '#F4E3C9'); grd.addColorStop(1, '#E7C79E');
    g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
    scene.background = new THREE.CanvasTexture(bg); scene.background.colorSpace = THREE.SRGBColorSpace;
    scene.fog = new THREE.Fog('#EBD9BD', 26, 60);

    const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 100);
    scene.add(new THREE.HemisphereLight('#FFF4E0', '#6E7F55', 1.3));
    const sun = new THREE.DirectionalLight('#FFE7C4', 2.6);
    sun.position.set(-6, 12, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 10, bottom: -4, near: 1, far: 40 });
    sun.shadow.radius = 4; sun.shadow.bias = -0.0005;
    scene.add(sun);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#8FA86A', roughness: 1 }));
    ground.receiveShadow = true;
    scene.add(ground);

    const { nodes, points, steps } = colonize();
    const kids = nodes.map(() => []);
    nodes.forEach((n, i) => { if (n.parent >= 0) kids[n.parent].push(i); });
    const tips = nodes.map((n, i) => i).filter(i => !kids[i].length);

    const bark = new THREE.MeshStandardMaterial({ color: '#6B4A33', roughness: 0.9 });
    const branches = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 8, 1, true).translate(0, 0.5, 0), bark, nodes.length);
    const joints = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), bark, nodes.length);
    for (const m of [branches, joints]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }

    // leaves: three on every twig tip, one on the nodes just behind it
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0); leafShape.quadraticCurveTo(0.17, 0.2, 0, 0.42); leafShape.quadraticCurveTo(-0.17, 0.2, 0, 0);
    const lr = rng(7), leafList = [];
    for (const i of tips) {
      let k = i;
      for (let d = 0; d < 3 && k > 0; d++, k = nodes[k].parent) {
        for (let j = 0; j < (d === 0 ? 3 : 1); j++) leafList.push({ node: k, rot: new THREE.Euler(lr() * TAU, lr() * TAU, lr() * TAU), size: 0.8 + 0.4 * lr(), hue: lr() });
      }
    }
    const leaves = new THREE.InstancedMesh(new THREE.ShapeGeometry(leafShape), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.7 }), leafList.length);
    leafList.forEach((l, i) => leaves.setColorAt(i, new THREE.Color().setHSL(0.24 + 0.08 * l.hue, 0.6, 0.38 + 0.12 * l.hue)));
    leaves.castShadow = true;
    scene.add(leaves);

    const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshBasicMaterial({ color: '#FF8C4A' }), points.length);
    scene.add(dots);

    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), dir = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const radius = new Float32Array(nodes.length);
    const look = new THREE.Vector3(0, 4.3, 0);
    return {
      scene, camera,
      update(t) {
        const a = Math.sin(t / 5 * TAU);
        camera.position.set(19 * Math.sin(0.5 * a), 4.0, 19 * Math.cos(0.5 * a));   // swings 30 degrees each way
        camera.lookAt(look);
        // growth clock in algorithm steps: up over 0.1-2.6 s, back down over 3.75-4.95 s
        const T = steps * (t < 3.4 ? ease.inOut(span(t, 0.1, 2.6)) : 1 - ease.inOut(span(t, 3.75, 4.95)));
        // pipe model: a branch is as thick as the twigs it carries (r^2.6 adds up), counting only what has grown
        for (let i = nodes.length - 1; i >= 0; i--) {
          const f = clamp(T - nodes[i].born);
          let sum = 0;
          for (const c of kids[i]) sum += radius[c] ** 2.6;
          radius[i] = f > 0 ? Math.max(0.024 * f, sum ** (1 / 2.6)) : 0;
        }
        nodes.forEach((n, i) => {
          const f = clamp(T - n.born), p = n.parent >= 0 ? nodes[n.parent].p : n.p;
          dir.subVectors(n.p, p);
          const len = dir.length() * f;
          q.setFromUnitVectors(up, len > 0 ? dir.normalize() : up);
          s.set(radius[i], len, radius[i]);
          m.compose(p, q, s); branches.setMatrixAt(i, m);
          s.setScalar(f >= 1 ? radius[i] : 0);
          m.compose(n.p, q, s); joints.setMatrixAt(i, m);
        });
        const fall = 1 - span(t, 3.35, 3.8);                         // leaves go before the branches retract
        leafList.forEach((l, i) => {
          const pop = clamp((T - nodes[l.node].born - 3) / 5);
          q.setFromEuler(l.rot);
          s.setScalar(0.8 * l.size * ease.outBack(pop) * ease.out(fall) + 1e-5);
          m.compose(nodes[l.node].p, q, s); leaves.setMatrixAt(i, m);
        });
        const cloud = 1 - smoothstep(2.5, 3.0, t) + smoothstep(4.2, 4.8, t);
        points.forEach((pt, i) => {
          const keep = Math.min(1 - clamp(T - pt.taken + 1), clamp(cloud));
          const b = pt.seed * TAU + t / 5 * TAU;                    // each point drifts on a small loop
          dir.set(0.14 * Math.cos(b), 0.14 * Math.sin(2 * b), 0.14 * Math.sin(b)).add(pt.p);
          s.setScalar(keep);
          m.compose(dir, q.identity(), s); dots.setMatrixAt(i, m);
        });
        for (const x of [branches, joints, leaves, dots]) x.instanceMatrix.needsUpdate = true;
      },
    };
  },
};
