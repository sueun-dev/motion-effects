// Hydraulic erosion by simulated rain droplets: a fresh fBm mountain (256 x 256 height map) is rained on by
// 120,000 droplets, run once in setup with a fixed seed. Each droplet rolls downhill (gradient by bilinear
// interpolation, a little inertia), speeds up or slows with the drop in height, picks up sediment while its capacity
// (slope x speed x water) exceeds what it carries, eroding with a radius-3 brush, and drops it where it slows or
// climbs; it evaporates 1 % a step and lives 30 steps. The height map is kept at 13 stages and blended by t, so the
// gullies, sharp ridges and sediment fans grow as a time-lapse; 1,200 of the droplets are replayed as glowing beads
// running down the slopes. Then a scan line sweeps across and restores the fresh terrain behind it, the count
// running back with it.
import * as THREE from 'three';
import { rng, fbm3, noise3, clamp, span, smoothstep, ease, FONT } from '../lib/util.js';

const N = 256, DROPS = 120000, STAGES = 12, TRACKS = 1200, LIFE = 30;
const SIZE = 8, HS = 2.9;                                   // terrain width and height scale (units)
const RAIN0 = 0.35, RAIN1 = 3.35, SWEEP0 = 3.75, SWEEP1 = 4.85, RIDE = 0.55;  // seconds; RIDE: a bead's run
const START = 1.0;                                           // the video starts mid-rain, so the loop seam is in motion

function terrain() {
  const h = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / (N - 1), v = y / (N - 1), n = noise3(u * 2.0 + 3.1, v * 2.0 + 7.3, 0.5);
    const ridge = 1 - Math.sqrt(n * n + 0.02);               // soft ridge lines
    let z = 0.5 * (fbm3(u * 3.4, v * 3.4, 1.7, 6) * 0.5 + 0.5) + 0.22 * ridge;
    z += 0.32 * Math.exp(-((u - 0.5) ** 2 + (v - 0.48) ** 2) * 6) - 0.5 * ((u - 0.5) ** 2 + (v - 0.5) ** 2);
    h[y * N + x] = z;
  }
  return h;
}

// rain on map; returns the map at STAGES + 1 moments, the water that ran over each cell per stage, and some tracks
function erode(map) {
  const R = 3, brush = [];
  let wsum = 0;
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const d = Math.hypot(dx, dy);
    if (d <= R) { brush.push([dx, dy, 1 - d / R]); wsum += 1 - d / R; }
  }
  for (const b of brush) b[2] /= wsum;
  const sample = (x, y) => {                                 // height and gradient, bilinear
    const ix = Math.floor(x), iy = Math.floor(y), u = x - ix, v = y - iy, i = iy * N + ix;
    const a = map[i], b = map[i + 1], c = map[i + N], d = map[i + N + 1];
    return [a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v, (b - a) * (1 - v) + (d - c) * v, (c - a) * (1 - u) + (d - b) * u];
  };
  const r = rng(306), snaps = [Float32Array.from(map)], flows = [], tracks = [];
  let flow = new Float32Array(N * N);
  for (let k = 0; k < DROPS; k++) {
    let x = 1 + r() * (N - 3), y = 1 + r() * (N - 3), dx = 0, dy = 0, speed = 1, water = 1, sed = 0;
    const track = k % (DROPS / TRACKS) === 0 ? [x, y] : null;
    for (let l = 0; l < LIFE; l++) {
      const ix = Math.floor(x), iy = Math.floor(y), u = x - ix, v = y - iy, i = iy * N + ix;
      const [h, gx, gy] = sample(x, y);
      dx = dx * 0.05 - gx * 0.95; dy = dy * 0.05 - gy * 0.95;
      const len = Math.hypot(dx, dy);
      if (len < 1e-9) break;
      x += dx / len; y += dy / len;
      if (x < 1 || y < 1 || x >= N - 2 || y >= N - 2) break;
      flow[i] += water;
      if (track) track.push(x, y);
      const dh = sample(x, y)[0] - h, cap = Math.max(-dh * speed * water * 4, 0.01);
      if (sed > cap || dh > 0) {                             // deposit, spread over the cell's four corners
        const amt = dh > 0 ? Math.min(dh, sed) : (sed - cap) * 0.3;
        sed -= amt;
        map[i] += amt * (1 - u) * (1 - v); map[i + 1] += amt * u * (1 - v); map[i + N] += amt * (1 - u) * v; map[i + N + 1] += amt * u * v;
      } else {                                               // erode with the brush, never digging below the drop
        const amt = Math.min((cap - sed) * 0.3, -dh);
        for (const [bx, by, w] of brush) {
          const X = ix + bx, Y = iy + by;
          if (X < 0 || Y < 0 || X >= N || Y >= N) continue;
          const j = Y * N + X, d = Math.min(map[j], amt * w);
          map[j] -= d; sed += d;
        }
      }
      speed = Math.sqrt(Math.max(0, speed * speed - dh * 4));
      water *= 0.99;
    }
    if (track && track.length >= 12) tracks.push({ path: Float32Array.from(track), stage: k / DROPS });
    if ((k + 1) % (DROPS / STAGES) === 0) { snaps.push(Float32Array.from(map)); flows.push(flow); flow = new Float32Array(N * N); }
  }
  return { snaps, flows, tracks };
}

