// Lithophane: a thin porcelain plate whose back is carved in relief, 0.8 mm where the picture is light and 3.0 mm
// where it is dark. Under the front light it is an almost blank white tile; when the lamp behind it comes on, light
// passing through is absorbed with thickness (Beer-Lambert, T = exp(-1.28 (d - 0.8))) and a lighthouse on a cliff
// glows out of it in warm sepia, softened as light scatters inside the porcelain. A line sweeps the plate and the
// cross-section below draws the plate's thickness along it, with the lamp's rays thinning through the thick parts.
import { TAU, FONT, canvas, rng, smoothstep } from '../lib/util.js';

const P = { x: 170, y: 330, w: 740, h: 960 };     // the plate on screen (px, top-left origin)
const D0 = 0.8, D1 = 3.0, SIGMA = 1.28;           // thinnest and thickest (mm), absorption per mm
const SEC = { x: 170, y: 1510, mm: 30 };          // cross-section: the front face line, px per mm of thickness
let pic = null, lum = null;

// the lamp behind: fades on over 0.8 s starting just before the loop point (4.92 s), stays on, fades off at 2.42-3.22 s
const back = t => { const u = (t + 0.08) % 5; return smoothstep(0, 0.8, u) * (1 - smoothstep(2.5, 3.3, u)); };
const scanY = t => P.y + P.h * (0.5 + 0.36 * Math.sin(TAU * t / 5));       // the cross-section line, down and back up
const thick = l => D0 + (D1 - D0) * (1 - l);                                // lightness -> thickness (mm)
const through = l => Math.exp(-SIGMA * (thick(l) - D0));                    // share of the lamp that gets through

