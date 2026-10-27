// 3D card flip (three.js): a glossy card (front and back are separate rounded planes with canvas textures, plus a thin
// edge) turns over around its vertical axis in perspective, lifting toward the camera; studio reflections slide across it.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TAU, FONT, canvas, clamp, ease, smoothstep } from '../lib/util.js';

const CW = 6.4, CH = 10.1, R = 0.5, DEPTH = 0.05;
let side = 0; // 0 = front facing us, 1 = back (for the caption)

function texture(draw) {
  const c = canvas(1024, 1616), g = c.getContext('2d');
  draw(g, 1024, 1616);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return tex;
}

function front(g, w, h) {
  const bg = g.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#20245A'); bg.addColorStop(0.55, '#5A2D91'); bg.addColorStop(1, '#E2577E');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  for (const [x, y, r, a] of [[880, 360, 520, 0.16], [120, 1300, 600, 0.12], [700, 1100, 260, 0.1]]) {
    const o = g.createRadialGradient(x, y, 0, x, y, r);
    o.addColorStop(0, `rgba(255, 255, 255, ${a})`); o.addColorStop(1, 'rgba(255, 255, 255, 0)');
    g.fillStyle = o; g.fillRect(0, 0, w, h);
  }
  g.fillStyle = '#FFF'; g.font = `700 92px ${FONT.display}`; g.fillText('NOVA', 90, 180);
  g.strokeStyle = '#FFF'; g.lineWidth = 12; g.lineCap = 'round'; // contactless waves
  for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(840, 150, 30 + i * 30, -0.7, 0.7); g.stroke(); }
  const chip = g.createLinearGradient(90, 420, 290, 570);
  chip.addColorStop(0, '#F7DE9C'); chip.addColorStop(1, '#C9A04E');
  g.fillStyle = chip; g.beginPath(); g.roundRect(90, 420, 200, 150, 26); g.fill();
  g.strokeStyle = 'rgba(120, 80, 20, 0.6)'; g.lineWidth = 5;
  g.beginPath(); g.moveTo(90, 495); g.lineTo(290, 495); g.moveTo(190, 420); g.lineTo(190, 570); g.stroke();
  g.fillStyle = 'rgba(255, 255, 255, 0.75)'; g.font = `500 44px ${FONT.sans}`; g.fillText('PLATINUM', 90, 1380);
  g.fillStyle = '#FFF'; g.font = `600 64px ${FONT.sans}`; g.fillText('KIM HANEUL', 90, 1470);
  g.globalAlpha = 0.9; g.fillStyle = '#FF5F6D'; g.beginPath(); g.arc(780, 1440, 80, 0, TAU); g.fill();
  g.fillStyle = '#FFB84C'; g.beginPath(); g.arc(880, 1440, 80, 0, TAU); g.fill(); g.globalAlpha = 1;
}

function back(g, w, h) {
  const bg = g.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#272B5E'); bg.addColorStop(1, '#3B1F5E');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = '#0C0C16'; g.fillRect(90, 0, 170, h); // magnetic stripe
  g.fillStyle = 'rgba(255, 255, 255, 0.6)'; g.font = `500 40px ${FONT.sans}`; g.fillText('CARD NUMBER', 340, 250);
  g.fillStyle = '#FFF'; g.font = `500 84px ${FONT.mono}`;
  ['5284', '1937', '6620', '1093'].forEach((q, i) => g.fillText(q, 340, 360 + i * 110));
  g.fillStyle = 'rgba(255, 255, 255, 0.6)'; g.font = `500 40px ${FONT.sans}`;
  g.fillText('VALID THRU', 340, 900); g.fillText('CVC', 700, 900);
  g.fillStyle = '#FFF'; g.font = `500 72px ${FONT.mono}`; g.fillText('08/29', 340, 990); g.fillText('417', 700, 990);
  g.fillStyle = '#ECEAF2'; g.beginPath(); g.roundRect(340, 1110, 590, 110, 14); g.fill();
  g.fillStyle = '#5A4E7A'; g.font = `italic 500 64px ${FONT.serif}`; g.fillText('Kim Haneul', 370, 1188);
  g.fillStyle = 'rgba(255, 255, 255, 0.5)'; g.font = `500 34px ${FONT.ko}`;
  g.fillText('고객센터 1588-0000', 340, 1440); g.fillText('NOVA BANK', 340, 1500);
}

