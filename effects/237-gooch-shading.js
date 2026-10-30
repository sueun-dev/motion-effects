// Gooch shading: a gear train on an upright bracket drawn like a technical illustration. Instead of light-to-dark,
// each surface blends from a cool blue (facing away from the light) to a warm yellow (facing it), mixed with its own
// colour, plus a white highlight; a black silhouette (an inverted hull pushed out a constant 3 px on screen) and
// dark crease lines (edges sharper than 30 degrees, drawn as 2.4 px lines) carry the shape.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { TAU, phase, canvas } from '../lib/util.js';

const gooch = kd => new THREE.ShaderMaterial({
  polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,  // faces sit just behind their crease lines
  uniforms: { uKd: { value: new THREE.Color(kd) } },
  vertexShader: `varying vec3 vN; varying vec3 vV;
    void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalMatrix * normal; vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 uKd; varying vec3 vN; varying vec3 vV;
    void main() {
      vec3 N = normalize(vN), V = normalize(vV), L = normalize(vec3(-0.55, 0.75, 0.45));   // light fixed to the view
      vec3 cool = vec3(0.10, 0.20, 0.62) + 0.3 * uKd, warm = vec3(0.68, 0.55, 0.12) + 0.5 * uKd;
      vec3 c = mix(cool, warm, 0.5 + 0.5 * dot(N, L));
      c += vec3(0.95) * pow(max(dot(reflect(-L, N), V), 0.0), 36.0) * 0.8;
      gl_FragColor = vec4(min(c, 1.0), 1.0);
    }`,
});
const hullMat = new THREE.ShaderMaterial({                             // the silhouette: back faces pushed out on screen
  side: THREE.BackSide,
  uniforms: { uRes: { value: new THREE.Vector2(1080, 1920) } },
  vertexShader: `uniform vec2 uRes;
    void main() {
      vec4 c = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      vec2 n = (projectionMatrix * vec4(normalMatrix * normal, 0.0)).xy;
      float l = length(n);                         // faces seen head-on are not pushed (their n is ~0)
      c.xy += n / max(l, 1e-5) * smoothstep(0.05, 0.3, l) * 3.0 * 2.0 / uRes * c.w;
      c.z += 0.0006 * c.w;                         // and the hull always stays behind the real surface
      gl_Position = c;
    }`,
  fragmentShader: 'void main() { gl_FragColor = vec4(0.07, 0.08, 0.1, 1.0); }',
});
const lineMat = new LineMaterial({ color: '#1C2028', linewidth: 2.4 });

function gearShape(n, r, depth) {                                      // a spur gear outline with a bore
  const s = new THREE.Shape(), ra = r + 0.13, rd = r - 0.16;
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU, w = TAU / n;
    const pts = [[rd, a - 0.25 * w], [ra, a - 0.13 * w], [ra, a + 0.13 * w], [rd, a + 0.25 * w], [rd, a + 0.5 * w]];
    pts.forEach(([q, b], k) => (i === 0 && k === 0 ? s.moveTo : s.lineTo).call(s, q * Math.cos(b), q * Math.sin(b)));
  }
  s.closePath();
  const hole = new THREE.Path(); hole.absarc(0, 0, 0.2, 0, TAU, true); s.holes.push(hole);
  for (let k = 0; k < 5; k++) {                                        // lightening holes in the web
    const b = k / 5 * TAU + 0.3, h = new THREE.Path();
    h.absarc(0.55 * r * Math.cos(b), 0.55 * r * Math.sin(b), 0.16 * r, 0, TAU, true); s.holes.push(h);
  }
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.025, bevelSegments: 1, curveSegments: 24 }).translate(0, 0, -depth / 2);
}

export default {
  name: 'Gooch Shading',
  ko: '구치 셰이딩',
  three(renderer, W, H) {
    const scene = new THREE.Scene();
    const bg = canvas(4, 512), b = bg.getContext('2d'), grd = b.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#F3F1EC'); grd.addColorStop(1, '#DCDFE4');
    b.fillStyle = grd; b.fillRect(0, 0, 4, 512);
    scene.background = new THREE.CanvasTexture(bg);
    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 60);
    camera.position.set(0, 1.4, 18.5);
    camera.lookAt(0, -0.05, 0);
    lineMat.resolution.set(W, H);

    const rig = new THREE.Group(); scene.add(rig);
    const part = (geo, kd, parent = rig) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(geo, gooch(kd)));
      const smooth = mergeVertices(geo.clone().deleteAttribute('normal').deleteAttribute('uv'), 1e-3);
      smooth.computeVertexNormals();
      g.add(new THREE.Mesh(smooth, hullMat));
      g.add(new LineSegments2(new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(geo, 30)), lineMat));
      parent.add(g);
      return g;
    };
    // the bracket: an upright plate on a foot, with two shafts
    part(new THREE.BoxGeometry(2.6, 5.6, 0.32), '#AAB6C8').position.set(0, 0.35, -0.55);
    part(new THREE.BoxGeometry(3.4, 0.4, 1.8), '#8E9AAD').position.set(0, -2.6, 0);
    [-1.25, 1.25].forEach(x => part(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 24), '#7D8794').position.set(x, -2.34, 0.45));
    const bigY = 1.2, smallY = 1.2 - 2.4;
    [[bigY, 0.2], [smallY, 0.2]].forEach(([y, r]) => {
      part(new THREE.CylinderGeometry(r, r, 1.2, 32).rotateX(Math.PI / 2), '#C9CED6').position.set(0, y, 0);
      part(new THREE.SphereGeometry(0.42, 48, 24, 0, TAU, 0, Math.PI / 2).rotateX(Math.PI / 2), '#B6BEC9').position.set(0, y, 0.5); // domed cap
    });
    // the gears: 20 teeth and 12 teeth on the same module, meshing
    const big = part(gearShape(20, 1.5, 0.36), '#E2A84B'), small = part(gearShape(12, 0.9, 0.36), '#BFC7D2');
    big.position.set(0, bigY, 0.25); small.position.set(0, smallY, 0.25);

    return {
      scene, camera,
      update(t) {
        const a = phase(t) * TAU;
        big.rotation.z = a / 20;                         // one tooth per loop on each gear (seamless)
        small.rotation.z = -a / 12 + Math.PI / 12;
        rig.rotation.y = 0.55 * Math.sin(a);             // the whole part swings so faces turn warm and cool
        rig.rotation.x = 0.12 + 0.06 * Math.sin(2 * a);
      },
    };
  },
};