// how far the rain has got (0..1) at time t; the sweep then puts the fresh terrain back
const progress = t => (t < SWEEP1 ? ease.inOut(span(t, RAIN0, RAIN1)) : 0);
const sweepFront = t => 1.15 - 1.3 * ease.inOut(span(t, SWEEP0, SWEEP1));   // in u, from right to left

export default {
  name: 'Hydraulic Erosion',
  ko: '수력 침식',
  three(renderer, W, H) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    const sky = document.createElement('canvas');
    sky.width = 2; sky.height = 512;
    const g = sky.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#30476E'); grd.addColorStop(0.5, '#8FA6C2'); grd.addColorStop(1, '#E9D2B4');
    g.fillStyle = grd; g.fillRect(0, 0, 2, 512);
    scene.background = new THREE.CanvasTexture(sky);
    scene.background.colorSpace = THREE.SRGBColorSpace;
    const sun = new THREE.DirectionalLight('#FFE2BE', 3.0);
    sun.position.set(-10, 6, -3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 40 });
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
    const fill = new THREE.DirectionalLight('#C9D8FF', 0.6);  // a soft fill from the camera side for the slab's front
    fill.position.set(3, 4, 12);
    scene.add(sun, fill, new THREE.HemisphereLight('#B8CCF0', '#5A4A3A', 1.1));

    const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 100);
    camera.position.set(0, 15.5, 16.5);
    camera.lookAt(0, -0.3, 0.9);

    const fresh = terrain(), { snaps, flows, tracks } = erode(Float32Array.from(fresh));
    // water that ran over each cell up to the end of each stage, softened and scaled 0..1
    const wet = [new Float32Array(N * N)];
    for (let s = 0; s < STAGES; s++) {
      const a = Float32Array.from(wet[s]);
      for (let i = 0; i < N * N; i++) a[i] += flows[s][i];
      wet.push(a);
    }
    for (const a of wet) for (let i = 0; i < N * N; i++) a[i] = smoothstep(4.2, 7.5, Math.log1p(a[i]));   // only the real channels

    const geo = new THREE.PlaneGeometry(SIZE, SIZE, N - 1, N - 1).rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, colors = new Float32Array(N * N * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const land = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }));
    land.castShadow = land.receiveShadow = true;
    scene.add(land);
    // the block of earth under the map: four side walls that follow the terrain's edge down to y = -1.6
    const walls = new THREE.BufferGeometry(), wallPos = new Float32Array(4 * N * 2 * 3), wallCol = new Float32Array(4 * N * 2 * 3), idx = [];
    const edges = [k => k, k => (N - 1) * N + k, k => k * N, k => k * N + N - 1];   // back, front, left, right rows of cells
    for (let e = 0; e < 4; e++) for (let k = 0; k < N; k++) {
      const v = (e * N + k) * 2, i = edges[e](k), x = (i % N) / (N - 1) - 0.5, z = Math.floor(i / N) / (N - 1) - 0.5;
      wallPos.set([x * SIZE, 0, z * SIZE, x * SIZE, -1.6, z * SIZE], v * 3);
      wallCol.set([0.62, 0.4, 0.24, 0.3, 0.17, 0.09], v * 3);
      if (k < N - 1) idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
    }
    walls.setAttribute('position', new THREE.BufferAttribute(wallPos, 3));
    walls.setAttribute('color', new THREE.BufferAttribute(wallCol, 3));
    walls.setIndex(idx);
    const earth = new THREE.Mesh(walls, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
    scene.add(earth);

    const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshBasicMaterial({ color: '#8FE6FF' }), tracks.length);
    beads.frustumCulled = false;
    scene.add(beads);

    const heights = new Float32Array(N * N), ROCK = new THREE.Color('#7A6A5C'), GRASS = new THREE.Color('#6E8A48'), DRY = new THREE.Color('#A79A6A');
    const SAND = new THREE.Color('#D9B77C'), CUT = new THREE.Color('#8A4E36'), WATER = new THREE.Color('#3FA7E0'), SCAN = new THREE.Color('#E8FBFF'), c = new THREE.Color();
    const m = new THREE.Matrix4();
    const world = (x, y, h, out) => out.set((x / (N - 1) - 0.5) * SIZE, h * HS, (y / (N - 1) - 0.5) * SIZE);   // map cell -> world
    const v3 = new THREE.Vector3();

    return {
      scene, camera,
      update(time) {
        const t = (time + START) % 5;
        const p = progress(t) * STAGES, s0 = Math.min(STAGES - 1, Math.floor(p)), w = p - s0;
        const A = snaps[s0], B = snaps[s0 + 1], WA = wet[s0], WB = wet[s0 + 1], front = sweepFront(t);
        const rain = span(t, RAIN0, RAIN0 + 0.4) * (1 - span(t, RAIN1 - 0.2, SWEEP0 + 0.2));
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
          const i = y * N + x, back = t < SWEEP1 && t > SWEEP0 ? smoothstep(front - 0.05, front + 0.05, x / (N - 1)) : 0;
          heights[i] = (A[i] + (B[i] - A[i]) * w) * (1 - back) + fresh[i] * back;
          pos.setY(i, heights[i] * HS);
        }
        pos.needsUpdate = true;
        geo.computeVertexNormals();
        for (let e = 0; e < 4; e++) for (let k = 0; k < N; k++) wallPos[(e * N + k) * 6 + 1] = heights[edges[e](k)] * HS;
        walls.attributes.position.needsUpdate = true;
        walls.computeVertexNormals();
        const nrm = geo.attributes.normal;
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
          const i = y * N + x, ny = nrm.getY(i), d = heights[i] - fresh[i];
          c.copy(GRASS).lerp(DRY, smoothstep(0.35, 0.75, heights[i])).lerp(ROCK, smoothstep(0.86, 0.7, ny));
          c.lerp(CUT, clamp(-d * 9) * 0.85).lerp(SAND, clamp(d * 14) * 0.9);
          c.lerp(WATER, (WA[i] + (WB[i] - WA[i]) * w) * rain * 0.85);
          if (t > SWEEP0 && t < SWEEP1) c.lerp(SCAN, Math.exp(-(((x / (N - 1) - front) / 0.012) ** 2)) * 0.9);   // the scan line
          colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
        }
        geo.attributes.color.needsUpdate = true;

        // beads: each droplet track is replayed for RIDE seconds when the time-lapse reaches its moment
        tracks.forEach((tr, j) => {
          const at = RAIN0 + tr.stage * (RAIN1 - RAIN0 - RIDE), k = (t - at) / RIDE, n = tr.path.length / 2;
          if (k <= 0 || k >= 1) { beads.setMatrixAt(j, m.makeScale(0, 0, 0)); return; }
          const f = k * (n - 1), q = Math.min(n - 2, Math.floor(f)), u = f - q;
          const x = tr.path[q * 2] + (tr.path[q * 2 + 2] - tr.path[q * 2]) * u, y = tr.path[q * 2 + 1] + (tr.path[q * 2 + 3] - tr.path[q * 2 + 1]) * u;
          const ix = Math.min(N - 2, Math.floor(x)), iy = Math.min(N - 2, Math.floor(y)), fx = x - ix, fy = y - iy, i = iy * N + ix;
          const h = heights[i] * (1 - fx) * (1 - fy) + heights[i + 1] * fx * (1 - fy) + heights[i + N] * (1 - fx) * fy + heights[i + N + 1] * fx * fy;
          const sc = Math.sin(Math.PI * k) ** 0.5;
          world(x, y, h, v3); v3.y += 0.04;
          beads.setMatrixAt(j, m.makeScale(sc, sc, sc).setPosition(v3));
        });
        beads.instanceMatrix.needsUpdate = true;
      },
    };
  },
  overlay(ctx, time, W, H) {
    const t = (time + START) % 5;
    // the count follows the rain, and runs back to 0 with the scan line that restores the fresh terrain
    const drops = Math.round((t > SWEEP0 && t < SWEEP1 ? clamp(sweepFront(t)) : progress(t)) * DROPS), y = 1610, x0 = 120, x1 = 960;
    ctx.textAlign = 'left';
    ctx.font = `600 26px ${FONT.sans}`; ctx.fillStyle = 'rgba(40, 30, 24, 0.75)';
    ctx.fillText('RAIN DROPLETS SIMULATED', x0, y);
    ctx.font = `700 64px ${FONT.sans}`; ctx.fillStyle = '#2A211C';
    ctx.fillText(drops.toLocaleString('en-US'), x0, y + 72);
    ctx.textAlign = 'right'; ctx.font = `500 28px ${FONT.sans}`; ctx.fillStyle = 'rgba(40, 30, 24, 0.7)';
    ctx.fillText(`of ${DROPS.toLocaleString('en-US')}`, x1, y + 72);
    ctx.lineCap = 'round'; ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(40, 30, 24, 0.18)'; ctx.beginPath(); ctx.moveTo(x0, y + 110); ctx.lineTo(x1, y + 110); ctx.stroke();
    if (drops > 0) { ctx.strokeStyle = '#2F86C8'; ctx.beginPath(); ctx.moveTo(x0, y + 110); ctx.lineTo(x0 + (x1 - x0) * drops / DROPS, y + 110); ctx.stroke(); }
    // legend
    ctx.textAlign = 'left'; ctx.font = `500 25px ${FONT.sans}`;
    [['#8A4E36', 'carved'], ['#D9B77C', 'sediment'], ['#3FA7E0', 'water paths']].forEach(([col, name], k) => {
      const lx = x0 + k * 290, ly = y + 168;
      ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(lx, ly - 20, 26, 26, 6); ctx.fill();
      ctx.fillStyle = 'rgba(40, 30, 24, 0.8)'; ctx.fillText(name, lx + 40, ly + 1);
    });
  },
};
