// Ink wash: a 3D landscape of stone spires, a pine on a cliff and a small boat is rendered as an East Asian ink
// painting. Each object writes its wash: darker on the shadow side, with long texture strokes fixed to its surface,
// paler with distance and fading into the mist that rises from the water. Outlines are inverted hulls whose width
// swells and thins along the stroke (noise fixed to the object), so they never boil. A post pass softens the wash,
// darkens it where it dries at its edges, lets it bleed a little along the paper fibres, and lays it all on a fixed
// rice-paper texture. The camera drifts sideways, so the near, middle and far layers slide past each other.
import * as THREE from 'three';
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TAU, phase, rng, noise3, canvas, smoothstep, FONT } from '../lib/util.js';

const COMMON = `
uniform vec2 uMist;
varying vec3 vW, vN, vO; varying float vD;
float h31(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vn(vec3 p) {
  vec3 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1, 0, 0)), u.x), mix(h31(i + vec3(0, 1, 0)), h31(i + vec3(1, 1, 0)), u.x), u.y),
             mix(mix(h31(i + vec3(0, 0, 1)), h31(i + vec3(1, 0, 1)), u.x), mix(h31(i + vec3(0, 1, 1)), h31(i + vec3(1, 1, 1)), u.x), u.y), u.z);
}
// the mist rises from the water along a ragged, slowly drifting edge; farther = paler (aerial perspective)
float veil() {
  float m = vn(vec3(vW.x * 0.22 + uMist.x, vW.z * 0.22 + uMist.y, 3.0)) * 3.0;
  return smoothstep(1.5 + m, 8.5 + m, vW.y + 0.025 * vD) * exp(-vD * 0.0095);
}`;
// R = wash, B = outline, A = vermilion
const OBJ_VERT = `${COMMON}
attribute float crease;
varying float vCrease;
void main() {
  vO = position; vCrease = crease;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
  vec4 mv = viewMatrix * w; vD = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const OBJ_FRAG = `${COMMON}
