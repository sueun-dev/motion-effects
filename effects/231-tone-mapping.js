// HDR tone mapping: one high-dynamic-range scene (neon tubes at 6-8x white, glossy spheres under a hard key light and a
// ladder of seven emissive chips, each twice as bright as the last) rendered four times with different operators -
// Linear (clips), Reinhard, ACES Filmic and AgX - while the exposure sweeps between -1 EV and +3 EV.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TAU, phase, FONT } from '../lib/util.js';

const OPS = [
  ['LINEAR', 'clip', THREE.LinearToneMapping], ['REINHARD', 'x / (1 + x)', THREE.ReinhardToneMapping],
  ['ACES FILMIC', 'filmic S-curve', THREE.ACESFilmicToneMapping], ['AGX', 'desaturates to white', THREE.AgXToneMapping],
];
const GAP = 14, TOP = 300, TW = (1080 - 3 * GAP) / 2, TH = 670; // tile size (px)
const ev = t => 1 + 2 * Math.sin(phase(t) * TAU);               // +1 .. +3 .. -1 .. +1

export default {
  name: 'HDR Tone Mapping',
  ko: 'HDR 톤 매핑',
  three(renderer, W, H) {
    const scene = new THREE.Scene();
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.12;
    const camera = new THREE.PerspectiveCamera(38, TW / TH, 0.1, 50);
    camera.position.set(0, 1.7, 7.4);
    camera.lookAt(0, 1.25, 0);

    // a dark studio: a glossy floor and a back wall
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 12), new THREE.MeshStandardMaterial({ color: '#2A2C33', roughness: 0.32, metalness: 0.1 }));
    floor.rotation.x = -Math.PI / 2;
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), new THREE.MeshStandardMaterial({ color: '#1E2233', roughness: 0.8 }));
    wall.position.set(0, 4, -2.6);
    scene.add(floor, wall);

    const key = new THREE.SpotLight('#FFE2C0', 60, 20, 0.5, 0.5, 2);
    key.position.set(-3, 5.5, 4); key.target.position.set(0, 0.5, 0);
    scene.add(key, key.target, new THREE.AmbientLight('#8090B0', 0.25));

    // neon: a pink ring and a cyan bar, each with a matching light so they colour the room
    const neon = (geo, rgb, gain, pos) => {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(...rgb).multiplyScalar(gain) }));
      m.position.set(...pos);
      const l = new THREE.PointLight(new THREE.Color(...rgb), gain * 1.6, 8, 2);
      l.position.set(pos[0], pos[1], pos[2] + 0.4);
      scene.add(m, l);
      return m;
    };
    const ring = neon(new THREE.TorusGeometry(1.15, 0.065, 16, 96), [1, 0.16, 0.42], 7, [0, 2.45, -1.6]);
    neon(new THREE.CapsuleGeometry(0.05, 2.6, 6, 16).rotateZ(Math.PI / 2), [0.15, 0.75, 1], 6, [0, 0.95, -2.4]);

    // glossy spheres: saturated red, white, saturated blue
    [['#E01010', -1.15], ['#F2F2F2', 0], ['#1030E0', 1.15]].forEach(([c, x]) => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.48, 48, 32), new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05 }));
      s.position.set(x, 0.48, 0.2);
      scene.add(s);
    });

    // the exposure ladder: 7 orange chips at 1/8, 1/4, ... 8x white
    for (let k = 0; k < 7; k++) {
      const chip = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.04), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.32, 0.04).multiplyScalar(2 ** (k - 3)) }));
      chip.position.set((k - 3) * 0.44, 0.3, 1.75);
      chip.rotation.x = -0.35;
      scene.add(chip);
    }

    renderer.autoClear = false;
    renderer.setScissorTest(true);
    return {
      render(t) {
        ring.rotation.y = 0.35 * Math.sin(phase(t) * TAU);
        renderer.setViewport(0, 0, W, H); renderer.setScissor(0, 0, W, H);
        renderer.setClearColor('#0B0C10'); renderer.clear();
        renderer.toneMappingExposure = 2 ** ev(t);
        OPS.forEach(([, , op], i) => {
          const x = GAP + (i % 2) * (TW + GAP), y = H - TOP - (Math.floor(i / 2) + 1) * TH - Math.floor(i / 2) * GAP;
          renderer.setViewport(x, y, TW, TH); renderer.setScissor(x, y, TW, TH);
          renderer.toneMapping = op;
          renderer.render(scene, camera);
        });
      },
    };
  },
  overlay(ctx, t, W, H) {
    OPS.forEach(([name, note], i) => {
      const x = GAP + (i % 2) * (TW + GAP), y = TOP + Math.floor(i / 2) * (TH + GAP);
      ctx.fillStyle = 'rgba(8, 9, 14, 0.7)';
      ctx.beginPath(); ctx.roundRect(x + 16, y + 16, 300, 78, 18); ctx.fill();
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#FFFFFF'; ctx.font = `700 32px ${FONT.sans}`; ctx.fillText(name, x + 34, y + 54);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.62)'; ctx.font = `500 24px ${FONT.sans}`; ctx.fillText(note, x + 34, y + 84);
    });
    // the exposure slider under the tiles
    const e = ev(t), x0 = 150, x1 = W - 150, y = 1790, k = (e + 1) / 4;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    ctx.strokeStyle = '#FFB347';
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + (x1 - x0) * k, y); ctx.stroke();
    for (let s = -1; s <= 3; s++) {
      const xs = x0 + (x1 - x0) * (s + 1) / 4;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'; ctx.font = `500 24px ${FONT.sans}`; ctx.textAlign = 'center';
      ctx.fillText(`${s > 0 ? '+' : ''}${s}`, xs, y + 48);
    }
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * k, y, 16, 0, TAU); ctx.fill();
    ctx.font = `700 30px ${FONT.sans}`; ctx.textAlign = 'center'; ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`EXPOSURE  ${e >= 0 ? '+' : '−'}${Math.abs(e).toFixed(1)} EV`, W / 2, y - 34);
  },
};
