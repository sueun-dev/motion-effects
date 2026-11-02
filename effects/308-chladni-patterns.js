// Chladni patterns: sand on a square steel plate that is driven at one resonance after another. Each mode of the free
// plate is approximated by f = cos(nπx)cos(mπy) ± cos(mπx)cos(nπy); where f is large the plate shakes hard, along
// f = 0 (the nodal lines) it stands still, so the sand is thrown off the loud parts and comes to rest on the lines.
// Every grain's path is worked out once in setup: from where it lies, Newton steps along ∇f to the nearest zero of
// the new mode (plus a small fixed offset across the line, so the lines have width). Grains on loud spots leave
// first; a moving grain lifts a little (bigger, longer shadow) and lands; a grain at rest is drawn at exactly the
// same spot every frame. The resting places on each mode's lines are fixed, and a grain takes the nearest free place
// of its colour to where it would land, so after four modes and back to the first every place holds a grain of the
// same colour again and frame 150 meets frame 0.
import { TAU, rng, clamp, span, ease, canvas, FONT } from '../lib/util.js';

const MODES = [[2, 4, -1], [3, 5, 1], [3, 6, -1], [3, 7, -1]];   // n, m, sign
const HZ = MODES.map(([n, m]) => 23 * (n * n + m * m));          // 460, 782, 1035, 1334 Hz
const GRAINS = 7000, P = 24;                                        // grains, points kept per path
const SLOT = 1.25, MOVE = 0.82, START = 0.67;                       // seconds per mode, of which the move; video offset
const PS = 880, X0 = 100, Y0 = 470;                                 // plate size and corner on screen (px)
let paths, timing, tint, plate, shade;

const f = ([n, m, s], x, y) => Math.cos(n * Math.PI * x) * Math.cos(m * Math.PI * y) + s * Math.cos(m * Math.PI * x) * Math.cos(n * Math.PI * y);
function grad([n, m, s], x, y) {
  const a = Math.PI;
  return [
    -n * a * Math.sin(n * a * x) * Math.cos(m * a * y) - s * m * a * Math.sin(m * a * x) * Math.cos(n * a * y),
    -m * a * Math.cos(n * a * x) * Math.sin(m * a * y) - s * n * a * Math.cos(m * a * x) * Math.sin(n * a * y),
  ];
}

// Newton steps along the gradient from (x, y) to the nearest zero of mode M, then `off` across the line:
// returns the path as P points [x0, y0, x1, y1, ...] spaced evenly along its length
function settle(M, x, y, off, kick) {
  const pts = [x, y];
  for (let it = 0; it < 400; it++) {
    const v = f(M, x, y);
    if (Math.abs(v) < 1e-5) break;
    let [gx, gy] = grad(M, x, y), g2 = gx * gx + gy * gy;
    if (g2 < 1e-6) { gx = kick[0]; gy = kick[1]; g2 = 1; }            // on a crest: roll off in a fixed direction
    let dx = (-v * gx) / g2, dy = (-v * gy) / g2;
    const d = Math.hypot(dx, dy), MAX = 0.004;
    if (d > MAX) { dx *= MAX / d; dy *= MAX / d; }
    x = clamp(x + dx, 0.012, 0.988); y = clamp(y + dy, 0.012, 0.988);
    pts.push(x, y);
  }
  const [gx, gy] = grad(M, x, y), g = Math.hypot(gx, gy) || 1;
  pts.push(clamp(x + (off * gx) / g, 0.012, 0.988), clamp(y + (off * gy) / g, 0.012, 0.988));
  return resample(pts);
}
function resample(pts) {
  const n = pts.length / 2, acc = [0];
  for (let i = 1; i < n; i++) acc.push(acc[i - 1] + Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]));
  const out = new Float32Array(P * 2), L = acc[n - 1];
  for (let k = 0, j = 0; k < P; k++) {
    const s = (L * k) / (P - 1);
    while (j < n - 2 && acc[j + 1] < s) j++;
    const u = acc[j + 1] > acc[j] ? clamp((s - acc[j]) / (acc[j + 1] - acc[j])) : 0;
    out[k * 2] = pts[j * 2] + (pts[j * 2 + 2] - pts[j * 2]) * u;
    out[k * 2 + 1] = pts[j * 2 + 1] + (pts[j * 2 + 3] - pts[j * 2 + 1]) * u;
    if (n === 1) { out[k * 2] = pts[0]; out[k * 2 + 1] = pts[1]; }
  }
  return out;
}

