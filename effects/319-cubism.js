// Cubism (analytic): a café still life (a guitar leaning on a round table, a bottle, a goblet, a folded newspaper) is
// rendered from four cameras at once, each turning slowly round it. Eleven drifting lines cut the picture into facets;
// every facet shows the still life through one of the four cameras, a little shifted and scaled, so the guitar and
// the bottle are seen from the front, the side and above in the same picture. Each facet is shaded light to dark
// along its edges (passage), mapped to an ochre-umber-grey palette, outlined in broken dark lines and laid on fixed
// brushwork. The four raw views sit underneath, so you can see where the pieces come from.
import * as THREE from 'three';
import { TAU, FONT } from '../lib/util.js';

const PH = 1480;                                  // the painting: the top 1480 px; the four views below it
const NL = 11;                                    // cutting lines
const VW = 720, VH = Math.round(VW * PH / 1080);  // each view's render size
// the cameras: azimuth and elevation (degrees) round the still life
const CAMS = [[0, 12], [-40, 26], [36, 4], [12, 60]];
const LINES = Array.from({ length: NL }, (_, i) => { // a point (px, painting space from the top) and an angle
  const a = [1.35, 0.42, 2.05, 1.62, 0.9, 2.6, 1.15, 0.15, 1.9, 2.35, 0.65][i];
  return [180 + ((i * 397) % 720), 360 + ((i * 271) % 900), a, i * 1.7];
});

// a guitar: an hourglass body with a sound hole, a neck, a head and six strings
function guitar(mat, dark, light) {
  const g = new THREE.Group(), side = [];
  for (let k = 0; k <= 60; k++) {
    const y = -0.42 + k / 60 * 1.33;
    const lo = y < 0.42 ? Math.sqrt(Math.max(0, 0.42 * 0.42 - y * y)) : 0, hi = Math.sqrt(Math.max(0, 0.33 * 0.33 - (y - 0.58) ** 2));
    side.push([Math.max(lo, hi, y > 0.12 && y < 0.5 ? 0.27 + 0.4 * (y - 0.31) ** 2 : 0), y]);
  }
  const shape = new THREE.Shape();
  side.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  side.slice().reverse().forEach(([x, y]) => shape.lineTo(-x, y));
  const hole = new THREE.Path(); hole.absarc(0, 0.36, 0.1, 0, TAU, true); shape.holes.push(hole);
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: 32 }), mat);
  g.add(body);
  const inside = new THREE.Mesh(new THREE.CircleGeometry(0.1, 32), dark); inside.position.set(0, 0.36, 0.02); g.add(inside);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.06), dark); neck.position.set(0, 1.25, 0.12); g.add(neck);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.05), mat); head.position.set(0, 1.74, 0.11); g.add(head);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.03), dark); bridge.position.set(0, -0.12, 0.2); g.add(bridge);
  for (let s = 0; s < 6; s++) {
    const str = new THREE.Mesh(new THREE.BoxGeometry(0.006, 1.8, 0.006), light);
    str.position.set(-0.035 + s * 0.014, 0.78, 0.2); g.add(str);
  }
  return g;
}

