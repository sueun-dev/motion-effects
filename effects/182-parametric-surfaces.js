// Parametric surfaces: three surfaces p(u, v) on the same (u, v) grid, morphed by blending their points:
// a Mobius strip, a figure-8 Klein bottle and a knotted Klein tube on a trefoil. Each one is a cross-section
// f(v) = (a sin 2pi v, b sin 4pi v) carried round a closed path while it turns half a turn, so all three join
// their u = 0 and u = 1 edges the same way (v -> 1 - v) and the mesh never tears. The iso-parameter lines drift
// along u; the normals come from the partial derivatives, so the shading has no seam.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TAU, FONT, phase, span, ease } from '../lib/util.js';

const U = 300, V = 90, M = 2400;
const knot = s => new THREE.Vector3(Math.sin(s) + 2 * Math.sin(2 * s), Math.cos(s) - 2 * Math.cos(2 * s), -Math.sin(3 * s));
const knotT = s => new THREE.Vector3(Math.cos(s) + 4 * Math.cos(2 * s), -Math.sin(s) + 4 * Math.sin(2 * s), -3 * Math.cos(3 * s)).normalize();
const NAMES = [['Möbius strip', '뫼비우스 띠'], ['Klein bottle', '클라인 병'], ['Trefoil Klein tube', '세잎매듭 클라인 관']];
// the shape schedule: hold, morph, hold, ... (A -> B -> C -> A)
const MORPHS = [[0.85, 1.6], [2.5, 3.25], [4.1, 4.85]];
const blend = t => MORPHS.reduce((s, [a, b]) => s + ease.inOut(span(t, a, b)), 0);

