// CRT: the TV, the room and the picture are drawn flat into a canvas; the shader bends the tube (barrel warp),
// lays fixed scanlines and an RGB phosphor mask over it, adds phosphor glow and one bright band rolling slowly down.
import { TAU, FONT, phase } from '../lib/util.js';
import { landscape } from '../lib/scenes.js';

const SX = 140, SY = 500, SW = 800, SHH = 600; // the tube (top-left origin px)

export default {
  name: 'CRT Monitor',
  ko: 'CRT 모니터',
  tex(ctx, t, W, H) {
    const wall = ctx.createLinearGradient(0, 0, 0, H);
    wall.addColorStop(0, '#15172B'); wall.addColorStop(1, '#2A2142');
    ctx.fillStyle = wall; ctx.fillRect(0, 0, W, H);
    const spill = ctx.createRadialGradient(540, 800, 200, 540, 800, 900);
    spill.addColorStop(0, 'rgba(255, 130, 160, 0.35)'); spill.addColorStop(1, 'rgba(255, 130, 160, 0)');
    ctx.fillStyle = spill; ctx.fillRect(0, 0, W, H);
    const table = ctx.createLinearGradient(0, 1560, 0, H);
    table.addColorStop(0, '#5A3828'); table.addColorStop(1, '#24150F');
    ctx.fillStyle = table; ctx.fillRect(0, 1560, W, H - 1560);           // table, with the TV's soft shadow
    const shade = ctx.createRadialGradient(540, 1575, 50, 540, 1575, 560);
    shade.addColorStop(0, 'rgba(0, 0, 0, 0.45)'); shade.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = shade; ctx.fillRect(0, 1560, W, 300);
    ctx.fillStyle = '#7A4E38'; ctx.fillRect(0, 1560, W, 8);

    ctx.strokeStyle = '#9A9AA8'; ctx.lineWidth = 8; ctx.lineCap = 'round';  // antenna
    ctx.beginPath(); ctx.moveTo(540, 440); ctx.lineTo(370, 300); ctx.moveTo(540, 440); ctx.lineTo(720, 310); ctx.stroke();
    ctx.fillStyle = '#3A3530'; ctx.beginPath(); ctx.ellipse(540, 445, 70, 34, 0, Math.PI, TAU); ctx.fill();
    const body = ctx.createLinearGradient(0, 440, 0, 1520);
    body.addColorStop(0, '#E4D6BE'); body.addColorStop(1, '#B4A288');
    ctx.fillStyle = body; ctx.beginPath(); ctx.roundRect(70, 440, 940, 1080, 64); ctx.fill();
    ctx.fillStyle = '#8F7F68'; ctx.fillRect(150, 1530, 130, 30); ctx.fillRect(800, 1530, 130, 30); // feet
    ctx.fillStyle = '#26221E'; ctx.beginPath(); ctx.roundRect(SX - 30, SY - 30, SW + 60, SHH + 60, 48); ctx.fill();
    ctx.fillStyle = '#8E7F6A';
    for (let y = 1190; y < 1450; y += 22) { ctx.beginPath(); ctx.roundRect(150, y, 480, 9, 4); ctx.fill(); } // speaker
    for (const [y, r] of [[1250, 62], [1400, 46]]) { // knobs
      const k = ctx.createRadialGradient(800 - r * 0.3, y - r * 0.3, 4, 800, y, r);
      k.addColorStop(0, '#5A524A'); k.addColorStop(1, '#1E1A17');
      ctx.fillStyle = k; ctx.beginPath(); ctx.arc(800, y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#D9CBB4'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(800, y); ctx.lineTo(800 + r * 0.7, y - r * 0.7); ctx.stroke();
    }
    ctx.save(); // the picture on the tube: the sunset, an on-screen display and a news ticker
    ctx.translate(SX, SY);
    ctx.beginPath(); ctx.rect(0, 0, SW, SHH); ctx.clip();
    landscape(ctx, SW, SHH, t);
    ctx.font = `700 46px ${FONT.mono}`; ctx.fillStyle = '#6CFF8A';
    ctx.fillText('CH 03', 44, 78);
    ctx.fillText('PLAY ▶', 560, 78);
    ctx.fillStyle = 'rgba(20, 10, 40, 0.8)'; ctx.fillRect(0, 486, SW, 70);
    ctx.font = `700 40px ${FONT.mono}`; ctx.fillStyle = '#FFE17A';
    const news = ' ★ LIVE FROM THE SUNSET COAST  ★ WEATHER: WARM AND GLOWING ', w = ctx.measureText(news).width;
    for (let x = -phase(t) * w; x < SW; x += w) ctx.fillText(news, x, 535); // one text width per loop
    ctx.restore();
  },
  frag: `
const vec2 SC = vec2(540.0, 800.0), SH = vec2(400.0, 300.0); // tube centre and half size, top-left origin px
vec3 pic(vec2 p) { return texture(uTex, vec2(p.x / uRes.x, 1.0 - p.y / uRes.y)).rgb; }
float roundBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 q = (p - SC) / SH;
  float inTube = 1.0 - smoothstep(-1.5, 1.5, roundBox(p - SC, SH + 8.0, 44.0));
  vec3 col = pic(p);
  if (inTube > 0.0) {
    vec2 d = q * (1.0 + 0.09 * dot(q, q));              // barrel warp: the picture bulges, edges curve away
    vec2 cp = SC + d * SH;
    float inside = step(abs(d.x), 1.0) * step(abs(d.y), 1.0);
    vec3 c = pic(cp) * inside, glow = vec3(0.0);
    for (int i = 0; i < 8; i++) { float a = float(i) * TAU / 8.0; glow += pic(cp + 9.0 * vec2(cos(a), sin(a))); }
    glow *= inside / 8.0;
    float v = d.y * 0.5 + 0.5;
    float lum = dot(c, vec3(0.3, 0.6, 0.1));
    float scan = mix(0.35 + 0.5 * lum, 1.0, pow(abs(cos(v * 120.0 * PI)), 1.5)); // fixed scanlines, bright lines bloom
    int m = int(mod(gl_FragCoord.x, 3.0));                 // fixed aperture-grille stripes
    vec3 mask = vec3(m == 0 ? 1.0 : 0.8, m == 1 ? 1.0 : 0.8, m == 2 ? 1.0 : 0.8);
    float band = exp(-pow((v - (fract(uPhase) * 1.6 - 0.3)) / 0.07, 2.0)); // one soft band rolls down per loop
    vec3 screen = c * scan * mask * 1.2 + glow * 0.32 + band * 0.2 * (0.4 + lum);
    screen *= 1.0 - 0.45 * pow(dot(d, d) / 2.0, 1.5);   // darker towards the curved edges
    screen += 0.07 * smoothstep(0.5, 0.0, length((q - vec2(-0.45, -0.55)) * vec2(1.0, 1.6))); // glass glint
    col = mix(col, screen, inTube);
  }
  outColor = vec4(col, 1.0);
}`,
};
