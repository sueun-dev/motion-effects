// Virtual production (in-camera VFX): an astronaut stands on a sand-covered stage inside a curved LED wall. Every
// frame an alien desert is rendered from the tracked film camera (the inner frustum) and projected onto the wall,
// so through that camera the far dunes, spires and ringed planet sit at their true depth and shift in parallax as
// the camera dollies. The rest of the wall shows the same world as a fixed panorama from the stage centre (the outer
// frustum), which only lights the set; the helmet visor reflects the wall through a cube camera. The shot starts as
// the film camera's picture, which shrinks into a corner to reveal the volume, the rig and its frustum, then grows back.
import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { TAU, FONT, ease, span, rng } from '../lib/util.js';

const R = 10, WH = 7;                                         // LED wall: radius, height (m)
const ACTOR = new THREE.Vector3(0, 0, -3.5);
const WIDE = { pos: new THREE.Vector3(-4.2, 4.6, 12.5), look: new THREE.Vector3(1.4, 2.0, -3.0), fov: 50 };
const FILM_FOV = 38;
// 0 = looking through the film camera, 1 = the wide view of the stage
const reveal = t => span(t, 0.75, 2.25) - span(t, 3.5, 5.0);
const state = { k: 0 };

function filmPose(t, cam) {                                   // the tracked camera dollies left and right
  const a = TAU * t / 5;
  cam.position.set(1.8 * Math.sin(a), 1.45 + 0.08 * Math.sin(2 * a), 3.3);
  cam.lookAt(0.3 * Math.sin(a), 1.32, ACTOR.z);
  cam.updateMatrixWorld();
}

