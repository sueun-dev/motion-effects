// Arc motion: the dolphin never moves in straight lines; it rides a closed arc (a tall half-ellipse in the air,
// a shallow one under water) and turns to follow its tangent. Dots mark equal time steps; a fading trail follows it.
import { TAU, clamp, smoothstep, FONT } from '../lib/util.js';

const SEA = 1220, CX = 540, RX = 320, UP = 640, DOWN = 230, CYCLE = 5;

// position on the loop for an angle a (0 = leaving the water on the left, PI = diving in on the right)
const at = a => [CX - RX * Math.cos(a), SEA - (Math.sin(a) > 0 ? UP : DOWN) * Math.sin(a)];
const angleAt = t => (t / CYCLE) * TAU;

// flip: 1 = upright, -1 = mirrored (swimming back upside-up under water); it rolls smoothly between them
function dolphin(ctx, x, y, dir, flip) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(dir); ctx.scale(1, flip);
  const g = ctx.createLinearGradient(0, -60, 0, 50);
  g.addColorStop(0, '#3E63C9'); g.addColorStop(0.55, '#6F9BEA'); g.addColorStop(1, '#DCEBFF');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(185, 14);                               // tip of the beak
  ctx.quadraticCurveTo(165, 2, 140, -4);
  ctx.bezierCurveTo(128, -48, 60, -62, -20, -52);   // forehead and back
  ctx.bezierCurveTo(-80, -44, -120, -22, -150, -6);  // tail stock
  ctx.lineTo(-150, 6);
  ctx.bezierCurveTo(-110, 30, -40, 52, 40, 46);      // belly
  ctx.bezierCurveTo(100, 40, 150, 28, 185, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(29, 37, 80, 0.5)'; ctx.lineWidth = 3; // smile
  ctx.beginPath(); ctx.moveTo(176, 16); ctx.quadraticCurveTo(150, 22, 128, 12); ctx.stroke();
  ctx.fillStyle = '#3E63C9';
  ctx.beginPath(); ctx.moveTo(-10, -50); ctx.quadraticCurveTo(-30, -100, -70, -108); ctx.quadraticCurveTo(-50, -70, -62, -44); ctx.fill(); // dorsal fin
  ctx.beginPath(); ctx.moveTo(-140, 0); ctx.quadraticCurveTo(-185, -50, -215, -58); ctx.quadraticCurveTo(-190, -10, -200, 0);
  ctx.quadraticCurveTo(-190, 10, -215, 58); ctx.quadraticCurveTo(-185, 50, -140, 0); ctx.fill(); // tail flukes
  ctx.beginPath(); ctx.moveTo(30, 30); ctx.quadraticCurveTo(10, 75, -25, 80); ctx.quadraticCurveTo(-5, 50, -10, 28); ctx.fill(); // flipper
  ctx.fillStyle = '#1D2550'; ctx.beginPath(); ctx.arc(108, -10, 7, 0, TAU); ctx.fill();
  ctx.restore();
}

export default {
  name: 'Arc Motion',
  ko: '아크 모션',
  draw(ctx, t, W, H) {
    const sky = ctx.createLinearGradient(0, 0, 0, SEA);
    sky.addColorStop(0, '#FF9E7A'); sky.addColorStop(0.6, '#FFD3A1'); sky.addColorStop(1, '#FFEBC9');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, SEA);
    ctx.fillStyle = '#FFF4D9'; ctx.beginPath(); ctx.arc(820, 420, 90, 0, TAU); ctx.fill();
    const sea = ctx.createLinearGradient(0, SEA, 0, H);
    sea.addColorStop(0, '#3FB6C9'); sea.addColorStop(1, '#14507A');
    ctx.fillStyle = sea; ctx.fillRect(0, SEA, W, H - SEA);

    // the path, with a dot every 1/24 of the cycle: wide spacing = fast, tight = slow
    ctx.fillStyle = 'rgba(120, 60, 90, 0.5)';
    for (let k = 0; k < 24; k++) { const [x, y] = at((k / 24) * TAU); if (y < SEA - 10) { ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill(); } }
    ctx.strokeStyle = 'rgba(120, 60, 90, 0.35)'; ctx.lineWidth = 4; ctx.setLineDash([4, 22]); ctx.lineCap = 'round';
    ctx.beginPath(); for (let k = 0; k <= 120; k++) ctx.lineTo(...at((k / 120) * Math.PI)); ctx.stroke();
    ctx.setLineDash([]);

    const a = angleAt(t) % TAU;
    ctx.lineCap = 'round'; // a fading trail along the arc it just travelled
    for (let k = 0; k < 30; k++) {
      ctx.strokeStyle = `rgba(62, 99, 201, ${0.5 * (k / 30)})`; ctx.lineWidth = 6 + 22 * (k / 30);
      ctx.beginPath(); ctx.moveTo(...at(a - 0.9 + (k / 30) * 0.9)); ctx.lineTo(...at(a - 0.9 + ((k + 1) / 30) * 0.9)); ctx.stroke();
    }
    const roll = Math.cos(Math.PI * (smoothstep(Math.PI + 0.2, Math.PI + 1.0, a) - smoothstep(TAU - 1.0, TAU - 0.2, a)));
    const [x, y] = at(a), [x2, y2] = at(a + 0.01);
    dolphin(ctx, x, y, Math.atan2(y2 - y, x2 - x), roll);

    ctx.fillStyle = 'rgba(30, 110, 150, 0.55)'; // water in front: the dolphin is under it on the way back
    ctx.fillRect(0, SEA, W, H - SEA);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    for (let k = 0; k < 9; k++) ctx.fillRect(60 + ((k * 397) % 900), SEA + 40 + k * 70, 160 - k * 8, 6);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; ctx.lineWidth = 3; ctx.setLineDash([4, 22]);
    ctx.beginPath(); for (let k = 0; k <= 60; k++) ctx.lineTo(...at(Math.PI + (k / 60) * Math.PI)); ctx.stroke();
    ctx.setLineDash([]);

    // ripples where it leaves (left) and enters (right) the water
    for (const [px, off] of [[CX - RX, 0], [CX + RX, CYCLE / 2]]) {
      const age = (((t - off) % CYCLE) + CYCLE) % CYCLE, k = clamp(age / 1.1);
      if (k >= 1) continue;
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.8 * (1 - k)})`; ctx.lineWidth = 6;
      for (const s of [1, 0.6]) { ctx.beginPath(); ctx.ellipse(px, SEA, 40 + 160 * k * s, 10 + 26 * k * s, 0, 0, TAU); ctx.stroke(); }
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = `800 52px ${FONT.ko}`; ctx.textAlign = 'center';
    ctx.fillText('직선이 아닌 호를 따라', W / 2, 1760);
  },
};
