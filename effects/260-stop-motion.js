// Stop motion: a felt robin puppet on a felt-and-cardboard tabletop set hops right, pecks, turns round, hops back and
// turns again. The puppet is only ever posed on whole "exposures": time is cut into steps of 1/15 s, so every pose is
// held for exactly two of the 30 video frames ("on twos"), with nothing in between, the way an animator moves a
// puppet and takes a picture. The set, the camera and the light never move; there is no random boil or jitter.
// The strip at the bottom is the exposure sheet: one second of frames, paired two by two.
import * as THREE from 'three';
import { TAU, lerp, span, ease, rng, canvas, FONT } from '../lib/util.js';

const POSES = 15;                                  // poses per second: each held 2 frames at 30 fps
const onTwos = t => Math.floor(t * POSES + 1e-6) / POSES;

// a felt texture: base colour, fibre speckles, and optional running stitches round the middle (drawn once)
function felt(base, stitch) {
  const c = canvas(512, 256), g = c.getContext('2d'), r = rng(base.length * 7 + 3);
  g.fillStyle = base; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 6000; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.07)';
    g.save(); g.translate(r() * 512, r() * 256); g.rotate(r() * TAU); g.fillRect(0, 0, 3 + r() * 6, 1); g.restore();
  }
  if (stitch) { g.fillStyle = stitch; for (let x = 0; x < 512; x += 16) g.fillRect(x, 126, 9, 4); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return new THREE.MeshPhysicalMaterial({ map: tex, roughness: 1, sheen: 1, sheenRoughness: 0.7, sheenColor: '#FFFFFF', bumpMap: tex, bumpScale: 0.6 });
}
const card = (face, edge, glow = 0) => [new THREE.MeshStandardMaterial({ color: face, roughness: 0.9, emissive: face, emissiveIntensity: glow }), new THREE.MeshStandardMaterial({ color: edge, roughness: 1 })];
const cutout = (pts, depth, mats) => { // a cardboard cut-out: a closed outline extruded a little
  const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 24 }), mats);
  m.castShadow = m.receiveShadow = true;
  return m;
};

// the bird's performance, as a function of (stepped) time: [x, hop height, facing, squash, peck, wing]
const X = 0.45, HOPS = [[0.35, -X, 0], [1.05, 0, X], [2.95, X, 0], [3.65, 0, -X]]; // [take-off time, from, to]
function perform(t) {
  t = (t + 0.25) % 5; // the loop starts as the first crouch begins, so frame 149 -> 0 is a step like any other
  let x = -X, y = 0, squash = 1;
  for (const [a, x0, x1] of HOPS) {
    if (t >= a) x = x1;
    if (t >= a - 0.15 && t < a + 0.55) { // crouch 0.15 s, fly 0.4 s, land and squash 0.15 s
      const k = span(t, a, a + 0.4);
      x = lerp(x0, x1, ease.inOut(k)); y = 0.42 * Math.sin(Math.PI * k);
      squash = t < a ? 1 - 0.16 * span(t, a - 0.15, a) : t < a + 0.4 ? 1 + 0.12 * Math.sin(Math.PI * k) : 1 - 0.16 * Math.sin(Math.PI * span(t, a + 0.4, a + 0.55));
    }
  }
  const facing = lerp(lerp(1, -1, ease.inOut(span(t, 2.25, 2.75))), 1, ease.inOut(span(t, 4.35, 4.85))); // right, round to left, back
  const peck = t > 1.7 && t < 2.15 ? 0.5 - 0.5 * Math.cos(TAU * 2 * span(t, 1.7, 2.15)) : 0;            // two pecks
  return { x, y, facing, squash, peck, wing: y > 0.02 ? 0.9 * Math.abs(Math.sin(TAU * t * 3)) : 0 };
}

