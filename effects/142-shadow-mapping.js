// Shadow mapping: a time-of-day slider sweeps a toy sun from noon to sunset, back through noon to sunrise and home.
// Every frame the scene is first drawn from the sun into a 4096 x 4096 depth map (the inset, the sun's view); then each
// pixel the camera sees is compared with that depth to decide whether it is in shadow. The shadows swing round the
// sundial in the square, short at noon and stretched right across the town when the sun is low.
import * as THREE from 'three';
import { TAU, phase, rng, smoothstep, FONT } from '../lib/util.js';

const INSET = { x: 720, y: 1560, s: 300 };              // the sun's-view inset, in screen pixels (top-left, size)
const hourAt = t => 12 + 6 * Math.sin(phase(t) * TAU); // 12:00 -> 18:00 -> 12:00 -> 06:00 -> 12:00

function house(w, d, h, wall, roof) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: wall, roughness: 0.8 }));
  body.position.y = h / 2;
  const tri = new THREE.Shape([new THREE.Vector2(-w / 2 - 0.08, 0), new THREE.Vector2(w / 2 + 0.08, 0), new THREE.Vector2(0, w * 0.55)]);
  const top = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: d + 0.16, bevelEnabled: false }),
    new THREE.MeshStandardMaterial({ color: roof, roughness: 0.6 }));
  top.position.set(0, h, -d / 2 - 0.08);
  g.add(body, top);
  return g;
}

