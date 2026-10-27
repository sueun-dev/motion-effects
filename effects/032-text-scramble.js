// Text scramble (decode): every letter shows random characters that change every 3rd frame (picked by a seeded rng
// per letter and step), then locks onto its real letter one by one, holds, and scrambles back so the loop restarts.
import { clamp, rng, FONT } from '../lib/util.js';

const LINES = ['SIGNAL', 'DECODED'], SIZE = 160, CW = SIZE * 0.602; // Menlo is monospace: 0.602 em per letter
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*@$<>/+=?';
const N = LINES.join('').length;
const lockAt = n => 0.5 + n * 0.12, unlockAt = n => 3.4 + n * 0.08;

export default {
  name: 'Text Scramble',
  ko: '텍스트 스크램블',
  draw(ctx, t, W, H) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#07131F'); bg.addColorStop(1, '#0C2230');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(90, 240, 220, 0.07)';
    for (let y = 300; y < H; y += 48) for (let x = 24; x < W; x += 48) ctx.fillRect(x, y, 4, 4); // dot grid

    const step = Math.floor(Math.round(t * 30) / 3); // the random letters change on every 3rd frame
    ctx.font = `700 ${SIZE}px ${FONT.mono}`;
    ctx.textBaseline = 'middle';
    let n = 0, done = 0;
    LINES.forEach((line, row) => {
      const x0 = (W - line.length * CW) / 2, y = 860 + row * 210;
      [...line].forEach((ch, i) => {
        const locked = t >= lockAt(n) && t < unlockAt(n);
        done += clamp((t - lockAt(n)) / 0.12) - clamp((t - unlockAt(n)) / 0.08);
        const x = x0 + i * CW;
        if (locked) {
          const flash = Math.exp(-8 * (t - lockAt(n)));            // a short glow when the letter lands
          ctx.shadowColor = 'rgba(90, 255, 220, 0.9)'; ctx.shadowBlur = 10 + 40 * flash;
          ctx.fillStyle = '#F2FFFC';
          ctx.fillText(ch, x, y);
          ctx.shadowBlur = 0;
        } else {
          const r = rng(n * 7919 + step * 104729);
          ctx.fillStyle = 'rgba(60, 200, 190, 0.75)';
          ctx.fillText(GLYPHS[Math.floor(r() * GLYPHS.length)], x, y);
        }
        n++;
      });
    });
    const k = clamp(done / N); // progress bar follows the locked letters
    ctx.fillStyle = 'rgba(90, 240, 220, 0.18)';
    ctx.beginPath(); ctx.roundRect(240, 1300, 600, 14, 7); ctx.fill();
    ctx.fillStyle = '#5AF0DC';
    ctx.beginPath(); ctx.roundRect(240, 1300, Math.max(14, 600 * k), 14, 7); ctx.fill();
    ctx.font = `500 36px ${FONT.mono}`; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(160, 255, 240, 0.7)';
    ctx.fillText(`${String(Math.round(k * 100)).padStart(3, ' ')}%`, 860, 1322);
    ctx.fillText(k > 0.999 ? '> verified' : '> decrypting', 240, 1280);
  },
};
