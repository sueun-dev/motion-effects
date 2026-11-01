// Style transfer, imitated with deterministic filters (no neural network): one content photo of a harbour town is
// repainted in three styles, shown as swatches above. A structure tensor of the photo gives a flow field along its
// edges (curling into vortices where the photo is flat), and each style is built on it: "Swirl" smears fixed noise
// along the flow (line integral convolution) into embossed blue-and-gold strokes; "Pointillist" lays jittered dots
// of pure hues on cream canvas; "Stained glass" breaks it into leaded jewel-tone cells. Each style also remaps the
// photo's tones to its own palette. A soft diagonal wipe sweeps from one style to the next; between wipes it rests.
import * as THREE from 'three';
import { TAU, FONT, rng, smoothstep } from '../lib/util.js';

const CW = 1000, CH = 1150;                                  // content image (px), drawn 1:1 as the result
const RES = [40, 650];                                       // result position on screen (top-left, px)
const NAMES = ['SWIRL', 'POINTILLIST', 'STAINED GLASS'];
// which style is showing: 0 -> 1 -> 2 -> 0, each change a 0.8 s wipe; returns [from, to, progress]
const WIPES = [[1.45, 0, 1], [3.1, 1, 2], [4.85, 2, 0]];     // [start, from, to]; the last one runs across the loop point
function stage(t) {
  for (const [start, a, b] of WIPES) {
    const x = (((t - start) % 5) + 5) % 5 / 0.8;
    if (x < 1) return [a, b, x];
  }
  const s = t < 1.45 ? 0 : t < 3.1 ? 1 : t < 4.85 ? 2 : 0;
  return [s, s, 0];
}

// the content photo: sky, sun and clouds, hills, a row of harbour houses, their reflection, a boat
function photo() {
  const c = document.createElement('canvas');
  c.width = CW; c.height = CH;
  const g = c.getContext('2d'), r = rng(21);
  const sky = g.createLinearGradient(0, 0, 0, 640);
  sky.addColorStop(0, '#4F86C6'); sky.addColorStop(0.6, '#9CC3E4'); sky.addColorStop(1, '#F4D9AE');
  g.fillStyle = sky; g.fillRect(0, 0, CW, 760);
  const sun = g.createRadialGradient(730, 300, 10, 730, 300, 260);
  sun.addColorStop(0, 'rgba(255, 244, 200, 1)'); sun.addColorStop(0.2, 'rgba(255, 230, 160, 0.8)'); sun.addColorStop(1, 'rgba(255, 220, 150, 0)');
  g.fillStyle = sun; g.fillRect(0, 0, CW, 700);
  g.filter = 'blur(10px)'; g.fillStyle = 'rgba(255, 255, 255, 0.85)';
  for (const [x, y, w, h] of [[180, 180, 190, 50], [270, 150, 140, 60], [560, 120, 160, 40], [860, 210, 150, 46], [120, 380, 220, 40]]) { g.beginPath(); g.ellipse(x, y, w, h, 0, 0, TAU); g.fill(); }
  g.filter = 'blur(2px)';
  [['#7FA6B8', 520, 60], ['#5E8A80', 575, 45]].forEach(([col, base, amp], k) => {
    g.fillStyle = col; g.beginPath(); g.moveTo(0, 760);
    for (let x = 0; x <= CW; x += 10) g.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin(x / 140 + k * 2)) - 20 * Math.sin(x / 47 + k));
    g.lineTo(CW, 760); g.fill();
  });
  g.filter = 'none';
  const cols = ['#E9785F', '#F2C14E', '#4FA3A5', '#F6EBD9', '#D9667B', '#8FB573', '#F29E5C', '#6C8EBF', '#EBD3B0'];
  let x = -10;
  const houses = [];
  for (let i = 0; i < 9; i++) {                              // the row of houses on the quay
    const w = 100 + r() * 40, h = 150 + r() * 120, top = 760 - h;
    houses.push([x, w, h]);
    const body = g.createLinearGradient(x, 0, x + w, 0);
    body.addColorStop(0, cols[i]); body.addColorStop(1, shade(cols[i], -0.18));
    g.fillStyle = body; g.fillRect(x, top, w, h);
    g.fillStyle = '#5A3A34';
    g.beginPath(); g.moveTo(x - 6, top); g.lineTo(x + w / 2, top - 46 - r() * 30); g.lineTo(x + w + 6, top); g.fill();
    g.fillStyle = 'rgba(40, 50, 70, 0.75)';
    for (let wy = top + 22; wy < 730; wy += 46) for (let wx = x + 16; wx < x + w - 26; wx += 34) g.fillRect(wx, wy, 18, 26);
    x += w + 2;
  }
  g.fillStyle = '#E8E0D0'; g.fillRect(470, 300, 46, 160); g.fillStyle = '#5A3A34';   // a bell tower behind
  g.beginPath(); g.moveTo(462, 300); g.lineTo(493, 230); g.lineTo(524, 300); g.fill();
  g.fillStyle = '#8B8478'; g.fillRect(0, 758, CW, 16);                                // the quay
  const sea = g.createLinearGradient(0, 774, 0, CH);
  sea.addColorStop(0, '#3E6F8E'); sea.addColorStop(1, '#1D3B57');
  g.fillStyle = sea; g.fillRect(0, 774, CW, CH - 774);
  g.save(); g.globalAlpha = 0.45; g.filter = 'blur(3px)';                              // reflection of the town
  g.translate(0, 1548); g.scale(1, -1); g.drawImage(c, 0, 420, CW, 354, 0, 420, CW, 354); g.restore();
  g.fillStyle = 'rgba(220, 235, 245, 0.35)';
  for (let i = 0; i < 70; i++) g.fillRect(r() * CW, 790 + r() * 340, 20 + r() * 70, 3);
  g.fillStyle = '#C8402F'; g.beginPath(); g.moveTo(250, 930); g.lineTo(420, 930); g.lineTo(390, 965); g.lineTo(275, 965); g.fill();
  g.fillStyle = '#F4EBDD'; g.beginPath(); g.moveTo(330, 925); g.lineTo(330, 820); g.lineTo(395, 925); g.fill();
  return c;
}
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), f = v => Math.round(Math.min(255, Math.max(0, v * (1 + k))));
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

