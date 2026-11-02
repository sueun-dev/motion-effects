// Surrealism: an original dream plain built from surrealist devices. A spiral seashell as tall as a mountain stands
// on the horizon beside cypresses no bigger than its whorls; smooth stones float in the air and drop long shadows on
// the sand; a door frame stands alone on the plain, open onto a night sky with a moon and stars while the day goes on
// around it; a stone staircase climbs into the air and stops. One soft pocket watch lies over the edge of the biggest
// floating stone and hangs down, melting; its minute hand races round, and molten gold gathers at its hem into a drop
// that falls all the way to the sand. The stones bob slowly and the camera drifts; the rest stays still.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TAU, FONT, canvas, rng, smoothstep, clamp } from '../lib/util.js';

const R = 0.4;                                    // watch radius
const SLAB = { x: 0.35, y: 2.35, z: 0.3, w: 1.05, h: 0.3, d: 0.8, r: 0.06 }; // the floating stone the watch lies on (top centre)
const DOOR = { x: -0.6, z: -2.6, w: 0.8, h: 1.95 };                         // the lone door frame

// a disc of polar rings and spokes; uv from the flat disc; `bend(u, v)` puts each point in the world
function discGeometry() {
  const rings = 30, segs = 120, pos = [], uv = [], idx = [];
  pos.push(0, 0, 0); uv.push(0.5, 0.5);
  for (let i = 1; i <= rings; i++) for (let j = 0; j < segs; j++) {
    const a = j / segs * TAU, rr = R * i / rings;
    pos.push(rr * Math.cos(a), rr * Math.sin(a), 0); uv.push(0.5 + rr * Math.cos(a) / (2 * R), 0.5 + rr * Math.sin(a) / (2 * R));
  }
  for (let j = 0; j < segs; j++) idx.push(0, 1 + j, 1 + (j + 1) % segs);
  for (let i = 1; i < rings; i++) for (let j = 0; j < segs; j++) {
    const a = 1 + (i - 1) * segs + j, b = 1 + (i - 1) * segs + (j + 1) % segs, c = a + segs, d = b + segs;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.userData.flat = pos.slice();
  return g;
}
function bend(g, f) {
  const p = g.attributes.position, flat = g.userData.flat;
  for (let i = 0; i < p.count; i++) { const [x, y, z] = f(flat[i * 3], flat[i * 3 + 1]); p.setXYZ(i, x, y, z); }
  p.needsUpdate = true; g.computeVertexNormals();
}

// how a soft watch hangs below its support: d0 (flat distance past the support) stretches as the metal flows, the middle
// of the hem sags lowest, the sheet curls back under and ripples across its width; `melt` stretches it a little more
function hang(u, d0, melt) {
  const d = d0 * (1 + melt) + 1.6 * d0 * d0 + 0.22 * d0 * (1 - (u / R) ** 2);
  return { x: u * (1 - 0.3 * d0 / R), dy: d, dz: -0.18 * d * d + 0.035 * d * Math.sin(u * 11 + 0.6) };
}
// over the stone's front edge, in the stone's own frame (top at y = 0, front face at z = d / 2): flat on the top,
// round the rounded corner, then down the face and hanging free below it
const overEdge = (s0, melt) => (u, v) => {
  const s = s0 - v, q = SLAB.r + 0.012, wrap = q * Math.PI / 2, top = 0.012, z0 = SLAB.d / 2 - SLAB.r;
  if (s <= 0) return [u, top, z0 + s];
  if (s <= wrap) { const a = s / q; return [u, top - q + q * Math.cos(a), z0 + q * Math.sin(a)]; }
  const h = hang(u, s - wrap, melt);
  return [h.x, top - q - h.dy, z0 + q + 0.012 + 0.4 * Math.abs(h.dz) + 0.05 * h.dy * h.dy];
};

// the dial: numbers, a gold bezel, and hands at minute angle m (turns)
function dial(face, m, h) {
  const c = canvas(512, 512), g = c.getContext('2d');
  g.fillStyle = '#C79A3A'; g.beginPath(); g.arc(256, 256, 256, 0, TAU); g.fill();
  g.fillStyle = face; g.beginPath(); g.arc(256, 256, 226, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(80, 60, 30, 0.5)'; g.lineWidth = 3; g.beginPath(); g.arc(256, 256, 226, 0, TAU); g.stroke();
  g.fillStyle = '#2A2318'; g.font = `500 44px ${FONT.serif}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let k = 1; k <= 12; k++) { const a = k / 12 * TAU - Math.PI / 2; g.fillText(k, 256 + 180 * Math.cos(a), 256 + 180 * Math.sin(a)); }
  for (let k = 0; k < 60; k++) { const a = k / 60 * TAU; g.fillRect(256 + 212 * Math.cos(a) - 2, 256 + 212 * Math.sin(a) - 2, 4, 4); }
  const hand = (a, len, w) => { g.save(); g.translate(256, 256); g.rotate(a); g.beginPath(); g.moveTo(-w, 20); g.lineTo(0, -len); g.lineTo(w, 20); g.fill(); g.restore(); };
  hand(h * TAU, 110, 9); hand(m * TAU, 175, 6);
  g.beginPath(); g.arc(256, 256, 12, 0, TAU); g.fill();
  return c;
}

export default {
  name: 'Surrealism',
  ko: '초현실주의',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    const HORIZON = new THREE.Color('#F1E3B4');
    scene.fog = new THREE.Fog(HORIZON, 40, 300);
    const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 600);
    const CAM = { y: 1.2, z: 9.6, look: [0.15, 1.5, -1.0] };
    const r = rng(320);

    // the sky: a dome shaded by height, warm cream at the horizon to deep blue overhead
    const sky = new THREE.SphereGeometry(400, 64, 32), sc = [], sp = sky.attributes.position;
    const stops = [[0, '#F4E7B8'], [0.04, '#EBE3C4'], [0.12, '#A9C6D6'], [0.26, '#4F82B0'], [0.45, '#1E4A7E']].map(([e, c]) => [e, new THREE.Color(c)]);
    for (let i = 0; i < sp.count; i++) {
      const e = Math.max(0, sp.getY(i) / 400);
      let c = stops[stops.length - 1][1];
      for (let k = 1; k < stops.length; k++) if (e <= stops[k][0]) { c = stops[k - 1][1].clone().lerp(stops[k][1], (e - stops[k - 1][0]) / (stops[k][0] - stops[k - 1][0])); break; }
      sc.push(c.r, c.g, c.b);
    }
    sky.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
    scene.add(new THREE.Mesh(sky, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })));

    // a low sun from the left: every shadow runs long across the sand to the right
    const sun = new THREE.DirectionalLight('#FFE0B0', 3.2);
    sun.position.set(-7, 5, 4.5); sun.target.position.set(0, 0, -1.5);
    sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
    Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 0.5, far: 40 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
    scene.add(sun, sun.target, new THREE.HemisphereLight('#8FB0D8', '#7A5A3A', 0.45));
    const env = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture; // reflections for the gold only

    // the plain
    const ground = (() => { const c = canvas(512, 512), g = c.getContext('2d');
      g.fillStyle = '#C49A64'; g.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 3000; i++) { g.fillStyle = r() < 0.5 ? 'rgba(90, 60, 30, 0.07)' : 'rgba(250, 225, 180, 0.08)'; g.fillRect(r() * 512, r() * 512, 2 + r() * 8, 1 + r() * 3); }
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(60, 60); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; })();
    const plain = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ map: ground, roughness: 1 }));
    plain.rotation.x = -Math.PI / 2; plain.receiveShadow = true; scene.add(plain);
    const add = (geo, mat, x, y, z, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
    const stone = new THREE.MeshStandardMaterial({ color: '#C9B49A', roughness: 0.85 });

    // impossible scale: a spiral shell as tall as a mountain, with cypresses and a cottage at its foot
    const shellGeo = new THREE.LatheGeometry(Array.from({ length: 121 }, (_, i) => new THREE.Vector2(Math.max(0.02, 1 - i / 120) ** 0.9, i / 120 * 3.6)), 120);
    const shp = shellGeo.attributes.position, shc = [], cream = new THREE.Color('#F3E7D2'), band = new THREE.Color('#B98A5C');
    for (let i = 0; i < shp.count; i++) { // seven whorls winding up the cone, each swelling, with a brown band in each groove
      const x = shp.getX(i), y = shp.getY(i), z = shp.getZ(i), ph = ((Math.atan2(z, x) / TAU + y / 3.6 * 7) % 1 + 1) % 1;
      const k = 0.86 + 0.14 * Math.sin(Math.PI * ph);
      shp.setXYZ(i, x * k, y, z * k);
      const c = cream.clone().lerp(band, smoothstep(0.75, 0.98, 1 - Math.sin(Math.PI * ph)) * 0.8); shc.push(c.r, c.g, c.b);
    }
    shellGeo.setAttribute('color', new THREE.Float32BufferAttribute(shc, 3)); shellGeo.computeVertexNormals();
    const shell = add(shellGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }), -16.5, 0, -120);
    shell.scale.set(5.2, 7.4, 5.2);
    const cypress = new THREE.MeshStandardMaterial({ color: '#3E5A3A', roughness: 0.9 });
    for (let i = 0; i < 6; i++) { const h = 1.6 + 0.8 * r(); add(new THREE.ConeGeometry(0.3, h, 10), cypress, -19 + i * 0.9 + r() * 0.3, h / 2, -100 - r() * 2); }
    add(new THREE.BoxGeometry(1.6, 1.0, 1.2), new THREE.MeshStandardMaterial({ color: '#F2EADB' }), -12.6, 0.5, -101);
    add(new THREE.ConeGeometry(1.1, 0.7, 4), new THREE.MeshStandardMaterial({ color: '#B5543C' }), -12.6, 1.35, -101).rotation.y = Math.PI / 4;

    // a door frame standing alone, open onto a night sky (drawn in screen space, so it is a window to somewhere else)
    const frameMat = new THREE.MeshStandardMaterial({ color: '#EFE4D0', roughness: 0.6 });
    const door = new THREE.Group(); door.position.set(DOOR.x, 0, DOOR.z); scene.add(door);
    for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.1, DOOR.h, 0.14), frameMat, sx * (DOOR.w / 2 + 0.05), DOOR.h / 2, 0, door);
    add(new THREE.BoxGeometry(DOOR.w + 0.3, 0.12, 0.16), frameMat, 0, DOOR.h + 0.06, 0, door);
    const leaf = new THREE.Group(); leaf.position.set(-DOOR.w / 2, 0, 0.05); door.add(leaf);
    add(new THREE.BoxGeometry(DOOR.w, DOOR.h - 0.02, 0.05), new THREE.MeshStandardMaterial({ color: '#5E86A8', roughness: 0.55 }), DOOR.w / 2, DOOR.h / 2, 0, leaf);
    leaf.rotation.y = -1.25;                                     // swung open toward us
    const night = new THREE.ShaderMaterial({
      uniforms: { uMoon: { value: new THREE.Vector2() } },
      vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec2 uMoon;
        float h21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        void main() {
          vec2 p = gl_FragCoord.xy;
          vec3 c = mix(vec3(0.17, 0.22, 0.45), vec3(0.03, 0.05, 0.16), smoothstep(uMoon.y - 420.0, uMoon.y + 120.0, p.y));
          vec2 cell = floor(p / 22.0), o = vec2(h21(cell), h21(cell + 7.1)) * 14.0 + 4.0;     // fixed stars
          float st = step(0.86, h21(cell + 3.3)) * smoothstep(2.2, 0.6, length(p - cell * 22.0 - o));
          c += vec3(1.0, 0.95, 0.8) * st * (0.5 + 0.5 * h21(cell + 9.0));
          float moon = smoothstep(31.0, 29.0, length(p - uMoon)) * smoothstep(25.0, 27.0, length(p - uMoon - vec2(13.0, 9.0)));
          c = mix(c, vec3(1.0, 0.95, 0.78), moon);
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const portal = new THREE.Mesh(new THREE.PlaneGeometry(DOOR.w, DOOR.h), night); portal.position.set(0, DOOR.h / 2, 0); door.add(portal);

    // a tall column out of the picture on the left: only its long shadow crosses the foreground
    add(new THREE.CylinderGeometry(0.22, 0.26, 6, 24), new THREE.MeshStandardMaterial({ color: '#E8DCC6' }), -3.6, 3, 6.2);

    // a staircase that climbs into the air and stops
    const steps = 8;
    for (let i = 0; i < steps; i++) add(new THREE.BoxGeometry(0.55, 0.22 * (i + 1), 0.3), new THREE.MeshStandardMaterial({ color: '#DDBE92', roughness: 0.8 }), 1.48, 0.11 * (i + 1), 0.1 - i * 0.3);

    // floating stones: the big flat one carries the watch; two more hang higher up
    const floaters = [];
    const slabGroup = new THREE.Group(); scene.add(slabGroup); floaters.push({ g: slabGroup, y: SLAB.y, ph: 0 });
    add(new RoundedBoxGeometry(SLAB.w, SLAB.h, SLAB.d, 4, SLAB.r), stone, 0, -SLAB.h / 2, 0, slabGroup);
    for (const [x, y, z, s, ph] of [[-1.45, 3.1, -3.5, 0.32, 1.7], [1.15, 3.9, -5.0, 0.26, 3.4]]) {
      const geo = new THREE.SphereGeometry(1, 48, 24), gp = geo.attributes.position;
      for (let i = 0; i < gp.count; i++) { const k = 1 + 0.06 * Math.sin(gp.getX(i) * 4 + x) * Math.sin(gp.getZ(i) * 3 + y); gp.setXYZ(i, gp.getX(i) * k, gp.getY(i) * k * 0.62, gp.getZ(i) * k); }
      geo.computeVertexNormals();
      const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
      add(geo, stone, 0, 0, 0, g).scale.setScalar(s);
      floaters.push({ g, y, ph });
    }

    // the one soft watch, over the big stone's front edge: dial on the front, gold behind
    const gold = new THREE.MeshStandardMaterial({ color: '#C9973A', roughness: 0.3, metalness: 0.8, side: THREE.BackSide, envMap: env, envMapIntensity: 0.8 });
    const watchGeo = discGeometry(), tex = new THREE.CanvasTexture(dial('#EEF1F2', 0, 0.37));
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const face = new THREE.Mesh(watchGeo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, metalness: 0.1 }));
    const back = new THREE.Mesh(watchGeo, gold);
    face.castShadow = back.castShadow = true; face.receiveShadow = true;
    slabGroup.add(face, back);
    const hemAt = melt => overEdge(0.1, melt)(0, -R);   // the lowest point of the hem, in the stone's frame
    const drop = add(new THREE.SphereGeometry(0.03, 24, 16), new THREE.MeshStandardMaterial({ color: '#E8B85A', roughness: 0.15, metalness: 0.6, emissive: '#5A3A10', emissiveIntensity: 0.3, envMap: env, envMapIntensity: 0.8 }), 0, 0, 0);
    const puddle = add(new THREE.CircleGeometry(0.08, 40), new THREE.MeshStandardMaterial({ color: '#B98430', roughness: 0.3, metalness: 0.2, polygonOffset: true, polygonOffsetFactor: -2 }), 0, 0.006, 0);
    puddle.rotation.x = -Math.PI / 2; puddle.scale.set(1.3, 0.8, 1); puddle.castShadow = false;
    const bob = (f, a) => 0.05 * Math.sin(a + f.ph);
    const hemWorld = (a, melt) => { const h = hemAt(melt); return [SLAB.x + h[0], SLAB.y + bob(floaters[0], a) + h[1], SLAB.z + h[2]]; };
    const p0 = hemWorld(0, 0.06);
    puddle.position.set(p0[0], 0.006, p0[2] + 0.02);

    // the moon in the doorway sits at a fixed place on screen, inside the opening
    camera.position.set(0, CAM.y, CAM.z); camera.lookAt(...CAM.look); camera.updateMatrixWorld();
    const mp = new THREE.Vector3(DOOR.x + 0.12, 1.45, DOOR.z).project(camera);
    night.uniforms.uMoon.value.set((mp.x * 0.5 + 0.5) * W, (mp.y * 0.5 + 0.5) * H);

    return {
      scene, camera,
      update(t) {
        const a = TAU * t / 5;
        camera.position.set(0.25 * Math.sin(a), CAM.y + 0.04 * Math.sin(a), CAM.z - 0.2 * Math.cos(a) + 0.2);
        camera.lookAt(...CAM.look);
        // the stones bob slowly, each in its own phase
        for (const f of floaters) f.g.position.y = f.y + bob(f, a);
        slabGroup.position.set(SLAB.x, SLAB.y + bob(floaters[0], a), SLAB.z);
        // the watch keeps softening and settling; its minute hand races round once a loop, the hour hand stands still
        const melt = 0.06 * (1 - Math.cos(a));
        bend(watchGeo, overEdge(0.1, melt));
        tex.image.getContext('2d').drawImage(dial('#EEF1F2', t / 5, 0.37), 0, 0); tex.needsUpdate = true;
        // the drop: swells at the hem for 3.2 s, stretches, lets go, falls to the sand and is gone into the puddle
        const hem = hemWorld(a, melt), fallTime = Math.sqrt(2 * hem[1] / 9.8);
        const grow = smoothstep(0, 3.2, t), fall = clamp((t - 3.2) / fallTime);
        const k = grow * (1 - smoothstep(0.85, 1, fall));
        drop.scale.set(k, k * (1 + 0.8 * smoothstep(2.4, 3.2, t) * (1 - fall)), k); // grows from nothing, so it never pops in
        drop.visible = k > 0.001;
        const y0 = hem[1] - 0.03 * grow - 0.04 * smoothstep(2.4, 3.2, t);
        drop.position.set(hem[0], y0 - (y0 - 0.04) * fall * fall, hem[2]);
      },
    };
  },
};