export default {
  name: 'Shadow Mapping',
  ko: '그림자 매핑',
  three(renderer, W, H) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.autoClear = false;
    const scene = new THREE.Scene();
    // backdrop: a sky gradient that warms up near the horizon while the sun is low (uWarm 0 -> 1)
    const skyMat = new THREE.ShaderMaterial({
      uniforms: { uWarm: { value: 0 } }, depthWrite: false, depthTest: false,
      vertexShader: 'varying float vY; void main() { vY = uv.y; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform float uWarm; varying float vY;
        void main() {
          vec3 c = mix(vec3(0.97, 0.89, 0.79), mix(vec3(0.81, 0.91, 0.95), vec3(0.56, 0.79, 0.93), smoothstep(0.45, 1.0, vY)), smoothstep(0.0, 0.45, vY));
          vec3 dusk = mix(vec3(1.0, 0.72, 0.52), mix(vec3(0.98, 0.78, 0.66), vec3(0.52, 0.62, 0.86), smoothstep(0.4, 1.0, vY)), smoothstep(0.0, 0.4, vY));
          gl_FragColor = vec4(mix(c, dusk, uWarm), 1.0);
        }`,
    });
    const skyQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), skyMat);
    skyQuad.frustumCulled = false; skyQuad.renderOrder = -1;
    scene.add(skyQuad);

    const camera = new THREE.PerspectiveCamera(36, W / H, 0.1, 100);
    camera.position.set(0, 10.5, 19.5);
    camera.lookAt(0, 1.55, 0);
    scene.add(new THREE.HemisphereLight('#DCEBFF', '#9A8A70', 1.1));
    const sun = new THREE.DirectionalLight('#FFF1D6', 3.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    Object.assign(sun.shadow.camera, { left: -4.6, right: 4.6, top: 4.6, bottom: -4.6, near: 2, far: 24 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; // no shadow acne
    scene.add(sun, sun.target);

    const town = new THREE.Group();
    const std = (color, r = 0.85) => new THREE.MeshStandardMaterial({ color, roughness: r });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 3.7, 0.5, 128), std('#E9DCC5'));
    base.position.y = -0.25;
    const grass = new THREE.Mesh(new THREE.CylinderGeometry(3.55, 3.55, 0.04, 128), std('#97CC8A'));
    grass.position.y = 0.02;
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.04, 96), std('#F4EBDD'));
    plaza.position.y = 0.06;
    town.add(base, grass, plaza);
    // the sundial: a dial disc with 12 hour marks and a triangular gnomon
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.12, 64), std('#FFFFFF', 0.6));
    dial.position.y = 0.14;
    town.add(dial);
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.02, 0.12), std('#5A5F73'));
      const q = (i / 12) * TAU;
      m.position.set(0.5 * Math.sin(q), 0.21, 0.5 * Math.cos(q));
      m.rotation.y = q;
      town.add(m);
    }
    const gn = new THREE.Shape([new THREE.Vector2(-0.45, 0), new THREE.Vector2(0.42, 0), new THREE.Vector2(-0.45, 0.7)]);
    const gnomon = new THREE.Mesh(new THREE.ExtrudeGeometry(gn, { depth: 0.07, bevelEnabled: false }), std('#C9A24A', 0.4));
    gnomon.position.set(0, 0.2, -0.035);
    town.add(gnomon);

    // houses and trees round the square, laid out once from a fixed seed
    const r = rng(42);
    const walls = ['#FFF6EA', '#FFE3D3', '#E3F1FF', '#FFF0C9', '#E6F6E9'], roofs = ['#E8644F', '#3F7FD9', '#F2A93B', '#6D5BD0', '#2FA58A'];
    const lots = [];
    for (let i = 0; i < 7; i++) lots.push([1.95, (i / 7) * TAU + 0.2, i === 3 ? 'tree' : 'house']);
    for (let i = 0; i < 11; i++) lots.push([2.95, (i / 11) * TAU + 0.05, i % 3 === 1 ? 'tree' : 'house']);
    lots.forEach(([rad, q, kind], i) => {
      let obj;
      if (kind === 'house') {
        const w = 0.55 + 0.25 * r(), h = 0.45 + 0.6 * r();
        obj = house(w, 0.5 + 0.2 * r(), h, walls[i % 5], roofs[(i * 2) % 5]);
      } else {
        obj = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.36, 12), std('#8A5A3C'));
        trunk.position.y = 0.18;
        const crown = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.85, 20), std('#3E9A5B'));
        crown.position.y = 0.72;
        obj.add(trunk, crown);
      }
      obj.position.set(rad * Math.sin(q), 0.04, rad * Math.cos(q));
      obj.rotation.y = q; // facing the square
      town.add(obj);
    });
    const tower = house(0.5, 0.5, 1.9, '#FFFFFF', '#E8644F');
    tower.position.set(-0.85, 0.04, -2.45);
    town.add(tower);
    town.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    base.castShadow = false;
    scene.add(town);

    // the toy sun itself, riding round on its orbit
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.34, 48, 24), new THREE.MeshBasicMaterial({ color: '#FFD25A', toneMapped: false }));
    scene.add(ball);

    // inset: depth from the sun's shadow camera, near = white, far = dark
    const depthMat = new THREE.ShaderMaterial({
      vertexShader: 'varying float vZ; void main() { vec4 p = modelViewMatrix * vec4(position, 1.0); vZ = -p.z; gl_Position = projectionMatrix * p; }',
      fragmentShader: 'varying float vZ; void main() { float g = clamp(1.0 - (vZ - 8.0) / 7.5, 0.0, 1.0); gl_FragColor = vec4(vec3(0.08 + 0.92 * g * g), 1.0); }',
    });

    const white = new THREE.Color('#FFF1D6'), orange = new THREE.Color('#FF9F62');
    return {
      scene, camera,
      render(t) {
        // the sun on its daily circle (tilted towards the back of the town): q = 0 at noon, ±π/2 at 18:00 / 06:00
        const q = (hourAt(t) - 12) / 6 * 1.62;
        const dir = new THREE.Vector3(Math.sin(q), Math.cos(q) * 0.82 + 0.22, -Math.cos(q) * 0.57).normalize();
        const low = 1 - smoothstep(0.2, 0.75, dir.y);
        sun.position.copy(dir).multiplyScalar(12);
        sun.color.copy(white).lerp(orange, low);
        skyMat.uniforms.uWarm.value = low;
        ball.position.copy(dir).multiplyScalar(5.2);
        ball.visible = true;
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, W, H);
        renderer.clear();
        renderer.render(scene, camera);
        // inset: the same scene from the light, as the depth map the shadows come from
        const { x, y, s } = INSET;
        ball.visible = false; skyQuad.visible = false;
        scene.overrideMaterial = depthMat;
        renderer.setScissorTest(true);
        renderer.setViewport(x, H - y - s, s, s); renderer.setScissor(x, H - y - s, s, s);
        renderer.setClearColor('#05060A', 1); renderer.clear();
        renderer.render(scene, sun.shadow.camera);
        scene.overrideMaterial = null; skyQuad.visible = true;
      },
    };
  },
  overlay(ctx, t, W, H) {
    const { x, y, s } = INSET;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.roundRect(x - 3, y - 3, s + 6, s + 6, 10); ctx.stroke();
    ctx.fillStyle = 'rgba(20, 24, 40, 0.78)';
    ctx.beginPath(); ctx.roundRect(x, y - 64, s, 52, 12); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.font = `700 25px ${FONT.sans}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('shadow map · sun’s view', x + s / 2, y - 38);
    // time-of-day slider
    const x0 = 110, x1 = 590, sy = 1760, kx = x0 + (x1 - x0) * (hourAt(t) - 6) / 12;
    ctx.fillStyle = 'rgba(20, 24, 40, 0.78)';
    ctx.beginPath(); ctx.roundRect(40, 1560, 620, 300, 24); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.font = `700 30px ${FONT.sans}`; ctx.textAlign = 'left';
    ctx.fillText('time of day', 80, 1625);
    const hh = Math.floor(hourAt(t)), mm = Math.floor((hourAt(t) - hh) * 60);
    ctx.font = `600 46px ${FONT.mono}`; ctx.textAlign = 'right'; ctx.fillStyle = '#FFD25A';
    ctx.fillText(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, 620, 1625);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.beginPath(); ctx.roundRect(x0, sy - 5, x1 - x0, 10, 5); ctx.fill();
    ctx.fillStyle = '#FFD25A';
    ctx.beginPath(); ctx.arc(kx, sy, 20, 0, TAU); ctx.fill();
    ctx.font = `500 24px ${FONT.mono}`; ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; ctx.textAlign = 'center';
    [['06:00', x0], ['12:00', (x0 + x1) / 2], ['18:00', x1]].forEach(([l, lx]) => ctx.fillText(l, lx, 1820));
  },
};
