// Impostors: a forest of 520-triangle trees, but only the ones within 24 units are real meshes. Every farther tree
// is one camera-facing quad (2 triangles) that shows a picture of the tree baked in setup from 8 x 8 directions
// over the upper hemisphere, laid out as a hemi-octahedral atlas (shown bottom left). Each quad turns the view
// direction into atlas coordinates and blends the 4 nearest baked views, so it turns smoothly; near the 24-unit ring
// the quad fades in over the opaque mesh across 8 units, so nothing pops. Midway a wipe reveals the trick: real meshes show their
// triangles in orange, impostors their quad outline in cyan, and the switch ring glows on the ground. The forest
// repeats every 42 units and the camera walks exactly that far per loop.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TAU, FONT, phase, rng, smoothstep, span, ease, lerp } from '../lib/util.js';

const TL = 42, TW = 84, N = 8, CELL = 192, R1 = 24, BAND = 4, CAMH = 11;   // tile, atlas, switch radius, camera height
const TREE_R = 4.2, TREE_CY = 3.3;                         // the baked square's half-size (tree plus a clear margin), centre height
const SUN = new THREE.Vector3(-0.55, 0.75, 0.38).normalize();
const FOG = [40, 175];
const INSET = { x: 40, y: 1392, s: 470 };                  // the atlas on screen
const wipes = t => [lerp(-80, 1160, ease.inOut(span(t, 1.0, 2.2))), lerp(-80, 1160, ease.inOut(span(t, 3.4, 4.6)))];
const camAt = t => new THREE.Vector3(0.6 * Math.sin(phase(t) * TAU), CAMH, -TL * phase(t));
let overlayState = null;                                   // what the 2D overlay needs from the last frame

// hemi-octahedral mapping: atlas cell grid <-> directions on the upper hemisphere
const decode = (ex, ey) => { const px = (ex + ey) / 2, pz = (ex - ey) / 2; return new THREE.Vector3(px, 1 - Math.abs(px) - Math.abs(pz), pz).normalize(); };
const encode = d => { const l = Math.abs(d.x) + Math.abs(Math.max(d.y, 0)) + Math.abs(d.z), px = d.x / l, pz = d.z / l; return [px + pz, px - pz]; };

// the tree: a tapered trunk, two branches and six faceted leaf clumps; non-indexed, with colour and barycentrics
function treeGeometry() {
  const r = rng(284), parts = [];
  const add = (geo, hex, m, wobble) => {
    geo = geo.toNonIndexed(); geo.applyMatrix4(m);
    const p = geo.attributes.position, n = p.count, col = new THREE.Color(hex), cols = [], bary = [];
    for (let i = 0; i < n; i++) {
      if (wobble) {                                           // move each corner by a hash of its position: still watertight
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i), h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
        const k = 1 + wobble * ((h - Math.floor(h)) - 0.5);
        const c = new THREE.Vector3().setFromMatrixPosition(m);
        p.setXYZ(i, c.x + (x - c.x) * k, c.y + (y - c.y) * k, c.z + (z - c.z) * k);
      }
      cols.push(col.r, col.g, col.b); bary.push(i % 3 === 0, i % 3 === 1, i % 3 === 2);
    }
    geo.setAttribute('col', new THREE.Float32BufferAttribute(cols, 3));
    geo.setAttribute('bary', new THREE.Float32BufferAttribute(bary.map(Number), 3));
    geo.deleteAttribute('normal'); geo.deleteAttribute('uv');
    parts.push(geo);
  };
  const M = (x, y, z, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, rz)), new THREE.Vector3(1, 1, 1));
  add(new THREE.CylinderGeometry(0.2, 0.36, 3.4, 7), '#6E4A2E', M(0, 1.7, 0), 0);
  add(new THREE.CylinderGeometry(0.07, 0.13, 1.6, 5), '#6E4A2E', M(0.55, 2.8, 0.1, 0, -0.9), 0);
  add(new THREE.CylinderGeometry(0.07, 0.13, 1.5, 5), '#6E4A2E', M(-0.5, 3.0, -0.2, 0.3, 0.9), 0);
  [[0, 4.3, 0, 1.75, '#3F8F3A'], [1.05, 3.6, 0.45, 1.3, '#4FA144'], [-1.0, 3.7, -0.35, 1.35, '#357F35'],
    [0.2, 5.25, -0.35, 1.2, '#5BB04C'], [-0.45, 3.35, 1.0, 1.1, '#46963F'], [0.7, 4.7, -1.0, 1.05, '#3A8A3A']]
    .forEach(([x, y, z, rad, hex]) => add(new THREE.IcosahedronGeometry(rad, 1), hex, M(x, y, z, r() * 3, r() * 3), 0.22));
  return mergeGeometries(parts);
}

