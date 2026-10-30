// Matcap: the model has no lights at all. Each pixel takes its view-space normal, uses (n.x, n.y) as a position on a
// picture of a lit ball (a material capture) and copies that colour, so the whole look comes from the ball. A torus
// knot turns while five painted matcaps (clay, chrome, gold, toon, raw normals) wipe across it, one a second; the balls
// sit below and the one in use is ringed. Because the lookup is in view space, the lighting stays put as it turns.
import * as THREE from 'three';
import { TAU, phase, canvas, smoothstep, FONT } from '../lib/util.js';

const S = 512, C = S / 2, R = 250;
// a matcap canvas: paint(g) draws the ball inside the circle; outside it is filled with the rim colour
function matcap(rim, paint) {
  const c = canvas(S, S), g = c.getContext('2d');
  g.fillStyle = rim; g.fillRect(0, 0, S, S);
  g.save(); g.beginPath(); g.arc(C, C, R, 0, TAU); g.clip();
  paint(g);
  g.restore();
  return c;
}
const radial = (g, x, y, r, stops) => {
  const grd = g.createRadialGradient(x, y, 0, x, y, r);
  stops.forEach(([k, col]) => grd.addColorStop(k, col));
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
};
const MATCAPS = [
  ['clay', matcap('#3E1810', g => {
    radial(g, 190, 170, 330, [[0, '#F7C2A6'], [0.35, '#D98462'], [0.7, '#9C4630'], [1, '#4A1C12']]);
    radial(g, 360, 380, 160, [[0, 'rgba(255, 170, 130, 0.35)'], [1, 'rgba(255, 170, 130, 0)']]); // warm bounce
    radial(g, 185, 160, 60, [[0, 'rgba(255, 255, 255, 0.45)'], [1, 'rgba(255, 255, 255, 0)']]);
  })],
  ['chrome', matcap('#15171C', g => {
    const v = g.createLinearGradient(0, C - R, 0, C + R);
    [[0, '#F4F8FF'], [0.3, '#9BC0EE'], [0.5, '#3A5A86'], [0.53, '#0E1117'], [0.6, '#6E5848'], [0.8, '#2C221B'], [1, '#100C0A']].forEach(([k, c]) => v.addColorStop(k, c));
    g.fillStyle = v; g.fillRect(0, 0, S, S);
    radial(g, C, C, R, [[0.75, 'rgba(0, 0, 0, 0)'], [1, 'rgba(0, 0, 0, 0.55)']]);          // darker towards the rim
    g.fillStyle = 'rgba(255, 255, 255, 0.95)';
    g.beginPath(); g.roundRect(150, 105, 70, 40, 12); g.fill();
    g.beginPath(); g.roundRect(240, 95, 40, 28, 8); g.fill();
  })],
  ['gold', matcap('#3A2205', g => {
    radial(g, 205, 185, 330, [[0, '#FFF7D6'], [0.18, '#FFD86A'], [0.45, '#C98C1E'], [0.75, '#5E3A08'], [1, '#B07A22']]);
    radial(g, 195, 175, 40, [[0, 'rgba(255, 255, 255, 0.95)'], [1, 'rgba(255, 255, 255, 0)']]);
  })],
  ['toon', matcap('#1F4F78', g => {
    g.fillStyle = '#2C6E9E'; g.fillRect(0, 0, S, S);                                    // shadow
    g.fillStyle = '#4FB3E8'; g.beginPath(); g.arc(C - 30, C - 30, 230, 0, TAU); g.fill(); // mid tone
    g.fillStyle = '#A8E6FF'; g.beginPath(); g.arc(C - 70, C - 75, 120, 0, TAU); g.fill(); // light
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.ellipse(170, 150, 38, 24, -0.6, 0, TAU); g.fill(); // highlight
    g.strokeStyle = '#E3F8FF'; g.lineWidth = 16; g.beginPath(); g.arc(C, C, R - 6, 0.15 * Math.PI, 0.6 * Math.PI); g.stroke(); // rim light
  })],
  ['normals', matcap('#808080', g => {
    const img = g.getImageData(0, 0, S, S), d = img.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const nx = (x + 0.5 - C) / R, ny = -(y + 0.5 - C) / R, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)), i = (y * S + x) * 4;
      d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  })],
];

