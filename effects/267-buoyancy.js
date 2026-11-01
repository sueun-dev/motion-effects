// Buoyancy: cork (0.24 g/cm3), pine (0.60), ice (0.92) and stone (2.60) hang on threads over a glass tank, are let go
// one after another, plunge, bob and settle. Each block feels its weight and the weight of the water it pushes aside
// (Archimedes: the submerged share of its height times the water's density), plus water drag and a damped rocking
// started by the plunge. The surface is a 1D wave equation across the tank: the water each block pushes aside rises
// in a ring round it, the ripples run, bounce off the glass and die down, and the blocks bob on them. Floating
// blocks come to rest with exactly their density's share under water; the stone sinks. Once nothing moves, the
// solver puts them to sleep, so they rest exactly still, and the reels wind them back up. Simulated in setup at 600
// steps a second.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { TAU, rng, noise3, canvas, smoothstep, ease, FONT } from '../lib/util.js';

const G = 24, SURF = 2.2, HALF = 1.8, DEPTH = 0.7, NW = 168, DX = (2 * HALF) / NW, C = 2.6, SUB = 20, DT = 1 / 30 / SUB, FRAMES = 150;
const HANG = SURF + 1.25, BEAM = 4.75, LIFT = [3.85, 4.7];         // the blocks hang at HANG; the reels lift them in LIFT
// [name, x, density, half width, height, release time, share of a square's area, rest label]
const OBJ = [
  ['CORK', -1.35, 0.24, 0.27, 0.55, 0.15, Math.PI / 4], ['PINE', -0.45, 0.6, 0.29, 0.55, 0.3, 1],
  ['ICE', 0.45, 0.92, 0.29, 0.55, 0.45, 1], ['STONE', 1.35, 2.6, 0.29, 0.5, 0.6, 0.6],
];

// the surface heights and every block's [height, tilt] at every frame
function simulate() {
  const eta = new Float64Array(NW), vel = new Float64Array(NW), out = [];
  const st = OBJ.map(() => ({ y: HANG, v: 0, a: 0, w: 0, sub: 0, sleep: false, calm: 0, rest: null }));
  const cell = x => Math.max(0, Math.min(NW - 1, Math.floor((x + HALF) / DX)));
  let calmWater = false;
  for (let f = 0; f < FRAMES; f++) {
    out.push({ eta: Float32Array.from(eta), obj: st.map(o => [o.y, o.a]) });
    for (let s = 0; s < SUB; s++) {
      const t = f / 30 + s * DT;
      if (!calmWater) {                                   // the surface: a damped wave equation, walls at both ends
        for (let i = 0; i < NW; i++) {
          const l = eta[Math.max(0, i - 1)], r = eta[Math.min(NW - 1, i + 1)];
          vel[i] += ((C * C * (l + r - 2 * eta[i])) / (DX * DX) - 3.9 * vel[i]) * DT;
        }
        let mean = 0;
        for (let i = 0; i < NW; i++) { eta[i] += (vel[i] - 1.5 * eta[i]) * DT; mean += eta[i] / NW; }
        for (let i = 0; i < NW; i++) eta[i] -= mean;      // the amount of water stays the same
      }
      OBJ.forEach(([, x, rho, hw, h, rel, area], k) => {
        const o = st[k], i0 = cell(x - hw), i1 = cell(x + hw);
        if (t < rel) return;
        if (t >= LIFT[0]) {                               // the reel winds it up, from where it rests to where it hangs
          if (!o.rest) o.rest = [o.y, o.a];
          const e = ease.inOut(Math.min(1, (t - LIFT[0]) / (LIFT[1] - LIFT[0])));
          o.y = o.rest[0] + (HANG - o.rest[0]) * e; o.a = o.rest[1] * (1 - e);
          return;
        }
        if (o.sleep) return;
        let surf = 0;
        for (let i = i0; i <= i1; i++) surf += eta[i] / (i1 - i0 + 1);
        const bottom = o.y - h / 2, sub = Math.max(0, Math.min(h, SURF + surf - bottom)) / h;   // submerged share
        const drag = (sub * (4.5 * o.v + 3.5 * o.v * Math.abs(o.v))) / rho;
        o.v += ((G * sub) / rho - G - drag) * DT;           // buoyancy: displaced water's weight over its own
        o.y += o.v * DT;
        if (o.y - h / 2 < 0) { o.y = h / 2; o.v = 0; }      // the tank floor
        if (o.sub === 0 && sub > 0) o.w += [1.6, -1.3, 1.1, -0.8][k];   // it meets the water a little off level
        o.w += (-30 * sub * o.a - (1.5 + 14 * sub) * o.w) * DT; o.a += o.w * DT;
        const rise = calmWater ? 0 : (0.3 * (sub - o.sub) * h * 2 * hw * area) / (12 * DX); // the water it pushes aside
        o.sub = sub;
        for (let j = 1; j <= 6; j++) { if (i0 - j >= 0) eta[i0 - j] += rise; if (i1 + j < NW) eta[i1 + j] += rise; }
        o.calm = Math.abs(o.v) < 0.004 && Math.abs(o.w) < 0.01 && calmWater ? o.calm + 1 : 0;
        if (o.calm > 0.3 / DT) o.sleep = true;              // still for 0.3 s: frozen exactly where it is
      });
      if (t > 2 && !calmWater && Math.max(...eta.map(Math.abs)) < 1e-3) { calmWater = true; eta.fill(0); vel.fill(0); }
    }
  }
  return out;
}

