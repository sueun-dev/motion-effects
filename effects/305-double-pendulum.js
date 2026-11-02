// Double pendulum: nine pendulums (two equal rods, equal masses) hang from one pivot and are let go from the same
// pose, the lower rod of each 0.001 rad further round than the last. The equations of motion are integrated once in
// setup (RK4, fixed step) and played back by t. For a second they swing as one; the tiny difference doubles and
// doubles until they fan apart and each traces its own chaotic path, drawn as a glowing trail. A log-scale plot below
// shows the spread growing. In the last 0.8 s every pendulum glides back to the start pose (a cubic that keeps its
// speed at the start of the glide and ends at rest); the video starts 1.6 s after the release, so the loop seam
// falls mid-swing.
import { TAU, clamp, span, ease, FONT } from '../lib/util.js';

const N = 9, A1 = 2.2, A2 = 2.6, D0 = 1e-3;   // start angles (rad from straight down), spread of the lower rod
const G = 9.81, SPEED = 1.6, RATE = 240;       // gravity (rods 1 m), simulated seconds per video second, samples/s
const GLIDE = 4.2, TRAIL = 0.55, START = 1.6;  // glide back from 4.2 s, trail length (s), video offset (s)
const PX = 540, PY = 820, L = 205;             // pivot and rod length on screen (px)
let ang;                                       // ang[i]: Float64Array of [a1, a2, w1, w2] per sample, 0 .. GLIDE s

