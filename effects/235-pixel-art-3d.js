// 3D pixel art: a floating-island diorama rendered at 182 x 322 and blown up 6x with nearest sampling. Outlines come
// from the low-res depth (silhouette pixels darkened) and normals (convex edges lightened). The orthographic camera is
// snapped to whole texels in its own plane and the leftover fraction is applied as a smooth offset when upscaling,
// so the world never crawls while the view glides; the boat snaps the same way, the windmill turns in 32 steps.
import * as THREE from 'three';
import { TAU, phase } from '../lib/util.js';

const PX = 6, LW = 180 + 2, LH = 320 + 2;   // texel size on screen; low-res size with a 1-texel margin all round
const TEX = 0.075;                          // world units per texel

export default {
  name: '3D Pixel Art',
  ko: '3D 픽셀 아트',
  three(renderer, W, H) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.BasicShadowMap;          // hard shadows: crisp pixel edges
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-LW * TEX / 2, LW * TEX / 2, LH * TEX / 2, -LH * TEX / 2, 0.1, 120);
    const dir = new THREE.Vector3(1, 0.95, 1).normalize();
    camera.position.copy(dir).multiplyScalar(60); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    const R = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), U = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const snap = (p, out) => {                                // move a point to the nearest texel in the camera plane
      const r = p.dot(R), u = p.dot(U);
      return out.copy(p).addScaledVector(R, Math.round(r / TEX) * TEX - r).addScaledVector(U, Math.round(u / TEX) * TEX - u);
    };

    scene.add(new THREE.HemisphereLight('#CFE8FF', '#6B5A4A', 1.4));
    const sun = new THREE.DirectionalLight('#FFF0D6', 2.6);
    sun.position.set(-6, 12, 4); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.002;
    Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
    scene.add(sun);

    const mat = c => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
    const box = (w, h, d, c, x, y, z, parent = scene) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y, z);
      m.castShadow = m.receiveShadow = true; parent.add(m); return m;
    };
    const put = (geo, c, x, y, z, parent = scene) => {
      const m = new THREE.Mesh(geo, mat(c)); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
    };

    // the island: grass top, dirt layers tapering into a rocky point
    put(new THREE.CylinderGeometry(6, 6, 0.8, 9), '#6DBE45', 0, -0.4, 0).rotation.y = 0.2;
    put(new THREE.CylinderGeometry(6, 4.6, 1.6, 9), '#9B6B43', 0, -1.6, 0).rotation.y = 0.2;
    put(new THREE.CylinderGeometry(4.6, 0.6, 5.5, 9), '#7A5235', 0, -5.15, 0).rotation.y = 0.55;
    put(new THREE.CylinderGeometry(2.4, 2.4, 0.12, 20), '#3E8EDE', 1.8, 0.04, 2.0);       // the pond
    // the cottage
    box(2.2, 1.6, 1.8, '#F2E3C6', -2.3, 0.8, -1.2);
    const roof = put(new THREE.CylinderGeometry(1.35, 1.35, 2.5, 3), '#D9534F', -2.3, 2.05, -1.2);
    roof.rotation.set(0, 0, Math.PI / 2); roof.scale.set(1, 1, 0.82);
    box(0.42, 1.5, 0.42, '#8C8C96', -1.6, 3.0, -1.6);
    box(0.55, 0.9, 0.08, '#6B4226', -1.9, 0.45, -0.28);
    box(0.5, 0.5, 0.08, '#7FD3FF', -2.85, 1.0, -0.28);
    // the windmill
    put(new THREE.CylinderGeometry(0.55, 0.85, 3.6, 8), '#F5F5F0', 2.6, 1.8, -2.4);
    put(new THREE.ConeGeometry(0.8, 0.9, 8), '#3F6FB5', 2.6, 4.05, -2.4);
    const hub = new THREE.Group(); hub.position.set(3.1, 3.35, -1.9); hub.lookAt(6, 3.35, 1); scene.add(hub);
    for (let k = 0; k < 4; k++) {
      const arm = new THREE.Group(); arm.rotation.z = k * Math.PI / 2; hub.add(arm);
      box(0.12, 1.9, 0.06, '#8A5A3B', 0, 1.05, 0.05, arm);
      box(0.5, 1.4, 0.04, '#FFFFFF', 0.28, 1.25, 0.08, arm);
    }
    // trees, rocks, a path of stones
    [[-4.2, 1.8], [-3.9, -3.4], [0.2, -4.6], [4.6, -0.6], [-0.8, 4.4]].forEach(([x, z], k) => {
      box(0.3, 0.8, 0.3, '#6B4226', x, 0.4, z);
      put(new THREE.ConeGeometry(0.95, 1.6, 6), k % 2 ? '#2F8F4E' : '#3FA35A', x, 1.5, z);
      put(new THREE.ConeGeometry(0.7, 1.2, 6), k % 2 ? '#2F8F4E' : '#3FA35A', x, 2.3, z);
    });
    put(new THREE.IcosahedronGeometry(0.9, 0), '#4FAE48', -0.6, 1.4, -3.2);
    box(0.3, 0.7, 0.3, '#6B4226', -0.6, 0.35, -3.2);
    [[4.4, 2.6, 0.5], [-4.6, -0.6, 0.4], [3.8, 4.0, 0.35]].forEach(([x, z, s]) => put(new THREE.DodecahedronGeometry(s, 0), '#A7A9AC', x, s * 0.6, z));
    [[-1.4, 0.4], [-0.6, 1.0], [0.1, 1.6]].forEach(([x, z]) => box(0.55, 0.06, 0.55, '#D8C7A0', x, 0.03, z));
    // clouds made of boxes, placed by screen position (camera-plane coordinates) behind the island
    [[-4.4, 6.6], [4.6, 4.6], [-4.2, -7.2], [4.4, -9.4]].forEach(([sx, sy], k) => {
      const c = new THREE.Group(); scene.add(c);
      c.position.copy(R).multiplyScalar(sx).addScaledVector(U, sy).addScaledVector(dir, -12);
      box(2.6, 0.9, 1.6, '#FFFFFF', 0, 0, 0, c); box(1.6, 0.8, 1.2, '#FFFFFF', 0.8 + 0.3 * k, 0.6, -0.2, c);
    });
    // the boat, sailing round the pond
    const boat = new THREE.Group(); scene.add(boat);
    box(0.9, 0.25, 0.45, '#8A5A3B', 0, 0.12, 0, boat);
    put(new THREE.ConeGeometry(0.35, 0.8, 3), '#FFFFFF', 0.05, 0.65, 0, boat).scale.set(0.3, 1, 1);
    // three smoke puffs rising from the chimney
    const puffs = [0, 1, 2].map(() => put(new THREE.BoxGeometry(0.4, 0.4, 0.4), '#E8E8EE', 0, 0, 0));

    // low-res colour (+ depth) and normals, then an upscale pass that adds the outlines and the sky
    const rt = new THREE.WebGLRenderTarget(LW, LH, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    rt.depthTexture = new THREE.DepthTexture(LW, LH);
    const nrt = new THREE.WebGLRenderTarget(LW, LH, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    const normals = new THREE.MeshNormalMaterial({ flatShading: true });
    const up = new THREE.ShaderMaterial({
      toneMapped: false,
      uniforms: { tC: { value: rt.texture }, tN: { value: nrt.texture }, tD: { value: rt.depthTexture }, uOff: { value: new THREE.Vector2() } },
      vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D tC, tN, tD; uniform vec2 uOff;
        float D(ivec2 q) { return texelFetch(tD, q, 0).r; }
        vec3 N(ivec2 q) { return texelFetch(tN, q, 0).rgb * 2.0 - 1.0; }
        void main() {
          ivec2 q = ivec2(floor((gl_FragCoord.xy + uOff) / ${PX}.0)) + 1;
          float d = D(q);
          if (d > 0.9999) {                                   // sky, drawn in screen space in 6 px bands
            float y = floor(gl_FragCoord.y / ${PX}.0) * ${PX}.0 / ${H}.0;
            vec3 c = mix(vec3(0.99, 0.84, 0.66), vec3(0.42, 0.7, 0.98), floor(y * 9.0) / 8.0);
            gl_FragColor = vec4(c, 1.0);
          } else {
            vec3 c = texelFetch(tC, q, 0).rgb, n = N(q);
            float far = 0.0, crease = 0.0;
            ivec2 o[4] = ivec2[4](ivec2(1, 0), ivec2(-1, 0), ivec2(0, 1), ivec2(0, -1));
            for (int i = 0; i < 4; i++) {
              float dn = D(q + o[i]);
              far = max(far, dn - d);                          // a neighbour lies well behind: we are a silhouette pixel
              if (abs(dn - d) < 0.004) crease = max(crease, (1.0 - dot(n, N(q + o[i]))) * step(0.0, dot(vec3(o[i], 0.0), n)));
            }
            if (far > 0.006) c *= 0.38;
            else if (crease > 0.25) c = min(c * 1.35 + 0.04, 1.0);
            gl_FragColor = vec4(c, 1.0);
          }
          #include <colorspace_fragment>
        }`,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), up), post = new THREE.Scene(), flat = new THREE.Camera();
    post.add(quad);

    const base = new THREE.Vector3(0, 0.3, 0), want = new THREE.Vector3(), p = new THREE.Vector3();
    return {
      render(t) {
        const a = phase(t) * TAU;
        // the view glides round a small loop; the camera itself sits on whole texels
        want.copy(base).addScaledVector(R, 0.7 * Math.cos(a)).addScaledVector(U, 1.1 * Math.sin(a)).addScaledVector(dir, 60);
        snap(want, camera.position);
        const fr = (want.dot(R) - camera.position.dot(R)) / TEX, fu = (want.dot(U) - camera.position.dot(U)) / TEX;
        up.uniforms.uOff.value.set(Math.round(fr * PX), Math.round(fu * PX));
        camera.updateMatrixWorld();

        hub.children.forEach((arm, k) => { arm.rotation.z = k * Math.PI / 2 - Math.round(phase(t) * 32) / 32 * TAU; }); // 32 steps a turn
        const b = Math.round(phase(t) * 8) / 8 * TAU;          // boat: snapped position, eight headings
        snap(p.set(1.8 + 1.5 * Math.cos(a), 0.12, 2.0 + 1.5 * Math.sin(a)), boat.position);
        boat.rotation.y = -b - Math.PI / 2;
        puffs.forEach((m, k) => {
          const f = (phase(t) * 2 + k / 3) % 1;
          snap(p.set(-1.6 + 0.4 * f, 3.9 + 2.2 * f, -1.6 - 0.3 * f), m.position);
          m.scale.setScalar(Math.round(Math.sin(Math.PI * f) * 4) / 4 + 0.001);
        });

        renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, camera);
        scene.overrideMaterial = normals;
        renderer.setRenderTarget(nrt); renderer.clear(); renderer.render(scene, camera);
        scene.overrideMaterial = null;
        renderer.setRenderTarget(null); renderer.render(post, flat);
      },
    };
  },
};
