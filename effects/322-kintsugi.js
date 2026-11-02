// Kintsugi: a shino tea bowl seen from above (warm white glaze, apricot blushes, iron spots, a brown rim) cracks from one
// point; the cracks race out to the rim, the seven pieces part, then close up again. Gold lacquer flows along every
// seam from the break outward, the gold catches a passing light, and the mended bowl slides away as the next whole
// bowl slides in. The bowl, the pieces and the linen background are images made once in setup; each piece is the
// bowl image clipped by its polygon, so nothing in the glaze or the linen changes from frame to frame.
import { TAU, FONT, canvas, rng, clamp, smoothstep, ease, span, lerp } from '../lib/util.js';

const R = 430, SZ = 940, HALF = SZ / 2;      // bowl radius, bowl image size
const CY = 950;                              // bowl centre on screen (y)
const P0 = [-46, 34];                        // where it breaks, from the bowl centre
const GOLD_SPEED = 560;                      // px per s
const T0 = 0.09, SLIDE = 1.3, SUB = 8;       // the loop starts just after a slide begins; slide time; shutter samples
let bg = null, bowl = null, shadow = null, frame = null, cracks = [], pieces = [];

// a jagged crack from p, heading `a`, until it is past the rim
function crack(r, p, a) {
  const pts = [p.slice()];
  let [x, y] = p, w = 0;
  while (Math.hypot(x, y) < R + 40) {
    w = clamp(w + (r() - 0.5) * 0.55, -0.32, 0.32);
    const step = 16 + r() * 14;
    x += Math.cos(a + w) * step; y += Math.sin(a + w) * step;
    pts.push([x, y]);
  }
  return pts;
}
const angle = p => Math.atan2(p[1], p[0]);
const arc = (a0, a1) => { // points on a big circle from angle a0 counter-clockwise to a1
  while (a1 < a0) a1 += TAU;
  const out = [];
  for (let k = 0; k <= 24; k++) { const a = lerp(a0, a1, k / 24); out.push([(R + 120) * Math.cos(a), (R + 120) * Math.sin(a)]); }
  return out;
};
const lengths = pts => { let s = 0; return pts.map((p, i) => (s += i ? Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0)); };

// the first s px of a polyline
function partial(ctx, pts, cum, s) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    if (cum[i] <= s) { ctx.lineTo(pts[i][0], pts[i][1]); continue; }
    const k = (s - cum[i - 1]) / (cum[i] - cum[i - 1]);
    if (k > 0) ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k));
    return [lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)];
  }
  return pts[pts.length - 1];
}

