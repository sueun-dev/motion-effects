// Lip sync: a phoneme track ("Hello there, watch my mouth. Very fun!") drives a cartoon face. Each phoneme maps to
// one of ten mouth shapes (visemes, after Preston Blair: rest, M B P, A I, E, O, U, F V, L TH, W Q and the other
// consonants), and each viseme is a set of seven mouth controls: jaw open, width, rounding, teeth, tongue, lower lip
// tucked, lips pressed. Neighbouring phonemes overlap (coarticulation): every phoneme's influence is a bell around its
// centre a little wider than the phoneme, the weights are normalised, and the controls are their weighted mix, so
// the mouth flows from shape to shape and starts forming the next sound early. The video is silent, so the track
// is shown: words, phonemes coloured by viseme and the loudness envelope, sliding under a fixed playhead; the
// chart above lights each viseme by its weight. The sentence ends in a pause, so the loop closes at rest.
import { TAU, FONT } from '../lib/util.js';

// [label, jaw open, width, rounding, teeth, tongue, lower lip tucked, pressed]
const VIS = [
  ['rest', 0.04, 0.5, 0, 0, 0, 0, 0.25], ['M B P', 0, 0.44, 0.1, 0, 0, 0, 1], ['A I', 0.9, 0.78, 0, 0.55, 0.15, 0, 0],
  ['E', 0.42, 1, 0, 0.9, 0.1, 0, 0], ['O', 0.72, 0.4, 0.8, 0.2, 0, 0, 0], ['U', 0.32, 0.25, 1, 0, 0, 0, 0],
  ['F V', 0.14, 0.62, 0, 1, 0, 1, 0], ['L TH', 0.48, 0.62, 0, 0.7, 1, 0, 0], ['W Q', 0.22, 0.16, 1, 0, 0, 0, 0.2], ['etc', 0.32, 0.68, 0, 0.85, 0.3, 0, 0],
];
const HUE = ['#9AA3B5', '#F2668B', '#FFB347', '#FFD966', '#7BD389', '#4FC3F7', '#B39DDB', '#FF8A65', '#4DB6AC', '#E0E0E0'];
// [phoneme, viseme, start, end] and the words: [word, start, end]
const PH = [['HH', 9, 0.2, 0.28], ['AH', 2, 0.28, 0.4], ['L', 7, 0.4, 0.5], ['OW', 4, 0.5, 0.75], ['DH', 7, 0.85, 0.95], ['EH', 3, 0.95, 1.1],
  ['R', 9, 1.1, 1.25], ['W', 8, 1.45, 1.57], ['AA', 2, 1.57, 1.72], ['CH', 9, 1.72, 1.85], ['M', 1, 1.85, 1.95], ['AY', 2, 1.95, 2.15],
  ['M', 1, 2.15, 2.25], ['AW', 5, 2.25, 2.5], ['TH', 7, 2.5, 2.65], ['V', 6, 3.0, 3.1], ['EH', 3, 3.1, 3.22], ['R', 9, 3.22, 3.3],
  ['IY', 3, 3.3, 3.42], ['F', 6, 3.42, 3.54], ['AH', 2, 3.54, 3.7], ['N', 9, 3.7, 3.86]];
const WORDS = [['Hello', 0.2, 0.75], ['there,', 0.85, 1.25], ['watch', 1.45, 1.85], ['my', 1.85, 2.15], ['mouth.', 2.15, 2.65], ['Very', 3.0, 3.42], ['fun!', 3.42, 3.86]];
const LOUD = { AH: 1, OW: 0.95, EH: 0.85, AA: 1, AY: 0.95, AW: 0.9, IY: 0.75, L: 0.55, R: 0.5, W: 0.5, M: 0.45, N: 0.45, HH: 0.3, DH: 0.35, TH: 0.3, CH: 0.4, V: 0.35, F: 0.3 };

