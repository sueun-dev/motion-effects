// Marquee bands: tilted ribbons of repeating type scroll in alternating directions, two of them crossing in an X.
// Each band moves a whole number of text repeats per loop, so it joins seamlessly.
import { phase, FONT } from '../lib/util.js';

const BANDS = [ // centre y, tilt (deg), height, band colour, text colour, outline only, text, repeats per loop
  [520, -4, 150, '#34303F', '#F4F0E6', true, 'INFINITE LOOP ✦ ', 1],
  [860, 9, 190, '#E8FF3A', '#111111', false, 'MARQUEE ✦ 마퀴 띠 ✦ ', -1],
  [860, -9, 190, '#FF4FA3', '#FFFFFF', false, 'TICKER ✦ ', 1],
  [1250, 3, 150, '#2B4BFF', '#E8FF3A', false, 'NON STOP ✦ 끝없이 흐른다 ✦ ', -1],
  [1590, -6, 190, '#F4F0E6', '#1C1C22', false, 'KEEP ROLLING ✦ ', 1],
  [1590, 6, 120, '#FF7A30', '#1C1C22', true, 'ON AND ON ✦ ', -1],
];

export default {
  name: 'Marquee',
  ko: '마퀴 띠',
  draw(ctx, t, W, H) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#2A2633'); bg.addColorStop(1, '#141218');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';

    for (const [y, tilt, h, band, ink, outline, text, reps] of BANDS) {
      ctx.save();
      ctx.translate(W / 2, y);
      ctx.rotate(tilt * Math.PI / 180);
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 14;
      ctx.fillStyle = band; ctx.fillRect(-900, -h / 2, 1800, h);
      ctx.shadowColor = 'transparent';

      ctx.font = `900 ${Math.round(h * 0.56)}px ${FONT.black}`;
      const rep = ctx.measureText(text).width;
      const off = ((phase(t) * reps * rep) % rep + rep) % rep; // 0..rep, shifting a whole repeat per loop
      ctx.fillStyle = ink; ctx.strokeStyle = ink; ctx.lineWidth = 3; ctx.lineJoin = 'round';
      for (let x = -900 - rep + off; x < 900; x += rep) {
        if (outline) ctx.strokeText(text, x, h * 0.03); else ctx.fillText(text, x, h * 0.03);
      }
      ctx.restore();
    }
  },
};
