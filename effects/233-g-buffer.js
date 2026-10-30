// G-buffer and deferred shading: the scene is drawn once into three render targets at the same time (multiple render
// targets): albedo, view-space normal and view-space position (depth). A full-screen pass then lights every pixel
// from those buffers alone, with eight coloured point lights orbiting the turntable. Top: the three buffers.
// Bottom: the lit result. The G-buffer is drawn at twice the size and shaded 2 x 2 per pixel, so edges stay smooth.
import * as THREE from 'three';
import { TAU, phase, FONT } from '../lib/util.js';

const GAP = 20, TOP = 300, TW = (1080 - 4 * GAP) / 3, FY = 700, FH = 1180, TH = TW * FH / 1080; // layout (px)
const SS = 2, NL = 8;                                                                          // supersampling, lights
const LIGHT_COLORS = [0xFF4D6D, 0xFFB627, 0x3DDC97, 0x4D9DFF, 0xB15CFF, 0xFF7B3D, 0x2EE6E6, 0xFF5CC8].map(c => new THREE.Color(c));

const quadVert = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

export default {
  name: 'G-Buffer',
  ko: 'G-버퍼',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1080 / FH, 0.5, 40);
    camera.position.set(0, 5.6, 9.6);
    camera.lookAt(0, 0.55, 0);
    camera.updateMatrixWorld();

    // geometry pass: one material writes all three buffers
    const gbuf = new THREE.WebGLRenderTarget(1080 * SS, FH * SS, { count: 3, type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    const gmat = (color, checker = 0) => new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: { uColor: { value: new THREE.Color(color) }, uChecker: { value: checker } },
      vertexShader: `
        varying vec3 vN; varying vec3 vP; varying vec3 vW;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vP = mv.xyz; vN = normalize(normalMatrix * normal); vW = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        layout(location = 0) out vec4 gAlbedo;
        layout(location = 1) out vec4 gNormal;
        layout(location = 2) out vec4 gPosition;
        uniform vec3 uColor; uniform float uChecker;
        varying vec3 vN; varying vec3 vP; varying vec3 vW;
        void main() {
          vec3 albedo = uColor;
          if (uChecker > 0.5) {                       // turntable rings and spokes, filtered so they never alias
            float r = length(vW.xz), a = atan(vW.z, vW.x);
            vec2 q = vec2(r * 2.0, a * 8.0 / 3.14159265);
            vec2 w = fwidth(q) + 1e-4;
            vec2 s = smoothstep(-w, w, sin(q * 3.14159265) * 0.5) * 2.0 - 1.0;
            albedo = mix(vec3(0.62, 0.6, 0.58), vec3(0.34, 0.33, 0.33), 0.5 - 0.5 * s.x * s.y);
          }
          gAlbedo = vec4(albedo, 1.0);
          gNormal = vec4(normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0), 1.0);
          gPosition = vec4(vP, 1.0);
        }`,
    });
    const table = new THREE.Group();
    const add = (geo, color, pos, checker) => { const m = new THREE.Mesh(geo, gmat(color, checker)); m.position.set(...pos); table.add(m); return m; };
    add(new THREE.CylinderGeometry(3.1, 3.1, 0.3, 128), '#FFFFFF', [0, -0.15, 0], 1);
    add(new THREE.TorusKnotGeometry(0.62, 0.22, 220, 32), '#FF7A59', [0, 1.25, 0]);
    add(new THREE.SphereGeometry(0.62, 64, 32), '#F4F1EA', [-1.75, 0.62, 0.6]);
    add(new THREE.IcosahedronGeometry(0.7, 0), '#2EC4B6', [1.7, 0.62, 0.7]);
    add(new THREE.BoxGeometry(0.85, 0.85, 0.85), '#FFC93C', [0.9, 0.43, -1.6]).rotation.y = 0.5;
    add(new THREE.CylinderGeometry(0.4, 0.4, 1.4, 64), '#5B7CFA', [-1.1, 0.7, -1.5]);
    add(new THREE.ConeGeometry(0.5, 1.1, 64), '#C77DFF', [0.2, 0.55, 1.9]);
    scene.add(table);

    // lighting pass: reads the buffers, adds a dim key light, eight point lights and a glow where each light is
    const lightsV = Array.from({ length: NL }, () => new THREE.Vector3());
    const light = new THREE.ShaderMaterial({
      uniforms: {
        tA: { value: gbuf.textures[0] }, tN: { value: gbuf.textures[1] }, tP: { value: gbuf.textures[2] },
        uL: { value: lightsV }, uC: { value: LIGHT_COLORS }, uProj: { value: camera.projectionMatrix }, uKey: { value: new THREE.Vector3() },
      },
      vertexShader: quadVert,
      fragmentShader: `
        uniform sampler2D tA, tN, tP; uniform vec3 uL[${NL}]; uniform vec3 uC[${NL}]; uniform mat4 uProj; uniform vec3 uKey;
        varying vec2 vUv;
        vec3 shade(ivec2 px) {
          vec4 P = texelFetch(tP, px, 0);
          if (P.w < 0.5) return mix(vec3(0.006, 0.006, 0.012), vec3(0.025, 0.02, 0.04), vUv.y);
          vec3 A = texelFetch(tA, px, 0).rgb, N = normalize(texelFetch(tN, px, 0).xyz), V = normalize(-P.xyz);
          vec3 c = A * (0.025 + 0.02 * N.y) + A * 0.09 * max(dot(N, uKey), 0.0);
          for (int i = 0; i < ${NL}; i++) {
            vec3 L = uL[i] - P.xyz; float d = length(L); L /= d;
            float att = pow(clamp(1.0 - pow(d / 3.4, 4.0), 0.0, 1.0), 2.0) / (0.3 + d * d);
            float spec = pow(max(dot(N, normalize(L + V)), 0.0), 60.0);
            c += uC[i] * att * 3.2 * (A * max(dot(N, L), 0.0) + 0.4 * spec);
          }
          return c;
        }
        void main() {
          ivec2 base = ivec2(gl_FragCoord.xy - vec2(0.0, ${H - FY - FH}.0)) * ${SS};
          vec3 c = vec3(0.0);
          for (int y = 0; y < ${SS}; y++) for (int x = 0; x < ${SS}; x++) c += shade(base + ivec2(x, y));
          c /= ${SS * SS}.0;
          float z = texelFetch(tP, ivec2(vUv * vec2(${1080 * SS}.0, ${FH * SS}.0)), 0).z;
          for (int i = 0; i < ${NL}; i++) {             // the lights themselves, hidden behind geometry
            vec4 q = uProj * vec4(uL[i], 1.0);
            vec2 s = (q.xy / q.w * 0.5 + 0.5) * vec2(1080.0, ${FH}.0);
            float r = length(gl_FragCoord.xy - vec2(0.0, ${H - FY - FH}.0) - s);
            float seen = (z < uL[i].z - 0.05 || texelFetch(tP, ivec2(vUv * vec2(${1080 * SS}.0, ${FH * SS}.0)), 0).w < 0.5) ? 1.0 : 0.0;
            c += seen * (vec3(1.0) * exp(-r * r / 40.0) * 2.0 + uC[i] * (exp(-r * r / 160.0) * 1.5 + exp(-r * r / 1600.0) * 0.2));
          }
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });

    // the three buffer views: albedo as colour, normal as rgb = n * 0.5 + 0.5, depth as a near-white / far-black ramp
    const view = new THREE.ShaderMaterial({
      toneMapped: false,
      uniforms: { tA: { value: gbuf.textures[0] }, tN: { value: gbuf.textures[1] }, tP: { value: gbuf.textures[2] }, uMode: { value: 0 } },
      vertexShader: quadVert,
      fragmentShader: `
        uniform sampler2D tA, tN, tP; uniform int uMode; varying vec2 vUv;
        vec3 one(ivec2 px) {
          vec4 P = texelFetch(tP, px, 0);
          if (P.w < 0.5) return uMode == 1 ? vec3(0.0) : vec3(0.025, 0.025, 0.035);
          if (uMode == 0) return texelFetch(tA, px, 0).rgb;
          if (uMode == 1) return pow(texelFetch(tN, px, 0).xyz * 0.5 + 0.5, vec3(2.2));
          return vec3(pow(clamp((14.0 + P.z) / 9.0, 0.0, 1.0), 2.2));
        }
        void main() {
          vec2 size = vec2(${1080 * SS}.0, ${FH * SS}.0);
          ivec2 p0 = ivec2(vUv * size);
          vec3 c = vec3(0.0);                           // a 6 x 6 box filter for the small view
          for (int y = -3; y < 3; y++) for (int x = -3; x < 3; x++) c += one(clamp(p0 + ivec2(x, y), ivec2(0), ivec2(size) - 1));
          gl_FragColor = vec4(c / 36.0, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), light), post = new THREE.Scene(), flat = new THREE.Camera();
    post.add(quad);

    renderer.autoClear = false;
    const key = new THREE.Vector3();
    return {
      render(t) {
        const a = phase(t) * TAU;
        table.rotation.y = 0.45 * Math.sin(a);
        lightsV.forEach((v, k) => {                    // orbit in world space, then into view space for the shader
          const b = a * (k % 2 ? -1 : 1) + k * TAU / NL;
          v.set((2.1 + 0.6 * Math.sin(2 * a + k)) * Math.cos(b), 0.45 + 0.3 * (k % 3) + 0.2 * Math.sin(a + k), (2.1 + 0.6 * Math.sin(2 * a + k)) * Math.sin(b));
          v.applyMatrix4(camera.matrixWorldInverse);
        });
        light.uniforms.uKey.value.copy(key.set(-0.5, 1, 0.6).normalize().transformDirection(camera.matrixWorldInverse));

        renderer.setScissorTest(false);
        renderer.setRenderTarget(gbuf); renderer.setClearColor(0x000000, 0); renderer.clear();
        renderer.render(scene, camera);
        renderer.setRenderTarget(null); renderer.setClearColor('#0A0A10', 1); renderer.clear();
        renderer.setScissorTest(true);
        const region = (x, y, w, h) => { renderer.setViewport(x, H - y - h, w, h); renderer.setScissor(x, H - y - h, w, h); };
        quad.material = light; region(0, FY, 1080, FH); renderer.render(post, flat);
        quad.material = view;
        for (let m = 0; m < 3; m++) { view.uniforms.uMode.value = m; region(GAP + m * (TW + GAP), TOP, TW, TH); renderer.render(post, flat); }
        renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H);
      },
    };
  },
  overlay(ctx, t, W, H) {
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ['ALBEDO', 'NORMAL', 'DEPTH'].forEach((s, m) => {
      const x = GAP + m * (TW + GAP);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, TOP + 1, TW - 2, TH - 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'; ctx.fillRect(x + 1, TOP + TH - 46, TW - 2, 45);
      ctx.fillStyle = '#FFFFFF'; ctx.font = `700 26px ${FONT.sans}`; ctx.fillText(s, x + 16, TOP + TH - 15);
    });
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'; ctx.beginPath(); ctx.roundRect(24, FY + 24, 420, 56, 16); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.font = `700 28px ${FONT.sans}`;
    ctx.fillText('LIGHTING PASS · 8 LIGHTS', 42, FY + 62);
  },
};