// give every grain a free place of its own colour near where it lands: greedy nearest on a grid, then swaps between
// neighbours wherever that shortens the two moves
function assign(land, to) {
  const CELL = 0.025, G = Math.ceil(1 / CELL), key = (x, y) => clamp(Math.floor(y / CELL), 0, G - 1) * G + clamp(Math.floor(x / CELL), 0, G - 1);
  const at = new Int32Array(GRAINS);
  for (let c = 0; c < 4; c++) {
    const free = Array.from({ length: G * G }, () => []);
    for (let s = c; s < GRAINS; s += 4) free[key(to[s * 2], to[s * 2 + 1])].push(s);
    for (let i = c; i < GRAINS; i += 4) {
      const [x, y] = land(i), cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
      let best = -1, bd = Infinity;
      for (let ring = 0; ring < G && !(best >= 0 && Math.sqrt(bd) < (ring - 1) * CELL); ring++) {
        for (let gy = cy - ring; gy <= cy + ring; gy++) for (let gx = cx - ring; gx <= cx + ring; gx++) {
          if (Math.max(Math.abs(gx - cx), Math.abs(gy - cy)) !== ring || gx < 0 || gy < 0 || gx >= G || gy >= G) continue;
          for (const s of free[gy * G + gx]) {
            const d = (to[s * 2] - x) ** 2 + (to[s * 2 + 1] - y) ** 2;
            if (d < bd) { bd = d; best = s; }
          }
        }
      }
      at[i] = best;
      const cell = free[key(to[best * 2], to[best * 2 + 1])];
      cell.splice(cell.indexOf(best), 1);
    }
    const near = Array.from({ length: G * G }, () => []);
    for (let i = c; i < GRAINS; i += 4) near[key(...land(i))].push(i);
    const cost = (i, s) => { const [x, y] = land(i); return (to[s * 2] - x) ** 2 + (to[s * 2 + 1] - y) ** 2; };
    for (let pass = 0; pass < 12; pass++) for (let i = c; i < GRAINS; i += 4) {
      const [x, y] = land(i), cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
      for (let gy = cy - 3; gy <= cy + 3; gy++) for (let gx = cx - 3; gx <= cx + 3; gx++) {
        if (gx < 0 || gy < 0 || gx >= G || gy >= G) continue;
        for (const j of near[gy * G + gx]) {
          if (cost(i, at[j]) + cost(j, at[i]) < cost(i, at[i]) + cost(j, at[j]) - 1e-12) { const s = at[i]; at[i] = at[j]; at[j] = s; }
        }
      }
    }
  }
  return at;
}

function simulate() {
  const r = rng(308), off = new Float32Array(GRAINS), kick = [];
  for (let i = 0; i < GRAINS; i++) {
    off[i] = ((r() + r() + r()) / 3 - 0.5) * 0.016;                 // up to ±7 px across the line
    const a = r() * TAU; kick.push([Math.cos(a), Math.sin(a)]);
  }
  // the resting places on each mode's lines: evenly scattered points Newton-stepped onto the lines.
  // Place s holds a grain of colour s % 4, and grain i always has colour i % 4.
  const places = MODES.map(M => {
    const pl = new Float32Array(GRAINS * 2);
    for (let s = 0; s < GRAINS; s++) {
      const p = settle(M, 0.02 + 0.96 * r(), 0.02 + 0.96 * r(), off[s], kick[s]);
      pl[s * 2] = p[P * 2 - 2]; pl[s * 2 + 1] = p[P * 2 - 1];
    }
    return pl;
  });
  let at = Int32Array.from({ length: GRAINS }, (_, i) => i);       // the place each grain lies at in the current mode
  paths = [];
  for (let k = 0; k < 4; k++) {
    const from = places[k], to = places[(k + 1) % 4], M = MODES[(k + 1) % 4];
    // where each grain would land by itself, then the nearest free place of its colour to that landing
    const nat = [...Array(GRAINS)].map((_, i) => settle(M, from[at[i] * 2], from[at[i] * 2 + 1], off[i], kick[i]));
    const land = i => [nat[i][P * 2 - 2], nat[i][P * 2 - 1]];
    at = assign(land, to);
    // the natural path, bent a little so it ends on the chosen place
    paths.push(nat.map((p, i) => {
      const [lx, ly] = land(i), ex = to[at[i] * 2] - lx, ey = to[at[i] * 2 + 1] - ly;
      for (let j = 0; j < P; j++) { p[j * 2] += (ex * j) / (P - 1); p[j * 2 + 1] += (ey * j) / (P - 1); }
      return p;
    }));
  }
  // after the fourth move each colour fills the same places it filled at the start, so the picture is the same
  // when each grain sets off (loud spots first) and how long it takes (longer paths take longer)
  timing = paths.map((ps, k) => {
    const M = MODES[(k + 1) % 4], tm = new Float32Array(GRAINS * 2);
    ps.forEach((p, i) => {
      let len = 0;
      for (let j = 1; j < P; j++) len += Math.hypot(p[j * 2] - p[j * 2 - 2], p[j * 2 + 1] - p[j * 2 - 1]);
      const loud = clamp(Math.abs(f(M, p[0], p[1])) / 1.6), dur = clamp(0.3 + len * 3.2, 0.3, 0.62);
      tm[i * 2] = 0.06 + (1 - loud) * (MOVE - 0.06 - dur); tm[i * 2 + 1] = dur;
    });
    return tm;
  });
}