function makeBowl() {
  const c = canvas(SZ, SZ), g = c.getContext('2d'), r = rng(322);
  g.translate(HALF, HALF);
  g.beginPath(); g.arc(0, 0, R, 0, TAU); g.clip();
  const base = g.createRadialGradient(0, 0, 0, 0, 0, R);
  base.addColorStop(0, '#D9DDD2'); base.addColorStop(0.4, '#E6E2D6'); base.addColorStop(0.85, '#EFE8DA'); base.addColorStop(1, '#E8DCC8');
  g.fillStyle = base; g.fillRect(-R, -R, 2 * R, 2 * R);
  // fire colour: soft apricot blushes where the shino glaze ran thin
  for (let i = 0; i < 14; i++) {
    const a = r() * TAU, rr = 220 + r() * 160, x = rr * Math.cos(a), y = rr * Math.sin(a), s = 50 + r() * 90;
    const blush = g.createRadialGradient(x, y, 0, x, y, s);
    blush.addColorStop(0, `rgba(222, 150, 105, ${0.12 + 0.14 * r()})`); blush.addColorStop(1, 'rgba(222, 150, 105, 0)');
    g.fillStyle = blush; g.fillRect(x - s, y - s, 2 * s, 2 * s);
  }
  // pinholes and iron spots
  for (let i = 0; i < 220; i++) {
    const a = r() * TAU, rr = Math.sqrt(r()) * (R - 30), sz = 0.8 + r() * r() * 3.5;
    g.fillStyle = r() < 0.7 ? `rgba(120, 80, 50, ${0.25 + 0.4 * r()})` : `rgba(90, 95, 100, ${0.2 + 0.3 * r()})`;
    g.beginPath(); g.arc(rr * Math.cos(a), rr * Math.sin(a), sz, 0, TAU); g.fill();
  }
  // the well: glaze pools a little deeper and greener in the bottom, with a soft ring where the wall begins
  const well = g.createRadialGradient(0, 0, 60, 0, 0, 175);
  well.addColorStop(0, 'rgba(170, 186, 172, 0.45)'); well.addColorStop(0.8, 'rgba(170, 186, 172, 0.3)'); well.addColorStop(1, 'rgba(170, 186, 172, 0)');
  g.fillStyle = well; g.beginPath(); g.arc(0, 0, 175, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(150, 140, 120, 0.18)'; g.lineWidth = 6; g.beginPath(); g.arc(0, 0, 168, 0, TAU); g.stroke();
  // light from the upper left: the upper-left inner wall is in soft shade, the lower-right one faces the light
  const lit = g.createLinearGradient(-R, -R, R, R);
  lit.addColorStop(0, 'rgba(70, 60, 50, 0.32)'); lit.addColorStop(0.45, 'rgba(70, 60, 50, 0.04)'); lit.addColorStop(1, 'rgba(255, 250, 240, 0.12)');
  g.fillStyle = lit; g.fillRect(-R, -R, 2 * R, 2 * R);
  const ring = g.createRadialGradient(0, 0, R * 0.55, 0, 0, R); // the steep wall near the rim darkens a little
  ring.addColorStop(0, 'rgba(60, 50, 40, 0)'); ring.addColorStop(1, 'rgba(60, 50, 40, 0.16)');
  g.fillStyle = ring; g.fillRect(-R, -R, 2 * R, 2 * R);
  // a soft window reflection on the glossy wall, lower right
  g.save(); g.rotate(Math.PI / 4); g.translate(290, 0); g.scale(0.3, 1);
  const spec = g.createRadialGradient(0, 0, 0, 0, 0, 170);
  spec.addColorStop(0, 'rgba(255, 255, 255, 0.75)'); spec.addColorStop(1, 'rgba(255, 255, 255, 0)');
  g.fillStyle = spec; g.beginPath(); g.arc(0, 0, 170, 0, TAU); g.fill(); g.restore();
  // the rim: a thin brown edge (the glaze breaks thin over it), lit on its upper-left side
  const rim = g.createLinearGradient(-R, -R, R, R);
  rim.addColorStop(0, '#B68458'); rim.addColorStop(0.5, '#8E5E3A'); rim.addColorStop(1, '#5E3C26');
  g.strokeStyle = rim; g.lineWidth = 12; g.beginPath(); g.arc(0, 0, R - 6, 0, TAU); g.stroke();
  g.strokeStyle = 'rgba(90, 60, 40, 0.35)'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, R - 13, 0, TAU); g.stroke();
  g.strokeStyle = 'rgba(255, 230, 200, 0.5)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, R - 2, Math.PI * 0.85, Math.PI * 1.65); g.stroke();
  return c;
}

// the cracks (5 from the break point, 2 branches) and the 7 pieces between them
function makePieces() {
  const r = rng(77), main = [-2.75, -1.5, -0.3, 0.9, 2.0].map(a => crack(r, P0, a + (r() - 0.5) * 0.2));
  const branch = (i, at, toward) => { const k = Math.floor(main[i].length * at); return { from: i, k, pts: crack(r, main[i][k], toward) }; };
  const b1 = branch(1, 0.45, -0.95), b2 = branch(3, 0.5, 1.5);
  cracks = [...main.map(pts => ({ pts, start: 0 })), { pts: b1.pts, parent: 1, k: b1.k }, { pts: b2.pts, parent: 3, k: b2.k }];
  for (const c of cracks) c.cum = lengths(c.pts);
  for (const c of cracks) c.start = c.parent === undefined ? 0 : cracks[c.parent].cum[c.k]; // gold reaches the branch, then splits
  const end = pts => angle(pts[pts.length - 1]), rev = pts => pts.slice().reverse();
  const polys = [];
  for (let i = 0; i < 5; i++) {
    const A = main[i], B = main[(i + 1) % 5];
    const br = i === 1 ? b1 : i === 3 ? b2 : null;
    if (!br) { polys.push([...A, ...arc(end(A), end(B)), ...rev(B)]); continue; }
    polys.push([...A.slice(br.k), ...arc(end(A), end(br.pts)), ...rev(br.pts)]);
    polys.push([...A.slice(0, br.k + 1), ...br.pts, ...arc(end(br.pts), end(B)), ...rev(B)]);
  }
  pieces = polys.map((poly, n) => {
    const c = canvas(SZ, SZ), g = c.getContext('2d');
    g.translate(HALF, HALF);
    g.beginPath(); poly.forEach(p => g.lineTo(p[0], p[1])); g.closePath(); g.clip();
    g.drawImage(bowl, -HALF, -HALF);
    let mx = 0, my = 0, w = 0; // centroid of the part inside the bowl
    for (let y = -R; y < R; y += 8) for (let x = -R; x < R; x += 8) if (x * x + y * y < R * R && g.isPointInPath(x + HALF, y + HALF)) { mx += x; my += y; w++; }
    const q = rng(n + 5);
    return { img: c, cx: mx / w, cy: my / w, spin: (q() - 0.5) * 0.12 };
  });
}

