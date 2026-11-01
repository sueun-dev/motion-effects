// Collage: paper scraps are tossed onto a kraft scrapbook page one after another and land with a settling spin: a
// torn magazine photo with a white torn rim, a Polaroid, a newspaper scrap, a ticket stub, perforated stamps with a
// postmark, washi tape and ransom-note letters spelling COLLAGE. Every scrap shifts gently while it lies there, then
// they are swept off to the left, last one first; the first new scraps land while the last old ones are still
// leaving, so the page is never empty. All scraps and textures are drawn once in setup; per frame they are only moved,
// turned and shadowed. The paper fibres are fixed on top of everything.
import { FONT, TAU, canvas, fbm3, rng, span } from '../lib/util.js';
import { city, landscape } from '../lib/scenes.js';

let kraft = null, fibres = null, pieces = null;
const SHIFT = 0.93; // the video starts this far into the cycle, so the loop seam falls on average motion

// a jagged outline round the rectangle x0..x1, y0..y1: each side torn (jittered) or cut straight
function outline(x0, y0, x1, y1, r, torn4, j) {
  const pts = [];
  const side = (ax, ay, bx, by, rough) => {
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / 12));
    for (let i = 0; i < n; i++) { const k = i / n, d = rough ? (r() - 0.5) * 2 * j : 0; pts.push([ax + (bx - ax) * k + d, ay + (by - ay) * k + d]); }
  };
  side(x0, y0, x1, y0, torn4[0]); side(x1, y0, x1, y1, torn4[1]); side(x1, y1, x0, y1, torn4[2]); side(x0, y1, x0, y0, torn4[3]);
  return pts;
}
const path = (g, pts) => { g.beginPath(); for (const p of pts) g.lineTo(p[0], p[1]); g.closePath(); };

// a scrap with torn sides (top, right, bottom, left): a white fibrous rim, the picture clipped inside it
function torn(w, h, seed, torn4, paint) {
  const m = 12, c = canvas(w + 2 * m, h + 2 * m), g = c.getContext('2d'), r = rng(seed), k = 8;
  g.translate(m, m);
  path(g, outline(0, 0, w, h, r, torn4, 6)); g.fillStyle = '#FBF8F0'; g.fill();
  g.save(); path(g, outline(torn4[3] * k, torn4[0] * k, w - torn4[1] * k, h - torn4[2] * k, r, torn4, 4)); g.clip();
  paint(g, w, h); g.restore();
  return c;
}

function polaroid() {
  const c = canvas(380, 460), g = c.getContext('2d');
  g.fillStyle = '#FBFAF5'; g.fillRect(0, 0, 380, 460);
  const img = canvas(340, 340); city(img.getContext('2d'), 340, 340);
  g.drawImage(img, 20, 20);
  g.strokeStyle = 'rgba(0, 0, 0, 0.15)'; g.strokeRect(20.5, 20.5, 339, 339);
  g.fillStyle = '#2B3A67'; g.font = `400 40px ${'"Bradley Hand", "Noteworthy", cursive'}`; g.textAlign = 'center';
  g.fillText("city lights '98", 190, 418);
  return c;
}

function stamp(seed, paint, mark) {
  const w = 210, h = 260, m = 70, c = canvas(w + 2 * m, h + 2 * m), g = c.getContext('2d');
  g.translate(m, m);
  g.fillStyle = '#FFFDF6'; g.fillRect(0, 0, w, h);
  g.save(); g.beginPath(); g.rect(16, 16, w - 32, h - 32); g.clip(); paint(g, w, h); g.restore();
  g.globalCompositeOperation = 'destination-out'; // perforations
  for (let x = 0; x <= w; x += 21) { g.beginPath(); g.arc(x, 0, 7, 0, TAU); g.arc(x, h, 7, 0, TAU); g.fill(); }
  for (let y = 0; y <= h; y += 21.6) { g.beginPath(); g.arc(0, y, 7, 0, TAU); g.arc(w, y, 7, 0, TAU); g.fill(); }
  g.globalCompositeOperation = 'source-over';
  if (mark) { // a postmark: ring with town and date, and wavy cancel lines
    g.strokeStyle = 'rgba(30, 30, 50, 0.6)'; g.lineWidth = 4;
    g.beginPath(); g.arc(w - 10, 60, 74, 0, TAU); g.stroke(); g.beginPath(); g.arc(w - 10, 60, 50, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(30, 30, 50, 0.6)'; g.font = `700 22px ${FONT.sans}`; g.textAlign = 'center'; g.fillText('PARIS', w - 10, 54); g.fillText('12·06·98', w - 10, 80);
    for (let k = 0; k < 4; k++) { g.beginPath(); for (let x = -60; x < 140; x += 6) g.lineTo(x, 150 + k * 22 + 8 * Math.sin(x / 14)); g.stroke(); }
  }
  return c;
}

function washi(w, color, pattern, seed) {
  const h = 70, c = canvas(w, h), g = c.getContext('2d'), r = rng(seed);
  g.beginPath(); g.moveTo(0, 0);
  for (let x = 0; x <= w; x += 10) g.lineTo(x, 0);
  for (let y = 0; y <= h; y += 7) g.lineTo(w - (y / 7 % 2 ? 8 : 0) - r() * 3, y);
  for (let x = w; x >= 0; x -= 10) g.lineTo(x, h);
  for (let y = h; y >= 0; y -= 7) g.lineTo((y / 7 % 2 ? 8 : 0) + r() * 3, y);
  g.closePath(); g.fillStyle = color; g.fill();
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = pattern;
  for (let x = -h; x < w; x += 26) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 12, h); g.lineTo(x + 12 + h, 0); g.lineTo(x + h, 0); g.fill(); }
  return c;
}