// the plate's shake for each mode as a soft warm tint (|f|), 200 x 200, drawn scaled up
function tintOf(M) {
  const S = 200, c = canvas(S, S), g = c.getContext('2d'), img = g.createImageData(S, S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const a = clamp(Math.abs(f(M, (i + 0.5) / S, (j + 0.5) / S)) / 2) ** 1.3, p = (j * S + i) * 4;
    img.data[p] = 255; img.data[p + 1] = 120 + 60 * a; img.data[p + 2] = 60; img.data[p + 3] = 150 * a;
  }
  g.putImageData(img, 0, 0);
  return c;
}

export default {
  name: 'Chladni Patterns',
  ko: '클라드니 도형',
  setup() {
    simulate();
    tint = MODES.map(tintOf);
    // the steel plate: a cool gradient with fine brushed streaks (fixed), a bevel and the bolt at the centre
    plate = canvas(PS, PS);
    const g = plate.getContext('2d'), r = rng(7);
    const base = g.createLinearGradient(0, 0, PS, PS);
    base.addColorStop(0, '#5B6576'); base.addColorStop(0.5, '#3E4656'); base.addColorStop(1, '#2C3240');
    g.fillStyle = base; g.fillRect(0, 0, PS, PS);
    for (let k = 0; k < 900; k++) {
      const y = r() * PS, x = r() * PS, w = 80 + r() * 300;
      g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'}, ${0.02 + r() * 0.035})`;
      g.fillRect(x, y, w, 1 + r() * 1.5);
    }
    g.strokeStyle = 'rgba(255, 255, 255, 0.28)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, PS - 3, PS - 3);
    shade = canvas(PS, PS);
    const s = shade.getContext('2d'), v = s.createRadialGradient(PS / 2, PS / 2, PS * 0.2, PS / 2, PS / 2, PS * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.35)');
    s.fillStyle = v; s.fillRect(0, 0, PS, PS);
  },
  draw(ctx, time, W, H) {
    const t = (time + START) % 5;                                   // the video starts mid-move, so the loop seam is in motion
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#15171F'); bg.addColorStop(0.5, '#1C1F2A'); bg.addColorStop(1, '#101219');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    const slot = Math.floor(t / SLOT) % 4, u = t - slot * SLOT;    // move from mode `slot` to the next during 0 .. MOVE
    const sw = ease.inOut(span(u, 0, 0.3));                         // the driver switches frequency in the first 0.3 s
    const from = slot, to = (slot + 1) % 4;

    // the plate, its shadow, and the shake of the current mode
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.filter = 'blur(18px)'; ctx.fillRect(X0 + 10, Y0 + 26, PS, PS); ctx.filter = 'none';
    ctx.drawImage(plate, X0, Y0);
    ctx.globalAlpha = 0.55 * (1 - sw); ctx.drawImage(tint[from], X0, Y0, PS, PS);
    ctx.globalAlpha = 0.55 * sw; ctx.drawImage(tint[to], X0, Y0, PS, PS);
    ctx.globalAlpha = 1;
    ctx.drawImage(shade, X0, Y0);
    const bolt = ctx.createRadialGradient(X0 + PS / 2 - 6, Y0 + PS / 2 - 6, 2, X0 + PS / 2, Y0 + PS / 2, 22);
    bolt.addColorStop(0, '#E6EAF2'); bolt.addColorStop(1, '#5A6274');
    ctx.fillStyle = bolt; ctx.beginPath(); ctx.arc(X0 + PS / 2, Y0 + PS / 2, 20, 0, TAU); ctx.fill();

    // the sand: grains at rest sit exactly at the end of their path; moving ones follow it and lift a little
    const ps = paths[slot], tm = timing[slot], SAND = ['#F1D9A6', '#E5C68C', '#F7E6C0', '#D9B57A'];
    const xs = new Float32Array(GRAINS), ys = new Float32Array(GRAINS), lift = new Float32Array(GRAINS);
    for (let i = 0; i < GRAINS; i++) {
      const p = ps[i], k = clamp((u - tm[i * 2]) / tm[i * 2 + 1]);
      if (k <= 0) { xs[i] = p[0]; ys[i] = p[1]; continue; }
      if (k >= 1) { xs[i] = p[P * 2 - 2]; ys[i] = p[P * 2 - 1]; continue; }
      const e = ease.inOut(k) * (P - 1), j = Math.min(P - 2, Math.floor(e)), w = e - j;
      xs[i] = p[j * 2] + (p[j * 2 + 2] - p[j * 2]) * w; ys[i] = p[j * 2 + 1] + (p[j * 2 + 3] - p[j * 2 + 1]) * w;
      lift[i] = Math.sin(Math.PI * k);
    }
    ctx.fillStyle = 'rgba(10, 12, 18, 0.55)';
    ctx.beginPath();
    for (let i = 0; i < GRAINS; i++) {
      const x = X0 + xs[i] * PS + 1.3 + lift[i] * 4, y = Y0 + ys[i] * PS + 1.8 + lift[i] * 6;
      ctx.moveTo(x + 2.4, y); ctx.arc(x, y, 2.4, 0, TAU);
    }
    ctx.fill();
    for (let c = 0; c < 4; c++) {
      ctx.fillStyle = SAND[c];
      ctx.beginPath();
      for (let i = c; i < GRAINS; i += 4) {
        const x = X0 + xs[i] * PS, y = Y0 + ys[i] * PS, rr = 2.3 * (1 + 0.35 * lift[i]);
        ctx.moveTo(x + rr, y); ctx.arc(x, y, rr, 0, TAU);
      }
      ctx.fill();
    }

    // read-out: the drive frequency, a scale with the four resonances, and the mode
    const hz = HZ[from] + (HZ[to] - HZ[from]) * sw;
    const ry = 1440;
    ctx.textAlign = 'left';
    ctx.font = `600 26px ${FONT.sans}`; ctx.fillStyle = 'rgba(220, 226, 240, 0.6)';
    ctx.fillText('DRIVE FREQUENCY', X0, ry);
    ctx.font = `700 92px ${FONT.sans}`; ctx.fillStyle = '#FFFFFF';
    const num = Math.round(hz).toLocaleString('en-US'), nw = ctx.measureText(num).width;
    ctx.fillText(num, X0, ry + 96);
    ctx.font = `500 44px ${FONT.sans}`; ctx.fillStyle = '#F1D9A6';
    ctx.fillText('Hz', X0 + nw + 18, ry + 96);
    // the mode name: the old one fades out, then the new one fades in (never both at once)
    const out = 1 - span(u, 0, 0.15), inn = span(u, 0.2, 0.4);
    const mode = (k, a) => {
      const [n, m] = MODES[k];
      ctx.globalAlpha = a; ctx.textAlign = 'right';
      ctx.font = `600 26px ${FONT.sans}`; ctx.fillStyle = 'rgba(220, 226, 240, 0.6)'; ctx.fillText('MODE', X0 + PS, ry);
      ctx.font = `700 64px ${FONT.sans}`; ctx.fillStyle = '#FFFFFF'; ctx.fillText(`(${n}, ${m})`, X0 + PS, ry + 90);
      ctx.globalAlpha = 1;
    };
    if (u < 0.15) mode(from, out); else mode(to, u < MOVE ? inn : 1);
    const sy = ry + 190, sx0 = X0 + 10, sx1 = X0 + PS - 10, SX = v => sx0 + ((v - 400) / 1000) * (sx1 - sx0);
    ctx.strokeStyle = 'rgba(220, 226, 240, 0.25)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx0, sy); ctx.lineTo(sx1, sy); ctx.stroke();
    ctx.font = `500 24px ${FONT.sans}`; ctx.textAlign = 'center';
    HZ.forEach((v, k) => {
      ctx.fillStyle = 'rgba(220, 226, 240, 0.55)';
      ctx.beginPath(); ctx.arc(SX(v), sy, 7, 0, TAU); ctx.fill();
      ctx.fillText(`${v}`, SX(v), sy + 46);
    });
    ctx.fillStyle = '#F1D9A6'; ctx.beginPath(); ctx.arc(SX(hz), sy, 14, 0, TAU); ctx.fill();
    ctx.fillStyle = '#15171F'; ctx.beginPath(); ctx.arc(SX(hz), sy, 5, 0, TAU); ctx.fill();
  },
};
