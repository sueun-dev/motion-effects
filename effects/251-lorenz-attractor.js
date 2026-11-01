// Lorenz attractor: dx/dt = σ(y − x), dy/dt = x(ρ − z) − y, dz/dt = xy − βz with σ = 10, ρ = 28, β = 8/3,
// integrated once in setup with RK4 (step 0.004). A long orbit and its mirror image (x, y) -> (−x, −y), which
// is also an orbit, are drawn as a soft blurred haze (the butterfly); 240 glowing particles ride stretches of the orbit
// with fading tails, each living 2.5 s. The camera turns 180° round the vertical axis in 5 s, and the system
// is symmetric under that half turn, so the last frame meets the first: particles in their next pair of lives
// ride the mirror images of their first two.
import { TAU, rng, clamp, canvas, FONT } from '../lib/util.js';

const SIGMA = 10, RHO = 28, BETA = 8 / 3, DT = 0.004;
const COMETS = 240, LIFE = 2.5, SPEED = 0.08, TAIL = 0.09;   // seconds per life, orbit time per second, tail length
const CX = 540, CY = 940, FOCAL = 1750, DIST = 105, TILT = 0.2;
let orbit, starts, sprite, haze;                     // orbit: flat x, y, z; haze: half-size canvas for the glow

function integrate(n) {
  const f = (x, y, z) => [SIGMA * (y - x), x * (RHO - z) - y, x * y - BETA * z];
  const out = new Float32Array(n * 3);
  let x = 1, y = 1, z = 20;
  for (let i = -2000; i < n; i++) {                  // 2000 steps of burn-in land it on the attractor
    const a = f(x, y, z), b = f(x + a[0] * DT / 2, y + a[1] * DT / 2, z + a[2] * DT / 2);
    const c = f(x + b[0] * DT / 2, y + b[1] * DT / 2, z + b[2] * DT / 2), d = f(x + c[0] * DT, y + c[1] * DT, z + c[2] * DT);
    x += DT / 6 * (a[0] + 2 * b[0] + 2 * c[0] + d[0]);
    y += DT / 6 * (a[1] + 2 * b[1] + 2 * c[1] + d[1]);
    z += DT / 6 * (a[2] + 2 * b[2] + 2 * c[2] + d[2]);
    if (i >= 0) out.set([x, y, z], i * 3);
  }
  return out;
}

// colour by height z (the same on both wings, so it survives the mirror): violet low, rose, amber high
const COLORS = ['#5B3BD6', '#8A44E0', '#C24FD2', '#EE5FA8', '#FF7F7F', '#FFA46B', '#FFC873', '#FFE6A8'];
const band = z => clamp(Math.floor((z - 6) / 38 * 8), 0, 7);