const REVEAL = `
uniform vec2 uWipe;
float reveal() { return clamp((uWipe.x - gl_FragCoord.x) / 50.0 + 0.5, 0.0, 1.0) * clamp((gl_FragCoord.x - uWipe.y) / 50.0 + 0.5, 0.0, 1.0); }
uniform vec3 uFogCol;
vec3 fogged(vec3 c) { return mix(c, uFogCol, smoothstep(${FOG[0]}.0, ${FOG[1]}.0, gl_FragCoord.z / gl_FragCoord.w)); }`;

export default {
  name: 'Impostors',
  ko: '임포스터',
  three(renderer, W, H) {
    const fogCol = new THREE.Color('#CFE3EC');
    const shared = { uWipe: { value: new THREE.Vector2(-80, -80) }, uFogCol: { value: fogCol }, uSun: { value: SUN } };
    // the tree material: flat lambert from the sun and sky; in the reveal its triangle edges glow orange
    const treeMat = bake => new THREE.ShaderMaterial({
      uniforms: { ...shared, uOpacity: { value: 1 } }, transparent: false,
      vertexShader: `attribute vec3 col, bary; varying vec3 vW, vC, vB;
        void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vC = col; vB = bary; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform vec3 uSun; uniform float uOpacity; varying vec3 vW, vC, vB;${REVEAL}
        void main() {
          vec3 n = normalize(cross(dFdx(vW), dFdy(vW)));
          vec3 c = vC * (vec3(0.30, 0.38, 0.52) * (0.65 + 0.35 * n.y) + vec3(1.15, 1.02, 0.85) * max(dot(n, uSun), 0.0));
          ${bake ? '' : `float rv = reveal();
          vec3 e = smoothstep(vec3(0.0), fwidth(vB) * 1.3, vB);
          c = mix(c, mix(c * 0.55 + vec3(0.22, 0.10, 0.0), vec3(1.0, 0.55, 0.12), 1.0 - min(min(e.x, e.y), e.z)), rv);
          c = fogged(c);`}
          gl_FragColor = vec4(c, uOpacity);
          #include <colorspace_fragment>
        }`,
    });
    const geo = treeGeometry();

    // bake: the tree from 8 x 8 directions, each into a small multisampled target, copied into its atlas cell
    const atlas = new THREE.WebGLRenderTarget(N * CELL, N * CELL, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
    const cellRT = new THREE.WebGLRenderTarget(CELL, CELL, { samples: 4 });
    const bakeScene = new THREE.Scene(); bakeScene.add(new THREE.Mesh(geo, treeMat(true)));
    const oc = new THREE.OrthographicCamera(-TREE_R, TREE_R, TREE_R, -TREE_R, 0.1, TREE_R * 6);
    const copy = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: { tex: { value: cellRT.texture } }, blending: THREE.NoBlending, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: 'uniform sampler2D tex; varying vec2 vUv; void main() { gl_FragColor = texture2D(tex, vUv); }',
    }));
    const copyScene = new THREE.Scene(); copyScene.add(copy); copy.frustumCulled = false;
    const center = new THREE.Vector3(0, TREE_CY, 0);
    renderer.setClearColor(0x000000, 0);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const d = decode(-1 + 2 * i / (N - 1), -1 + 2 * j / (N - 1));
      if (d.y > 0.999) d.set(0, 1, 0.001).normalize();
      oc.position.copy(center).addScaledVector(d, TREE_R * 3); oc.up.set(0, 1, 0); oc.lookAt(center); oc.updateMatrixWorld();
      renderer.setRenderTarget(cellRT); renderer.clear(); renderer.render(bakeScene, oc);
      atlas.viewport.set(i * CELL, j * CELL, CELL, CELL); atlas.scissor.copy(atlas.viewport); atlas.scissorTest = true;
      renderer.setRenderTarget(atlas); renderer.render(copyScene, oc);
    }
    atlas.scissorTest = false; atlas.viewport.set(0, 0, N * CELL, N * CELL);
    renderer.setRenderTarget(null);

    // the world
    const scene = new THREE.Scene();
    const sky = document.createElement('canvas'); sky.width = 540; sky.height = 960;    // screen-space sky with far hills
    const sg = sky.getContext('2d'), grd = sg.createLinearGradient(0, 0, 0, 260);
    grd.addColorStop(0, '#5E9BD8'); grd.addColorStop(0.8, '#B9D9EC'); grd.addColorStop(1, '#CFE3EC');
    sg.fillStyle = grd; sg.fillRect(0, 0, 540, 960);
    [['#A9C6D8', 168, 34, 0.013], ['#BCD3DE', 186, 22, 0.021]].forEach(([c, base, amp, f], k) => {
      sg.fillStyle = c; sg.beginPath(); sg.moveTo(0, 960);
      for (let x = 0; x <= 540; x += 4) sg.lineTo(x, base + 10 - amp * (0.6 + 0.4 * Math.sin(x * f + k * 2) + 0.2 * Math.sin(x * f * 2.7 + 1)));
      sg.lineTo(540, 960); sg.fill();
    });
    scene.background = new THREE.CanvasTexture(sky); scene.background.colorSpace = THREE.SRGBColorSpace;
    const camera = new THREE.PerspectiveCamera(56, W / H, 0.5, 400);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 600).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
      uniforms: { ...shared, uCam: { value: new THREE.Vector3() } },
      vertexShader: 'varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform vec3 uCam; varying vec3 vW;${REVEAL}
        void main() {
          float v = 0.5 + 0.25 * sin(vW.x * 0.11 + 0.7) * sin(vW.z * ${(TAU / TL * 2).toFixed(5)}) + 0.2 * sin(vW.z * ${(TAU / TL).toFixed(5)} + vW.x * 0.05);
          vec3 c = mix(vec3(0.20, 0.36, 0.12), vec3(0.34, 0.50, 0.17), v);
          c = mix(vec3(0.62, 0.50, 0.34), c, smoothstep(1.4, 2.6, abs(vW.x - 0.0)));          // the trail
          float ring = smoothstep(0.5, 0.0, abs(length(vW.xz - uCam.xz) - ${R1}.0)) * reveal();
          c = mix(fogged(c), vec3(1.0, 0.92, 0.45), ring * 0.85);
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    }));
    ground.position.z = -150;
    scene.add(ground);

    // the impostor quad: faces the camera, picks and blends the 4 nearest baked views; cyan outline in the reveal
    const impMat = new THREE.ShaderMaterial({
      uniforms: { ...shared, uAtlas: { value: atlas.texture }, uCenter: { value: new THREE.Vector3() }, uSize: { value: 1 }, uRot: { value: 0 }, uOpacity: { value: 1 } },
      transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      vertexShader: `uniform vec3 uCenter; uniform float uSize, uRot; varying vec2 vUv; varying vec3 vD;
        void main() {
          vec3 d = normalize(cameraPosition - uCenter), r = normalize(cross(vec3(0, 1, 0), d)), u = cross(d, r);
          float dist = length(cameraPosition - uCenter), k = (dist - uSize) / dist;   // slid to the front of the tree, same size on screen
          float c = cos(uRot), s = sin(uRot);
          vD = vec3(c * d.x - s * d.z, d.y, s * d.x + c * d.z);                // the view direction in the tree's own frame
          vUv = position.xy * 0.5 + 0.5;
          gl_Position = projectionMatrix * viewMatrix * vec4(uCenter + d * uSize + (r * position.x + u * position.y) * uSize * k, 1.0);
        }`,
      fragmentShader: `uniform sampler2D uAtlas; uniform float uOpacity; varying vec2 vUv; varying vec3 vD;${REVEAL}
        const float N = ${N}.0;
        vec4 cell(vec2 g) { return texture2D(uAtlas, (g + clamp(vUv, 0.015, 0.985)) / N); }
        void main() {
          vec3 d = normalize(vec3(vD.x, max(vD.y, 0.0), vD.z));
          vec2 p = d.xz / (abs(d.x) + d.y + abs(d.z)), e = vec2(p.x + p.y, p.x - p.y);
          vec2 g = (e * 0.5 + 0.5) * (N - 1.0), g0 = clamp(floor(g), 0.0, N - 2.0), f = clamp(g - g0, 0.0, 1.0);
          vec4 a = mix(mix(cell(g0), cell(g0 + vec2(1, 0)), f.x), mix(cell(g0 + vec2(0, 1)), cell(g0 + vec2(1, 1)), f.x), f.y);
          vec3 c = fogged(a.rgb / max(a.a, 0.001));                              // un-premultiply, fog, convert, premultiply
          float rv = reveal();
          vec2 px = fwidth(vUv), q = min(vUv, 1.0 - vUv) / px;
          float edge = 1.0 - smoothstep(2.0, 3.5, min(q.x, q.y));
          vec4 o = linearToOutputTexel(vec4(c, 1.0));
          vec4 col = vec4(o.rgb * a.a, a.a);
          col = mix(col, vec4(0.20, 0.85, 1.0, 1.0) * 0.22 + col * 0.78, rv);   // the quad's area, tinted
          col = mix(col, vec4(0.35, 0.92, 1.0, 1.0), edge * rv);                 // and its outline
          gl_FragColor = col * uOpacity;
        }`,
    });

    // the trees of one tile, repeated along the walk; a soft contact shadow under each
    const quad = new THREE.PlaneGeometry(2, 2), trees = [];
    const r = rng(77);
    const spots = [];
    for (let z = 0; z < TL; z += 6) for (let x = -TW / 2; x < TW / 2; x += 7) {
      const tx = x + 3.5 + (r() - 0.5) * 4.6, tz = z + 3 + (r() - 0.5) * 4, rot = r() * TAU, sc = 0.85 + r() * 0.45;
      if (Math.abs(tx) > 4.6) spots.push([tx, tz, rot, sc]);
    }
    const blob = document.createElement('canvas'); blob.width = blob.height = 64;
    const bgc = blob.getContext('2d'), bgr = bgc.createRadialGradient(32, 32, 0, 32, 32, 32);
    bgr.addColorStop(0, 'rgba(0, 0, 0, 0.55)'); bgr.addColorStop(1, 'rgba(0, 0, 0, 0)');
    bgc.fillStyle = bgr; bgc.fillRect(0, 0, 64, 64);
    const shadows = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(blob), transparent: true, depthWrite: false, fog: false }), spots.length * 7);
    let si = 0;
    for (let k = -1; k <= 5; k++) for (const [tx, tz, rot, sc] of spots) {
      const pos = new THREE.Vector3(tx, 0, -(tz + k * TL));
      const mesh = new THREE.Mesh(geo, treeMat(false)); mesh.position.copy(pos); mesh.rotation.y = rot; mesh.scale.setScalar(sc);
      const im = impMat.clone(); im.uniforms = { ...impMat.uniforms, uCenter: { value: pos.clone().add(new THREE.Vector3(0, TREE_CY * sc, 0)) }, uSize: { value: TREE_R * sc }, uRot: { value: rot }, uOpacity: { value: 1 } };
      const imp = new THREE.Mesh(quad, im); imp.position.copy(im.uniforms.uCenter.value); imp.frustumCulled = false;
      scene.add(mesh, imp);
      trees.push({ pos, rot, sc, mesh, imp });
      shadows.setMatrixAt(si++, new THREE.Matrix4().compose(pos.clone().setY(0.02), new THREE.Quaternion(), new THREE.Vector3(5.5 * sc, 1, 5.5 * sc)));
    }
    shadows.count = si; shadows.renderOrder = -1; scene.add(shadows);   // before the quads, which write no depth

    // the atlas inset: a dark card and the baked atlas (premultiplied) on top
    const insetScene = new THREE.Scene(), insetCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const card = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ color: '#141A24', depthTest: false }));
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: { tex: { value: atlas.texture } }, transparent: true, depthTest: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D tex; varying vec2 vUv;
        void main() { vec4 a = texture2D(tex, vUv); vec4 o = linearToOutputTexel(vec4(a.rgb / max(a.a, 0.001), 1.0)); gl_FragColor = vec4(o.rgb * a.a, a.a); }`,
    }));
    card.renderOrder = 0; sheet.renderOrder = 1; card.frustumCulled = sheet.frustumCulled = false;
    insetScene.add(card, sheet);

    return {
      render(t) {
        const cam = camAt(t);
        camera.position.copy(cam); camera.lookAt(cam.x * 0.3, 0, cam.z - 37); camera.updateMatrixWorld();
        const [wi, wo] = wipes(t);
        shared.uWipe.value.set(wi, wo);
        ground.material.uniforms.uCam.value.copy(cam);
        let meshes = 0, imps = 0;
        const dots = [];
        for (const tr of trees) {
          const dz = tr.pos.z - cam.z, dist = Math.hypot(tr.pos.x - cam.x, dz);
          const k = smoothstep(R1 - BAND, R1 + BAND, dist);               // 0: mesh, 1: impostor
          const ahead = dz < 12 && dz > -190;
          tr.mesh.visible = ahead && k < 1;
          tr.imp.visible = ahead && k > 0;
          tr.imp.material.uniforms.uOpacity.value = k;            // the opaque mesh stays under it until the quad is solid
          if (tr.mesh.visible && k < 0.5) meshes++;
          if (tr.imp.visible && k >= 0.5) {
            imps++;
            const c = tr.imp.material.uniforms.uCenter.value, d = cam.clone().sub(c).normalize();
            const cr = Math.cos(tr.rot), sr = Math.sin(tr.rot);
            dots.push([...encode(new THREE.Vector3(cr * d.x - sr * d.z, d.y, sr * d.x + cr * d.z)), k * (1 - smoothstep(120, 180, dist))]);
          }
        }
        overlayState = { meshes, imps, dots, wi, wo };
        renderer.setRenderTarget(null);
        renderer.setClearColor(0x000000, 1);
        renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H);
        renderer.render(scene, camera);
        const { x, y, s } = INSET;
        renderer.setViewport(x, H - y - s, s, s); renderer.setScissor(x, H - y - s, s, s); renderer.setScissorTest(true);
        renderer.autoClear = false; renderer.render(insetScene, insetCam); renderer.autoClear = true;
        renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H);
      },
    };
  },
  overlay(ctx, t, W, H) {
    const st = overlayState, { x, y, s } = INSET;
    // the wipe lines
    for (const [wx, on] of [[st.wi, span(t, 1.0, 2.2)], [st.wo, span(t, 3.4, 4.6)]]) {
      if (on <= 0 || on >= 1) continue;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'; ctx.fillRect(wx - 1.5, 300, 3, 1060);
    }
    // the atlas: cell grid, title, and a dot for every impostor's current view direction
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'; ctx.lineWidth = 1;
    for (let k = 1; k < N; k++) {
      ctx.beginPath(); ctx.moveTo(x + k * s / N, y); ctx.lineTo(x + k * s / N, y + s); ctx.moveTo(x, y + k * s / N); ctx.lineTo(x + s, y + k * s / N); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'; ctx.lineWidth = 2; ctx.strokeRect(x, y, s, s);
    for (const [ex, ey, a] of st.dots) {
      const gx = (ex * 0.5 + 0.5) * (N - 1) + 0.5, gy = (ey * 0.5 + 0.5) * (N - 1) + 0.5;
      ctx.fillStyle = `rgba(90, 230, 255, ${0.75 * a})`;
      ctx.beginPath(); ctx.arc(x + gx * s / N, y + s - gy * s / N, 4.5, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = 'rgba(12, 16, 26, 0.72)'; ctx.beginPath(); ctx.roundRect(x, y - 54, s, 44, 12); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.font = `700 23px ${FONT.sans}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('OCTAHEDRAL ATLAS · 8 × 8 BAKED VIEWS', x + s / 2, y - 31);
    // legend and counts
    const lx = 540, ly = 1430;
    ctx.fillStyle = 'rgba(12, 16, 26, 0.72)'; ctx.beginPath(); ctx.roundRect(lx, ly - 30, 500, 420, 22); ctx.fill();
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    const row = (yy, color, title, count, note) => {
      ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(lx + 30, yy - 30, 34, 34, 8); ctx.fill();
      ctx.fillStyle = '#FFFFFF'; ctx.font = `700 30px ${FONT.sans}`; ctx.fillText(title, lx + 82, yy);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)'; ctx.font = `500 24px ${FONT.sans}`; ctx.fillText(note, lx + 82, yy + 36);
      ctx.fillStyle = color; ctx.font = `700 40px ${FONT.mono}`; ctx.textAlign = 'right'; ctx.fillText(count, lx + 470, yy + 4); ctx.textAlign = 'left';
    };
    row(ly + 40, '#FF9A2E', 'MESH', String(st.meshes), 'near · 520 triangles each');
    row(ly + 160, '#5AE6FF', 'IMPOSTOR', String(st.imps), 'far · 1 quad = 2 triangles');
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; ctx.font = `500 23px ${FONT.sans}`;
    ctx.fillText(`switch at ${R1} units, crossfaded over ${2 * BAND}`, lx + 30, ly + 280);
    ctx.fillText('dots: the view each impostor uses', lx + 30, ly + 318);
  },
};
