// Motion matching: a runner follows a 22.7 m figure-eight path at 4.55 m/s. Every 0.2 s the controller asks where
// the path wants it to be 0.33, 0.67 and 1 s from now, in the runner's own frame (the orange query), and searches a
// database of seven clips (straight, three left and three right turns of 1.3, 2.6 and 4 rad/s) for the one whose own
// future trajectory (cyan) lies closest: the cost is the summed squared distance of the three points. A new clip only
// wins if it is 20 % cheaper than the playing one, and the pose and the cyan trajectory crossfade to it over 0.25 s.
// The pose comes from the playing clips: a running cycle, leaning into the turn and turning the head towards it. The
// cards below are the database; the lit card is playing and the bars are each clip's cost right now. Each dot of the
// path is coloured by the clip that plays there.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TAU, smoothstep, FONT } from '../lib/util.js';

const CLIPS = [['Sharp', 'left', 4], ['Turn', 'left', 2.6], ['Curve', 'left', 1.3], ['Straight', '', 0], ['Curve', 'right', -1.3], ['Turn', 'right', -2.6], ['Sharp', 'right', -4]];
const AHEAD = [1 / 3, 2 / 3, 1], STEPS = 16;                          // query times (s); running steps per loop
let cache = null;                                                     // the overlay's copy of the search
const COLS = ['#FF7A59', '#FFB04D', '#FFE07A', '#E8ECF2', '#8EE3D0', '#5CC8FF', '#8E9BFF'];

// the path: a figure eight, sampled by arc length so the runner keeps a steady speed
const curve = u => new THREE.Vector3(1.95 * Math.sin(2 * u), 0, -(3.35 * Math.sin(u) - 0.23 * Math.sin(3 * u)));
const TABLE = (() => {
  const pts = [curve(0)], len = [0];
  for (let i = 1; i <= 4000; i++) { pts.push(curve((i / 4000) * TAU)); len.push(len[i - 1] + pts[i].distanceTo(pts[i - 1])); }
  return { pts, len, L: len[4000] };
})();
const SPEED = TABLE.L / 5;
function along(s) {                                                    // position and unit tangent at arc length s
  s = ((s % TABLE.L) + TABLE.L) % TABLE.L;
  let lo = 0, hi = 4000;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (TABLE.len[m] <= s) lo = m; else hi = m; }
  const k = (s - TABLE.len[lo]) / (TABLE.len[hi] - TABLE.len[lo]);
  const p = TABLE.pts[lo].clone().lerp(TABLE.pts[hi], k), d = TABLE.pts[hi].clone().sub(TABLE.pts[lo]).normalize();
  return { p, d };
}
// a point given in the runner's frame (forward, left) at arc length s, in the world
const toWorld = (s, f, l) => { const { p, d } = along(s); return p.add(new THREE.Vector3(d.x * f + d.z * l, 0, d.z * f - d.x * l)); };
// where clip k carries the runner in tau seconds, in its own frame: an arc at its turn rate
const clipPoint = (k, tau) => { const w = CLIPS[k][2]; return Math.abs(w) < 1e-6 ? [SPEED * tau, 0] : [(SPEED * Math.sin(w * tau)) / w, (SPEED * (1 - Math.cos(w * tau))) / w]; };
// the query: where the path is in tau seconds, in the runner's frame now
function query(t) {
  const s = SPEED * t, { p, d } = along(s);
  return AHEAD.map(tau => { const q = along(s + SPEED * tau).p.sub(p); return [q.x * d.x + q.z * d.z, q.x * d.z - q.z * d.x]; });
}
const cost = (k, Q) => AHEAD.reduce((sum, tau, i) => { const [f, l] = clipPoint(k, tau); return sum + (f - Q[i][0]) ** 2 + (l - Q[i][1]) ** 2; }, 0);

// the search, every 6 frames over two loops (the second one is kept): [time, clip] each time the clip changes
function search() {
  let cur = 3, changes = [];
  for (let f = 0; f < 300; f += 6) {
    const t = f / 30, Q = query(t), c = CLIPS.map((_, k) => cost(k, Q)), best = c.indexOf(Math.min(...c));
    if (best !== cur && c[best] < 0.8 * c[cur]) { cur = best; if (f >= 150) changes.push([t - 5, cur]); }
  }
  return changes;
}
// which clip plays at t, the one before it, and how far the crossfade between them has gone
function playing(changes, t) {
  let i = changes.length - 1;
  while (i >= 0 && changes[i][0] > t) i--;
  const [t0, k] = i >= 0 ? changes[i] : [changes.at(-1)[0] - 5, changes.at(-1)[1]];
  const prev = (i >= 1 ? changes[i - 1] : changes.at(i - 1 + changes.length))[1];
  return { k, prev, w: smoothstep(0, 0.25, t - t0) };
}

