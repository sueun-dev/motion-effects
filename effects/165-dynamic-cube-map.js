// Dynamic cube map: every frame a CubeCamera at the centre of the chrome ball renders the scene six times (±X, ±Y,
// ±Z) into a cube render target, with the ball hidden, and the ball's material reflects that cube. So the glossy
// toys orbiting it slide across its surface in real time. The six live faces are shown unfolded at the bottom.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TAU, phase } from '../lib/util.js';

// the unfolded cube: a 4 × 3 cross, each cell shows the cube render target in one direction
const netShader = {
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform samplerCube tCube; varying vec2 vUv;
    void main() {
      vec2 g = vUv * vec2(4.0, 3.0), c = floor(g), f = fract(g) * 2.0 - 1.0;
      float row = 2.0 - c.y;                                    // row 0 at the top
      vec3 d;
      if (row == 1.0 && c.x == 0.0) d = vec3(-1.0, f.y, -f.x);  // -X
      else if (row == 1.0 && c.x == 1.0) d = vec3(f.x, f.y, -1.0);   // -Z (behind the ball)
      else if (row == 1.0 && c.x == 2.0) d = vec3(1.0, f.y, f.x);    // +X
      else if (row == 1.0 && c.x == 3.0) d = vec3(-f.x, f.y, 1.0);   // +Z (toward us)
      else if (row == 0.0 && c.x == 1.0) d = vec3(f.x, 1.0, f.y);    // +Y
      else if (row == 2.0 && c.x == 1.0) d = vec3(f.x, -1.0, -f.y);  // -Y
      else discard;
      vec3 col = textureCube(tCube, d).rgb;
      float edge = max(abs(f.x), abs(f.y));
      col = mix(col, vec3(1.0), smoothstep(0.955, 0.985, edge) * 0.85);   // thin white seams between the faces
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

export default {
  name: 'Dynamic Cube Map',
  ko: '동적 큐브맵',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.6;

    // the studio: a dome with a lavender sky, softboxes on top and a ring of colour panels at the horizon
    const wc = document.createElement('canvas'); wc.width = 2048; wc.height = 1024;
    const w = wc.getContext('2d');
    const sky = w.createLinearGradient(0, 0, 0, 1024);
    sky.addColorStop(0, '#D8D0FF'); sky.addColorStop(0.3, '#8A6FD8'); sky.addColorStop(0.5, '#3B2670'); sky.addColorStop(1, '#140E2C');
    w.fillStyle = sky; w.fillRect(0, 0, 2048, 1024);
    w.fillStyle = '#FFFFFF';
    for (const x of [180, 700, 1220, 1740]) { w.beginPath(); w.roundRect(x, 70, 260, 90, 30); w.fill(); }   // softboxes
    const panel = ['#FF4F7B', '#FFC93C', '#2EC4B6', '#5B6CFF', '#FF8A3D', '#B15CFF', '#45E07A', '#FF5ED1'];
    for (let i = 0; i < 16; i++) {
      if (Math.abs(i * 128 + 64 - 1536) < 300) continue;        // keep the wall behind the ball (u = 0.75, -Z) a clean gradient
      w.fillStyle = panel[i % 8]; w.beginPath(); w.roundRect(i * 128 + 30, 330, 68, 170, 18); w.fill();
    }
    const wtex = new THREE.CanvasTexture(wc); wtex.colorSpace = THREE.SRGBColorSpace;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(22, 128, 64), new THREE.MeshBasicMaterial({ map: wtex, side: THREE.BackSide }));
    scene.add(dome);
    const fc = document.createElement('canvas'); fc.width = fc.height = 1024;
    const f = fc.getContext('2d');
    f.fillStyle = '#120E22'; f.fillRect(0, 0, 1024, 1024);
    f.strokeStyle = 'rgba(160, 140, 255, 0.3)'; f.lineWidth = 8;
    for (let i = 0; i <= 1024; i += 128) { f.beginPath(); f.moveTo(i, 0); f.lineTo(i, 1024); f.moveTo(0, i); f.lineTo(1024, i); f.stroke(); }
    const ftex = new THREE.CanvasTexture(fc); ftex.colorSpace = THREE.SRGBColorSpace; ftex.anisotropy = 16;
    ftex.wrapS = ftex.wrapT = THREE.RepeatWrapping; ftex.repeat.set(3, 3);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(21, 128), new THREE.MeshStandardMaterial({ map: ftex, roughness: 0.6 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -2.6;
    scene.add(floor);
    const key = new THREE.DirectionalLight('#FFFFFF', 1.6); key.position.set(-3, 6, 5);
    scene.add(key);

    const camera = new THREE.PerspectiveCamera(32, W / H, 0.1, 100);
    camera.position.set(0, 1.4, 15);
    camera.lookAt(0, -0.2, 0);

    // the chrome ball and the cube camera at its centre
    const cubeRT = new THREE.WebGLCubeRenderTarget(1024, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    const cubeCam = new THREE.CubeCamera(0.1, 80, cubeRT);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1.35, 128, 96), new THREE.MeshStandardMaterial({ color: '#F2F4F8', metalness: 1, roughness: 0.03, envMap: cubeRT.texture }));
    scene.add(ball, cubeCam);

    // glossy toys on tilted orbits; each goes round a whole number of times per loop
    const toy = (geo, color) => new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 }));
    const toys = [
      [toy(new THREE.TorusGeometry(0.34, 0.13, 32, 96), '#FF4F7B'), 1.95, 0.5, 1, 0.0],
      [toy(new THREE.IcosahedronGeometry(0.36, 0), '#FFC93C'), 2.05, -0.7, 1, 2.1],
      [toy(new THREE.BoxGeometry(0.5, 0.5, 0.5), '#2EC4B6'), 1.9, 1.1, -1, 1.0],
      [toy(new THREE.ConeGeometry(0.3, 0.62, 48), '#5B6CFF'), 2.15, -1.25, -1, 3.6],
      [toy(new THREE.TorusKnotGeometry(0.24, 0.09, 128, 24), '#B15CFF'), 2.0, 0.2, 2, 4.4],
      [toy(new THREE.SphereGeometry(0.28, 48, 32), '#45E07A'), 2.0, -0.3, -2, 5.3],
    ];
    for (const [m] of toys) scene.add(m);

    // overlay: the unfolded cube map, 520 px wide, near the bottom
    const net = new THREE.Mesh(new THREE.PlaneGeometry(520, 390), new THREE.ShaderMaterial({ ...netShader, uniforms: { tCube: { value: cubeRT.texture } } }));
    net.position.set(W / 2, 250, 0);
    const hud = new THREE.Scene(); hud.add(net);
    const hudCam = new THREE.OrthographicCamera(0, W, H, 0, -1, 1);

    return {
      scene, camera,
      update(t) {
        const a = phase(t) * TAU;
        for (const [m, rad, tilt, laps, off] of toys) {
          const b = laps * a + off;
          m.position.set(rad * Math.cos(b), 0, rad * Math.sin(b));
          m.position.applyAxisAngle(new THREE.Vector3(1, 0, 0.35).normalize(), tilt);   // tilt the orbit plane
          m.position.y -= 0.15;
          m.rotation.set(a * 2 + off, a + off, 0);
        }
        ball.position.y = -0.15 + 0.08 * Math.sin(2 * a);
        cubeCam.position.copy(ball.position);
      },
      render() {
        ball.visible = false;
        cubeCam.update(renderer, scene);                        // six renders from the ball's centre
        ball.visible = true;
        renderer.render(scene, camera);
        renderer.autoClear = false;
        renderer.render(hud, hudCam);
        renderer.autoClear = true;
      },
    };
  },
};