// viseme weights at time t (periodic over 5 s): a bell per phoneme, plus rest wherever nothing is spoken
function weights(t) {
  const w = new Array(VIS.length).fill(0);
  for (const [, v, a, b] of PH) {
    let d = t - (a + b) / 2;
    d -= 5 * Math.round(d / 5);
    const s = (b - a) * 0.55 + 0.035;
    w[v] += Math.exp(-((d / s) ** 2));
  }
  const spoken = w.reduce((x, y) => x + y, 0);
  w[0] += Math.max(0, 1 - spoken) ** 2 * 1.2;
  const sum = w.reduce((x, y) => x + y, 0);
  return w.map(x => x / sum);
}
const controls = w => VIS[0].slice(1).map((_, c) => w.reduce((sum, wi, i) => sum + wi * VIS[i][c + 1], 0));
// loudness at time s: each phoneme's level, smoothed (periodic)
function loud(s) {
  let a = 0;
  for (const [p, , x0, x1] of PH) {
    let d = s - (x0 + x1) / 2;
    d -= 5 * Math.round(d / 5);
    a += LOUD[p] * Math.exp(-((d / ((x1 - x0) * 0.6 + 0.02)) ** 2));
  }
  return 1 - Math.exp(-1.6 * a);
}

// the mouth at (cx, cy), scale k, from the seven controls
function mouth(g, cx, cy, k, [open, width, round, teeth, tongue, tuck, press]) {
  const hw = k * (48 + 52 * width) * (1 - 0.35 * round), oh = k * (4 + 96 * open) * (1 - 0.15 * round);
  const lip = k * (13 - 6 * press), rr = round * hw * 0.55;         // rounding pulls the corners in
  const top = cy - oh * 0.42, bot = cy + oh * 0.58 - tuck * k * 10;
  g.save();
  // lips (outer shape)
  g.fillStyle = '#C8505C';
  g.beginPath();
  g.moveTo(cx - hw, cy);
  g.bezierCurveTo(cx - hw + rr, top - lip * 1.3, cx - hw * 0.25, top - lip * 1.6, cx, top - lip * 1.05);
  g.bezierCurveTo(cx + hw * 0.25, top - lip * 1.6, cx + hw - rr, top - lip * 1.3, cx + hw, cy);
  g.bezierCurveTo(cx + hw - rr, bot + lip * 1.6, cx - hw + rr, bot + lip * 1.6, cx - hw, cy);
  g.fill();
  // the opening, with teeth and tongue inside it
  const inner = new Path2D();
  inner.moveTo(cx - hw * 0.86, cy);
  inner.bezierCurveTo(cx - hw * 0.5 + rr * 0.6, top - k * 2, cx + hw * 0.5 - rr * 0.6, top - k * 2, cx + hw * 0.86, cy);
  inner.bezierCurveTo(cx + hw * 0.5 - rr * 0.6, bot + k * 2, cx - hw * 0.5 + rr * 0.6, bot + k * 2, cx - hw * 0.86, cy);
  if (oh > k * 6) {
    g.fillStyle = '#4A1D2A'; g.fill(inner);
    g.save(); g.clip(inner);
    g.fillStyle = '#E8667A';                                         // tongue: low, or its tip up behind the teeth
    g.beginPath(); g.ellipse(cx, bot - k * 4 - tongue * oh * 0.45, hw * 0.5, k * 16 + tongue * oh * 0.25, 0, 0, TAU); g.fill();
    g.fillStyle = '#FBF7F2';                                         // upper teeth
    g.fillRect(cx - hw, top - k * 4, 2 * hw, k * 4 + teeth * k * 15);
    g.fillRect(cx - hw, bot - teeth * k * 6, 2 * hw, k * 8);         // lower teeth
    g.restore();
  } else {
    g.strokeStyle = '#7A2C3A'; g.lineWidth = k * (3 + 2 * press); g.lineCap = 'round';  // closed: the line between the lips
    g.beginPath(); g.moveTo(cx - hw * 0.9, cy); g.quadraticCurveTo(cx, cy + k * (2 - 3 * press), cx + hw * 0.9, cy); g.stroke();
  }
  if (tuck > 0.05) {                                                  // F/V: upper teeth rest on the tucked lower lip
    g.globalAlpha = Math.min(1, tuck * 1.5);
    g.fillStyle = '#FBF7F2'; g.beginPath(); g.roundRect(cx - hw * 0.55, cy - k * 4, hw * 1.1, k * 12, k * 3); g.fill();
    g.globalAlpha = 1;
  }
  g.restore();
}

