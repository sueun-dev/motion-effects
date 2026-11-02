// Voxel Space (the Comanche terrain renderer): the world is just two 512 x 512 images, a height map and a colour map
// with the sunset light already baked in. For every screen column the renderer steps away from the camera, front to
// back, with steps that grow with distance; each step projects its height to a screen row and draws a vertical span
// up from the highest row drawn so far (the y-buffer), so hidden terrain costs nothing. The shader does the same per
// pixel (the first step whose span reaches this row colours it, refined between the last two steps), reading the
// maps with mip levels that grow with distance, 2 x 2 samples per pixel at 4 moments of the frame (motion blur). The diagram traces the centre column: steps
// front to back, visible ones raising the y-buffer, hidden ones greyed. Both maps repeat, and the flight along the
// river valley covers exactly one map length per loop.
import * as THREE from 'three';
import { TAU, FONT, phase, clamp, smoothstep, lerp } from '../lib/util.js';

const N = 512, HS = 1.0;                                  // map size, height scale (map units per height unit)
const VX = 40, VY = 300, VW = 1000, VH = 860;             // main view
const F = 560, HZ = 290, ALT = 200;                       // focal length (px), horizon row in the view, flight altitude
const WL = 22;                                            // water level
const pathX = v => 256 + 22 * Math.sin(TAU * v / N) + 6 * Math.sin(2 * TAU * v / N + 1.2);    // the river valley
const SUN = (() => { const s = [-0.62, -0.62, 0.48], l = Math.hypot(...s); return s.map(q => q / l); })();   // (u, v, up)

// camera: along the valley, one map length per loop, heading towards the valley 200 units ahead (a slow, steady turn)
function cam(t) {
  const v = N * (1 - phase(t)), u = pathX(v), a = Math.atan2(pathX(v - 200) - u, 200);
  return { u, v, a, fwd: [Math.sin(a), -Math.cos(a)], rt: [Math.cos(a), Math.sin(a)] };
}

