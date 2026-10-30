// Hatching: drawing-class solids lit by a lamp that swings behind them, drawn as pencil strokes on paper. Each pixel's lit
// tone picks the strokes: light tones get one set of lines, darker tones a cross set, the darkest a third set, and the
// lines widen as the tone darkens. Strokes are the cuts of three families of parallel planes through the surface,
// fixed in the world, so they never swim; they are antialiased with fwidth. Outlines are an inverted hull.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { TAU, phase, rng, canvas } from '../lib/util.js';

const HATCH = `
varying vec3 vHatch;
uniform float uFade;
float strokes(vec3 p, vec3 d, float freq, float w, float seed) {
  vec3 q = vec3(d.z, d.x, -d.y);
  float s = dot(p, d) * freq + 0.18 * sin(dot(p, q) * 2.7 + seed);   // a slight hand wobble, fixed in space
  float px = abs(fract(s) - 0.5) / max(fwidth(s), 1e-4);              // distance to the stroke centre, in pixels
  float press = 0.7 + 0.3 * sin(dot(p, q) * 4.0 + floor(s) * 2.3);    // each stroke has its own pressure along it
  return (1.0 - smoothstep(w * 3.6 - 0.7, w * 3.6 + 0.7, px)) * smoothstep(0.0, 0.08, w) * press; // up to ~3.6 px wide
}
float pgrain(vec3 p) { return fract(sin(dot(floor(p * 120.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
vec3 hatch(vec3 p, float tone) {
  float k = 1.0 - tone;
  float ink = strokes(p, normalize(vec3(1.0, 0.55, 0.25)), 34.0, clamp((k - 0.22) * 0.9, 0.0, 0.5), 0.0);
  ink = max(ink, strokes(p, normalize(vec3(-0.35, 0.6, 1.0)), 34.0, clamp((k - 0.45) * 0.9, 0.0, 0.45), 1.7));
  ink = max(ink, strokes(p, normalize(vec3(0.3, -1.0, 0.55)), 40.0, clamp((k - 0.66) * 1.0, 0.0, 0.42), 3.1));
  ink *= 0.8 + 0.2 * pgrain(p);                                       // graphite grain, fixed to the surface
  return mix(vec3(0.905, 0.87, 0.79), vec3(0.045, 0.045, 0.06), ink);  // paper -> graphite (linear)
}`;

function pencil(fadeFar = false) {
  const m = new THREE.MeshLambertMaterial({ color: '#FFFFFF' });
  m.onBeforeCompile = sh => {
    sh.uniforms.uFade = { value: fadeFar ? 1 : 0 };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vHatch;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHatch = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + HATCH)
      .replace('#include <opaque_fragment>', `
        float tone = pow(clamp(dot(outgoingLight, vec3(0.299, 0.587, 0.114)), 0.0, 1.0), 1.0 / 2.2);
        tone = mix(tone, 1.0, uFade * smoothstep(2.6, 5.0, length(vHatch.xz)));   // the drawing fades into the paper
        outgoingLight = hatch(vHatch, tone);
        #include <opaque_fragment>`);
  };
  return m;
}

const ink = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * 0.016, 1.0); }',
  fragmentShader: 'void main() { gl_FragColor = vec4(0.045, 0.04, 0.055, 1.0); }',
});

let grain = null; // a fixed paper texture, made once

export default {
  name: 'Hatching',
  ko: '해칭',
  three(renderer, W, H) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0.905, 0.87, 0.79);
    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 60);
    camera.position.set(0, 5.0, 12.4);
    camera.lookAt(0, 1.2, 0.3);

    scene.add(new THREE.AmbientLight('#FFFFFF', 0.22));
    const lamp = new THREE.DirectionalLight('#FFFFFF', 2.9);
    lamp.castShadow = true; lamp.shadow.mapSize.set(2048, 2048); lamp.shadow.bias = -0.0005; lamp.shadow.normalBias = 0.02; lamp.shadow.radius = 3;
    Object.assign(lamp.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 30 });
    scene.add(lamp);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), pencil(true));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    scene.add(ground);
    const solid = (geo, pos, rot = [0, 0, 0]) => {
      const g = new THREE.Group();
      const m = new THREE.Mesh(geo, pencil()); m.castShadow = m.receiveShadow = true;
      const hull = mergeVertices(geo.clone().deleteAttribute('normal').deleteAttribute('uv'));
      hull.computeVertexNormals();
      g.add(m, new THREE.Mesh(hull, ink));
      g.position.set(...pos); g.rotation.set(...rot);
      scene.add(g);
    };
    solid(new THREE.CylinderGeometry(0.46, 0.46, 2.3, 96), [0.75, 1.15, -1.5]);
    solid(new THREE.BoxGeometry(1, 1, 1), [-0.8, 0.5, -0.9], [0, 0.55, 0]);
    solid(new THREE.SphereGeometry(0.58, 96, 48), [0.65, 0.58, 0.25]);
    solid(new THREE.ConeGeometry(0.52, 1.35, 96), [-0.75, 0.675, 0.75]);
    solid(new THREE.ConeGeometry(0.5, 0.75, 4), [0.75, 0.375, 1.55], [0, 0.3, 0]);

    return {
      scene, camera,
      update(t) {
        const a = -Math.PI / 2 + 1.35 * Math.sin(phase(t) * TAU); // the lamp swings left <-> right behind the still life
        lamp.position.set(5 * Math.cos(a), 4.4, 5 * Math.sin(a));
      },
    };
  },
  overlay(ctx, t, W, H) {
    if (!grain) {                                     // paper fibres and tooth: a fixed texture, never per frame
      grain = canvas(W, H);
      const g = grain.getContext('2d'), r = rng(236), img = g.createImageData(W, H);
      for (let i = 0; i < W * H; i++) { const v = 200 + 55 * r(); img.data.set([v, v * 0.98, v * 0.95, 255], i * 4); }
      g.putImageData(img, 0, 0);
      g.globalAlpha = 0.05; g.strokeStyle = '#6B5E4A'; g.lineWidth = 1;
      for (let k = 0; k < 900; k++) { const x = r() * W, y = r() * H, a = r() * TAU, l = 6 + 18 * r(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + l * Math.cos(a), y + l * Math.sin(a)); g.stroke(); }
    }
    ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.35;
    ctx.drawImage(grain, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  },
};