// the picture carved into the plate, in grey: a lighthouse on a cliff, sun rays, a sailboat, surf on the rocks
function picture() {
  const c = canvas(P.w, P.h), g = c.getContext('2d'), r = rng(324), w = P.w, h = P.h;
  const grey = v => `rgb(${v * 255 | 0}, ${v * 255 | 0}, ${v * 255 | 0})`;
  const sky = g.createLinearGradient(0, 0, 0, 560);
  sky.addColorStop(0, grey(0.5)); sky.addColorStop(0.7, grey(0.82)); sky.addColorStop(1, grey(0.92));
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9; i++) { // sun rays fanning from behind a cloud
    const a = 1.75 + i * 0.13;
    g.fillStyle = `rgba(255, 255, 255, ${0.10 + 0.06 * (i % 2)})`;
    g.beginPath(); g.moveTo(560, 170); g.arc(560, 170, 900, a, a + 0.06); g.fill();
  }
  const sun = g.createRadialGradient(560, 170, 10, 560, 170, 150);
  sun.addColorStop(0, grey(1)); sun.addColorStop(1, 'rgba(255, 255, 255, 0)');
  g.fillStyle = sun; g.fillRect(400, 20, 320, 320);
  const cloud = (x, y, s) => { // a cumulus: grey underside, bright top
    for (let k = 0; k < 7; k++) {
      const cx = x + (k - 3) * 34 * s, cy = y - Math.sin(k / 6 * Math.PI) * 30 * s, rr = (34 + 18 * Math.sin(k / 6 * Math.PI)) * s;
      const gr = g.createRadialGradient(cx - rr * 0.2, cy - rr * 0.5, rr * 0.1, cx, cy, rr);
      gr.addColorStop(0, grey(0.98)); gr.addColorStop(1, grey(0.7));
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, rr, 0, TAU); g.fill();
    }
  };
  cloud(560, 200, 1.3); cloud(170, 120, 0.9); cloud(640, 380, 0.7);
  g.strokeStyle = grey(0.25); g.lineWidth = 3; g.lineCap = 'round';
  for (const [x, y, s] of [[330, 150, 1], [380, 190, 0.7], [270, 230, 0.8], [440, 120, 0.6]]) { // gulls
    g.beginPath(); g.moveTo(x - 16 * s, y - 4 * s); g.quadraticCurveTo(x - 6 * s, y - 10 * s, x, y); g.quadraticCurveTo(x + 6 * s, y - 10 * s, x + 16 * s, y - 4 * s); g.stroke();
  }
  // the sea: darker toward us, a glitter path under the sun, wave lines
  const sea = g.createLinearGradient(0, 560, 0, h);
  sea.addColorStop(0, grey(0.62)); sea.addColorStop(1, grey(0.3));
  g.fillStyle = sea; g.fillRect(0, 560, w, h - 560);
  for (let i = 0; i < 70; i++) {
    const y = 566 + Math.pow(r(), 1.6) * 330, x = 560 + (r() - 0.5) * (40 + (y - 560) * 0.9), l = 10 + r() * 40;
    g.fillStyle = `rgba(255, 255, 255, ${0.35 + 0.4 * r()})`; g.fillRect(x - l / 2, y, l, 2 + (y - 560) / 120);
  }
  g.strokeStyle = grey(0.75); g.lineWidth = 2;
  for (let i = 0; i < 26; i++) { const x = r() * w, y = 600 + r() * 300, l = 30 + r() * 60; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 5, x + l, y); g.stroke(); }
  // a sailboat
  g.fillStyle = grey(0.18); g.beginPath(); g.moveTo(520, 640); g.lineTo(610, 640); g.lineTo(595, 656); g.lineTo(532, 656); g.fill();
  g.fillStyle = grey(0.96); g.beginPath(); g.moveTo(566, 520); g.lineTo(566, 634); g.lineTo(612, 634); g.fill();
  g.fillStyle = grey(0.86); g.beginPath(); g.moveTo(562, 534); g.lineTo(562, 634); g.lineTo(526, 634); g.fill();
  // the cliff, with light-catching strata
  g.fillStyle = grey(0.28);
  g.beginPath(); g.moveTo(0, 360); g.lineTo(120, 380); g.lineTo(250, 420); g.lineTo(360, 430); g.quadraticCurveTo(410, 470, 420, 560);
  g.lineTo(470, 650); g.lineTo(440, 760); g.lineTo(0, 800); g.fill();
  for (let i = 0; i < 40; i++) {
    const y = 440 + r() * 330, x0 = r() * 300, l = 40 + r() * 120;
    g.strokeStyle = r() < 0.5 ? grey(0.42) : grey(0.18); g.lineWidth = 2 + r() * 4;
    g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + l, y + (r() - 0.3) * 20); g.stroke();
  }
  g.fillStyle = grey(0.5); // grass on the top
  g.beginPath(); g.moveTo(0, 352); g.lineTo(120, 372); g.lineTo(250, 412); g.lineTo(362, 424); g.lineTo(360, 436); g.lineTo(250, 430); g.lineTo(0, 380); g.fill();
  // the keeper's cottage and the lighthouse, its beam reaching into the sky
  g.fillStyle = grey(0.88); g.fillRect(70, 330, 110, 60);
  g.fillStyle = grey(0.2); g.beginPath(); g.moveTo(60, 334); g.lineTo(125, 290); g.lineTo(190, 334); g.fill();
  g.fillStyle = grey(0.3); g.fillRect(96, 350, 18, 22); g.fillRect(140, 350, 18, 22);
  const beam = g.createLinearGradient(260, 170, 720, 60);
  beam.addColorStop(0, 'rgba(255, 255, 255, 0.85)'); beam.addColorStop(1, 'rgba(255, 255, 255, 0)');
  g.fillStyle = beam; g.beginPath(); g.moveTo(262, 168); g.lineTo(740, 30); g.lineTo(740, 150); g.fill();
  g.fillStyle = grey(0.93); g.beginPath(); g.moveTo(232, 420); g.lineTo(244, 200); g.lineTo(282, 200); g.lineTo(294, 420); g.fill();
  g.fillStyle = grey(0.25);
  for (const y of [250, 330]) { g.beginPath(); g.moveTo(240 - (y - 200) * 0.0, y); g.lineTo(287 + (y - 200) * 0.055, y); g.lineTo(288 + (y + 32 - 200) * 0.055, y + 32); g.lineTo(238 - (y + 32 - 200) * 0.055, y + 32); g.fill(); }
  g.fillStyle = grey(0.2); g.fillRect(236, 192, 54, 10); g.fillRect(244, 150, 38, 8);
  g.fillStyle = grey(1); g.fillRect(248, 158, 30, 34);
  g.fillStyle = grey(0.2); g.beginPath(); g.moveTo(240, 152); g.lineTo(263, 126); g.lineTo(286, 152); g.fill();
  const lamp = g.createRadialGradient(263, 175, 4, 263, 175, 60);
  lamp.addColorStop(0, 'rgba(255, 255, 255, 0.9)'); lamp.addColorStop(1, 'rgba(255, 255, 255, 0)');
  g.fillStyle = lamp; g.fillRect(200, 110, 130, 130);
  // rocks in front, white surf bursting over them
  g.fillStyle = grey(0.14);
  g.beginPath(); g.moveTo(0, h); g.lineTo(0, 820); g.quadraticCurveTo(120, 780, 210, 830); g.quadraticCurveTo(300, 800, 380, 860);
  g.quadraticCurveTo(520, 850, 600, 900); g.quadraticCurveTo(680, 880, w, 910); g.lineTo(w, h); g.fill();
  for (let i = 0; i < 260; i++) { // spray: small drops, thicker low down where the wave breaks
    const x = 110 + r() * 540, k = r(), y = 900 - 150 * k * k + Math.abs(x - 380) * 0.1, s = 3 + (1 - k) * 12 * r();
    g.fillStyle = `rgba(255, 255, 255, ${0.25 + 0.45 * r()})`; g.beginPath(); g.ellipse(x, y, s * 1.4, s, -0.3, 0, TAU); g.fill();
  }
  // the thick border all lithophanes have, and a soft oval vignette inside it
  const vig = g.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.62);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)'); vig.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
  g.fillStyle = vig; g.fillRect(0, 0, w, h);
  g.strokeStyle = grey(0.2); g.lineWidth = 36; g.strokeRect(0, 0, w, h);
  g.strokeStyle = grey(0.55); g.lineWidth = 4; g.strokeRect(26, 26, w - 52, h - 52);
  const soft = canvas(P.w, P.h), sg = soft.getContext('2d'); // carving rounds every edge a little
  sg.filter = 'blur(1.5px)'; sg.drawImage(c, 0, 0);
  return soft;
}

