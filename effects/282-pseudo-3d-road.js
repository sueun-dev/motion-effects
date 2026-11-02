// Pseudo-3D road (the 80s arcade racer trick): the road is a list of flat segments, each 200 units long. Every
// frame each segment boundary is projected with one division (scale = d / z), curves are faked by adding up a
// per-segment bend (dx += curve), hills by a height per segment, and the segments are painted far to near as
// trapezoids with alternating light and dark bands (rumble strips, grass, lane dashes every 3 segments), with
// roadside sprites scaled by the same factor. The track is 90 segments long and the car covers it once per loop
// at 0.1 of a band pair per frame, so the bands glide toward you instead of strobing; bands thinner than a few
// pixels fade to their average colour. Below, a side view shows equal segments landing on ever smaller screen steps.
import { TAU, FONT, phase, clamp, smoothstep, lerp } from '../lib/util.js';

const VX = 40, VY = 300, VW = 1000, VH = 880;              // the game screen
const SEG = 200, L = 90, RUMBLE = 3, ROADW = 2000;          // segment length, segments per lap, segments per band, road half-width
const CAMH = 1000, DEPTH = 1 / Math.tan(50 * Math.PI / 180), DRAW = 220, HZY = 0.42;   // camera height, d, draw distance, horizon
const curve = s => 4.2 * Math.sin(TAU * s / L) + 2.4 * Math.sin(2 * TAU * s / L + 0.7);   // bend per segment (s in segments)
const hill = s => 700 * Math.sin(2 * TAU * s / L + 1.9) + 250 * Math.sin(3 * TAU * s / L);    // road height
// the integral of the bend: how far the background has turned
const turned = s => -4.2 * L / TAU * Math.cos(TAU * s / L) - 2.4 * L / (2 * TAU) * Math.cos(2 * TAU * s / L + 0.7);

const C = {
  grass: ['#4FB848', '#46A640'], rumble: ['#F4F2EE', '#E2393F'], road: ['#7C7B84', '#76757E'], lane: '#FFFFFF',
  haze: [178, 214, 240],
};
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mixc = (a, b, k) => `rgb(${a.map((q, i) => Math.round(q + (b[i] - q) * k)).join(',')})`;

// roadside sprites: palms every 6 segments on alternating sides, chevron signs on the outside of the sharp bends
const SPRITES = [];
for (let i = 0; i < L; i += 6) SPRITES.push({ i, side: (i / 6) % 2 ? 1 : -1, kind: 'palm', off: 1.5 + 0.25 * ((i * 7) % 3) });
for (let i = 0; i < L; i += 2) {
  const c = curve(i + 0.5);
  if (Math.abs(c) > 4.4 && i % 6 === 0) SPRITES.push({ i, side: c > 0 ? -1 : 1, kind: 'sign', off: 1.25, dir: Math.sign(c) });
}