export default {
  name: 'Motion Matching',
  ko: '모션 매칭',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#151A24');
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.5;
    const key = new THREE.DirectionalLight('#FFF1DE', 2.4);
    key.position.set(-4, 10, 5); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 });
    key.shadow.bias = -0.0004; key.shadow.radius = 4;
    scene.add(key, new THREE.HemisphereLight('#AFC4FF', '#2A2230', 0.7));
    const camera = new THREE.PerspectiveCamera(32, W / H, 0.1, 100);
    camera.position.set(0, 18, 10);
    camera.lookAt(0, 0, 0.4);

    const changes = search();
    // the floor, and the path drawn on it as a dotted line, each dot in the colour of the clip that plays there
    const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 96).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#232A38', roughness: 0.9 }));
    floor.receiveShadow = true;
    scene.add(floor);
    const dot = new THREE.CircleGeometry(0.045, 16).rotateX(-Math.PI / 2), dotMats = COLS.map(c => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(0.75) }));
    for (let i = 0; i < 160; i++) {
      const m = new THREE.Mesh(dot, dotMats[playing(changes, (i / 160) * 5).k]);
      m.position.copy(along((i / 160) * TABLE.L).p).setY(0.004); scene.add(m);
    }

    // the runner: a jointed mannequin
    const skin = new THREE.MeshStandardMaterial({ color: '#E9DCC8', roughness: 0.5 }), joint = new THREE.MeshStandardMaterial({ color: '#C44E3A', roughness: 0.5 });
    const node = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
    const limb = (parent, r, len) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 16).translate(0, -len / 2, 0), skin); m.castShadow = true; parent.add(m); };
    const ball = (parent, r, mat = joint) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat); m.castShadow = true; parent.add(m); };
    const root = node(scene, 0, 0, 0), hips = node(root, 0, 0.95, 0), chest = node(hips, 0, 0.12, 0);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.32, 6, 16).translate(0, 0.25, 0).scale(1.15, 1, 0.75), skin); torso.castShadow = true; chest.add(torso);
    const head = node(chest, 0, 0.62, 0);
    ball(head, 0.12, skin); ball(node(head, 0, 0.0, 0.11), 0.03);           // a nose dot shows where it looks
    const legs = [-1, 1].map(s => { const hip = node(hips, s * 0.1, 0, 0); ball(hip, 0.07); limb(hip, 0.065, 0.36); const knee = node(hip, 0, -0.43, 0); ball(knee, 0.06); limb(knee, 0.055, 0.36); const foot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.22).translate(0, -0.45, 0.05), joint); foot.castShadow = true; knee.add(foot); return { hip, knee }; });
    const arms = [-1, 1].map(s => { const sh = node(chest, s * 0.24, 0.46, 0); ball(sh, 0.06); limb(sh, 0.05, 0.24); const el = node(sh, 0, -0.29, 0); ball(el, 0.05); limb(el, 0.045, 0.22); return { sh, el }; });

    // the query (orange) and the playing clip's trajectory (cyan), on the floor
    const marker = (color, r) => { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 })); scene.add(m); return m; };
    const qDots = AHEAD.map(() => marker('#FF8A3D', 0.11)), cDots = AHEAD.map(() => marker('#48E0FF', 0.07));
    const ribbon = (color, w) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 40, 1), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, side: THREE.DoubleSide })); m.userData.w = w; scene.add(m); return m; };
    const qLine = ribbon('#FF8A3D', 0.06), cLine = ribbon('#48E0FF', 0.04);
    const lay = (rib, pts) => {                                         // a flat strip of width w along the points
      const p = rib.geometry.attributes.position, n = pts.length;
      for (let i = 0; i < n; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1, w = rib.userData.w;
        p.setXYZ(i, pts[i].x - (dz / l) * w, 0.012, pts[i].z + (dx / l) * w); p.setXYZ(i + n, pts[i].x + (dz / l) * w, 0.012, pts[i].z - (dx / l) * w);
      }
      p.needsUpdate = true;
    };

    return {
      scene, camera,
      update(t) {
        const s = SPEED * t, { p, d } = along(s), { k, prev, w } = playing(changes, t);
        const turn = CLIPS[prev][2] + (CLIPS[k][2] - CLIPS[prev][2]) * w;  // the blended clip's turn rate
        root.position.copy(p);
        root.rotation.y = Math.atan2(d.x, d.z);
        // the running cycle, with the playing clip's lean and head turn
        const ph = (TAU * STEPS * t) / 10;                                // one cycle = two steps
        hips.position.y = 0.95 + 0.05 * Math.abs(Math.cos(ph));
        hips.rotation.set(0.12, 0.12 * Math.sin(ph), -0.075 * turn);
        chest.rotation.set(0.1, -0.22 * Math.sin(ph), 0);
        head.rotation.set(-0.1, 0.09 * turn, 0.04 * turn);
        legs.forEach(({ hip, knee }, i) => {
          const a = ph + i * Math.PI;
          hip.rotation.x = -0.75 * Math.sin(a) - 0.1;
          knee.rotation.x = 0.25 + 0.95 * Math.max(0, Math.sin(a + 1.2)) ** 1.5;
        });
        arms.forEach(({ sh, el }, i) => {
          const a = ph + i * Math.PI;
          sh.rotation.set(0.6 * Math.sin(a), 0, (i ? -1 : 1) * (0.12 + 0.03 * turn * (i ? -1 : 1)));
          el.rotation.x = -1.45;
        });
        // the query points along the path, and the playing clip's arc from the runner
        const Q = query(t), qPts = [], cPts = [];
        Q.forEach(([f, l], i) => qDots[i].position.copy(toWorld(s, f, l)).setY(0.02));
        const blended = tau => { const a = clipPoint(prev, tau), b = clipPoint(k, tau); return toWorld(s, a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w); };
        AHEAD.forEach((tau, i) => cDots[i].position.copy(blended(tau)).setY(0.03));
        for (let j = 0; j <= 40; j++) { qPts.push(along(s + (SPEED * j) / 40).p); cPts.push(blended(j / 40)); }
        lay(qLine, qPts); lay(cLine, cPts);
      },
    };
  },
  // the database: seven cards with each clip's trajectory, the playing one lit, and every clip's cost now
  overlay(ctx, t) {
    const changes = cache || (cache = search()), { k, prev, w } = playing(changes, t), Q = query(t);
    const costs = CLIPS.map((_, i) => cost(i, Q));
    ctx.fillStyle = 'rgba(10, 13, 20, 0.78)';
    ctx.beginPath(); ctx.roundRect(36, 1494, 1008, 384, 30); ctx.fill();
    ctx.font = `700 28px ${FONT.sans}`; ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'left';
    ctx.fillText('CLIP DATABASE', 72, 1544);
    ctx.font = `500 23px ${FONT.sans}`; ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText('search every 0.2 s · cost = squared distance of 3 future points', 72, 1578);
    CLIPS.forEach(([name, side, rate], i) => {
      const x = 62 + i * 138, y = 1600, lit = (i === k ? w : 0) + (i === prev && prev !== k ? 1 - w : 0);
      ctx.fillStyle = `rgba(72, 224, 255, ${0.08 + 0.22 * lit})`;
      ctx.beginPath(); ctx.roundRect(x, y, 126, 256, 18); ctx.fill();
      ctx.strokeStyle = `rgba(72, 224, 255, ${0.15 + 0.85 * lit})`; ctx.lineWidth = 3 + 2 * lit; ctx.stroke();
      // the clip's 1 s trajectory, drawn from the bottom of the card upwards
      ctx.strokeStyle = COLS[i]; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath();
      for (let j = 0; j <= 20; j++) {
        const tau = j / 20, wr = rate, f = Math.abs(wr) < 1e-6 ? SPEED * tau : (SPEED * Math.sin(wr * tau)) / wr, l = Math.abs(wr) < 1e-6 ? 0 : (SPEED * (1 - Math.cos(wr * tau))) / wr;
        const px = x + 63 - l * 20, py = y + 132 - f * 20;
        if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(x + 63, y + 132, 7, 0, TAU); ctx.fill();
      ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT.sans}`; ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.fillText(name, x + 63, y + 172);
      ctx.font = `500 20px ${FONT.sans}`; ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; ctx.fillText(side || ' ', x + 63, y + 198);
      // cost bar: short = close
      const c = Math.min(1, Math.sqrt(costs[i]) / 3);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'; ctx.fillRect(x + 16, y + 222, 94, 14);
      ctx.fillStyle = i === k ? '#48E0FF' : 'rgba(255, 255, 255, 0.55)'; ctx.fillRect(x + 16, y + 222, 94 * c, 14);
    });
    ctx.textAlign = 'left';
    // legend
    ctx.font = `600 23px ${FONT.sans}`;
    ctx.fillStyle = '#FF8A3D'; ctx.beginPath(); ctx.arc(600, 1536, 9, 0, TAU); ctx.fill(); ctx.fillText('query', 618, 1544);
    ctx.fillStyle = '#48E0FF'; ctx.beginPath(); ctx.arc(730, 1536, 9, 0, TAU); ctx.fill(); ctx.fillText('playing clip', 748, 1544);
  },
};
