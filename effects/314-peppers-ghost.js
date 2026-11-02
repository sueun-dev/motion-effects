// Pepper's ghost: a moonlit parlour on a theatre stage. A lamp comes up in the hidden pit below the stage front, and a
// see-through lady in white fades in beside the chair. She is the reflection of an actor lying in the pit, in a sheet
// of glass that leans out from the stage lip at 45 degrees (the plane y = z). A plane mirror's image is the actor
// reflected through that plane, so the ghost is drawn as that reflected figure, lit by the reflected lamp, into its own
// layer, kept only where the line from the eye to it passes through the glass, and added onto the picture: light
// reflected by glass adds to what shows through it. Then the picture dissolves to a side view with the near half of
// the theatre cut away: the pit, the actor, the lamp and the light path through the glass.
import * as THREE from 'three';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { TAU, FONT, ease, span, clamp, smoothstep } from '../lib/util.js';

const GX = 1.85, GT = 3.35;                                // the glass: half-width, top (it runs from the lip to y = z = GT)
const EYE = new THREE.Vector3(0, 1.0, 15);                 // a seat in the stalls
const MIRROR = new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1);  // reflection in y = z
// the pit lamp: up 0.35-1.1 s, down 4.55-5.0 s
const lamp = t => ease.inOut(span(t, 0.35, 1.1)) - ease.inOut(span(t, 4.55, 5.0));
// the cut to the side view: 0 = the stalls, 1 = the cut-away. Dissolves 2.1-2.7 s and back 4.15-4.75 s
const cutTo = t => smoothstep(2.1, 2.7, t) - smoothstep(4.15, 4.75, t);
const state = { k: 0, cam: null };

function canvasTex(w, h, paint, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

// the lady, standing at the origin facing +z: gown, bodice, head with a bun, a veil and two arms that rise
function lady(mat) {
  const g = new THREE.Group();
  const prof = [[0, 0], [0.44, 0], [0.4, 0.15], [0.3, 0.55], [0.17, 0.95], [0.13, 1.02], [0.16, 1.2], [0.19, 1.36], [0.12, 1.42], [0.05, 1.45], [0, 1.46]];
  g.add(new THREE.Mesh(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 64), mat));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 32, 24), mat);
  head.position.y = 1.58; head.scale.set(0.92, 1.08, 1);
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 14), mat);
  bun.position.set(0, 1.66, -0.08);
  const veil = new THREE.Mesh(new THREE.LatheGeometry([[0.06, 1.7], [0.14, 1.6], [0.2, 1.3], [0.3, 0.8], [0.36, 0.45]].map(([r, y]) => new THREE.Vector2(r, y)), 48, Math.PI * 0.45, Math.PI * 1.1), mat);
  g.add(head, bun, veil);
  const arms = [-1, 1].map(s => {
    const a = new THREE.Group(), m = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.55, 6, 12), mat);
    m.position.y = -0.3; a.add(m); a.position.set(0.19 * s, 1.36, 0); g.add(a);
    return a;
  });
  return { g, arms };
}