function palm(ctx, x, y, s, flip) {                          // s: px per world unit at this distance; flip: lean side
  const h = 2600 * s, w = 110 * s;
  ctx.fillStyle = '#8A5A34';
  for (let k = 0; k < 7; k++) {                              // a gently curving trunk in rings
    const a = k / 7, b = (k + 1) / 7, bend = 380 * s * flip;
    ctx.beginPath();
    ctx.moveTo(x - w * (1 - 0.4 * a) + bend * a * a, y - h * a);
    ctx.lineTo(x + w * (1 - 0.4 * a) + bend * a * a, y - h * a);
    ctx.lineTo(x + w * (1 - 0.4 * b) + bend * b * b, y - h * b + 2);
    ctx.lineTo(x - w * (1 - 0.4 * b) + bend * b * b, y - h * b + 2);
    ctx.fill();
  }
  const tx = x + 380 * s * flip, ty = y - h;
  for (let k = 0; k < 7; k++) {                              // fronds
    const a = -Math.PI * 0.95 + k * Math.PI * 0.95 / 3, len = 1100 * s * (k % 2 ? 0.85 : 1);
    const ex = tx + Math.cos(a) * len, ey = ty + Math.sin(a) * len * 0.55 + len * 0.35;
    ctx.fillStyle = k % 2 ? '#2E8B3E' : '#3CA34A';
    ctx.beginPath(); ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo((tx + ex) / 2 - Math.sin(a) * len * 0.18, (ty + ey) / 2 - len * 0.32, ex, ey);
    ctx.quadraticCurveTo((tx + ex) / 2 + Math.sin(a) * len * 0.05, (ty + ey) / 2 - len * 0.12, tx, ty);
    ctx.fill();
  }
  ctx.fillStyle = '#6B4226'; ctx.beginPath(); ctx.arc(tx, ty + 60 * s, 120 * s, 0, TAU); ctx.fill();
}
function sign(ctx, x, y, s, dir) {
  const w = 900 * s, h = 700 * s, top = y - 1500 * s;
  ctx.fillStyle = '#3A3A44'; ctx.fillRect(x - 50 * s, top + h * 0.9, 100 * s, y - top - h * 0.9);
  ctx.fillStyle = '#FFD23F'; ctx.fillRect(x - w / 2, top, w, h);
  ctx.fillStyle = '#1E1E28';
  for (let k = 0; k < 2; k++) {                              // two chevrons pointing into the bend
    const cx = x + dir * (k - 0.5) * w * 0.32, cy = top + h / 2, a = w * 0.16 * dir;
    ctx.beginPath(); ctx.moveTo(cx - a, cy - h * 0.32); ctx.lineTo(cx + a, cy); ctx.lineTo(cx - a, cy + h * 0.32);
    ctx.lineTo(cx - a + w * 0.09 * dir, cy + h * 0.32); ctx.lineTo(cx + a + w * 0.09 * dir, cy); ctx.lineTo(cx - a + w * 0.09 * dir, cy - h * 0.32); ctx.fill();
  }
}

