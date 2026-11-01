// Lenticular print: a postcard covered in 64 vertical cylinder lenses tilts in three steps. Under every lens lie
// three thin strips, one from each picture (day, dusk, night); the lens shows only the strip it focuses on, and
// which one that is depends on the viewing angle. The shader works it out per pixel from the camera direction in
// card space, so the flip sweeps across the card as it turns, and each ridge gets its own satin highlight.
// A loupe shows the ridges up close and the cross-section below shows the eye's rays picking a strip.
import * as THREE from 'three';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { TAU, FONT, smoothstep } from '../lib/util.js';

const CW = 6, CH = 8, LENSES = 64, STEP = 0.62;            // card size, lenses across it, tilt per step (rad)
const SPOT = new THREE.Vector3(-1.15, -1.45, 0.04);        // the patch the loupe magnifies (card space)
const FOV = 30, LOUPE_FOV = 1.15;                          // main and loupe field of view (degrees)
const SUB = 12;                                            // sub-frames averaged per frame (motion blur over the whole frame)
const state = { th: 0, spot: new THREE.Vector3() };        // shared with the overlay: viewing angle, spot on screen
const LOUPE = { x: 262, y: 1652, r: 182 };                 // loupe on screen (px)
const SCENES = [                                           // the three pictures interleaved under the lenses
  { word: 'GOOD MORNING', sky: ['#5BB8FF', '#BFE8FF'], hills: ['#9BDB6A', '#5DBB63', '#2F9A5B'], ink: '#1F4E8C', strip: '#7CC8FF' },
  { word: 'GOOD EVENING', sky: ['#4A2A7A', '#FF7A59', '#FFC46B'], hills: ['#C2507E', '#8E3B78', '#5A2A68'], ink: '#FFF1D6', strip: '#FF8A5B' },
  { word: 'GOOD NIGHT', sky: ['#060A26', '#1C2766'], hills: ['#26336E', '#1A2456', '#10173D'], ink: '#FFE9A8', strip: '#3A4AA8' },
];

