// Photogrammetry: a weathered stone head on a plinth is rebuilt from photographs, stage by stage. Thirty cameras (a
// ring above the head, three columns at each side) take their shots; two of the photos are matched feature to
// feature, and rays from both cameras meet at the same points (triangulation); structure from motion gives a sparse
// cloud, multi-view stereo a dense one; a surface is meshed through it (wireframe), and finally the colours of the
// photos are projected back on as a texture. The head, its colours and every cloud are generated in code at load;
// frames only blend between the stages.
import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { TAU, FONT, span, ease, rng, clamp, fbm3, smoothstep } from '../lib/util.js';

const STAGES = [['Photos', '30 cameras'], ['Feature matching', '2 × 48 matches'], ['Sparse cloud', '1,500 points'],
  ['Dense cloud', '36,000 points'], ['Mesh', '22,500 triangles'], ['Texture', 'projected colour']];
const T = [0.15, 0.95, 1.75, 2.45, 3.15, 3.85, 4.6];             // stage i runs from T[i] to T[i + 1]
const gauss = (x, s) => Math.exp(-((x / s) ** 2));

// the head: radius around the vertical axis at height y and angle a (a = 0 faces +z)
function radius(a, y) {
  const n = 3, ca = Math.cos(a), sa = Math.sin(a);
  let r = (Math.abs(ca / 0.6) ** n + Math.abs(sa / 0.52) ** n) ** (-1 / n);
  r *= 1 - 0.06 * y / 3 + 0.05 * gauss(y - 0.95, 0.35);              // a heavy jaw
  if (y > 2.55) r *= Math.sqrt(Math.max(0, 1 - ((y - 2.55) / 0.5) ** 2)); // the rounded crown
  if (y < 0.25) r *= 0.9 + 0.1 * y / 0.25;
  const fw = Math.max(0, ca) ** 3, x = sa * 0.55;                    // face: brow, sockets, nose, lips, chin
  let f = 0.15 * gauss(y - 2.22, 0.11) * smoothstep(0.5, 0.3, Math.abs(x));
  f -= 0.11 * Math.exp(-(((y - 2.0) / 0.1) ** 2) - (((Math.abs(x) - 0.22) / 0.11) ** 2));
  const nose = clamp((2.2 - y) / 0.75) * smoothstep(1.36, 1.5, y);
  f += 0.36 * nose * gauss(x, 0.07 + 0.09 * nose);
  f += 0.09 * gauss(y - 1.22, 0.06) * gauss(x, 0.22) - 0.05 * gauss(y - 1.13, 0.025) * gauss(x, 0.2) + 0.07 * gauss(y - 1.05, 0.06) * gauss(x, 0.2);
  f += 0.1 * gauss(y - 0.8, 0.14) * gauss(x, 0.28);
  const ears = Math.abs(sa) ** 6 * 0.09 * smoothstep(1.3, 1.45, y) * smoothstep(2.45, 2.3, y);
  return r + fw * f + ears;
}
// weathered tuff: grey-brown, darker pits, yellow-green lichen, darker in the eye sockets
function stone(p, out) {
  const n = fbm3(p.x * 2.2, p.y * 2.2, p.z * 2.2, 4), m = fbm3(p.x * 9, p.y * 9, p.z * 9, 2);
  const lichen = smoothstep(0.18, 0.32, fbm3(p.x * 1.3 + 5, p.y * 1.3, p.z * 1.3 + 2, 3)) * (0.5 + 0.5 * smoothstep(2.3, 3.0, p.y));
  const k = 0.75 + 0.6 * n + 0.28 * m;
  out.setRGB(0.33 * k, 0.29 * k, 0.26 * k);
  out.lerp(new THREE.Color(0.47, 0.47, 0.32), lichen * 0.45);
  return out;
}

