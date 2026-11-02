// Convex hull by Quickhull: 62 seeded points float in a cloud. The hull starts as the tetrahedron of four extreme
// points; then, step by step, the point farthest outside one face (orange) is taken, every face it can see turns red,
// the boundary of that red patch (the horizon, yellow) is found, and the red faces are replaced by a fan of new faces
// from the horizon to the point, which bulge out to it like shrink wrap. Points left inside go dim. The whole run is
// computed once; frames replay it, the finished hull glows, fades and the cloud is free again.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { TAU, FONT, phase, span, ease, rng, clamp } from '../lib/util.js';

// the cloud: 16 points near an egg-shaped surface (these end up on the hull) and 46 inside it
function cloud() {
  const r = rng(299), pts = [];
  for (let i = 0; i < 16; i++) {
    const z = 1 - 2 * (i + 0.5) / 16, a = i * 2.39996 + r() * 0.5, s = Math.sqrt(1 - z * z), k = 0.9 + 0.1 * r();
    pts.push(new THREE.Vector3(1.45 * s * Math.cos(a) * k, 1.6 * z * k, 1.3 * s * Math.sin(a) * k));
  }
  while (pts.length < 62) {
    const v = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
    if (v.length() < 1) pts.push(v.set(v.x * 1.15, v.y * 1.25, v.z * 1.0));
  }
  return pts;
}

// Quickhull, recording every step
function quickhull(P) {
  const faces = [], EPS = 1e-6;
  const plane = (a, b, c) => {
    const n = new THREE.Vector3().subVectors(P[b], P[a]).cross(new THREE.Vector3().subVectors(P[c], P[a])).normalize();
    return { n, d: n.dot(P[a]) };
  };
  const dist = (f, i) => f.n.dot(P[i]) - f.d;
  const addFace = (a, b, c, born, inside) => {
    const f = { v: [a, b, c], born, died: Infinity, out: [], ...plane(a, b, c) };
    if (dist(f, inside) > 0) { f.v = [a, c, b]; Object.assign(f, plane(a, c, b)); } // keep normals pointing out
    faces.push(f);
    return f;
  };
  // the starting tetrahedron: extremes in x, the point farthest from that line, then from that plane
  let a = 0, b = 0;
  P.forEach((p, i) => { if (p.x < P[a].x) a = i; if (p.x > P[b].x) b = i; });
  const ab = new THREE.Vector3().subVectors(P[b], P[a]).normalize();
  let c = 0, best = -1;
  P.forEach((p, i) => { const v = new THREE.Vector3().subVectors(p, P[a]); const d = v.sub(ab.clone().multiplyScalar(v.dot(ab))).length(); if (d > best) { best = d; c = i; } });
  const base = plane(a, b, c);
  let d = 0; best = -1;
  P.forEach((p, i) => { const v = Math.abs(base.n.dot(p) - base.d); if (v > best) { best = v; d = i; } });
  const center = new THREE.Vector3().add(P[a]).add(P[b]).add(P[c]).add(P[d]).multiplyScalar(0.25);
  P.push(center); const ci = P.length - 1; // a helper point inside, only for orienting faces
  [[a, b, c], [a, b, d], [a, c, d], [b, c, d]].forEach(([x, y, z]) => addFace(x, y, z, -1, ci));
  const insideAt = new Array(ci).fill(Infinity);           // the step after which each point is known to be inside
  const assign = (pts, list, step) => pts.forEach(i => {
    const f = list.find(g => dist(g, i) > EPS);
    if (f) f.out.push(i); else insideAt[i] = step;
  });
  assign([...Array(ci).keys()].filter(i => ![a, b, c, d].includes(i)), faces, -1);
  const steps = [];
  for (let s = 0; ; s++) {
    const f = faces.find(g => g.died === Infinity && g.out.length);
    if (!f) break;
    const eye = f.out.reduce((m, i) => (dist(f, i) > dist(f, m) ? i : m), f.out[0]);
    const vis = faces.filter(g => g.died === Infinity && dist(g, eye) > EPS);
    const edges = new Set(vis.flatMap(g => g.v.map((v, k) => `${v}_${g.v[(k + 1) % 3]}`)));
    const horizon = [...edges].filter(e => { const [x, y] = e.split('_'); return !edges.has(`${y}_${x}`); }).map(e => e.split('_').map(Number));
    vis.forEach(g => (g.died = s));
    const made = horizon.map(([x, y]) => addFace(x, y, eye, s, ci));
    const orphans = vis.flatMap(g => g.out).filter(i => i !== eye);
    assign(orphans, made, s);
    insideAt[eye] = Infinity;
    steps.push({ from: f, eye, vis, horizon, made });
  }
  P.pop();
  return { faces, steps, insideAt, start: [a, b, c, d] };
}

