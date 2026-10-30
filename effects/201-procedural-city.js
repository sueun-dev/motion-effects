// Procedural city: a street grid split into lots, each lot filled by a seeded rule (one, two or four buildings,
// taller towards downtown, some with a stepped top), all one instanced box mesh. At dusk the empty grid glows like a
// plan; a wave sweeps out from the centre and the buildings rise out of it, then sink back as the camera glides
// round. Windows are a facade pattern in the shader, lit by a hash per window and filtered by their pixel footprint,
// so far facades never shimmer.
import * as THREE from 'three';
import { rng } from '../lib/util.js';

const BLOCK = 7, ROAD = 1.6, R = 6;         // a block is 7 units including its road; blocks -6..6 each way

function layout() {
  const r = rng(201), list = [];              // [x, z, width, depth, height, seed]
  for (let bz = -R; bz <= R; bz++) for (let bx = -R; bx <= R; bx++) {
    if (bx * bx + bz * bz > (R + 0.5) ** 2) continue;                          // a round city
    const x0 = (bx - 0.5) * BLOCK + ROAD / 2, z0 = (bz + 0.5) * BLOCK - ROAD / 2, size = BLOCK - ROAD;
    const downtown = Math.exp(-(bx * bx + bz * bz) / 9);
    // a lot of one, two or four buildings: [u, v, width, depth] as parts of the lot
    const whole = [[0, 0, 1, 1]], halves = [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]];
    const quarters = [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]];
    const cells = r() >= 0.55 ? whole : r() < 0.5 ? halves : quarters;
    for (const [u, v, su, sv] of cells) {
      const inset = 0.25 + 0.3 * r();
      const w = su * size - inset * 2, d = sv * size - inset * 2;
      const x = x0 + (u + su / 2) * size, z = z0 - (v + sv / 2) * size;
      const h = 1.2 + r() * 3 + downtown * (6 + 20 * r() * r());
      const seed = r();
      list.push([x, z, w, d, h, seed]);
      if (h > 10 && r() < 0.6) list.push([x, z, w * 0.66, d * 0.66, h * (1.18 + 0.2 * r()), seed]);   // a stepped top
    }
  }
  return list;
}

