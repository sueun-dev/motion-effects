// Screen-space reflections: a night street is rendered once (colour + depth, at twice the size). A second pass finds
// the wet ground pixels, reflects the view ray off them and marches it through the depth buffer in view space; where
// the ray crosses a surface it takes that pixel's colour. Puddles give sharp reflections, wet asphalt blurred,
// vertically smeared ones (lower mip levels). Rays that leave the screen fade out and rays hidden behind a sign get a
// blur of the sign: the screen holds nothing else, which is the classic SSR limit.
import * as THREE from 'three';
import { TAU, phase, rng, FONT } from '../lib/util.js';

const ROAD = { x0: -3.6, x1: 3.6, z0: 8, z1: -52 }; // the ground area covered by the puddle mask

// puddle mask in world x/z: [x, z, radius across, radius along] in metres, each an uneven blob of ellipses
const PUDDLES = [[-1.2, 1.6, 1.3, 0.9], [1.5, -0.4, 1.0, 1.3], [-0.3, -2.8, 1.6, 1.1], [1.9, -5.2, 0.9, 1.5], [-1.9, -6.8, 1.0, 1.7],
  [0.4, -9.5, 1.5, 1.9], [-1.1, -14, 1.2, 2.3], [1.5, -18, 1.0, 2.1], [-0.4, -24, 1.6, 2.6], [0.9, -31, 1.2, 3.0], [-1.4, -38, 1.0, 2.6]];
