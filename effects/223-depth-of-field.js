// Depth of field, rendered the way a real lens makes it: every frame is the average of 256 renders taken from points
// spread over a round aperture (a fixed Vogel spiral), each with its frustum sheared so the focus plane stays put.
// Whatever sits on the focus plane is sharp; everything else spreads into discs, and the far fairy lights become big
// round bokeh. The focus racks from the white pawn in front to the black king at the back and returns.
import * as THREE from 'three';
import { TAU, FONT, smoothstep, lerp } from '../lib/util.js';

const SAMPLES = 256, APERTURE = 0.06, FOV = 34;
const NEAR_F = 3.0, FAR_F = 8.4; // focus distances of the pawn and the king
// focus as a share of the way from the pawn to the king: rack out, hold, rack back, hold (the loop starts as a
// rack begins, so the change across the loop point matches the rest)
const rack = t => {
  t = (t + 0.1) % 5;
  return smoothstep(0, 1.2, t) - smoothstep(2.5, 3.7, t);
};
const focusAt = t => 1 / lerp(1 / NEAR_F, 1 / FAR_F, rack(t)); // rack in diopters, like a focus ring

// lathe profiles (radius, height) for the pieces
const PROFILES = {
  pawn: [[0, 0], [0.34, 0], [0.34, 0.08], [0.26, 0.14], [0.17, 0.2], [0.12, 0.42], [0.2, 0.47], [0.11, 0.52], [0.17, 0.62], [0.17, 0.72], [0.09, 0.8], [0, 0.82]],
  bishop: [[0, 0], [0.36, 0], [0.36, 0.08], [0.27, 0.15], [0.16, 0.24], [0.11, 0.62], [0.22, 0.68], [0.12, 0.74], [0.18, 0.86], [0.17, 1.0], [0.1, 1.1], [0.05, 1.14], [0.07, 1.18], [0, 1.22]],
  queen: [[0, 0], [0.4, 0], [0.4, 0.09], [0.3, 0.17], [0.18, 0.28], [0.12, 0.85], [0.25, 0.92], [0.14, 0.98], [0.24, 1.2], [0.2, 1.24], [0.08, 1.3], [0.1, 1.38], [0, 1.42]],
  king: [[0, 0], [0.42, 0], [0.42, 0.09], [0.31, 0.18], [0.19, 0.3], [0.13, 0.95], [0.26, 1.02], [0.14, 1.08], [0.23, 1.32], [0.12, 1.4], [0, 1.42]],
};
function piece(kind, mat) {
  const g = new THREE.Group();
  const outline = new THREE.SplineCurve(PROFILES[kind].map(([r, y]) => new THREE.Vector2(r, y))).getPoints(90);
  g.add(new THREE.Mesh(new THREE.LatheGeometry(outline, 96), mat));
  if (kind === 'king') { // a cross on top
    const bar = (w, h, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.07), mat); m.position.y = y; g.add(m); };
    bar(0.07, 0.3, 1.55); bar(0.22, 0.07, 1.58);
  }
  g.traverse(m => { m.castShadow = m.receiveShadow = true; });
  return g;
}

function boardTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    g.fillStyle = (i + j) % 2 ? '#2B1D16' : '#E9DCC4';
    g.fillRect(i * 128, j * 128, 128, 128);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export default {
  name: 'Depth of Field',
  ko: '피사계 심도',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false; // nothing moves, so the shadow map is drawn once
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#1B1420');
    scene.fog = new THREE.Fog('#1B1420', 12, 30);

    const camera = new THREE.PerspectiveCamera(FOV, W / H, 0.1, 80);
    const home = new THREE.Vector3(0.35, 1.55, 4.6), target = new THREE.Vector3(-0.35, 0.25, -3);
    const fwd = target.clone().sub(home).normalize();
    const eye = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();

    scene.add(new THREE.HemisphereLight('#FFE8D6', '#1A1220', 0.35));
    const key = new THREE.SpotLight('#FFD9B0', 140, 30, 0.6, 0.7, 1.5);
    key.position.set(-3.5, 6, 3);
    key.target.position.set(0, 0, -1.5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.radius = 4;
    const rim = new THREE.DirectionalLight('#9FB8FF', 0.8);
    rim.position.set(3, 3, -8);
    scene.add(key, key.target, rim);

    // a chessboard running away from the camera
    const board = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.2, 6.4), [null, null, new THREE.MeshPhysicalMaterial({ map: boardTexture(), roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.3 }), null, null, null].map(m => m || new THREE.MeshStandardMaterial({ color: '#3A2418', roughness: 0.5 })));
    board.position.set(0, -0.1, -1.4);
    board.rotation.y = 0.12;
    board.receiveShadow = true;
    scene.add(board);
    // glossy but not mirror-sharp: a pin-point highlight would spread into a disc of separate dots
    const ivory = new THREE.MeshPhysicalMaterial({ color: '#F4EBDD', roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.32 });
    const ebony = new THREE.MeshPhysicalMaterial({ color: '#1E1822', roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.28 });
    // [kind, material, x, distance from the camera along its view]
    const pieces = [['pawn', ivory, 0.15, NEAR_F], ['pawn', ivory, -0.85, 3.4], ['bishop', ivory, 0.75, 4.4], ['queen', ebony, -0.7, 5.6], ['pawn', ebony, 0.85, 6.6], ['king', ebony, -0.15, FAR_F], ['bishop', ebony, 1.1, 9.4]];
    for (const [kind, mat, x, d] of pieces) {
      const p = piece(kind, mat);
      const at = home.clone().addScaledVector(fwd, d); // put it at depth d along the view, on the board
      p.position.set(at.x + x, 0, at.z);
      scene.add(p);
    }

    // fairy lights far behind: small bright beads on four sagging strings
    const bead = new THREE.SphereGeometry(0.13, 16, 12);
    const warm = ['#FFB347', '#FFD27F', '#FF8A5C', '#FFE3A8'].map(c => new THREE.Color(c).multiplyScalar(8));
    [[2.9, -15, 22, 0.9], [2.1, -17, 26, 1.1], [1.3, -19, 30, 1.2], [3.6, -20, 30, 1.4]].forEach(([y0, z0, n, sag], row) => {
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1), x = -8.5 + 17 * u;
        const m = new THREE.Mesh(bead, new THREE.MeshBasicMaterial({ color: warm[(i + row) % 4], fog: false }));
        m.position.set(x, y0 - sag * 4 * u * (1 - u), z0 + 1.5 * Math.sin(u * 7 + row));
        scene.add(m);
      }
    });
    renderer.shadowMap.needsUpdate = true;

    // render targets: one lens sample, and the running average (32-bit float, so 128 small adds do not band)
    renderer.getContext().getExtension('EXT_float_blend'); // lets WebGL2 blend into a 32-bit float target
    const opts = { type: THREE.HalfFloatType, depthBuffer: true };
    const one = new THREE.WebGLRenderTarget(W, H, opts), sum = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: { uTex: { value: one.texture }, uWeight: { value: 1 / SAMPLES } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: 'uniform sampler2D uTex; uniform float uWeight; varying vec2 vUv; void main() { gl_FragColor = vec4(texture2D(uTex, vUv).rgb * uWeight, 1.0); }',
      blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false,
    }));
    const show = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: sum.texture }));
    show.material.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', 'gl_Position = vec4(position.xy, 0.0, 1.0);'); };
    const flat = new THREE.Scene(), flatCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    flat.add(quad);
    const out = new THREE.Scene();
    out.add(show);

    const top = 0.1 * Math.tan(FOV / 2 * Math.PI / 180), aspect = W / H, GOLD = Math.PI * (3 - Math.sqrt(5));
    return {
      scene, camera,
      render(t) {
        const F = focusAt(t);
        // the camera drifts a little from side to side (parallax), always aimed at the same point
        eye.copy(home).add(new THREE.Vector3(0.12 * Math.sin(t / 5 * TAU), 0.03 * Math.sin(2 * t / 5 * TAU), 0));
        camera.position.copy(eye);
        camera.lookAt(target);
        camera.updateMatrixWorld();
        right.setFromMatrixColumn(camera.matrixWorld, 0);
        up.setFromMatrixColumn(camera.matrixWorld, 1);
        renderer.setRenderTarget(sum);
        renderer.setClearColor('#000000', 1);
        renderer.clear();
        for (let i = 0; i < SAMPLES; i++) {
          // a point on the aperture (Vogel spiral: even, fixed, no noise) and a sub-pixel jitter for anti-aliasing
          const r = APERTURE * Math.sqrt((i + 0.5) / SAMPLES), a = i * GOLD;
          const dx = r * Math.cos(a), dy = r * Math.sin(a);
          const jx = ((i * 0.7548776662) % 1 - 0.5) * 2 / W, jy = ((i * 0.5698402910) % 1 - 0.5) * 2 / H;
          camera.position.copy(eye).addScaledVector(right, dx).addScaledVector(up, dy);
          // shear the frustum so the plane at distance F lands on the same pixels for every sample
          const sx = -dx * 0.1 / F + jx * top * aspect, sy = -dy * 0.1 / F + jy * top;
          camera.projectionMatrix.makePerspective(-top * aspect + sx, top * aspect + sx, top + sy, -top + sy, 0.1, 80);
          camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
          camera.updateMatrixWorld();
          renderer.setRenderTarget(one);
          renderer.setClearColor(scene.background, 1);
          renderer.render(scene, camera);
          renderer.setRenderTarget(sum);
          renderer.autoClear = false;
          renderer.render(flat, flatCam);
          renderer.autoClear = true;
        }
        renderer.setRenderTarget(null);
        renderer.render(out, flatCam);
      },
    };
  },
  overlay(ctx, t, W, H) {
    // a focus scale: where the focus plane is, between the pawn and the king
    const k = rack(t), x0 = 150, x1 = W - 150, y = 1800, x = lerp(x0, x1, k);
    ctx.fillStyle = 'rgba(12, 9, 16, 0.55)';
    ctx.beginPath(); ctx.roundRect(100, y - 52, W - 200, 124, 30); ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    for (let i = 0; i <= 12; i++) { const xi = lerp(x0, x1, i / 12); ctx.beginPath(); ctx.moveTo(xi, y - (i % 6 ? 8 : 16)); ctx.lineTo(xi, y); ctx.stroke(); }
    ctx.fillStyle = '#FFC46B';
    ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.lineTo(x - 13, y - 36); ctx.lineTo(x + 13, y - 36); ctx.fill();
    ctx.font = `600 28px ${FONT.sans}`; ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.textAlign = 'left'; ctx.fillText('NEAR · 앞', x0, y + 46);
    ctx.textAlign = 'right'; ctx.fillText('FAR · 뒤', x1, y + 46);
    ctx.textAlign = 'center'; ctx.fillStyle = '#FFC46B'; ctx.font = `700 30px ${FONT.sans}`;
    ctx.fillText(`FOCUS ${focusAt(t).toFixed(1)} m · f/1.4`, W / 2, y + 46);
  },
};
