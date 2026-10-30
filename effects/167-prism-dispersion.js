// Prism dispersion: a white beam is traced through a 60° glass prism with Snell's law, once for each of 64 wavelengths.
// The index follows Cauchy's equation n(λ) = 1.40 + 0.035 / λ² (λ in µm, about 10 × real glass so the fan is wide), so
// violet bends more than red and the beam leaves as a rainbow fan that lands on a card. The prism rocks ±10° and the
// fan, recomputed every frame, swings and widens. The beams are additive ribbons with a light bloom.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { TAU, phase } from '../lib/util.js';

const SIDE = 2.4, NL = 64;                                  // prism side, number of wavelengths
const ior = lam => 1.40 + 0.035 / (lam * lam);              // Cauchy, λ in µm
const V = (x, y) => new THREE.Vector2(x, y);

// 2D refraction of unit d through a surface with unit normal n (facing against d); null on total internal reflection
function refract(d, n, eta) {
  const c = -d.dot(n), k = 1 - eta * eta * (1 - c * c);
  return k < 0 ? null : d.clone().multiplyScalar(eta).add(n.clone().multiplyScalar(eta * c - Math.sqrt(k))).normalize();
}
// where the ray o + t·d crosses the segment a–b (t > 0), or null
function cross(o, d, a, b) {
  const e = b.clone().sub(a), den = d.x * e.y - d.y * e.x;
  if (Math.abs(den) < 1e-9) return null;
  const w = a.clone().sub(o), t = (w.x * e.y - w.y * e.x) / den, s = (w.x * d.y - w.y * d.x) / den;
  return t > 1e-6 && s >= 0 && s <= 1 ? o.clone().add(d.clone().multiplyScalar(t)) : null;
}
// a rainbow colour for a wavelength in nm, dimmer toward both ends of the visible range
function spectral(nm) {
  const edge = Math.max(0, Math.min(1, (nm - 400) / 40, (700 - nm) / 40));
  return new THREE.Color().setHSL(0.75 * (700 - nm) / 300, 1, 0.5).multiplyScalar(0.3 + 0.7 * edge);
}

// a ribbon of n vertex pairs; quads join pair i to pair i + 1
function ribbon(n) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
  const idx = [];
  for (let i = 0; i < n - 1; i++) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
  g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
  m.renderOrder = 5; m.frustumCulled = false;
  return m;
}
function setPair(m, i, a, b, ca, cb) {
  m.geometry.attributes.position.array.set([a.x, a.y, a.z || 0, b.x, b.y, b.z || 0], i * 6);
  m.geometry.attributes.color.array.set([ca.r, ca.g, ca.b, cb.r, cb.g, cb.b], i * 6);
}

