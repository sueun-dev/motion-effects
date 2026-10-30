// Flat, Gouraud and Phong shading: one low-poly torus (24 x 12 segments) drawn three times with the same Blinn-Phong
// lighting, evaluated once per face, once per vertex (and blended across the triangle), or once per pixel.
// One light circles in front; the Gouraud highlight jumps from vertex to vertex while the Phong one glides.
import * as THREE from 'three';
import { TAU, phase, FONT } from '../lib/util.js';

const ROW = 540, TOP = 300; // three rows of 1080 x 540 below the label
const LIGHT = `
uniform vec3 uL;      // direction to the light, view space
uniform vec3 uColor;
vec3 shade(vec3 n, vec3 v) {
  float d = max(dot(n, uL), 0.0);
  float s = pow(max(dot(n, normalize(uL + v)), 0.0), 70.0) * step(0.0, dot(n, uL));
  return uColor * (0.16 + 0.9 * d) + vec3(1.0, 0.97, 0.9) * s * 0.95;
}
vec4 outC(vec3 c) { return vec4(pow(c, vec3(1.0 / 2.2)), 1.0); }`;

function material(kind, uniforms) {
  const vary = 'varying vec3 vN; varying vec3 vP; varying vec3 vC;';
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `${LIGHT} ${vary}
      void main() {
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vP = p.xyz;
        vC = shade(vN, normalize(-p.xyz));            // Gouraud: light the vertex, let the triangle blend the colours
        gl_Position = projectionMatrix * p;
      }`,
    fragmentShader: `${LIGHT} ${vary}
      void main() {
        ${kind === 'flat' ? 'vec3 n = normalize(cross(dFdx(vP), dFdy(vP))); gl_FragColor = outC(shade(n, normalize(-vP)));' : ''}
        ${kind === 'gouraud' ? 'gl_FragColor = outC(vC);' : ''}
        ${kind === 'phong' ? 'gl_FragColor = outC(shade(normalize(vN), normalize(-vP)));' : ''}
      }`,
  });
}

export default {
  name: 'Flat, Gouraud & Phong',
  ko: '플랫·고러드·퐁 셰이딩',
  three(renderer, W, H) {
    renderer.autoClear = false;
    // backdrop: a deep navy frame with three rounded cards, one per shading model
    const bg = document.createElement('canvas'); bg.width = W; bg.height = H;
    const b = bg.getContext('2d');
    const grd = b.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#0E1020'); grd.addColorStop(1, '#090A14');
    b.fillStyle = grd; b.fillRect(0, 0, W, H);
    for (let i = 0; i < 3; i++) {
      const g = b.createLinearGradient(0, TOP + i * ROW, 0, TOP + (i + 1) * ROW);
      g.addColorStop(0, '#1C2140'); g.addColorStop(1, '#12152B');
      b.fillStyle = g; b.beginPath(); b.roundRect(36, TOP + i * ROW + 14, W - 72, ROW - 28, 36); b.fill();
    }
    const bgTex = new THREE.CanvasTexture(bg); bgTex.colorSpace = THREE.SRGBColorSpace;
    const bgScene = new THREE.Scene(), bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: bgTex })));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, W / ROW, 0.1, 50);
    camera.position.set(0, 0, 8.2);
    const uniforms = { uL: { value: new THREE.Vector3() }, uColor: { value: new THREE.Color('#FF6A55') } };
    const mats = ['flat', 'gouraud', 'phong'].map(k => material(k, uniforms));
    const torus = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.55, 12, 24), mats[0]);
    const tilt = new THREE.Group(); // tipped back towards the camera; the torus spins about its own axis inside it
    tilt.position.x = 1.1;
    tilt.add(torus);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 16), new THREE.MeshBasicMaterial({ color: '#FFF3D6' }));
    const halo = new THREE.Mesh(new THREE.CircleGeometry(0.3, 48), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vU; void main() { vU = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec2 vU; void main() { float r = length(vU); gl_FragColor = vec4(vec3(1.0, 0.85, 0.55) * pow(max(1.0 - r, 0.0), 3.0) * 0.6, 1.0); }',
    }));
    bulb.add(halo);
    scene.add(tilt, bulb);

    return {
      scene, camera,
      render(t) {
        const a = phase(t) * TAU;
        tilt.rotation.set(-0.75 + 0.12 * Math.sin(a), 0.3 * Math.sin(a), 0.25);
        torus.rotation.z = a;
        bulb.position.set(1.1 + 1.6 * Math.cos(-a), 1.1 * Math.sin(-a), 2.0); // circles in front of the torus
        uniforms.uL.value.copy(bulb.position).sub(tilt.position).normalize();    // camera does not turn: view = world
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, W, H);
        renderer.clear();
        renderer.render(bgScene, bgCam);
        renderer.setScissorTest(true);
        mats.forEach((m, i) => {
          const y = H - TOP - (i + 1) * ROW; // WebGL counts rows from the bottom
          renderer.setViewport(0, y, W, ROW); renderer.setScissor(0, y, W, ROW);
          torus.material = m;
          renderer.clearDepth();
          renderer.render(scene, camera);
        });
      },
    };
  },
  overlay(ctx, t, W, H) {
    const rows = [['FLAT', 'one colour per face', '플랫 · 면마다 한 번'], ['GOURAUD', 'lit per vertex, blended', '고러드 · 꼭짓점마다'], ['PHONG', 'lit per pixel', '퐁 · 픽셀마다']];
    rows.forEach(([title, en, ko], i) => {
      const y = TOP + i * ROW;
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      ctx.fillStyle = '#FFFFFF'; ctx.font = `800 44px ${FONT.sans}`;
      ctx.fillText(title, 84, y + 104);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.62)'; ctx.font = `500 27px ${FONT.sans}`;
      ctx.fillText(en, 84, y + 146);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)'; ctx.font = `500 25px ${FONT.ko}`;
      ctx.fillText(ko, 84, y + 182);
    });
  },
};