export default {
  name: 'Card Flip',
  ko: '카드 플립',
  three(renderer, W, H) {
    const scene = new THREE.Scene();
    const bgc = canvas(540, 960), b = bgc.getContext('2d');
    const bg = b.createLinearGradient(0, 0, 0, 960);
    bg.addColorStop(0, '#191B33'); bg.addColorStop(1, '#2C1B3D');
    b.fillStyle = bg; b.fillRect(0, 0, 540, 960);
    const glow = b.createRadialGradient(270, 520, 20, 270, 520, 460);
    glow.addColorStop(0, 'rgba(150, 110, 255, 0.35)'); glow.addColorStop(1, 'rgba(150, 110, 255, 0)');
    b.fillStyle = glow; b.fillRect(0, 0, 540, 960);
    scene.background = new THREE.CanvasTexture(bgc);
    scene.background.colorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.45;
    const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 100);
    camera.position.set(0, 0, 23);
    const key = new THREE.DirectionalLight('#FFFFFF', 1.2);
    key.position.set(-6, 8, 12);
    scene.add(key, new THREE.AmbientLight('#FFFFFF', 0.4));

    // soft shadow behind the card: a blurred rounded rectangle on a plane, squeezed as the card turns
    const sc = canvas(512, 768), sg = sc.getContext('2d');
    sg.shadowColor = 'rgba(0, 0, 0, 1)'; sg.shadowBlur = 90; sg.fillStyle = '#000';
    sg.beginPath(); sg.roundRect(106, 106, 300, 556, 30); sg.fill();
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(CW * 1.7, CH * 1.38),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, opacity: 0.45, depthWrite: false }));
    shadow.position.set(0.5, -1.9, -2.5);
    scene.add(shadow);

    const shape = new THREE.Shape();
    shape.moveTo(-CW / 2 + R, -CH / 2);
    shape.lineTo(CW / 2 - R, -CH / 2); shape.quadraticCurveTo(CW / 2, -CH / 2, CW / 2, -CH / 2 + R);
    shape.lineTo(CW / 2, CH / 2 - R); shape.quadraticCurveTo(CW / 2, CH / 2, CW / 2 - R, CH / 2);
    shape.lineTo(-CW / 2 + R, CH / 2); shape.quadraticCurveTo(-CW / 2, CH / 2, -CW / 2, CH / 2 - R);
    shape.lineTo(-CW / 2, -CH / 2 + R); shape.quadraticCurveTo(-CW / 2, -CH / 2, -CW / 2 + R, -CH / 2);
    const face = new THREE.ShapeGeometry(shape, 16);
    const uv = face.attributes.uv, pos = face.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / CW + 0.5, pos.getY(i) / CH + 0.5);
    const gloss = map => new THREE.MeshPhysicalMaterial({ map, roughness: 0.5, metalness: 0.05, clearcoat: 0.5, clearcoatRoughness: 0.4 });

    const card = new THREE.Group();
    const f = new THREE.Mesh(face, gloss(texture(front)));
    f.position.z = DEPTH / 2;
    const bk = new THREE.Mesh(face, gloss(texture(back)));
    bk.position.z = -DEPTH / 2; bk.rotation.y = Math.PI;
    const edgeGeo = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: false, curveSegments: 16 });
    edgeGeo.translate(0, 0, -DEPTH / 2);
    const edge = new THREE.Mesh(edgeGeo, [new THREE.MeshBasicMaterial({ visible: false }), // caps hidden: the faces are the planes
      new THREE.MeshStandardMaterial({ color: '#D9D4E8', metalness: 0.7, roughness: 0.3 })]);
    card.add(f, bk, edge);
    card.position.y = -0.6;
    scene.add(card);

    const pose = t => {
      const a = t / 5 * TAU;
      const k1 = ease.inOut(clamp((t - 0.7) / 1.4)), k2 = ease.inOut(clamp((t - 3.15) / 1.4));
      const turn = Math.PI * (k1 + k2), lift = Math.sin(Math.PI * k1) + Math.sin(Math.PI * k2);
      card.rotation.set(0.07 * Math.sin(a), turn + 0.12 * Math.sin(a + 1), 0.04 * lift);
      card.position.z = 2.2 * lift;
      shadow.scale.x = 0.12 + 0.88 * Math.abs(Math.cos(turn));
      shadow.material.opacity = 0.45 - 0.2 * lift;
      side = 0.5 - 0.5 * Math.cos(turn);
    };

    // motion blur: 9 renders spread over 1.5 frames, averaged on screen through a full-screen quad
    const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: rt.texture, transparent: true, depthTest: false }));
    const post = new THREE.Scene(), flat = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    post.add(quad);
    renderer.autoClear = false;
    return {
      render(t) {
        renderer.setRenderTarget(null); renderer.clear();
        for (let k = 0; k < 9; k++) {
          pose(t + (k / 8 - 0.5) / 20);
          renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, camera);
          renderer.setRenderTarget(null);
          quad.material.opacity = 1 / (k + 1);
          renderer.render(post, flat);
        }
        pose(t);
      },
    };
  },
  overlay(ctx, t, W, H) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'; ctx.font = `700 46px ${FONT.ko}`;
    ctx.fillText('NOVA 플래티넘 카드', W / 2, 1790);
    ctx.font = `500 34px ${FONT.ko}`;
    const s = smoothstep(0.3, 0.7, side);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.6 * (1 - s)})`; ctx.fillText('앞면', W / 2, 1846);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.6 * s})`; ctx.fillText('뒷면 · 카드 정보', W / 2, 1846);
  },
};
