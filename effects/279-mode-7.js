// Mode 7: an SNES-style kart track. The whole course is ONE flat 256 x 256 map (drawn at 8 texels per map pixel
// into a mipmapped texture). Below a fixed horizon every scanline gets its own distance z = camH * F / (y - horizon), so
// each line is the same map rotated by the heading and scaled by z / F: the per-line matrix the SNES reloads by HDMA.
// Sampling is trilinear + anisotropic with analytic gradients and 3 x 3 supersampling, and the far lines fade into
// haze, so nothing crawls. The sky is a separate layer: two mountain ranges that slide sideways with the heading at
// different rates. The road repeats every 256 map pixels and the kart drives exactly one period per loop.
import * as THREE from 'three';
import { TAU, FONT, phase, rng } from '../lib/util.js';

const M = 256, UP = 8;                                  // map size in map pixels, texels per map pixel
const VX = 40, VY = 300, VW = 1000, VH = 860;            // the game screen
const HZ = 540, F = 700, CAMH = 46;                     // horizon row, focal length (px), camera height (map px)
const MX = 40, MY = 1262, MS = 580, MSC = 1.875;         // map inset: corner, size, px per map pixel
let inset = null;                                        // the map at the inset's scale
const cx = v => 128 + 15 * Math.sin(TAU * v / M) + 3 * Math.sin(2 * TAU * v / M + 0.9);   // road centre
const dcx = v => 15 * TAU / M * Math.cos(TAU * v / M) + 6 * TAU / M * Math.cos(2 * TAU * v / M + 0.9);

// camera on the road centre, one map period per loop, heading towards the road 60 px ahead
function cam(t) {
  const v = M * (1 - phase(t)), u = cx(v), tv = v - 60;
  const a = Math.atan2(cx(tv) - u, v - tv);
  return { u, v, a, fwd: [Math.sin(a), -Math.cos(a)], rt: [Math.cos(a), Math.sin(a)] };
}
// the scanline being explained: glides down from near the horizon to the kart and back
const lineDy = t => 40 + 470 * (0.5 - 0.5 * Math.cos(phase(t) * TAU));