// the flow field: edge directions from a blurred structure tensor, curled into vortices where there are no edges
function flowField(img) {
  const d = img.getContext('2d').getImageData(0, 0, CW, CH).data, N = CW * CH;
  const L = new Float32Array(N);
  for (let i = 0; i < N; i++) L[i] = 0.3 * d[i * 4] + 0.59 * d[i * 4 + 1] + 0.11 * d[i * 4 + 2];
  const blur = (a, r) => {                                   // box blur, 3 passes ~ gaussian
    const tmp = new Float32Array(N);
    for (let pass = 0; pass < 3; pass++) {
      for (let y = 0; y < CH; y++) { let s = 0; for (let x = -r; x <= r; x++) s += a[y * CW + Math.min(CW - 1, Math.max(0, x))];
        for (let x = 0; x < CW; x++) { tmp[y * CW + x] = s / (2 * r + 1); s += a[y * CW + Math.min(CW - 1, x + r + 1)] - a[y * CW + Math.max(0, x - r)]; } }
      for (let x = 0; x < CW; x++) { let s = 0; for (let y = -r; y <= r; y++) s += tmp[Math.min(CH - 1, Math.max(0, y)) * CW + x];
        for (let y = 0; y < CH; y++) { a[y * CW + x] = s / (2 * r + 1); s += tmp[Math.min(CH - 1, y + r + 1) * CW + x] - tmp[Math.max(0, y - r) * CW + x]; } }
    }
    return a;
  };
  blur(L, 1);
  const E = new Float32Array(N), F = new Float32Array(N), G = new Float32Array(N);
  for (let y = 1; y < CH - 1; y++) for (let x = 1; x < CW - 1; x++) {
    const i = y * CW + x;
    const gx = (L[i + 1 - CW] + 2 * L[i + 1] + L[i + 1 + CW]) - (L[i - 1 - CW] + 2 * L[i - 1] + L[i - 1 + CW]);
    const gy = (L[i - 1 + CW] + 2 * L[i + CW] + L[i + 1 + CW]) - (L[i - 1 - CW] + 2 * L[i - CW] + L[i + 1 - CW]);
    E[i] = gx * gx; F[i] = gx * gy; G[i] = gy * gy;
  }
  blur(E, 6); blur(F, 6); blur(G, 6);
  const vort = [[200, 200, 1], [560, 150, -1], [860, 260, 1], [380, 960, -1], [800, 1020, 1]];
  const out = new Uint8Array(N * 4);
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    const i = y * CW + x, e = E[i], f = F[i], gg = G[i];
    const l1 = (e + gg) / 2 + Math.sqrt(((e - gg) / 2) ** 2 + f * f), l2 = (e + gg) / 2 - Math.sqrt(((e - gg) / 2) ** 2 + f * f);
    let tx = f, ty = l2 - e;                                 // eigenvector of the small eigenvalue: along the edge
    if (Math.abs(tx) + Math.abs(ty) < 1e-6) { tx = 1; ty = 0; }
    let n = Math.hypot(tx, ty); tx /= n; ty /= n;
    const coh = Math.min(1, (l1 - l2) / (l1 + l2 + 400));   // how strongly oriented the photo is here
    let sx = 1, sy = 0.15 * Math.sin(x / 90);                // vortices for the flat parts
    for (const [cx, cy, s] of vort) {
      const dx = x - cx, dy = y - cy, r2 = dx * dx + dy * dy, w = 260000 / (r2 + 9000);
      sx += -dy / Math.sqrt(r2 + 1) * s * w * 0.12; sy += dx / Math.sqrt(r2 + 1) * s * w * 0.12;
    }
    n = Math.hypot(sx, sy); sx /= n; sy /= n;
    if (tx * sx + ty * sy < 0) { tx = -tx; ty = -ty; }
    let fx = sx + (tx - sx) * coh, fy = sy + (ty - sy) * coh;
    n = Math.hypot(fx, fy) || 1; fx /= n; fy /= n;
    const o = ((CH - 1 - y) * CW + x) * 4;                   // texture rows bottom-up, y pointing up
    out[o] = Math.round((fx * 0.5 + 0.5) * 255); out[o + 1] = Math.round((-fy * 0.5 + 0.5) * 255); out[o + 2] = Math.round(coh * 255); out[o + 3] = 255;
  }
  const tex = new THREE.DataTexture(out, CW, CH, THREE.RGBAFormat);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

