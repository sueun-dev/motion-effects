// Sci-fi HUD (FUI): glowing cyan rings, tick scales and arc segments counter-rotate around a radar sweep that
// lights blips as it passes (they fade, never blink); side panels show bars, a waveform and slow readouts.
import { TAU, phase, rng, FONT } from '../lib/util.js';

const CX = 540, CY = 1010, CYAN = '#5CF2FF', ORANGE = '#FF8A3D';
const r = rng(21);
const BLIPS = Array.from({ length: 7 }, () => [r() * TAU, 50 + r() * 150]);

const ring = (ctx, rad, w, a0 = 0, a1 = TAU) => { ctx.lineWidth = w; ctx.beginPath(); ctx.arc(CX, CY, rad, a0, a1); ctx.stroke(); };

export default {
  name: 'Sci-fi HUD',
  ko: 'SF HUD',
  draw(ctx, t, W, H) {
    const a = phase(t) * TAU;
    const bg = ctx.createRadialGradient(CX, CY, 100, CX, CY, 1200);
    bg.addColorStop(0, '#08243A'); bg.addColorStop(1, '#020812');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(92, 242, 255, 0.07)'; ctx.lineWidth = 2; // fixed backdrop grid
    ctx.beginPath();
    for (let x = 0; x <= W; x += 60) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = 0; y <= H; y += 60) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = CYAN; ctx.shadowBlur = 14;
    ctx.strokeStyle = CYAN; ctx.fillStyle = CYAN; ctx.lineCap = 'butt';

    // radar sweep: a fading wedge behind the beam, one turn per loop
    const sweep = a - Math.PI / 2;
    const cone = ctx.createConicGradient(sweep, CX, CY);
    cone.addColorStop(0, 'rgba(92,242,255,0)'); cone.addColorStop(0.75, 'rgba(92,242,255,0)'); cone.addColorStop(1, 'rgba(92,242,255,0.35)');
    ctx.fillStyle = cone; ctx.beginPath(); ctx.arc(CX, CY, 225, 0, TAU); ctx.fill();
    ctx.fillStyle = CYAN;
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(CX, CY); ctx.lineTo(CX + 225 * Math.cos(sweep), CY + 225 * Math.sin(sweep)); ctx.stroke();
    for (const [q, d] of BLIPS) { // a blip glows when the beam passes, then fades over most of a turn
      const since = ((sweep - q) % TAU + TAU) % TAU / TAU;
      const glow = Math.exp(-since * 4);
      ctx.globalAlpha = 0.15 + 0.85 * glow;
      ctx.beginPath(); ctx.arc(CX + d * Math.cos(q), CY + d * Math.sin(q), 6 + 6 * glow, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.globalAlpha = 0.5; ring(ctx, 225, 2); ring(ctx, 150, 2); ring(ctx, 75, 2); ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.moveTo(CX - 250, CY); ctx.lineTo(CX + 250, CY); ctx.moveTo(CX, CY - 250); ctx.lineTo(CX, CY + 250); ctx.lineWidth = 2; ctx.stroke();

    ctx.setLineDash([22, 14]); ctx.lineDashOffset = -36 * 6 * phase(t); // dashed ring crawling forward
    ring(ctx, 262, 6); ctx.setLineDash([]);
    for (let k = 0; k < 3; k++) { const q = -a / 3 + k * TAU / 3; ring(ctx, 300, 16, q, q + 1.4); } // thick arcs turning back
    ctx.save(); ctx.translate(CX, CY); ctx.rotate(a / 12); // tick scale, long tick every tenth
    ctx.beginPath();
    for (let i = 0; i < 120; i++) {
      const q = i / 120 * TAU, len = i % 10 ? 14 : 34;
      ctx.moveTo(340 * Math.cos(q), 340 * Math.sin(q)); ctx.lineTo((340 + len) * Math.cos(q), (340 + len) * Math.sin(q));
    }
    ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
    ctx.globalAlpha = 0.6; ring(ctx, 395, 2); ctx.globalAlpha = 1;
    ctx.strokeStyle = ORANGE; ctx.shadowColor = ORANGE; // orange lock arc
    const lock = 0.6 + 0.4 * Math.sin(a);
    ring(ctx, 420, 8, -Math.PI / 2 - lock, -Math.PI / 2 + lock);
    ctx.strokeStyle = CYAN; ctx.shadowColor = CYAN;

    // left panel: bars; right panel: waveform
    ctx.lineWidth = 3; ctx.strokeRect(80, 330, 380, 210); ctx.strokeRect(620, 330, 380, 210);
    for (let i = 0; i < 8; i++) {
      const h = 40 + 110 * (0.5 + 0.5 * Math.sin(a * (1 + (i % 3)) + i * 1.3));
      ctx.globalAlpha = 0.85; ctx.fillRect(110 + i * 42, 520 - h, 26, h);
    }
    ctx.globalAlpha = 1;
    ctx.beginPath();
    for (let x = 0; x <= 340; x += 4) {
      const y = 435 + 60 * Math.sin(x / 340 * 3 * TAU - a * 2) * Math.sin(x / 340 * Math.PI) * (0.6 + 0.4 * Math.sin(a));
      x ? ctx.lineTo(640 + x, y) : ctx.moveTo(640, y);
    }
    ctx.stroke();

    // readouts (they step twice a second, slowly) and a progress bar that fills and drains
    const step = Math.floor(t * 2);
    ctx.font = `600 30px ${FONT.mono}`; ctx.textBaseline = 'alphabetic';
    ctx.fillText('SIGNAL', 90, 318); ctx.fillText('SCAN · SECTOR 7', 630, 318);
    ctx.fillText(`LAT  37.${String(5665 + step * 7).padStart(4, '0')} N`, 90, 1560);
    ctx.fillText(`LON 126.${String(9780 - step * 5).padStart(4, '0')} E`, 90, 1610);
    ctx.fillText(`ALT  ${(12400 + step * 30).toLocaleString('en-US')} FT`, 90, 1660);
    ctx.textAlign = 'right';
    ctx.fillStyle = ORANGE; ctx.shadowColor = ORANGE; ctx.fillText('TARGET LOCK', 1000, 1560); ctx.fillStyle = CYAN; ctx.shadowColor = CYAN;
    ctx.fillText(`${String(40 + (step % 10) * 6).padStart(2, '0')}%`, 1000, 1610);
    const fill = Math.min(1, t / 4.4) * (1 - Math.max(0, (t - 4.4) / 0.6));
    ctx.strokeRect(80, 1710, 920, 40); ctx.globalAlpha = 0.8; ctx.fillRect(88, 1718, 904 * fill, 24); ctx.globalAlpha = 1;
    ctx.restore();

    ctx.strokeStyle = 'rgba(92, 242, 255, 0.8)'; ctx.lineWidth = 5; // corner brackets
    for (const [x, y, sx, sy] of [[40, 290, 1, 1], [1040, 290, -1, 1], [40, 1800, 1, -1], [1040, 1800, -1, -1]]) {
      ctx.beginPath(); ctx.moveTo(x, y + sy * 70); ctx.lineTo(x, y); ctx.lineTo(x + sx * 70, y); ctx.stroke();
    }
  },
};