// one picture of the postcard: the same little house under a day, dusk or night sky
function picture(k) {
  const s = SCENES[k], c = document.createElement('canvas');
  c.width = 1080; c.height = 1440;
  const g = c.getContext('2d'), w = 1080, h = 1440;
  g.fillStyle = '#FFF8EE'; g.fillRect(0, 0, w, h);          // printed white border
  g.save();
  g.beginPath(); g.roundRect(44, 44, w - 88, h - 88, 34); g.clip();
  const sky = g.createLinearGradient(0, 44, 0, 1000);
  s.sky.forEach((col, i) => sky.addColorStop(i / (s.sky.length - 1), col));
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  if (k === 0) {                                           // sun with rays
    g.fillStyle = 'rgba(255, 236, 140, 0.5)';
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU;
      g.beginPath(); g.moveTo(770, 470);
      g.arc(770, 470, 260, a - 0.09, a + 0.09); g.fill();
    }
    g.fillStyle = '#FFD23F'; g.beginPath(); g.arc(770, 470, 120, 0, TAU); g.fill();
    g.fillStyle = '#FFFFFF';                                // clouds
    for (const [x, y, r] of [[250, 560, 70], [330, 530, 90], [420, 570, 66], [610, 700, 50], [680, 680, 64], [750, 705, 46]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  } else if (k === 1) {                                    // a big sun sinking behind the hills
    const glow = g.createRadialGradient(540, 860, 120, 540, 860, 520);
    glow.addColorStop(0, 'rgba(255, 220, 140, 0.8)'); glow.addColorStop(1, 'rgba(255, 220, 140, 0)');
    g.fillStyle = glow; g.fillRect(0, 0, w, h);
    g.fillStyle = '#FFE08A'; g.beginPath(); g.arc(540, 860, 210, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255, 140, 90, 0.75)';
    for (let i = 0; i < 5; i++) g.fillRect(300, 720 + i * 38, 480, 10 + i * 3);
  } else {                                                 // crescent moon and stars
    g.fillStyle = '#FFF4C2';
    const r = (n => () => (n = (n * 16807) % 2147483647) / 2147483647)(7);
    for (let i = 0; i < 70; i++) { g.beginPath(); g.arc(70 + r() * 940, 70 + r() * 820, 2 + r() * 4, 0, TAU); g.fill(); }
    g.save();                                              // the crescent: the moon disc minus a shifted disc
    g.beginPath(); g.arc(760, 430, 130, 0, TAU); g.clip();
    g.beginPath(); g.rect(0, 0, w, h); g.arc(815, 395, 112, 0, TAU); g.fill('evenodd');
    g.restore();
  }
  s.hills.forEach((col, i) => {                            // three rolling hills
    g.fillStyle = col;
    g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += 10) g.lineTo(x, 900 + i * 110 - 70 * Math.sin(x / 260 + i * 1.7) - 40 * Math.sin(x / 120 + i));
    g.lineTo(w, h); g.fill();
  });
  const hx = 300, hy = 1030;                               // the house on the middle hill
  g.fillStyle = k === 2 ? '#C9C4E8' : '#FFFFFF'; g.fillRect(hx, hy, 220, 170);
  g.fillStyle = k === 2 ? '#7A2E4A' : '#E2453C';
  g.beginPath(); g.moveTo(hx - 30, hy + 4); g.lineTo(hx + 110, hy - 110); g.lineTo(hx + 250, hy + 4); g.fill();
  g.fillStyle = k === 0 ? '#5BA8E8' : '#FFD36E';
  g.fillRect(hx + 30, hy + 50, 56, 56); g.fillRect(hx + 136, hy + 50, 56, 56);
  g.fillStyle = k === 0 ? '#8A5A3B' : '#5A3A2A'; g.fillRect(hx + 92, hy + 92, 40, 78);
  g.restore();
  g.fillStyle = s.ink;                                     // the greeting
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = `700 104px ${FONT.display}`;
  g.fillText(s.word, w / 2, 250);
  g.font = `600 40px ${FONT.display}`;
  g.fillText(`${k + 1} / 3`, w / 2, 1330);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// card rotation about the vertical axis: a slow swing that dwells on day and night and passes dusk on the way
const tilt = t => -STEP * Math.cos(TAU * t / 5 - 0.8);

const vert = `
varying vec2 vUv; varying vec3 vPos;
void main() { vUv = uv; vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const frag = `
uniform sampler2D tA, tB, tC; uniform vec3 uCam, uLight; uniform float uLenses;
varying vec2 vUv; varying vec3 vPos;
void main() {
  vec2 p = (vUv - 0.5) * vec2(${CW}.0, ${CH}.0);
  vec2 d = max(abs(p) - vec2(${CW / 2 - 0.3}, ${CH / 2 - 0.3}), 0.0);   // rounded corners, anti-aliased
  float edge = length(d) - 0.3, aa = fwidth(edge);
  float alpha = 1.0 - smoothstep(-aa, aa, edge);
  if (alpha <= 0.0) discard;
  vec3 V = normalize(uCam - vPos);
  float th = atan(V.x, V.z);                                  // viewing angle across the ridges
  float u = vUv.x * uLenses, xl = fract(u) - 0.5;            // position inside this lens, -0.5 .. 0.5
  float q = -th / ${STEP} + xl * 0.15;                         // which strip the lens focuses on: -1, 0, 1
  float e = max(fwidth(q) * 0.8, 0.08);
  float wA = 1.0 - smoothstep(-0.5 - e, -0.5 + e, q), wC = smoothstep(0.5 - e, 0.5 + e, q);
  vec3 col = texture2D(tA, vUv).rgb * wA + texture2D(tB, vUv).rgb * (1.0 - wA - wC) + texture2D(tC, vUv).rgb * wC;
  // the ridge: a cylinder cross-section, averaged over 4 samples across the pixel. In the main view (12 px ridges)
  // only a soft cosine valley shows, which slides smoothly; in the loupe (60 px) the full lens shading and highlight
  float du = fwidth(u);
  vec3 L = normalize(uLight), H = normalize(L + V);
  float spec = 0.0, lit = 0.0, prof = 0.0;
  for (int k = 0; k < 4; k++) {
    float x = fract(u + (float(k) - 1.5) * 0.25 * du) - 0.5;
    vec3 n = normalize(vec3(x, 0.0, sqrt(0.36 - x * x)));
    spec += pow(max(dot(n, H), 0.0), 36.0) * 0.25;
    lit += (0.86 + 0.14 * dot(n, L)) * 0.25;
    prof += (0.5 + 0.5 * cos(6.2831853 * x)) * 0.25;
  }
  float ridge = smoothstep(14.0, 40.0, 1.0 / du);
  col *= (1.0 - mix(0.08, 0.22, ridge) * (1.0 - prof)) * mix(1.0, lit, ridge);
  col += vec3(spec * 0.3 * ridge);
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}`;

export default {
  name: 'Lenticular',
  ko: '렌티큘러',
  three(renderer, W, H) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas');
    bg.width = 512; bg.height = 1024;
    const g = bg.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 1024);
    grd.addColorStop(0, '#0C1030'); grd.addColorStop(0.55, '#1E2660'); grd.addColorStop(1, '#0C1030');
    g.fillStyle = grd; g.fillRect(0, 0, 512, 1024);
    const glow = g.createRadialGradient(256, 420, 20, 256, 420, 420);
    glow.addColorStop(0, 'rgba(120, 140, 255, 0.35)'); glow.addColorStop(1, 'rgba(120, 140, 255, 0)');
    g.fillStyle = glow; g.fillRect(0, 0, 512, 1024);
    scene.background = new THREE.CanvasTexture(bg);
    scene.background.colorSpace = THREE.SRGBColorSpace;

    const camera = new THREE.PerspectiveCamera(FOV, W / H, 0.1, 100);
    camera.position.set(0, 0, 30);
    camera.lookAt(0, -0.09, 0);
    const loupeCam = new THREE.PerspectiveCamera(LOUPE_FOV, 1, 0.1, 100);
    loupeCam.position.copy(camera.position);

    scene.add(new THREE.HemisphereLight('#DDE4FF', '#2A2F5E', 1.6));
    const key = new THREE.DirectionalLight('#FFF4E6', 2.2);
    key.position.set(-3, 4, 12);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 });
    key.shadow.radius = 10;
    scene.add(key);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.22 }));
    wall.position.z = -2.2;
    wall.receiveShadow = true;
    scene.add(wall);

    const card = new THREE.Group();
    card.position.y = 1.0;
    const outline = new THREE.Shape();
    outline.moveTo(-CW / 2 + 0.3, -CH / 2);
    outline.lineTo(CW / 2 - 0.3, -CH / 2); outline.absarc(CW / 2 - 0.3, -CH / 2 + 0.3, 0.3, -Math.PI / 2, 0);
    outline.lineTo(CW / 2, CH / 2 - 0.3); outline.absarc(CW / 2 - 0.3, CH / 2 - 0.3, 0.3, 0, Math.PI / 2);
    outline.lineTo(-CW / 2 + 0.3, CH / 2); outline.absarc(-CW / 2 + 0.3, CH / 2 - 0.3, 0.3, Math.PI / 2, Math.PI);
    outline.lineTo(-CW / 2, -CH / 2 + 0.3); outline.absarc(-CW / 2 + 0.3, -CH / 2 + 0.3, 0.3, Math.PI, Math.PI * 1.5);
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(outline, { depth: 0.07, bevelEnabled: false, curveSegments: 12 }),
      new THREE.MeshStandardMaterial({ color: '#F4EFE6', roughness: 0.6 }));
    body.position.z = -0.07;
    body.castShadow = true;
    const faceMat = new THREE.ShaderMaterial({
      uniforms: { tA: { value: picture(0) }, tB: { value: picture(1) }, tC: { value: picture(2) },
        uCam: { value: new THREE.Vector3() }, uLight: { value: new THREE.Vector3() }, uLenses: { value: LENSES } },
      vertexShader: vert, fragmentShader: frag, transparent: true,
    });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(CW, CH), faceMat);
    face.position.z = 0.004;
    card.add(body, face);
    scene.add(card);

    // every frame is the average of SUB renders across its 1/30 s, so the fine ridges blur instead of crawling
    const frame = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
    const sum = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
    const add = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: { tex: { value: frame.texture } }, depthTest: false, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D tex; varying vec2 vUv; void main() { gl_FragColor = texture2D(tex, vUv) / ${SUB}.0; }`,
    }));
    const addScene = new THREE.Scene(), flat = new THREE.Camera();
    addScene.add(add);
    const output = new OutputPass();
    output.renderToScreen = true;

    const inv = new THREE.Matrix4(), spotW = new THREE.Vector3(), lightW = new THREE.Vector3();
    const pose = t => {                                     // place the card and aim the loupe for time t
      card.rotation.y = tilt(t);
      card.updateMatrixWorld();
      inv.copy(card.matrixWorld).invert();
      faceMat.uniforms.uCam.value.copy(camera.position).applyMatrix4(inv);
      lightW.copy(key.position).normalize().transformDirection(inv);
      faceMat.uniforms.uLight.value.copy(lightW);
      const c = faceMat.uniforms.uCam.value;
      state.th = Math.atan2(c.x, c.z);                      // the viewing angle at the card centre, for the diagram
      spotW.copy(SPOT).applyMatrix4(card.matrixWorld);
      state.spot.copy(spotW).project(camera);
      loupeCam.lookAt(spotW);
    };
    renderer.autoClear = false;
    return {
      render(t) {
        const s = LOUPE.r * 2;
        renderer.setRenderTarget(sum);
        renderer.setClearColor(0x000000, 0);
        renderer.clear();
        for (let k = SUB - 1; k >= 0; k--) {
          pose(t - (k + 0.5) / SUB / 30);
          frame.viewport.set(0, 0, W, H);                   // a render target keeps its own viewport and scissor
          frame.scissorTest = false;
          renderer.setRenderTarget(frame);
          renderer.clear();
          renderer.render(scene, camera);
          frame.viewport.set(LOUPE.x - LOUPE.r, H - LOUPE.y - LOUPE.r, s, s);   // the loupe: the same eye, about 5 x closer
          frame.scissor.copy(frame.viewport);
          frame.scissorTest = true;
          renderer.setRenderTarget(frame);
          renderer.clear();
          renderer.render(scene, loupeCam);
          renderer.setRenderTarget(sum);
          renderer.render(addScene, flat);
        }
        output.render(renderer, null, sum);
      },
    };
  },
  // the loupe frame, the spot it shows, and the lens cross-section with the eye's rays
  overlay(ctx, t, W, H) {
    const { th, spot } = state;
    const sx = (spot.x * 0.5 + 0.5) * W, sy = (0.5 - spot.y * 0.5) * H, sr = H / 2 * Math.tan(LOUPE_FOV * Math.PI / 360) / Math.tan(FOV * Math.PI / 360);
    ctx.fillStyle = '#0B0F2A';                              // panel with a round hole for the loupe
    ctx.beginPath(); ctx.roundRect(30, 1430, W - 60, 446, 36);
    ctx.moveTo(LOUPE.x + LOUPE.r, LOUPE.y); ctx.arc(LOUPE.x, LOUPE.y, LOUPE.r, 0, TAU, true);
    ctx.fill('evenodd');
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx - sr * 0.4, sy + sr * 0.92); ctx.lineTo(LOUPE.x - 40, LOUPE.y - LOUPE.r - 4); ctx.stroke();
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(LOUPE.x, LOUPE.y, LOUPE.r, 0, TAU); ctx.stroke();

    // cross-section: four lenses over their strips; the eye sits at the current viewing angle
    const x0 = 500, lw = 120, base = 1760, rad = 66;
    const q = -th / STEP, w = [1 - smoothstep(-0.56, -0.44, q), 0, smoothstep(0.44, 0.56, q)];
    w[1] = 1 - w[0] - w[2];
    ctx.font = `700 26px ${FONT.sans}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText('CROSS-SECTION', x0, 1488);
    for (let i = 0; i < 4; i++) {
      const cx = x0 + lw * (i + 0.5);
      for (let k = 0; k < 3; k++) {                          // three strips under each lens: A B C
        const kx = cx - lw / 2 + 8 + k * (lw - 16) / 3;
        ctx.fillStyle = SCENES[k].strip;                     // an eye on the right sees the left strip, and so on
        ctx.globalAlpha = 0.35 + 0.65 * w[k];
        ctx.fillRect(kx + 2, base, (lw - 16) / 3 - 4, 26);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(190, 210, 255, 0.16)'; ctx.strokeStyle = 'rgba(220, 230, 255, 0.85)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx - lw / 2, base); ctx.arc(cx, base + 26, rad, Math.PI + 0.43, -0.43); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; ctx.font = `600 22px ${FONT.mono}`; ctx.textAlign = 'center';
    ['A', 'B', 'C'].forEach((s, k) => ctx.fillText(s, x0 + lw * 0.5 - lw / 2 + 8 + (k + 0.5) * (lw - 16) / 3, base + 58));
    const ex = x0 + 2 * lw + Math.sin(th) * 240, ey = base - 30 - Math.cos(th) * 200;   // the eye
    for (let i = 0; i < 4; i++) {                            // rays: eye -> lens top -> focus on the strip
      const cx = x0 + lw * (i + 0.5), fx = cx - Math.tan(th) * 64;
      ctx.strokeStyle = 'rgba(255, 230, 150, 0.55)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(cx, base - 34); ctx.lineTo(fx, base + 13); ctx.stroke();
      ctx.fillStyle = '#FFE08A'; ctx.beginPath(); ctx.arc(fx, base + 13, 6, 0, TAU); ctx.fill();
    }
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(th);
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.ellipse(0, 0, 34, 20, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1B2466'; ctx.beginPath(); ctx.arc(0, 4, 11, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.textAlign = 'left'; ctx.font = `700 30px ${FONT.display}`;   // which picture the eye sees
    SCENES.forEach((s, k) => {
      ctx.globalAlpha = w[k];
      ctx.fillStyle = s.strip; ctx.fillText(['A · DAY', 'B · DUSK', 'C · NIGHT'][k], 840, 1488);
    });
    ctx.globalAlpha = 1;
  },
};