function puddles() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 2048;
  const g = c.getContext('2d'), r = rng(164);
  const X = x => (x - ROAD.x0) / (ROAD.x1 - ROAD.x0) * 512, Z = z => (z - ROAD.z0) / (ROAD.z1 - ROAD.z0) * 2048;
  g.fillStyle = '#000'; g.fillRect(0, 0, 512, 2048);
  g.filter = 'blur(6px)'; g.fillStyle = '#FFF';
  for (const [x, z, rx, rz] of PUDDLES) {
    for (let k = 0; k < 4; k++) {
      const ox = (r() - 0.5) * rx, oz = (r() - 0.5) * rz, s = 0.55 + 0.4 * r();
      g.beginPath(); g.ellipse(X(x + ox), Z(z + oz), rx * s * 71, rz * s * 34, (r() - 0.5) * 0.6, 0, TAU); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.flipY = false;
  return t;
}

// a vertical neon sign: glowing letters on a dark panel
function sign(text, color) {
  const c = document.createElement('canvas'); c.width = 200; c.height = 120 + 150 * text.length;
  const g = c.getContext('2d');
  g.fillStyle = '#0B0812'; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = color; g.lineWidth = 8; g.shadowColor = color; g.shadowBlur = 18;
  g.strokeRect(14, 14, c.width - 28, c.height - 28);
  g.font = `800 120px ${FONT.ko}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#FFF';
  [...text].forEach((ch, i) => g.fillText(ch, 100, 135 + i * 150));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return { tex: t, h: c.height / 200 };
}

// a building facade: dark concrete with a grid of windows, some lit
function facade(seed) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512;
  const g = c.getContext('2d'), r = rng(seed);
  g.fillStyle = '#000'; g.fillRect(0, 0, 256, 512);
  for (let y = 24; y < 500; y += 64) for (let x = 20; x < 240; x += 58) {
    if (r() < 0.38) { g.fillStyle = ['#FFB86B', '#FFD9A0', '#9FD8FF'][Math.floor(r() * 3)]; g.globalAlpha = 0.35 + 0.5 * r(); g.fillRect(x, y, 36, 40); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const composite = {
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `
    uniform sampler2D tColor, tDepth, tMask;
    uniform mat4 uProj, uInvProj, uCamWorld, uView;
    uniform vec4 uRoad;
    varying vec2 vUv;
    vec3 viewPos(vec2 uv) {
      vec4 v = uInvProj * vec4(vec3(uv, texture(tDepth, uv).r) * 2.0 - 1.0, 1.0);
      return v.xyz / v.w;
    }
    vec3 aces(vec3 x) { return clamp(x * (2.51 * x + 0.03) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
    void main() {
      vec3 col = textureLod(tColor, vUv, 0.0).rgb;              // the 2x2 average of the big render = antialiasing
      float d = texture(tDepth, vUv).r;
      vec3 P = viewPos(vUv), Pw = (uCamWorld * vec4(P, 1.0)).xyz;
      if (d < 1.0 && abs(Pw.y) < 0.02) {                       // a ground pixel
        float wet = smoothstep(0.3, 0.6, texture(tMask, (Pw.xz - uRoad.xy) / (uRoad.zw - uRoad.xy)).r);
        vec3 N = normalize((uView * vec4(0.0, 1.0, 0.0, 0.0)).xyz), V = normalize(P), R = reflect(V, N);
        float t = 0.0, prev = 0.0, hit = 0.0;
        vec2 huv = vec2(0.0), occ = vec2(-1.0);                // occ: where the ray slipped behind something
        for (int i = 0; i < 200; i++) {                        // march with growing steps through the depth buffer
          float step = 0.02 * pow(1.025, float(i));
          t += step;
          vec3 Q = P + R * t;
          vec4 c = uProj * vec4(Q, 1.0);
          vec2 s = c.xy / c.w * 0.5 + 0.5;
          if (s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0 || -Q.z > 90.0) break;
          float dz = viewPos(s).z - Q.z;
          if (dz > 0.0 && occ.x < 0.0) occ = s;
          if (dz > 0.0 && dz < 0.1 + 1.5 * step) {           // the ray went behind a surface: refine the crossing
            float a = prev, b = t;
            for (int k = 0; k < 7; k++) {
              float m = 0.5 * (a + b); vec3 M = P + R * m; vec4 mc = uProj * vec4(M, 1.0); vec2 ms = mc.xy / mc.w * 0.5 + 0.5;
              if (viewPos(ms).z - M.z > 0.0) { b = m; huv = ms; } else a = m;
            }
            if (huv == vec2(0.0)) huv = s;
            vec3 B = P + R * b;
            if (abs(viewPos(huv).z - B.z) < 0.12 + 0.02 * b) { t = b; hit = 1.0; break; }
            huv = vec2(0.0);                                   // only slipped behind an edge: keep marching
          }
          prev = t;
        }
        float rough = mix(1.0, 0.04, wet);
        vec3 refl = vec3(0.004, 0.006, 0.016);                  // missed rays see the night sky ...
        if (hit == 0.0 && occ.x >= 0.0) refl = textureLod(tColor, occ, 4.0).rgb * 0.6;   // ... or, if hidden, a blur of what hid them
        if (hit > 0.0) {
          float lod = clamp(rough * (3.0 + 0.3 * t), 0.0, 7.0);
          vec3 sum = vec3(0.0);
          for (int k = -3; k <= 3; k++) sum += textureLod(tColor, huv + vec2(0.0, float(k) * rough * 0.012 * (1.0 + 0.08 * t)), lod).rgb;
          vec2 e = min(huv, 1.0 - huv);
          float fade = smoothstep(0.0, 0.07, e.x) * smoothstep(0.0, 0.1, e.y) * (1.0 - smoothstep(30.0, 60.0, t));
          refl = mix(refl, sum / 7.0, fade);
        }
        float cosv = max(dot(-V, N), 0.0);
        float fres = 0.04 + 0.96 * pow(1.0 - cosv, 5.0);
        float k = mix(0.16, 0.95, wet) * mix(0.4, 1.0, fres) * (1.0 - 0.7 * smoothstep(22.0, 42.0, -P.z));
        col = col * (1.0 - 0.6 * wet) + refl * k;
      }
      // a soft neon glow from the blurred mips
      col += max(textureLod(tColor, vUv, 4.5).rgb - 0.05, 0.0) * 0.35 + max(textureLod(tColor, vUv, 6.5).rgb - 0.03, 0.0) * 0.35;
      gl_FragColor = vec4(aces(col * 1.1), 1.0);
      #include <colorspace_fragment>
    }`,
};

export default {
  name: 'Screen-Space Reflections',
  ko: '스크린 스페이스 반사',
  three(renderer, W, H) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color().setRGB(0.004, 0.006, 0.016);
    const camera = new THREE.PerspectiveCamera(52, W / H, 0.1, 120);

    const mask = puddles();
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(ROAD.x1 - ROAD.x0, ROAD.z0 - ROAD.z1), new THREE.MeshStandardMaterial({ color: '#16161C', roughness: 0.55 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, (ROAD.z0 + ROAD.z1) / 2);
    scene.add(ground);
    scene.add(new THREE.HemisphereLight('#4A5AA0', '#120A18', 0.35));

    // buildings on both sides, each with lit windows
    const r = rng(7);
    for (const side of [-1, 1]) {
      let z = 6;
      while (z > -55) {
        const len = 5 + 5 * r(), h = 7 + 12 * r();
        const mat = new THREE.MeshStandardMaterial({ color: '#1A1820', roughness: 0.9, emissive: '#FFFFFF', emissiveMap: facade(Math.floor(r() * 1e6)), emissiveIntensity: 0.9 });
        mat.emissiveMap.repeat.set(len / 4, h / 8); mat.emissiveMap.wrapS = mat.emissiveMap.wrapT = THREE.RepeatWrapping;
        const b = new THREE.Mesh(new THREE.BoxGeometry(6, h, len), mat);
        b.position.set(side * (ROAD.x1 + 3), h / 2, z - len / 2);
        scene.add(b);
        z -= len + 0.4;
      }
    }

    // projecting neon signs, facing down the street
    const NEON = [[-1, -3, '라멘', '#FF3D9A'], [1, -6, '호텔', '#FF9E3D'], [-1, -11, '노래방', '#3DE8FF'], [1, -15, 'PC', '#7DFF6A'],
      [-1, -21, 'BAR', '#B46BFF'], [1, -25, '약국', '#3DFFB0'], [-1, -32, '24시', '#FF5A5A'], [1, -36, '카페', '#FF6AD5']];
    NEON.forEach(([side, z, text, color], i) => {
      const s = sign(text, color), hh = s.h * 0.85;
      const face = new THREE.MeshBasicMaterial({ map: s.tex, color: new THREE.Color(color).lerp(new THREE.Color('#FFFFFF'), 0.5).multiplyScalar(3.2) });
      const edge = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6) });   // glowing sides
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.85, hh, 0.3), [edge, edge, edge, edge, face, face]);
      m.position.set(side * (ROAD.x1 - 0.45), 3.2 + hh / 2 + (i % 3) * 0.6, z);
      scene.add(m);
    });
    // a building closing the end of the street, with a wide sign
    const endMat = new THREE.MeshStandardMaterial({ color: '#1A1820', roughness: 0.9, emissive: '#FFFFFF', emissiveMap: facade(99), emissiveIntensity: 0.9 });
    endMat.emissiveMap.repeat.set(4, 2.5); endMat.emissiveMap.wrapS = endMat.emissiveMap.wrapT = THREE.RepeatWrapping;
    const end = new THREE.Mesh(new THREE.BoxGeometry(16, 20, 2), endMat);
    end.position.set(0, 10, -47);
    scene.add(end);
    const wide = document.createElement('canvas'); wide.width = 1024; wide.height = 256;
    const wg = wide.getContext('2d');
    wg.fillStyle = '#0B0812'; wg.fillRect(0, 0, 1024, 256);
    wg.strokeStyle = '#FF3D9A'; wg.lineWidth = 14; wg.shadowColor = '#FF3D9A'; wg.shadowBlur = 24; wg.strokeRect(20, 20, 984, 216);
    wg.font = `800 150px ${FONT.ko}`; wg.textAlign = 'center'; wg.textBaseline = 'middle'; wg.fillStyle = '#FFF'; wg.fillText('OPEN 24', 512, 134);
    const wtex = new THREE.CanvasTexture(wide); wtex.colorSpace = THREE.SRGBColorSpace;
    const big = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.3, 0.3), new THREE.MeshBasicMaterial({ map: wtex, color: new THREE.Color('#FFC0DD').multiplyScalar(3.2) }));
    big.position.set(0, 5.2, -45.8);
    scene.add(big);

    // street lamps with warm pools of light
    for (const [x, z] of [[-3.3, -2], [3.3, -12], [-3.3, -22], [3.3, -32]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.4, 16), new THREE.MeshStandardMaterial({ color: '#2A2A33', roughness: 0.6 }));
      pole.position.set(x, 2.2, z);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFD08A').multiplyScalar(4) }));
      bulb.position.set(x * 0.85, 4.4, z);
      const light = new THREE.PointLight('#FFC27A', 14, 14, 1.6);
      light.position.copy(bulb.position);
      scene.add(pole, bulb, light);
    }

    // colour + depth at 2x, with mipmaps for the blurred reflections and glow
    const rt = new THREE.WebGLRenderTarget(W * 2, H * 2, {
      type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, depthTexture: new THREE.DepthTexture(W * 2, H * 2),
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      ...composite,
      uniforms: {
        tColor: { value: rt.texture }, tDepth: { value: rt.depthTexture }, tMask: { value: mask },
        uProj: { value: camera.projectionMatrix }, uInvProj: { value: camera.projectionMatrixInverse },
        uCamWorld: { value: camera.matrixWorld }, uView: { value: camera.matrixWorldInverse },
        uRoad: { value: new THREE.Vector4(ROAD.x0, ROAD.z0, ROAD.x1, ROAD.z1) },
      },
    }));
    quad.frustumCulled = false;
    const post = new THREE.Scene(); post.add(quad);
    const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    return {
      scene, camera,
      update(t) {
        const a = phase(t) * TAU;
        const k = 0.5 - 0.5 * Math.cos(a);                     // dolly in and back out
        camera.position.set(0.5 * Math.sin(a), 1.5, 6 - 3.5 * k);
        camera.lookAt(0.2 * Math.sin(a), 1.25, -30);
      },
      render() {
        renderer.setRenderTarget(rt);
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);
        renderer.render(post, postCam);
      },
    };
  },
};
