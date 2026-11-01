// Art Deco poster, gold on black: a stepped skyscraper telescopes up tier by tier out of its plinth (Chrysler-style
// crown of arches with triangular windows, needle spire), a sunburst fans open behind it, a chevron frieze and the
// geometric "ART DECO" type rise into place and a gleam sweeps across all the gold. Then it folds away in reverse;
// the tower sinks while the fan is still closing, and rises again before the fan has shut, so the poster never empties.
// All gold is drawn on one layer: one metallic gradient fills it, windows are cut out, and the gleam is laid on top.
import { FONT, TAU, canvas, ease, lerp, span } from '../lib/util.js';

const CX = 540, BASE = 1400; // the tower stands on the plinth at y = 1400
const TIERS = [[200, 1110], [150, 900], [108, 740]]; // half width, top
const ARCHES = [0, 1, 2, 3].map(k => [740 - k * 44, 78 - k * 15]); // crown arches: centre y, radius
const RAYS = 27;
let layer = null;

// progress of one piece on its own 5 s cycle: builds over [a, a + d], folds away over [f, f + fd] (seconds; a fold
// may run past 5 s, into the start of the next build of other pieces, as long as it ends before a + 5)
function prog(t, a, d, f, fd, fn = ease.inOut) {
  const age = ((t - a) % 5 + 5) % 5;
  return fn(span(age, 0, d)) * (1 - ease.inOut(span(age, f - a, f - a + fd)));
}

function goldGradient(c) {
  const g = c.createLinearGradient(0, 300, 1080, 1900);
  [['#8C6A2A', 0], ['#E9CF7A', 0.14], ['#A47A2C', 0.28], ['#F6E3A0', 0.42], ['#B8893A', 0.56], ['#EED38A', 0.7], ['#8E6828', 0.84], ['#D9B866', 1]]
    .forEach(([col, s]) => g.addColorStop(s, col));
  return g;
}