// which two matcaps show at time t, and where the wipe between them is (0..1 across the screen; 0 = all the first)
function state(t) {
  const i = Math.floor(t) % 5, k = smoothstep(0.45, 1, t - Math.floor(t));
  return { from: i, to: (i + 1) % 5, wipe: k };
}

export default {
  name: 'Matcap',
  ko: '맷캡',
  three(renderer, W, H) {
    const scene = new THREE.Scene();
    const bg = canvas(4, 512), b = bg.getContext('2d'), grd = b.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#1A1C22'); grd.addColorStop(0.55, '#2A2D35'); grd.addColorStop(1, '#121318');
    b.fillStyle = grd; b.fillRect(0, 0, 4, 512);
    scene.background = new THREE.CanvasTexture(bg);
    scene.background.colorSpace = THREE.SRGBColorSpace;

    const textures = MATCAPS.map(([, c]) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; });
    const mat = new THREE.ShaderMaterial({
      uniforms: { uA: { value: textures[0] }, uB: { value: textures[1] }, uWipe: { value: 0 }, uWidth: { value: W } },
      vertexShader: `
        varying vec3 vN; varying vec3 vV;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D uA, uB; uniform float uWipe, uWidth;
        varying vec3 vN; varying vec3 vV;
        void main() {
          vec3 n = normalize(vN), v = normalize(vV);
          // the same lookup three.js uses: a frame that faces the eye, so the ball is never seen from the side
          vec3 x = normalize(vec3(v.z, 0.0, -v.x)), y = cross(v, x);
          vec2 uv = vec2(dot(x, n), dot(y, n)) * 0.495 + 0.5;
          float edge = uWipe * 1.3 - 0.15, s = gl_FragCoord.x / uWidth;
          float k = smoothstep(edge - 0.06, edge + 0.06, s);   // left of the edge: the new matcap
          vec4 c = mix(texture2D(uB, uv), texture2D(uA, uv), k);
          gl_FragColor = vec4(c.rgb, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.86, 0.31, 480, 72, 2, 3), mat);
    knot.position.y = 0.42;
    scene.add(knot);

    const camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 100);
    camera.position.set(0, 0, 9.8);

    return {
      scene, camera,
      update(t) {
        const a = phase(t) * TAU, s = state(t);
        mat.uniforms.uA.value = textures[s.from];
        mat.uniforms.uB.value = textures[s.to];
        mat.uniforms.uWipe.value = s.wipe;
        knot.rotation.set(0.35 * Math.sin(a), a, 0.15 * Math.sin(2 * a));
      },
    };
  },
  // the five matcap balls in a row, the active one larger and ringed, with its name
  overlay(ctx, t, W, H) {
    const s = state(t), y = 1590, gap = 190;
    MATCAPS.forEach(([name, c], i) => {
      const x = W / 2 + (i - 2) * gap;
      const on = i === s.from ? 1 - s.wipe : i === s.to ? s.wipe : 0;
      const r = 52 + 18 * on;
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
      ctx.drawImage(c, C - R, C - R, 2 * R, 2 * R, x - r, y - r, 2 * r, 2 * r);
      ctx.restore();
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.15 + 0.85 * on})`;
      ctx.lineWidth = 3 + 3 * on;
      ctx.beginPath(); ctx.arc(x, y, r + 8, 0, TAU); ctx.stroke();
      ctx.fillStyle = `rgba(255, 255, 255, ${0.45 + 0.55 * on})`;
      ctx.font = `600 30px ${FONT.sans}`; ctx.textAlign = 'center';
      ctx.fillText(name, x, y + 120);
    });
  },
};
