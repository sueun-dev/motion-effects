// Stencil portal: a stone arch stands in a pastel desert, and through its opening you see a night world with its
// own sky, moon, glowing crystals and fireflies. Each frame: draw the desert; draw the opening as an invisible
// mask that writes 1 into the stencil buffer (only where it is not hidden); clear depth; draw the night world with
// the stencil test "equal to 1", so it appears only inside the arch. The camera swings round the arch, and the
// night world shifts behind the opening with its own depth instead of looking like a picture.
import * as THREE from 'three';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { TAU, phase, rng } from '../lib/util.js';

function gradient(stops, w = 4, h = 512) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, h);
  for (const [k, col] of stops) grd.addColorStop(k, col);
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  return c;
}
function glowTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, inner); grd.addColorStop(0.25, inner); grd.addColorStop(1, outer);
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
// the arch outline: a rectangle with a round top (width w, straight sides up to h)
function archShape(w, h, shape = new THREE.Shape()) {
  shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(w / 2, h);
  shape.absarc(0, h, w / 2, 0, Math.PI, false);
  shape.lineTo(-w / 2, 0);
  return shape;
}

export default {
  name: 'Stencil Portal',
  ko: '스텐실 포털',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.autoClear = false;
    const target = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4, stencilBuffer: true });
    const output = new OutputPass();
    output.renderToScreen = true;
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 200);

    // ---- the outer world: a pastel desert at midday ----
    const outer = new THREE.Scene();
    const sky = new THREE.CanvasTexture(gradient([[0, '#7FB2E5'], [0.55, '#CFE3F2'], [0.62, '#F6DCC8'], [1, '#F2C9A8']]));
    sky.colorSpace = THREE.SRGBColorSpace;
    outer.background = sky;
    outer.fog = new THREE.Fog('#F1D6C2', 25, 90);
    outer.add(new THREE.HemisphereLight('#DDEBFF', '#E8B48C', 1.4));
    const sun = new THREE.DirectionalLight('#FFF1DC', 2.6);
    sun.position.set(-8, 14, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 50 });
    sun.shadow.radius = 4;
    outer.add(sun);
    const sandGeo = new THREE.PlaneGeometry(160, 160, 160, 160);
    sandGeo.rotateX(-Math.PI / 2);
    const pos = sandGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {                 // gentle dunes, flat around the arch
      const x = pos.getX(i), z = pos.getZ(i), r = Math.hypot(x, z);
      pos.setY(i, Math.min(1, Math.max(0, (r - 6) / 10)) * (1.1 * Math.sin(x * 0.11 + 1) * Math.cos(z * 0.09) + 0.5 * Math.sin(x * 0.23 - z * 0.17)));
    }
    sandGeo.computeVertexNormals();
    const sand = new THREE.Mesh(sandGeo, new THREE.MeshStandardMaterial({ color: '#E9BC93', roughness: 0.95 }));
    sand.receiveShadow = true;
    outer.add(sand);
    const r = rng(11), rockMat = new THREE.MeshStandardMaterial({ color: '#C98F6C', roughness: 0.9, flatShading: true });
    for (let i = 0; i < 9; i++) {                         // rocks scattered around, some right behind the arch
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4 + r() * 0.9, 0), rockMat);
      const a = -Math.PI / 2 + (r() - 0.5) * 2.6, d = 4 + r() * 12;
      rock.position.set(Math.cos(a) * d, 0.1, Math.sin(a) * d);
      rock.scale.y = 0.6 + r() * 0.5;
      rock.rotation.set(r() * 3, r() * 3, 0);
      rock.castShadow = rock.receiveShadow = true;
      outer.add(rock);
    }
    // the stone arch: an extruded outline with the opening cut out
    const OW = 2.3, OH = 3.7;                              // opening width, height of its straight sides
    const frameShape = archShape(3.4, 4.0);
    frameShape.holes.push(archShape(OW, OH, new THREE.Path()));
    const frameGeo = new THREE.ExtrudeGeometry(frameShape, { depth: 0.6, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 3, curveSegments: 48 });
    frameGeo.translate(0, 0, -0.3);
    const arch = new THREE.Mesh(frameGeo, new THREE.MeshStandardMaterial({ color: '#D9A07A', roughness: 0.75 }));
    arch.castShadow = arch.receiveShadow = true;
    outer.add(arch);
    // the mask: the opening, drawn into the stencil only (no colour, no depth), at the back face of the arch
    const mask = new THREE.Mesh(new THREE.ShapeGeometry(archShape(OW, OH), 48), new THREE.MeshBasicMaterial({
      colorWrite: false, depthWrite: false, stencilWrite: true, stencilRef: 1,
      stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp,
    }));
    mask.position.z = -0.3;
    mask.renderOrder = 10;                                 // after the desert, so hidden parts are not marked
    outer.add(mask);

    // ---- the inner world: a moonlit night of glowing crystals, only ever drawn where the stencil is 1 ----
    const inner = new THREE.Scene();
    inner.fog = new THREE.FogExp2('#0B1030', 0.035);
    const night = new THREE.CanvasTexture(gradient([[0, '#05061A'], [0.45, '#141A4A'], [0.5, '#2A2466'], [0.53, '#0B1030'], [1, '#05061A']]));
    night.colorSpace = THREE.SRGBColorSpace;
    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(80, 48, 24), new THREE.MeshBasicMaterial({ map: night, side: THREE.BackSide, fog: false }));
    inner.add(skyDome);
    const starPos = [], rs = rng(5);
    for (let i = 0; i < 700; i++) {
      const az = -Math.PI / 2 + (rs() - 0.5) * 2.4, el = 0.04 + rs() * 1.1;
      starPos.push(70 * Math.cos(el) * Math.cos(az), 70 * Math.sin(el), 70 * Math.cos(el) * Math.sin(az));
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    inner.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 3.2, sizeAttenuation: false, map: glowTexture('#FFFFFF', 'rgba(255,255,255,0)'), transparent: true, depthWrite: false, fog: false })));
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(190,200,255,0.35)', 'rgba(120,140,255,0)'), fog: false, depthWrite: false }));
    halo.position.set(-5, 15, -62);
    halo.scale.setScalar(24);
    inner.add(halo);
    const moon = new THREE.Mesh(new THREE.CircleGeometry(2.6, 48), new THREE.MeshBasicMaterial({ color: '#FFF3D6', fog: false }));
    moon.position.set(-5, 15, -61);
    moon.lookAt(0, 2, 12);
    inner.add(moon);
    inner.add(new THREE.HemisphereLight('#3A4AA0', '#060814', 0.8));
    const moonLight = new THREE.DirectionalLight('#B9C6FF', 0.35);
    moonLight.position.set(-5, 15, -60);
    inner.add(moonLight);
    const hillMat = new THREE.MeshStandardMaterial({ color: '#1B1A46', roughness: 1, flatShading: true });
    const rh = rng(41);
    for (let i = 0; i < 14; i++) {                        // far mountains on the night horizon
      const h = 3 + rh() * 5, hill = new THREE.Mesh(new THREE.ConeGeometry(5 + rh() * 6, h, 6), hillMat);
      hill.position.set(-52 + i * 8 + rh() * 4, h / 2 - 0.5, -50 - rh() * 15);
      hill.rotation.y = rh() * 3;
      inner.add(hill);
    }
    const lake = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#0B1236', roughness: 0.7, metalness: 0.0 }));
    lake.rotation.x = -Math.PI / 2;
    lake.position.y = -0.02;
    inner.add(lake);
    const rc = rng(23), crystals = [];
    const crystalCols = ['#57E3FF', '#B06BFF', '#FF5FB0', '#6BFFC8'];
    for (let i = 0; i < 36; i++) {                        // crystals from just behind the arch to far away
      const col = crystalCols[i % 4], d = 1.5 + i * 0.75 + rc() * 1.5, x = (rc() - 0.5) * (3 + d * 1.6);
      const h = 0.8 + rc() * 2.2;
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.6, roughness: 0.3, flatShading: true }));
      m.scale.set(0.5 + rc() * 0.4, h, 0.5 + rc() * 0.4);
      m.position.set(x, h * 0.42, -d);
      m.rotation.set((rc() - 0.5) * 0.4, rc() * 3, (rc() - 0.5) * 0.4);
      inner.add(m);
      crystals.push(m);
      if (i % 6 === 0) { const l = new THREE.PointLight(col, 6, 9, 1.5); l.position.set(x, 1.2, -d); inner.add(l); }
    }
    const fly = [], rf = rng(31);                         // fireflies on small looping paths
    for (let i = 0; i < 60; i++) fly.push({ x: (rf() - 0.5) * 9, y: 0.4 + rf() * 3, z: -1.5 - rf() * 16, r: 0.2 + rf() * 0.5, k: 1 + Math.floor(rf() * 2), p: rf() * TAU });
    const flyGeo = new THREE.BufferGeometry();
    flyGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(fly.length * 3), 3));
    inner.add(new THREE.Points(flyGeo, new THREE.PointsMaterial({ size: 0.22, map: glowTexture('#FFF3A0', 'rgba(255,220,80,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    inner.traverse(o => {                                 // every inner material: draw only where the stencil is 1
      if (!o.material) return;
      Object.assign(o.material, { stencilWrite: true, stencilRef: 1, stencilFunc: THREE.EqualStencilFunc });
    });

    return {
      scene: outer, camera,
      render(t) {
        const a = phase(t) * TAU, th = 0.62 * Math.sin(a);   // swing 35 degrees each way round the arch
        camera.position.set(11.5 * Math.sin(th), 2.4 + 0.3 * Math.sin(2 * a), 11.5 * Math.cos(th));
        camera.lookAt(0, 2.9, 0);
        crystals.forEach((m, i) => { m.rotation.y = i * 1.7 + 0.25 * Math.sin(a + i); });
        const fp = flyGeo.attributes.position;
        fly.forEach((f, i) => fp.setXYZ(i, f.x + f.r * Math.cos(f.k * a + f.p), f.y + 0.6 * f.r * Math.sin(f.k * a * 2 + f.p), f.z + f.r * Math.sin(f.k * a + f.p)));
        fp.needsUpdate = true;
        renderer.setRenderTarget(target);
        renderer.clear(true, true, true);
        renderer.render(outer, camera);                   // desert, arch, then the stencil mask
        renderer.clearDepth();
        renderer.render(inner, camera);                   // the night world, inside the mask only
        output.render(renderer, null, target);            // tone mapping + sRGB, to the screen
      },
    };
  },
};