const frag = `
uniform sampler2D tPhoto, tFlow, tNoise; uniform vec3 uStage; uniform vec2 uSwatch[3];
varying vec2 vUv;
const vec2 C = vec2(${CW}.0, ${CH}.0);
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 hash2(vec2 p) { return vec2(hash(p), hash(p + 17.31)); }
vec3 photo(vec2 px) { return texture2D(tPhoto, px / C).rgb; }
vec2 flow(vec2 px) { return texture2D(tFlow, px / C).rg * 2.0 - 1.0; }
float lum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
vec3 ramp(float x, vec3 a, vec3 b, vec3 c, vec3 d) {     // a 4-colour palette ramp
  return x < 0.33 ? mix(a, b, x / 0.33) : x < 0.66 ? mix(b, c, (x - 0.33) / 0.33) : mix(c, d, (x - 0.66) / 0.34);
}
// 1) swirl: line integral convolution of fixed noise along the flow, blue-gold palette, embossed paint
vec3 swirl(vec2 px) {
  float acc = 0.0, w = 0.0;
  for (int dir = -1; dir <= 1; dir += 2) {
    vec2 p = px;
    for (int i = 0; i < 14; i++) {
      vec2 f = flow(p);
      p += f * float(dir) * 1.6;
      float k = 1.0 - float(i) / 14.0;
      acc += texture2D(tNoise, p / 256.0).r * k; w += k;
    }
  }
  float s = acc / w;
  vec3 c = photo(px);
  float l = clamp(lum(c) * 1.15 + (s - 0.5) * 0.35, 0.0, 1.0);
  vec3 col = ramp(l, vec3(0.04, 0.09, 0.27), vec3(0.12, 0.3, 0.62), vec3(0.42, 0.62, 0.78), vec3(0.98, 0.84, 0.36));
  col = mix(col, c, 0.18);
  vec2 f = flow(px), n = vec2(-f.y, f.x);                    // relief: the stroke ridge lit from the top left
  float ridge = (s - 0.5) * 2.0 * dot(n, normalize(vec2(-0.6, 0.8)));
  return col * (0.92 + 0.5 * ridge) + 0.06 * smoothstep(0.62, 0.8, s);
}
// 2) pointillist: one jittered dot per 12 px cell, nearest pure hue, now and then its neighbour hue
vec3 pal(int i) {
  return i == 0 ? vec3(0.1, 0.25, 0.75) : i == 1 ? vec3(0.2, 0.6, 0.35) : i == 2 ? vec3(0.98, 0.82, 0.2) : i == 3 ? vec3(0.96, 0.5, 0.15)
       : i == 4 ? vec3(0.85, 0.2, 0.25) : i == 5 ? vec3(0.95, 0.55, 0.65) : i == 6 ? vec3(0.5, 0.3, 0.75) : i == 7 ? vec3(0.35, 0.7, 0.9) : vec3(0.98, 0.96, 0.9);
}
vec3 dots(vec2 px) {
  vec3 col = vec3(0.95, 0.92, 0.85);
  vec2 cell = floor(px / 12.0);
  float aa = fwidth(px.x) * 0.8;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 id = cell + vec2(i, j), ctr = (id + 0.25 + 0.5 * hash2(id)) * 12.0;
    vec3 c = photo(ctr);
    c = clamp((c - lum(c)) * 1.6 + lum(c), 0.0, 1.0);        // more saturated before choosing the hue
    float best = 9.0, second = 9.0; int bi = 0, si = 0;
    for (int k = 0; k < 9; k++) { float d = distance(c, pal(k)); if (d < best) { second = best; si = bi; best = d; bi = k; } else if (d < second) { second = d; si = k; } }
    vec3 dc = hash(id + 3.7) < 0.25 ? pal(si) : pal(bi);
    float r = 5.2 + 1.4 * hash(id + 9.1);
    col = mix(col, dc, 1.0 - smoothstep(r - aa, r + aa, length(px - ctr)));
  }
  return col;
}
// 3) stained glass: Voronoi cells of 30 px, each one jewel colour from the photo, with dark lead between them
vec3 glass(vec2 px) {
  vec2 cell = floor(px / 30.0), best = vec2(0.0), bid = vec2(0.0);
  float d1 = 1e9, d2 = 1e9;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 id = cell + vec2(i, j), site = (id + 0.15 + 0.7 * hash2(id)) * 30.0;
    float d = distance(px, site);
    if (d < d1) { d2 = d1; d1 = d; best = site; bid = id; } else if (d < d2) { d2 = d; }
  }
  vec3 c = photo(best);
  float l = lum(c);
  vec3 jewel = clamp((c - l) * 2.2 + l, 0.0, 1.0);
  jewel = mix(jewel, ramp(l, vec3(0.25, 0.05, 0.25), vec3(0.6, 0.1, 0.2), vec3(0.95, 0.6, 0.15), vec3(1.0, 0.95, 0.7)), 0.35);
  float lead = 1.0 - smoothstep(1.5, 1.5 + fwidth(px.x) * 1.5, (d2 - d1) * 0.5);
  float glow = 1.0 - 0.35 * smoothstep(0.0, 20.0, d1) + 0.08 * (hash(bid) - 0.5);
  return mix(jewel * glow, vec3(0.06, 0.05, 0.07), lead);
}
vec3 styled(int s, vec2 px) { return s == 0 ? swirl(px) : s == 1 ? dots(px) : glass(px); }
void main() {
  vec2 frag = vec2(gl_FragCoord.x, ${1920}.0 - gl_FragCoord.y);   // pixels, y down
  vec3 col = mix(vec3(0.07, 0.06, 0.1), vec3(0.13, 0.11, 0.17), frag.y / 1920.0);
  vec2 px = frag - vec2(${RES[0]}.0, ${RES[1]}.0);
  if (px.x >= 0.0 && px.y >= 0.0 && px.x < C.x && px.y < C.y) {                     // the result
    px.y = C.y - px.y;                                                              // texture space, y up
    float k = (px.x * 0.55 + (C.y - px.y) * 0.45) / (C.x * 0.55 + C.y * 0.45);     // position along the wipe
    float w = smoothstep(uStage.z * 1.3 - 0.15, uStage.z * 1.3 - 0.05, k);           // 0 = new style, 1 = old
    int a = int(uStage.x), b = int(uStage.y);
    col = w > 0.999 ? styled(a, px) : w < 0.001 ? styled(b, px) : mix(styled(b, px), styled(a, px), w);
    float edge = exp(-pow((k - (uStage.z * 1.3 - 0.1)) * 40.0, 2.0)) * step(0.001, uStage.z) * step(uStage.z, 0.999);
    col += vec3(1.0, 0.95, 0.85) * edge * 0.5;
  }
  vec2 tp = frag - vec2(40.0, 330.0);                                               // the content photo thumbnail
  if (tp.x >= 0.0 && tp.y >= 0.0 && tp.x < 230.0 && tp.y < 264.5) col = photo(vec2(tp.x, 264.5 - tp.y) / 0.23);
  for (int i = 0; i < 3; i++) {                                                     // the three style swatches
    vec2 sp = frag - uSwatch[i];
    if (sp.x >= 0.0 && sp.y >= 0.0 && sp.x < 200.0 && sp.y < 230.0) col = styled(i, vec2(330.0 + sp.x, ${CH}.0 - 480.0 - sp.y));   // a patch of houses and sky as the style sample
  }
  gl_FragColor = vec4(col, 1.0);                             // already sRGB values: written as they are
}`;