// the timeline: points alone, the tetrahedron, the steps (slow at first, then quicker), the glow, the fade
const DUR = k => Math.max(0.24, 0.46 * 0.8 ** k);
function clock(nSteps) {
  const starts = [];
  let t = 0.7;
  for (let k = 0; k < nSteps; k++) { starts.push(t); t += DUR(k); }
  return { starts, end: t };
}
// which step is running at time t and how far into it (u), or { s: n } when done
function stepAt(t, C, n) {
  for (let k = n - 1; k >= 0; k--) if (t >= C.starts[k]) return t - C.starts[k] < DUR(k) ? { s: k, u: (t - C.starts[k]) / DUR(k) } : { s: k + 1, u: 0 };
  return { s: 0, u: 0, before: true };
}

// 1 while the steps are slow enough to show every stage, easing to 0 (growth only) by the fifth step
const strongAt = (t, C) => 1 - ease.inOut(span(t, C.starts[1], C.starts[4]));

export default {
  name: 'Convex Hull',
  ko: '볼록 껍질',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas'); bg.width = 4; bg.height = 256;
    const b = bg.getContext('2d'), grd = b.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#07081A'); grd.addColorStop(0.5, '#151638'); grd.addColorStop(1, '#090A1C');
    b.fillStyle = grd; b.fillRect(0, 0, 4, 256);
    scene.background = new THREE.CanvasTexture(bg); scene.background.colorSpace = THREE.SRGBColorSpace;
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.6;
    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
    camera.position.set(0, 1.0, 10.6);
    camera.lookAt(0, -0.22, 0);
    const key = new THREE.DirectionalLight('#FFFFFF', 1.6); key.position.set(-3, 5, 4);
    scene.add(key, new THREE.AmbientLight('#8090C0', 0.4));

    const P = cloud(), hull = quickhull(P), n = hull.steps.length, C = clock(n);
    this.info = { n, C };
    const group = new THREE.Group(); scene.add(group);

    // points
    const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 20, 12), new THREE.MeshBasicMaterial({ toneMapped: false }), P.length);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 16), new THREE.MeshBasicMaterial({ color: '#FF9F1C', transparent: true, opacity: 0, toneMapped: false }));
    group.add(dots, halo);

    // faces: drawn twice (back faces, then front), so the see-through shell sorts itself
    const MAXF = hull.faces.length;
    const pos = new Float32Array(MAXF * 9), col = new Float32Array(MAXF * 12); // RGBA, so faces can fade
    const fgeo = new THREE.BufferGeometry();
    fgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    fgeo.setAttribute('color', new THREE.BufferAttribute(col, 4));
    const fmat = side => new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side,
      vertexShader: `attribute vec4 color; varying vec4 vC; varying vec3 vN, vV;
        void main() { vC = color; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz;
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec4 vC; varying vec3 vN, vV;
        void main() {
          vec3 n = normalize(vN), v = normalize(vV);
          if (!gl_FrontFacing) n = -n;
          float lam = 0.55 + 0.45 * max(dot(n, normalize(vec3(-0.4, 0.7, 0.6))), 0.0);
          float fr = pow(1.0 - abs(dot(n, v)), 2.0);
          gl_FragColor = vec4(vC.rgb * lam + fr * 0.25, vC.a * (0.34 + 0.4 * fr));
        }`,
    });
    const back = new THREE.Mesh(fgeo, fmat(THREE.BackSide)), front = new THREE.Mesh(fgeo, fmat(THREE.FrontSide));
    back.renderOrder = 1; front.renderOrder = 2;
    back.frustumCulled = front.frustumCulled = false;
    group.add(back, front);
    // edges, the horizon and the eye line as fat lines
    const res = new THREE.Vector2(W, H);
    const lines = (width, order) => {
      const l = new LineSegments2(new LineSegmentsGeometry(), new LineMaterial({ vertexColors: true, linewidth: width, resolution: res, transparent: true, depthWrite: false }));
      l.renderOrder = order; group.add(l);
      return l;
    };
    const edges = lines(3.2, 3), dyingEdges = lines(3.2, 3), horizonLine = lines(6, 4), eyeLine = lines(4, 4);
    const setLines = (l, seg, segC, opacity) => {
      const g = new LineSegmentsGeometry();
      if (seg.length) { g.setPositions(seg); g.setColors(segC); }
      l.geometry.dispose(); l.geometry = g;
      l.material.opacity = opacity; l.visible = seg.length > 0 && opacity > 0.002;
    };
    const cHull = new THREE.Color('#4F8BFF'), cRed = new THREE.Color('#FF3355'), cNew = new THREE.Color('#9AF0FF');
    const cEdge = new THREE.Color('#BFD8FF'), cHor = new THREE.Color('#FFD166'), cEye = new THREE.Color('#FF9F1C');
    const cFree = new THREE.Color('#9BEBFF'), cIn = new THREE.Color('#3A4370'), cVert = new THREE.Color('#FFFFFF');
    const tmpC = new THREE.Color(), m4 = new THREE.Matrix4();
    const onHullAt = new Map(); // vertex -> step it joined the hull (-1 for the tetrahedron)
    hull.start.forEach(i => onHullAt.set(i, -1));
    hull.steps.forEach((s, k) => onHullAt.set(s.eye, k));

    return {
      scene, camera,
      update(t) {
        const a = phase(t) * TAU;
        group.rotation.y = 0.5 + 0.55 * Math.sin(a);
        group.rotation.x = 0.12 * Math.sin(2 * a + 0.5);
        const { s, u, before } = stepAt(t, C, n);
        const show = ease.inOut(span(t, 0.25, 0.7)) * (1 - ease.inOut(span(t, 4.45, 4.97)));      // the hull fades in and out
        const glow = Math.sin(Math.PI * span(t, C.end + 0.02, C.end + 0.62)) ** 2;            // one smooth swell when done
        const cur = !before && s < n ? hull.steps[s] : null;
        const strong = cur ? strongAt(t, C) : 0;                         // quick steps skip the slow highlights
        const kRed = cur ? ease.inOut(span(u, 0.25, 0.45)) * strong : 0;
        const kHor = cur ? Math.sin(Math.PI * span(u, 0.35, 0.95)) * strong : 0;
        const kGrow = cur ? ease.inOut(span(u, 0.1 + 0.45 * strong, 1.0)) : 0; // quick steps grow for most of the step
        const apexOf = cur ? (() => {                                     // the new fan starts flat at the horizon's centre
          const m = new THREE.Vector3();
          cur.horizon.forEach(([x]) => m.add(P[x]));
          return m.multiplyScalar(1 / cur.horizon.length).lerp(P[cur.eye], kGrow);
        })() : null;

        // faces alive now
        let nf = 0;
        const E = { hull: [[], []], dying: [[], []], hor: [[], []], eye: [[], []] };
        const pushEdge = (L, p, q, c) => { L[0].push(p.x, p.y, p.z, q.x, q.y, q.z); L[1].push(c.r, c.g, c.b, c.r, c.g, c.b); };
        for (const f of hull.faces) {
          const growing = cur && f.born === s, dying = cur && f.died === s;
          const alive = (f.born < s || growing) && (f.died > s || dying) && !(before && f.born >= 0);
          if (!alive || (growing && kGrow <= 0)) continue;
          if (dying && kGrow >= 1) continue;
          const vs = f.v.map(i => (growing && i === cur.eye ? apexOf : P[i]));
          tmpC.copy(cHull);
          if (dying) tmpC.lerp(cRed, kRed);
          if (growing) tmpC.lerp(cNew, (1 - kGrow) * (0.3 + 0.7 * strong)); // pale when born, plain hull blue once grown
          tmpC.lerp(cNew, glow * 0.5);
          // the old faces fade as the new ones fade in (sqrt keeps the summed cover even); red faces a little more opaque
          const fade = (dying ? (1 - kGrow) * (1 + 1.2 * kRed) : growing ? Math.sqrt(kGrow) : 1) * show;
          vs.forEach((v, k) => { pos.set([v.x, v.y, v.z], nf * 9 + k * 3); col.set([tmpC.r, tmpC.g, tmpC.b, fade], nf * 12 + k * 4); });
          nf++;
          const ec = tmpC.copy(cEdge).lerp(cNew, glow);
          for (let k = 0; k < 3; k++) pushEdge(dying ? E.dying : E.hull, vs[k], vs[(k + 1) % 3], ec);
        }
        fgeo.setDrawRange(0, nf * 3);
        fgeo.attributes.position.needsUpdate = fgeo.attributes.color.needsUpdate = true;
        fgeo.computeVertexNormals();
        let kEye = 0;
        if (cur) {
          cur.horizon.forEach(([x, y]) => pushEdge(E.hor, P[x], P[y], cHor));
          // the line from the face the point was picked for to the point
          kEye = Math.sin(Math.PI * span(u, 0.0, 0.7)) * strong;
          const m = new THREE.Vector3(); cur.from.v.forEach(i => m.add(P[i])); m.multiplyScalar(1 / 3);
          pushEdge(E.eye, m, P[cur.eye], cEye);
        }
        setLines(edges, ...E.hull, show * 0.9);
        setLines(dyingEdges, ...E.dying, show * 0.9 * (1 - kGrow));
        setLines(horizonLine, ...E.hor, Math.min(1, kHor));
        setLines(eyeLine, ...E.eye, kEye);

        // points: free (cyan), on the hull (white), inside (dim), the current eye (orange, with a halo)
        P.forEach((p, i) => {
          let c = tmpC.copy(cFree), sc = 1;
          const joined = onHullAt.has(i) ? onHullAt.get(i) : Infinity, inAt = hull.insideAt[i];
          // how far a change that happens in step st has gone (0 before, 1 after), easing over the end of that step
          const past = (st, a) => (before ? 0 : st < s ? 1 : cur && st === s ? ease.inOut(span(u, a, 1)) : 0);
          if (inAt < Infinity) c.lerp(cIn, (inAt === -1 ? ease.inOut(span(t, 0.25, 0.7)) : past(inAt, 0.6)) * show);
          else if (joined < Infinity) {
            const k = (joined === -1 ? ease.inOut(span(t, 0.25, 0.7)) : past(joined, 0.85)) * show;
            c.lerp(cVert, k); sc = 1 + 0.35 * k;
            if (cur && i === cur.eye) {                                   // the picked point: orange for the step
              const e = ease.inOut(span(u, 0, 0.25)) * (1 - ease.inOut(span(u, 0.8, 1)));
              c.lerp(cEye, e); sc += 0.5 * e;
            }
          }
          dots.setColorAt(i, c);
          dots.setMatrixAt(i, m4.makeScale(sc, sc, sc).setPosition(p));
        });
        dots.instanceColor.needsUpdate = true; dots.instanceMatrix.needsUpdate = true;
        if (cur) { halo.position.copy(P[cur.eye]); halo.material.opacity = 0.35 * Math.sin(Math.PI * u); } else halo.material.opacity = 0;
      },
    };
  },
  // the step read-out under the hull
  overlay(ctx, t, W, H) {
    const { n, C } = this.info;
    const { s, u, before } = stepAt(t, C, n);
    const done = !before && s >= n;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 46px ${FONT.sans}`; ctx.fillStyle = '#EEF2FF';
    ctx.fillText('QUICKHULL', W / 2, 1490);
    ctx.font = `500 32px ${FONT.mono}`; ctx.fillStyle = 'rgba(200, 215, 255, 0.8)';
    ctx.fillText(before ? 'start: tetrahedron' : done ? `hull done · ${n} steps` : `step ${s + 1} / ${n}`, W / 2, 1548);
    const items = [['farthest point', '#FF9F1C', 0.0, 0.3], ['visible faces', '#FF4D6D', 0.25, 0.55], ['horizon', '#FFD166', 0.35, 0.8], ['new faces', '#9AF0FF', 0.55, 1.0]];
    items.forEach(([label, color, a, b], k) => {
      const x = W / 2 + (k - 1.5) * 238, y = 1640;
      // slow steps light each stage in turn; quick steps keep only "new faces" on, steadily
      const st = strongAt(t, C), steady = k === 3 ? (1 - st) * ease.inOut(span(t, C.starts[1], C.starts[2])) * (1 - ease.inOut(span(t, C.end - 0.1, C.end + 0.3))) : 0;
      const on = clamp((!before && !done ? st * Math.sin(Math.PI * clamp((u - a) / (b - a))) : 0) + steady);
      ctx.globalAlpha = 0.4 + 0.6 * on;
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y - 30, 11 + 4 * on, 0, TAU); ctx.fill();
      ctx.font = `600 27px ${FONT.sans}`; ctx.fillStyle = '#EEF2FF';
      ctx.fillText(label, x, y + 12);
      ctx.globalAlpha = 1;
    });
  },
};