function deriv([a1, a2, w1, w2]) {             // equal masses and lengths
  const d = a1 - a2, den = 3 - Math.cos(2 * d);
  return [w1, w2,
    (-3 * G * Math.sin(a1) - G * Math.sin(a1 - 2 * a2) - 2 * Math.sin(d) * (w2 * w2 + w1 * w1 * Math.cos(d))) / den,
    (2 * Math.sin(d) * (2 * w1 * w1 + 2 * G * Math.cos(a1) + w2 * w2 * Math.cos(d))) / den];
}
function rk4(s, h) {
  const add = (a, k, f) => a.map((v, i) => v + f * k[i]);
  const k1 = deriv(s), k2 = deriv(add(s, k1, h / 2)), k3 = deriv(add(s, k2, h / 2)), k4 = deriv(add(s, k3, h));
  return s.map((v, i) => v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

function simulate() {
  const SAMPLES = Math.round(GLIDE * RATE), STEPS = 40, h = SPEED / RATE / STEPS;
  ang = [];
  for (let i = 0; i < N; i++) {
    let s = [A1, A2 + i * D0, 0, 0];
    const out = new Float64Array((SAMPLES + 1) * 4);
    for (let k = 0; k <= SAMPLES; k++) {
      out.set(s, k * 4);
      for (let j = 0; j < STEPS; j++) s = rk4(s, h);
    }
    ang.push(out);
  }
}

// the two angles of pendulum i at time t (any t; it loops every 5 s)
function pose(i, t) {
  t = ((t % 5) + 5) % 5;
  const a = ang[i];
  if (t < GLIDE) {
    const f = t * RATE, k = Math.floor(f), u = f - k;
    return [a[k * 4] + (a[k * 4 + 4] - a[k * 4]) * u, a[k * 4 + 1] + (a[k * 4 + 5] - a[k * 4 + 1]) * u];
  }
  // cubic Hermite from the state at GLIDE (angle, angular speed in rad per video second) to the start pose at rest,
  // taking the nearest whole-turn copy of the start so no rod spins back round
  const e = Math.round(GLIDE * RATE) * 4, T = 5 - GLIDE, u = (t - GLIDE) / T;
  const h00 = 2 * u ** 3 - 3 * u * u + 1, h10 = u ** 3 - 2 * u * u + u, h01 = -2 * u ** 3 + 3 * u * u;
  const out = [];
  for (const [j, start] of [[0, A1], [1, A2 + i * D0]]) {
    const p0 = a[e + j], v0 = a[e + 2 + j] * SPEED * T, p1 = start + TAU * Math.round((p0 - start) / TAU);
    out.push(h00 * p0 + h10 * v0 + h01 * p1);
  }
  return out;
}
const joints = (a1, a2) => {
  const x1 = PX + L * Math.sin(a1), y1 = PY + L * Math.cos(a1);
  return [x1, y1, x1 + L * Math.sin(a2), y1 + L * Math.cos(a2)];
};
const hue = i => 188 + (i / (N - 1)) * 140;   // cyan .. magenta

// spread of the nine pendulums at time t: the largest angle difference from the first one (rad)
function spread(t) {
  const [b1, b2] = pose(0, t);
  let m = D0 * (N - 1);
  for (let i = 1; i < N; i++) { const [a1, a2] = pose(i, t); m = Math.max(m, Math.abs(a1 - b1) + Math.abs(a2 - b2)); }
  return m;
}

export default {
  name: 'Double Pendulum',
  ko: '이중 진자',
  setup() { simulate(); },
  draw(ctx, time, W, H) {
    const t = (time + START) % 5;                // the video starts mid-swing, so the loop seam is in motion
    const bg = ctx.createRadialGradient(PX, PY, 40, PX, PY, 1250);
    bg.addColorStop(0, '#18203E'); bg.addColorStop(0.55, '#0D1228'); bg.addColorStop(1, '#070915');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // reach circle with a degree scale
    ctx.strokeStyle = 'rgba(150, 170, 255, 0.16)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(PX, PY, 2 * L + 24, 0, TAU); ctx.stroke();
    for (let k = 0; k < 72; k++) {
      const a = (k / 72) * TAU, r0 = 2 * L + 24, r1 = r0 + (k % 6 ? 8 : 18);
      ctx.beginPath(); ctx.moveTo(PX + r0 * Math.cos(a), PY + r0 * Math.sin(a)); ctx.lineTo(PX + r1 * Math.cos(a), PY + r1 * Math.sin(a)); ctx.stroke();
    }

    // trails of the lower bobs: the last TRAIL seconds, fading out behind
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'butt';
    const STEP = 1 / 240, K = Math.round(TRAIL / STEP);
    for (let i = 0; i < N; i++) {
      const pts = [];
      for (let k = 0; k <= K; k++) { const [a1, a2] = pose(i, t - k * STEP); const j = joints(a1, a2); pts.push(j[2], j[3]); }
      for (const [w, a] of [[14, 0.05], [4.5, 0.5]]) {
        ctx.lineWidth = w;
        for (let k = 0; k < K; k++) {             // one short segment each, butt ends, so nothing doubles up
          const f = 1 - k / K;
          ctx.strokeStyle = `hsla(${hue(i)}, 95%, 62%, ${a * f * f})`;
          ctx.beginPath(); ctx.moveTo(pts[k * 2], pts[k * 2 + 1]); ctx.lineTo(pts[k * 2 + 2], pts[k * 2 + 3]); ctx.stroke();
        }
      }
    }
    ctx.globalCompositeOperation = 'source-over';

    // rods and bobs, back to front
    for (let i = N - 1; i >= 0; i--) {
      const [a1, a2] = pose(i, t), [x1, y1, x2, y2] = joints(a1, a2);
      ctx.strokeStyle = `hsla(${hue(i)}, 70%, 78%, 0.75)`; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(PX, PY); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      for (const [x, y, r] of [[x1, y1, 9], [x2, y2, 13]]) {
        const gr = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
        gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(0.45, `hsl(${hue(i)}, 95%, 66%)`); gr.addColorStop(1, `hsl(${hue(i)}, 80%, 40%)`);
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      }
    }
    // the pivot
    ctx.fillStyle = '#D9DEF2'; ctx.beginPath(); ctx.arc(PX, PY, 11, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2A3150'; ctx.beginPath(); ctx.arc(PX, PY, 4.5, 0, TAU); ctx.fill();

    // the spread on a log scale: 0.008 rad .. 2 pi, against time; it draws on, then wipes away during the glide
    const gx = 150, gy = 1420, gw = 780, gh = 250, lo = Math.log10(0.004), hi = Math.log10(TAU);
    const X = s => gx + (s / GLIDE) * gw, Y = v => gy + gh - ((Math.log10(clamp(v, 0.004, TAU)) - lo) / (hi - lo)) * gh;
    ctx.strokeStyle = 'rgba(170, 185, 255, 0.22)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy + gh); ctx.lineTo(gx + gw, gy + gh); ctx.stroke();
    ctx.font = `500 24px ${FONT.sans}`; ctx.fillStyle = 'rgba(205, 212, 255, 0.6)';
    ctx.textAlign = 'right';
    for (const [v, s] of [[0.01, '0.01'], [0.1, '0.1'], [1, '1'], [TAU, '2π']]) {
      ctx.fillText(s, gx - 14, Y(v) + 8);
      ctx.fillStyle = 'rgba(170, 185, 255, 0.10)'; ctx.fillRect(gx, Y(v) - 1, gw, 2); ctx.fillStyle = 'rgba(205, 212, 255, 0.6)';
    }
    ctx.textAlign = 'left';
    ctx.fillText('0 s', gx - 8, gy + gh + 36);
    ctx.textAlign = 'right'; ctx.fillText(`${GLIDE} s`, gx + gw + 8, gy + gh + 36);
    ctx.textAlign = 'left';
    ctx.font = `700 30px ${FONT.sans}`; ctx.fillStyle = '#FFFFFF';
    ctx.fillText('Spread between the nine', gx, gy - 58);
    ctx.font = `500 25px ${FONT.sans}`; ctx.fillStyle = 'rgba(205, 212, 255, 0.72)';
    ctx.fillText('started 0.001 rad apart · log scale (rad)', gx, gy - 22);

    const wipe = span(t, GLIDE, 4.95), end = Math.min(t, GLIDE), from = ease.inOut(wipe) * GLIDE;
    if (end > from) {
      ctx.strokeStyle = '#FF7AD9'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let s = from; s <= end + 1e-9; s += 1 / 60) ctx.lineTo(X(s), Y(spread(Math.min(s, end))));
      ctx.lineTo(X(end), Y(spread(end)));
      ctx.stroke();
      if (t < GLIDE) {
        ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(X(end), Y(spread(end)), 8, 0, TAU); ctx.fill();
      }
    }
  },
};
