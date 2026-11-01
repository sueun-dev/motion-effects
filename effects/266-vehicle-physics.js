// Vehicle physics: a dune buggy drives a desert track over whoops, a left and a right bump and a jump at a steady
// 6 m/s. A small solver runs the classic car model: the body has heave, pitch and roll, each wheel is its own mass on
// a spring-damper strut (stiffness 5.7 kN/m, damping 0.85 kN.s/m, bump stop and top-out strap), and each tyre is a
// stiffer spring that only pushes while it touches the ground (it can leave it). The tyre's contact height is the
// highest point of the ground under the round wheel. The ground repeats every 30 m, the buggy covers 30 m per loop,
// and the solver warms up for three loops at 600 steps a second so the motion repeats; the last loop is played.
// The coil springs squash and stretch with the real strut length, and the gauges show each corner's travel.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TAU, smoothstep, canvas, FONT } from '../lib/util.js';

const SPEED = 6, P = SPEED * 5, R = P / (TAU * 11);           // the wheels turn exactly 11 times per loop
const M = 420, MW = 28, IP = 520, IR = 160, G = 9.8;        // body mass, wheel mass, pitch and roll inertia
const KS = 5700, CS = 850, KT = 45000, CT = 2200, L0 = 0.62, LMIN = 0.2, LMAX = 0.58; // strut free length, stops
const CORNERS = [[1.25, -0.82], [1.25, 0.82], [-1.15, -0.82], [-1.15, 0.82]]; // [forward, side]: FL, FR, RL, RR
const SUB = 20, DT = 1 / 30 / SUB, FRAMES = 150;

// ground height: whoops, a bump under the left wheels, one under the right, then a kicker and a dip; period P
const hump = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));
function ground(x, z) {
  const u = ((x % P) + P) % P;
  let h = 0.22 * (hump(u, 3.5, 0.55) + hump(u, 5.3, 0.55) + hump(u, 7.1, 0.55));
  h += 0.3 * hump(u, 12, 0.7) * hump(z, -0.82, 0.55) + 0.3 * hump(u, 15.5, 0.7) * hump(z, 0.82, 0.55);
  h += 0.62 * smoothstep(19.5, 22.6, u) * (1 - smoothstep(22.6, 23.4, u)) - 0.12 * hump(u, 25.5, 1.2);
  const onTrack = smoothstep(3.2, 2.2, Math.abs(z));                    // the features are on the track only;
  const dunes = 0.12 * Math.max(0, Math.abs(z) - 4) * (1 + 0.6 * Math.sin((TAU * 2 * u) / P + 0.4 * z)); // dunes beside it
  return h * onTrack + dunes + 0.03 * Math.sin((TAU * 6 * u) / P + 1.3 * z);
}
// the lowest height the wheel centre can have over the ground at (x, z): the highest point under the round tyre
function contactHeight(x, z) {
  let y = -9;
  for (let k = -8; k <= 8; k++) { const dx = (k / 8) * R; y = Math.max(y, ground(x + dx, z) + Math.sqrt(R * R - dx * dx)); }
  return y;
}

// body [y, pitch, roll] and the four wheel heights at every frame of one loop
function simulate() {
  let y = 0.9, vy = 0, th = 0, wth = 0, ph = 0, wph = 0;
  const yw = CORNERS.map(() => R), vw = [0, 0, 0, 0], out = [];
  const warm = 3 * FRAMES;
  for (let f = 0; f < warm + FRAMES; f++) {
    if (f >= warm) {
      const x = SPEED * f * SUB * DT;
      out.push({ y, th, ph, yw: [...yw], len: CORNERS.map(([a, b], i) => y + a * Math.sin(th) - b * Math.sin(ph) - yw[i]),
        touch: CORNERS.map(([a, b], i) => contactHeight(x + a, b) - yw[i] > -0.005) });
    }
    for (let s = 0; s < SUB; s++) {
      const x = SPEED * (f * SUB + s) * DT;
      let fy = -M * G, tp = 0, tr = 0;
      CORNERS.forEach(([a, b], i) => {
        const len = y + a * Math.sin(th) - b * Math.sin(ph) - yw[i];             // strut length, mount to hub
        const vlen = vy + a * Math.cos(th) * wth - b * Math.cos(ph) * wph - vw[i];
        let fs = KS * (L0 - len) - CS * vlen;                                     // spring-damper
        if (len < LMIN) fs += 40 * KS * (LMIN - len);                             // bump stop
        if (len > LMAX) fs -= 40 * KS * (len - LMAX) + 4 * CS * Math.max(0, vlen); // top-out strap
        const pen = contactHeight(x + a, b) - yw[i];                              // tyre: pushes only when touching
        const ft = pen > 0 ? Math.max(0, KT * pen - CT * vw[i]) : 0;
        fy += fs; tp += a * fs; tr += -b * fs;
        vw[i] += ((ft - fs) / MW - G) * DT;
        yw[i] += vw[i] * DT;
      });
      vy += (fy / M) * DT; wth += (tp / IP) * DT; wph += (tr / IR) * DT;
      y += vy * DT; th += wth * DT; ph += wph * DT;
    }
  }
  return out;
}