export default {
  name: 'Prism Dispersion',
  ko: '프리즘 분산',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.NeutralToneMapping;
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas'); bg.width = W / 2; bg.height = H / 2;
    const b = bg.getContext('2d'), grd = b.createRadialGradient(W / 4, H / 4, 40, W / 4, H / 4, H / 2);
    grd.addColorStop(0, '#1A1D33'); grd.addColorStop(1, '#05060C');
    b.fillStyle = grd; b.fillRect(0, 0, W / 2, H / 2);
    scene.background = new THREE.CanvasTexture(bg); scene.background.colorSpace = THREE.SRGBColorSpace;
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.5;

    const camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 100);
    camera.position.set(4.2, 0.4, 19.5);                    // a little to the side, so the prism shows its depth
    camera.lookAt(0.1, -2.5, 0);

    // everything is laid out in the rig's x/y plane; the rig is turned so the beam comes in from the left and the rainbow falls
    const rig = new THREE.Group();
    rig.rotation.z = -1.06;
    rig.position.x = -0.8;
    scene.add(rig);
    const hgt = SIDE * Math.sqrt(3) / 2;
    const tri = [V(0, hgt * 2 / 3), V(-SIDE / 2, -hgt / 3), V(SIDE / 2, -hgt / 3)];   // apex, bottom left, bottom right
    const prismGeo = new THREE.ExtrudeGeometry(new THREE.Shape(tri), { depth: 1.4, bevelEnabled: false });
    prismGeo.translate(0, 0, -0.7);
    const prism = new THREE.Mesh(prismGeo, new THREE.MeshPhysicalMaterial({
      color: '#DDEEFF', transmission: 1, thickness: 1.2, ior: 1.5, roughness: 0.03, specularIntensity: 1, envMapIntensity: 2.0,
    }));
    const edges = new LineSegments2(new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(prismGeo, 30)),
      new LineMaterial({ color: '#DDEBFF', linewidth: 2.5, transparent: true, opacity: 0.75, resolution: new THREE.Vector2(W, H) }));
    prism.add(edges);
    rig.add(prism);

    // the incoming beam rises at 19.3°, the angle of minimum deviation for mid green
    const d0 = V(Math.cos(0.337), Math.sin(0.337));
    const lams = Array.from({ length: NL }, (_, i) => 0.4 + 0.3 * i / (NL - 1));
    const cols = lams.map(l => spectral(l * 1000));
    function trace(theta) {
      const c = Math.cos(theta), s = Math.sin(theta);
      const P = tri.map(p => V(p.x * c - p.y * s, p.x * s + p.y * c));
      const outward = (a, e) => { const d = e.clone().sub(a); return V(d.y, -d.x).normalize(); };   // tri is counter-clockwise
      const nL = outward(P[0], P[1]), nR = outward(P[2], P[0]);
      const o = V(-0.6, 0.35).add(d0.clone().multiplyScalar(-16));   // aimed at the middle of the left face
      const entry = cross(o, d0, P[0], P[1]);
      return lams.map(l => {
        const din = refract(d0, nL, 1 / ior(l));
        const exit = cross(entry, din, P[2], P[0]);
        return { o, entry, exit, dout: exit && refract(din, nR.clone().negate(), ior(l)) };
      });
    }

    // the card: 7 units along the mid-green exit ray, tilted 55° toward the camera so its face shows
    const mid = trace(0)[NL >> 1];
    const cardO = mid.exit.clone().add(mid.dout.clone().multiplyScalar(7)), cardU = V(-mid.dout.y, mid.dout.x);
    const ax = new THREE.Vector3(cardU.x, cardU.y, 0);
    const nrm = new THREE.Vector3(-mid.dout.x, -mid.dout.y, 0).multiplyScalar(Math.cos(0.96)).add(new THREE.Vector3(0, 0, Math.sin(0.96)));
    const up = new THREE.Vector3().crossVectors(nrm, ax);
    const card = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.6), new THREE.MeshStandardMaterial({ color: '#15161E', roughness: 0.95, envMapIntensity: 0.3 }));
    card.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(ax, up, nrm));
    card.position.set(cardO.x, cardO.y, 0).addScaledVector(nrm, -0.01);
    rig.add(card);

    const beamIn = ribbon(2), inside = ribbon(NL), fan = ribbon(NL), band = ribbon(NL);
    rig.add(beamIn, inside, fan, band);
    const white = new THREE.Color(1.1, 1.1, 1.1), none = new THREE.Color(0, 0, 0);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.55, 0.4, 0.35));
    composer.addPass(new OutputPass());

    return {
      scene, camera,
      update(t) {
        const theta = 0.17 * Math.sin(phase(t) * TAU);       // the prism rocks ±10°
        prism.rotation.z = theta;
        const rays = trace(theta), { o, entry } = rays[0];
        const w = V(-d0.y, d0.x).multiplyScalar(0.07);         // half-width of the white beam
        setPair(beamIn, 0, o.clone().add(w), o.clone().sub(w), white, white);
        setPair(beamIn, 1, entry.clone().add(w), entry.clone().sub(w), white, white);
        rays.forEach((r, i) => {
          const c = cols[i];
          setPair(inside, i, entry, r.exit, c.clone().multiplyScalar(0.3), c.clone().multiplyScalar(0.3));
          const hit = r.dout && cross(r.exit, r.dout, cardO.clone().addScaledVector(cardU, -2.3), cardO.clone().addScaledVector(cardU, 2.3));
          if (!hit) { setPair(fan, i, r.exit, r.exit, none, none); setPair(band, i, r.exit, r.exit, none, none); return; }
          setPair(fan, i, r.exit, hit, c.clone().multiplyScalar(0.45), c.clone().multiplyScalar(0.3));
          const h3 = new THREE.Vector3(hit.x, hit.y, 0);        // the spot on the tilted card, 0.36 tall
          setPair(band, i, h3.clone().addScaledVector(up, 0.18), h3.clone().addScaledVector(up, -0.18), c.clone().multiplyScalar(0.9), c.clone().multiplyScalar(0.9));
        });
        for (const m of [beamIn, inside, fan, band]) { m.geometry.attributes.position.needsUpdate = true; m.geometry.attributes.color.needsUpdate = true; }
      },
      render() { composer.render(); },
    };
  },
};
