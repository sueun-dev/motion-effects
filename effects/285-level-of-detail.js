// Level of detail: one fluted, twisted sculpture built at four resolutions, LOD0 5,120 triangles down to LOD3 80
// (subdivided icospheres pushed out by the same shape function). Each level halves the edge length of the next, so
// switching one level per doubling of distance keeps triangles about the same size on screen. As the camera dollies
// back, every vertex that a level adds glides onto the midpoint of its parent edge (geomorphing), and the edges it
// added fade out; when the glide ends the mesh is exactly the coarser level, which then takes over without a pop.
// The wireframe and tint show the level (teal, green, yellow, orange); the inset draws the same mesh up close.
import * as THREE from 'three';
import { TAU, FONT, phase, clamp, smoothstep } from '../lib/util.js';

const LEVELS = [['LOD0', 4, '#4FD1C5'], ['LOD1', 3, '#7BD389'], ['LOD2', 2, '#F6C445'], ['LOD3', 1, '#F28D52']];
const D0 = 12, CENTER = new THREE.Vector3(0, 0.45, 0), INSET = { x: 40, y: 1404, s: 456 };
const lodAt = t => 3.4 * (0.5 - 0.5 * Math.cos(phase(t) * TAU));          // 0 .. 3.4 .. 0: one doubling of distance per level
const state = t => {
  const l = lodAt(t), L = Math.min(3, Math.floor(l));
  return { l, L, morph: L < 3 ? smoothstep(0.45, 1, l - L) : 0, dist: D0 * 2 ** l };
};

// the sculpture: a teardrop with nine twisted flutes and a collar, as a radius per direction
function radius(x, y, z) {
  const a = Math.atan2(z, x);
  const body = 1 + 0.3 * y - 0.18 * y * y + 0.55 * Math.max(0, y) ** 6;
  return 1.05 * (body + 0.075 * Math.sin(9 * a + 5 * y) * (1 - y * y) + 0.06 * Math.exp(-(((y + 0.42) / 0.06) ** 2)));
}

// icospheres level 0..4, keeping old vertices at their indices and remembering each new vertex's parent edge
function icospheres() {
  const t = (1 + Math.sqrt(5)) / 2;
  const V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]]
    .map(v => { const l = Math.hypot(...v); return v.map(q => q / l); });
  let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  const parent = [];                                          // parent[i] = [a, b] for vertices added by subdivision
  const levels = [{ faces: F, n: V.length }];
  for (let L = 1; L <= 4; L++) {
    const mid = new Map(), nf = [];
    const m = (a, b) => {
      const k = a < b ? `${a}_${b}` : `${b}_${a}`;
      if (!mid.has(k)) {
        const p = V[a].map((q, i) => q + V[b][i]), l = Math.hypot(...p);
        V.push(p.map(q => q / l)); parent[V.length - 1] = [a, b]; mid.set(k, V.length - 1);
      }
      return mid.get(k);
    };
    for (const [a, b, c] of F) {
      const ab = m(a, b), bc = m(b, c), ca = m(c, a);
      nf.push([a, ab, ca, 1, 0, 0], [b, bc, ab, 1, 0, 0], [c, ca, bc, 1, 0, 0], [ab, bc, ca, 1, 1, 1]);   // + which edges are new
    }
    F = nf.map(f => f.slice(0, 3));
    levels.push({ faces: nf, n: V.length });
  }
  return { V, parent, levels };
}

