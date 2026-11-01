// Russian Constructivism poster in red, black and cream: everything runs on a hard 26-degree diagonal. A black
// band with slanted heavy type, a red bar, a red wedge driving into a black circle, a halftone photomontage of a
// factory and a megaphone slam in one after another, each with a short overshoot; it holds, then every piece
// flies back out the way it came. The halftone photo and the paper speckle are made once in setup.
import { TAU, canvas, clamp, ease, rng, span } from '../lib/util.js';

const RED = '#D2232A', INK = '#151311', CREAM = '#ECE1C6';
const ANG = -26 * Math.PI / 180, DX = Math.cos(ANG), DY = Math.sin(ANG); // the poster's axis, rising to the right
const IMPACT = '"Impact", "Arial Black", sans-serif';
let photo = null, paper = null;

// slam: a fast arrival with a short overshoot; exits are the same path back, accelerating
const slam = k => 1 + 2.4 * (k - 1) ** 3 + 1.4 * (k - 1) ** 2;
function piece(t, a) { // 0 = off, 1 = in place; a = arrival time. Leaves in reverse order from 3.9 s
  const out = 3.9 + (1.8 - a) * 0.35;
  return slam(span(t, a, a + 0.32)) - ease.in(span(t, out, out + 0.4));
}

function makePhoto() { // smokestacks, a saw-tooth factory hall and a big gear, printed as a halftone screen
  const w = 400, h = 300, src = canvas(w, h), g = src.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#f2f2f2'); sky.addColorStop(1, '#a8a8a8');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  const r = rng(5);
  for (const [sx, sy] of [[62, 40], [112, 20], [162, 50]]) // smoke drifting up and right from each stack
    for (let i = 0; i < 7; i++) { g.fillStyle = `rgba(110, 110, 110, ${0.22 + 0.1 * r()})`; g.beginPath(); g.arc(sx + i * 16, sy - i * 6, 10 + i * 4, 0, TAU); g.fill(); }
  g.fillStyle = '#202020';
  for (const [sx, sy] of [[62, 40], [112, 20], [162, 50]]) g.fillRect(sx - 9, sy, 18, h);
  g.beginPath(); g.moveTo(0, h); g.lineTo(0, 200); // saw-tooth roof
  for (let x = 0; x < 260; x += 52) { g.lineTo(x + 40, 168); g.lineTo(x + 40, 200); g.lineTo(x + 52, 200); }
  g.lineTo(260, h); g.closePath(); g.fill();
  g.fillStyle = '#686868'; for (let x = 12; x < 250; x += 26) g.fillRect(x, 222, 12, 30);
  g.fillStyle = '#121212'; g.beginPath(); // the gear
  for (let i = 0; i < 24; i++) { const a = i / 24 * TAU, rr = i % 2 ? 92 : 112; g.lineTo(320 + rr * Math.cos(a), 250 + rr * Math.sin(a)); }
  g.closePath(); g.fill();
  g.fillStyle = '#c8c8c8'; g.beginPath(); g.arc(320, 250, 34, 0, TAU); g.fill();
  const px = g.getImageData(0, 0, w, h).data, out = canvas(w, h), o = out.getContext('2d');
  o.fillStyle = CREAM; o.fillRect(0, 0, w, h); o.fillStyle = INK;
  for (let y = 4, row = 0; y < h; y += 8, row++) for (let x = (row % 2) * 4 + 4; x < w; x += 8) {
    const v = px[(Math.floor(y) * w + Math.floor(x)) * 4] / 255;
    o.beginPath(); o.arc(x, y, 4.7 * Math.sqrt(1 - v), 0, TAU); o.fill();
  }
  return out;
}