// ---- the virtual world: an alien desert at dusk ----
function desert() {
  const v = new THREE.Scene();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vD; void main() { vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vD;
      float h(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main() {
        float y = vD.y;
        vec3 c = mix(vec3(1.0, 0.55, 0.38), vec3(0.78, 0.32, 0.5), smoothstep(0.0, 0.12, y));
        c = mix(c, vec3(0.12, 0.08, 0.3), smoothstep(0.1, 0.55, y));
        c = mix(c, vec3(0.03, 0.03, 0.1), smoothstep(0.5, 1.0, y));
        vec3 q = floor(vD * 260.0);                       // fixed stars, brighter higher up
        float s = step(0.9975, h(q)) * smoothstep(0.15, 0.5, y);
        gl_FragColor = vec4(c + s * 0.9, 1.0);
      }`,
  }));
  v.add(sky);
  v.fog = new THREE.FogExp2('#C76A70', 0.0065);
  v.add(new THREE.HemisphereLight('#C58AC0', '#5A3A30', 1.2));
  const sun = new THREE.DirectionalLight('#FFB98A', 2.4);
  sun.position.set(-40, 18, -60);
  v.add(sun);
  const planet = new THREE.Group();                           // the ringed planet low on the horizon
  const ball = new THREE.Mesh(new THREE.SphereGeometry(42, 64, 32), new THREE.MeshStandardMaterial({ color: '#F0B08A', emissive: '#7A4A70', roughness: 1, fog: false }));
  const ringG = new THREE.RingGeometry(58, 92, 128);
  const ring = new THREE.Mesh(ringG, new THREE.MeshBasicMaterial({ color: '#F6D2B0', transparent: true, opacity: 0.55, side: THREE.DoubleSide, fog: false }));
  ring.rotation.x = Math.PI / 2 - 0.35; ring.rotation.y = 0.25;
  planet.add(ball, ring);
  planet.position.set(-330, 120, -620);
  v.add(planet);
  for (const [x, y, z, r] of [[260, 300, -600, 14], [120, 360, -650, 7]]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16), new THREE.MeshBasicMaterial({ color: '#FFF0DA', fog: false }));
    m.position.set(x, y, z);
    v.add(m);
  }
  const groundGeo = new THREE.PlaneGeometry(1400, 1400, 200, 200);
  groundGeo.rotateX(-Math.PI / 2);
  const p = groundGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {                         // flat where the stage floor continues, dunes beyond
    const x = p.getX(i), z = p.getZ(i), d = Math.hypot(x, z);
    const k = THREE.MathUtils.smoothstep(d, 14, 60);
    p.setY(i, k * (2.2 * Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.038) + 1.4 * Math.sin(x * 0.11 - z * 0.07) + 3 * Math.max(0, Math.sin(z * 0.02 + x * 0.013))));
  }
  groundGeo.computeVertexNormals();
  v.add(new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ color: '#C98F6A', roughness: 1 })));
  const rockMat = new THREE.MeshStandardMaterial({ color: '#9A4E3E', roughness: 0.9, flatShading: true });
  const r = rng(9);
  for (let i = 0; i < 22; i++) {                              // spires and mesas from 13 m to 300 m away
    const far = i >= 12, a = -Math.PI / 2 + (r() - 0.5) * (far ? 2.4 : 2.0);
    const d = far ? 90 + r() * 220 : 13 + i * 3.2 + r() * 4;
    const h = far ? 20 + r() * 50 : 2 + r() * 7, w = far ? 18 + r() * 30 : 0.8 + r() * 1.6;
    const m = new THREE.Mesh(far ? new THREE.CylinderGeometry(w * 0.7, w, h, 7) : new THREE.ConeGeometry(w, h, 6), rockMat);
    m.position.set(Math.cos(a) * d, h / 2 - (far ? 2 : 0.3), Math.sin(a) * d);
    m.rotation.y = r() * 3;
    v.add(m);
  }
  return v;
}

function astronaut(env) {
  const g = new THREE.Group();
  const suit = new THREE.MeshStandardMaterial({ color: '#F2F0EC', roughness: 0.55, envMap: env, envMapIntensity: 0.9 });
  const trim = new THREE.MeshStandardMaterial({ color: '#8A8F9C', roughness: 0.4, metalness: 0.5, envMap: env });
  const visor = new THREE.MeshStandardMaterial({ color: '#FFD68A', roughness: 0.04, metalness: 1, envMap: env, envMapIntensity: 1.6 });
  const add = (geo, mat, x, y, z, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  add(new THREE.CapsuleGeometry(0.3, 0.42, 8, 24), suit, 0, 1.18, 0).scale.set(1, 1, 0.8);
  add(new THREE.BoxGeometry(0.5, 0.62, 0.26), trim, 0, 1.24, -0.28);
  add(new THREE.BoxGeometry(0.24, 0.14, 0.05), new THREE.MeshStandardMaterial({ color: '#3A8DFF', emissive: '#1A4AB0', roughness: 0.3 }), 0, 1.3, 0.25);
  for (const s of [-1, 1]) {
    add(new THREE.CapsuleGeometry(0.12, 0.62, 6, 16), suit, s * 0.14, 0.43, 0);
    add(new THREE.BoxGeometry(0.2, 0.12, 0.3), trim, s * 0.14, 0.06, 0.04);
    const arm = add(new THREE.CapsuleGeometry(0.1, 0.52, 6, 16), suit, s * 0.42, 1.12, 0);
    arm.rotation.z = s * 0.22;
    add(new THREE.SphereGeometry(0.1, 16, 12), trim, s * 0.5, 0.78, 0.02);
  }
  const head = new THREE.Group();
  head.position.set(0, 1.72, 0);
  g.add(head);
  add(new THREE.SphereGeometry(0.26, 48, 32), suit, 0, 0, 0, head);
  add(new THREE.SphereGeometry(0.24, 48, 32, -1.2, 2.4, 0.62, 1.3), visor, 0, 0.0, 0.035, head);
  add(new THREE.TorusGeometry(0.22, 0.04, 12, 32), trim, 0, -0.22, 0, head).rotation.x = Math.PI / 2;
  g.position.copy(ACTOR);
  return { group: g, head };
}

export default {
  name: 'Virtual Production',
  ko: '버추얼 프로덕션',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const world = desert();
    const filmCam = new THREE.PerspectiveCamera(FILM_FOV, W / H, 0.3, 2000);
    const inner = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
    const outerRT = new THREE.WebGLCubeRenderTarget(512, { type: THREE.HalfFloatType });
    const outerCam = new THREE.CubeCamera(0.3, 2000, outerRT);
    outerCam.position.set(0, 1.6, 0);
    outerCam.update(renderer, world);                        // the outer frustum: a fixed panorama from the stage centre

    // ---- the stage ----
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#07070C');
    const filmVP = new THREE.Matrix4();
    const wallMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { tInner: { value: inner.texture }, tOuter: { value: outerRT.texture }, uVP: { value: filmVP }, uShow: { value: 0 } },
      vertexShader: 'varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform sampler2D tInner; uniform samplerCube tOuter; uniform mat4 uVP; uniform float uShow;
        varying vec3 vW;
        void main() {
          vec4 c = uVP * vec4(vW, 1.0);
          vec2 uv = c.xy / c.w * 0.5 + 0.5;
          vec3 outer = textureCube(tOuter, normalize(vW - vec3(0.0, 1.6, 0.0))).rgb * 0.75;
          vec2 e = min(uv, 1.0 - uv) / fwidth(uv);               // distance to the frustum edge in screen pixels
          float d = c.w > 0.0 ? min(e.x, e.y) : -1e4;
          float inside = smoothstep(-1.0, 1.0, d);
          vec3 col = mix(outer, texture2D(tInner, clamp(uv, 0.0, 1.0)).rgb, inside);
          col = mix(col, vec3(0.35, 1.0, 0.6) * 1.6, uShow * (1.0 - smoothstep(1.5, 3.5, abs(d))));   // frustum outline
          vec2 s = vec2(atan(vW.x, vW.z) * ${R}.0, vW.y) / 0.5, fw = fwidth(s);                         // 0.5 m panels
          vec2 g = abs(fract(s - 0.5) - 0.5) / fw;
          float seam = (1.0 - min(min(g.x, g.y), 1.0)) * clamp(1.0 - max(fw.x, fw.y) * 12.0, 0.0, 1.0);
          col *= 1.0 - 0.45 * seam * uShow;
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const arc = [Math.PI - TAU / 3, TAU * 2 / 3];
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, WH, 200, 1, true, ...arc), wallMat);
    wall.position.y = WH / 2;
    const back = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.25, R + 0.25, WH + 0.3, 200, 1, true, ...arc), new THREE.MeshStandardMaterial({ color: '#15161E', roughness: 0.8 }));
    back.position.y = WH / 2;
    const lidMat = wallMat.clone();                          // LED ceiling over the back half, same projection
    lidMat.side = THREE.FrontSide;
    lidMat.uniforms = wallMat.uniforms;
    const lid = new THREE.Mesh(new THREE.RingGeometry(5.5, R, 128, 1, Math.PI * 5 / 6, TAU * 2 / 3), lidMat);
    lid.rotation.x = Math.PI / 2; lid.position.y = WH;
    scene.add(wall, back, lid);
    const studio = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#0E0E14', roughness: 0.7 }));
    studio.rotation.x = -Math.PI / 2; studio.position.y = -0.02; studio.receiveShadow = true;
    const cubeRT = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    const helmetCam = new THREE.CubeCamera(0.1, 100, cubeRT);
    const sand = new THREE.Mesh(new THREE.CircleGeometry(R, 128), new THREE.MeshStandardMaterial({ color: '#C98F6A', roughness: 1, envMap: cubeRT.texture, envMapIntensity: 0.5 }));
    sand.rotation.x = -Math.PI / 2; sand.receiveShadow = true;
    scene.add(studio, sand);
    const rockMat = new THREE.MeshStandardMaterial({ color: '#9A4E3E', roughness: 0.9, flatShading: true, envMap: cubeRT.texture, envMapIntensity: 0.5 });
    const rr = rng(3);
    for (let i = 0; i < 9; i++) {                             // practical rocks along the foot of the wall
      const a = -Math.PI / 2 + (i - 4) * 0.27 + (rr() - 0.5) * 0.1, d = 8.4 + rr() * 1.2;
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35 + rr() * 0.45, 0), rockMat);
      m.position.set(Math.cos(a) * d, 0.1, Math.sin(a) * d); m.scale.y = 0.6; m.rotation.set(rr() * 3, rr() * 3, 0);
      m.castShadow = m.receiveShadow = true;
      scene.add(m);
    }
    scene.add(new THREE.HemisphereLight('#E0A0C8', '#6A4A3A', 1.1));
    const key = new THREE.SpotLight('#FFE2C4', 150, 30, 0.75, 1, 1.6);     // the practical key light
    key.position.set(-4, 6.5, 4); key.target.position.copy(ACTOR);
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 5;
    const rim = new THREE.DirectionalLight('#FF9A7A', 1.2);
    rim.position.set(-3, 3, -12);
    scene.add(key, key.target, rim);
    const actor = astronaut(cubeRT.texture);
    scene.add(actor.group);

    // the film camera on its dolly, and its frustum to the wall
    const rig = new THREE.Group();
    const black = new THREE.MeshStandardMaterial({ color: '#30323C', roughness: 0.35, metalness: 0.6, envMap: cubeRT.texture });
    const part = (geo, x, y, z) => { const m = new THREE.Mesh(geo, black); m.position.set(x, y, z); m.castShadow = true; rig.add(m); return m; };
    part(new THREE.BoxGeometry(0.28, 0.3, 0.5), 0, 0, 0.36);                     // body
    part(new THREE.CylinderGeometry(0.1, 0.11, 0.3, 32), 0, 0, -0.02).rotation.x = Math.PI / 2;   // lens
    part(new THREE.BoxGeometry(0.22, 0.14, 0.02), 0.25, 0.12, 0.3).rotation.y = 0.6;              // monitor
    part(new THREE.CylinderGeometry(0.05, 0.06, 1.25, 16), 0, -0.78, 0.36);      // column
    part(new THREE.BoxGeometry(0.8, 0.08, 1.0), 0, -1.38, 0.36);                 // dolly
    for (const [x, z] of [[-0.34, -0.06], [0.34, -0.06], [-0.34, 0.78], [0.34, 0.78]]) part(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 20), x, -1.42, z).rotation.z = Math.PI / 2;
    const tally = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), new THREE.MeshBasicMaterial({ color: '#FF3030' }));
    tally.position.set(0, 0.18, 0.2); rig.add(tally);
    scene.add(rig);
    const frustum = new LineSegments2(new LineSegmentsGeometry(), new LineMaterial({ color: '#59FF9A', linewidth: 3, resolution: new THREE.Vector2(W, H) }));
    scene.add(frustum);
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(c => new THREE.Vector3(c[0], c[1], 0.5));
    const hitWall = (o, d) => {                               // ray from inside the circle to the wall (x^2 + z^2 = R^2)
      const a = d.x * d.x + d.z * d.z, b = 2 * (o.x * d.x + o.z * d.z), c = o.x * o.x + o.z * o.z - R * R;
      return o.clone().addScaledVector(d, (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a));
    };

    // the final picture (through the film camera) goes to an image; the wide view of the stage is drawn behind it
    const film = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    const inset = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false,
      uniforms: { tFilm: { value: film.texture }, uRect: { value: new THREE.Vector4(0, 0, W, H) }, uRad: { value: 0 }, uLine: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D tFilm; uniform vec4 uRect; uniform float uRad, uLine; varying vec2 vUv;
        void main() {
          vec2 p = vec2(vUv.x * ${W}.0, (1.0 - vUv.y) * ${H}.0);          // pixels, y down
          vec2 q = abs(p - uRect.xy - uRect.zw * 0.5) - uRect.zw * 0.5 + uRad;
          float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRad; // distance to the rounded rectangle
          vec2 uv = (p - uRect.xy) / uRect.zw;
          vec3 col = texture2D(tFilm, vec2(uv.x, 1.0 - uv.y)).rgb;
          float inside = 1.0 - smoothstep(-0.5, 0.5, d), edge = 1.0 - smoothstep(-0.5, 0.5, d - uLine);
          gl_FragColor = vec4(mix(vec3(1.4), col, inside), edge);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const insetScene = new THREE.Scene(), flat = new THREE.Camera();
    insetScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), inset));
    const BOX = [620, 300, 400, 711];                          // where the camera view settles (px)

    const camera = new THREE.PerspectiveCamera(WIDE.fov, W / H, 0.1, 400);
    renderer.autoClear = false;
    return {
      render(t) {
        const a = TAU * t / 5, k = reveal(t), e = ease.inOut(k);
        state.k = k;
        actor.head.rotation.y = 0.28 * Math.sin(a + 0.6);
        actor.head.rotation.x = 0.06 * Math.sin(2 * a);
        actor.group.rotation.y = 0.08 * Math.sin(a);
        filmPose(t, filmCam);
        filmVP.multiplyMatrices(filmCam.projectionMatrix, filmCam.matrixWorldInverse);
        renderer.setRenderTarget(inner);                       // the inner frustum: the desert from the film camera
        renderer.setClearColor(0x000000, 1);
        renderer.clear();
        renderer.render(world, filmCam);
        rig.position.copy(filmCam.position); rig.quaternion.copy(filmCam.quaternion);
        const ends = corners.map(c => hitWall(filmCam.position, c.clone().unproject(filmCam).sub(filmCam.position).normalize()));
        const seg = [];
        ends.forEach((p, i) => seg.push(...filmCam.position.toArray(), ...p.toArray(), ...p.toArray(), ...ends[(i + 1) % 4].toArray()));
        frustum.geometry.setPositions(seg);
        actor.group.visible = rig.visible = frustum.visible = false;   // the visor and suit reflect the lit wall
        helmetCam.position.set(ACTOR.x, 1.72, ACTOR.z + 0.2);
        helmetCam.update(renderer, scene);
        actor.group.visible = true;
        wallMat.uniforms.uShow.value = 0;                      // the final picture: no rig, no outline
        renderer.setRenderTarget(film);
        renderer.clear();
        renderer.render(scene, filmCam);
        renderer.setRenderTarget(null);
        renderer.setClearColor('#07070C', 1);
        renderer.clear();
        if (k > 0) {                                           // the stage, from a camera drifting behind the rig
          rig.visible = frustum.visible = true;
          wallMat.uniforms.uShow.value = 1;
          camera.position.set(WIDE.pos.x + 0.35 * Math.sin(a), WIDE.pos.y + 0.1 * Math.sin(2 * a), WIDE.pos.z);
          camera.lookAt(WIDE.look);
          renderer.render(scene, camera);
        }
        const u = inset.uniforms;                              // the camera view shrinks from full frame into the box
        u.uRect.value.set(BOX[0] * e, BOX[1] * e, W + (BOX[2] - W) * e, H + (BOX[3] - H) * e);
        u.uRad.value = 26 * e; u.uLine.value = 4 * e;
        renderer.render(insetScene, flat);
      },
    };
  },
  overlay(ctx, t, W, H) {
    const k = state.k;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    [['IN CAMERA', 1 - k, '#FFC07A', 300], ['LED VOLUME', k, '#59FF9A', 780]].forEach(([txt, on, col, x]) => {
      ctx.fillStyle = `rgba(8, 8, 14, ${0.55 + 0.3 * on})`;
      ctx.beginPath(); ctx.roundRect(x - 200, 1730, 400, 76, 38); ctx.fill();
      ctx.globalAlpha = 0.25 + 0.75 * on;
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = col; ctx.font = `700 34px ${FONT.sans}`; ctx.fillText(txt, x, 1769);
      ctx.globalAlpha = 1;
    });
    ctx.globalAlpha = Math.max(0, k * 2 - 1);                  // caption under the camera view
    ctx.fillStyle = '#FFFFFF'; ctx.font = `700 26px ${FONT.sans}`;
    ctx.fillText('● REC  CAMERA VIEW', 820, 1046);
    ctx.globalAlpha = 1;
  },
};
