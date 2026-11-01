// Colour grading: one daylight picture (painted once) is graded through five looks in turn: original, teal & orange,
// bleach bypass, film print and day for night. A wipe line carries each new look across the picture, and below it a
// 6 x 6 x 6 lattice of the RGB cube is pushed through the same grade, so you see the look as a warp of colour space,
// which is what a 3D LUT stores. The same grade() runs in the shader (the picture) and in JS (the cube).
import { TAU, clamp, lerp, span, rng, fbm3, canvas, FONT } from '../lib/util.js';

const PIC = 1300; // the picture fills y 0 .. 1300; the grading panel is below
const LOOKS = [['ORIGINAL', '원본'], ['TEAL & ORANGE', '틸 앤 오렌지'], ['BLEACH BYPASS', '블리치 바이패스'], ['FILM PRINT', '필름 프린트'], ['DAY FOR NIGHT', '데이 포 나이트']];
const HOLD = 0.4; // each second: the look holds 0.4 s, then the next one wipes across in 0.6 s

// which looks are on screen and where the wipe is (px): the new look is left of the line
function wipe(t) {
  const i = Math.floor(t) % 5, k = span(t - Math.floor(t), HOLD, 1);
  const e = k * k * (3 - 2 * k);
  return { from: i, to: (i + 1) % 5, x: k > 0 ? lerp(-40, 1120, e) : -40, k: e };
}

// ---- the grade, in JS (for the cube) and GLSL (for the picture): keep the two the same ----
const LUMA = [0.2126, 0.7152, 0.0722], AX = [0.667, -0.123, -0.737]; // AX: the orange <-> teal direction in chroma
const lum = c => c[0] * LUMA[0] + c[1] * LUMA[1] + c[2] * LUMA[2];
const sat = (c, s) => { const l = lum(c); return c.map(v => l + (v - l) * s); };
const curve = (c, k) => c.map(v => lerp(v, v * v * (3 - 2 * v), k));
function grade(c, i) {
  const l = lum(c);
  if (i === 1) { // teal & orange: keep only the orange-teal part of each colour, push it, and tint by brightness
    const ch = c.map(v => v - l), along = ch[0] * AX[0] + ch[1] * AX[1] + ch[2] * AX[2];
    c = ch.map((v, j) => l + AX[j] * (along * 1.6 + (l - 0.45) * 0.22) + (v - AX[j] * along) * 0.3);
    c = curve(c.map(v => clamp(v)), 0.4);
  } else if (i === 2) { // bleach bypass: a silver (grey) layer kept over the colour: low saturation, high contrast
    const d = sat(c, 0.32);
    c = d.map(v => lerp(v, l < 0.5 ? 2 * v * l : 1 - 2 * (1 - v) * (1 - l), 0.85));
    c = [c[0] * 0.97, c[1], c[2] * 1.03];
  } else if (i === 3) { // film print: S-curve, softer colour, warm highlights, green-blue shadows, lifted blacks
    c = sat(curve(c, 0.5), 0.82);
    c = [c[0] * 1.07, c[1] + 0.02 * (1 - l), c[2] * 0.84 + 0.05 * (1 - l)].map(v => 0.06 + 0.88 * v);
  } else if (i === 4) { // day for night: two stops down, desaturated, blue, the bright sky pulled down hardest
    c = sat(c, 0.35).map(v => Math.pow(Math.max(v, 0), 1.4) * 0.6);
    const sky = 1 - 0.45 * clamp((l - 0.55) / 0.3) * clamp((1 - l) / 0.08);
    c = [c[0] * 0.5 * sky, c[1] * 0.72 * sky + 0.01, c[2] * 1.12 * sky + 0.03];
  }
  return c.map(v => clamp(v));
}
const GRADE_GLSL = `
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722), AX = vec3(0.667, -0.123, -0.737);
vec3 sat(vec3 c, float s) { float l = dot(c, LUMA); return mix(vec3(l), c, s); }
vec3 curve(vec3 c, float k) { return mix(c, c * c * (3.0 - 2.0 * c), k); }
vec3 grade(vec3 c, int i) {
  float l = dot(c, LUMA);
  if (i == 1) {
    vec3 ch = c - l; float along = dot(ch, AX);
    c = l + AX * (along * 1.6 + (l - 0.45) * 0.22) + (ch - AX * along) * 0.3;
    c = curve(clamp(c, 0.0, 1.0), 0.4);
  } else if (i == 2) {
    vec3 d = sat(c, 0.32);
    c = mix(d, l < 0.5 ? 2.0 * d * l : 1.0 - 2.0 * (1.0 - d) * (1.0 - l), 0.85);
    c *= vec3(0.97, 1.0, 1.03);
  } else if (i == 3) {
    c = sat(curve(c, 0.5), 0.82);
    c = vec3(c.r * 1.07, c.g + 0.02 * (1.0 - l), c.b * 0.84 + 0.05 * (1.0 - l)) * 0.88 + 0.06;
  } else if (i == 4) {
    c = pow(max(sat(c, 0.35), 0.0), vec3(1.4)) * 0.6;
    float sky = 1.0 - 0.45 * clamp((l - 0.55) / 0.3, 0.0, 1.0) * clamp((1.0 - l) / 0.08, 0.0, 1.0);
    c = vec3(c.r * 0.5 * sky, c.g * 0.72 * sky + 0.01, c.b * 1.12 * sky + 0.03);
  }
  return clamp(c, 0.0, 1.0);
}`;