// periodic gradient noise (period p lattice cells on both axes)
function hash(i, j, s) {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(s, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function pnoise(x, y, p, s) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const g = (i, j, dx, dy) => { const a = hash(((i % p) + p) % p, ((j % p) + p) % p, s) * TAU; return Math.cos(a) * dx + Math.sin(a) * dy; };
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  return lerp(lerp(g(ix, iy, fx, fy), g(ix + 1, iy, fx - 1, fy), u), lerp(g(ix, iy + 1, fx, fy - 1), g(ix + 1, iy + 1, fx - 1, fy - 1), u), v);
}

// the two maps (and float heights for the diagram)
function buildMaps() {
  const H = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let big = 0, ridge = 0, a = 1;
    for (let k = 0; k < 4; k++) {
      const p = 4 << k, f = p / N;
      big += a * pnoise(x * f, y * f, p, 11 + k);
      const r = 1 - Math.abs(pnoise(x * f + 3.1, y * f + 7.7, p, 31 + k));
      ridge += a * r * r; a *= 0.5;
    }
    const d = Math.abs(x - pathX(y));
    let h = 30 + 95 * (big + 0.35) + 70 * smoothstep(0.6, 1.3, ridge) * smoothstep(-0.2, 0.5, big);
    h = lerp(WL - 6 + 0.1 * h, h, smoothstep(34, 120, d));                    // carve the valley and its river
    H[y * N + x] = clamp(h, WL - 6, 240);
  }
  const at = (x, y) => H[(((y % N) + N) % N) * N + (((x % N) + N) % N)];
  const col = document.createElement('canvas'), hgt = document.createElement('canvas');
  col.width = col.height = hgt.width = hgt.height = N;
  const ci = col.getContext('2d').createImageData(N, N), hi = hgt.getContext('2d').createImageData(N, N);
  const data = new Uint8Array(N * N * 4);
  const mix3 = (a, b, k) => a.map((q, i) => q + (b[i] - q) * k);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const h = Math.max(at(x, y), WL), o = (y * N + x) * 4;
    const nx = at(x - 2, y) - at(x + 2, y), ny = at(x, y - 2) - at(x, y + 2), nz = 4;
    const nl = Math.hypot(nx, ny, nz), ndl = Math.max(0, (nx * SUN[0] + ny * SUN[1] + nz * SUN[2]) / nl), slope = 1 - nz / nl;
    let vis = 1;                                                              // baked shadow: march towards the sun
    for (let s = 1; s < 90 && vis > 0; s++) {
      const d = s * 2, ry = h + SUN[2] / Math.hypot(SUN[0], SUN[1]) * d;
      const th = at(Math.round(x + SUN[0] / Math.hypot(SUN[0], SUN[1]) * d), Math.round(y + SUN[1] / Math.hypot(SUN[0], SUN[1]) * d));
      vis = Math.min(vis, clamp((ry - th) / (0.08 * d) + 0.5));
      if (ry > 250) break;
    }
    let alb;
    if (at(x, y) < WL) alb = mix3([40, 52, 110], [230, 120, 90], clamp(0.5 + 0.5 * Math.sin(x * 0.02 + y * 0.013)) * 0.35);
    else {
      alb = mix3([214, 170, 110], [96, 130, 60], smoothstep(WL + 2, WL + 10, h));          // sand to grass
      alb = mix3(alb, [52, 92, 52], smoothstep(60, 100, h));                                // forest
      alb = mix3(alb, [128, 100, 84], clamp(smoothstep(0.35, 0.55, slope) + smoothstep(120, 150, h)));   // rock
      alb = mix3(alb, [246, 238, 240], smoothstep(175, 195, h) * (1 - smoothstep(0.55, 0.75, slope)));   // snow
    }
    const lit = at(x, y) < WL ? 1.0 : 0.32 + 1.15 * ndl * vis;
    const c = alb.map((q, i) => clamp(q * lit * [1.08, 0.86, 0.80][i] + [24, 10, 34][i] * (1 - vis * ndl), 0, 255));
    data.set([c[0], c[1], c[2], Math.round(h)], o);
    ci.data.set([c[0], c[1], c[2], 255], o);
    const g = Math.round(clamp(h / 230) * 235 + 10);
    hi.data.set([g, g, g, 255], o);
  }
  col.getContext('2d').putImageData(ci, 0, 0);
  hgt.getContext('2d').putImageData(hi, 0, 0);
  const soft = src => {                                   // softened copies for the insets: fine detail would shimmer as they scroll
    const c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d');
    for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) { g.filter = 'blur(3px)'; g.drawImage(src, dx, dy); }
    return c;
  };
  const hf = new Float32Array(N * N);                     // float heights (water flattened) with their own mip chain
  for (let i = 0; i < N * N; i++) hf[i] = Math.max(H[i], WL);
  const mips = [{ data: hf, width: N, height: N }];
  for (let w = N / 2; w >= 1; w /= 2) {
    const up = mips[mips.length - 1].data, d = new Float32Array(w * w);
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) d[y * w + x] = (up[2 * y * 2 * w + 2 * x] + up[2 * y * 2 * w + 2 * x + 1] + up[(2 * y + 1) * 2 * w + 2 * x] + up[(2 * y + 1) * 2 * w + 2 * x + 1]) / 4;
    mips.push({ data: d, width: w, height: w });
  }
  return { H, hf, mips, data, col: soft(col), hgt: soft(hgt) };
}

let maps = null;                                          // built once in setup; read by the overlay
const sampleMap = (u, v) => {                             // bilinear height and colour at a map point
  const x = u - 0.5, y = v - 0.5, ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const idx = (i, j) => ((((iy + j) % N) + N) % N) * N + ((((ix + i) % N) + N) % N);
  const w = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy], k = [idx(0, 0), idx(1, 0), idx(0, 1), idx(1, 1)];
  let h = 0; const c = [0, 0, 0];
  k.forEach((q, n) => { h += w[n] * maps.hf[q]; for (let i = 0; i < 3; i++) c[i] += w[n] * maps.data[q * 4 + i]; });
  return { h: h * HS, c };
};

