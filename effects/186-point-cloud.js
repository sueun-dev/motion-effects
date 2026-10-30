// Point cloud: a spinning LiDAR on a car roof, simulated once in setup: 96 laser channels x 3000 azimuth steps are
// ray-cast against a little street (road, kerbs, buildings, trees, parked cars, lamp posts, people), and every hit
// becomes a point coloured by height. Points behind obstacles stay empty (scan shadows), the road shows the rings
// of the channels. The sensor turns twice per loop; each point flares white when the beam passes and then dims.
import * as THREE from 'three';
import { TAU, phase, rng } from '../lib/util.js';

const CH = 96, AZ = 3000, SENSOR = new THREE.Vector3(0, 2.0, 0), RANGE = 70;

// the street, as simple solids: boxes [x0, y0, z0, x1, y1, z1], spheres [x, y, z, r], upright cylinders [x, z, r, y0, y1]
function street() {
  const r = rng(186), boxes = [], spheres = [], cyl = [];
  for (const s of [-1, 1]) {
    boxes.push(s < 0 ? [-7.2, 0, -80, -4.2, 0.18, 40] : [4.2, 0, -80, 7.2, 0.18, 40]); // kerbs / pavements
    for (let z = -78; z < 36;) { // buildings with gaps between them
      const d = 6 + r() * 9, h = 5 + r() * 13, x0 = 7.6 + r() * 1.5;
      boxes.push(s < 0 ? [-x0 - 7, 0, z, -x0, h, z + d] : [x0, 0, z, x0 + 7, h, z + d]);
      if (r() < 0.5) boxes.push(s < 0 ? [-x0 - 6, h, z + 1, -x0 - 1, h + 1.2 + r() * 2, z + d - 1] : [x0 + 1, h, z + 1, x0 + 6, h + 1.2 + r() * 2, z + d - 1]);
      z += d + 1.5 + r() * 4;
    }
    for (let z = -70; z < 34; z += 9 + r() * 3) { // trees: trunk + crown
      const x = s * 5.6, h = 3.4 + r() * 1.2;
      cyl.push([x, z, 0.18, 0, h]);
      spheres.push([x, h + 0.9, z, 1.3 + r() * 0.4]);
    }
    for (let z = -64; z < 30; z += 17 + r() * 5) cyl.push([s * 4.6, z + 4, 0.09, 0, 5.5]); // lamp posts
    for (let z = -58; z < 28; z += 9 + r() * 10) { // parked cars: body + cabin
      const x = s * 3.0;
      boxes.push([x - 0.9, 0.3, z, x + 0.9, 1.0, z + 4.2], [x - 0.8, 1.0, z + 1.0, x + 0.8, 1.55, z + 3.2]);
    }
  }
  for (const [x, z] of [[-5.0, -8], [5.3, -15], [-4.8, -26], [1.2, -20], [5.0, 6]]) { // people
    cyl.push([x, z, 0.24, 0, 1.45]); spheres.push([x, 1.62, z, 0.2]);
  }
  boxes.push([-1.0, 0.3, 9, 1.0, 1.1, 13.4], [-0.9, 1.1, 10, 0.9, 1.65, 12.4]); // a car behind us
  boxes.push([-1.3, 0.3, -24, 1.3, 2.9, -16]); // a van ahead
  return { boxes, spheres, cyl };
}

// nearest hit of the ray o + t d (t > tmin) with the street, or Infinity
function cast(o, d, sc, tmin) {
  let best = Infinity;
  if (d.y < 0) best = -o.y / d.y; // the road
  const ix = 1 / d.x, iy = 1 / d.y, iz = 1 / d.z; // slab test per box
  for (const [x0, y0, z0, x1, y1, z1] of sc.boxes) {
    const ax = (x0 - o.x) * ix, bx = (x1 - o.x) * ix, ay = (y0 - o.y) * iy, by = (y1 - o.y) * iy, az = (z0 - o.z) * iz, bz = (z1 - o.z) * iz;
    const lo = Math.max(Math.min(ax, bx), Math.min(ay, by), Math.min(az, bz), tmin);
    const hi = Math.min(Math.max(ax, bx), Math.max(ay, by), Math.max(az, bz));
    if (lo <= hi && lo < best) best = lo;
  }
  for (const [x, y, z, r] of sc.spheres) {
    const ox = o.x - x, oy = o.y - y, oz = o.z - z, bb = ox * d.x + oy * d.y + oz * d.z, c = ox * ox + oy * oy + oz * oz - r * r, h = bb * bb - c;
    if (h > 0) { const t = -bb - Math.sqrt(h); if (t > tmin && t < best) best = t; }
  }
  for (const [x, z, r, y0, y1] of sc.cyl) {
    const ox = o.x - x, oz = o.z - z, a = d.x * d.x + d.z * d.z, bb = ox * d.x + oz * d.z, c = ox * ox + oz * oz - r * r, h = bb * bb - a * c;
    if (a > 1e-9 && h > 0) {
      const t = (-bb - Math.sqrt(h)) / a, y = o.y + t * d.y;
      if (t > tmin && t < best && y > y0 && y < y1) best = t;
    }
  }
  return best;
}

