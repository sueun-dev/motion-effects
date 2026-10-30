// Blueprint: a flanged bearing housing drawn as a technical drawing on blueprint paper. The lines are the part's
// creases (faces meeting at more than 25 degrees) plus its silhouettes, found again every frame on the curved walls
// (edges between a face turned towards the camera and one turned away). A depth pre-pass of the solid splits them:
// what is in front is drawn solid, what is behind is drawn dashed (hidden lines). The part turns a quarter turn per
// loop; it has four-fold symmetry, so the loop is seamless.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { TAU, phase, canvas, FONT } from '../lib/util.js';

const visibleMat = new LineMaterial({ color: '#F4FAFF', linewidth: 2.6, depthWrite: false });
const hiddenMat = new LineMaterial({ color: '#BFD9F7', linewidth: 1.7, dashed: true, dashSize: 0.11, gapSize: 0.08, transparent: true, opacity: 0.85, depthWrite: false, depthFunc: THREE.GreaterDepth });

// segments [x0, y0, z0, x1, y1, z1, ...] -> line geometry whose dash distance runs along each segment (stable per edge)
function lines(seg, geo = new LineSegmentsGeometry()) {
  geo.setPositions(seg);
  const d = new Float32Array(seg.length / 3);
  for (let i = 0; i < seg.length; i += 6) {
    const dx = seg[i + 3] - seg[i], dy = seg[i + 4] - seg[i + 1], dz = seg[i + 5] - seg[i + 2], len = Math.hypot(dx, dy, dz) || 1;
    const s = (seg[i] * dx + seg[i + 1] * dy + seg[i + 2] * dz) / len;
    d[i / 3] = s; d[i / 3 + 1] = s + len;
  }
  const buf = new THREE.InstancedInterleavedBuffer(d, 2, 1);
  geo.setAttribute('instanceDistanceStart', new THREE.InterleavedBufferAttribute(buf, 1, 0));
  geo.setAttribute('instanceDistanceEnd', new THREE.InterleavedBufferAttribute(buf, 1, 1));
  return geo;
}

// one solid: a depth-filling mesh, its crease lines, and a table of smooth edges that can become silhouettes
function solid(geo, parent) {
  const fill = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: '#1D5BA6', emissive: '#123F7C', polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 4 }));
  parent.add(fill);
  const crease = Array.from(new THREE.EdgesGeometry(geo, 25).attributes.position.array);
  const g = mergeVertices(geo.clone().deleteAttribute('normal').deleteAttribute('uv'), 1e-4), p = g.attributes.position, ix = g.index.array;
  const normals = [], byEdge = new Map(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let f = 0; f < ix.length / 3; f++) {
    const v = [ix[3 * f], ix[3 * f + 1], ix[3 * f + 2]];
    a.fromBufferAttribute(p, v[0]); b.fromBufferAttribute(p, v[1]); c.fromBufferAttribute(p, v[2]);
    normals.push(new THREE.Vector3().crossVectors(b.sub(a), c.sub(a)).normalize());
    [[v[0], v[1]], [v[1], v[2]], [v[2], v[0]]].forEach(([m, n]) => {
      const k = m < n ? m * 1e6 + n : n * 1e6 + m;
      if (!byEdge.has(k)) byEdge.set(k, [m, n]);
      byEdge.get(k).push(f);
    });
  }
  const smooth = [];
  for (const [m, n, f0, f1] of byEdge.values()) {
    if (f1 === undefined || normals[f0].dot(normals[f1]) < Math.cos(THREE.MathUtils.degToRad(25))) continue; // creases are drawn already
    smooth.push([p.getX(m), p.getY(m), p.getZ(m), p.getX(n), p.getY(n), p.getZ(n), f0, f1]);
  }
  const creaseGeo = lines(crease);
  const silGeo = new LineSegmentsGeometry(), sv = new LineSegments2(silGeo, visibleMat), sh = new LineSegments2(silGeo, hiddenMat);
  const all = [new LineSegments2(creaseGeo, visibleMat), new LineSegments2(creaseGeo, hiddenMat), sv, sh];
  all.forEach(l => { l.renderOrder = 1; parent.add(l); });          // lines after every fill, so the depth is complete
  return view => {                                         // view: direction towards the camera, in the part's space
    const seg = [];
    for (const e of smooth) if ((normals[e[6]].dot(view) > 0) !== (normals[e[7]].dot(view) > 0)) seg.push(e[0], e[1], e[2], e[3], e[4], e[5]);
    if (!seg.length) seg.push(0, 0, 0, 0, 0, 0);
    const old = sv.geometry, geo = lines(seg);
    sv.geometry = geo; sh.geometry = geo;
    old.dispose();
  };
}