export default {
  name: 'Voxel Space',
  ko: '복셀 스페이스',
  three(renderer, W, H) {
    maps = buildMaps();
    const tex = new THREE.DataTexture(maps.data, N, N, THREE.RGBAFormat);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true;
    tex.needsUpdate = true;
    const htex = new THREE.DataTexture(maps.hf, N, N, THREE.RedFormat, THREE.FloatType);
    htex.mipmaps = maps.mips; htex.generateMipmaps = false;
    htex.wrapS = htex.wrapT = THREE.RepeatWrapping;
    htex.magFilter = THREE.LinearFilter; htex.minFilter = THREE.LinearMipmapLinearFilter;
    htex.needsUpdate = true;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: tex }, uH: { value: htex }, uC: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) } },
      vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D uMap, uH; uniform vec3 uC[4];   // camera (u, v, heading) at four moments inside the frame
        const float F = ${F}.0, HZ = ${HZ}.0, ALT = ${ALT}.0, NM = ${N}.0, HS = ${HS.toFixed(2)};
        vec3 sky(vec2 s, float uYaw) {
          float e = (HZ - s.y) / F;                                     // elevation of this pixel's ray (radians, approx.)
          vec3 c = mix(vec3(1.0, 0.62, 0.42), vec3(0.78, 0.36, 0.52), smoothstep(0.0, 0.25, e));
          c = mix(c, vec3(0.20, 0.13, 0.36), smoothstep(0.2, 0.62, e));
          float az = atan((s.x - 500.0) / F) + uYaw + 0.62;             // the sun sits low, ahead and to the left
          float d = length(vec2(az, e - 0.06));
          c += vec3(1.0, 0.75, 0.45) * (exp(-d * 9.0) * 0.55 + smoothstep(0.052, 0.046, d) * 0.9);
          c = mix(c, vec3(1.0, 0.70, 0.55), smoothstep(0.012, 0.0, abs(e - 0.16 - 0.02 * sin(az * 5.0))) * 0.35);   // thin cloud bands
          c = mix(c, vec3(0.95, 0.55, 0.55), smoothstep(0.010, 0.0, abs(e - 0.27 - 0.03 * sin(az * 3.0 + 1.0))) * 0.25);
          return c;
        }
        // terrain height minus the pixel ray's height at distance z (> 0: the step's span reaches this row)
        float gap(vec2 cam, vec2 dir, float yp, float z) {
          float lod = log2(max(1.0, max(0.6, z * 0.005) * 1.2));       // heights blurred to the step size: no skipped ridges
          return textureLod(uH, (cam + dir * z) / NM, lod).r * HS - (ALT - yp * z / F);
        }
        vec3 view(vec2 s, vec2 uCam, float uYaw) {                      // s: view px, y down
          vec2 fw = vec2(sin(uYaw), -cos(uYaw)), rt = vec2(cos(uYaw), sin(uYaw));
          vec2 dir = fw + rt * (s.x - 500.0) / F;
          float yp = s.y - HZ, z = 8.0, pz = 8.0, pd = -1e9;
          for (int i = 0; i < 860; i++) {
            float d = gap(uCam, dir, yp, z);
            if (d > 0.0) {
              float a = pz, b = z, da = pd, db = d;                     // pin the hit down between the last two steps
              for (int r = 0; r < 5; r++) {
                float m = mix(a, b, da / (da - db)), dm = gap(uCam, dir, yp, m);
                if (dm > 0.0) { b = m; db = dm; } else { a = m; da = dm; }
              }
              float zh = mix(a, b, da / (da - db));
              vec3 c = textureLod(uMap, (uCam + dir * zh) / NM, log2(max(1.0, 0.5 * zh / F))).rgb;
              return mix(c, vec3(0.98, 0.62, 0.50), 1.0 - exp(-zh / 950.0));
            }
            pz = z; pd = d;
            z += max(0.6, z * 0.005);
            if (z > 2600.0) break;
          }
          return sky(s, uYaw);
        }
        void main() {
          vec2 p = vec2(gl_FragCoord.x, ${H}.0 - gl_FragCoord.y);
          vec2 q = abs(p - vec2(${VX + VW / 2}.0, ${VY + VH / 2}.0)) - vec2(${VW / 2 - 26}.0, ${VH / 2 - 26}.0);
          float box = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 26.0;
          vec3 bg = mix(vec3(0.07, 0.05, 0.12), vec3(0.11, 0.07, 0.16), p.y / ${H}.0);
          if (box > 1.0) { gl_FragColor = vec4(bg, 1.0); return; }
          vec3 col = vec3(0.0);
          for (int k = 0; k < 4; k++) for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++)   // 2 x 2 samples x 4 moments: motion blur
            col += view(p - vec2(${VX}.0, ${VY}.0) + (vec2(i, j) - 0.5) * 0.5, uC[k].xy, uC[k].z);
          gl_FragColor = vec4(mix(col / 16.0, bg, clamp(box + 0.5, 0.0, 1.0)), 1.0);
        }`,
    });
    const scene = new THREE.Scene(), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    quad.frustumCulled = false; scene.add(quad);
    return {
      scene, camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
      update(t) { mat.uniforms.uC.value.forEach((q, k) => { const c = cam(t + ((k + 0.5) / 4 - 0.5) / 30); q.set(c.u, c.v, c.a); }); },
    };
  },
  overlay(ctx, t, W, H) {
    const c = cam(t);
    // the traced column in the view
    ctx.strokeStyle = 'rgba(255, 216, 77, 0.9)'; ctx.lineWidth = 3; ctx.setLineDash([14, 10]);
    ctx.beginPath(); ctx.moveTo(VX + VW / 2, VY + 20); ctx.lineTo(VX + VW / 2, VY + VH - 20); ctx.stroke();
    ctx.setLineDash([]);

    // the two maps, scrolling under the camera, with the view wedge
    const inset = (img, x, y, s, title) => {
      ctx.save();
      ctx.beginPath(); ctx.roundRect(x, y, s, s, 18); ctx.clip();
      const sc = s / 300, pat = ctx.createPattern(img, 'repeat');
      const ox = x + s / 2, oy = y + s * 0.82;
      pat.setTransform(new DOMMatrix([sc, 0, 0, sc, ox - c.u * sc, oy - c.v * sc]));
      ctx.fillStyle = pat; ctx.fillRect(x, y, s, s);
      const P = (z, l) => [ox + (c.fwd[0] * z + c.rt[0] * l) * sc, oy + (c.fwd[1] * z + c.rt[1] * l) * sc];
      const half = (VW / 2) / F, far = 420;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'; ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(...P(far, -half * far)); ctx.lineTo(...P(far, half * far)); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(...P(far, -half * far)); ctx.lineTo(ox, oy); ctx.lineTo(...P(far, half * far)); ctx.stroke();
      ctx.strokeStyle = '#FFD84D'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(...P(far, 0)); ctx.stroke();
      ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(ox, oy, 7, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(x, y, s, s, 18); ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; ctx.font = `700 23px ${FONT.sans}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(title, x + 2, y - 14);
    };
    inset(maps.hgt, 40, 1246, 280, 'HEIGHT MAP');
    inset(maps.col, 40, 1584, 280, 'COLOUR MAP');

    // the centre column, front to back: step k at distance z_k, its span on screen, and the y-buffer
    const DX = 350, DY = 1246, DW = 690, DH = 618, SW = 70;  // diagram box, screen strip width
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'; ctx.beginPath(); ctx.roundRect(DX, DY, DW, DH, 18); ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; ctx.font = `700 23px ${FONT.sans}`; ctx.textAlign = 'left';
    ctx.fillText('CENTRE COLUMN · FRONT TO BACK + Y-BUFFER', DX + 2, DY - 14);
    const Z0 = 120, Z1 = 1000, K = 46, gx0 = DX + 74, gx1 = DX + DW - SW - 46, gy0 = DY + DH - 40, sy = 3.0;
    const X = z => gx0 + (z - 0) / Z1 * (gx1 - gx0), Y = h => gy0 - h * sy * (gx1 - gx0) / Z1 * 1.0;
    const eye = [X(0), Y(ALT)];
    const prog = clamp(((2 * t / 5) % 1 * 2.5 - 0.1) / 1.9), fade = 1 - smoothstep(2.2, 2.45, (2 * t / 5) % 1 * 2.5);
    // ground profile along the column
    ctx.save();
    ctx.beginPath(); ctx.rect(DX, DY, DW - SW - 20, DH); ctx.clip();
    ctx.fillStyle = 'rgba(150, 110, 130, 0.28)';
    ctx.beginPath(); ctx.moveTo(gx0, gy0);
    for (let x = gx0; x <= gx1 + 30; x += 3) {
      const z = (x - gx0) / (gx1 - gx0) * Z1;
      ctx.lineTo(x, Y(sampleMap(c.u + c.fwd[0] * z, c.v + c.fwd[1] * z).h));
    }
    ctx.lineTo(gx1 + 30, gy0); ctx.fill();
    // the steps: z grows by 4.4 % each; a step is visible when its top projects above the y-buffer so far
    let ybuf = Infinity, lastTop = null;                     // screen row (smaller = higher)
    const spans = [];
    for (let k = 0; k < K; k++) {
      const z = Z0 * 1.044 ** k, m = sampleMap(c.u + c.fwd[0] * z, c.v + c.fwd[1] * z);
      const row = HZ + (ALT - m.h) * F / z, done = (k + 0.5) / K < prog, vis = row < Math.min(ybuf, VH);
      ctx.strokeStyle = 'rgba(170, 170, 190, 0.45)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(X(z), gy0); ctx.lineTo(X(z), Y(m.h)); ctx.stroke();
      if (done && vis) {
        ctx.strokeStyle = `rgba(255, 216, 77, ${fade})`; ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.moveTo(X(z), gy0); ctx.lineTo(X(z), Y(m.h)); ctx.stroke();
        ctx.strokeStyle = `rgba(255, 216, 77, ${0.35 * fade})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(...eye); ctx.lineTo(X(z), Y(m.h)); ctx.stroke();
        spans.push([Math.max(0, row), Math.min(ybuf, VH), m.c]);
        lastTop = [X(z), Y(m.h)];
      }
      if (done) ybuf = Math.min(ybuf, row);
      if (k === Math.floor(prog * K) && prog < 1 && fade > 0) {        // the step being processed now
        ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(X(z), gy0); ctx.lineTo(X(z), Y(m.h)); ctx.stroke();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(...eye); ctx.lineTo(X(z), Y(m.h)); ctx.stroke();
      }
    }
    if (lastTop && fade > 0) {                               // the y-buffer as a line of sight: nothing below it is drawn
      const dx = lastTop[0] - eye[0], dy = lastTop[1] - eye[1], k = Math.min((gx1 + 40 - eye[0]) / dx, (gy0 - eye[1]) / Math.max(dy, 1e-3));
      ctx.strokeStyle = `rgba(255, 120, 150, ${0.9 * fade})`; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.moveTo(...eye); ctx.lineTo(eye[0] + dx * k, eye[1] + dy * k); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(...eye, 9, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; ctx.font = `600 20px ${FONT.sans}`; ctx.textAlign = 'center';
    ctx.fillText('eye', eye[0], eye[1] - 20);
    // the screen column it produces, bottom row first
    const sx = DX + DW - SW - 14, s0 = DY + 30, s1 = DY + DH - 30, R = r => s0 + r / VH * (s1 - s0);
    const skyG = ctx.createLinearGradient(0, s0, 0, R(HZ));       // rows nothing reaches stay sky
    skyG.addColorStop(0, '#3A2456'); skyG.addColorStop(1, '#E88A6A');
    ctx.fillStyle = skyG; ctx.fillRect(sx, s0, SW, s1 - s0);
    ctx.globalAlpha = fade;
    for (const [r0, r1, col] of spans) {
      ctx.fillStyle = `rgb(${col.map(Math.round).join(',')})`; ctx.fillRect(sx, R(r0), SW, R(r1) - R(r0) + 0.5);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; ctx.lineWidth = 2; ctx.strokeRect(sx, s0, SW, s1 - s0);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; ctx.font = `600 20px ${FONT.sans}`;
    ctx.save(); ctx.translate(sx + SW + 22, (s0 + s1) / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('screen column', 0, 0); ctx.restore();
    ctx.textAlign = 'left'; ctx.fillStyle = '#FFD84D'; ctx.fillText('visible step', DX + 24, DY + 36);
    ctx.fillStyle = 'rgba(200, 200, 215, 0.8)'; ctx.fillText('hidden step', DX + 190, DY + 36);
    ctx.fillStyle = '#FF7896'; ctx.fillText('y-buffer', DX + 350, DY + 36);
  },
};