export default {
  name: 'Constructivism',
  ko: '구성주의',
  setup(_, W, H) {
    photo = makePhoto();
    paper = canvas(W, H); // fixed paper speckle, drawn identically every frame
    const g = paper.getContext('2d'), r = rng(42);
    for (let i = 0; i < 9000; i++) { g.fillStyle = r() < 0.5 ? 'rgba(90, 70, 40, 0.10)' : 'rgba(255, 255, 255, 0.18)'; g.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2); }
  },
  draw(ctx, time, W, H) {
    const t = (time + 0.6) % 5; // the video starts 0.6 s into the build, so the loop seam falls in motion
    ctx.fillStyle = CREAM; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(paper, 0, 0);

    // a piece in poster space: centre (x, y), rotated to the axis, sliding in along (fx, fy) by `dist`
    const place = (p, x, y, fx, fy, dist, rot = ANG) => { ctx.save(); ctx.translate(x + fx * dist * (1 - p), y + fy * dist * (1 - p)); ctx.rotate(rot); };

    // two thin rules crossing the other way: the poster's fixed construction lines
    ctx.save(); ctx.translate(560, 1100); ctx.rotate(ANG + Math.PI / 2 - 0.12);
    ctx.fillStyle = INK; ctx.fillRect(-900, -4, 1800, 8); ctx.fillRect(-900, 40, 1800, 3);
    ctx.restore();

    // black band with the slogan, and a red bar under it
    let p = piece(t, 0.0);
    place(p, 540, 1120, -DX, -DY, 1900); ctx.fillStyle = INK; ctx.fillRect(-1000, -100, 2000, 200); ctx.restore();
    p = piece(t, 0.22);
    place(p, 600, 1330, DX, DY, 1900); ctx.fillStyle = RED; ctx.fillRect(-950, -36, 1900, 72); ctx.restore();

    // black circle, with a red wedge driving into it
    p = piece(t, 0.42);
    ctx.save(); ctx.translate(320, 690 - 900 * (1 - p)); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, 0, 190, 0, TAU); ctx.fill(); ctx.restore();
    p = piece(t, 0.62);
    place(p, 330, 690, DX, DY, 1100, ANG + Math.PI);
    ctx.fillStyle = RED; ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(-620, -145); ctx.lineTo(-620, 145); ctx.closePath(); ctx.fill();
    ctx.restore();

    // the slogan, stamped letter by letter: ВПЕРЁД (forward)
    ctx.save(); ctx.translate(540, 1120); ctx.rotate(ANG);
    ctx.font = `400 168px ${IMPACT}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    const word = [...'ВПЕРЁД'], ws = word.map(ch => ctx.measureText(ch).width), total = ws.reduce((a, b) => a + b, 0) + 14 * (word.length - 1);
    let x = -total / 2;
    word.forEach((ch, i) => {
      const k = piece(t, 0.8 + i * 0.07);
      if (k > 0) {
        const s = 1 + 0.9 * (1 - clamp(k));
        ctx.save(); ctx.translate(x + ws[i] / 2, 8); ctx.scale(s, s);
        ctx.globalAlpha = clamp(k * 3); ctx.fillStyle = CREAM; ctx.fillText(ch, 0, 0);
        ctx.restore();
      }
      x += ws[i] + 14;
    });
    ctx.restore();

    // photomontage block: a halftone factory, with a red caption bar
    p = piece(t, 1.1);
    place(p, 330, 1600, -DY, DX, 900);
    ctx.fillStyle = INK; ctx.fillRect(-212, -162, 424, 324);
    ctx.drawImage(photo, -200, -150);
    ctx.fillStyle = RED; ctx.fillRect(-212, 170, 300, 56);
    ctx.fillStyle = CREAM; ctx.font = `400 40px ${IMPACT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('ЗАВОД  1924', -196, 199);
    ctx.restore();

    // megaphone at the lower right, shouting up the diagonal
    p = piece(t, 1.3);
    place(p, 820, 1560, DX, DY, 900, Math.PI - ANG); // pointing up and left, at the slogan
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.moveTo(-40, -30); ctx.lineTo(220, -120); ctx.lineTo(220, 120); ctx.lineTo(-40, 30); ctx.closePath(); ctx.fill();
    ctx.fillRect(-120, -26, 90, 52);
    ctx.fillStyle = RED; ctx.fillRect(214, -132, 24, 264);
    ctx.restore();

    // the sub-headline above the band: ИСКУССТВО В ЖИЗНЬ (art into life)
    p = piece(t, 1.45);
    place(p, 540, 1120, -DX, -DY, 1200);
    ctx.fillStyle = INK; ctx.font = `400 58px ${IMPACT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('ИСКУССТВО В ЖИЗНЬ', -60, -122);
    ctx.restore();
  },
};