export default {
  name: "Pepper's Ghost",
  ko: '페퍼의 유령',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = false;
    renderer.localClippingEnabled = true;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#07060C');
    const cut = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);    // the far half of the theatre, x < 0
    const near = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);    // the near half, x > 0, which fades for the cut-away
    const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, clippingPlanes: [cut], side: THREE.DoubleSide, ...o });
    const box = (mat, sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat); m.position.set(x, y, z); scene.add(m); return m; };
    const plane = (mat, w, h, x, y, z, rx = 0, ry = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); scene.add(m); return m; };

    // the stage and the parlour set
    const boards = canvasTex(512, 512, (g, w, h) => {
      for (let i = 0; i < 8; i++) { g.fillStyle = ['#5A3A26', '#634130', '#53361F', '#5E3D28'][i % 4]; g.fillRect(i * 64, 0, 64, h); g.fillStyle = '#2E1D12'; g.fillRect(i * 64, 0, 3, h); }
    }, [3, 3]);
    plane(M('#FFFFFF', { map: boards }), 6, 4.4, 0, 0, -2.2, -Math.PI / 2);
    const paper = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#1F3B3A'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#2C5250';
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.beginPath(); g.ellipse(32 + i * 64 + (j % 2) * 32, 32 + j * 64, 12, 20, 0, 0, TAU); g.fill(); }
    }, [5, 3]);
    plane(M('#FFFFFF', { map: paper }), 6, 4.4, 0, 2.2, -4.4);
    plane(M('#FFFFFF', { map: paper }), 4.4, 4.4, -2.2, 2.2, -2.2, 0, Math.PI / 2);
    plane(M('#FFFFFF', { map: paper }), 4.4, 4.4, 2.2, 2.2, -2.2, 0, -Math.PI / 2);
    plane(new THREE.MeshBasicMaterial({ color: '#7FA8E8', clippingPlanes: [cut] }), 0.9, 1.9, 0.95, 2.05, -4.38);   // moonlit window
    const frameMat = M('#E8DCC8');
    for (const [w, h, x, y] of [[1.04, 0.07, 0.95, 3.0], [1.04, 0.07, 0.95, 1.1], [0.07, 1.97, 0.43, 2.05], [0.07, 1.97, 1.47, 2.05], [0.05, 1.9, 0.95, 2.05], [0.9, 0.05, 0.95, 2.25]]) box(frameMat, w, h, 0.05, x, y, -4.36);
    const wood = M('#4A2A1C', { roughness: 0.5 });
    const chair = new THREE.Group();                        // a high-backed chair
    for (const [sx, sy, sz, x, y, z] of [[0.55, 0.06, 0.5, 0, 0.48, 0], [0.55, 0.85, 0.06, 0, 0.92, -0.22], [0.05, 0.48, 0.05, -0.24, 0.24, 0.2], [0.05, 0.48, 0.05, 0.24, 0.24, 0.2], [0.05, 0.48, 0.05, -0.24, 0.24, -0.2], [0.05, 0.48, 0.05, 0.24, 0.24, -0.2]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), wood); m.position.set(x, y, z); chair.add(m);
    }
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.46), M('#8A1E2C'));
    cushion.position.y = 0.53; chair.add(cushion);
    chair.position.set(-0.95, 0, -2.4); chair.rotation.y = 0.35;
    scene.add(chair);
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 40), wood);
    table.position.set(1.05, 0.72, -2.5); scene.add(table);
    box(wood, 0.06, 0.7, 0.06, 1.05, 0.36, -2.5);
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 16), M('#F2E8D0'));
    candle.position.set(1.05, 0.84, -2.5); scene.add(candle);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), new THREE.MeshBasicMaterial({ color: '#FFD27A', clippingPlanes: [cut] }));
    flame.scale.set(1, 1.8, 1); flame.position.set(1.05, 0.98, -2.5); scene.add(flame);
    const glow = new THREE.PointLight('#FFB060', 2.2, 4, 1.6); glow.position.set(1.05, 1.05, -2.4); scene.add(glow);
    const moon = new THREE.DirectionalLight('#8FB0FF', 0.9); moon.position.set(1, 3, -6); scene.add(moon);
    const fill = new THREE.HemisphereLight('#BFC8FF', '#2A1A14', 0.55);   // brighter for the cut-away
    scene.add(fill);
    const key = new THREE.SpotLight('#FFE2C0', 40, 20, 0.5, 0.6, 1.4); key.position.set(-1.5, 5.5, 2.4); key.target.position.set(0, 0.5, -2.4); scene.add(key, key.target);

    // the pit under the glass, its walls, the hidden actor on a tilted board and her lamp
    const dark = M('#30252B');
    plane(dark, 5, 3.42, 0, -2.15, 1.71, -Math.PI / 2);     // pit floor
    plane(dark, 5, 2.15, 0, -1.075, 0);                     // the stage front, the pit's back wall
    const glowTex = canvasTex(4, 256, (g, w, h) => {        // the pit front catches the stage light at its top
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, '#6A4028'); grd.addColorStop(0.35, '#2E1C16'); grd.addColorStop(1, '#120A0C');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
    });
    const front = M('#000000', { emissiveMap: glowTex, emissive: '#FFFFFF' });
    plane(front, 12, 2.0, 0, -1.0, 3.42);                   // pit front: what the audience sees under the stage
    box(M('#C9A04A', { roughness: 0.35, metalness: 0.8 }), 12, 0.06, 0.08, 0, -0.03, 3.44);
    for (const s of [-1, 1]) plane(dark, 3.42, 2.15, 2.5 * s, -1.075, 1.71, 0, Math.PI / 2);
    // the proscenium: a wall with the opening, gilt frame, red curtains and a valance
    const wallM = M('#1C0E14');
    plane(wallM, 6, 8, -4.85, 4, 3.48); plane(wallM, 6, 8, 4.85, 4, 3.48); plane(wallM, 3.7, 4.4, 0, 5.8, 3.48);
    const gilt = M('#C9A04A', { roughness: 0.35, metalness: 0.8 });
    box(gilt, 0.16, 3.7, 0.12, -1.93, 1.85, 3.5); box(gilt, 0.16, 3.7, 0.12, 1.93, 1.85, 3.5); box(gilt, 4.02, 0.18, 0.12, 0, 3.69, 3.5);
    const crest = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.05, 16, 64), gilt);   // a gilt oval over the arch
    crest.scale.set(1.4, 1, 1); crest.position.set(0, 4.25, 3.52); scene.add(crest);
    const velvet = M('#8E1424', { roughness: 0.9 });
    const curtain = (w, h, x, y, z, folds) => {
      const geo = new THREE.PlaneGeometry(w, h, 64, 4), p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, 0.06 * Math.sin(p.getX(i) / w * folds * TAU));
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, velvet); m.position.set(x, y, z); scene.add(m);
    };
    curtain(0.45, 3.6, -1.62, 1.8, 3.38, 4); curtain(0.45, 3.6, 1.62, 1.8, 3.38, 4); curtain(3.8, 0.5, 0, 3.35, 3.4, 13);
    // the stalls: the audience floor and two rows of heads in silhouette
    plane(new THREE.MeshBasicMaterial({ color: '#1C141C', clippingPlanes: [cut] }), 14, 12, 0, -1.0, 9.4, -Math.PI / 2);
    const head = new THREE.MeshBasicMaterial({ color: '#050407', clippingPlanes: [cut] });
    for (const [z, y, n] of [[5.4, -0.08, 7], [6.5, -0.16, 8]]) for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * 0.62 + (z > 6 ? 0.3 : 0);
      const h1 = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 14), head); h1.position.set(x, y, z); h1.scale.set(1, 1.15, 1); scene.add(h1);
      const sh = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.2, 4, 12), head); sh.position.set(x, y - 0.32, z); sh.rotation.z = Math.PI / 2; scene.add(sh);
    }

    // the actor lying in the pit is the ghost's mirror image: the standing lady at (0, 0, -1.6), reflected in y = z
    const gown = new THREE.MeshStandardMaterial({ color: '#F4F7FF', roughness: 0.6, side: THREE.DoubleSide });
    const actor = lady(gown), actorRoot = new THREE.Group();
    actor.g.position.set(0, 0, -1.6);
    actorRoot.matrixAutoUpdate = false; actorRoot.matrix.copy(MIRROR);
    actorRoot.add(actor.g); scene.add(actorRoot);
    box(M('#3A2A22'), 1.2, 0.05, 1.9, 0, -2.08, 0.8);       // the board she lies on
    const LAMP = new THREE.Vector3(0.9, -0.5, 2.6);
    const pitLamp = new THREE.SpotLight('#E8F0FF', 0, 6, 0.75, 0.5, 1.2);
    pitLamp.position.copy(LAMP); pitLamp.target.position.set(0, -1.6, 0.8);
    scene.add(pitLamp, pitLamp.target);
    const housing = box(new THREE.MeshStandardMaterial({ color: '#2A2A30', roughness: 0.4, metalness: 0.6 }), 0.3, 0.3, 0.42, LAMP.x, LAMP.y, LAMP.z);
    housing.lookAt(0, -1.6, 0.8);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.12, 32), new THREE.MeshBasicMaterial({ color: '#FFFFFF' }));
    housing.add(lens); lens.position.z = 0.215;
    const target = new THREE.Vector3(0, -1.6, 0.8), len = LAMP.distanceTo(target);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.75, len, 48, 1, true),     // the lamp's beam
      new THREE.MeshBasicMaterial({ color: '#DDEBFF', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.lerpVectors(LAMP, target, 0.5);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), target.clone().sub(LAMP).normalize());
    scene.add(beam);

    // the glass: almost invisible from the stalls, a bright edge from the side
    const glassMat = new THREE.MeshBasicMaterial({ color: '#BFEFFF', transparent: true, opacity: 0.04, depthWrite: false, side: THREE.DoubleSide });
    const glass = new THREE.Mesh(new THREE.BoxGeometry(2 * GX, GT * Math.SQRT2, 0.025), glassMat);
    glass.position.set(0, GT / 2, GT / 2); glass.rotation.x = Math.PI / 4;
    scene.add(glass);

    // every theatre mesh is drawn in two halves: the far half (x < 0) stays, the near half (x > 0) is left out of the cut-away
    const nearMats = [], halves = [];
    scene.traverse(m => { if (m.isMesh && m.material.clippingPlanes && m.material.clippingPlanes[0] === cut) halves.push(m); });
    for (const m of halves) {
      const mat = m.material.clone();
      mat.clippingPlanes = [near];
      const twin = new THREE.Mesh(m.geometry, mat);
      nearMats.push(twin);
      m.add(twin);
    }

    // the ghost layer: the standing lady (the reflected actor), lit by the reflected lamp, only seen through the glass
    const ghostScene = new THREE.Scene();
    const ghostMat = new THREE.ShaderMaterial({
      uniforms: { uLamp: { value: LAMP.clone().applyMatrix4(MIRROR) }, uOn: { value: 0 } },
      side: THREE.DoubleSide,
      vertexShader: 'varying vec3 vW, vN; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform vec3 uLamp; uniform float uOn; varying vec3 vW, vN;
        void main() {
          vec3 d = vW - cameraPosition;                    // where the line from the eye crosses the glass plane y = z
          float s = (cameraPosition.z - cameraPosition.y) / (d.y - d.z);
          vec3 g = cameraPosition + s * d;
          float inside = step(0.0, s) * step(s, 1.0) * smoothstep(${GX}, ${GX - 0.03}, abs(g.x)) * smoothstep(0.0, 0.03, g.y) * smoothstep(${GT}, ${GT - 0.03}, g.y);
          vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
          vec3 L = normalize(uLamp - vW);
          float lit = 0.25 + 0.75 * max(dot(n, L), 0.0);
          gl_FragColor = vec4(vec3(0.3, 0.42, 0.58) * lit * uOn * inside, 1.0);
        }`,
    });
    const ghost = lady(ghostMat);
    ghost.g.position.set(0, 0, -1.6);
    ghostScene.add(ghost.g);

    // two cameras, each drifting slowly: one in the stalls, one at the side looking at the cut-away
    const audience = new THREE.PerspectiveCamera(38, W / H, 0.1, 100), sideCam = new THREE.PerspectiveCamera(36, W / H, 0.1, 100);
    state.cam = sideCam;
    const pose = t => {
      const a = TAU * t / 5;
      audience.position.set(0.55 * Math.sin(a), 1.0 + 0.08 * Math.cos(2 * a), 15);
      audience.lookAt(0.2 * Math.sin(a), 1.55, -1.2);
      const b = Math.PI / 2 - 0.1 + 0.07 * Math.sin(a + 1);
      sideCam.position.set(20 * Math.sin(b), 1.9 + 0.15 * Math.sin(2 * a), 0.4 + 20 * Math.cos(b));
      sideCam.lookAt(0, 0.55, 0.5);
      const on = lamp(t);
      pitLamp.intensity = 30 * on;
      beam.material.opacity = 0.16 * on;
      lens.material.color.setScalar(0.15 + 0.85 * on);
      ghostMat.uniforms.uOn.value = on;
      // she sways and lifts her arms; the actor moves the same way, so the ghost follows
      for (const f of [actor, ghost]) {
        f.g.rotation.y = 0.18 * Math.sin(a);
        f.g.position.x = 0.06 * Math.sin(a + 0.6);
        f.arms.forEach((m, i) => { m.rotation.z = (i ? 1 : -1) * (0.35 + 0.45 * (0.5 - 0.5 * Math.cos(a))); m.rotation.x = -0.25; });
      }
    };
    // one view: the stage, then the ghost layer on its own, both added into sum with weight w
    const opts = { type: THREE.HalfFloatType, samples: 4 };
    const main = new THREE.WebGLRenderTarget(W, H, opts), ghostRT = new THREE.WebGLRenderTarget(W, H, opts);
    const sum = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
    const add = new THREE.ShaderMaterial({
      uniforms: { tMain: { value: main.texture }, tGhost: { value: ghostRT.texture }, uW: { value: 1 } }, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: 'uniform sampler2D tMain, tGhost; uniform float uW; varying vec2 vUv; void main() { gl_FragColor = vec4((texture2D(tMain, vUv).rgb + texture2D(tGhost, vUv).rgb) * uW, 1.0); }',
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    });
    const quad = new THREE.Scene(), flat = new THREE.Camera();
    quad.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), add));
    const view = (camera, cutaway, w) => {
      for (const m of nearMats) m.visible = !cutaway;    // the cut-away: the near half of the theatre is gone
      glassMat.opacity = cutaway ? 0.14 : 0.04;
      fill.intensity = cutaway ? 1.75 : 0.55;
      renderer.setRenderTarget(main);
      renderer.setClearColor('#07060C', 1);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(ghostRT);
      renderer.setClearColor('#000000', 1);
      renderer.clear();
      renderer.render(ghostScene, camera);
      add.uniforms.uW.value = w;
      renderer.setRenderTarget(sum);
      renderer.render(quad, flat);
    };
    const output = new OutputPass();
    output.renderToScreen = true;
    return {
      render(t) {
        const k = cutTo(t);
        pose(t);
        renderer.autoClear = false;
        renderer.setRenderTarget(sum);
        renderer.setClearColor('#000000', 0);
        renderer.clear();
        if (k < 1) view(audience, false, 1 - k);
        if (k > 0) view(sideCam, true, k);
        output.render(renderer, null, sum);
        state.k = k;
      },
    };
  },
  // two pills; at the side, the light path: actor -> glass -> the seat, and the line back to where the ghost appears
  overlay(ctx, t, W, H) {
    const k = state.k, cam = state.cam;
    if (k > 0.6) {
      const P = (x, y, z) => { const q = new THREE.Vector3(x, y, z).project(cam); return [(q.x + 1) / 2 * W, (1 - q.y) / 2 * H]; };
      ctx.save();
      ctx.globalAlpha = clamp((k - 0.6) / 0.3);
      ctx.lineCap = 'round';
      for (const [ay, az, gy] of [[-1.6, 1.58, 1.429], [-1.6, 0.0, 0.1305]]) {
        const a = P(0, ay, az), g = P(0, gy, gy), e = P(0, gy + (EYE.y - gy) * 0.35, gy + (EYE.z - gy) * 0.35), v = P(0, az, ay);
        ctx.strokeStyle = '#FFE7A8'; ctx.lineWidth = 5; ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...g); ctx.lineTo(...e); ctx.stroke();
        const ang = Math.atan2(e[1] - g[1], e[0] - g[0]);   // arrowhead toward the seats
        ctx.fillStyle = '#FFE7A8';
        ctx.beginPath(); ctx.moveTo(e[0] + 16 * Math.cos(ang), e[1] + 16 * Math.sin(ang));
        ctx.lineTo(e[0] + 12 * Math.cos(ang + 2.4), e[1] + 12 * Math.sin(ang + 2.4)); ctx.lineTo(e[0] + 12 * Math.cos(ang - 2.4), e[1] + 12 * Math.sin(ang - 2.4)); ctx.fill();
        ctx.strokeStyle = 'rgba(160, 220, 255, 0.9)'; ctx.lineWidth = 4; ctx.setLineDash([12, 12]);
        ctx.beginPath(); ctx.moveTo(...g); ctx.lineTo(...v); ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.font = `700 30px ${FONT.sans}`; ctx.textBaseline = 'middle';
      const tag = (txt, [x, y], col) => {                  // kept inside the frame
        const w = ctx.measureText(txt).width;
        ctx.textAlign = 'center'; ctx.fillStyle = col; ctx.fillText(txt, clamp(x, w / 2 + 40, W - w / 2 - 40), y);
      };
      tag('GHOST APPEARS · 유령', P(0, 2.15, -1.6), '#A0DCFF');
      tag('GLASS 45° · 유리', P(0, 3.75, 3.0), '#BFEFFF');
      tag('HIDDEN ACTOR · 숨은 배우', P(0, -2.55, 0.8), '#FFE7A8');
      ctx.restore();
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    [['AUDIENCE · 객석에서', 1 - k, '#FFD9A0', 290], ['SIDE CUT-AWAY · 옆 단면', k, '#A0DCFF', 790]].forEach(([txt, on, col, x]) => {
      ctx.fillStyle = `rgba(10, 8, 16, ${0.6 + 0.25 * on})`;
      ctx.beginPath(); ctx.roundRect(x - 235, 1726, 470, 80, 40); ctx.fill();
      ctx.globalAlpha = 0.3 + 0.7 * on;
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = col; ctx.font = `700 32px ${FONT.sans}`; ctx.fillText(txt, x, 1767);
      ctx.globalAlpha = 1;
    });
  },
};
