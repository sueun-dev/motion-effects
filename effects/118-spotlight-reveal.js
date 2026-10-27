// Flashlight mask: the whole picture is drawn almost black; a soft-edged circle (the picture cut out with a radial
// gradient through 'destination-in') drifts on a looping path and shows the hidden night city and its neon sign.
import { TAU, FONT, canvas } from '../lib/util.js';
import { city } from '../lib/scenes.js';

let pic, lit;

const light = t => {
  const a = t / 5 * TAU;
  return [540 + 260 * Math.sin(a) + 90 * Math.sin(2 * a), 1000 - 450 * Math.cos(2 * a) + 60 * Math.sin(a), 320 + 30 * Math.sin(3 * a)];
};

export default {
  name: 'Spotlight Reveal',
  ko: '스포트라이트',
  setup(ctx, W, H) {
    pic = canvas(); lit = canvas();
    const p = pic.getContext('2d');
    city(p, W, H);
    p.textAlign = 'center'; p.textBaseline = 'middle'; // the hidden neon sign
    p.font = `700 150px ${FONT.display}`;
    p.shadowColor = '#FF3FA4'; p.shadowBlur = 40;
    p.lineWidth = 6; p.strokeStyle = '#FF7EC8'; p.strokeText('SEOUL', W / 2, 720);
    p.shadowBlur = 20; p.fillStyle = '#FFE3F4'; p.fillText('SEOUL', W / 2, 720);
    p.font = `500 54px ${FONT.display}`; p.shadowColor = '#3FE0FF'; p.fillStyle = '#C9F6FF';
    p.fillText('— after midnight —', W / 2, 830);
  },
  draw(ctx, t, W, H) {
    ctx.drawImage(pic, 0, 0);
    ctx.fillStyle = 'rgba(4, 4, 14, 0.93)'; ctx.fillRect(0, 0, W, H);

    const [x, y, r] = light(t);
    const l = lit.getContext('2d');
    l.globalCompositeOperation = 'copy'; l.drawImage(pic, 0, 0);
    l.globalCompositeOperation = 'destination-in';
    const m = l.createRadialGradient(x, y, 0, x, y, r);
    m.addColorStop(0, '#000'); m.addColorStop(0.7, 'rgba(0, 0, 0, 0.95)'); m.addColorStop(1, 'rgba(0, 0, 0, 0)');
    l.fillStyle = m; l.fillRect(0, 0, W, H);
    ctx.drawImage(lit, 0, 0);

    ctx.save(); // a little warm bloom in the middle of the beam
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.3);
    g.addColorStop(0, 'rgba(255, 230, 190, 0.12)'); g.addColorStop(1, 'rgba(255, 230, 190, 0)');
    ctx.fillStyle = g; ctx.fillRect(x - r * 1.3, y - r * 1.3, r * 2.6, r * 2.6);
    ctx.restore();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'; ctx.font = `500 36px ${FONT.ko}`; ctx.textAlign = 'center';
    ctx.fillText('빛을 비춰 숨은 그림을 찾아보세요', W / 2, 1820);
  },
};