export default {
  name: 'Art Deco',
  ko: '아르데코',
  setup(_, W, H) { layer = canvas(W, H); },
  draw(ctx, time, W, H) {
    const t = (time + 0.2) % 5; // the video starts 0.2 s into the cycle, so the loop seam falls on average motion
    const bg = ctx.createRadialGradient(CX, 1150, 50, CX, 1150, 1200);
    bg.addColorStop(0, '#1B150C'); bg.addColorStop(1, '#050505');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    const c = layer.getContext('2d');
    c.clearRect(0, 0, W, H);
    c.fillStyle = c.strokeStyle = '#fff'; // shapes first, the gold gradient goes on afterwards

    // frame: a heavy and a fine rule with stepped corners (always there)
    c.lineWidth = 5; c.strokeRect(30, 30, W - 60, H - 60);
    c.lineWidth = 2; c.strokeRect(48, 48, W - 96, H - 96);
    for (const [x, y, sx, sy] of [[48, 48, 1, 1], [W - 48, 48, -1, 1], [48, H - 48, 1, -1], [W - 48, H - 48, -1, -1]]) {
      c.save(); c.translate(x, y); c.scale(sx, sy);
      for (let k = 0; k < 3; k++) { c.fillRect(10 + k * 18, 10, 8, 54 - k * 18); c.fillRect(10, 10 + k * 18, 54 - k * 18, 8); }
      c.restore();
    }

    c.save(); // inside the inner frame
    c.beginPath(); c.rect(52, 52, W - 104, H - 104); c.clip();

    // sunburst: thin rays fan open from the vertical, long and short in turn, and two arcs. The middle rays open
    // first and close last: the fan is still folding shut (4.4 - 5.7 s) while the next tower rises
    for (let j = 0; j < RAYS; j++) {
      const mid = (RAYS - 1) / 2, side = Math.abs(j - mid);
      const p = prog(t, 1.0 + side * 0.035, 1.0, 4.4 + (mid - side) * 0.04, 0.8, ease.outBack);
      if (p <= 0.001) continue;
      const target = Math.PI + (j + 0.5) / RAYS * Math.PI, ang = lerp(1.5 * Math.PI, target, p);
      const R = (j % 2 ? 700 : 880) * Math.min(1, p), w = j % 2 ? 0.010 : 0.016;
      c.beginPath(); c.moveTo(CX, BASE);
      c.lineTo(CX + R * Math.cos(ang - w), BASE + R * Math.sin(ang - w)); c.lineTo(CX + R * Math.cos(ang + w), BASE + R * Math.sin(ang + w));
      c.closePath(); c.fill();
    }
    const arc = prog(t, 1.1, 0.8, 4.2, 0.6);
    if (arc > 0) {
      c.lineWidth = 4; c.beginPath(); c.arc(CX, BASE, 560, 1.5 * Math.PI - arc * Math.PI / 2, 1.5 * Math.PI + arc * Math.PI / 2); c.stroke();
      c.lineWidth = 2; c.beginPath(); c.arc(CX, BASE, 584, 1.5 * Math.PI - arc * Math.PI / 2, 1.5 * Math.PI + arc * Math.PI / 2); c.stroke();
    }

    // side columns: three rules each side rising from the plinth line, capped with a stepped block
    const col = prog(t, 0.3, 0.9, 3.8, 0.7);
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) {
      const x = CX + sx * (430 - k * 16), top = 520 + k * 60, y = lerp(BASE, top, col);
      c.fillRect(x - 2, y, 4, BASE - y);
      if (col > 0.02) c.fillRect(x - 9, y - 12, 18, 12);
    }

    // the tower, back to front so each tier telescopes out of the one below it; nothing shows below the plinth
    c.save();
    c.beginPath(); c.rect(0, 0, W, BASE); c.clip();
    const rise = (p, top) => (1 - p) * (BASE - top + 30);
    const sp = prog(t, 0.85, 0.5, 3.9, 0.45), spY = rise(sp, 360);
    c.beginPath(); c.moveTo(CX, 360 + spY); c.lineTo(CX + 10, 600 + spY); c.lineTo(CX - 10, 600 + spY); c.closePath(); c.fill();
    for (let k = ARCHES.length - 1; k >= 0; k--) {
      const [cy, r] = ARCHES[k], y = cy + rise(prog(t, 0.55 + k * 0.08, 0.55, 4.0 + (3 - k) * 0.07, 0.5), cy - r);
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(CX, y, r, Math.PI, TAU); c.lineTo(CX + r, y + 50); c.lineTo(CX - r, y + 50); c.closePath(); c.fill();
      c.globalCompositeOperation = 'destination-out'; // triangular windows radiating round the arch
      for (let i = 0; i < 7; i++) {
        const a = Math.PI + (i + 0.5) / 7 * Math.PI, r1 = r - 7, r2 = r - 26;
        c.beginPath(); c.moveTo(CX + r1 * Math.cos(a - 0.11), y + r1 * Math.sin(a - 0.11)); c.lineTo(CX + r1 * Math.cos(a + 0.11), y + r1 * Math.sin(a + 0.11));
        c.lineTo(CX + r2 * Math.cos(a), y + r2 * Math.sin(a)); c.closePath(); c.fill();
      }
      c.globalCompositeOperation = 'source-over';
    }
    const tierY = TIERS.map(([, top], k) => top + rise(prog(t, 0.2 * k, 0.6, 4.25 + (2 - k) * 0.15, 0.45), top));
    for (let k = TIERS.length - 1; k >= 0; k--) {
      const [hw, top] = TIERS[k], y = tierY[k], h = BASE - top;
      c.fillRect(CX - hw, y, 2 * hw, h);
      c.globalCompositeOperation = 'destination-out';
      c.fillRect(CX - hw, y + 14, 2 * hw, 4); // a cut under the setback cap
      for (let x = CX - hw + 22; x < CX + hw - 20; x += 36) // window slits in columns
        for (let wy = y + 40; wy < y + h - 40; wy += 64) c.fillRect(x, wy, 12, 46);
      c.globalCompositeOperation = 'source-over';
    }
    c.restore();
    c.fillStyle = '#fff';

    // plinth: three steps, always there like the frame
    for (const [hw, dy] of [[250, 0], [290, 24], [330, 48]]) c.fillRect(CX - hw, BASE + dy, 2 * hw, 20);
    // chevron frieze: a double zigzag drawn from the middle outward
    const fz = prog(t, 1.2, 0.6, 3.6, 0.5);
    if (fz > 0) {
      c.save(); c.beginPath(); c.rect(CX - 430 * fz, 1490, 860 * fz, 70); c.clip();
      c.lineWidth = 5; c.lineJoin = 'miter';
      for (const dy of [0, 22]) {
        c.beginPath();
        for (let i = 0; i <= 20; i++) c.lineTo(CX - 430 + i * 43, 1500 + dy + (i % 2 ? 26 : 0));
        c.stroke();
      }
      c.restore();
    }

    // type: each letter of ART DECO rises out of a slot, then the rule and the line beneath
    c.font = `500 150px ${FONT.display}`; c.textBaseline = 'alphabetic'; c.textAlign = 'left';
    const word = 'ART DECO', track = 22;
    const widths = [...word].map(ch => c.measureText(ch).width);
    let x = CX - (widths.reduce((s, w) => s + w, 0) + track * (word.length - 1)) / 2;
    c.save(); c.beginPath(); c.rect(0, 1560, W, 1708 - 1560); c.clip();
    [...word].forEach((ch, i) => {
      const p = prog(t, 1.3 + i * 0.06, 0.45, 3.45 + (7 - i) * 0.04, 0.4);
      c.fillText(ch, x, 1700 + (1 - p) * 160);
      x += widths[i] + track;
    });
    c.restore();
    const ln = prog(t, 1.75, 0.45, 3.45, 0.4);
    c.fillRect(CX - 400 * ln, 1728, 800 * ln, 3); c.fillRect(CX - 360 * ln, 1738, 720 * ln, 2);
    c.globalAlpha = ln;
    c.font = `400 42px ${FONT.serif}`; c.letterSpacing = '14px'; c.textAlign = 'center';
    c.fillText('PARIS · MCMXXV', CX + 7, 1800);
    c.letterSpacing = '0px'; c.globalAlpha = 1;
    for (let k = 0; k < 3; k++) { // nested chevrons pointing down
      const p = prog(t, 1.9 + k * 0.08, 0.4, 3.4 + (2 - k) * 0.05, 0.35), y = 1822 + k * 12 - (1 - p) * 30;
      c.globalAlpha = p;
      c.beginPath(); c.moveTo(CX - 40 + k * 10, y); c.lineTo(CX, y + 22 - k * 3); c.lineTo(CX + 40 - k * 10, y); c.lineWidth = 4; c.stroke();
    }
    c.globalAlpha = 1;
    c.restore();

    // paint it gold, then sweep a gleam across it (only over the gold)
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = goldGradient(c); c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'source-atop';
    const s = lerp(-300, 2500, ease.inOut(span(t, 2.3, 3.4))), dx = 0.6, dy = 0.8;
    const gl = c.createLinearGradient(dx * (s - 200), dy * (s - 200), dx * (s + 200), dy * (s + 200));
    gl.addColorStop(0, 'rgba(255, 248, 215, 0)'); gl.addColorStop(0.5, 'rgba(255, 250, 225, 0.85)'); gl.addColorStop(1, 'rgba(255, 248, 215, 0)');
    c.fillStyle = gl; c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'source-over';
    ctx.drawImage(layer, 0, 0);

    // the right half of each tier in shade (only the part not hidden by the tier in front)
    ctx.save();
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = '#A27A48';
    TIERS.forEach(([hw], k) => {
      const y0 = tierY[k], y1 = k ? Math.min(BASE, tierY[k - 1]) : BASE;
      if (y1 > y0) ctx.fillRect(CX, y0, hw, y1 - y0);
    });
    ctx.restore();

    // glints: four-point stars that swell as the gleam passes them
    for (const [gx, gy, size] of [[CX, 362, 46], [CX - 330, 1448, 30], [CX + 380, 1700, 26]]) {
      const k = Math.exp(-((((gx * dx + gy * dy) - s) / 160) ** 2)) * size;
      if (k < 0.5) continue;
      ctx.fillStyle = 'rgba(255, 246, 210, 0.95)';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? k * 0.16 : k; ctx.lineTo(gx + r * Math.cos(a), gy + r * Math.sin(a)); }
      ctx.closePath(); ctx.fill();
    }
  },
};