export default {
  name: 'Lithophane',
  ko: '리토판',
  tex(ctx, t, W, H) {
    if (!pic) {
      pic = picture();
      const d = pic.getContext('2d').getImageData(0, 0, P.w, P.h).data;
      lum = new Float32Array(P.w * P.h);
      for (let i = 0; i < lum.length; i++) lum[i] = d[i * 4] / 255;
    }
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(pic, P.x, P.y);
  },
  uniforms: t => ({ uBack: back(t), uPlate: [P.x, 1920 - P.y - P.h, P.w, P.h] }),
  frag: `
uniform float uBack;
uniform vec4 uPlate;  // x, y (from the bottom), w, h
float L(vec2 p) { return texture(uTex, p / uRes).r; }
void main() {
  vec2 p = gl_FragCoord.xy, c = uPlate.xy + uPlate.zw * 0.5;
  vec2 q = abs(p - c) - uPlate.zw * 0.5;
  float out_ = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);          // distance outside the plate (px)
  float front = 1.0 - 0.85 * uBack;
  // the room: a dim wall, lit softly by the front light, and the lamp's glow leaking round the plate's edges
  vec2 v = (p - vec2(540.0, 1100.0)) / vec2(900.0, 1300.0);
  vec3 col = mix(vec3(0.045, 0.042, 0.04), vec3(0.16, 0.15, 0.14), front) * (1.0 - 0.6 * dot(v, v));
  col += uBack * vec3(1.0, 0.62, 0.3) * 0.28 * exp(-max(out_, 0.0) / 70.0);
  if (out_ < 0.0) {
    // light scatters inside the porcelain, so the picture is a little soft: average 13 taps over 3 px
    float l = L(p) * 0.2;
    for (int i = 0; i < 12; i++) { float a = float(i) * TAU / 12.0; l += L(p + 3.0 * vec2(cos(a), sin(a))) * (0.8 / 12.0); }
    float d = ${D0} + ${(D1 - D0).toFixed(2)} * (1.0 - l);
    float T = exp(-${SIGMA} * (d - ${D0}));
    vec3 lit = vec3(1.0, 0.78, 0.5) * pow(T, 0.9) * 1.08 + vec3(0.03, 0.012, 0.0);
    // front light: white porcelain; the carving on the back shows only as the faintest emboss
    vec2 gr = vec2(L(p + vec2(2.0, 0.0)) - L(p - vec2(2.0, 0.0)), L(p + vec2(0.0, 2.0)) - L(p - vec2(0.0, 2.0)));
    float emb = dot(normalize(vec3(-gr * 0.5, 1.0)), normalize(vec3(-0.45, 0.5, 0.74)));
    vec2 uv = (p - uPlate.xy) / uPlate.zw;
    vec3 white = vec3(0.92, 0.91, 0.88) * (0.9 + 0.08 * uv.y - 0.04 * uv.x) * (0.86 + 0.14 * emb / 0.74) + vec3(0.02);
    col = white * front + lit * uBack;
  }
  outColor = vec4(col, 1.0);
}`,
  overlay(ctx, t, W, H) {
    const b = back(t), f = 1 - 0.85 * b, sy = scanY(t);
    // a slim walnut frame round the plate
    ctx.strokeStyle = '#3B2A1E'; ctx.lineWidth = 16; ctx.strokeRect(P.x - 8, P.y - 8, P.w + 16, P.h + 16);
    ctx.strokeStyle = 'rgba(255, 220, 180, 0.18)'; ctx.lineWidth = 2; ctx.strokeRect(P.x - 15, P.y - 15, P.w + 30, P.h + 30);
    // the line the cross-section is taken along
    ctx.strokeStyle = 'rgba(255, 120, 60, 0.95)'; ctx.lineWidth = 3; ctx.setLineDash([14, 10]);
    ctx.beginPath(); ctx.moveTo(P.x, sy); ctx.lineTo(P.x + P.w, sy); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#FF7A3C';
    for (const [x, s] of [[P.x - 20, 1], [P.x + P.w + 20, -1]]) { ctx.beginPath(); ctx.moveTo(x + s * 4, sy); ctx.lineTo(x - s * 14, sy - 11); ctx.lineTo(x - s * 14, sy + 11); ctx.fill(); }

    // which light is on: two fixed pills, the lit one glows
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    [['Front light · 앞 조명', 340, f, '#E8E4DA'], ['Backlight · 뒤 조명', 740, b, '#FFB866']].forEach(([s, x, on, c]) => {
      ctx.globalAlpha = 0.35 + 0.65 * on;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'; ctx.strokeStyle = c; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(x - 165, 1322, 330, 54, 27); ctx.fill(); ctx.stroke();
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x - 130, 1349, 8, 0, TAU); ctx.fill();
      ctx.font = `600 26px ${FONT.sans}`; ctx.fillText(s, x + 12, 1350);
    });
    ctx.globalAlpha = 1;

    // the cross-section along the line: what you see on top, the plate's profile, the lamp's rays from below
    const row = Math.min(P.h - 1, Math.max(0, Math.round(sy - P.y)));
    const at = x => { // lightness at plate column x, a little smoothed
      let s = 0; for (let k = -2; k <= 2; k++) s += lum[row * P.w + Math.min(P.w - 1, Math.max(0, x + k * 2))];
      return s / 5;
    };
    const top = SEC.y, mm = SEC.mm;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = `700 26px ${FONT.sans}`; ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillText('Cross-section at the line · 선 위치 단면', SEC.x, 1420);
    for (let x = 0; x < P.w; x += 4) { // what you see along the line
      const l = at(x), T = through(l), wv = 0.92 * f + 0;
      const rr = Math.min(255, 255 * (wv * 0.92 + b * 1.08 * Math.pow(T, 0.9))), gg = Math.min(255, 255 * (wv * 0.91 + b * 0.84 * Math.pow(T, 0.9))), bb = Math.min(255, 255 * (wv * 0.88 + b * 0.54 * Math.pow(T, 0.9)));
      ctx.fillStyle = `rgb(${rr | 0}, ${gg | 0}, ${bb | 0})`; ctx.fillRect(SEC.x + x, 1436, 4, 34);
    }
    // backlight rays: up from the lamp, through the plate, thinned by its thickness
    if (b > 0.001) {
      for (let x = 12; x < P.w; x += 24) {
        const l = at(x), d = thick(l), T = through(l), X = SEC.x + x;
        ctx.strokeStyle = `rgba(255, 190, 110, ${0.55 * b})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(X, 1700); ctx.lineTo(X, top + d * mm); ctx.stroke();
        ctx.strokeStyle = `rgba(255, 200, 130, ${0.9 * b * T})`;
        ctx.beginPath(); ctx.moveTo(X, top); ctx.lineTo(X, 1478); ctx.stroke();
      }
    }
    // front light: from the viewer's side, bouncing off the flat front face the same everywhere
    if (f > 0.2) {
      ctx.strokeStyle = `rgba(232, 228, 218, ${0.5 * (f - 0.2) / 0.8})`; ctx.lineWidth = 2;
      for (let x = 60; x < P.w; x += 120) { const X = SEC.x + x; ctx.beginPath(); ctx.moveTo(X - 26, top - 30); ctx.lineTo(X, top - 2); ctx.lineTo(X + 26, top - 30); ctx.stroke(); }
    }
    ctx.beginPath(); ctx.moveTo(SEC.x, top); // the profile: flat front face, carved back
    for (let x = 0; x <= P.w; x += 3) ctx.lineTo(SEC.x + x, top + thick(at(Math.min(x, P.w - 1))) * mm);
    ctx.lineTo(SEC.x + P.w, top); ctx.closePath();
    const por = ctx.createLinearGradient(0, top, 0, top + D1 * mm);
    por.addColorStop(0, `rgb(${236 - 40 * b | 0}, ${233 - 60 * b | 0}, ${226 - 90 * b | 0})`); por.addColorStop(1, `rgb(${200 - 20 * b | 0}, ${196 - 50 * b | 0}, ${188 - 90 * b | 0})`);
    ctx.fillStyle = por; ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'; ctx.lineWidth = 2; ctx.stroke();
    // the lamp
    const lampG = ctx.createLinearGradient(0, 1690, 0, 1730);
    lampG.addColorStop(0, `rgba(255, 190, 110, ${0.25 + 0.75 * b})`); lampG.addColorStop(1, `rgba(255, 150, 70, ${0.1 + 0.3 * b})`);
    ctx.fillStyle = lampG; ctx.beginPath(); ctx.roundRect(SEC.x, 1698, P.w, 22, 11); ctx.fill();
    // labels: fixed places, never on top of each other
    ctx.font = `500 23px ${FONT.ko}`; ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.textAlign = 'right'; ctx.fillText('what you see · 보이는 빛', SEC.x + P.w, 1420);
    ctx.textAlign = 'left'; ctx.fillText('lamp behind · 뒤 조명', SEC.x, 1760);
    ctx.textAlign = 'right'; ctx.fillText(`${D0} mm thin → bright · ${D1.toFixed(1)} mm thick → dark`, SEC.x + P.w, 1760);
    ctx.textAlign = 'right'; ctx.fillText('얇으면 밝고, 두꺼우면 어둡다', SEC.x + P.w, 1796);
  },
};