// the course: a 256 x 256 map-pixel layout, evaluated per texel (8 per map pixel) so the road and round edges are
// smooth while the checker squares, curb blocks and item boxes keep their map-pixel grid
function buildMap() {
  const N = M * UP, big = document.createElement('canvas'); big.width = big.height = N;
  const g = big.getContext('2d'), img = g.createImageData(N, N), r = rng(279);
  const hex = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
  const C = Object.fromEntries(Object.entries({
    g1: '#5CBC4B', g2: '#50AE43', road: '#7C7A8C', edge: '#2F6E33',
    red: '#E8414F', white: '#F4F1EA', black: '#22222C', yel: '#FFD23F', org: '#FF8A2A',
    water: '#3C8FE0', shore: '#9AD8FF', sand: '#EED79E', leaf: '#2E8B3A', leafHi: '#55B85A', leafDk: '#1C5E2A', shadow: '#3F9136',
    bush: '#3E9A3E', bushHi: '#7ACB5C', boxBlue: '#3D5BE0',
  }).map(([k, v]) => [k, hex(v)]));
  const RAIN = ['#FF5A5A', '#FFB13D', '#FFE45C', '#5CE07A', '#4CC3FF', '#A07BFF'].map(hex);
  const trees = [[216, 38, 11], [232, 112, 9], [22, 92, 10], [212, 196, 12], [34, 236, 9], [236, 160, 8], [58, 18, 8]];
  const QM = ['.###.', '...#.', '..#..', '.....', '..#..'];
  const bushes = [];                                                                   // small round bushes off the road
  while (bushes.length < 16) {
    const bx = 12 + r() * 232, by = r() * M;
    if (Math.abs(bx - cx(by)) > 36 && Math.hypot((bx - 36) / 30, (by - 176) / 38) > 1) bushes.push([bx, by]);
  }
  const px = (u, v, c, k) => {                                                          // c, k: road centre, 1 / |tangent|
    const d = (u - c) * k, ad = Math.abs(d);
    if (ad < 17) {
      if (v >= 248) return (Math.floor(u / 4) + Math.floor(v / 4)) % 2 ? C.white : C.black;   // checkered start line
      if (v >= 60 && v < 78 && ad < 8) return (v - 60 + ad * 0.9) % 6 < 3 ? C.yel : C.org;   // boost pad chevrons
      for (const o of [-10, 0, 10]) {                                                    // three item boxes
        const bx = Math.floor(d - o + 3.5), by = Math.floor(v) - 150;
        if (bx >= 0 && bx < 7 && by >= 0 && by < 7) {
          if (bx === 0 || by === 0 || bx === 6 || by === 6) return RAIN[(bx + by) % 6];
          return QM[by - 1][bx - 1] === '#' ? C.white : C.boxBlue;
        }
      }
      return C.road;
    }
    if (ad < 21) return Math.floor(v / 8) % 2 ? C.red : C.white;                         // curbs, 8 px blocks
    if (ad < 23) return C.edge;
    const pd = Math.hypot((u - 36) / 22, (v - 176) / 30);                                 // pond with a sandy shore
    if (pd < 1) return pd > 0.86 ? C.shore : C.water;
    if (pd < 1.14) return C.sand;
    for (const [tx, ty, tr] of trees) {
      if (Math.abs(u - tx) > tr + 3 || Math.abs(v - ty) > tr + 3) continue;
      const dd = Math.hypot(u - tx, v - ty);
      if (dd < tr) return dd > tr - 1.5 ? C.leafDk : Math.hypot(u - tx + 3, v - ty + 3) < tr * 0.45 ? C.leafHi : C.leaf;
      if (Math.hypot(u - tx - 3, v - ty - 3) < tr) return C.shadow;
    }
    for (const [bx, by] of bushes) {
      if (Math.abs(u - bx) > 5) continue;
      for (const w of [-M, 0, M]) {
        const dd = Math.hypot(u - bx, v - by - w);
        if (dd < 4.5) return Math.hypot(u - bx + 1.5, v - by - w + 1.5) < 1.8 ? C.bushHi : C.bush;
      }
    }
    return (Math.floor(u / 16) + Math.floor(v / 16)) % 2 ? C.g1 : C.g2;               // checkered grass
  };
  for (let y = 0; y < N; y++) {
    const v = (y + 0.5) / UP, c = cx(v), k = 1 / Math.hypot(1, dcx(v));
    for (let x = 0; x < N; x++) {
      const [R, G, B] = px((x + 0.5) / UP, v, c, k), o = (y * N + x) * 4;
      img.data[o] = R; img.data[o + 1] = G; img.data[o + 2] = B; img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return big;
}

// the kart from behind, one string per row of 7 px blocks
const KART = [
  '......RRRRRR......',
  '.....RRWWWWRR.....',
  '.....RRRRRRRR.....',
  '......RRRRRR......',
  '....BBBBBBBBBB....',
  '...BBBBBBBBBBBB...',
  'TT.YYYYYYYYYYYY.TT',
  'TTTYKKKKKKKKKKYTTT',
  'TTTYYYYYYYYYYYYTTT',
  'TTTYGG.YYYY.GGYTTT',
  'TTT.GG......GG.TTT',
  'TT..............TT',
];
const KC = { R: '#E8384F', W: '#FFFFFF', B: '#3A6FE0', T: '#1E1E28', Y: '#FFC93C', K: '#3A3A4C', G: '#A9AEC0' };

export default {
  name: 'Mode 7',
  ko: '모드 7',
  three(renderer, W, H) {
    const map = buildMap();
    const tex = new THREE.CanvasTexture(map);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.flipY = false;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    inset = document.createElement('canvas'); inset.width = inset.height = M * MSC;
    const ig = inset.getContext('2d'); ig.imageSmoothingQuality = 'high'; ig.drawImage(map, 0, 0, M * MSC, M * MSC);

    const mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: tex }, uCam: { value: new THREE.Vector2() }, uYaw: { value: 0 } },
      vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D uMap; uniform vec2 uCam; uniform float uYaw;
        const float HZ = ${HZ}.0, F = ${F}.0, CAMH = ${CAMH}.0, MAP = ${M}.0;
        const vec3 HAZE = vec3(0.80, 0.90, 1.00);
        vec3 ground(vec2 s, float k) {                  // s: screen px (y down); k: sub-sample spacing
          float dy = s.y - HZ, z = CAMH * F / dy, ox = (s.x - 540.0) / F;
          vec2 fw = vec2(sin(uYaw), -cos(uYaw)), rt = vec2(cos(uYaw), sin(uYaw));
          vec2 w = uCam + fw * z + rt * ox * z;
          vec2 gx = rt * z / F, gy = -(z / dy) * (fw + rt * ox);   // d(map) / d(screen px), exact for this line
          vec3 c = textureGrad(uMap, w / MAP, gx * k / MAP, gy * k / MAP).rgb;
          return mix(c, HAZE, 1.0 - exp(-pow(z / 800.0, 1.25)));
        }
        float hills(float x, float a, float b, float c) { return a + b * sin(x * 0.011 + c) + 0.5 * b * sin(x * 0.029 + 2.0 * c) + 0.25 * b * sin(x * 0.067 + c); }
        vec3 sky(vec2 s) {
          float h = HZ - s.y;
          vec3 c = mix(HAZE, vec3(0.33, 0.55, 0.96), smoothstep(0.0, 230.0, h));
          float xc = s.x + uYaw * F * 0.35;                              // clouds: slowest layer
          for (int i = 0; i < 5; i++) {
            float fi = float(i), px = mod(xc - fi * 420.0, 2100.0) - 300.0, py = 150.0 + 30.0 * sin(fi * 2.3);
            float d = min(length(vec2(px, (h - py) * 1.8)) - 70.0, min(length(vec2(px - 70.0, (h - py + 10.0) * 1.8)) - 50.0, length(vec2(px + 66.0, (h - py + 12.0) * 1.8)) - 44.0));
            if (d < 0.0) c = (h - py < -6.0) ? vec3(0.86, 0.92, 1.0) : vec3(1.0);
          }
          float xf = floor((s.x + uYaw * F * 0.55) / 6.0) * 6.0;          // far range, stepped in 6 px blocks
          float hf = floor(hills(xf, 70.0, 26.0, 1.0) / 6.0) * 6.0;
          if (h < hf) c = h > hf - 12.0 && hf > 78.0 ? vec3(0.96, 0.96, 1.0) : mix(vec3(0.45, 0.47, 0.80), vec3(0.62, 0.66, 0.92), step(mod(xf, 60.0), 30.0) * 0.3 + h / hf * 0.5);
          float xn = floor((s.x + uYaw * F) / 6.0) * 6.0;                 // near hills, moving with the ground
          float hn = floor(hills(xn * 1.7, 30.0, 12.0, 0.3) / 6.0) * 6.0;
          if (h < hn) c = mix(vec3(0.20, 0.55, 0.30), vec3(0.32, 0.70, 0.36), step(18.0, h));
          return c;
        }
        void main() {
          vec2 p = vec2(gl_FragCoord.x, ${H}.0 - gl_FragCoord.y);
          vec2 q = abs(p - vec2(${VX + VW / 2}.0, ${VY + VH / 2}.0)) - vec2(${VW / 2 - 28}.0, ${VH / 2 - 28}.0);
          float box = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 28.0;   // rounded game screen
          vec3 bg = mix(vec3(0.06, 0.07, 0.15), vec3(0.10, 0.09, 0.20), p.y / ${H}.0);
          if (box > 1.0) { gl_FragColor = vec4(bg, 1.0); return; }
          vec3 col = vec3(0.0);
          for (int j = 0; j < 3; j++) for (int i = 0; i < 3; i++) {
            vec2 s = p + (vec2(i, j) - 1.0) / 3.0;
            col += s.y > HZ ? ground(s, 1.0 / 3.0) : sky(s);
          }
          col /= 9.0;
          gl_FragColor = vec4(mix(col, bg, clamp(box + 0.5, 0.0, 1.0)), 1.0);
        }`,
    });
    const scene = new THREE.Scene();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    quad.frustumCulled = false;
    scene.add(quad);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    return {
      scene, camera,
      update(t) {
        const c = cam(t);
        mat.uniforms.uCam.value.set(c.u, c.v);
        mat.uniforms.uYaw.value = c.a;
      },
    };
  },
  overlay(ctx, t, W, H) {
    const c = cam(t), dy = lineDy(t), ly = HZ + dy, z = CAMH * F / dy;
    // the kart: on the road 62 map px ahead, projected like the ground
    const kv = c.v - 62, ku = cx(kv), rx = ku - c.u, ry = kv - c.v;
    const kz = rx * c.fwd[0] + ry * c.fwd[1], kl = rx * c.rt[0] + ry * c.rt[1];
    const kx = 540 + kl * F / kz, kyb = HZ + CAMH * F / kz + 2 * Math.sin(phase(t) * TAU * 6);
    const P = 7, kw = KART[0].length * P, kh = KART.length * P;
    ctx.fillStyle = 'rgba(20, 40, 20, 0.35)';
    ctx.beginPath(); ctx.ellipse(kx, kyb + 4, kw * 0.55, 16, 0, 0, TAU); ctx.fill();
    KART.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch === '.') return;
      ctx.fillStyle = KC[ch]; ctx.fillRect(kx - kw / 2 + i * P, kyb - kh + j * P, P + 0.5, P + 0.5);
    }));

    // the scanline being explained
    ctx.save();
    ctx.beginPath(); ctx.roundRect(VX, VY, VW, VH, 28); ctx.clip();
    const glow = ctx.createLinearGradient(0, ly - 14, 0, ly + 14);
    glow.addColorStop(0, 'rgba(255, 216, 77, 0)'); glow.addColorStop(0.5, 'rgba(255, 216, 77, 0.35)'); glow.addColorStop(1, 'rgba(255, 216, 77, 0)');
    ctx.fillStyle = glow; ctx.fillRect(VX, ly - 14, VW, 28);
    ctx.fillStyle = '#FFD84D'; ctx.fillRect(VX, ly - 1.5, VW, 3);
    ctx.restore();
    ctx.fillStyle = '#FFD84D';
    ctx.beginPath(); ctx.roundRect(VX + VW - 182, ly - 21, 162, 42, 21); ctx.fill();
    ctx.fillStyle = '#1A1A2A'; ctx.font = `700 24px ${FONT.mono}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`LINE ${String(Math.round(ly - VY)).padStart(3, ' ')}`, VX + VW - 101, ly + 1);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; ctx.font = `700 24px ${FONT.sans}`; ctx.textAlign = 'left';
    ctx.fillText('HORIZON', VX + 22, HZ - 18);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'; ctx.fillRect(VX + 22, HZ - 1, 120, 2);

    // the flat map, north up, scrolling under the camera, with the view wedge and this scanline's footprint
    ctx.save();
    ctx.beginPath(); ctx.roundRect(MX, MY, MS, MS, 22); ctx.clip();
    const ox = MX + MS / 2, oy = MY + MS * 0.8;                    // the camera's place in the inset
    const pat = ctx.createPattern(inset, 'repeat');                // one seamless repeating map, slid under the camera
    pat.setTransform(new DOMMatrix([1, 0, 0, 1, ox - c.u * MSC, oy - c.v * MSC]));
    ctx.fillStyle = pat; ctx.fillRect(MX, MY, MS, MS);
    ctx.fillStyle = 'rgba(8, 10, 24, 0.28)'; ctx.fillRect(MX, MY, MS, MS);
    const P2 = (z2, l) => [ox + (c.fwd[0] * z2 + c.rt[0] * l) * MSC, oy + (c.fwd[1] * z2 + c.rt[1] * l) * MSC];
    const half = (VW / 2) / F, far = 420;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)'; ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(...P2(far, -half * far)); ctx.lineTo(...P2(far, half * far)); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(...P2(far, -half * far)); ctx.lineTo(ox, oy); ctx.lineTo(...P2(far, half * far)); ctx.stroke();
    const zn = CAMH * F / (VY + VH - HZ);                         // the bottom line of the screen
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(...P2(zn, -half * zn)); ctx.lineTo(...P2(zn, half * zn)); ctx.stroke();
    ctx.strokeStyle = '#FFD84D'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(...P2(z, -half * z)); ctx.lineTo(...P2(z, half * z)); ctx.stroke();
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(ox, oy, 10, 0, TAU); ctx.fill();
    ctx.fillStyle = '#E8384F'; ctx.beginPath(); ctx.arc(ox, oy, 6, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(MX, MY, MS, MS, 22); ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'; ctx.font = `700 24px ${FONT.sans}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('THE WHOLE TRACK = ONE FLAT MAP', MX + 4, MY - 20);

    // the per-line numbers
    const X = 660, deg = c.a * 180 / Math.PI, s = z / F, ca = Math.cos(c.a) * s, sa = Math.sin(c.a) * s;
    const row = (label, value, y, color = '#FFFFFF') => {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'; ctx.font = `600 24px ${FONT.sans}`; ctx.textAlign = 'left';
      ctx.fillText(label, X, y);
      ctx.fillStyle = color; ctx.font = `700 40px ${FONT.mono}`; ctx.fillText(value, X, y + 48);
    };
    row('SCANLINE', `y = ${Math.round(ly - VY)}`, MY + 20, '#FFD84D');
    row('DISTANCE  z = h·F / (y − horizon)', `${z.toFixed(0)} map px`, MY + 132);
    row('ROTATION  θ (heading)', `${deg >= 0 ? '+' : '−'}${Math.abs(deg).toFixed(1)}°`, MY + 244);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'; ctx.font = `600 24px ${FONT.sans}`;
    ctx.fillText('MATRIX  (z/F) · R(θ)', X, MY + 356);
    const f2 = v => (v >= 0 ? ' ' : '−') + Math.abs(v).toFixed(2);
    ctx.font = `700 34px ${FONT.mono}`; ctx.fillStyle = '#9BE7FF';
    ctx.fillText(`${f2(ca)} ${f2(sa)}`, X + 22, MY + 404);
    ctx.fillText(`${f2(-sa)} ${f2(ca)}`, X + 22, MY + 450);
    ctx.strokeStyle = '#9BE7FF'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(X + 12, MY + 372); ctx.lineTo(X + 2, MY + 372); ctx.lineTo(X + 2, MY + 462); ctx.lineTo(X + 12, MY + 462); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X + 330, MY + 372); ctx.lineTo(X + 340, MY + 372); ctx.lineTo(X + 340, MY + 462); ctx.lineTo(X + 330, MY + 462); ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'; ctx.font = `500 23px ${FONT.sans}`;
    ctx.fillText('reloaded for every scanline', X, MY + 516);
    ctx.fillText('(HDMA), so each line is the map', X, MY + 548);
    ctx.fillText('rotated and scaled differently', X, MY + 580);
  },
};