export default {
  name: 'Procedural City',
  ko: '절차적 도시',
  three(renderer, W, H) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(44, W / H, 0.5, 2000);
    const uni = { uTime: { value: 0 } };
    const SKY = `
      vec3 sky(vec3 d) {
        float y = clamp(d.y, 0.0, 1.0);
        vec3 c = mix(vec3(0.98, 0.58, 0.42), vec3(0.45, 0.33, 0.58), smoothstep(0.0, 0.16, y));
        c = mix(c, vec3(0.08, 0.11, 0.28), smoothstep(0.12, 0.5, y));
        c += vec3(1.0, 0.45, 0.25) * 0.35 * pow(max(dot(normalize(d.xz), vec2(0.0, -1.0)), 0.0), 8.0) * (1.0 - smoothstep(0.0, 0.25, y));
        float sd = dot(d, normalize(vec3(-0.45, 0.018, -1.0)));                 // the glow of the setting sun
        return c + vec3(1.0, 0.75, 0.45) * 0.25 * pow(max(sd, 0.0), 300.0);
      }
      vec3 sun(vec3 d) { return vec3(1.0, 0.75, 0.45) * 0.9 * smoothstep(0.99955, 0.99975, dot(d, normalize(vec3(-0.45, 0.018, -1.0)))); }
      vec3 haze(vec3 col, vec3 w) {
        vec3 v = w - cameraPosition;
        float f = 1.0 - exp(-pow(length(v) / 260.0, 1.8));
        return mix(col, sky(normalize(vec3(v.x, 0.03, v.z))), f);
      }
      // how much a building at distance rho from the centre has risen: a wave goes out over 0.25-2.95 s
      // (with a small overshoot), and back in over 3.7-4.8 s; 0 = still a flat lot on the plan
      uniform float uTime;
      float risen(float rho, float seed) {
        float up = clamp((uTime - 0.25 - rho / 48.0 * 1.6 - 0.2 * seed) / 0.9, 0.0, 1.0);
        float down = clamp((uTime - 4.3 + rho / 48.0 * 0.6) / 0.5, 0.0, 1.0);
        up = 1.0 + 2.2 * pow(up - 1.0, 3.0) + 1.2 * pow(up - 1.0, 2.0);       // ease out with a little overshoot
        return up * (1.0 - down * down * (3.0 - 2.0 * down));
      }
      // a pulse train (1 inside [0.5 - duty/2, 0.5 + duty/2] of each cell), box-filtered over the pixel's footprint w
      float pulse(float x, float duty, float w) {
        float a = 0.5 - duty / 2.0;
        w = max(w, 1e-4);
        float x0 = x - w / 2.0, x1 = x + w / 2.0;
        float F1 = floor(x1) * duty + clamp(fract(x1) - a, 0.0, duty), F0 = floor(x0) * duty + clamp(fract(x0) - a, 0.0, duty);
        return (F1 - F0) / w;
      }`;

    const list = layout();
    const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const n = list.length;
    const city = new THREE.InstancedMesh(box, new THREE.ShaderMaterial({
      uniforms: uni,
      vertexShader: SKY + `
        attribute vec4 info;          // height, seed, distance from the centre, unused
        varying vec3 vW, vL, vN; varying float vSeed;
        void main() {
          float rise = risen(info.z, info.y);
          vec4 w = instanceMatrix * vec4(position.x, position.y * rise, position.z, 1.0);   // extruded up from its lot
          vL = w.xyz - instanceMatrix[3].xyz;              // windows stay put; the roof climbs past them
          vW = w.xyz; vN = normal; vSeed = info.y;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: SKY + `
        varying vec3 vW, vL, vN; varying float vSeed;
        float hash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
        void main() {
          vec3 n = normalize(vN);
          vec3 wall = mix(vec3(0.10, 0.11, 0.16), vec3(0.20, 0.17, 0.18), vSeed);
          vec3 col;
          if (n.y > 0.5) col = wall * 0.7;                  // roof
          else {
            float u = abs(n.x) > 0.5 ? vL.z : vL.x;
            float cw = 0.44 + 0.14 * fract(vSeed * 7.0), ch = 0.5;        // window spacing
            vec2 g = vec2(u / cw, vL.y / ch), fw = 1.5 * fwidth(g);
            float win = pulse(g.x, 0.6, fw.x) * pulse(g.y, 0.55, fw.y);
            float lit = step(0.45 + 0.35 * fract(vSeed * 13.0), hash(vec3(floor(g), vSeed * 100.0)));
            lit = mix(lit, 0.35, smoothstep(0.2, 0.6, max(fw.x, fw.y)));  // far away: the average, never sparkles
            vec3 warm = mix(vec3(1.0, 0.72, 0.40), vec3(0.70, 0.85, 1.0), step(0.75, fract(vSeed * 3.7)));
            vec3 glass = sky(reflect(normalize(vW - cameraPosition), n)) * 0.35;
            col = wall * (0.7 + 0.5 * max(dot(n, normalize(vec3(0.3, 0.4, -1.0))), 0.0));   // lit from the bright west
            col = mix(col, mix(glass, warm * 1.4, lit), win);
          }
          gl_FragColor = vec4(haze(col, vW), 1.0);
        }`,
    }), n);
    const info = new Float32Array(n * 4), m = new THREE.Matrix4();
    list.forEach(([x, z, w, d, h, seed], i) => {
      city.setMatrixAt(i, m.makeScale(w, h, d).setPosition(x, 0, z));
      info.set([h, seed, Math.hypot(x, z), 0], i * 4);
    });
    box.setAttribute('info', new THREE.InstancedBufferAttribute(info, 4));
    city.frustumCulled = false;
    scene.add(city);

    // the ground: dark lots and warm streets where the city stands; elsewhere the street grid glows like a plan
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
      uniforms: uni,
      vertexShader: 'varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: SKY + `
        varying vec3 vW;
        void main() {
          vec2 g = vW.xz / ${BLOCK.toFixed(1)}, fw = fwidth(g);
          float duty = ${(ROAD / BLOCK).toFixed(4)};
          // streets are the bands around every multiple of the block size
          float sx = pulse(g.x + 0.5, duty, fw.x), sz = pulse(g.y + 0.5, duty, fw.y);
          float street = max(sx, sz);
          float rho = length(vW.xz);
          float plan = 1.0 - clamp(risen(rho, 0.5), 0.0, 1.0) * (1.0 - smoothstep(46.0, 52.0, rho));
          vec3 col = mix(vec3(0.05, 0.05, 0.08), vec3(0.42, 0.26, 0.14), street);
          float edge = max(pulse(g.x + 0.5, 0.04, fw.x), pulse(g.y + 0.5, 0.04, fw.y)) * (1.0 - smoothstep(0.08, 0.3, max(fw.x, fw.y)));   // fades before it gets finer than a pixel
          col = mix(col, vec3(0.05, 0.10, 0.18) + vec3(0.25, 0.75, 1.0) * edge * 1.4, plan);
          gl_FragColor = vec4(haze(col, vW), 1.0);
        }`,
    }));
    scene.add(ground);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, uniforms: uni,
      vertexShader: 'varying vec3 vD; void main() { vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: SKY + 'varying vec3 vD; void main() { vec3 d = normalize(vD); gl_FragColor = vec4(sky(d) + sun(d), 1.0); }',
    }));
    scene.add(dome);

    const place = t => {
      const a = 0.35 + 0.045 * Math.sin(t / 5 * Math.PI * 2);  // the camera glides 2.5 degrees each way round the city
      uni.uTime.value = t;
      camera.position.set(84 * Math.sin(a), 31 - 2 * Math.cos(t / 5 * Math.PI * 2), 84 * Math.cos(a));
      camera.lookAt(0, 8, -6);
      dome.position.copy(camera.position);
    };

    // motion blur: 8 renders spread over each frame's 1/30 s, averaged in a float target
    const N = 8;
    const one = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
    const sum = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: { tex: { value: null }, k: { value: 1 } }, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: 'uniform sampler2D tex; uniform float k; varying vec2 vUv; void main() { gl_FragColor = vec4(texture2D(tex, vUv).rgb * k, 1.0); }',
    }));
    const flat = new THREE.Scene(), flatCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    flat.add(quad);
    renderer.autoClear = false;
    return {
      scene, camera,
      render(t) {
        renderer.setRenderTarget(sum); renderer.clear();
        quad.material.blending = THREE.AdditiveBlending; quad.material.uniforms.k.value = 1 / N;
        quad.material.uniforms.tex.value = one.texture;
        for (let i = 0; i < N; i++) {
          place(t + (i + 0.5) / N / 30);
          renderer.setRenderTarget(one); renderer.clear(); renderer.render(scene, camera);
          renderer.setRenderTarget(sum); renderer.render(flat, flatCam);
        }
        quad.material.blending = THREE.NoBlending; quad.material.uniforms.k.value = 1;
        quad.material.uniforms.tex.value = sum.texture;
        renderer.setRenderTarget(null); renderer.clear(); renderer.render(flat, flatCam);
      },
    };
  },
};
