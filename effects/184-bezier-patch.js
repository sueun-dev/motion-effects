// Bezier patch: one bicubic Bezier surface evaluated from a 4 x 4 control net (Bernstein polynomials, exact normals
// from the partial derivatives). The net ripples, and each of the four inner control points is lifted in turn
// (highlighted, with a drop line), so the smooth surface can be seen following its control points.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { TAU, phase, span } from '../lib/util.js';

const N = 80, S = 1.75; // surface grid, half size of the net
const bern = [k => (1 - k) ** 3, k => 3 * k * (1 - k) ** 2, k => 3 * k * k * (1 - k), k => k ** 3];
const dbern = [k => -3 * (1 - k) ** 2, k => 3 * (1 - k) * (1 - 3 * k), k => 3 * k * (2 - 3 * k), k => 3 * k * k];
const INNER = [[1, 1], [1, 2], [2, 2], [2, 1]]; // lifted in this order, one every 1.25 s

// a texture for the surface: a soft gradient with the isoparametric lines u, v = k / 10
function iso(c1, c2, line) {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const g = c.getContext('2d'), grd = g.createLinearGradient(0, 0, 1024, 1024);
  grd.addColorStop(0, c1); grd.addColorStop(1, c2);
  g.fillStyle = grd; g.fillRect(0, 0, 1024, 1024);
  g.fillStyle = line;
  for (let k = 0; k <= 10; k++) {
    const p = Math.min(1014, Math.max(0, k * 102.4 - 5));
    g.fillRect(p, 0, 10, 1024); g.fillRect(0, p, 1024, 10);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return tex;
}

export default {
  name: 'Bézier Patch',
  ko: '베지어 곡면',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas'); bg.width = 4; bg.height = 256;
    const b = bg.getContext('2d'), grd = b.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#0B1030'); grd.addColorStop(0.6, '#1A2458'); grd.addColorStop(1, '#2C2A62');
    b.fillStyle = grd; b.fillRect(0, 0, 4, 256);
    scene.background = new THREE.CanvasTexture(bg); scene.background.colorSpace = THREE.SRGBColorSpace;
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.35;
    
    const camera = new THREE.PerspectiveCamera(32, W / H, 0.1, 100);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap; // blurred, so the sheet casts a soft shadow
    const sun = new THREE.DirectionalLight('#FFF0E0', 2.2);
    sun.position.set(-2, 9, 3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 });
    sun.shadow.radius = 22;
    sun.shadow.blurSamples = 24;
    scene.add(sun, new THREE.HemisphereLight('#B9C6FF', '#2A1E40', 0.7));

    // the surface: front and back faces get their own colours (two meshes, each drawing one side)
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array((N + 1) ** 2 * 3), nor = new Float32Array((N + 1) ** 2 * 3), uv = [], idx = [];
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) uv.push(i / N, j / N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = j * (N + 1) + i;
      idx.push(a, a + N + 1, a + 1, a + 1, a + N + 1, a + N + 2);
    }
    geo.setIndex(idx);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const front = new THREE.MeshPhysicalMaterial({ map: iso('#F25C3B', '#C8205E', 'rgba(255, 236, 224, 0.42)'), roughness: 0.38, clearcoat: 0.8, clearcoatRoughness: 0.2 });
    const back = new THREE.MeshPhysicalMaterial({ map: iso('#1FA6B0', '#2B4FD8', 'rgba(230, 250, 255, 0.4)'), roughness: 0.38, clearcoat: 0.8, clearcoatRoughness: 0.2, side: THREE.BackSide });
    const sheets = [new THREE.Mesh(geo, front), new THREE.Mesh(geo, back)];
    sheets[0].castShadow = true;
    front.shadowSide = THREE.DoubleSide; // an open sheet: both sides go into the shadow map
    scene.add(...sheets);

    // the control net: 24 gold segments and 16 beads
    const res = new THREE.Vector2(W, H);
    const netGeo = new LineSegmentsGeometry().setPositions(new Float32Array(24 * 6));
    const net = new LineSegments2(netGeo, new LineMaterial({ color: '#FFC94A', linewidth: 4.5, resolution: res, transparent: true, opacity: 0.9, depthTest: false, toneMapped: false }));
    net.renderOrder = 2;
    const dropGeo = new LineSegmentsGeometry().setPositions(new Float32Array(6));
    const drop = new LineSegments2(dropGeo, new LineMaterial({ color: '#FFFFFF', linewidth: 3, resolution: res, dashed: true, dashSize: 0.14, gapSize: 0.1, transparent: true, opacity: 0.8, toneMapped: false }));
    scene.add(net, drop);
    const beadMat = new THREE.MeshBasicMaterial({ color: '#FFD873', depthTest: false, toneMapped: false });
    const hotMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF', depthTest: false, toneMapped: false });
    const beads = [];
    for (let k = 0; k < 16; k++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 12), beadMat);
      m.renderOrder = 3;
      scene.add(m); beads.push(m);
    }
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.225, 48), new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, depthTest: false, side: THREE.DoubleSide, toneMapped: false }));
    halo.renderOrder = 3;
    scene.add(halo);

    // a soft pool of light on the floor far below
    const pool = document.createElement('canvas'); pool.width = pool.height = 256;
    const pg = pool.getContext('2d'), rg = pg.createRadialGradient(128, 128, 10, 128, 128, 128);
    rg.addColorStop(0, 'rgba(120, 140, 255, 0.28)'); rg.addColorStop(1, 'rgba(120, 140, 255, 0)');
    pg.fillStyle = rg; pg.fillRect(0, 0, 256, 256);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(pool), transparent: true, depthWrite: false }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -2.6;
    const shade = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0.22 }));
    shade.rotation.x = -Math.PI / 2; shade.position.y = -2.6; shade.receiveShadow = true;
    floor.renderOrder = -1; shade.material.depthWrite = false; // the glow first, then the shadow over it
    scene.add(floor, shade);

    const P = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => new THREE.Vector3()));
    const du = new THREE.Vector3(), dv = new THREE.Vector3(), n = new THREE.Vector3();

    return {
      scene, camera,
      update(t) {
        const a = phase(t) * TAU;
        const sway = 0.2 * Math.sin(a) + 0.12;
        camera.position.set(13.8 * Math.sin(sway), 8.0, 13.8 * Math.cos(sway));
        camera.lookAt(0, 0.05, 0);

        // the net: a slow travelling ripple, plus one inner point lifted at a time
        const step = Math.floor(t / 1.25) % 4, k = Math.sin(Math.PI * span(t - step * 1.25, 0.1, 1.15)) ** 2;
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
          const x = -S + (2 * S * i) / 3, z = -S + (2 * S * j) / 3;
          let y = 0.55 * Math.sin(a + 1.3 * i + 0.9 * j) + 0.3 * Math.cos(2 * a - 1.1 * j);
          if (INNER[step][0] === i && INNER[step][1] === j) y += 2.3 * k;
          P[i][j].set(x + 0.15 * Math.sin(a + j), y, z + 0.15 * Math.cos(a + i));
        }
        // the surface: B(u, v) = sum Bi(u) Bj(v) Pij, normal = dB/du x dB/dv
        for (let jv = 0; jv <= N; jv++) for (let iu = 0; iu <= N; iu++) {
          const u = iu / N, v = jv / N, o = (jv * (N + 1) + iu) * 3;
          let x = 0, y = 0, z = 0;
          du.set(0, 0, 0); dv.set(0, 0, 0);
          for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
            const p = P[i][j], w = bern[i](u) * bern[j](v), wu = dbern[i](u) * bern[j](v), wv = bern[i](u) * dbern[j](v);
            x += w * p.x; y += w * p.y; z += w * p.z;
            du.addScaledVector(p, wu); dv.addScaledVector(p, wv);
          }
          pos[o] = x; pos[o + 1] = y; pos[o + 2] = z;
          n.crossVectors(dv, du).normalize();
          nor[o] = n.x; nor[o + 1] = n.y; nor[o + 2] = n.z;
        }
        geo.attributes.position.needsUpdate = true;
        geo.attributes.normal.needsUpdate = true;
        geo.computeBoundingSphere();

        const seg = [];
        for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) seg.push(...P[i][j].toArray(), ...P[i][j + 1].toArray(), ...P[j][i].toArray(), ...P[j + 1][i].toArray());
        netGeo.setPositions(seg);
        beads.forEach((m, q) => { m.position.copy(P[q >> 2][q & 3]); m.material = beadMat; m.scale.setScalar(1); });
        const [hi, hj] = INNER[step], hot = P[hi][hj];
        const bead = beads[hi * 4 + hj];
        bead.material = hotMat; bead.scale.setScalar(1 + 0.45 * k);
        halo.position.copy(hot); halo.lookAt(camera.position);
        halo.scale.setScalar(0.6 + 0.8 * k); halo.material.opacity = k;
        dropGeo.setPositions([hot.x, hot.y, hot.z, hot.x, -2.6, hot.z]);
        drop.computeLineDistances();
        drop.material.opacity = 0.8 * k;
      },
    };
  },
};