// the bowl at (x, y): its pieces parted by `apart` (0..1), cracks drawn to `crackS` px, gold to `goldT` s, light `shine`
function drawBowl(ctx, x, y, st) {
  ctx.save(); ctx.translate(x, y);
  ctx.drawImage(shadow, -HALF - 60 + 26, -HALF - 60 + 32);
  if (st.apart <= 0) ctx.drawImage(bowl, -HALF, -HALF);
  else {
    for (const p of pieces) {
      const d = Math.hypot(p.cx - P0[0], p.cy - P0[1]), k = ease.inOut(st.apart);
      ctx.save();
      ctx.translate(p.cx + (p.cx - P0[0]) / d * 46 * k, p.cy + (p.cy - P0[1]) / d * 46 * k);
      ctx.rotate(p.spin * k); ctx.scale(1 + 0.025 * k, 1 + 0.025 * k);
      ctx.translate(-p.cx, -p.cy);
      ctx.drawImage(p.img, -HALF, -HALF);
      ctx.restore();
    }
  }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // hairline cracks: a dark line with a pale lip that catches the light
  const hair = st.crackS > 0 ? 1 - smoothstep(0, 0.12, st.apart) : 0;
  if (hair > 0) {
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R - 1, 0, TAU); ctx.clip();
    for (const c of cracks) {
      const s = st.crackS - c.start;
      if (s <= 0) continue;
      ctx.globalAlpha = hair;
      ctx.save(); ctx.translate(-0.8, -0.8);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'; ctx.lineWidth = 1.6; partial(ctx, c.pts, c.cum, s); ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = '#3A2E26'; ctx.lineWidth = 2.6; partial(ctx, c.pts, c.cum, s); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  // gold: flows outward along each seam from the break point, a bright bead at its front
  if (st.goldT > 0) {
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R - 1, 0, TAU); ctx.clip();
    const heads = [];
    for (const c of cracks) {
      const s = st.goldT * GOLD_SPEED - c.start;
      if (s <= 0) continue;
      ctx.strokeStyle = '#7A5418'; ctx.lineWidth = 10; partial(ctx, c.pts, c.cum, s); ctx.stroke();
      ctx.strokeStyle = '#D2A443'; ctx.lineWidth = 6.5; partial(ctx, c.pts, c.cum, s); ctx.stroke();
      ctx.save(); ctx.translate(-1.2, -1.2);
      ctx.strokeStyle = '#FFE7A6'; ctx.lineWidth = 2; partial(ctx, c.pts, c.cum, s); ctx.stroke();
      ctx.restore();
      if (s < c.cum[c.cum.length - 1]) heads.push(partial(ctx, c.pts, c.cum, s));
    }
    for (const [hx, hy] of heads) {
      const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, 22);
      glow.addColorStop(0, 'rgba(255, 220, 130, 0.7)'); glow.addColorStop(1, 'rgba(255, 220, 130, 0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(hx, hy, 22, 0, TAU); ctx.fill();
      ctx.fillStyle = '#FFE39A'; ctx.beginPath(); ctx.arc(hx, hy, 6, 0, TAU); ctx.fill();
    }
    // a band of light sweeps across: the gold inside it blazes, the glaze takes a faint sheen
    if (st.shine > 0 && st.shine < 1) {
      const u = lerp(-700, 700, st.shine);
      ctx.save(); ctx.rotate(-Math.PI / 4);
      const band = ctx.createLinearGradient(u - 110, 0, u + 110, 0);
      band.addColorStop(0, 'rgba(255, 250, 235, 0)'); band.addColorStop(0.5, 'rgba(255, 250, 235, 0.07)'); band.addColorStop(1, 'rgba(255, 250, 235, 0)');
      ctx.fillStyle = band; ctx.fillRect(u - 110, -R - 100, 220, 2 * R + 200);
      ctx.beginPath(); ctx.rect(u - 70, -R - 100, 140, 2 * R + 200); ctx.clip();
      ctx.rotate(Math.PI / 4);
      ctx.shadowColor = 'rgba(255, 215, 120, 0.9)'; ctx.shadowBlur = 16;
      for (const c of cracks) { ctx.strokeStyle = '#FFF3C8'; ctx.lineWidth = 5; partial(ctx, c.pts, c.cum, 1e4); ctx.stroke(); }
      ctx.restore();
    }
    ctx.restore();
  }
  ctx.restore();
}