uniform float uTone, uStreak, uFlat, uRed, uMistless;
varying float vCrease;
float band(float edge, float x) { float w = max(0.05, 1.5 * fwidth(x)); return smoothstep(edge - w, edge + w, x); }
void main() {
  vec3 n = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
  float lit = clamp(dot(n, normalize(vec3(-0.7, 0.35, 0.6))), 0.0, 1.0);
  float rim = 1.0 - abs(dot(n, normalize(cameraPosition - vW)));
  float dark = 0.75 * pow(1.0 - lit, 1.3) + 0.45 * rim * rim;        // shadow side and towards the contour
  // the wash is laid in three tones with ragged edges, like separate passes of the brush (edges fixed to the surface)
  float w1 = vn(vO * vec3(1.1, 0.22, 1.1)), w2 = vn(vO * vec3(1.6, 0.35, 1.6) + 9.0);
  float ink = 0.13 + 0.27 * band(0.32, dark + 0.4 * (w1 - 0.5)) + 0.3 * band(0.66, dark + 0.4 * (w2 - 0.5));
  ink = mix(ink, 1.0, uFlat) * uTone;
  // texture strokes (cun): dark broken strokes down the fissures, and fainter streaks on the stone
  float brk = vn(vec3(vO.x * 4.0, vO.y * 0.9, vO.z * 4.0));
  float near = 1.0 - smoothstep(45.0, 90.0, vD);                         // fine marks only where they are big enough
  ink += uStreak * (0.75 * vCrease * smoothstep(0.35, 0.6, brk) + 0.25 * near * smoothstep(0.5, 0.8, vn(vec3(vO.x * 6.0, vO.y * 0.5, vO.z * 6.0))) * (1.0 - lit));
  ink *= mix(veil(), exp(-vD * 0.0095), uMistless);
  gl_FragColor = vec4(clamp(ink, 0.0, 1.0), 0.0, 0.0, uRed);
}`;
// the outline: back faces pushed out along the normal by a width that varies along the object
const HULL_VERT = `${COMMON}
uniform float uWidth;
void main() {
  vO = position;
  float press = 0.45 + 1.2 * smoothstep(0.2, 0.85, vn(position * 1.3 + 5.0));
  vec4 w = modelMatrix * vec4(position + normal * uWidth * press, 1.0);
  vW = w.xyz; vN = normal;
  vec4 mv = viewMatrix * w; vD = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const HULL_FRAG = `${COMMON}
uniform float uDark, uMistless;
void main() { gl_FragColor = vec4(0.0, 0.0, uDark * mix(veil(), exp(-vD * 0.0095), uMistless), 0.0); }`;

const quadVert = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const BLUR = `uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
  void main() {
    vec4 s = vec4(0.0); float n = 0.0;
    for (int i = -9; i <= 9; i++) { float w = exp(-float(i * i) / 30.0); s += w * texture2D(tSrc, vUv + uDir * float(i)); n += w; }
    gl_FragColor = s / n;
  }`;
const PAINT = `uniform sampler2D tInk, tSoft, tPaper, tFibre; varying vec2 vUv;
  void main() {
    vec4 c = texture2D(tInk, vUv), soft = texture2D(tSoft, vUv);
    vec3 paper = texture2D(tPaper, vUv).rgb;
    float fibre = texture2D(tFibre, vUv).r;
    float wash = mix(c.r, soft.r, 0.45);
    wash += 1.1 * max(0.0, c.r - soft.r);                               // ink pools where the wash dries
    wash = max(wash, soft.r * 0.6 * smoothstep(0.45, 0.95, fibre));      // and bleeds a little along the fibres
    wash *= 1.0 - 0.35 * smoothstep(0.55, 0.95, fibre) * smoothstep(0.15, 0.6, wash) * (1.0 - smoothstep(0.6, 0.95, wash)); // dry brush skips
    float line = clamp(c.b + 0.3 * soft.b, 0.0, 1.0);
    float ink = clamp(max(wash, line), 0.0, 1.0) * (0.9 + 0.2 * fibre);
    vec3 inkCol = mix(vec3(0.36, 0.37, 0.38), vec3(0.06, 0.055, 0.05), smoothstep(0.1, 0.9, ink));
    vec3 col = mix(paper, inkCol, clamp(ink * 1.15, 0.0, 1.0));
    col = mix(col, vec3(0.78, 0.30, 0.20), soft.a * (1.0 - ink) * 0.8); // the pale vermilion sun, under the ink
    gl_FragColor = vec4(col, 1.0);
  }`;

// rice paper, made once: warm base, soft mottling, long fibres and a fine tooth, and a map of the fibre density
function paperTexture(W, H) {
  const c = canvas(W, H), g = c.getContext('2d'), r = rng(264);
  g.fillStyle = '#EFE6D1'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) {
    const x = r() * W, y = r() * H, rad = 80 + 260 * r(), grd = g.createRadialGradient(x, y, 0, x, y, rad);
    const d = r() < 0.5 ? '120, 95, 60' : '255, 252, 240';
    grd.addColorStop(0, `rgba(${d}, 0.05)`); grd.addColorStop(1, `rgba(${d}, 0)`);
    g.fillStyle = grd; g.fillRect(x - rad, y - rad, 2 * rad, 2 * rad);
  }
  const fib = canvas(W, H), f = fib.getContext('2d');
  f.fillStyle = '#000'; f.fillRect(0, 0, W, H);
  f.lineCap = 'round';
  for (let i = 0; i < 2600; i++) {
    const x = r() * W, y = r() * H, len = 20 + 90 * r(), a = r() * TAU, bend = (r() - 0.5) * 30;
    f.strokeStyle = `rgba(255, 255, 255, ${0.25 + 0.5 * r()})`; f.lineWidth = 0.8 + 1.6 * r();
    f.beginPath(); f.moveTo(x, y);
    f.quadraticCurveTo(x + Math.cos(a) * len / 2 - Math.sin(a) * bend, y + Math.sin(a) * len / 2 + Math.cos(a) * bend, x + Math.cos(a) * len, y + Math.sin(a) * len);
    f.stroke();
  }
  f.filter = 'blur(1.2px)'; f.drawImage(fib, 0, 0); f.filter = 'none';
  g.globalAlpha = 0.22; g.globalCompositeOperation = 'screen';
  g.drawImage(fib, 0, 0); // fibres show faintly as lighter threads
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  const img = g.getImageData(0, 0, W, H), fimg = f.getImageData(0, 0, W, H), p = img.data, fd = fimg.data;
  for (let i = 0; i < p.length; i += 4) {
    const tooth = (r() - 0.5) * 7;
    p[i] += tooth; p[i + 1] += tooth; p[i + 2] += tooth;
    const x = (i / 4) % W, y = Math.floor(i / 4 / W);
    fd[i] = Math.min(255, fd[i] * 0.8 + 128 * (0.5 + 0.5 * noise3(x * 0.012, y * 0.012, 4.2)));
  }
  g.putImageData(img, 0, 0); f.putImageData(fimg, 0, 0);
  return [c, fib].map(cv => {
    const t = new THREE.CanvasTexture(cv);
    t.minFilter = t.magFilter = THREE.NearestFilter;
    return t;
  });
}