export default {
  name: 'Pseudo-3D Road',
  ko: '유사 3D 도로',
  draw(ctx, t, W, H) {
    ctx.fillStyle = '#0D1020'; ctx.fillRect(0, 0, W, H);
    const pos = L * SEG * phase(t), s0 = pos / SEG;           // camera position along the track (units, segments)
    const camY = hill(s0) + CAMH;
    const cx = VX + VW / 2, cy = VY + VH * HZY;

    ctx.save();
    ctx.beginPath(); ctx.roundRect(VX, VY, VW, VH, 28); ctx.clip();
    // sky, clouds and two ranges of hills that slide sideways as the road bends
    const sky = ctx.createLinearGradient(0, VY, 0, cy + 40);
    sky.addColorStop(0, '#3F86E8'); sky.addColorStop(0.75, '#8CC6F5'); sky.addColorStop(1, '#D8EEFA');
    ctx.fillStyle = sky; ctx.fillRect(VX, VY, VW, VH);
    const bg = turned(s0);
    const wrap = (x, p) => ((x % p) + p) % p;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    for (let k = 0; k < 5; k++) {
      const x = VX - 200 + wrap(k * 330 - bg * 1.5, 1650), y = VY + 70 + 46 * ((k * 3) % 4);
      ctx.beginPath(); ctx.ellipse(x, y, 110, 30, 0, 0, TAU); ctx.ellipse(x + 70, y - 22, 70, 32, 0, 0, TAU); ctx.ellipse(x - 60, y - 12, 56, 26, 0, 0, TAU); ctx.fill();
    }
    const range = (k, amp, base, col, f) => {
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(VX, cy + 2);
      for (let x = VX; x <= VX + VW; x += 6) {
        const u = (x - VX + bg * k) * f;
        ctx.lineTo(x, cy - base - amp * (0.55 + 0.3 * Math.sin(u) + 0.15 * Math.sin(u * 2.7 + 1) + 0.08 * Math.sin(u * 6.1)));
      }
      ctx.lineTo(VX + VW, cy + 2); ctx.fill();
    };
    range(2.2, 150, 10, '#9AA9D6', 0.006);
    range(3.6, 70, 0, '#5E9E6A', 0.011);

    // project every segment boundary ahead: x shifts by the accumulated bend, y follows the hills
    const base = Math.floor(s0), frac = s0 - base;
    let x = 0, dx = -curve(base + 0.5) * frac;
    const pts = [];
    for (let n = 0; n <= DRAW; n++) {
      const si = base + n, z = si * SEG - pos;
      if (n > 0) { x += dx; dx += curve(si - 0.5); }
      const zz = Math.max(z, 60), sc = DEPTH / zz;
      pts.push({ si, z: zz, sc, X: cx + sc * (-x) * VW / 2, Y: cy - sc * (hill(si) - camY) * VH / 2, Wd: sc * ROADW * VW / 2 });
    }
    // far to near: each segment is a grass band, two rumble strips, the road and (on light bands) the lane dashes
    for (let n = DRAW - 1; n >= 0; n--) {
      const a = pts[n], b = pts[n + 1];
      if (b.Y >= a.Y) continue;                                   // seen from behind (beyond a crest): hidden anyway
      const band = Math.floor(((a.si % L) + L) % L / RUMBLE) % 2;
      const k = smoothstep(2, 6, (a.Y - b.Y) * RUMBLE);           // thin bands fade to the average colour
      const fog = 1 - Math.exp(-b.z / 26000);
      const col = (pair, i) => { const c = rgb(pair[i]), o = rgb(pair[1 - i]), avg = c.map((q, j) => (q + o[j]) / 2); return mixc(avg.map((q, j) => lerp(q, c[j], k)), C.haze, fog); };
      const y1 = a.Y + 1;                                         // overlap the next band by a pixel: no seams
      ctx.fillStyle = col(C.grass, band); ctx.fillRect(VX, b.Y, VW, y1 - b.Y);
      const quad = (w1, w2, o1, o2) => {
        ctx.beginPath();
        ctx.moveTo(a.X + o1 * a.Wd - w1 * a.Wd, y1); ctx.lineTo(a.X + o1 * a.Wd + w1 * a.Wd, y1);
        ctx.lineTo(b.X + o2 * b.Wd + w2 * b.Wd, b.Y); ctx.lineTo(b.X + o2 * b.Wd - w2 * b.Wd, b.Y); ctx.fill();
      };
      ctx.fillStyle = col(C.rumble, band); quad(1.16, 1.16, 0, 0);
      ctx.fillStyle = col(C.road, band); quad(1, 1, 0, 0);
      if (band === 0) {
        const kk = smoothstep(3, 8, (a.Y - b.Y) * RUMBLE);
        ctx.fillStyle = mixc(rgb(C.road[0]).map((q, j) => lerp(q, 255, 0.85 * kk)), C.haze, fog);
        quad(0.03, 0.03, -1 / 3, -1 / 3); quad(0.03, 0.03, 1 / 3, 1 / 3);
      }
      for (const sp of SPRITES) {                                 // roadside sprites standing on this segment
        if ((((a.si % L) + L) % L) !== sp.i || n > 130) continue;
        const sx = a.X + sp.side * sp.off * a.Wd, sc = a.sc * VW / 2;
        ctx.globalAlpha = (1 - fog * 0.8) * smoothstep(130, 100, n);   // far sprites fade in instead of popping
        if (sp.kind === 'palm') palm(ctx, sx, a.Y, sc, -sp.side); else sign(ctx, sx, a.Y, sc, sp.dir);
        ctx.globalAlpha = 1;
      }
    }
    // the car, seen from behind
    const bob = 2 * Math.sin(phase(t) * TAU * 10), lean = 0.35 * curve(s0 + 3);
    const carX = cx + lean * 6, carY = VY + VH - 70 + bob;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'; ctx.beginPath(); ctx.ellipse(carX, carY + 34, 230, 26, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1C1C24'; ctx.beginPath(); ctx.roundRect(carX - 215, carY - 30, 82, 72, 14); ctx.roundRect(carX + 133, carY - 30, 82, 72, 14); ctx.fill();
    ctx.fillStyle = '#D92B3A'; ctx.beginPath();
    ctx.moveTo(carX - 205, carY + 10); ctx.lineTo(carX - 190, carY - 60); ctx.lineTo(carX - 120, carY - 90); ctx.lineTo(carX + 120, carY - 90);
    ctx.lineTo(carX + 190, carY - 60); ctx.lineTo(carX + 205, carY + 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#A51E2C'; ctx.fillRect(carX - 200, carY - 8, 400, 26);
    ctx.fillStyle = '#FFE36A'; ctx.beginPath(); ctx.roundRect(carX - 182, carY - 52, 74, 22, 6); ctx.roundRect(carX + 108, carY - 52, 74, 22, 6); ctx.fill();
    ctx.fillStyle = '#F2F2F2'; ctx.beginPath(); ctx.roundRect(carX - 60, carY - 50, 120, 22, 4); ctx.fill();
    ctx.fillStyle = '#2B2B36'; ctx.beginPath(); ctx.roundRect(carX - 110, carY - 130, 220, 46, 18); ctx.fill();     // windscreen
    ctx.fillStyle = '#F6C08A'; ctx.beginPath(); ctx.arc(carX - 50, carY - 140, 26, 0, TAU); ctx.fill();          // driver
    ctx.fillStyle = '#5B3A22'; ctx.beginPath(); ctx.arc(carX - 50, carY - 148, 26, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = '#FFD23F'; ctx.beginPath(); ctx.arc(carX + 52, carY - 140, 25, 0, TAU); ctx.fill();          // passenger
    ctx.restore();

    // the side view: equal 200-unit segments, projected through one screen plane, land on ever smaller steps
    const DX = 40, DY = 1222, DW = 1000, DH = 640;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'; ctx.beginPath(); ctx.roundRect(DX, DY, DW, DH, 26); ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)'; ctx.font = `700 25px ${FONT.sans}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('SIDE VIEW · ONE DIVISION PER SEGMENT:  y = d · (y_road − y_cam) / z', DX + 30, DY + 50);
    const ex = DX + 110, ey = DY + 250, S = 0.142, px = ex + 220, ZMAX = 6000;   // eye, px per unit, screen plane
    const Zw = z => ex + z * S, Yw = si => ey + (camY - hill(si)) * S;
    ctx.save();
    ctx.beginPath(); ctx.rect(DX + 10, DY + 70, DW - 20, DH - 80); ctx.clip();
    for (let n = 0; n < 34; n++) {                                  // the road, segment by segment, in its bands
      const si = base + n, z1 = si * SEG - pos, z2 = z1 + SEG;
      if (z2 < 0 || z1 > ZMAX) continue;
      const band = Math.floor(((si % L) + L) % L / RUMBLE) % 2;
      ctx.strokeStyle = band ? '#E2393F' : '#F4F2EE'; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(Zw(Math.max(z1, 0)), Yw(si + Math.max(0, -z1) / SEG)); ctx.lineTo(Zw(z2), Yw(si + 1)); ctx.stroke();
    }
    const cuts = [];                                                // band edges: ray from the eye, crossing on the screen plane
    for (let n = 0; n < 34; n++) {
      const si = base + n, z = si * SEG - pos;
      if ((((si % L) + L) % L) % RUMBLE !== 0 || z < 250 || z > ZMAX) continue;
      const tx = Zw(z), ty = Yw(si);
      cuts.push({ y: ey + (ty - ey) * (px - ex) / (tx - ex), band: Math.floor(((si % L) + L) % L / RUMBLE) % 2 });
      ctx.strokeStyle = 'rgba(255, 216, 77, 0.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.fillStyle = '#FFD84D'; ctx.beginPath(); ctx.arc(tx, ty, 6, 0, TAU); ctx.fill();
    }
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.rect(px - 13, DY + 100, 26, DH - 180); ctx.clip();
    for (let k = 0; k < cuts.length; k++) {                          // what the screen shows: the same bands, squeezed
      const y0 = cuts[k].y, y1 = k ? cuts[k - 1].y : DY + DH;
      ctx.fillStyle = cuts[k].band ? '#F4F2EE' : '#E2393F';          // the band nearer than this edge
      ctx.fillRect(px - 13, y0, 26, y1 - y0);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'; ctx.lineWidth = 3;
    ctx.strokeRect(px - 13, DY + 100, 26, DH - 180);
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(ex, ey, 12, 0, TAU); ctx.fill();
    ctx.font = `600 23px ${FONT.sans}`; ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'; ctx.textAlign = 'center';
    ctx.fillText('eye', ex, ey - 26);
    ctx.fillText('screen', px, DY + DH - 44);
    ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText('equal bands on the road → shrinking bands on screen', DX + DW - 30, DY + 90);
  },
};
