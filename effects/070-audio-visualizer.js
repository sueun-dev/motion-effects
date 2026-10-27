// Audio visualizer with a made-up 120 BPM beat (10 beats per loop): kick, snare and hi-hat envelopes are smooth
// functions of t (fast rise, exponential fall) that drive a radial spectrum ring and a mirrored bar spectrum.
import { TAU, noise3, loop, FONT } from '../lib/util.js';

const BEAT = 0.5, RING = 72, BARS = 24, CX = 540, CY = 900;

// an envelope that rises over ~3 frames at each hit and decays (hits every `every` seconds, shifted by `at`)
const env = (t, every, at, fall) => {
  const k = (((t - at) % every) + every) % every;
  return (1 - Math.exp(-k / 0.045)) * Math.exp(-k / fall);
};

// spectrum level 0..1 for band u (0 = bass, 1 = treble)
function level(t, u) {
  const kick = env(t, BEAT, 0, 0.16), snare = env(t, BEAT * 2, BEAT, 0.12), hat = env(t, BEAT / 2, BEAT / 4, 0.05);
  const [lx, ly] = loop(t, 0.8);
  const wob = 0.5 + 0.5 * noise3(u * 6 + lx, ly, 3.7);
  return Math.min(1, 0.1 + 0.95 * kick * Math.exp(-u * 4) + 0.6 * snare * Math.exp(-(((u - 0.45) / 0.2) ** 2))
    + 0.35 * hat * Math.exp(-(((u - 0.85) / 0.15) ** 2)) + 0.28 * wob * (1 - 0.5 * u));
}

export default {
  name: 'Audio Visualizer',
  ko: '오디오 비주얼라이저',
  draw(ctx, t, W, H) {
    const kick = env(t, BEAT, 0, 0.16);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#120A2A'); bg.addColorStop(1, '#05060F');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(CX, CY, 100, CX, CY, 700);
    glow.addColorStop(0, `rgba(255, 60, 160, ${0.12 + 0.18 * kick})`); glow.addColorStop(1, 'rgba(255, 60, 160, 0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

    // radial ring: bars mirrored left/right, bass at the top
    const R = 250 + 14 * kick;
    ctx.lineCap = 'round'; ctx.lineWidth = 13;
    for (let i = 0; i < RING; i++) {
      const a = -Math.PI / 2 + (i / RING) * TAU, u = (i <= RING / 2 ? i : RING - i) / (RING / 2);
      const len = 24 + 210 * level(t, u);
      const c = Math.cos(a), s = Math.sin(a);
      ctx.strokeStyle = `hsl(${300 - 120 * u}, 95%, ${60 + 10 * u}%)`;
      ctx.beginPath(); ctx.moveTo(CX + c * (R + 18), CY + s * (R + 18)); ctx.lineTo(CX + c * (R + 18 + len), CY + s * (R + 18 + len)); ctx.stroke();
    }
    // the disc in the middle pulses with the kick
    const disc = ctx.createRadialGradient(CX - 60, CY - 80, 20, CX, CY, R);
    disc.addColorStop(0, '#FF7AC8'); disc.addColorStop(0.6, '#7B3CFF'); disc.addColorStop(1, '#2A1466');
    ctx.fillStyle = disc;
    ctx.beginPath(); ctx.arc(CX, CY, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(CX, CY, R - 30, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.font = `800 150px ${FONT.sans}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('120', CX, CY - 12);
    ctx.font = `600 40px ${FONT.sans}`; ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText('BPM', CX, CY + 82);

    // bar spectrum below, with a soft reflection
    const bw = 30, gap = 10, x0 = (W - BARS * (bw + gap) + gap) / 2, base = 1600;
    for (let i = 0; i < BARS; i++) {
      const u = i / (BARS - 1), h = 20 + 300 * level(t, u), x = x0 + i * (bw + gap);
      const g = ctx.createLinearGradient(0, base - h, 0, base);
      g.addColorStop(0, `hsl(${300 - 120 * u}, 95%, 66%)`); g.addColorStop(1, `hsl(${300 - 120 * u}, 90%, 40%)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.roundRect(x, base - h, bw, h, 8); ctx.fill();
      ctx.fillStyle = `hsla(${300 - 120 * u}, 90%, 55%, 0.18)`;
      ctx.beginPath(); ctx.roundRect(x, base + 12, bw, h * 0.45, 8); ctx.fill();
    }
  },
};