function newspaper() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 360;
  const g = c.getContext('2d');
  g.fillStyle = '#E8E2D0'; g.fillRect(0, 0, 512, 360);
  g.fillStyle = '#1A1612'; g.font = `700 76px ${FONT.serif}`; g.fillText('LE JOURNAL', 20, 82);
  g.fillRect(20, 98, 472, 5);
  g.fillStyle = '#9A9284';
  for (let col = 0; col < 3; col++) for (let k = 0; k < 18; k++) g.fillRect(20 + col * 160, 120 + k * 12, 140 - (k * 37 % 50), 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const COMPOSITE = `
uniform sampler2D tV0, tV1, tV2, tV3;
uniform vec4 uL[${NL}];        // line: point (px), direction (cos, sin)
uniform float uPH;
varying vec2 vUv;
float h11(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float h21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y); }
vec3 view(int k, vec2 uv) {
  if (k == 0) return texture2D(tV0, uv).rgb; if (k == 1) return texture2D(tV1, uv).rgb;
  if (k == 2) return texture2D(tV2, uv).rgb; return texture2D(tV3, uv).rgb;
}
float lum(int k, vec2 uv) { return pow(dot(view(k, uv), vec3(0.2126, 0.7152, 0.0722)), 1.0 / 2.2); }
// the ochre-umber palette of analytic cubism
vec3 palette(float v) {
  vec3 c0 = vec3(0.10, 0.08, 0.06), c1 = vec3(0.30, 0.22, 0.13), c2 = vec3(0.55, 0.42, 0.25), c3 = vec3(0.75, 0.63, 0.42), c4 = vec3(0.91, 0.86, 0.72);
  v = clamp(v, 0.0, 1.0);
  if (v < 0.3) return mix(c0, c1, v / 0.3); if (v < 0.55) return mix(c1, c2, (v - 0.3) / 0.25);
  if (v < 0.78) return mix(c2, c3, (v - 0.55) / 0.23); return mix(c3, c4, (v - 0.78) / 0.22);
}
// fixed brushwork: a mosaic of short dabs, laid in one of four directions per patch; it never changes with time
float brush(vec2 p) {
  float a = floor(h21(floor(p / 150.0)) * 4.0) * 0.785 + 0.3;
  vec2 q = mat2(cos(a), -sin(a), sin(a), cos(a)) * p, cell = floor(q / vec2(22.0, 8.0)), f = fract(q / vec2(22.0, 8.0));
  float edge = smoothstep(0.0, 0.2, f.x) * smoothstep(1.0, 0.8, f.x) * smoothstep(0.0, 0.3, f.y) * smoothstep(1.0, 0.7, f.y);
  return (h21(cell + floor(q.y / 8.0) * 0.37) - 0.5) * (0.5 + 0.5 * edge);
}
void main() {
  vec2 px = vUv * vec2(1080.0, 1920.0);                 // screen px, from the bottom
  if (px.y < 1920.0 - uPH) {                           // the strip of four raw views
    vec3 col = vec3(0.16, 0.12, 0.09) * (1.0 + 0.25 * brush(px));
    for (int k = 0; k < 4; k++) {
      vec2 o = vec2(108.0 + float(k) * 226.0, 34.0), s = vec2(186.0, 255.0);
      vec2 q = (px - o) / s;
      if (q.x > 0.0 && q.x < 1.0 && q.y > 0.0 && q.y < 1.0) {
        vec2 uv = vec2(0.15 + q.x * 0.7, 0.18 + q.y * 0.7); // the middle of the view, where the still life is
        col = palette(lum(k, uv) * 0.95 + 0.04);
      }
      vec2 e = abs(px - (o + s * 0.5)) - s * 0.5;
      if (max(e.x, e.y) < 3.0 && max(e.x, e.y) > 0.0) col = vec3(0.85, 0.78, 0.6);
    }
    gl_FragColor = vec4(col, 1.0); return;
  }
  vec2 p = vec2(px.x, 1920.0 - px.y);                  // painting px, from the top
  // which side of every line this pixel is on: the facet's id; and the nearest line
  float id = 0.0, dn = 1e5, sn = 1.0; int ni = 0;
  for (int i = 0; i < ${NL}; i++) {
    float d = dot(p - uL[i].xy, vec2(-uL[i].w, uL[i].z));
    if (d > 0.0) id += exp2(float(i));
    if (abs(d) < dn) { dn = abs(d); sn = sign(d); ni = i; }
  }
  float h = h11(id + 3.0), h2 = h11(id + 17.0), h3 = h11(id + 41.0);
  int k = h < 0.4 ? 0 : (h < 0.6 ? 1 : (h < 0.8 ? 2 : 3));
  vec2 c = vec2(540.0, 760.0);
  vec2 q = c + (p - c) * (1.0 + (h3 - 0.5) * 0.1) + vec2(h2 - 0.5, h3 - 0.5) * 50.0;
  vec2 uv = vec2(q.x / 1080.0, 1.0 - q.y / uPH);
  float v = lum(k, uv);
  // contours of the objects in that view
  vec2 dx = vec2(2.0 / ${VW}.0, 0.0), dy = vec2(0.0, 2.0 / ${VH}.0);
  float g = length(vec2(lum(k, uv + dx) - lum(k, uv - dx), lum(k, uv + dy) - lum(k, uv - dy)));
  // passage: each facet darkens along one side of its nearest edge and lightens on the other
  float shade = sn > 0.0 ? -0.32 * exp(-dn / 55.0) : 0.12 * exp(-dn / 30.0);
  v = v * 0.85 + 0.08 + shade + (h2 - 0.5) * 0.12 + 0.07 * brush(p);
  vec3 col = palette(v);
  col = mix(col, vec3(dot(col, vec3(0.33))) * vec3(0.95, 0.98, 1.0), 0.7 * step(0.7, h2));  // a few cool grey planes
  col *= 1.0 - 0.55 * smoothstep(0.06, 0.2, g);
  // the cutting line itself: a dark stroke that comes and goes along its length
  vec4 L = uL[ni];
  float along = dot(p - L.xy, L.zw);
  float on = smoothstep(0.35, 0.6, vn(vec2(along / 140.0, float(ni) * 7.0)));
  col *= 1.0 - 0.65 * on * smoothstep(2.6, 0.6, dn);
  gl_FragColor = vec4(col, 1.0);
}`;

export default {
  name: 'Cubism',
  ko: '입체파',
  three(renderer, W, H) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#8A8070');
    const sun = new THREE.DirectionalLight('#FFFFFF', 2.6); sun.position.set(-3, 5, 4);
    scene.add(sun, new THREE.HemisphereLight('#FFFFFF', '#555048', 1.1));
    const m = (c, r = 0.6, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...extra });
    const add = (obj, x, y, z) => { obj.position.set(x, y, z); scene.add(obj); return obj; };
    const lathe = pts => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 48);
    add(new THREE.Mesh(new THREE.PlaneGeometry(12, 8), m('#9A8F7C', 0.95)), 0, 2, -1.6);                  // the wall
    add(new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.06, 64), m('#6E5434', 0.6)), 0, -0.03, 0); // the table
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 1.6, 16), m('#4A3A26')), 0, -0.85, 0);
    const gtr = add(guitar(m('#C9A46A', 0.5), m('#2A2018'), m('#F2EAD8', 0.3)), 0.05, 0.42, -0.25);
    gtr.rotation.set(-0.2, -0.32, 0.08);
    add(new THREE.Mesh(lathe([[0, 0], [0.16, 0], [0.17, 0.05], [0.17, 0.62], [0.14, 0.75], [0.07, 0.86], [0.055, 0.92], [0.055, 1.12], [0.07, 1.14], [0, 1.14]]), m('#3E4A36', 0.25)), -0.62, 0, -0.1);
    add(new THREE.Mesh(lathe([[0, 0], [0.13, 0], [0.13, 0.015], [0.025, 0.03], [0.022, 0.2], [0.08, 0.24], [0.15, 0.32], [0.16, 0.46], [0.15, 0.46], [0.14, 0.33], [0.07, 0.26], [0, 0.25]]), m('#E6E0D2', 0.15, { side: THREE.DoubleSide })), 0.62, 0, 0.25);
    const paper = add(new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.56), m('#FFFFFF', 0.9, { map: newspaper() })), 0.3, 0.005, 0.55);
    paper.rotation.set(-Math.PI / 2, 0, 0.35);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 32, 16), m('#B0743A', 0.5)), -0.25, 0.12, 0.6).scale.set(1, 0.9, 1); // a pear-ish fruit
    add(new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 12, 32, Math.PI * 1.3), m('#2A2018')), -0.45, 0.04, 0.55).rotation.x = -Math.PI / 2; // a pipe's bowl

    const cams = CAMS.map(() => new THREE.PerspectiveCamera(30, 1080 / PH, 0.1, 50));
    const rts = CAMS.map(() => new THREE.WebGLRenderTarget(VW, VH, { samples: 4 }));
    const lines = LINES.map(() => new THREE.Vector4());
    const mat = new THREE.ShaderMaterial({
      uniforms: { tV0: { value: rts[0].texture }, tV1: { value: rts[1].texture }, tV2: { value: rts[2].texture }, tV3: { value: rts[3].texture }, uL: { value: lines }, uPH: { value: PH } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: COMPOSITE,
    });
    const post = new THREE.Scene(), flat = new THREE.Camera();
    post.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

    return {
      render(t) {
        const a = TAU * t / 5;
        CAMS.forEach(([az, el], k) => {      // each camera sways round the still life
          const A = (az + 7 * Math.sin(a + k * 1.7)) * Math.PI / 180, E = (el + 3 * Math.sin(a + k)) * Math.PI / 180, d = 5.1;
          cams[k].position.set(d * Math.sin(A) * Math.cos(E), 0.72 + d * Math.sin(E), d * Math.cos(A) * Math.cos(E));
          cams[k].lookAt(0, 0.62, 0);
          renderer.setRenderTarget(rts[k]); renderer.render(scene, cams[k]);
        });
        LINES.forEach(([x, y, ang, ph], i) => { // the cutting lines turn and drift a little
          const th = ang + 0.07 * Math.sin(a + ph);
          lines[i].set(x + 18 * Math.sin(a + ph * 1.3), y + 14 * Math.cos(a + ph), Math.cos(th), Math.sin(th));
        });
        renderer.setRenderTarget(null); renderer.render(post, flat);
      },
    };
  },
  // stencilled letters on the canvas, and the caption over the four views
  overlay(ctx, t, W, H) {
    ctx.save();
    ctx.font = `700 64px ${FONT.mono}`; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(30, 22, 14, 0.7)';
    ctx.fillText('JOU', 92, 1120);
    ctx.font = `700 46px ${FONT.mono}`; ctx.fillStyle = 'rgba(235, 222, 190, 0.55)';
    ctx.fillText('BAL', 840, 520);
    ctx.font = `600 26px ${FONT.sans}`; ctx.fillStyle = 'rgba(235, 222, 190, 0.85)'; ctx.textAlign = 'center';
    ctx.fillText('4 cameras · 4개의 시점', W / 2, PH + 40);
    ctx.font = `700 24px ${FONT.mono}`;
    for (let k = 0; k < 4; k++) ctx.fillText(String(k + 1), 108 + k * 226 + 93, H - 34 - 255 - 12);
    ctx.restore();
  },
};
