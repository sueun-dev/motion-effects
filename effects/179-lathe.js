// Lathe: a 2D profile curve (outer wall, lip and inner wall of a vase) is spun about the vertical axis with
// LatheGeometry. A leading arm sweeps the surface into being, a second arm follows and sweeps it away, both turning
// the same way, so the loop ends where it began. The two cut faces are capped with the profile's cross-section.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TAU, phase, span, ease } from '../lib/util.js';

const T = 0.07; // wall thickness
const START = Math.PI / 2; // the profile starts side-on to the camera, so its shape reads
// the designer's curve: radius, height (outer wall, base to lip)
const KEYS = [[0.62, -1.7], [0.98, -1.25], [1.16, -0.55], [0.92, 0.2], [0.46, 0.85], [0.44, 1.25], [0.68, 1.62]];

export default {
  name: 'Lathe',
  ko: '회전체',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    const bg = document.createElement('canvas'); bg.width = 4; bg.height = 256;
    const b = bg.getContext('2d'), grd = b.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#F4E6D4'); grd.addColorStop(0.55, '#E6CDB2'); grd.addColorStop(1, '#C99E7E');
    b.fillStyle = grd; b.fillRect(0, 0, 4, 256);
    scene.background = new THREE.CanvasTexture(bg); scene.background.colorSpace = THREE.SRGBColorSpace;
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;

    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
    camera.position.set(0, 3.6, 11.5);
    camera.lookAt(0, 0.05, 0);
    const key = new THREE.DirectionalLight('#FFF1E0', 2.6);
    key.position.set(-4, 8, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 });
    key.shadow.radius = 5;
    key.shadow.bias = -0.0005;
    scene.add(key, new THREE.HemisphereLight('#FFF4E8', '#8A5A3C', 0.6));

    // the potter's wheel the vase stands on
    const rings = document.createElement('canvas'); rings.width = rings.height = 512; // faint turning grooves on the wheel head
    const rc = rings.getContext('2d');
    rc.fillStyle = '#EADBC8'; rc.fillRect(0, 0, 512, 512);
    rc.strokeStyle = 'rgba(120, 80, 50, 0.13)'; rc.lineWidth = 3;
    for (let r = 40; r < 256; r += 26) { rc.beginPath(); rc.arc(256, 256, r, 0, TAU); rc.stroke(); }
    const ringTex = new THREE.CanvasTexture(rings); ringTex.colorSpace = THREE.SRGBColorSpace;
    const side = new THREE.MeshStandardMaterial({ color: '#E3D2BD', roughness: 0.6 });
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.85, 0.16, 96), [side, new THREE.MeshStandardMaterial({ map: ringTex, roughness: 0.6 }), side]);
    wheel.position.y = -1.78;
    wheel.receiveShadow = true;
    const blob = document.createElement('canvas'); blob.width = blob.height = 128; // a soft contact shadow under the wheel
    const bg2 = blob.getContext('2d'), rg = bg2.createRadialGradient(64, 64, 20, 64, 64, 64);
    rg.addColorStop(0, 'rgba(70, 40, 25, 0.45)'); rg.addColorStop(1, 'rgba(70, 40, 25, 0)');
    bg2.fillStyle = rg; bg2.fillRect(0, 0, 128, 128);
    const under = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 5.2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(blob), transparent: true, depthWrite: false }));
    under.rotation.x = -Math.PI / 2; under.position.y = -1.9;
    // a protractor arc on the wheel that shows how far the profile has swept
    const arcMat = new THREE.MeshBasicMaterial({ color: '#FF5A36', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const arc = new THREE.Mesh(new THREE.BufferGeometry(), arcMat);
    arc.rotation.x = -Math.PI / 2; arc.position.y = -1.697;
    scene.add(wheel, under, arc);

    // profile: a smooth outer curve through the keys, the same curve moved T inwards for the inner wall
    const curve = new THREE.SplineCurve(KEYS.map(([r, y]) => new THREE.Vector2(r, y)));
    const outer = curve.getSpacedPoints(150);
    const inner = outer.map((p, i) => {
      const a = outer[Math.max(0, i - 1)], c = outer[Math.min(150, i + 1)];
      const d = new THREE.Vector2().subVectors(c, a).normalize(); // tangent; the inward normal is (-dy, dx) turned
      return new THREE.Vector2(p.x - T * d.y, p.y + T * d.x);
    });
    const lip = [];
    const top = outer[150], tin = inner[150];
    for (let k = 1; k < 12; k++) { // a round lip from the outer top to the inner top
      const a = Math.PI * k / 12, m = top.clone().add(tin).multiplyScalar(0.5);
      lip.push(new THREE.Vector2(m.x + (top.x - m.x) * Math.cos(a), m.y + T * 0.55 * Math.sin(a) + (top.y - m.y) * Math.cos(a)));
    }
    const innerDown = inner.slice().reverse().filter(p => p.y > -1.62);
    const profile = [new THREE.Vector2(0.001, -1.7), ...outer, ...lip, ...innerDown, new THREE.Vector2(0.001, -1.62)];
    const vOuter = (outer.length + 1) / profile.length; // share of the profile on the outside (for the glaze bands)

    // glaze: deep blue outside with cream and gold bands, pale celadon inside
    const colors = profile.map((p, j) => {
      if (j / profile.length > vOuter + 0.02) return new THREE.Color('#A9D1C2');
      const y = p.y;
      if (Math.abs(y + 0.62) < 0.05 || Math.abs(y - 1.05) < 0.04) return new THREE.Color('#E0A93B');
      if (Math.abs(y + 0.45) < 0.09 || Math.abs(y + 0.8) < 0.09 || Math.abs(y - 0.6) < 0.07) return new THREE.Color('#F3E7D0');
      return new THREE.Color(y < -1.45 ? '#C8784A' : '#1D4F86');
    });
    const glaze = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12, side: THREE.DoubleSide });
    const vase = new THREE.Mesh(new THREE.BufferGeometry(), glaze);
    vase.castShadow = vase.receiveShadow = true;
    scene.add(vase);

    // the cross-section (between outer and inner wall) that caps each cut face
    const section = new THREE.Shape([new THREE.Vector2(0, -1.7), ...outer, ...lip, ...innerDown, new THREE.Vector2(0, -1.62)]);
    const clay = new THREE.MeshStandardMaterial({ color: '#C8784A', roughness: 0.85, side: THREE.DoubleSide });
    const capGeo = new THREE.ShapeGeometry(section, 4);
    const caps = [0, 1].map(() => { const m = new THREE.Mesh(capGeo, clay); m.castShadow = true; scene.add(m); return m; });

    // the profile curve itself, drawn as a glowing tube on each sweeping arm, with its spline keys as beads
    const tubePath = new THREE.CatmullRomCurve3(outer.map(p => new THREE.Vector3(0, p.y, p.x + 0.012)));
    const lineMat = new THREE.MeshBasicMaterial({ color: '#FF5A36', transparent: true });
    const beadMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true });
    const arms = [0, 1].map(() => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.TubeGeometry(tubePath, 200, 0.03, 10), lineMat));
      for (const [r, y] of KEYS) {
        const bead = new THREE.Mesh(new THREE.SphereGeometry(0.065, 20, 12), beadMat);
        bead.position.set(0, y, r + 0.012);
        g.add(bead);
      }
      scene.add(g);
      return g;
    });
    // the axis of revolution, dashed
    const axisMat = new THREE.MeshBasicMaterial({ color: '#5B3A2A', transparent: true, opacity: 0.55 });
    for (let k = 0; k < 13; k++) {
      const d = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.16, 8), axisMat);
      d.position.y = -1.6 + k * 0.28;
      scene.add(d);
    }

    return {
      scene, camera,
      update(t) {
        // on the cycle clock u (the loop starts 1.2 s in, mid-sweep): the leading arm sweeps round between 0.3 and
        // 2.1 s (towards the camera first), the trailing arm follows between 2.95 and 4.7 s; the surface spans the
        // angles from the leading to the trailing arm
        const u = (t + 1.2) % 5;
        const lead = START - TAU * ease.inOut(span(u, 0.3, 2.1)), trail = START - TAU * ease.inOut(span(u, 2.95, 4.7));
        const a = lead, b = trail, len = b - a;
        vase.geometry.dispose();
        if (len > 1e-4) {
          const g = new THREE.LatheGeometry(profile, Math.max(4, Math.ceil(180 * len / TAU)), a, len > TAU - 1e-3 ? Math.PI * 2 : len);
          const n = profile.length, col = new Float32Array(g.attributes.position.count * 3);
          for (let i = 0; i < col.length / 3; i++) colors[i % n].toArray(col, i * 3);
          g.setAttribute('color', new THREE.BufferAttribute(col, 3));
          vase.geometry = g;
        } else vase.geometry = new THREE.BufferGeometry();
        const whole = len > TAU - 1e-3; // a closed vase needs no caps
        arc.geometry.dispose();
        arc.geometry = len > 1e-4 && !whole ? new THREE.RingGeometry(1.42, 1.5, Math.ceil(160 * len / TAU) + 2, 1, a - Math.PI / 2, len) : new THREE.BufferGeometry();
        const sway = 0.2 * Math.sin(phase(t) * TAU); // the camera drifts a little round the wheel
        camera.position.set(11.5 * Math.sin(sway), 3.6, 11.5 * Math.cos(sway));
        camera.lookAt(0, 0.05, 0);
        [lead, trail].forEach((phi, k) => {
          caps[k].visible = len > 1e-4 && !whole;
          caps[k].rotation.y = phi - Math.PI / 2;
          arms[k].rotation.y = phi;
        });
        // the profile shows while it works, and fades while the finished vase stands alone
        const show = 1 - span(u, 2.1, 2.35) + span(u, 2.7, 2.95);
        lineMat.opacity = beadMat.opacity = show;
        arms[0].visible = show > 0.01;
        arms[1].visible = show > 0.01 && len > 1e-4 && u > 2.5;
      },
    };
  },
};