export default {
  name: 'Stop Motion',
  ko: '스톱모션',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    // the painted sky card, soft as if out of focus
    const sky = canvas(270, 480), g = sky.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 480);
    grd.addColorStop(0, '#7FB4E0'); grd.addColorStop(0.7, '#CFE6F0'); grd.addColorStop(1, '#F3E9D2');
    g.fillStyle = grd; g.fillRect(0, 0, 270, 480);
    const skyTex = new THREE.CanvasTexture(sky); skyTex.colorSpace = THREE.SRGBColorSpace;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(9, 16), new THREE.MeshStandardMaterial({ map: skyTex, roughness: 1, emissiveMap: skyTex, emissive: '#FFFFFF', emissiveIntensity: 0.55 }));
    back.position.set(0, 3.2, -3.2); back.receiveShadow = true;
    scene.add(back);

    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 50);
    camera.position.set(0, 1.8, 10);
    camera.lookAt(0, 1.3, 0);
    const key = new THREE.SpotLight('#FFE7C4', 90, 20, 0.5, 0.7, 2);
    key.position.set(-3.2, 5.5, 4.5); key.target.position.set(0, 0.6, 0);
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 5; key.shadow.bias = -0.0005;
    scene.add(key, key.target, new THREE.HemisphereLight('#DCEBFF', '#7A5A3A', 0.9));
    const fill = new THREE.DirectionalLight('#BFD6FF', 0.6); fill.position.set(4, 2, 5); scene.add(fill);

    // the ground: a felt hill, with felt flowers
    const hill = new THREE.Mesh(new THREE.SphereGeometry(9, 96, 48), felt('#5E9A3A'));
    hill.scale.set(1, 0.18, 0.6); hill.position.set(0, -1.62, -0.6); hill.receiveShadow = true;
    scene.add(hill);
    const flower = (x, z, color, h) => {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, h, 8), new THREE.MeshStandardMaterial({ color: '#3F6B2A' }));
      stem.position.set(x, h / 2, z); stem.castShadow = true;
      const head = new THREE.Group(); head.position.set(x, h, z); head.rotation.x = 0.9;
      for (let i = 0; i < 6; i++) {
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 8), felt(color));
        p.scale.set(1, 0.3, 0.55); p.position.set(0.08 * Math.cos(i * TAU / 6), 0, 0.08 * Math.sin(i * TAU / 6)); p.rotation.y = -i * TAU / 6;
        p.castShadow = true; head.add(p);
      }
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), new THREE.MeshStandardMaterial({ color: '#F2B632', roughness: 0.4 }));
      head.add(bead);
      scene.add(stem, head);
    };
    flower(-1.55, 0.5, '#F7F2E6', 0.42); flower(-1.25, -0.2, '#F59AB5', 0.55); flower(1.5, 0.35, '#F7D046', 0.38); flower(1.85, -0.4, '#F7F2E6', 0.5);

    // cardboard props: a tree, two clouds and a sun on a wire, each a flat cut-out with a pale card edge
    const tree = new THREE.Group();
    const canopy = []; for (let i = 0; i < 48; i++) { const a = (i / 48) * TAU, r = 0.75 + 0.12 * Math.cos(5 * a); canopy.push([r * Math.cos(a), 1.9 + 0.95 * r * Math.sin(a)]); }
    tree.add(cutout([[-0.12, 0], [0.12, 0], [0.09, 1.3], [-0.09, 1.3]], 0.04, card('#8A5A35', '#D9B98C')), cutout(canopy, 0.05, card('#4E8A3A', '#D9C79C')));
    tree.position.set(1.2, 0, -1.6); tree.rotation.y = -0.2;
    scene.add(tree);
    const wood = new THREE.MeshStandardMaterial({ color: '#B88A5A', roughness: 0.8 }); // a little wooden fence behind
    for (let i = 0; i < 5; i++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.75, 0.09), wood);
      post.position.set(-2.0 + i * 0.55, 0.3, -1.1); post.castShadow = post.receiveShadow = true; scene.add(post);
    }
    for (const y of [0.22, 0.5]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.07, 0.05), wood);
      rail.position.set(-0.9, y, -1.04); rail.castShadow = rail.receiveShadow = true; scene.add(rail);
    }
    const cloud = (x, y, s) => {
      const pts = []; for (let i = 0; i < 64; i++) { const a = (i / 64) * TAU, r = 1 + 0.18 * Math.abs(Math.sin(3 * a)); pts.push([1.1 * r * Math.cos(a), 0.45 * r * Math.sin(a) + (Math.sin(a) < 0 ? 0.12 * Math.sin(a) : 0)]); }
      const m = cutout(pts, 0.04, card('#FFFFFF', '#E6DCC8', 0.8)); m.position.set(x, y, -2.6); m.scale.setScalar(s); scene.add(m);
    };
    cloud(-0.9, 3.25, 0.55); cloud(1.25, 3.85, 0.45);
    const sun = new THREE.Group();
    const rays = []; for (let i = 0; i < 48; i++) { const a = (i / 48) * TAU, r = i % 2 ? 0.42 : 0.55; rays.push([r * Math.cos(a), r * Math.sin(a)]); }
    sun.add(cutout(rays, 0.03, card('#F6B73C', '#F3D9A0', 0.45)));
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 2, 6), new THREE.MeshStandardMaterial({ color: '#555555', metalness: 0.8, roughness: 0.4 }));
    wire.position.y = 1; sun.add(wire);
    sun.position.set(-1.45, 4.15, -2.4);
    scene.add(sun);

    // the puppet: a round felt body with a seam, belly, wings, tail, button eyes, a wooden beak and wire legs
    const bird = new THREE.Group(), body = new THREE.Group();
    bird.add(body);
    const red = felt('#C9412F', '#F3E3C8'), dark = felt('#9C2F22'), cream = felt('#F1DDBE');
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.42, 48, 32), red);
    torso.scale.set(0.95, 0.9, 1.08); torso.position.y = 0.42; torso.castShadow = true;
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.33, 40, 24), cream);
    belly.scale.set(0.85, 0.85, 0.6); belly.position.set(0, 0.36, 0.23); belly.castShadow = true;
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.22, 24), new THREE.MeshStandardMaterial({ color: '#E8A23A', roughness: 0.55 }));
    beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.5, 0.5); beak.castShadow = true;
    body.add(torso, belly, beak);
    for (const s of [1, -1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 16), new THREE.MeshPhysicalMaterial({ color: '#111111', roughness: 0.15, clearcoat: 1 }));
      eye.scale.set(1, 1, 0.6); eye.position.set(s * 0.2, 0.6, 0.3); eye.lookAt(s * 0.6, 0.65, 1.2);
      body.add(eye);
    }
    const wings = [1, -1].map(s => {
      const pivot = new THREE.Group(); pivot.position.set(s * 0.36, 0.5, -0.02);
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.24, 32, 16), dark);
      w.scale.set(0.25, 0.55, 1); w.position.set(s * 0.02, -0.08, -0.06); w.rotation.x = 0.35; w.castShadow = true;
      pivot.add(w); body.add(pivot);
      return [pivot, s];
    });
    const tail = new THREE.Group(); tail.position.set(0, 0.42, -0.42);
    const fan = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 16), dark);
    fan.scale.set(0.9, 0.18, 1); fan.position.z = -0.16; fan.castShadow = true;
    tail.add(fan); body.add(tail);
    const legMat = new THREE.MeshStandardMaterial({ color: '#3A2A1E', roughness: 0.6, metalness: 0.3 });
    const legs = [1, -1].map(s => {
      const leg = new THREE.Group(); leg.position.set(s * 0.13, 0.1, 0.02);
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.2, 8), legMat); shin.position.y = -0.1; shin.castShadow = true;
      leg.add(shin);
      for (const a of [-0.5, 0, 0.5]) { const toe = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.11, 6), legMat); toe.rotation.set(Math.PI / 2, 0, a); toe.position.set(Math.sin(a) * 0.05, -0.2, 0.05); toe.castShadow = true; leg.add(toe); }
      bird.add(leg);
      return leg;
    });
    scene.add(bird);

    return {
      scene, camera,
      update(t) {
        const p = perform(onTwos(t)); // the puppet only moves between exposures
        bird.position.set(p.x, 0.12 + p.y, 0.55);
        bird.rotation.y = p.facing * 1.05;
        body.scale.set(1 / Math.sqrt(p.squash), p.squash, 1 / Math.sqrt(p.squash));
        body.position.y = 0.1 * p.squash;
        body.rotation.x = 0.55 * p.peck;
        for (const [pivot, s] of wings) pivot.rotation.z = s * p.wing;
        tail.rotation.x = -0.25 + 0.2 * p.peck - 0.25 * (1 - p.squash);
        for (const leg of legs) leg.rotation.x = p.y > 0.02 ? 0.6 : 0;
      },
    };
  },
  overlay(ctx, t, W, H) {
    // the exposure sheet: 30 frames (one second), each pose spanning two of them
    const f = Math.round(t * 30), x0 = 90, cw = 30, y = 1730;
    ctx.fillStyle = 'rgba(20, 16, 12, 0.72)'; ctx.beginPath(); ctx.roundRect(60, 1630, 960, 230, 24); ctx.fill();
    ctx.textAlign = 'left'; ctx.fillStyle = '#FFFFFF'; ctx.font = `800 34px ${FONT.sans}`;
    ctx.fillText('ON TWOS', 90, 1686);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; ctx.font = `500 26px ${FONT.ko}`;
    ctx.fillText('투스 촬영 · 한 포즈를 두 프레임씩', 260, 1686);
    for (let i = 0; i < 15; i++) {
      const on = Math.floor((f % 30) / 2) === i;
      ctx.fillStyle = on ? '#FFB547' : 'rgba(255, 255, 255, 0.14)';
      ctx.beginPath(); ctx.roundRect(x0 + i * 2 * cw + 2, y, 2 * cw - 4, 44, 8); ctx.fill();
      ctx.fillStyle = on ? 'rgba(20, 16, 12, 0.5)' : 'rgba(255, 255, 255, 0.12)';
      ctx.fillRect(x0 + i * 2 * cw + cw - 1, y + 6, 2, 32); // the line between the two frames of one pose
    }
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x0 + (f % 30) * cw + 8, y + 52, cw - 16, 6); // this video frame
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'; ctx.font = `500 22px ${FONT.mono}`;
    ctx.fillText(`frame ${String(f % 150 + 1).padStart(3, '0')} · pose ${String(Math.floor(f / 2) % 75 + 1).padStart(2, '0')} / 75 · 15 poses a second`, 90, 1830);
  },
};