let log = null; // the simulated loop, shared with the gauges

// a coil spring of unit height (wire radius r, coil radius c, n turns) to be stretched along y
function coil(c, r, n) {
  const pts = [];
  for (let i = 0; i <= n * 24; i++) { const a = (i / 24) * TAU; pts.push(new THREE.Vector3(c * Math.cos(a), i / (n * 24), c * Math.sin(a))); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 48, r, 8);
}

export default {
  name: 'Vehicle Physics',
  ko: '차량 물리',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    const sky = canvas(2, 512), sg = sky.getContext('2d'), grd = sg.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#3B6FB6'); grd.addColorStop(0.55, '#9CC3E6'); grd.addColorStop(1, '#F6D9AE');
    sg.fillStyle = grd; sg.fillRect(0, 0, 2, 512);
    scene.background = new THREE.CanvasTexture(sky);
    scene.background.colorSpace = THREE.SRGBColorSpace;
    scene.fog = new THREE.Fog('#F1D6B0', 25, 70);
    const sun = new THREE.DirectionalLight('#FFF1DC', 3.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 40 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
    scene.add(sun, sun.target, new THREE.HemisphereLight('#BFD9FF', '#B08A60', 1.1));
    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 200);

    // the ground: three periods of track, moved by whole periods to stay under the buggy
    const gg = new THREE.PlaneGeometry(3 * P, 40, 900, 200).rotateX(-Math.PI / 2), gp = gg.attributes.position, gc = [];
    const sand = new THREE.Color('#D9B27C'), track = new THREE.Color('#B98B57'), rut = new THREE.Color('#9E7246');
    for (let i = 0; i < gp.count; i++) {
      const x = gp.getX(i), z = gp.getZ(i), h = ground(x, z), c = sand.clone().lerp(track, smoothstep(2.4, 1.6, Math.abs(z)));
      c.lerp(rut, 0.55 * Math.exp(-(((Math.abs(z) - 0.82) / 0.18) ** 2)) * smoothstep(2.4, 1.6, Math.abs(z)));
      c.multiplyScalar(0.92 + 0.5 * h);                                      // crests catch the light a little more
      gp.setY(i, h); gc.push(c.r, c.g, c.b);
    }
    gg.setAttribute('color', new THREE.Float32BufferAttribute(gc, 3));
    gg.computeVertexNormals();
    const land = new THREE.Mesh(gg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    land.receiveShadow = true;
    const world = new THREE.Group();
    world.add(land);
    // marker posts every 5 m on both sides of the track
    const post = new THREE.MeshStandardMaterial({ color: '#F4F1EA', roughness: 0.6 }), band = new THREE.MeshStandardMaterial({ color: '#E2483C', roughness: 0.6 });
    for (let x = -P; x < 2 * P; x += 5) for (const z of [-2.8]) {             // on the far side only
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 12), post);
      p.position.set(x, ground(x, z) + 0.55, z); p.castShadow = true;
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.2, 12), band);
      b.position.set(x, ground(x, z) + 0.9, z);
      world.add(p, b);
    }
    scene.add(world);

    // the buggy body: a tub, a roll cage, a seat and a driver's helmet
    const body = new THREE.Group();
    scene.add(body);
    const paint = new THREE.MeshPhysicalMaterial({ color: '#2F7DE1', roughness: 0.35, clearcoat: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: '#23262D', roughness: 0.6, metalness: 0.3 });
    const steel = new THREE.MeshStandardMaterial({ color: '#C9CDD3', roughness: 0.3, metalness: 0.9 });
    const add = (parent, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
    add(body, new RoundedBoxGeometry(3.0, 0.32, 1.25, 4, 0.1), paint, 0.05, 0.12, 0);
    add(body, new RoundedBoxGeometry(0.9, 0.28, 1.1, 4, 0.1), paint, 1.35, 0.2, 0).rotation.z = -0.25;  // nose
    add(body, new RoundedBoxGeometry(0.2, 0.75, 0.5, 4, 0.08), dark, -0.5, 0.55, 0).rotation.z = 0.25;  // seat back
    add(body, new THREE.CapsuleGeometry(0.17, 0.3, 6, 16), new THREE.MeshStandardMaterial({ color: '#E2483C', roughness: 0.6 }), -0.25, 0.62, 0).rotation.z = 0.2; // driver
    add(body, new THREE.SphereGeometry(0.19, 28, 18), new THREE.MeshPhysicalMaterial({ color: '#F4F4F4', roughness: 0.2, clearcoat: 1 }), -0.18, 1.0, 0);
    add(body, new THREE.SphereGeometry(0.17, 28, 18, -0.9, 1.8, 0.9, 0.7), new THREE.MeshPhysicalMaterial({ color: '#1A2230', roughness: 0.05, clearcoat: 1 }), -0.15, 1.0, 0).rotation.y = Math.PI / 2; // visor
    const tube = (a, b) => {
      const d = new THREE.Vector3(...b).sub(new THREE.Vector3(...a));
      const m = add(body, new THREE.CylinderGeometry(0.045, 0.045, d.length(), 12), steel, ...new THREE.Vector3(...a).addScaledVector(d, 0.5).toArray());
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    };
    for (const z of [-0.55, 0.55]) { tube([-0.75, 0.2, z], [-0.55, 1.35, z * 0.85]); tube([-0.55, 1.35, z * 0.85], [0.45, 1.25, z * 0.85]); tube([0.45, 1.25, z * 0.85], [0.95, 0.3, z]); }
    tube([-0.55, 1.35, -0.47], [-0.55, 1.35, 0.47]); tube([0.45, 1.25, -0.47], [0.45, 1.25, 0.47]);

    // wheels, struts and coils (in the world, placed every frame)
    const tyreGeo = new THREE.TorusGeometry(R - 0.13, 0.13, 24, 64).scale(1, 1, 1.15);     // a fat balloon tyre
    const rubber = new THREE.MeshStandardMaterial({ color: '#1E1F23', roughness: 0.9 });
    const rimMat = new THREE.MeshStandardMaterial({ color: '#E9EDF2', roughness: 0.3, metalness: 0.8 });
    const spokeMat = new THREE.MeshStandardMaterial({ color: '#7A818C', roughness: 0.5, metalness: 0.3 }); // soft contrast: they turn 26 degrees a frame
    const spring = new THREE.MeshStandardMaterial({ color: '#F2B632', roughness: 0.35, metalness: 0.4 });
    const coilGeo = coil(0.1, 0.022, 7);
    const wheels = CORNERS.map(([, b]) => {
      const g = new THREE.Group(), spin = new THREE.Group();
      g.add(spin); scene.add(g);
      const tyre = new THREE.Mesh(tyreGeo, rubber); tyre.castShadow = true; spin.add(tyre);
      spin.add(new THREE.Mesh(new THREE.CylinderGeometry(R - 0.2, R - 0.2, 0.2, 40).rotateX(Math.PI / 2), dark));  // the rim
      for (let k = 0; k < 3; k++) {                                // three broad spokes: a turn of 26 degrees a frame stays readable
        const sp = new THREE.Mesh(new THREE.BoxGeometry(0.13, R - 0.2, 0.04).translate(0, (R - 0.2) / 2, Math.sign(b) * 0.11).rotateZ((k / 3) * TAU), spokeMat);
        spin.add(sp);
      }
      spin.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.26, 20).rotateX(Math.PI / 2), rimMat));
      const strut = new THREE.Mesh(coilGeo, spring); strut.castShadow = true; scene.add(strut);
      const damper = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 12).translate(0, 0.5, 0), dark); scene.add(damper);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 8).translate(0, 0.5, 0), steel); arm.castShadow = true; scene.add(arm);
      return { g, spin, strut, damper, arm };
    });

    const states = log = simulate();
    const up = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3(), q = new THREE.Quaternion();
    const along = (m, a, b) => { tmp.subVectors(b, a); m.position.copy(a); m.scale.set(1, tmp.length(), 1); m.quaternion.setFromUnitVectors(up, tmp.normalize()); };
    return {
      scene, camera,
      update(t) {
        const f = Math.round(t * 30) % FRAMES, s = states[f], x = SPEED * t;
        world.position.x = P * Math.floor(x / P);
        body.position.set(x, s.y, 0);
        body.rotation.set(s.ph, 0, s.th, 'XZY');
        body.updateMatrixWorld();
        CORNERS.forEach(([a, b], i) => {
          const w = wheels[i], mount = new THREE.Vector3(a, 0.15, b * 0.62).applyMatrix4(body.matrixWorld);
          const hub = new THREE.Vector3(x + a, s.yw[i], b * 1.0);
          w.g.position.copy(hub);
          w.g.quaternion.copy(q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), s.ph));
          w.spin.rotation.z = -x / R;
          const top = mount.clone(), bottom = hub.clone().add(new THREE.Vector3(0, 0, -Math.sign(b) * 0.2));
          along(w.strut, bottom, top);
          along(w.damper, bottom, bottom.clone().lerp(top, 0.55));
          along(w.arm, new THREE.Vector3(a, 0.05, b * 0.45).applyMatrix4(body.matrixWorld), hub.clone().add(new THREE.Vector3(0, 0, -Math.sign(b) * 0.16)));
        });
        camera.position.set(x + 11, 2.2, 8.4);          // ahead of the buggy and to its side, low, looking back at it
        camera.lookAt(x - 0.3, 0.3, -0.15);
        sun.position.set(x + 4, 12, 7); sun.target.position.set(x, 0, 0);
      },
    };
  },
  // telemetry: a top view with a bar per corner, and a dial on which each spring's compression over the whole 5 s lap
  // is a closed ring (the lap repeats); the sweep marks now
  overlay(ctx, t) {
    const f = Math.round(t * 30) % FRAMES, cols = ['#FF6B6B', '#FFD166', '#4ECDC4', '#8E9BFF'], names = ['FL', 'FR', 'RL', 'RR'];
    const comp = (k, i) => (L0 - log[((k % FRAMES) + FRAMES) % FRAMES].len[i]) * 100;  // cm
    ctx.fillStyle = 'rgba(16, 20, 30, 0.74)';
    ctx.beginPath(); ctx.roundRect(54, 1400, 972, 456, 30); ctx.fill();
    ctx.font = `700 26px ${FONT.sans}`; ctx.fillStyle = 'rgba(255, 255, 255, 0.86)';
    ctx.fillText('SPRING COMPRESSION', 92, 1452);
    ctx.font = `500 22px ${FONT.sans}`; ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText('one lap = 5 s, 0–40 cm', 92, 1484);
    // top view: the body, and beside each corner a bar that fills with compression; a dot while the tyre touches
    ctx.fillStyle = 'rgba(47, 125, 225, 0.9)'; ctx.beginPath(); ctx.roundRect(126, 1530, 90, 270, 24); ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; ctx.font = `600 22px ${FONT.sans}`; ctx.textAlign = 'center'; ctx.fillText('▲', 171, 1570);
    [[94, 1535], [226, 1535], [94, 1690], [226, 1690]].forEach(([x, y], i) => {
      const v = Math.max(0, Math.min(1, comp(f, i) / 40));
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'; ctx.fillRect(x, y, 22, 90);
      ctx.fillStyle = cols[i]; ctx.fillRect(x, y + 90 * (1 - v), 22, 90 * v);
      ctx.beginPath(); ctx.arc(x + 11, y + 106, 7, 0, TAU);
      if (log[f].touch[i]) ctx.fill(); else { ctx.strokeStyle = cols[i]; ctx.lineWidth = 3; ctx.stroke(); }
    });
    // the dial: ring i at radius 62 + 40 i, pushed out by the compression; time runs clockwise from the top
    const cx = 610, cy = 1650, ang = k => -Math.PI / 2 + (TAU * k) / FRAMES, now = ang(t * 30);
    const sweep = ctx.createConicGradient(now - 0.9, cx, cy);
    sweep.addColorStop(0, 'rgba(255, 255, 255, 0)'); sweep.addColorStop(0.9 / TAU, 'rgba(255, 255, 255, 0.16)'); sweep.addColorStop(0.9 / TAU + 0.001, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sweep; ctx.beginPath(); ctx.arc(cx, cy, 205, 0, TAU); ctx.fill();
    cols.forEach((col, i) => {
      const r0 = 62 + 40 * i, rad = k => r0 + (comp(k, i) - 20) * 0.45;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.beginPath();
      for (let k = 0; k <= FRAMES; k++) { const a = ang(k), r = rad(k); if (k) ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); else ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); }
      ctx.stroke();
      const r = rad(t * 30 % FRAMES);
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx + r * Math.cos(now), cy + r * Math.sin(now), 9, 0, TAU); ctx.fill();
      ctx.font = `700 24px ${FONT.sans}`; ctx.textAlign = 'left'; ctx.fillText(names[i], 870, 1560 + 52 * i);
      ctx.beginPath(); ctx.arc(850, 1552 + 52 * i, 8, 0, TAU); ctx.fill();
    });
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, TAU); ctx.fill();
  },
};