// a stone spire: a blocky column (lobed cross-section) with deep vertical fissures, a couple of set-backs where it
// narrows, a bend along its height and a broken crown
function spire(height, radius, seed, lean = 0) {
  const geo = new THREE.CylinderGeometry(1, 1, 1, 128, 160, true), p = geo.attributes.position, crease = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const h = p.getY(i) + 0.5, th = Math.atan2(p.getZ(i), p.getX(i)), cx = Math.cos(th), sz = Math.sin(th);
    const lobe = 1 + 0.28 * noise3(cx * 1.1 + seed, sz * 1.1, h * 0.6 + seed);          // an uneven, blocky section
    const flute = 1 - Math.abs(noise3(cx * 2.4 + seed, sz * 2.4, h * 1.3));         // long vertical fissures
    const fine = 1 - Math.abs(noise3(cx * 5 + seed, sz * 5, h * 2.5));
    const u = h * 2.6 + 0.3 * noise3(cx + seed, sz, 2.0), setback = 0.1 * smoothstep(0.75, 0.95, u - Math.floor(u)); // narrows in steps
    const top = 0.9 + 0.08 * noise3(cx * 1.7 + seed, sz * 1.7, 5.0);                  // a broken crown line
    let r = radius * (0.5 + 0.5 * (1 - h) ** 1.3) * lobe * (0.66 + 0.36 * flute + 0.08 * fine) * (1 - setback);
    r *= Math.sqrt(Math.max(0, 1 - Math.max(0, (h - top) / (1.02 - top)) ** 2));
    const bend = radius * 0.45 * noise3(seed * 5.3, h * 1.6, 0.7) + lean * h * h * height * 0.12;
    p.setXYZ(i, cx * r + bend, Math.min(h, top + 0.02 * (1 - flute)) * height, sz * r);
    crease[i] = smoothstep(0.42, 0.12, flute) * (1 - smoothstep(0.8, 0.95, h));       // the deep fissures
  }
  geo.setAttribute('crease', new THREE.BufferAttribute(crease, 1));
  geo.computeVertexNormals();
  return geo;
}

// where the crown of a spire is, for planting trees on it: [x, y, z] at angle th, height k (0..1)
function crownPoint(x0, z0, height, radius, seed, lean, k, th) {
  const cx = Math.cos(th), sz = Math.sin(th);
  const r = radius * (0.5 + 0.5 * (1 - k) ** 1.3) * (1 + 0.28 * noise3(cx * 1.1 + seed, sz * 1.1, k * 0.6 + seed)) * 0.75;
  return [x0 + cx * r + radius * 0.45 * noise3(seed * 5.3, k * 1.6, 0.7) + lean * k * k * height * 0.12, k * height, z0 + sz * r];
}