export default {
  name: 'Kintsugi',
  ko: '킨츠기',
  setup(_, W, H) {
    bg = canvas(W, H); // dark slate linen under a soft pool of light: fixed
    const g = bg.getContext('2d'), r = rng(9);
    const base = g.createRadialGradient(W * 0.45, CY - 150, 80, W / 2, CY, 1250);
    base.addColorStop(0, '#5B5F63'); base.addColorStop(0.55, '#3F4347'); base.addColorStop(1, '#25282C');
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 1800; i++) { // slubs in the weave
      const x = r() * W, y = r() * H, l = 10 + r() * 50, horiz = r() < 0.5;
      g.strokeStyle = r() < 0.5 ? `rgba(255, 255, 255, ${0.015 + 0.02 * r()})` : `rgba(0, 0, 0, ${0.03 + 0.035 * r()})`;
      g.lineWidth = 1 + r() * 1.5;
      g.beginPath(); g.moveTo(x, y); g.lineTo(horiz ? x + l : x, horiz ? y : y + l); g.stroke();
    }
    bowl = makeBowl();
    shadow = canvas(SZ + 120, SZ + 120);
    const s = shadow.getContext('2d');
    s.filter = 'blur(26px)'; s.fillStyle = 'rgba(8, 8, 10, 0.45)';
    s.beginPath(); s.arc(HALF + 60, HALF + 60, R - 6, 0, TAU); s.fill();
    makePieces();
    frame = canvas(W, H);
  },
  draw(ctx, t, W, H) {
    // local time u: 0-1.3 the mended bowl slides out as a whole one slides in, 1.55-2.1 cracks run out from the
    // break, 2.1-2.6 the pieces part, 2.65-3.2 they close up, from 3.25 gold flows, 4.1-4.75 a light sweeps the gold
    const u = (t + T0) % 5;
    const gap = 1040, slideAt = v => (1 - Math.cos(Math.PI * clamp(v / SLIDE))) / 2; // a sine ease
    if (u < SLIDE + 0.02) {
      // the slide is the only fast move: average SUB instants across the frame's 1/30 s, like a film shutter
      const f = frame.getContext('2d');
      for (let i = 0; i < SUB; i++) {
        const k = slideAt(u + ((i + 0.5) / SUB - 0.5) / 30);
        f.drawImage(bg, 0, 0);
        drawBowl(f, W / 2 - k * gap, CY, { apart: 0, crackS: 640, goldT: 99, shine: 1 });
        drawBowl(f, W / 2 + (1 - k) * gap, CY, { apart: 0, crackS: 0, goldT: 0, shine: 0 });
        ctx.globalAlpha = 1 / (i + 1); ctx.drawImage(frame, 0, 0);
      }
      ctx.globalAlpha = 1;
    } else {
      ctx.drawImage(bg, 0, 0);
      const apart = span(u, 2.1, 2.6) - span(u, 2.65, 3.2);
      drawBowl(ctx, W / 2, CY, { apart: u < 2.1 ? 0 : apart, crackS: span(u, 1.55, 2.1) * 640, goldT: Math.max(0, u - 3.25), shine: span(u, 4.1, 4.75) });
    }

    // the three steps, each in its own place; the current one turns gold
    const steps = [['Break', '깨짐', 1.5, 2.65], ['Rejoin', '맞붙임', 2.65, 3.25], ['Gold', '금 메움', 3.25, 4.7]];
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    steps.forEach(([en, ko, a, b], i) => {
      const x = W / 2 + (i - 1) * 300, y = 1560;
      const on = smoothstep(a - 0.15, a + 0.1, u) * (1 - smoothstep(b - 0.1, b + 0.15, u));
      ctx.font = `700 40px ${FONT.sans}`;
      ctx.fillStyle = `rgb(${lerp(150, 232, on)}, ${lerp(150, 186, on)}, ${lerp(150, 92, on)})`;
      ctx.fillText(`${i + 1}  ${en}`, x, y);
      ctx.font = `500 30px ${FONT.ko}`; ctx.fillText(ko, x, y + 44);
      ctx.fillStyle = `rgba(232, 186, 92, ${on})`;
      ctx.fillRect(x - 70 * on, y + 66, 140 * on, 4);
    });
    ctx.fillStyle = 'rgba(220, 210, 195, 0.7)'; ctx.font = `500 34px ${'"Hiragino Mincho ProN", serif'}`;
    ctx.fillText('金継ぎ', W / 2, 1720);
    ctx.font = `400 26px ${FONT.ko}`; ctx.fillText('mended with lacquer and gold · 옻칠과 금으로 잇기', W / 2, 1764);
  },
};