function plateGeo() {                                      // rounded square plate with four bolt holes and a bore
  const s = new THREE.Shape(), h = 1.6, r = 0.35;
  s.moveTo(-h + r, -h); s.lineTo(h - r, -h); s.quadraticCurveTo(h, -h, h, -h + r); s.lineTo(h, h - r); s.quadraticCurveTo(h, h, h - r, h);
  s.lineTo(-h + r, h); s.quadraticCurveTo(-h, h, -h, h - r); s.lineTo(-h, -h + r); s.quadraticCurveTo(-h, -h, -h + r, -h);
  for (const [x, y] of [[1.1, 1.1], [-1.1, 1.1], [-1.1, -1.1], [1.1, -1.1]]) { const p = new THREE.Path(); p.absarc(x, y, 0.22, 0, TAU, true); s.holes.push(p); }
  const bore = new THREE.Path(); bore.absarc(0, 0, 0.55, 0, TAU, true); s.holes.push(bore);
  return new THREE.ExtrudeGeometry(s, { depth: 0.4, bevelEnabled: false, curveSegments: 12 }).rotateX(-Math.PI / 2);
}

export default {
  name: 'Blueprint',
  ko: '블루프린트',
  three(renderer, W, H) {
    const scene = new THREE.Scene();
    const paper = canvas(W, H), g = paper.getContext('2d');           // blueprint paper with a fixed grid
    const grd = g.createLinearGradient(0, 0, W, H);
    grd.addColorStop(0, '#0E3A78'); grd.addColorStop(1, '#0A2E63');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    for (let x = 0; x <= W; x += 30) { g.fillStyle = x % 150 ? 'rgba(160, 200, 255, 0.08)' : 'rgba(160, 200, 255, 0.18)'; g.fillRect(x, 0, x % 150 ? 1 : 2, H); }
    for (let y = 0; y <= H; y += 30) { g.fillStyle = y % 150 ? 'rgba(160, 200, 255, 0.08)' : 'rgba(160, 200, 255, 0.18)'; g.fillRect(0, y, W, y % 150 ? 1 : 2); }
    scene.background = new THREE.CanvasTexture(paper); scene.background.colorSpace = THREE.SRGBColorSpace;
    const S = 2.6, camera = new THREE.OrthographicCamera(-S, S, S * H / W, -S * H / W, 0.1, 100);
    camera.position.set(10, 6.2, 10); camera.lookAt(0, 0.55, 0); camera.updateMatrixWorld();
    camera.position.y -= 0.5; camera.updateMatrixWorld();               // the part sits in the upper half
    [visibleMat, hiddenMat].forEach(m => m.resolution.set(W, H));
    scene.add(new THREE.HemisphereLight('#FFFFFF', '#8899AA', 0.9));
    const sun = new THREE.DirectionalLight('#FFFFFF', 0.5); sun.position.set(-3, 6, 2); scene.add(sun);

    const part = new THREE.Group(); scene.add(part);
    const updaters = [solid(plateGeo(), part)];
    const boss = new THREE.LatheGeometry([[0.55, 0.4], [0.95, 0.4], [0.95, 1.85], [0.88, 1.92], [0.62, 1.92], [0.55, 1.85], [0.55, 0.4]].map(([x, y]) => new THREE.Vector2(x, y)), 64);
    updaters.push(solid(boss, part));
    const rib = new THREE.Shape(); rib.moveTo(0.94, 0.4); rib.lineTo(1.45, 0.4); rib.lineTo(0.94, 1.45); rib.closePath();
    for (let k = 0; k < 4; k++) {                                       // four gussets between the boss and the plate
      const geo = new THREE.ExtrudeGeometry(rib, { depth: 0.18, bevelEnabled: false }).translate(0, 0, -0.09).rotateY(k * Math.PI / 2);
      updaters.push(solid(geo, part));
    }

    const toCam = new THREE.Vector3(), inv = new THREE.Quaternion();
    return {
      scene, camera,
      update(t) {
        part.rotation.y = phase(t) * Math.PI / 2 + 0.35;               // a quarter turn per loop
        part.updateMatrixWorld();
        camera.getWorldDirection(toCam).negate();
        toCam.applyQuaternion(inv.copy(part.quaternion).invert());
        updaters.forEach(u => u(toCam));
      },
    };
  },
  overlay(ctx, t, W, H) {
    ctx.strokeStyle = 'rgba(230, 242, 255, 0.85)'; ctx.lineWidth = 3;
    ctx.strokeRect(36, 290, W - 72, H - 326);                            // sheet border
    const x = W - 36 - 520, y = H - 36 - 210;                            // title block
    ctx.lineWidth = 2; ctx.strokeRect(x, y, 520, 210);
    ctx.beginPath(); ctx.moveTo(x, y + 70); ctx.lineTo(x + 520, y + 70); ctx.moveTo(x, y + 140); ctx.lineTo(x + 520, y + 140); ctx.moveTo(x + 260, y + 70); ctx.lineTo(x + 260, y + 210); ctx.stroke();
    ctx.fillStyle = 'rgba(235, 245, 255, 0.95)'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.font = `700 34px ${FONT.mono}`; ctx.fillText('BEARING HOUSING', x + 22, y + 36);
    ctx.font = `500 24px ${FONT.mono}`;
    ctx.fillText('MATL  AL 6061-T6', x + 22, y + 105); ctx.fillText('SCALE  1:2', x + 282, y + 105);
    ctx.fillText('DWG NO  239-A', x + 22, y + 175); ctx.fillText('SHEET  1 / 1', x + 282, y + 175);
    // legend: visible and hidden line styles
    const lx = 600, ly = 1430;
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 90, ly); ctx.stroke();
    ctx.lineWidth = 2; ctx.setLineDash([14, 10]); ctx.beginPath(); ctx.moveTo(lx, ly + 60); ctx.lineTo(lx + 90, ly + 60); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillText('VISIBLE EDGE', lx + 112, ly); ctx.fillText('HIDDEN EDGE', lx + 112, ly + 60);
    // a fixed top view with centre lines and the overall width, like the other views on a real sheet
    const cx = 290, cy = 1560, u = 62, h = 1.6 * u, rr = 0.35 * u;
    ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect(cx - h, cy - h, 2 * h, 2 * h, rr); ctx.stroke();
    [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(([i, j]) => { ctx.beginPath(); ctx.arc(cx + 1.1 * u * i, cy + 1.1 * u * j, 0.22 * u, 0, TAU); ctx.stroke(); });
    for (const r of [0.95, 0.88, 0.62, 0.55]) { ctx.beginPath(); ctx.arc(cx, cy, r * u, 0, TAU); ctx.stroke(); }
    for (let k = 0; k < 4; k++) {                                        // the gussets seen from above
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(k * Math.PI / 2); ctx.strokeRect(0.95 * u, -0.09 * u, 0.5 * u, 0.18 * u); ctx.restore();
    }
    ctx.lineWidth = 1.5; ctx.setLineDash([26, 6, 4, 6]);                  // centre lines
    ctx.beginPath(); ctx.moveTo(cx - h - 24, cy); ctx.lineTo(cx + h + 24, cy); ctx.moveTo(cx, cy - h - 24); ctx.lineTo(cx, cy + h + 24); ctx.stroke();
    ctx.setLineDash([]);
    const dy = cy - h - 46;                                               // overall width dimension
    ctx.beginPath(); ctx.moveTo(cx - h, dy); ctx.lineTo(cx + h, dy); ctx.moveTo(cx - h, dy - 14); ctx.lineTo(cx - h, cy - h - 8); ctx.moveTo(cx + h, dy - 14); ctx.lineTo(cx + h, cy - h - 8); ctx.stroke();
    [[cx - h, 1], [cx + h, -1]].forEach(([x0, sgn]) => { ctx.beginPath(); ctx.moveTo(x0, dy); ctx.lineTo(x0 + 16 * sgn, dy - 6); ctx.lineTo(x0 + 16 * sgn, dy + 6); ctx.fill(); });
    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(17, 58, 120, 1)'; ctx.fillRect(cx - 38, dy - 16, 76, 32);
    ctx.fillStyle = 'rgba(235, 245, 255, 0.95)'; ctx.fillText('64', cx, dy);
    ctx.fillText('TOP VIEW', cx, cy + h + 60);
  },
};