// height colour map: road blue -> green -> yellow -> orange -> magenta on the roofs
const STOPS = [[0, '#2246FF'], [0.25, '#14C7FF'], [1.5, '#1EE68C'], [4, '#D8F23A'], [8, '#FFA62B'], [13, '#FF4A6E'], [19, '#D25BFF']];
function heightColor(y, out) {
  let k = 0;
  while (k < STOPS.length - 2 && y > STOPS[k + 1][0]) k++;
  const [y0, c0] = STOPS[k], [y1, c1] = STOPS[k + 1];
  return out.set(c0).lerp(new THREE.Color(c1), Math.min(1, Math.max(0, (y - y0) / (y1 - y0))));
}

export default {
  name: 'Point Cloud',
  ko: '포인트 클라우드',
  three(renderer, W, H) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#04060B');
    const camera = new THREE.PerspectiveCamera(62, W / H, 0.1, 300);

    // the scan: every channel at every azimuth step
    const sc = street(), pos = [], col = [], az = [], c = new THREE.Color(), d = new THREE.Vector3();
    for (let i = 0; i < AZ; i++) {
      const a = (i / AZ) * TAU;
      for (let k = 0; k < CH; k++) {
        const el = THREE.MathUtils.degToRad(-25 + 45 * (k / (CH - 1)) ** 1.25); // -25 .. +20 degrees, denser low down
        d.set(Math.cos(el) * Math.sin(a), Math.sin(el), -Math.cos(el) * Math.cos(a));
        const t = cast(SENSOR, d, sc, 1.6);
        if (t > RANGE) continue;
        const p = SENSOR.clone().addScaledVector(d, t);
        pos.push(p.x, p.y, p.z);
        heightColor(p.y, c).toArray(col, col.length);
        az.push(a);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('az', new THREE.Float32BufferAttribute(az, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScan: { value: 0 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float az; uniform float uScan; varying vec3 vC;
        void main() {
          float age = fract((uScan - az) / 6.2831853);          // 0 = the beam just passed, 1 = a turn ago
          float glow = 0.3 + 0.7 * exp(-age * 2.2), flash = exp(-age * 40.0);
          vC = mix(color * glow, vec3(1.0), flash * 0.75) * (0.7 + 0.3 * flash);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(190.0 / -mv.z, 2.3, 4.5);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `varying vec3 vC;
        void main() { float r = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vC * smoothstep(0.5, 0.15, r), 1.0); }`,
    });
    mat.vertexColors = true;
    scene.add(new THREE.Points(geo, mat));

    // our car (a see-through outline) and the sensor on its roof
    const car = new THREE.Group(), edge = new THREE.LineBasicMaterial({ color: '#9FE8FF', transparent: true, opacity: 0.8 });
    for (const [w, h, l, y, z] of [[1.9, 0.75, 4.4, 0.7, 0], [1.7, 0.6, 2.4, 1.35, 0.2]]) {
      const box = new THREE.BoxGeometry(w, h, l).translate(0, y, z);
      car.add(new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: '#4FA8FF', transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false })));
      car.add(new THREE.LineSegments(new THREE.EdgesGeometry(box), edge));
    }
    const puck = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.4, 32), new THREE.MeshBasicMaterial({ color: '#BFFBFF' }));
    puck.position.copy(SENSOR).y -= 0.15;
    car.add(puck);
    scene.add(car);
    // the beam: a faint fan on the road along the current azimuth
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 60).translate(0, 30, 0), new THREE.MeshBasicMaterial({ color: '#7FF6FF', transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }));
    beam.rotation.x = -Math.PI / 2;
    beam.position.y = 0.05;
    const beamPivot = new THREE.Group();
    beamPivot.add(beam);
    scene.add(beamPivot);

    return {
      scene, camera,
      update(t) {
        const a = phase(t) * TAU, scan = 2 * a; // two turns per loop
        mat.uniforms.uScan.value = scan;
        beamPivot.rotation.y = -scan;
        camera.position.set(-1.2, 12, 17);
        camera.lookAt(0, -1.5, -30);
      },
    };
  },
};