export default {
  name: 'Level of Detail (LOD)',
  ko: '상세도 단계',
  three(renderer, W, H) {
    const { V, parent, levels } = icospheres();
    const P = V.map(([x, y, z]) => { const r = radius(x, y, z); return [x * r, y * r, z * r]; });
    // one non-indexed geometry per LOD: position, geomorph target (parent-edge midpoint), barycentrics, new-edge flags
    const geos = LEVELS.map(([, sub]) => {
      const { faces, n } = levels[sub], prevN = levels[sub - 1].n;
      const pos = [], tgt = [], bary = [], flag = [];
      for (const f of faces) {
        for (let k = 0; k < 3; k++) {
          const v = f[k];
          pos.push(...P[v]);
          tgt.push(...(v < prevN ? P[v] : P[parent[v][0]].map((q, i) => (q + P[parent[v][1]][i]) / 2)));
          bary.push(k === 0, k === 1, k === 2);
          flag.push(f[3] ?? 0, f[4] ?? 0, f[5] ?? 0);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('target', new THREE.Float32BufferAttribute(tgt, 3));
      g.setAttribute('bary', new THREE.Float32BufferAttribute(bary.map(Number), 3));
      g.setAttribute('flag', new THREE.Float32BufferAttribute(flag, 3));
      g.userData.n = n;
      return g;
    });
    const mat = new THREE.ShaderMaterial({
      uniforms: { uMorph: { value: 0 }, uCol: { value: new THREE.Color() }, uCol2: { value: new THREE.Color() } },
      vertexShader: `attribute vec3 target, bary, flag; uniform float uMorph; varying vec3 vW, vB, vF;
        void main() { vec4 w = modelMatrix * vec4(mix(position, target, uMorph), 1.0); vW = w.xyz; vB = bary; vF = flag; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform float uMorph; uniform vec3 uCol, uCol2; varying vec3 vW, vB, vF;
        void main() {
          vec3 n = normalize(cross(dFdx(vW), dFdy(vW))), v = normalize(cameraPosition - vW);
          vec3 key = normalize(vec3(-0.5, 0.8, 0.6)), rim = normalize(vec3(0.7, 0.3, -0.6));
          vec3 lod = mix(uCol, uCol2, uMorph);
          vec3 base = mix(vec3(0.86, 0.85, 0.82), lod, 0.28);
          vec3 c = base * (0.18 + 0.85 * max(dot(n, key), 0.0)) + lod * 0.55 * pow(max(dot(n, rim), 0.0), 2.0);
          c += vec3(1.0) * 0.25 * pow(max(dot(reflect(-key, n), v), 0.0), 24.0);
          vec3 e = smoothstep(vec3(0.0), fwidth(vB) * 1.4, vB);
          vec3 line = (1.0 - e) * (1.0 - vF * uMorph);                 // edges this level added fade as it morphs away
          c = mix(c, lod * 1.15, max(max(line.x, line.y), line.z) * 0.8);
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const meshes = geos.map(g => { const m = new THREE.Mesh(g, mat); m.position.copy(CENTER); m.visible = false; return m; });

    const scene = new THREE.Scene();
    const bg = document.createElement('canvas'); bg.width = 4; bg.height = 512;
    const bgc = bg.getContext('2d'), grd = bgc.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#0E1224'); grd.addColorStop(0.55, '#1E2442'); grd.addColorStop(1, '#0A0C18');
    bgc.fillStyle = grd; bgc.fillRect(0, 0, 4, 512);
    scene.background = new THREE.CanvasTexture(bg); scene.background.colorSpace = THREE.SRGBColorSpace;
    scene.add(...meshes);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 1.6, 48), new THREE.MeshStandardMaterial({ color: '#2B2F45', roughness: 0.7 }));
    plinth.position.y = 0.45 - 0.58 - 0.8;
    scene.add(plinth);
    // the floor marks where each level takes over: rings at 24, 48 and 96 in the colour of the level beyond them
    const floor = new THREE.Mesh(new THREE.CircleGeometry(600, 96).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
      uniforms: { uRing: { value: LEVELS.slice(1).map(l => new THREE.Color(l[2])) }, uCut: { value: 0 } },
      vertexShader: 'varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform vec3 uRing[3]; uniform float uCut; varying vec3 vW;
        void main() {
          float r = length(vW.xz);
          vec3 c = mix(vec3(0.016, 0.018, 0.045), vec3(0.009, 0.011, 0.030), smoothstep(5.0, 80.0, r));   // linear colours
          for (int k = 0; k < 3; k++) {
            float R = ${D0}.0 * exp2(float(k + 1)), w = R * 0.012;
            c = mix(c, uRing[k] * 0.55, smoothstep(w + fwidth(r), w, abs(r - R)) * 0.8 * smoothstep(uCut, uCut + 30.0, gl_FragCoord.y));
          }
          c = mix(c, vec3(0.0070, 0.0091, 0.0296), smoothstep(60.0, 420.0, length(vW - cameraPosition)));
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    }));
    floor.position.y = plinth.position.y - 0.8;
    scene.add(floor);
    scene.add(new THREE.HemisphereLight('#C8D4FF', '#20202A', 1.2));
    const sun = new THREE.DirectionalLight('#FFFFFF', 2.2); sun.position.set(-3, 6, 4); scene.add(sun);

    const camera = new THREE.PerspectiveCamera(36, W / H, 0.1, 300);
    camera.setViewOffset(W, H, 0, 150, W, H);                  // the sculpture sits a little above the middle
    const close = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    const dir = new THREE.Vector3();
    return {
      render(t) {
        const s = state(t), az = 0.3 * Math.sin(phase(t) * TAU) + 0.35;
        dir.set(Math.sin(az), 0.18, Math.cos(az)).normalize();
        camera.position.copy(CENTER).addScaledVector(dir, s.dist); camera.lookAt(CENTER);
        close.position.copy(CENTER).addScaledVector(dir, 5.6); close.lookAt(CENTER);
        meshes.forEach((m, k) => { m.visible = k === s.L; });
        mat.uniforms.uMorph.value = s.morph;
        mat.uniforms.uCol.value.set(LEVELS[s.L][2]);
        mat.uniforms.uCol2.value.set(LEVELS[Math.min(3, s.L + 1)][2]);
        renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H);
        floor.material.uniforms.uCut.value = H - 1330;              // no rings in the HUD band of the main view
        renderer.render(scene, camera);
        floor.material.uniforms.uCut.value = -100;
        const { x, y, s: sz } = INSET;
        renderer.setViewport(x, H - y - sz, sz, sz); renderer.setScissor(x, H - y - sz, sz, sz); renderer.setScissorTest(true);
        renderer.render(scene, close);
        renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H);
      },
    };
  },
  overlay(ctx, t, W, H) {
    const s = state(t), { x, y, s: sz } = INSET;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x, y, sz, sz, 6); ctx.stroke();
    ctx.fillStyle = '#0C0F1E'; ctx.beginPath(); ctx.roundRect(x, y - 54, sz, 44, 12); ctx.fill();            // opaque: the scene stays behind
    ctx.fillStyle = '#FFFFFF'; ctx.font = `700 23px ${FONT.sans}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('THE SAME MESH, UP CLOSE', x + sz / 2, y - 31);
    // the LOD ladder
    const lx = 530, ly = 1350, rowH = 100;
    ctx.fillStyle = '#0C0F1E'; ctx.beginPath(); ctx.roundRect(lx, ly, 510, 510, 22); ctx.fill();
    ctx.textBaseline = 'alphabetic';
    LEVELS.forEach(([name, sub, col], k) => {
      const yy = ly + 30 + k * rowH, on = k === s.L ? 1 - s.morph : k === s.L + 1 ? s.morph : 0, tris = 20 * 4 ** sub;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.04 + 0.1 * on})`; ctx.beginPath(); ctx.roundRect(lx + 16, yy, 478, rowH - 14, 14); ctx.fill();
      ctx.fillStyle = col; ctx.globalAlpha = 0.35 + 0.65 * on;
      ctx.beginPath(); ctx.roundRect(lx + 34, yy + 24, 38, 38, 9); ctx.fill();
      ctx.fillStyle = '#FFFFFF'; ctx.font = `700 31px ${FONT.sans}`; ctx.textAlign = 'left'; ctx.fillText(name, lx + 90, yy + 55);
      ctx.fillStyle = col; ctx.font = `700 31px ${FONT.mono}`; ctx.textAlign = 'right'; ctx.fillText(`${tris.toLocaleString('en-US')} ▲`, lx + 474, yy + 55);
      ctx.globalAlpha = 1;
    });
    const by = ly + 30 + 4 * rowH + 6;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; ctx.font = `500 24px ${FONT.sans}`; ctx.textAlign = 'left';
    ctx.fillText(`distance ${s.dist.toFixed(1)}`, lx + 34, by + 26);
    ctx.textAlign = 'right';
    ctx.fillText(s.L < 3 ? `geomorph ${Math.round(s.morph * 100)} %` : 'coarsest', lx + 474, by + 26);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'; ctx.fillRect(lx + 34, by + 46, 440, 8);
    ctx.fillStyle = LEVELS[s.L][2]; ctx.fillRect(lx + 34, by + 46, 440 * clamp(s.l / 3.4), 8);
  },
};