const SW = [[360, 330], [590, 330], [820, 330]];             // swatch positions (px)

export default {
  name: 'Style Transfer',
  ko: '스타일 트랜스퍼',
  three(renderer, W, H) {
    const img = photo();
    const tPhoto = new THREE.CanvasTexture(img);
    tPhoto.colorSpace = THREE.NoColorSpace;                   // the filters work on the sRGB values directly
    const r = rng(5), noise = new Uint8Array(256 * 256 * 4);
    for (let i = 0; i < 256 * 256; i++) { const v = Math.round(r() * 255); noise.set([v, v, v, 255], i * 4); }
    const tNoise = new THREE.DataTexture(noise, 256, 256, THREE.RGBAFormat);
    tNoise.wrapS = tNoise.wrapT = THREE.RepeatWrapping;
    tNoise.minFilter = tNoise.magFilter = THREE.LinearFilter;
    tNoise.needsUpdate = true;
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        tPhoto: { value: tPhoto }, tFlow: { value: flowField(img) }, tNoise: { value: tNoise },
        uStage: { value: new THREE.Vector3() }, uSwatch: { value: SW.map(([x, y]) => new THREE.Vector2(x, y)) },
      },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: frag,
    });
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
    return {
      scene, camera: new THREE.Camera(),
      update(t) { mat.uniforms.uStage.value.set(...stage(t)); },
    };
  },
  // labels, the active swatch ring and the "+" / "=" signs
  overlay(ctx, t, W, H) {
    const [a, b, p] = stage(t), on = i => (i === a ? 1 - smoothstep(0.3, 0.7, p) : 0) + (i === b && a !== b ? smoothstep(0.3, 0.7, p) : 0);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = `700 22px ${FONT.sans}`; ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fillText('CONTENT', 155, 318);
    ctx.font = `300 64px ${FONT.sans}`; ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText('+', 312, 486);
    SW.forEach(([x, y], i) => {
      const k = on(i);
      ctx.font = `700 22px ${FONT.sans}`; ctx.fillStyle = `rgba(255, 255, 255, ${0.45 + 0.55 * k})`;
      ctx.fillText(NAMES[i], x + 100, 318);
      ctx.strokeStyle = `rgba(255, 214, 120, ${k})`; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.roundRect(x - 5, y - 5, 210, 240, 10); ctx.stroke();
    });
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'; ctx.lineWidth = 2;
    ctx.strokeRect(40, 330, 230, 264.5);
    ctx.font = `700 22px ${FONT.sans}`; ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fillText('RESULT', 540, 640);
  },
};