export default {
  name: 'Parametric Surfaces',
  ko: '매개변수 곡면',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas'); bg.width = bg.height = 512;
    const b = bg.getContext('2d'), grd = b.createRadialGradient(256, 220, 20, 256, 256, 380);
    grd.addColorStop(0, '#213A4A'); grd.addColorStop(1, '#0A121A');
    b.fillStyle = grd; b.fillRect(0, 0, 512, 512);
    scene.background = new THREE.CanvasTexture(bg); scene.background.colorSpace = THREE.SRGBColorSpace;
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.5;
    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
    camera.position.set(0, 0, 16);
    camera.lookAt(0, 0, 0);
    const key = new THREE.DirectionalLight('#FFF4E6', 2.2);
    key.position.set(-3, 6, 5);
    scene.add(key, new THREE.HemisphereLight('#BFE6FF', '#1A1020', 0.5));

    // a rotation-minimising frame round the trefoil, closed up (the circle's frame is just radial / up)
    const Nf = [];
    let r = new THREE.Vector3(0, 0, 1).projectOnPlane(knotT(0)).normalize();
    for (let i = 0; i <= M; i++) {
      const s0 = (i / M) * TAU, s1 = ((i + 1) / M) * TAU;
      Nf.push(r.clone());
      const v1 = knot(s1).sub(knot(s0)), c1 = v1.dot(v1), t0 = knotT(s0);
      const rL = r.clone().addScaledVector(v1, (-2 / c1) * v1.dot(r)), tL = t0.clone().addScaledVector(v1, (-2 / c1) * v1.dot(t0));
      const v2 = knotT(s1).sub(tL), c2 = v2.dot(v2);
      r = rL.addScaledVector(v2, (-2 / c2) * v2.dot(rL));
    }
    const b0 = new THREE.Vector3().crossVectors(knotT(0), Nf[0]), gap = Math.atan2(Nf[M].dot(b0), Nf[M].dot(Nf[0]));
    Nf.forEach((n, i) => n.applyAxisAngle(knotT((i / M) * TAU), -gap * i / M));

    // p(u, v) for surface k; u, v in 0..1 (u may run past 1: the formulas repeat with v -> 1 - v)
    const T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
    const SHAPES = [
      { R: 1.55, a: 0.78, b: 0.07 }, // Mobius strip: a flat figure-8, so a thin band
      { R: 1.45, a: 0.62, b: 0.62 }, // Klein bottle (figure-8 immersion)
      { R: 0.62, a: 0.3, b: 0.3, knot: true },
    ];
    const surf = (k, u, v, out) => {
      const sh = SHAPES[k], s = u * TAU;
      if (sh.knot) {
        const q = ((s % TAU) + TAU) % TAU / TAU * M, i = Math.floor(q);
        C.copy(knot(s)).multiplyScalar(sh.R); T.copy(knotT(s));
        N.copy(Nf[i]).lerp(Nf[Math.min(M, i + 1)], q - i).projectOnPlane(T).normalize();
      } else {
        C.set(sh.R * Math.cos(s), sh.R * Math.sin(s), 0); T.set(-Math.sin(s), Math.cos(s), 0);
        N.set(Math.cos(s), Math.sin(s), 0);
      }
      B.crossVectors(T, N);
      const x = sh.a * Math.sin(TAU * v), y = sh.b * Math.sin(2 * TAU * v), th = Math.PI * u; // half a turn per lap
      const cx = x * Math.cos(th) - y * Math.sin(th), cy = x * Math.sin(th) + y * Math.cos(th);
      return out.copy(C).addScaledVector(N, cx).addScaledVector(B, cy);
    };

    // the grid: (U + 1) x (V + 1) points; uv carries the parameter for the line texture
    const geo = new THREE.BufferGeometry(), n = (U + 1) * (V + 1);
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = [];
    for (let i = 0; i < U; i++) for (let j = 0; j < V; j++) {
      const a = i * (V + 1) + j;
      idx.push(a, a + V + 1, a + 1, a + 1, a + V + 1, a + V + 2);
    }
    geo.setIndex(idx);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    // iso-parameter lines: 24 along u, 12 across v, on a colour that depends only on |v - 1/2| (so v -> 1 - v matches)
    const c = document.createElement('canvas'); c.width = 2048; c.height = 1024;
    const g = c.getContext('2d'), vg = g.createLinearGradient(0, 0, 0, 1024);
    vg.addColorStop(0, '#F2553F'); vg.addColorStop(0.25, '#FFB23E'); vg.addColorStop(0.5, '#17B3AE'); vg.addColorStop(0.75, '#FFB23E'); vg.addColorStop(1, '#F2553F');
    g.fillStyle = vg; g.fillRect(0, 0, 2048, 1024);
    g.fillStyle = 'rgba(255, 255, 255, 0.55)';
    for (let k = 0; k <= 24; k++) g.fillRect(k * 2048 / 24 - 5, 0, 10, 1024);
    for (let k = 0; k <= 12; k++) g.fillRect(0, Math.min(1014, Math.max(0, k * 1024 / 12 - 5)), 2048, 10);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.anisotropy = 8;
    const mesh = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.25, side: THREE.DoubleSide }));
    const spin = new THREE.Group();
    spin.add(mesh);
    scene.add(spin);

    // the blended surface between shapes k0 and k1 (weight w), and its partial derivatives by central differences
    let k0 = 0, k1 = 1, w = 0;
    const sa = new THREE.Vector3(), sb = new THREE.Vector3(), p1 = new THREE.Vector3(), p2 = new THREE.Vector3();
    const du = new THREE.Vector3(), dv = new THREE.Vector3(), e = 1e-3;
    const at = (u, v, out) => out.copy(surf(k0, u, v, sa)).lerp(surf(k1, u, v, sb), w);

    return {
      scene, camera,
      update(t) {
        const m = blend(t);
        k0 = Math.min(2, Math.floor(m)); w = m - k0; k1 = (k0 + 1) % 3;
        const shift = (2 / 24) * phase(t); // the parameter lines drift two cells along u per loop
        for (let i = 0; i <= U; i++) for (let j = 0; j <= V; j++) {
          const o = i * (V + 1) + j, u = i / U - shift, v = j / V;
          at(u, v, p1).toArray(pos, o * 3);
          du.subVectors(at(u + e, v, p1), at(u - e, v, p2));
          dv.subVectors(at(u, v + e, p1), at(u, v - e, p2));
          du.cross(dv).normalize().toArray(nor, o * 3);
          uv[o * 2] = i / U; uv[o * 2 + 1] = v;
        }
        geo.attributes.position.needsUpdate = true;
        geo.attributes.normal.needsUpdate = true;
        geo.attributes.uv.needsUpdate = true;
        geo.computeBoundingSphere();
        const a = phase(t) * TAU;
        spin.rotation.set(-0.95 + 0.12 * Math.sin(a), 0.35 * Math.sin(a), 0.2 * Math.cos(a));
      },
    };
  },
  // the name of the surface on screen, cross-fading as it morphs
  overlay(ctx, t, W, H) {
    const m = blend(t);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let k = 0; k <= 3; k++) {
      const o = Math.max(0, 1 - Math.abs(m - k) * 1.6);
      if (o <= 0) continue;
      const [en, ko] = NAMES[k % 3];
      ctx.globalAlpha = o;
      ctx.font = `600 52px ${FONT.sans}`; ctx.fillStyle = '#FFFFFF';
      ctx.fillText(en, W / 2, 1610);
      ctx.font = `500 36px ${FONT.ko}`; ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.fillText(ko, W / 2, 1672);
    }
    ctx.globalAlpha = 1;
    ctx.font = `italic 400 34px ${FONT.serif}`; ctx.fillStyle = 'rgba(190, 235, 240, 0.7)';
    ctx.fillText('p(u, v),  0 ≤ u, v ≤ 1', W / 2, 1752);
  },
};