export default {
  name: 'Ink Wash',
  ko: '수묵화 렌더링',
  three(renderer, W, H) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, W / H, 0.5, 400);
    const mist = new THREE.Vector2();
    // one object = its wash plus (if width > 0) an inverted-hull outline
    const inked = (geo, { tone = 0.8, streak = 0.35, flat = 0, red = 0, width = 0, dark = 0.95, mistless = 0 } = {}) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: OBJ_VERT, fragmentShader: OBJ_FRAG, side: THREE.DoubleSide,
        uniforms: { uTone: { value: tone }, uStreak: { value: streak }, uFlat: { value: flat }, uRed: { value: red }, uMist: { value: mist }, uMistless: { value: mistless } } })));
      if (width > 0) {
        const hull = geo.clone().deleteAttribute('normal').deleteAttribute('uv');
        if (hull.attributes.crease) hull.deleteAttribute('crease');
        const merged = mergeVertices(hull);
        merged.computeVertexNormals();
        g.add(new THREE.Mesh(merged, new THREE.ShaderMaterial({ vertexShader: HULL_VERT, fragmentShader: HULL_FRAG, side: THREE.BackSide,
          uniforms: { uWidth: { value: width }, uDark: { value: dark }, uMist: { value: mist }, uMistless: { value: mistless } } })));
      }
      return g;
    };
    const add = (obj, pos, parent = scene) => { obj.position.set(...pos); parent.add(obj); return obj; };

    // spires in three depth layers: a near dark group, a middle range and a pale far range
    const r = rng(17);
    const near = [[2.6, 19, 3.0, 0.4, -2, 0.5], [-1.6, 13.5, 2.3, 1.7, -7, -0.6], [6.0, 10, 2.0, 2.9, 1, 0.3]];
    near.forEach(([x, h, rad, s, z, lean]) => add(inked(spire(h, rad, s, lean), { tone: 0.95, streak: 0.7, width: 0.08 }), [x, 0, z]));
    [[-9, 14, -32], [-3, 18, -42], [9, 15, -36], [15, 11, -30]].forEach(([x, h, z], i) =>
      add(inked(spire(h, 3.0 + r(), 10 + i, (r() - 0.5) * 1.2), { tone: 0.6, streak: 0.35, width: 0.12, dark: 0.7 }), [x, 0, z]));
    for (let i = 0; i < 8; i++) {
      const x = -46 + i * 12 + (r() - 0.5) * 4;
      add(inked(spire(18 + 16 * r(), 8 + 2 * r(), 30 + i), { tone: 0.42, streak: 0.12, width: 0.0 }), [x, 0, -100 - r() * 15]);
    }
    // tiny trees on the crowns: a dark upright dab with three flat tiers of foliage
    const trees = [];
    near.slice(0, 2).forEach(([x, h, rad, s, z, lean]) => {
      for (let i = 0; i < 7; i++) {
        const [tx, ty, tz] = crownPoint(x, z, h, rad, s, lean, 0.86 + 0.04 * r(), -0.9 + r() * 2.4), sc = 0.8 + 0.5 * r();
        const tilt = (r() - 0.5) * 0.5;
        trees.push(new THREE.CylinderGeometry(0.04, 0.06, 0.9, 6).translate(0, 0.45, 0).rotateZ(tilt).scale(sc, sc, sc).translate(tx, ty, tz));
        for (let k = 0; k < 3; k++) {                                // tiers of foliage, pushed alternately left and right
          const side = (k % 2 ? 1 : -1) * (0.08 + 0.1 * r()), w = 0.3 - 0.06 * k + 0.1 * r();
          trees.push(new THREE.SphereGeometry(1, 12, 6).scale(w * 1.6, 0.07, w).translate(side - tilt * (0.35 + 0.22 * k), 0.35 + 0.22 * k, 0).scale(sc, sc, sc).translate(tx, ty, tz));
        }
      }
    });
    add(inked(mergeGeometries(trees.map(g => g.deleteAttribute('uv') && g)), { tone: 0.95, streak: 0, flat: 1 }), [0, 0, 0]);

    // the near cliff, and a pine leaning out from it over the water
    add(inked(spire(7.5, 3.4, 8.8, 0.9), { tone: 0.75, streak: 0.6, width: 0.09 }), [-5.0, -1.2, 10]);
    const pine = add(new THREE.Group(), [-4.4, 5.5, 10.6]);
    const trunk = new THREE.CatmullRomCurve3([[0, 0, 0], [0.4, 0.9, 0.1], [1.4, 1.5, 0.2], [2.5, 1.55, 0.4], [3.6, 2.3, 0.3], [4.2, 2.6, 0.2]].map(v => new THREE.Vector3(...v)));
    pine.add(inked(new THREE.TubeGeometry(trunk, 90, 0.17, 12), { tone: 0.75, flat: 0.55, streak: 0.4, width: 0.05 }));
    // needle clusters: fans of short dark strokes, the classic pine "wheels"
    const needle = new THREE.CylinderGeometry(0.02, 0.06, 1, 6).translate(0, 0.5, 0).rotateZ(-Math.PI / 2), sprays = [];
    [[1.4, 1.75, 0.3, 1.0], [2.5, 1.9, 0.55, 0.9], [3.7, 2.55, 0.3, 1.1], [0.6, 1.25, -0.1, 0.8], [3.0, 3.0, 0.1, 0.8], [4.3, 2.9, 0.4, 0.7], [2.0, 2.4, 0.0, 0.7]].forEach(([x, y, z, s], c) => {
      const spray = [];
      for (let i = 0; i < 17; i++) {                                // a half wheel of needles, opening upwards
        const a = 0.1 + (Math.PI - 0.2) * (i / 16), len = s * (0.7 + 0.25 * Math.sin(i * 1.7 + c));
        spray.push(needle.clone().scale(len, 1, 1).rotateZ(a).rotateX(-0.35));
      }
      const m = inked(mergeGeometries(spray), { tone: 1.0, streak: 0, flat: 1 });
      m.position.set(x, y, z);
      pine.add(m); sprays.push(m);
    });

    // water: blank paper, with a few dry ripple strokes round a small boat
    const boat = add(new THREE.Group(), [0.4, 0.06, 6]);
    const keel = new THREE.SphereGeometry(1, 40, 12, 0, TAU, Math.PI / 2, Math.PI / 2).scale(1.3, 0.26, 0.34);
    boat.add(inked(keel, { tone: 0.75, streak: 0.0, width: 0.05, mistless: 1 }));
    add(inked(new THREE.SphereGeometry(0.17, 20, 14).scale(1, 1.35, 1), { tone: 0.9, streak: 0, flat: 1, mistless: 1 }), [-0.35, 0.22, 0], boat);
    add(inked(new THREE.ConeGeometry(0.34, 0.16, 32), { tone: 0.25, streak: 0, width: 0.035, mistless: 1 }), [-0.35, 0.5, 0], boat);
    const pole = add(inked(new THREE.CylinderGeometry(0.035, 0.035, 2.2, 8), { tone: 1, streak: 0, flat: 1, mistless: 1 }), [0.35, 0.6, 0], boat);
    pole.rotation.z = -0.7;
    const ripple = new THREE.CircleGeometry(0.5, 40).rotateX(-Math.PI / 2);     // a long lens: a stroke that tapers at both ends
    [[-0.8, 0.5, 3.6], [1.0, -0.35, 2.4], [-2.2, 1.1, 1.6], [2.4, 0.9, 1.2], [0.3, 1.6, 2.0]].forEach(([x, z, w]) => {
      const m = add(inked(ripple, { tone: 0.55, streak: 0.0, flat: 1, mistless: 1 }), [0.4 + x, 0.01, 6 + z]);
      m.scale.set(w, 1, 0.16);
    });

    // a pale vermilion sun far behind the peaks
    add(inked(new THREE.CircleGeometry(8, 64), { tone: 0, streak: 0, red: 0.36, mistless: 1 }), [-20, 30, -200]);

    // passes
    const target = () => new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
    const rtInk = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
    const rtA = target(), rtB = target();
    const pass = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: quadVert, fragmentShader: frag, uniforms });
    const blur = pass(BLUR, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } });
    const [paperTex, fibreTex] = paperTexture(W, H);
    const paint = pass(PAINT, { tInk: { value: rtInk.texture }, tSoft: { value: rtB.texture }, tPaper: { value: paperTex }, tFibre: { value: fibreTex } });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)), post = new THREE.Scene(), flat = new THREE.Camera();
    post.add(quad);
    const run = (mat, to) => { quad.material = mat; renderer.setRenderTarget(to); renderer.render(post, flat); };
    renderer.setClearColor(0x000000, 0);

    return {
      render(t) {
        const a = phase(t) * TAU;                                  // a slow sideways drift: near layers slide, far ones stay
        camera.position.set(1.5 + 1.4 * Math.sin(a), 14 + 0.5 * Math.cos(a), 48);
        camera.lookAt(0.8 + 0.5 * Math.sin(a), 7.6, -40);
        mist.set(1.2 * Math.cos(a), 1.2 * Math.sin(a));
        sprays.forEach((m, i) => (m.rotation.z = 0.05 * Math.sin(2 * a + i)));
        boat.position.x = 0.4 + 0.6 * Math.sin(a);
        boat.rotation.z = 0.03 * Math.sin(2 * a);
        renderer.setRenderTarget(rtInk); renderer.clear(); renderer.render(scene, camera);
        blur.uniforms.tSrc.value = rtInk.texture; blur.uniforms.uDir.value.set(1 / W, 0); run(blur, rtA);
        blur.uniforms.tSrc.value = rtA.texture; blur.uniforms.uDir.value.set(0, 1 / H); run(blur, rtB);
        run(paint, null);
      },
    };
  },
  overlay(ctx) {
    // the artist's seal, stamped on the paper
    ctx.save();
    ctx.translate(1080 - 172, 1660);
    ctx.fillStyle = 'rgba(178, 42, 30, 0.88)';
    ctx.beginPath(); ctx.roundRect(0, 0, 96, 96, 8); ctx.fill();
    ctx.fillStyle = '#EFE3CC'; ctx.font = `600 40px "Songti SC", ${FONT.serif}`; ctx.textAlign = 'center';
    ctx.fillText('山', 48, 44); ctx.fillText('水', 48, 86);
    ctx.restore();
  },
};