export default {
  name: 'Photogrammetry',
  ko: '포토그래메트리',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas'); bg.width = 4; bg.height = 256;
    const b = bg.getContext('2d'), grd = b.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#0B0F17'); grd.addColorStop(0.55, '#1B2230'); grd.addColorStop(1, '#0C0F15');
    b.fillStyle = grd; b.fillRect(0, 0, 4, 256);
    scene.background = new THREE.CanvasTexture(bg); scene.background.colorSpace = THREE.SRGBColorSpace;
    const camera = new THREE.PerspectiveCamera(32, W / H, 0.1, 100);

    // the head as a grid of rings (plus the plinth), with stone colours per vertex
    const RY = 110, RA = 100, top = 3.05;
    const P = [], C = [], col = new THREE.Color();
    for (let j = 0; j <= RY; j++) for (let i = 0; i < RA; i++) {
      const y = top * j / RY, a = TAU * i / RA, r = j === RY ? 0 : radius(a, y);
      const v = new THREE.Vector3(r * Math.sin(a), y, r * Math.cos(a));
      P.push(v); C.push(stone(v, col).clone().multiplyScalar(1 - 0.5 * Math.exp(-(((y - 2.0) / 0.12) ** 2)) * Math.max(0, Math.cos(a)) ** 6));
    }
    const tris = [];
    for (let j = 0; j < RY; j++) for (let i = 0; i < RA; i++) {
      const a = j * RA + i, b1 = j * RA + (i + 1) % RA, c = (j + 1) * RA + i, d = (j + 1) * RA + (i + 1) % RA;
      tris.push([a, b1, d], [a, d, c]);
    }
    // the plinth: a block under the head
    const pl = [[-0.85, -0.7, -0.8], [0.85, 0, 0.8]];
    const box = new THREE.BoxGeometry(1.7, 0.7, 1.6, 8, 4, 8).toNonIndexed().translate(0, -0.35, 0);
    const bp = box.attributes.position;
    for (let k = 0; k < bp.count; k += 3) {
      const ids = [0, 1, 2].map(q => { const v = new THREE.Vector3().fromBufferAttribute(bp, k + q); P.push(v); C.push(stone(v.clone().multiplyScalar(1.3), col).clone().multiplyScalar(0.8)); return P.length - 1; });
      tris.push(ids);
    }
    // non-indexed, with barycentric coordinates for the wireframe
    const pos = new Float32Array(tris.length * 9), cols = new Float32Array(tris.length * 9), bary = new Float32Array(tris.length * 9);
    tris.forEach((t3, k) => t3.forEach((v, q) => { pos.set(P[v].toArray(), k * 9 + q * 3); cols.set([C[v].r, C[v].g, C[v].b], k * 9 + q * 3); bary[k * 9 + q * 3 + q] = 1; }));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geo.setAttribute('bary', new THREE.BufferAttribute(bary, 3));
    geo.computeVertexNormals();
    const uni = { uWire: { value: 0 }, uAlpha: { value: 1 }, uWipe: { value: 1.35 } };
    const statueMat = new THREE.ShaderMaterial({
      uniforms: uni, transparent: true,
      vertexShader: `attribute vec3 color; attribute vec3 bary; varying vec3 vC, vB, vN, vP;
        void main() { vC = color; vB = bary; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform float uWire, uAlpha, uWipe; varying vec3 vC, vB, vN, vP;
        void main() {
          vec3 n = normalize(vN), v = normalize(cameraPosition - vP);
          if (dot(n, v) < 0.0) n = -n;
          float dif = max(dot(n, normalize(vec3(-0.5, 0.75, 0.55))), 0.0), sky = 0.5 + 0.5 * n.y;
          // the texture arrives as a soft band sweeping up the head, straight from grey to stone
          float tex = 1.0 - smoothstep(uWipe - 0.25, uWipe, (vP.y + 0.7) / 3.75);
          vec3 alb = mix(vec3(0.55, 0.55, 0.56), vC * 1.25, tex);
          vec3 col = alb * (0.22 + 0.85 * dif + 0.25 * sky);
          vec3 e = vB / fwidth(vB);
          float wire = 1.0 - smoothstep(0.25, 1.0, min(min(e.x, e.y), e.z));
          wire *= smoothstep(0.4, 0.22, max(max(fwidth(vB.x), fwidth(vB.y)), fwidth(vB.z)));    // fade where triangles get tiny
          col = mix(col, vec3(0.2, 0.75, 0.95), wire * uWire * 0.45 * (1.0 - tex));   // no wire on the textured part
          gl_FragColor = vec4(pow(col, vec3(1.0 / 2.2)), uAlpha);
        }`,
    });
    const statue = new THREE.Mesh(geo, statueMat);
    const world = new THREE.Group(); world.add(statue); scene.add(world);

    // the 30 cameras, all aimed at the head: a ring of 12 above it, and on each side three columns of three
    // (60°, 90° and 120° round from the front, at heights 0.6, 1.5 and 2.4), so none ever stands between the viewer and
    // the head, whichever way the view swings
    const cams = [];
    const aim = (p, look) => { const c = new THREE.PerspectiveCamera(38, 1.5, 0.1, 20); c.position.copy(p); c.lookAt(look); c.updateMatrixWorld(); return c; };
    for (let k = 0; k < 12; k++) {
      const a = TAU * (k + 0.5) / 12;
      cams.push({ c: aim(new THREE.Vector3(1.9 * Math.sin(a), 3.85, 1.9 * Math.cos(a)), new THREE.Vector3(0, 2.0, 0)), a });
    }
    for (const side of [-1, 1]) for (const deg of [60, 90, 120]) for (const y of [0.6, 1.5, 2.4]) {
      const a = side * deg * Math.PI / 180;
      cams.push({ c: aim(new THREE.Vector3(2.25 * Math.sin(a), y, 2.25 * Math.cos(a)), new THREE.Vector3(0, 1.5 + (y - 1.5) * 0.3, 0)), a, side, deg, y });
    }
    cams.sort((u, v) => u.a - v.a || u.c.position.y - v.c.position.y);
    const res = new THREE.Vector2(W, H);
    const frustMat = new LineMaterial({ color: '#9FD8FF', linewidth: 2.2, resolution: res, transparent: true, depthWrite: false });
    const frust = new LineSegments2(new LineSegmentsGeometry(), frustMat); world.add(frust);
    const shotGeo = new THREE.PlaneGeometry(0.3, 0.2);
    const shots = new THREE.InstancedMesh(shotGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }), cams.length);
    world.add(shots);

    // what the two matching cameras saw (rendered once, for the inset)
    const pick = deg => cams.find(k => k.side === 1 && k.deg === deg && k.y === 1.5).c;   // two neighbours on the right
    const [A, B] = [pick(60), pick(90)];
    const snap = cam => {
      const tw = 450, th = 300, rt = new THREE.WebGLRenderTarget(tw, th, { samples: 4 });
      rt.texture.colorSpace = THREE.SRGBColorSpace;
      const c2 = cam.clone(); c2.aspect = 1.5; c2.fov = 62; c2.updateProjectionMatrix(); // a wider lens: the whole head in frame
      const s2 = new THREE.Scene(); s2.background = new THREE.Color('#2A2F38');
      const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
      const sun = new THREE.DirectionalLight('#FFF1DD', 2.2); sun.position.set(-3, 6, 4);
      s2.add(m, new THREE.HemisphereLight('#DDE6FF', '#30261C', 1.4), sun);
      renderer.setRenderTarget(rt); renderer.render(s2, c2); renderer.setRenderTarget(null);
      const px = new Uint8Array(tw * th * 4); renderer.readRenderTargetPixels(rt, 0, 0, tw, th, px);
      const cv = document.createElement('canvas'); cv.width = tw; cv.height = th;
      const id = cv.getContext('2d').createImageData(tw, th);
      for (let y = 0; y < th; y++) id.data.set(px.subarray((th - 1 - y) * tw * 4, (th - y) * tw * 4), y * tw * 4);
      cv.getContext('2d').putImageData(id, 0, 0);
      rt.dispose();
      return { cv, cam: c2 };
    };
    this.photos = [snap(A), snap(B)];

    // points on the surface, area-weighted, with their colours
    const r = rng(302), areas = [], acc = [];
    let total = 0;
    tris.forEach(([a, b1, c]) => { const s = new THREE.Vector3().subVectors(P[b1], P[a]).cross(new THREE.Vector3().subVectors(P[c], P[a])).length() / 2; total += s; acc.push(total); });
    const sample = () => {
      const x = r() * total; let lo = 0, hi = acc.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (acc[mid] < x) lo = mid + 1; else hi = mid; }
      const [a, b1, c] = tris[lo]; let u = r(), v = r(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
      const p = P[a].clone().multiplyScalar(1 - u - v).addScaledVector(P[b1], u).addScaledVector(P[c], v);
      const cc = C[a].clone().multiplyScalar(1 - u - v).add(C[b1].clone().multiplyScalar(u)).add(C[c].clone().multiplyScalar(v));
      return [p, cc];
    };
    const cloud = (count, size, white) => {
      const pp = new Float32Array(count * 3), cc = new Float32Array(count * 3), sd = new Float32Array(count);
      for (let k = 0; k < count; k++) {
        const [p, c] = sample();
        pp.set(p.toArray(), k * 3); c.lerp(new THREE.Color(1, 1, 1), white).multiplyScalar(1.3); cc.set([c.r, c.g, c.b], k * 3); sd[k] = r();
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pp, 3));
      g.setAttribute('color', new THREE.BufferAttribute(cc, 3));
      g.setAttribute('seed', new THREE.BufferAttribute(sd, 1));
      const m = new THREE.ShaderMaterial({
        uniforms: { uShow: { value: 0 }, uSize: { value: size } },
        vertexShader: `attribute vec3 color; attribute float seed; uniform float uShow, uSize; varying vec3 vC;
          void main() { vC = color; float k = clamp((uShow * 1.3 - seed) / 0.3, 0.0, 1.0);
            gl_PointSize = uSize * k; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `varying vec3 vC; void main() { float d = length(gl_PointCoord - 0.5);   // soft round dots (alpha to coverage)
            gl_FragColor = vec4(pow(vC * (1.0 - 0.2 * smoothstep(0.15, 0.5, d)), vec3(1.0 / 2.2)), 1.0 - smoothstep(0.32, 0.5, d)); }`,
        alphaToCoverage: true,
      });
      const pts = new THREE.Points(g, m); world.add(pts);
      return { pts, m, pp };
    };
    const sparse = cloud(1500, 8.0, 0.35), dense = cloud(36000, 4.2, 0.0);
    // the matched features: 48 sparse points both cameras can see, with rays from each camera
    const feats = [];
    const inPhoto = p => this.photos.map(({ cam }) => { const q = p.clone().project(cam); return [(q.x + 1) / 2, (1 - q.y) / 2]; });
    for (let k = 0; feats.length < 48 && k < 1500; k++) {
      const p = new THREE.Vector3().fromArray(sparse.pp, k * 3);
      if (p.z > 0.3 && inPhoto(p).every(([x, y]) => x > 0.05 && x < 0.95 && y > 0.05 && y < 0.95)) feats.push(p);
    }
    this.matches = feats.map(inPhoto);
    const rayMat = new LineMaterial({ color: '#FFD27A', linewidth: 1.6, resolution: res, transparent: true, depthWrite: false });
    const rays = new LineSegments2(new LineSegmentsGeometry(), rayMat); world.add(rays);
    const hit = new THREE.InstancedMesh(new THREE.SphereGeometry(0.028, 12, 8), new THREE.MeshBasicMaterial({ color: '#FFE3A3', toneMapped: false }), feats.length);
    world.add(hit);

    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), tmp = new THREE.Vector3(), white = new THREE.Color();
    return {
      scene, camera,
      update(t) {
        const yaw = 0.3 * Math.cos(TAU * (t - 2.9) / 5), d = 15.2;   // the view turns slowest while the clouds are up
        camera.position.set(d * Math.sin(yaw) * 0.94, 6.0, d * Math.cos(yaw) * 0.94);
        camera.lookAt(0, 1.3, 0);
        const st = k => span(t, T[k], T[k + 1]);
        // the head: real (textured) -> ghost while matching -> gone -> grey mesh with wireframe -> texture sweeps on
        const ghost = ease.inOut(span(t, T[1], T[1] + 0.25)), meshIn = ease.inOut(span(t, T[4], T[4] + 0.35));
        statue.visible = t < T[2] + 0.05 || t > T[4];
        uni.uAlpha.value = t < T[2] + 0.05 ? 1 - 0.85 * ghost - 0.15 * ease.inOut(span(t, T[2] - 0.2, T[2] + 0.05)) : meshIn;
        uni.uWipe.value = t < T[4] ? 1.35 : -0.1 + 1.45 * ease.inOut(span(t, T[5] + 0.05, T[5] + 0.65));
        // the wireframe goes before the texture comes, so the grey mesh turns straight into stone
        uni.uWire.value = t < T[4] ? 0 : meshIn * (1 - ease.inOut(span(t, T[5] - 0.15, T[5] + 0.05)));
        statue.material.depthWrite = uni.uAlpha.value > 0.99;
        // cameras pop in one by one, flash as they shoot, and leave at the end
        const fr = [], camShow = cams.map((_, k) => ease.out(span(t, T[0] + k * 0.022, T[0] + k * 0.022 + 0.25)) * (1 - ease.inOut(span(t, 4.35, 4.85))));
        cams.forEach(({ c }, k) => {
          const g = camShow[k];
          const o = c.position, dir = c.getWorldDirection(tmp.set(0, 0, 0)).clone(), up = new THREE.Vector3(0, 1, 0).applyQuaternion(c.quaternion), rt = dir.clone().cross(up);
          const cc = o.clone().addScaledVector(dir, 0.34 * g);
          const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => cc.clone().addScaledVector(rt, 0.15 * x * g).addScaledVector(up, 0.1 * y * g));
          if (g > 0.001) corners.forEach((p, i) => { fr.push(...o.toArray(), ...p.toArray(), ...p.toArray(), ...corners[(i + 1) % 4].toArray()); });
          const flash = Math.exp(-Math.max(0, t - (T[0] + k * 0.022 + 0.15)) * 6) * (t > T[0] + k * 0.022 + 0.15 ? 1 : 0);
          shots.setMatrixAt(k, m4.compose(cc, c.quaternion, s3.setScalar(Math.max(g, 1e-4))));
          shots.setColorAt(k, white.setRGB(0.1 + 0.8 * flash, 0.14 + 0.8 * flash, 0.22 + 0.75 * flash));
        });
        const fg = new LineSegmentsGeometry(); if (fr.length) fg.setPositions(fr);
        frust.geometry.dispose(); frust.geometry = fg; frust.visible = fr.length > 0;
        shots.instanceMatrix.needsUpdate = true; shots.instanceColor.needsUpdate = true;
        // matching: rays from the two cameras reach the shared features
        const rayK = ease.inOut(span(t, T[1] + 0.15, T[1] + 0.6)), rayOut = 1 - ease.inOut(span(t, T[2] + 0.1, T[2] + 0.4));
        const rs = [];
        feats.forEach((p, i) => {
          const k = clamp(rayK * 1.6 - (i / feats.length) * 0.6);
          if (k <= 0) return;
          for (const c of [A, B]) rs.push(...c.position.toArray(), ...c.position.clone().lerp(p, k).toArray());
          hit.setMatrixAt(i, m4.compose(p, q, s3.setScalar(k >= 1 ? rayOut : 0.001)));
        });
        if (rayK <= 0) feats.forEach((p, i) => hit.setMatrixAt(i, m4.makeScale(0, 0, 0)));
        hit.instanceMatrix.needsUpdate = true;
        const rg = new LineSegmentsGeometry(); if (rs.length) rg.setPositions(rs);
        rays.geometry.dispose(); rays.geometry = rg; rays.visible = rs.length > 0 && rayOut > 0.002;
        rayMat.opacity = 0.55 * rayOut;
        // the clouds
        sparse.m.uniforms.uShow.value = ease.inOut(span(t, T[2], T[2] + 0.45)) * (1 - ease.inOut(span(t, T[3] + 0.2, T[3] + 0.6)));
        dense.m.uniforms.uShow.value = ease.inOut(span(t, T[3], T[3] + 0.5)) * (1 - ease.inOut(span(t, T[4] + 0.15, T[4] + 0.5)));
        sparse.pts.visible = sparse.m.uniforms.uShow.value > 0; dense.pts.visible = dense.m.uniforms.uShow.value > 0;
      },
    };
  },
  // the stage list, and the two matched photos during feature matching
  overlay(ctx, t, W, H) {
    const inset = ease.inOut(span(t, T[1] + 0.05, T[1] + 0.25)) * (1 - ease.inOut(span(t, T[2] - 0.1, T[2] + 0.1)));
    if (inset > 0) {
      ctx.globalAlpha = inset;
      const y0 = 1380, w = 450, h = 300, xs = [W / 2 - w - 12, W / 2 + 12];
      xs.forEach((x, k) => {
        ctx.drawImage(this.photos[k].cv, x, y0, w, h);
        ctx.strokeStyle = 'rgba(200, 225, 255, 0.6)'; ctx.lineWidth = 2; ctx.strokeRect(x, y0, w, h);
      });
      const n = this.matches.length, k = ease.inOut(span(t, T[1] + 0.15, T[1] + 0.6)) * n;
      this.matches.forEach(([p, q], i) => {
        if (i > k) return;
        const al = clamp(k - i);
        ctx.strokeStyle = `hsla(${(i * 47) % 360}, 90%, 65%, ${0.8 * al})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(xs[0] + p[0] * w, y0 + p[1] * h); ctx.lineTo(xs[1] + q[0] * w, y0 + q[1] * h); ctx.stroke();
        ctx.fillStyle = `hsla(${(i * 47) % 360}, 90%, 70%, ${al})`;
        for (const [x, y] of [[xs[0] + p[0] * w, y0 + p[1] * h], [xs[1] + q[0] * w, y0 + q[1] * h]]) { ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fill(); }
      });
      ctx.globalAlpha = 1;
    }
    // stage list: 2 rows of 3
    STAGES.forEach(([name, note], i) => {
      const on = Math.sin(Math.PI * clamp((t - T[i] + 0.12) / (T[i + 1] - T[i] + 0.24))) ** 0.6 * (t > T[i] - 0.12 && t < T[i + 1] + 0.12 ? 1 : 0);
      const x = W / 2 + ((i % 3) - 1) * 330, y = 1745 + Math.floor(i / 3) * 92;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = `rgba(${120 + 135 * on}, ${170 + 40 * on}, ${220 - 80 * on}, ${0.35 + 0.65 * on})`;
      ctx.beginPath(); ctx.arc(x - 125, y - 12, 15, 0, TAU); ctx.fill();
      ctx.font = `700 20px ${FONT.sans}`; ctx.fillStyle = '#0B0F17'; ctx.fillText(String(i + 1), x - 125, y - 11);
      ctx.textAlign = 'left';
      ctx.font = `600 27px ${FONT.sans}`; ctx.fillStyle = `rgba(235, 242, 255, ${0.4 + 0.6 * on})`;
      ctx.fillText(name, x - 100, y - 12);
      ctx.font = `500 21px ${FONT.mono}`; ctx.fillStyle = `rgba(160, 210, 255, ${0.3 + 0.6 * on})`;
      ctx.fillText(note, x - 100, y + 18);
    });
  },
};