// small canvas textures: cork speckle and pine grain
function speckle(base, dots, seed) {
  const c = canvas(256, 256), g = c.getContext('2d'), r = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { g.fillStyle = dots[i % dots.length]; g.globalAlpha = 0.5; g.beginPath(); g.arc(r() * 256, r() * 256, 0.8 + 2.2 * r(), 0, TAU); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function grain() {
  const c = canvas(256, 256), g = c.getContext('2d');
  for (let y = 0; y < 256; y++) {
    const v = 0.5 + 0.5 * Math.sin(y * 0.35 + 3 * noise3(0, y * 0.02, 1.5)) ** 2;
    g.fillStyle = `rgb(${Math.round(214 - 40 * v)}, ${Math.round(168 - 36 * v)}, ${Math.round(112 - 30 * v)})`; g.fillRect(0, y, 256, 1);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

let labels = null; // screen positions for the overlay, found once from the camera

export default {
  name: 'Buoyancy',
  ko: '부력',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    const sky = canvas(2, 512), sg = sky.getContext('2d'), grd = sg.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#DCE6EE'); grd.addColorStop(1, '#AFC2D1');
    sg.fillStyle = grd; sg.fillRect(0, 0, 2, 512);
    scene.background = new THREE.CanvasTexture(sky); scene.background.colorSpace = THREE.SRGBColorSpace;
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.7;
    const key = new THREE.DirectionalLight('#FFF6EA', 2.2);
    key.position.set(-3, 9, 7); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -4, right: 4, top: 6, bottom: -2, near: 1, far: 30 });
    key.shadow.bias = -0.0004; key.shadow.radius = 4;
    scene.add(key, new THREE.HemisphereLight('#FFFFFF', '#8A7F72', 0.6));
    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
    camera.position.set(0, 3.4, 15.2);
    camera.lookAt(0, 2.05, 0);

    const add = (geo, mat, x, y, z, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
    // the table, the tank (glass walls, a sand floor) and the beam with four reels
    add(new THREE.BoxGeometry(12, 2.4, 4), new THREE.MeshStandardMaterial({ color: '#8C6A4A', roughness: 0.7 }), 0, -1.3, 0);
    const glass = new THREE.MeshPhysicalMaterial({ color: '#FFFFFF', roughness: 0.05, transparent: true, opacity: 0.18, depthWrite: false });
    const T = 0.04, TOP = 3.05;
    add(new THREE.BoxGeometry(2 * HALF + 2 * T, 0.1, 2 * DEPTH + 2 * T), new THREE.MeshStandardMaterial({ color: '#2C3440', roughness: 0.5 }), 0, -0.056, 0);
    add(new THREE.BoxGeometry(2 * HALF, 0.06, 2 * DEPTH), new THREE.MeshStandardMaterial({ color: '#D8C7A2', roughness: 1 }), 0, 0.0, 0).position.y = -0.03;
    for (const sx of [-1, 1]) add(new THREE.BoxGeometry(T, TOP, 2 * DEPTH + 2 * T), glass, sx * (HALF + T / 2), TOP / 2, 0).renderOrder = 3;
    add(new THREE.BoxGeometry(2 * HALF, TOP, T), glass, 0, TOP / 2, -DEPTH - T / 2).renderOrder = 3;
    add(new THREE.BoxGeometry(2 * HALF, TOP, T), glass, 0, TOP / 2, DEPTH + T / 2).renderOrder = 3;
    const rimMat = new THREE.MeshStandardMaterial({ color: '#2C3440', roughness: 0.4, metalness: 0.5 });
    for (const sz of [-1, 1]) add(new THREE.BoxGeometry(2 * HALF + 0.14, 0.06, 0.06), rimMat, 0, TOP, sz * (DEPTH + T));
    for (const sx of [-1, 1]) {
      add(new THREE.BoxGeometry(0.06, 0.06, 2 * DEPTH + 0.14), rimMat, sx * (HALF + T), TOP, 0);
      add(new THREE.CylinderGeometry(0.05, 0.05, BEAM + 0.3, 16), rimMat, sx * (HALF + 0.25), (BEAM + 0.3) / 2 - 0.1, -DEPTH - 0.2);
    }
    add(new THREE.BoxGeometry(2 * HALF + 0.8, 0.14, 0.14), rimMat, 0, BEAM + 0.1, -DEPTH - 0.2);
    const brass = new THREE.MeshStandardMaterial({ color: '#C9A15A', roughness: 0.3, metalness: 0.9 });
    const reels = OBJ.map(([, x]) => {
      add(new THREE.BoxGeometry(0.05, 0.05, DEPTH + 0.2), rimMat, x, BEAM + 0.1, -DEPTH / 2 - 0.1);
      const reel = add(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 6).rotateX(Math.PI / 2), brass, x + 0.12, BEAM, 0);   // six-sided, so its turn shows
      return reel;
    });

    // the blocks: cork, pine, ice and a stone, each with a white waterline painted where the surface cuts it
    const lineY = OBJ.map(() => ({ value: -9 }));
    const withWaterline = (mat, k) => {
      mat.onBeforeCompile = sh => {
        sh.uniforms.uLine = lineY[k];
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vWy;')
          .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWy = (modelMatrix * vec4(transformed, 1.0)).y;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vWy; uniform float uLine;')
          .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  float d = abs(vWy - uLine) / fwidth(vWy);\n  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0), 0.9 * (1.0 - smoothstep(1.2, 2.4, d)));');
      };
      return mat;
    };
    const rock = mergeVertices(new THREE.IcosahedronGeometry(0.3, 4).deleteAttribute('normal').deleteAttribute('uv')), rp = rock.attributes.position;
    for (let i = 0; i < rp.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(rp, i), n = 1 + 0.18 * noise3(v.x * 4, v.y * 4, v.z * 4);
      rp.setXYZ(i, v.x * n * 1.0, v.y * n * 0.82, v.z * n * 0.95);
    }
    rock.computeVertexNormals();
    const shapes = [
      [new THREE.CylinderGeometry(0.25, 0.27, 0.55, 48), new THREE.MeshStandardMaterial({ map: speckle('#C9965E', ['#8A5A2E', '#E6C08A', '#6E4522'], 2), roughness: 0.9 })],
      [new RoundedBoxGeometry(0.58, 0.55, 0.58, 3, 0.03), new THREE.MeshStandardMaterial({ map: grain(), roughness: 0.75 })],
      [new RoundedBoxGeometry(0.58, 0.55, 0.58, 4, 0.06), new THREE.MeshPhysicalMaterial({ color: '#EAF8FF', roughness: 0.06, transparent: true, opacity: 0.86, clearcoat: 1, emissive: '#7CC4E8', emissiveIntensity: 0.3 })],
      [rock, new THREE.MeshStandardMaterial({ color: '#6E6A66', roughness: 0.85 })],
    ];
    const blocks = shapes.map(([geo, mat], k) => {
      const m = add(geo, withWaterline(mat, k), OBJ[k][1], HANG, 0);
      if (k === 2) m.renderOrder = 1;
      return m;
    });
    const threadMat = new THREE.MeshStandardMaterial({ color: '#F4F1EA', roughness: 0.8 });
    const threads = OBJ.map(([, x]) => add(new THREE.CylinderGeometry(0.013, 0.013, 1, 6).translate(0, 0.5, 0), threadMat, x, 0, 0));

    // the water: a box whose top follows the wave heights (front, back and top faces move; sides are fixed)
    const waterMat = new THREE.MeshPhysicalMaterial({ color: '#4FAFDC', roughness: 0.15, transparent: true, opacity: 0.34, depthWrite: false, side: THREE.DoubleSide });
    const topMat = new THREE.MeshPhysicalMaterial({ color: '#8FD3F2', roughness: 0.05, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
    const face = z => { const g = new THREE.PlaneGeometry(2 * HALF, 1, NW - 1, 1); const m = add(g, waterMat, 0, 0, z); m.renderOrder = 2; m.castShadow = false; return g; };
    const front = face(DEPTH - 0.005), back = face(-DEPTH + 0.005);
    const topGeo = new THREE.PlaneGeometry(2 * HALF, 2 * DEPTH, NW - 1, 1).rotateX(-Math.PI / 2);
    const topMesh = add(topGeo, topMat, 0, 0, 0); topMesh.renderOrder = 2; topMesh.castShadow = false;
    for (const sx of [-1, 1]) { const m = add(new THREE.PlaneGeometry(2 * DEPTH, SURF).rotateY(Math.PI / 2), waterMat, sx * (HALF - 0.005), SURF / 2, 0); m.renderOrder = 2; m.castShadow = false; }

    const frames = simulate();
    // where the labels go: the names on the table's front edge, the result in the water under each block
    camera.updateMatrixWorld();
    const px = v => { const p = v.project(camera); return [(p.x + 1) * W / 2, (1 - p.y) * H / 2]; };
    labels = OBJ.map(([, x]) => ({ name: px(new THREE.Vector3(x, -0.25, 2.0)), result: px(new THREE.Vector3(x, 1.05, DEPTH)) }));

    const setTop = (g, eta, z0) => {                     // vertices 0..NW-1 are the top row of a PlaneGeometry
      const p = g.attributes.position;
      for (let i = 0; i < NW; i++) { p.setY(i, SURF + eta[i]); if (z0 !== undefined) p.setY(i + NW, SURF + eta[i]); }
      p.needsUpdate = true;
    };
    return {
      scene, camera,
      update(t) {
        const F = frames[Math.round(t * 30) % FRAMES];
        setTop(front, F.eta); setTop(back, F.eta); setTop(topGeo, F.eta, 0);
        for (const g of [front, back]) { const p = g.attributes.position; for (let i = NW; i < 2 * NW; i++) p.setY(i, 0.003); }
        front.computeVertexNormals(); topGeo.computeVertexNormals();
        OBJ.forEach(([, x, , , h], k) => {
          const [y, a] = F.obj[k], b = blocks[k];
          b.position.y = y; b.rotation.z = a;
          const i = Math.max(0, Math.min(NW - 1, Math.floor((x + HALF) / DX)));
          lineY[k].value = SURF + F.eta[i];
          const top = y + h / 2 - 0.02;
          threads[k].position.y = top; threads[k].scale.y = BEAM - top;
          reels[k].rotation.z = -(BEAM - top) / 0.12;
        });
      },
    };
  },
  // names and densities on the table; once the blocks rest, the share of each one under water
  overlay(ctx, t) {
    const show = smoothstep(2.6, 3.1, t) * (1 - smoothstep(3.8, 4.1, t));
    ctx.textAlign = 'center';
    OBJ.forEach(([name, , rho], k) => {
      const [nx, ny] = labels[k].name, [rx, ry] = labels[k].result;
      ctx.font = `800 30px ${FONT.sans}`; ctx.fillStyle = '#FFF7EC'; ctx.fillText(name, nx, ny - 6);
      ctx.font = `500 25px ${FONT.sans}`; ctx.fillStyle = 'rgba(255, 247, 236, 0.8)'; ctx.fillText(`${rho.toFixed(2)} g/cm³`, nx, ny + 28);
      if (show > 0) {
        const txt = rho < 1 ? `${Math.round(rho * 100)}% under` : 'sinks';
        ctx.globalAlpha = show;
        ctx.font = `700 25px ${FONT.sans}`;
        const w = ctx.measureText(txt).width + 26;
        ctx.fillStyle = 'rgba(16, 40, 60, 0.85)'; ctx.beginPath(); ctx.roundRect(rx - w / 2, ry - 22, w, 42, 21); ctx.fill();
        ctx.fillStyle = '#FFFFFF'; ctx.fillText(txt, rx, ry + 8);
        ctx.globalAlpha = 1;
      }
    });
  },
};