// ---- the picture: a lighthouse on a cliff over the sea, a beach with a striped umbrella (painted once) ----
const pic = canvas(1080, PIC);
{
  const g = pic.getContext('2d'), HZ = 690;
  const sky = g.createLinearGradient(0, 0, 0, HZ);
  sky.addColorStop(0, '#2C69B0'); sky.addColorStop(0.7, '#7FB6E3'); sky.addColorStop(1, '#CFE6F2');
  g.fillStyle = sky; g.fillRect(0, 0, 1080, HZ);
  const sun = g.createRadialGradient(250, 470, 10, 250, 470, 260);
  sun.addColorStop(0, 'rgba(255, 250, 225, 1)'); sun.addColorStop(0.12, 'rgba(255, 244, 205, 0.95)'); sun.addColorStop(1, 'rgba(255, 240, 200, 0)');
  g.fillStyle = sun; g.fillRect(0, 200, 520, 520);

  // clouds and rock texture: fbm painted per pixel at half size, then scaled up
  const tex = (w, h, fn) => { const c = canvas(w, h), x = c.getContext('2d'), img = x.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) { const o = (y * w + i) * 4, [r, gg, b, a] = fn(i, y); img.data.set([r, gg, b, a], o); }
    x.putImageData(img, 0, 0); return c; };
  const clouds = tex(540, 330, (x, y) => {
    const n = fbm3(x / 120, y / 46, 1.7, 5) + 0.35 - Math.abs(y - 150) / 260 - 0.1 * clamp((x - 250) / 150);
    const a = clamp((n - 0.05) * 3.2), shade = clamp(0.25 + (fbm3(x / 120, (y - 6) / 46, 1.7, 5) - n) * 5 + (y - 150) / 600);
    return [255 - 60 * shade, 255 - 52 * shade, 255 - 34 * shade, 255 * a];
  });
  g.drawImage(clouds, 0, 120, 1080, 660);

  g.fillStyle = '#8AA2B4'; g.beginPath(); g.moveTo(0, HZ); // a far headland on the left
  for (let x = 0; x <= 360; x += 10) g.lineTo(x, HZ - 46 * Math.sin(Math.PI * x / 360) ** 0.6 - 6 * fbm3(x / 50, 3, 0));
  g.lineTo(360, HZ); g.fill();

  const sea = g.createLinearGradient(0, HZ, 0, 1030);
  sea.addColorStop(0, '#1F5C8E'); sea.addColorStop(0.55, '#21809F'); sea.addColorStop(1, '#3BB3AE');
  g.fillStyle = sea; g.fillRect(0, HZ, 1080, 340);
  const r = rng(262);
  for (let i = 0; i < 420; i++) { // fixed wave glints, gathered in the sun's path
    const y = HZ + 4 + r() ** 1.5 * 320, x = 250 + (r() - 0.5) * (240 + 1.6 * (y - HZ)) * (r() < 0.75 ? 1 : 3);
    const near = Math.exp(-(((x - 250) / (160 + y - HZ)) ** 2)), d = (y - HZ) / 320;
    g.fillStyle = `rgba(255, 248, 225, ${0.08 + 0.55 * near * (1 - 0.6 * d)})`;
    g.beginPath(); g.ellipse(x, y, 6 + r() * 26 * (0.3 + d), 1 + 1.5 * d, 0, 0, TAU); g.fill();
  }

  // the cliff: ochre rock with dark cracks, a grass cap, in shade on its left face
  const rock = tex(270, 250, (x, y) => { // layered strata, bent a little, with grit and a few soft cracks
    const strata = Math.sin((y + 14 * fbm3(x / 40, y / 30, 2.2, 3)) / 4.2), n = fbm3(x / 14, y / 8, 4.2, 4);
    const crack = 1 - 0.25 * clamp(1 - Math.abs(fbm3(x / 30, y / 60, 9.1, 3)) / 0.025);
    const v = (0.86 + 0.1 * strata + 0.22 * n) * crack;
    return [182 * v, 124 * v, 78 * v, 255];
  });
  g.save();
  g.beginPath(); g.moveTo(560, 1040); g.lineTo(600, 900); g.lineTo(640, 760); g.lineTo(690, 640); g.lineTo(760, 585);
  g.lineTo(1080, 570); g.lineTo(1080, 1040); g.closePath(); g.clip();
  g.drawImage(rock, 540, 560, 540, 500);
  const shade = g.createLinearGradient(560, 0, 820, 0);
  shade.addColorStop(0, 'rgba(40, 24, 30, 0.55)'); shade.addColorStop(1, 'rgba(40, 24, 30, 0)');
  g.fillStyle = shade; g.fillRect(540, 560, 300, 500);
  g.restore();
  const grass = g.createLinearGradient(0, 570, 0, 640);
  grass.addColorStop(0, '#7DB04A'); grass.addColorStop(1, '#4A7A2C');
  g.fillStyle = grass; g.beginPath(); g.moveTo(745, 600);
  for (let x = 745; x <= 1080; x += 12) g.lineTo(x, 584 - 10 * Math.sin(x / 40) - 6 * fbm3(x / 30, 1, 2));
  g.lineTo(1080, 640); g.lineTo(745, 612); g.fill();

  // the lighthouse: white tower with red bands, shaded as a cylinder, a black lantern with a warm light
  const tx = 880, top = 330, base = 590, rTop = 34, rBase = 52;
  const body = g.createLinearGradient(tx - rBase, 0, tx + rBase, 0);
  body.addColorStop(0, '#9FA6B5'); body.addColorStop(0.35, '#FFFFFF'); body.addColorStop(1, '#C4C9D3');
  const band = g.createLinearGradient(tx - rBase, 0, tx + rBase, 0);
  band.addColorStop(0, '#8E1F24'); band.addColorStop(0.35, '#E0393E'); band.addColorStop(1, '#A62A2F');
  const half = y => lerp(rTop, rBase, (y - top) / (base - top));
  for (let y = top; y < base; y += 2) {
    g.fillStyle = Math.floor((y - top) / 52) % 2 ? band : body;
    g.fillRect(tx - half(y), y, 2 * half(y), 2.5);
  }
  g.fillStyle = '#23262E'; g.fillRect(tx - 46, top - 10, 92, 12); g.fillRect(tx - 28, top - 62, 56, 54);
  g.fillStyle = '#FFE7A0'; g.fillRect(tx - 20, top - 54, 40, 36);
  g.fillStyle = '#B5262B'; g.beginPath(); g.moveTo(tx - 36, top - 62); g.lineTo(tx, top - 96); g.lineTo(tx + 36, top - 62); g.fill();

  // the beach: dry sand, darker wet sand and a foam line along the water
  const sand = g.createLinearGradient(0, 1000, 0, PIC);
  sand.addColorStop(0, '#C9A57A'); sand.addColorStop(0.15, '#E6CBA0'); sand.addColorStop(1, '#D9B482');
  g.fillStyle = sand; g.beginPath(); g.moveTo(0, PIC);
  for (let x = 0; x <= 1080; x += 10) g.lineTo(x, 1010 + 14 * Math.sin(x / 90) + 8 * fbm3(x / 60, 5, 1));
  g.lineTo(1080, PIC); g.fill();
  g.strokeStyle = 'rgba(255, 255, 255, 0.85)'; g.lineWidth = 7; g.beginPath();
  for (let x = 0; x <= 1080; x += 10) { const y = 1012 + 14 * Math.sin(x / 90) + 8 * fbm3(x / 60, 5, 1); x ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
  for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(120, 85, 50, ${0.05 + r() * 0.1})`; g.fillRect(r() * 1080, 1040 + r() * 260, 2, 2); }

  // a striped umbrella, its shadow and a yellow towel
  g.fillStyle = 'rgba(90, 60, 40, 0.28)'; g.beginPath(); g.ellipse(400, 1238, 170, 30, 0, 0, TAU); g.fill();
  g.fillStyle = '#F2C230'; g.save(); g.translate(250, 1200); g.rotate(-0.08); g.fillRect(-90, -24, 180, 48);
  g.fillStyle = '#2B6CB0'; g.fillRect(-90, -24, 180, 8); g.fillRect(-90, 16, 180, 8); g.restore();
  g.strokeStyle = '#EDE6DA'; g.lineWidth = 8; g.beginPath(); g.moveTo(330, 1240); g.lineTo(312, 1010); g.stroke();
  for (let k = 0; k < 6; k++) {
    const a0 = Math.PI + (k / 6) * Math.PI, a1 = Math.PI + ((k + 1) / 6) * Math.PI;
    g.fillStyle = k % 2 ? '#F5F1E8' : '#E2373F';
    g.beginPath(); g.moveTo(312, 1000);
    g.ellipse(312, 1012, 170, 70, -0.08, a0, a1); g.closePath(); g.fill();
  }
}

// the RGB lattice for the cube
const LATTICE = [];
for (let r = 0; r < 6; r++) for (let gr = 0; gr < 6; gr++) for (let b = 0; b < 6; b++) LATTICE.push([r / 5, gr / 5, b / 5]);
const EDGES = [[0, 1], [0, 2], [0, 4], [1, 3], [1, 5], [2, 3], [2, 6], [3, 7], [4, 5], [4, 6], [5, 7], [6, 7]];
const CORNER = i => [(i >> 2) & 1, (i >> 1) & 1, i & 1];

export default {
  name: 'Color Grading',
  ko: '색 보정 (LUT)',
  tex(ctx) { ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, 1080, 1920); ctx.drawImage(pic, 0, 0); },
  uniforms(t) { const w = wipe(t); return { uFrom: w.from, uTo: w.to, uWipe: w.x }; },
  frag: GRADE_GLSL + `
uniform float uFrom, uTo, uWipe;
void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec3 c = texture(uTex, gl_FragCoord.xy / uRes).rgb;
  outColor = vec4(grade(c, int(p.x < uWipe ? uTo : uFrom)), 1.0);
}`,
  overlay(ctx, t, W, H) {
    const w = wipe(t);
    // the panel under the picture
    const bg = ctx.createLinearGradient(0, PIC, 0, H);
    bg.addColorStop(0, '#16171D'); bg.addColorStop(1, '#0D0E12');
    ctx.fillStyle = bg; ctx.fillRect(0, PIC, W, H - PIC);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'; ctx.fillRect(0, PIC, W, 2);

    // the wipe line and its handle
    if (w.k > 0 && w.k < 1) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; ctx.fillRect(w.x - 2, 0, 4, PIC);
      ctx.beginPath(); ctx.arc(w.x, 1150, 22, 0, TAU); ctx.fill();
      ctx.fillStyle = '#16171D'; ctx.font = `700 22px ${FONT.sans}`; ctx.textAlign = 'center'; ctx.fillText('‹ ›', w.x, 1158);
    }
    // the look names, always whole and inside the frame: the old one sits at the bottom left until the line pushes it
    // along 40 px ahead of itself and it fades out before reaching the right margin; the new one fades in at the bottom
    // left once the line has passed it by 40 px, which is where it stays through the next hold
    ctx.font = `800 30px ${FONT.sans}`; ctx.textAlign = 'left';
    const name = (i, x, a) => {
      if (a <= 0.004) return;
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'; ctx.fillText(LOOKS[i][0], x + 2, 1262);
      ctx.fillStyle = '#FFFFFF'; ctx.fillText(LOOKS[i][0], x, 1260);
      ctx.globalAlpha = 1;
    };
    const wOld = ctx.measureText(LOOKS[w.from][0]).width, wNew = ctx.measureText(LOOKS[w.to][0]).width, sm = k => k * k * (3 - 2 * k);
    const xOld = Math.min(Math.max(40, w.x + 40), W - 40 - wOld);
    name(w.from, xOld, 1 - sm(clamp((w.x + 40 - (W - 120 - wOld)) / 80)));
    name(w.to, 40, sm(clamp((w.x - (80 + wNew)) / 80)));

    // the LUT cube: the 6 x 6 x 6 lattice of input colours, each moved to (and drawn in) its graded colour
    const cx = 290, cy = 1640, s = 255, yaw = -0.6 + TAU * t / 5, pitch = 0.5;
    const proj = ([r, g, b]) => {
      const x = r - 0.5, y = g - 0.5, z = b - 0.5;
      const x1 = x * Math.cos(yaw) + z * Math.sin(yaw), z1 = -x * Math.sin(yaw) + z * Math.cos(yaw);
      const y2 = y * Math.cos(pitch) - z1 * Math.sin(pitch), z2 = y * Math.sin(pitch) + z1 * Math.cos(pitch);
      const k = 1 / (1 + 0.25 * z2);
      return [cx + x1 * s * k, cy - y2 * s * k, z2];
    };
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)'; ctx.lineWidth = 2;
    for (const [a, b] of EDGES) { const p = proj(CORNER(a)), q = proj(CORNER(b)); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); }
    const pts = LATTICE.map(c => {
      const a = grade(c, w.from), b = grade(c, w.to), o = a.map((v, j) => lerp(v, b[j], w.k));
      return [...proj(o), o];
    }).sort((p, q) => q[2] - p[2]);
    for (const [x, y, z, o] of pts) {
      ctx.fillStyle = `rgb(${o[0] * 255 | 0}, ${o[1] * 255 | 0}, ${o[2] * 255 | 0})`;
      ctx.beginPath(); ctx.arc(x, y, 9 - 3 * z, 0, TAU); ctx.fill();
    }
    ctx.font = `700 24px ${FONT.mono}`; ctx.textAlign = 'center';
    for (const [i, label, col] of [[4, 'R', '#FF6B6B'], [2, 'G', '#6BE38B'], [1, 'B', '#6BA8FF']]) {
      const p = proj(CORNER(i).map(v => 0.5 + (v - 0.5) * 1.18));
      ctx.fillStyle = col; ctx.fillText(label, p[0], p[1] + 8);
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'; ctx.font = `500 22px ${FONT.mono}`; ctx.textAlign = 'left';
    ctx.fillText('3D LUT · 6×6×6 of it', 40, 1352);

    // the list of looks: the one on screen lit, the incoming one filling as the wipe crosses
    ctx.textAlign = 'left';
    LOOKS.forEach(([en, ko], i) => {
      const y = 1420 + i * 84, on = i === w.to ? w.k : i === w.from ? 1 - w.k : 0;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.05 + 0.08 * on})`;
      ctx.beginPath(); ctx.roundRect(580, y - 42, 460, 70, 14); ctx.fill();
      for (let j = 0; j < 8; j++) { // a swatch: a hue strip through this look
        const c = grade([0.5 + 0.45 * Math.cos(j / 8 * TAU), 0.5 + 0.45 * Math.cos(j / 8 * TAU - 2.1), 0.5 + 0.45 * Math.cos(j / 8 * TAU + 2.1)], i);
        ctx.fillStyle = `rgb(${c[0] * 255 | 0}, ${c[1] * 255 | 0}, ${c[2] * 255 | 0})`; ctx.fillRect(600 + j * 14, y - 22, 14, 30);
      }
      ctx.fillStyle = `rgba(255, 255, 255, ${0.45 + 0.55 * on})`; ctx.font = `700 28px ${FONT.sans}`; ctx.fillText(en, 734, y - 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + 0.4 * on})`; ctx.font = `500 22px ${FONT.ko}`; ctx.fillText(ko, 734, y + 24);
    });
  },
};
