// Grunge gig poster, photocopied: a torn black strip with knocked-out "NOISE", a xeroxed cassette held by duct
// tape, label-maker strips, a red marker scrawl and an ink splat. Every texture (toner speckle, copier streaks,
// worn edges, the photocopy threshold) is made once in setup and fixed to its piece or to the page; only the pieces
// move: the strip and its red misprint slide, the labels slide in and out, the left tape peels back so the cassette
// swings down on the other tape, then it is pressed flat again, and the splat lands and soaks away.
import { FONT, TAU, canvas, clamp, ease, fbm3, rng, span } from '../lib/util.js';

const PAPER = '#E7E2D4', TONER = '#141312', RED = '#B42A20';
let page = null, overlay = null, strip = null, misprint = null, tape = null, cassette = null, splat = null, labels = null;

// a ragged polygon edge from (x0, y) to (x1, y), jittered by up to j px
const ragged = (r, x0, x1, y, j, step = 14) => { const out = []; for (let x = x0; x <= x1; x += step) out.push([x, y + (r() - 0.5) * 2 * j]); return out; };

function makeStrip(knock) { // a torn black strip with the word cut out of it, or the word alone in red; both worn
  const c = canvas(1500, 330), g = c.getContext('2d'), r = rng(knock ? 7 : 8);
  g.font = `400 300px ${'"Impact", "Arial Black", sans-serif'}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (knock) {
    g.fillStyle = TONER; g.beginPath();
    for (const p of [...ragged(r, 0, 1500, 22, 14), ...ragged(r, 0, 1500, 308, 14).reverse()]) g.lineTo(p[0], p[1]);
    g.fill();
    g.globalCompositeOperation = 'destination-out';
  } else g.fillStyle = RED;
  g.fillText('NOISE', 760, 172);
  g.globalCompositeOperation = 'destination-out'; // worn: specks and scuffs rubbed off
  for (let i = 0; i < 1600; i++) { const s = r() < 0.9 ? 1 + r() * 3 : 4 + r() * 10; g.globalAlpha = 0.3 + 0.7 * r(); g.fillRect(r() * 1500, r() * 330, s, s * (0.3 + r())); }
  return c;
}

function makeTape() { // grey duct tape with a woven texture and torn ends
  const w = 300, h = 86, c = canvas(w, h), g = c.getContext('2d'), r = rng(21);
  g.beginPath();
  for (let y = 0; y <= h; y += 8) g.lineTo(8 + r() * 14, y);
  for (let y = h; y >= 0; y -= 8) g.lineTo(w - 8 - r() * 14, y);
  g.closePath(); g.fillStyle = 'rgba(158, 158, 152, 0.94)'; g.fill();
  g.globalCompositeOperation = 'source-atop';
  g.strokeStyle = 'rgba(255, 255, 255, 0.12)'; g.lineWidth = 1;
  for (let x = 0; x < w; x += 4) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  for (let y = 0; y < h; y += 5) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.strokeStyle = 'rgba(0, 0, 0, 0.08)'; g.stroke(); }
  const sh = g.createLinearGradient(0, 0, 0, h); sh.addColorStop(0, 'rgba(255,255,255,0.25)'); sh.addColorStop(1, 'rgba(0,0,0,0.15)');
  g.fillStyle = sh; g.fillRect(0, 0, w, h);
  return c;
}

function makeCassette() { // a cassette drawn clean, then thresholded like a cheap photocopy
  const w = 700, h = 440, src = canvas(w, h), g = src.getContext('2d');
  g.fillStyle = '#d8d4c8'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#2a2a2a'; g.beginPath(); g.roundRect(30, 30, w - 60, h - 60, 26); g.fill();
  g.fillStyle = '#c9c5b8'; g.beginPath(); g.roundRect(70, 60, w - 140, 220, 12); g.fill();
  g.fillStyle = '#444'; g.beginPath(); g.roundRect(200, 140, 300, 110, 50); g.fill();
  for (const x of [255, 445]) {
    g.fillStyle = '#e8e4d8'; g.beginPath(); g.arc(x, 195, 40, 0, TAU); g.fill();
    g.fillStyle = '#222'; for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; g.fillRect(x + 22 * Math.cos(a) - 5, 195 + 22 * Math.sin(a) - 5, 10, 10); }
    g.beginPath(); g.arc(x, 195, 12, 0, TAU); g.fill();
  }
  g.fillStyle = '#222'; g.font = `400 46px ${'"Marker Felt", sans-serif'}`; g.fillText("MIX TAPE '94", 100, 120);
  g.fillRect(90, 132, 520, 3);
  g.beginPath(); g.moveTo(140, h - 30); g.lineTo(180, h - 100); g.lineTo(520, h - 100); g.lineTo(560, h - 30); g.fill();
  const px = g.getImageData(0, 0, w, h), d = px.data, r = rng(4);
  for (let i = 0; i < w * h; i++) {
    const x = i % w, y = Math.floor(i / w), n = fbm3(x / 60, y / 60, 2.2) * 90 + (r() - 0.5) * 60;
    const v = d[i * 4] + n;
    const ink = v < 128 ? [20, 19, 18] : v < 150 && r() < 0.5 ? [90, 88, 84] : [231, 226, 212];
    d[i * 4] = ink[0]; d[i * 4 + 1] = ink[1]; d[i * 4 + 2] = ink[2];
  }
  g.putImageData(px, 0, 0);
  return src;
}

function makeSplat() {
  const c = canvas(520, 520), g = c.getContext('2d'), r = rng(13);
  g.fillStyle = RED; g.translate(260, 260);
  g.beginPath();
  for (let i = 0; i <= 40; i++) { const a = i / 40 * TAU, rr = 90 + 28 * fbm3(Math.cos(a) * 2, Math.sin(a) * 2, 5) + (i % 5 === 0 ? 40 * r() : 0); g.lineTo(rr * Math.cos(a), rr * Math.sin(a)); }
  g.fill();
  for (let i = 0; i < 26; i++) { // droplets and streaks thrown outward
    const a = r() * TAU, d0 = 110 + r() * 130, s = 4 + r() * 16;
    g.beginPath(); g.ellipse(d0 * Math.cos(a), d0 * Math.sin(a), s * 1.6, s, a, 0, TAU); g.fill();
    if (r() < 0.4) { g.lineWidth = s * 0.6; g.strokeStyle = RED; g.beginPath(); g.moveTo(80 * Math.cos(a), 80 * Math.sin(a)); g.lineTo(d0 * Math.cos(a), d0 * Math.sin(a)); g.stroke(); }
  }
  return c;
}

function makeLabel(text, color) { // label-maker tape: raised white letters on coloured plastic
  const g0 = canvas(10, 10).getContext('2d'); g0.font = `700 58px ${'"DIN Condensed", "Avenir Next Condensed", sans-serif'}`;
  const w = g0.measureText(text).width + 70, c = canvas(w, 84), g = c.getContext('2d');
  g.fillStyle = color; g.beginPath(); g.roundRect(0, 4, w, 76, 8); g.fill();
  g.font = g0.font; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(0, 0, 0, 0.35)'; g.fillText(text, 37, 49);
  g.fillStyle = '#F4F1EA'; g.fillText(text, 35, 46);
  return c;
}

export default {
  name: 'Grunge',
  ko: '그런지',
  setup(_, W, H) {
    const r = rng(99);
    page = canvas(W, H); // the paper: blotchy, darker toward the edges
    let g = page.getContext('2d');
    g.fillStyle = PAPER; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 260; i++) { const x = r() * W, y = r() * H, s = 30 + r() * 140; g.fillStyle = `rgba(${r() < 0.5 ? '120, 105, 80' : '255, 255, 250'}, 0.05)`; g.beginPath(); g.ellipse(x, y, s, s * 0.6, r() * 3, 0, TAU); g.fill(); }
    const v = g.createRadialGradient(W / 2, H / 2, 500, W / 2, H / 2, 1250); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(40, 32, 20, 0.35)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
    overlay = canvas(W, H); // the copier: toner speckle, streaks and a dirty edge, over everything
    g = overlay.getContext('2d');
    for (let i = 0; i < 7000; i++) { g.fillStyle = `rgba(20, 19, 18, ${0.2 + 0.5 * r()})`; const s = r() < 0.97 ? 1 + r() * 2 : 3 + r() * 6; g.fillRect(r() * W, r() * H, s, s); }
    for (const x of [96, 97, 405, 812, 813, 1004]) { g.fillStyle = 'rgba(20, 19, 18, 0.10)'; g.fillRect(x, 0, 2 + (x % 3), H); }
    for (let y = 0; y < H; y += 6) { const k = 0.5 + 0.5 * fbm3(1.3, y / 120, 9); g.fillStyle = `rgba(20, 19, 18, ${0.5 * k})`; g.fillRect(0, y, 10 + 22 * k, 6); g.fillRect(W - 10 - 18 * k, y, 30, 6); }
    strip = makeStrip(true); misprint = makeStrip(false);
    tape = makeTape(); cassette = makeCassette(); splat = makeSplat();
    labels = [makeLabel('LIVE @ THE BASEMENT', TONER), makeLabel('FRI 13 · 9PM · $5', RED), makeLabel('ALL AGES', TONER)];
  },
  draw(ctx, time, W, H) {
    const t = (time + 0.15) % 5, a = t / 5 * TAU; // the video starts as the first label slides in, so the seam falls in motion
    ctx.drawImage(page, 0, 0);

    // label-maker strips slide in from the right one after another, and out again before the loop ends
    [[90, 370, -0.05, 0.1], [300, 470, 0.03, 0.25], [520, 570, -0.02, 0.4]].forEach(([x, y, rot, at], i) => {
      const p = ease.out(span(t, at, at + 0.5)) - ease.in(span(t, 4.15 + i * 0.1, 4.6 + i * 0.1));
      ctx.save(); ctx.translate(x + (1 - p) * 1100, y); ctx.rotate(rot); ctx.drawImage(labels[i], 0, -42); ctx.restore();
    });

    // the cassette hangs on two strips of tape; the left one peels back and the cassette swings down on the right one
    const peel = ease.inOut(span(t, 0.9, 1.6)) - ease.inOut(span(t, 3.0, 3.6));
    const fall = Math.max(0, t - 1.2); // released at 1.2 s: a damped swing that starts from rest and settles
    const swing = (t < 1.2 ? 0 : 1 - Math.exp(-4 * fall) * (Math.cos(9 * fall) + 4 / 9 * Math.sin(9 * fall))) * (1 - ease.inOut(span(t, 3.1, 3.7)));
    ctx.save();
    ctx.translate(840, 770); ctx.rotate(-0.13 * swing); ctx.translate(-840, -770); // pivot under the right tape
    ctx.save(); ctx.translate(540, 1000); ctx.rotate(-0.03);
    ctx.fillStyle = 'rgba(30, 25, 15, 0.25)'; ctx.fillRect(-342, -212, 700, 440);
    ctx.drawImage(cassette, -350, -220);
    ctx.restore();
    ctx.save(); ctx.translate(840, 770); ctx.rotate(0.6); ctx.drawImage(tape, -150, -43); ctx.restore(); // the right tape holds
    ctx.save(); ctx.translate(240, 770); ctx.rotate(-0.6); // the left tape: its outer end (to the left) folds back over itself
    const fold = -150 + 120 * peel, phi = peel * 2.6, k = Math.cos(phi);
    ctx.save(); ctx.beginPath(); ctx.rect(fold, -60, 300, 120); ctx.clip(); ctx.drawImage(tape, -150, -43); ctx.restore();
    if (peel > 0.001) {
      ctx.fillStyle = `rgba(20, 15, 5, ${0.25 * Math.sin(phi)})`; // its shadow on the page
      ctx.fillRect(fold - (fold + 150) * Math.max(k, 0) - 16 * Math.sin(phi), -30, (fold + 150) * Math.abs(k) + 10, 86);
      ctx.save(); ctx.translate(fold, 0); ctx.scale(k, 1);
      ctx.drawImage(tape, 0, 0, fold + 150, 86, -(fold + 150), -43, fold + 150, 86);
      if (k < 0) { ctx.fillStyle = 'rgba(235, 232, 222, 0.55)'; ctx.fillRect(-(fold + 150), -40, fold + 150, 80); } // the sticky side
      ctx.restore();
    }
    ctx.restore();
    ctx.restore();

    // the NOISE strip and its red misprint (seen through the cut-out letters) slide against each other
    ctx.save(); ctx.translate(556 + 30 * Math.sin(a + 0.6), 1396); ctx.rotate(0.05); ctx.drawImage(misprint, -760, -165); ctx.restore();
    ctx.save(); ctx.translate(540 - 40 * Math.sin(a), 1384); ctx.rotate(0.035); ctx.drawImage(strip, -760, -165); ctx.restore();

    // marker scrawl and the splat that lands at 2.1 s and soaks away at the end
    ctx.save(); ctx.translate(120, 1700); ctx.rotate(-0.12);
    ctx.fillStyle = RED; ctx.font = `700 96px ${'"Marker Felt", sans-serif'}`; ctx.fillText('SIDE A', 0, 0);
    ctx.strokeStyle = RED; ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(160, -34, 220, 80, 0.04, 0.3, TAU + 0.1); ctx.stroke();
    ctx.restore();
    const s = ease.outBack(span(t, 2.1, 2.3)), fade = 1 - ease.inOut(span(t, 4.2, 4.9));
    if (s > 0.001 && fade > 0.001) {
      ctx.save(); ctx.globalAlpha = 0.92 * fade; ctx.translate(800, 1660); ctx.rotate(0.4); ctx.scale(s, s); ctx.drawImage(splat, -260, -260); ctx.restore();
    }

    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(overlay, 0, 0); ctx.restore();
  },
};