export default {
  name: 'Lip Sync',
  ko: '립싱크',
  draw(g, t, W, H) {
    const w = weights(t), c = controls(w), open = c[0];
    // background: warm studio wall and a soft disc behind the head
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#2E3550'); bg.addColorStop(1, '#1B1F30');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const halo = g.createRadialGradient(540, 760, 60, 540, 760, 520);
    halo.addColorStop(0, 'rgba(255, 196, 140, 0.35)'); halo.addColorStop(1, 'rgba(255, 196, 140, 0)');
    g.fillStyle = halo; g.fillRect(0, 200, W, 1100);

    // the face: head, jaw that drops with the mouth, hair, ears, eyes, brows, nose
    g.save(); g.translate(540, 640); g.scale(1.15, 1.15); g.translate(-540, -700);
    const bob = 6 * Math.sin((TAU * 2 * t) / 5), hx = 540, hy = 700 + bob, jaw = 34 * open;
    g.fillStyle = '#E3AE86'; g.fillRect(480, 930 + bob, 120, 120);                                          // neck
    const sy = 1030 + bob * 0.5;                                                                            // shoulders and collar
    g.fillStyle = '#3E7C8C'; g.beginPath(); g.moveTo(250, 1230); g.bezierCurveTo(260, sy + 20, 330, sy, 470, sy - 10);
    g.lineTo(540, sy + 60); g.lineTo(610, sy - 10); g.bezierCurveTo(750, sy, 820, sy + 20, 830, 1230); g.fill();
    g.fillStyle = '#F4EFE6'; g.beginPath(); g.moveTo(462, sy - 14); g.lineTo(540, sy + 62); g.lineTo(500, sy + 80); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(618, sy - 14); g.lineTo(540, sy + 62); g.lineTo(580, sy + 80); g.closePath(); g.fill();
    g.fillStyle = '#F2C29B';
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(hx + s * 222, hy + 30, 36, 56, 0, 0, TAU); g.fill(); }  // ears
    g.beginPath();
    g.moveTo(hx - 220, hy);
    g.bezierCurveTo(hx - 225, hy - 330, hx + 225, hy - 330, hx + 220, hy);
    g.bezierCurveTo(hx + 215, hy + 150, hx + 150, hy + 255 + jaw, hx, hy + 268 + jaw);
    g.bezierCurveTo(hx - 150, hy + 255 + jaw, hx - 215, hy + 150, hx - 220, hy);
    g.fill();
    g.fillStyle = 'rgba(240, 120, 110, 0.28)';
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(hx + s * 135, hy + 95, 48, 30, 0, 0, TAU); g.fill(); } // cheeks
    g.fillStyle = '#3B2A2A';                                                                                // hair
    g.beginPath();
    g.moveTo(hx - 232, hy - 10);
    g.bezierCurveTo(hx - 260, hy - 330, hx + 260, hy - 330, hx + 232, hy - 10);
    g.bezierCurveTo(hx + 210, hy - 150, hx + 120, hy - 190, hx + 10, hy - 150);
    g.bezierCurveTo(hx - 80, hy - 200, hx - 190, hy - 160, hx - 232, hy - 10);
    g.fill();
    const lift = 10 * (Math.exp(-(((t - 0.45) / 0.25) ** 2)) + Math.exp(-(((t - 3.6) / 0.25) ** 2)));          // brows rise on the stressed words
    for (const s of [-1, 1]) {
      const ex = hx + s * 95, ey = hy - 20;
      const look = 6 * Math.sin((TAU * t) / 5);                      // the eyes drift a little, once round per loop
      g.fillStyle = '#FFFFFF'; g.beginPath(); g.ellipse(ex, ey, 40, 46, 0, 0, TAU); g.fill();
      g.fillStyle = '#2B1E1A'; g.beginPath(); g.ellipse(ex + 4 + look, ey + 6, 21, 24, 0, 0, TAU); g.fill();
      g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(ex + 11 + look, ey - 3, 6, 0, TAU); g.fill();
      g.strokeStyle = '#3B2A2A'; g.lineWidth = 12; g.lineCap = 'round';
      g.beginPath(); g.moveTo(ex - 36, ey - 72 - lift); g.quadraticCurveTo(ex, ey - 90 - lift, ex + 36, ey - 76 - lift); g.stroke();
    }
    g.strokeStyle = '#D9946A'; g.lineWidth = 8;
    g.beginPath(); g.moveTo(hx - 6, hy + 30); g.quadraticCurveTo(hx - 26, hy + 90, hx + 4, hy + 96); g.stroke();             // nose
    mouth(g, hx, hy + 168 + jaw * 0.55, 1.25, c);
    g.restore();

    // the viseme chart: ten mouth shapes, each lit by its weight now
    g.fillStyle = 'rgba(255, 255, 255, 0.06)';
    g.beginPath(); g.roundRect(40, 1250, 1000, 250, 26); g.fill();
    VIS.forEach((v, i) => {
      const x = 64 + (i % 5) * 194, y = i < 5 ? 1305 : 1425, lit = Math.min(1, w[i] * 1.6);
      g.fillStyle = `rgba(255, 255, 255, ${0.05 + 0.25 * lit})`;
      g.beginPath(); g.roundRect(x, y - 46, 182, 100, 18); g.fill();
      g.strokeStyle = HUE[i]; g.globalAlpha = 0.25 + 0.75 * lit; g.lineWidth = 3; g.stroke(); g.globalAlpha = 1;
      mouth(g, x + 56, y + 2, 0.42, v.slice(1));
      g.font = `700 24px ${FONT.sans}`; g.fillStyle = HUE[i]; g.textAlign = 'left'; g.fillText(v[0], x + 104, y + 12);
    });

    // the track: words, phonemes and loudness slide under a fixed playhead (320 px a second; the loop is 1600 px)
    const PX = 320, x0 = 540, top = 1540;
    g.fillStyle = 'rgba(8, 10, 18, 0.7)'; g.beginPath(); g.roundRect(40, top, 1000, 340, 26); g.fill();
    g.save(); g.beginPath(); g.roundRect(40, top, 1000, 340, 26); g.clip();
    for (const rep of [-1, 0, 1]) {
      const X = s => x0 + (s - t + 5 * rep) * PX;
      if (X(5) < 0 || X(0) > W) continue;
      g.font = `700 30px ${FONT.sans}`; g.fillStyle = 'rgba(255, 255, 255, 0.9)'; g.textAlign = 'center';
      for (const [word, a, b] of WORDS) g.fillText(word, X((a + b) / 2), top + 52);
      for (const [p, v, a, b] of PH) {
        g.fillStyle = HUE[v]; g.globalAlpha = 0.85;
        g.beginPath(); g.roundRect(X(a) + 1.5, top + 74, (b - a) * PX - 3, 46, 8); g.fill();
        g.globalAlpha = 1; g.fillStyle = '#141824'; g.font = `700 18px ${FONT.mono}`; g.fillText(p, X((a + b) / 2), top + 104);
      }
      // loudness envelope, mirrored
      g.fillStyle = 'rgba(126, 200, 255, 0.55)'; g.beginPath();
      for (let s = 0; s <= 5; s += 0.01) g.lineTo(X(s), top + 230 - 78 * loud(s));
      for (let s = 5; s >= 0; s -= 0.01) g.lineTo(X(s), top + 230 + 78 * loud(s));
      g.fill();
    }
    g.restore();
    g.fillStyle = '#FFFFFF'; g.fillRect(x0 - 2, top + 10, 4, 320);
    g.beginPath(); g.moveTo(x0 - 12, top + 2); g.lineTo(x0 + 12, top + 2); g.lineTo(x0, top + 18); g.fill();
  },
};