export default {
  name: 'Lorenz Attractor',
  ko: '로렌츠 끌개',
  setup() {
    orbit = integrate(40000);
    const r = rng(251);
    starts = Array.from({ length: COMETS * 2 }, () => Math.floor(r() * (40000 - 2000)));   // two lives each
    haze = canvas(540, 960);
    sprite = canvas(64, 64);
    const g = sprite.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255, 255, 255, 1)'); grd.addColorStop(0.25, 'rgba(255, 255, 255, 0.35)'); grd.addColorStop(1, 'rgba(255, 255, 255, 0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  },
  draw(ctx, t, W, H) {
    const bg = ctx.createRadialGradient(CX, CY, 60, CX, CY, 1200);
    bg.addColorStop(0, '#181336'); bg.addColorStop(0.6, '#0A0A1C'); bg.addColorStop(1, '#05050D');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    const th = Math.PI * t / 5, ct = Math.cos(th), st = Math.sin(th), cp = Math.cos(TILT), sp = Math.sin(TILT);
    // world (x, y, z) -> screen [sx, sy, scale]; mirror m = -1 draws the image under (x, y) -> (-x, -y)
    const project = (x, y, z, m) => {
      x *= m; y *= m; z -= 26;
      const rx = x * ct + y * st, ry = -x * st + y * ct;
      const depth = DIST + ry * cp - z * sp, up = z * cp + ry * sp, k = FOCAL / depth;
      return [CX + rx * k, CY - up * k, DIST / depth];
    };

    // the attractor itself: the long orbit and its mirror at half size, blurred into a soft glowing haze
    // (sharp faint lines would shimmer as they turn)
    const ghost = Array.from({ length: 8 }, () => new Path2D());
    for (const m of [1, -1]) {
      let prev = project(orbit[0], orbit[1], orbit[2], m);
      for (let i = 3; i < 26000 * 3; i += 9) {        // every 3rd step is plenty for the haze
        const p = project(orbit[i], orbit[i + 1], orbit[i + 2], m), path = ghost[band(orbit[i + 2])];
        path.moveTo(prev[0] / 2, prev[1] / 2); path.lineTo(p[0] / 2, p[1] / 2);
        prev = p;
      }
    }
    const g = haze.getContext('2d');
    g.clearRect(0, 0, 540, 960);
    g.globalCompositeOperation = 'lighter'; g.lineWidth = 1.5; g.globalAlpha = 0.1;
    ghost.forEach((p, b) => { g.strokeStyle = COLORS[b]; g.stroke(p); });
    ctx.globalCompositeOperation = 'lighter';
    ctx.filter = 'blur(5px)';
    ctx.drawImage(haze, 0, 0, W, H);
    ctx.filter = 'none';
    ctx.lineCap = 'butt';                              // butt ends: tail pieces meet without bright beads

    // particles: each life rides a stretch of the orbit, fading in and out; lives 3 and 4 are mirrors of 1 and 2
    const steps = Math.round(TAIL / DT), seg = 10, tails = Array.from({ length: 8 * seg }, () => new Path2D());
    const heads = [];
    for (let c = 0; c < COMETS; c++) {
      const life = t / LIFE + c / COMETS, L = Math.floor(life), u = life - L;
      const m = L % 4 < 2 ? 1 : -1, s0 = starts[c * 2 + (L % 2)];
      const head = s0 + Math.floor(u * LIFE * SPEED / DT), frac = (u * LIFE * SPEED / DT) % 1;
      const fade = Math.sin(Math.PI * u) ** 1.5;
      const at = i => { const a = (head + i) * 3, b = a + 3;
        return project(orbit[a] + (orbit[b] - orbit[a]) * frac, orbit[a + 1] + (orbit[b + 1] - orbit[a + 1]) * frac, orbit[a + 2] + (orbit[b + 2] - orbit[a + 2]) * frac, m); };
      const hz = orbit[head * 3 + 2], b = band(hz);
      let prev = at(-steps);
      for (let k = 1; k <= seg; k++) {                 // tail in 10 pieces, brighter toward the head
        const p = at(-steps + Math.round(k * steps / seg));
        const path = tails[b * seg + Math.min(seg - 1, Math.floor((k - 1) * fade))];
        path.moveTo(prev[0], prev[1]); path.lineTo(p[0], p[1]);
        prev = p;
      }
      heads.push([prev, b, fade]);
    }
    for (let b = 0; b < 8; b++) for (let k = 0; k < seg; k++) {
      ctx.strokeStyle = COLORS[b];
      ctx.globalAlpha = 0.06 + 0.5 * ((k + 1) / seg) ** 2;
      ctx.lineWidth = 2 + 2.6 * (k + 1) / seg;
      ctx.stroke(tails[b * seg + k]);
    }
    for (const [p, b, fade] of heads) {               // glowing heads, a little bigger when nearer
      const s = 34 * p[2];
      ctx.globalAlpha = 0.9 * fade;
      ctx.drawImage(sprite, p[0] - s / 2, p[1] - s / 2, s, s);
      ctx.globalAlpha = 0.5 * fade; ctx.fillStyle = COLORS[b];
      ctx.beginPath(); ctx.arc(p[0], p[1], 6 * p[2], 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

    // the equations
    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(235, 228, 255, 0.82)';
    ctx.font = `italic 44px ${FONT.serif}`;
    ctx.fillText('dx/dt = σ (y − x)', W / 2, 1590);
    ctx.fillText('dy/dt = x (ρ − z) − y', W / 2, 1650);
    ctx.fillText('dz/dt = x y − β z', W / 2, 1710);
    ctx.font = `500 30px ${FONT.sans}`; ctx.fillStyle = 'rgba(200, 190, 255, 0.6)';
    ctx.fillText('σ = 10    ρ = 28    β = 8/3', W / 2, 1782);
  },
};