function ticket() {
  const w = 360, h = 160, c = canvas(w, h), g = c.getContext('2d');
  g.fillStyle = '#E4573D'; g.beginPath(); g.roundRect(0, 0, w, h, 10); g.fill();
  g.globalCompositeOperation = 'destination-out';
  for (const x of [0, w]) { g.beginPath(); g.arc(x, h / 2, 18, 0, TAU); g.fill(); }
  g.globalCompositeOperation = 'source-over';
  g.strokeStyle = '#FFE9C9'; g.lineWidth = 3; g.setLineDash([8, 7]); g.beginPath(); g.moveTo(270, 12); g.lineTo(270, h - 12); g.stroke(); g.setLineDash([]);
  g.strokeRect(14, 14, 242, h - 28);
  g.fillStyle = '#FFE9C9'; g.font = `700 38px ${'"Copperplate", serif'}`; g.textAlign = 'center'; g.fillText('ADMIT ONE', 135, 92);
  g.font = `400 20px ${FONT.mono}`; g.fillText('No 004217', 135, 124);
  g.save(); g.translate(315, h / 2); g.rotate(-Math.PI / 2); g.font = `700 24px ${FONT.mono}`; g.fillText('ROW F', 0, 8); g.restore();
  return c;
}

function letter(ch, font, bg, fg, seed) { // a ransom-note letter cut from a magazine
  const r = rng(seed), size = 132, c = canvas(170, 190), g = c.getContext('2d');
  g.translate(85, 95);
  g.beginPath(); for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; g.lineTo((62 + r() * 16) * Math.sign(Math.cos(a)), (74 + r() * 14) * Math.sign(Math.sin(a))); } g.closePath();
  g.fillStyle = bg; g.fill();
  g.fillStyle = fg; g.font = `${font.weight} ${size}px ${font.family}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(ch, 0, 8);
  return c;
}

export default {
  name: 'Collage',
  ko: '콜라주',
  setup(_, W, H) {
    kraft = canvas(W, H); // the kraft page: soft mottling and a darker rim, no fine detail
    let g = kraft.getContext('2d');
    g.fillStyle = '#CDB28A'; g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 8) for (let x = 0; x < W; x += 8) { const v = fbm3(x / 420, y / 420, 4, 2); g.fillStyle = `rgba(${v > 0 ? '255, 245, 225' : '90, 60, 30'}, ${Math.abs(v) * 0.22})`; g.fillRect(x, y, 8, 8); }
    const rim = g.createRadialGradient(W / 2, H / 2, 600, W / 2, H / 2, 1200); rim.addColorStop(0, 'rgba(80, 50, 20, 0)'); rim.addColorStop(1, 'rgba(80, 50, 20, 0.3)');
    g.fillStyle = rim; g.fillRect(0, 0, W, H);
    fibres = canvas(W, H); // paper fibres, fixed to the screen and laid over everything
    g = fibres.getContext('2d');
    const r = rng(31);
    for (let i = 0; i < 9000; i++) { const x = r() * W, y = r() * H, a = r() * TAU, l = 3 + r() * 14; g.strokeStyle = r() < 0.5 ? 'rgba(90, 60, 30, 0.10)' : 'rgba(255, 245, 225, 0.14)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l * Math.cos(a), y + l * Math.sin(a)); g.stroke(); }

    const news = torn(420, 540, 3, [1, 1, 1, 1], (c, w, h) => {
      c.fillStyle = '#ECE6D8'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#222'; c.font = `700 52px ${FONT.serif}`; c.fillText('The Morning', 24, 66);
      c.fillRect(24, 84, w - 48, 4);
      const q = rng(8); c.fillStyle = '#6a6660';
      for (let y = 120; y < h; y += 17) { c.fillRect(24, y, 170 - (q() < 0.15 ? 60 : 0), 7); if (y > 300) c.fillRect(214, y, 170 - (q() < 0.15 ? 50 : 0), 7); }
      c.fillStyle = '#9a958c'; c.fillRect(214, 120, 182, 160);
    });
    const photo = torn(560, 700, 5, [1, 0, 1, 1], (c, w, h) => landscape(c, w, h, 0));
    const letters = [['C', { weight: 700, family: FONT.serif }, '#1E2B4F', '#F4E7C8'], ['O', { weight: 700, family: FONT.display }, '#F2C230', '#1A1A1A'],
      ['L', { weight: 400, family: '"Impact", sans-serif' }, '#F7F3EA', '#D2232A'], ['L', { weight: 400, family: '"Rockwell", serif' }, '#E86A92', '#FFF6F0'],
      ['A', { weight: 700, family: '"Bodoni 72", serif' }, '#1A1A1A', '#FFFFFF'], ['G', { weight: 900, family: FONT.black }, '#5BB7A6', '#14322C'],
      ['E', { weight: 400, family: '"American Typewriter", serif' }, '#FBE2C0', '#C0392B']].map(([ch, f, bg, fg], i) => letter(ch, f, bg, fg, 50 + i));
    const sky = (c, w, h) => { c.fillStyle = '#7FB3D9'; c.fillRect(0, 0, w, h); c.fillStyle = '#F6C445'; c.beginPath(); c.arc(140, 80, 30, 0, TAU); c.fill(); c.fillStyle = '#4E9A5A'; c.beginPath(); c.ellipse(70, 230, 140, 90, 0, 0, TAU); c.fill(); c.fillStyle = '#2E6E45'; c.beginPath(); c.ellipse(190, 250, 110, 70, 0, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.font = `700 40px ${FONT.sans}`; c.fillText('25', 26, 60); };
    const bird = (c, w, h) => { c.fillStyle = '#C8402E'; c.fillRect(0, 0, w, h); c.fillStyle = '#FDF1DE'; c.beginPath(); c.ellipse(105, 140, 52, 26, -0.3, 0, TAU); c.fill(); c.beginPath(); c.moveTo(90, 130); c.lineTo(150, 60); c.lineTo(130, 140); c.fill(); c.font = `700 22px ${FONT.sans}`; c.fillText('AIR MAIL', 52, 220); };

    // image, final x, y, rotation, toss-in time, flight direction (angle), spin
    pieces = [
      [news, 790, 1150, 0.06, 0.0, 0.3, 0.9],
      [photo, 360, 770, -0.07, 0.2, Math.PI + 0.4, -0.7],
      [polaroid(), 790, 640, 0.12, 0.4, -0.5, 0.8],
      [ticket(), 330, 1240, 0.28, 0.55, Math.PI - 0.3, -1.0],
      [stamp(1, sky, false), 180, 1450, -0.16, 0.7, Math.PI + 0.2, 0.9],
      [stamp(2, bird, true), 880, 1520, 0.1, 0.82, 0.1, -0.8],
      [washi(240, 'rgba(244, 170, 190, 0.78)', 'rgba(255, 255, 255, 0.5)', 1), 150, 430, -0.7, 0.94, Math.PI + 1.2, 1.2],
      [washi(220, 'rgba(150, 214, 200, 0.78)', 'rgba(255, 255, 255, 0.45)', 2), 790, 410, 0.15, 1.06, -1.3, -1.1],
      [washi(260, 'rgba(250, 214, 120, 0.8)', 'rgba(230, 140, 60, 0.35)', 3), 600, 1120, -0.5, 1.18, 0.8, 0.9],
      ...letters.map((img, i) => [img, 132 + i * 136, 1720 + (i % 2 ? -14 : 12), [-0.12, 0.1, -0.05, 0.14, -0.1, 0.06, -0.14][i], 1.3 + i * 0.1, Math.PI / 2 + (i - 3) * 0.2, (i % 2 ? 1 : -1) * 0.9]),
    ];
  },
  draw(ctx, time, W, H) {
    const t = (time + SHIFT) % 5, a = time / 5 * TAU;
    ctx.drawImage(kraft, 0, 0);
    pieces.forEach(([img, x, y, rot, at, dir, spin], i) => {
      // each scrap lives on its own 5 s cycle: tossed in at `at` (0.6 s), lying still but for a gentle shift, then
      // swept off to the left (0.7 s) in reverse order, from 3.35 s for the last one to 4.7 s for the first. That
      // sweep can run past its next toss-in, so an old copy may still be leaving while the new one arrives.
      const leave = 3.35 + (1.9 - at) * 0.75 - at, age0 = ((t - at) % 5 + 5) % 5;
      for (const age of [age0 + 5, age0]) {
        if (age > leave + 0.7) continue;
        const k = span(age, 0, 0.6), fly = (1 - k) ** 2; // tossed in, slowing to a stop
        const out = span(age, leave, leave + 0.7) ** 2; // swept away, speeding up
        const drift = [4 * Math.sin(a + i * 1.3), 4 * Math.cos(a + i * 0.9), 0.012 * Math.sin(a + i * 0.7)]; // the gentle shift
        ctx.save();
        ctx.translate(x + Math.cos(dir) * 900 * fly - 1400 * out + drift[0], y + Math.sin(dir) * 900 * fly + drift[1]);
        ctx.rotate(rot + 0.45 * spin * fly - 0.1 * out + drift[2]);
        const lift = 4 + 30 * Math.max(fly, out);
        ctx.shadowColor = 'rgba(40, 25, 5, 0.35)'; ctx.shadowBlur = 4 + lift; ctx.shadowOffsetX = lift * 0.6; ctx.shadowOffsetY = lift;
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        ctx.restore();
      }
    });
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(fibres, 0, 0); ctx.restore();
  },
};
