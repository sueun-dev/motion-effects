// Raycasting (Wolfenstein 3D style): a grid maze that repeats every 6 rows. For every screen column one ray leaves
// the player and walks the grid with DDA (always stepping to the nearer of the next vertical or horizontal grid
// line) until it enters a wall cell; the column then gets a wall slice of height H / perpendicular distance, with
// the texture column at the hit point. The shader does exactly that for the view (2 x 2 samples per pixel, spread
// over the frame time, and far texels fade to the texture's average so they never shimmer); the map below runs the
// same DDA in JS for the fan of rays. A cursor sweeps the columns twice a loop; the column it is casting lights up,
// and the same ray is drawn on the map with its grid crossings. The player walks one maze period per loop.
import { TAU, FONT, phase } from '../lib/util.js';

const VX = 40, VY = 300, VW = 1000, VH = 760;            // the 3D view
const MX = 40, MY = 1130, MW = 1000, MH = 730, CS = 74;   // the map panel and its cell size
const PLANE = 0.66;                                       // camera plane half-length: a 66° field of view
const COLS = 13, ROWS = 6;
const MAP = [                                             // 1 grey stone, 2 blue stone, 3 wood, 4 red brick pillar
  1, 1, 1, 1, 1, 0, 0, 0, 3, 3, 3, 3, 3,
  1, 0, 0, 0, 1, 0, 0, 0, 3, 0, 0, 0, 3,
  1, 0, 4, 0, 0, 0, 0, 0, 0, 0, 4, 0, 3,
  1, 0, 0, 0, 1, 0, 0, 0, 3, 0, 0, 0, 3,
  2, 2, 0, 2, 2, 0, 0, 0, 2, 2, 0, 2, 2,
  2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2,
];
const cell = (x, y) => (x < 0 || x >= COLS ? 1 : MAP[(((y % ROWS) + ROWS) % ROWS) * COLS + x]);
const WALL = ['', '#8E8E98', '#4F68C0', '#94623A', '#B04A3E'];

// the player: walks up the middle hall one period (6 rows) per loop, glancing left and right
const player = t => {
  const a = 0.22 * Math.sin(phase(t) * TAU + 0.6);
  return { x: 6.5 + 0.15 * Math.sin(phase(t) * TAU), y: 3.5 - ROWS * phase(t), dx: Math.sin(a), dy: -Math.cos(a), px: Math.cos(a) * PLANE, py: Math.sin(a) * PLANE };
};
const GLSL_PLAYER = `
void player(float t, out vec2 pos, out vec2 dir, out vec2 plane) {
  float ph = t / 5.0, a = 0.22 * sin(ph * TAU + 0.6);
  pos = vec2(6.5 + 0.15 * sin(ph * TAU), 3.5 - ${ROWS}.0 * ph);
  dir = vec2(sin(a), -cos(a)); plane = vec2(cos(a), sin(a)) * ${PLANE};
}`;
const cursor = t => (2 * t / 5) % 1;                      // 0..1 across the view, twice per loop

// DDA in JS: the hit and every grid line crossed on the way
function cast(p, rx, ry) {
  let mx = Math.floor(p.x), my = Math.floor(p.y);
  const ddx = Math.abs(1 / rx), ddy = Math.abs(1 / ry), sx = rx < 0 ? -1 : 1, sy = ry < 0 ? -1 : 1;
  let tx = (rx < 0 ? p.x - mx : mx + 1 - p.x) * ddx, ty = (ry < 0 ? p.y - my : my + 1 - p.y) * ddy, side = 0;
  const steps = [];
  for (let i = 0; i < 40; i++) {
    if (tx < ty) { steps.push([tx, 0]); tx += ddx; mx += sx; side = 0; } else { steps.push([ty, 1]); ty += ddy; my += sy; side = 1; }
    if (cell(mx, my)) break;
  }
  const d = steps[steps.length - 1][0];
  return { d, side, mx, my, steps, perp: d };
}

export default {
  name: 'Raycasting',
  ko: '레이캐스팅',
  frag: `
const int COLS = ${COLS}, ROWS = ${ROWS};
const int MAPD[${COLS * ROWS}] = int[${COLS * ROWS}](${MAP.join(', ')});
int cell(ivec2 p) { if (p.x < 0 || p.x >= COLS) return 1; return MAPD[(((p.y % ROWS) + ROWS) % ROWS) * COLS + p.x]; }
${GLSL_PLAYER}
// 64 x 64 pixel-art wall textures
vec3 base(int id) { return id == 1 ? vec3(0.56, 0.56, 0.60) : id == 2 ? vec3(0.27, 0.36, 0.68) : id == 3 ? vec3(0.56, 0.35, 0.19) : vec3(0.66, 0.26, 0.21); }
vec3 texel(int id, vec2 uv) {
  vec2 t = floor(uv * 64.0);
  if (id == 3) {                                                  // wood: vertical planks, rounded in the middle
    float plank = floor(t.x / 16.0), lx = mod(t.x, 16.0);
    vec3 c = base(3) * (0.86 + 0.24 * hash12(vec2(plank, 7.0))) * (1.0 + 0.08 * sin((lx + 0.5) / 16.0 * PI));
    return lx < 2.0 || mod(t.y + plank * 21.0, 64.0) < 2.0 ? c * 0.6 : c;
  }
  float bh = id == 4 ? 8.0 : 16.0, bw = id == 4 ? 16.0 : 32.0;    // stone blocks or small bricks
  float row = floor(t.y / bh), off = mod(row, 2.0) * bw * 0.5;
  float col = floor((t.x + off) / bw);
  vec2 l = vec2(mod(t.x + off, bw), mod(t.y, bh));
  vec3 c = base(id) * (0.8 + 0.34 * hash12(vec2(col + float(id) * 17.0, row)));
  if (l.y < 2.0 || l.x < 2.0) return c * 0.55;                     // mortar
  if (l.y < 4.0 || l.x < 4.0) return c * 1.08;                     // lit top-left bevel
  if (l.y > bh - 3.0 || l.x > bw - 3.0) return c * 0.88;           // shaded bottom-right bevel
  return c;
}
// one ray: DDA through the grid, then the wall slice, ceiling or floor at this pixel (s: view px, y down)
vec3 render(vec2 s, float t) {
  vec2 pos, dir, plane; player(t, pos, dir, plane);
  float camX = 2.0 * s.x / ${VW}.0 - 1.0;
  vec2 rd = dir + plane * camX;
  ivec2 m = ivec2(floor(pos));
  vec2 dd = abs(1.0 / rd);
  ivec2 st = ivec2(rd.x < 0.0 ? -1 : 1, rd.y < 0.0 ? -1 : 1);
  vec2 sd = vec2(rd.x < 0.0 ? pos.x - float(m.x) : float(m.x) + 1.0 - pos.x, rd.y < 0.0 ? pos.y - float(m.y) : float(m.y) + 1.0 - pos.y) * dd;
  int side = 0, id = 0;
  for (int i = 0; i < 64; i++) {
    if (sd.x < sd.y) { sd.x += dd.x; m.x += st.x; side = 0; } else { sd.y += dd.y; m.y += st.y; side = 1; }
    id = cell(m);
    if (id > 0) break;
  }
  float perp = side == 0 ? sd.x - dd.x : sd.y - dd.y;
  float lineH = ${VH}.0 / perp, top = ${VH / 2}.0 - lineH * 0.5;
  float fog = 1.0 - exp(-perp / 16.0);
  if (id == 0 || s.y < top || s.y > top + lineH) {                 // flat ceiling and floor, darker towards the middle
    float k = abs(s.y - ${VH / 2}.0) / ${VH / 2}.0;
    return s.y < ${VH / 2}.0 ? mix(vec3(0.07, 0.07, 0.10), vec3(0.20, 0.21, 0.27), k) : mix(vec3(0.10, 0.09, 0.08), vec3(0.47, 0.44, 0.40), k);
  }
  float wx = side == 0 ? pos.y + perp * rd.y : pos.x + perp * rd.x;
  wx -= floor(wx);
  if ((side == 0 && rd.x > 0.0) || (side == 1 && rd.y < 0.0)) wx = 1.0 - wx;
  // texels per pixel, vertically and along the wall, so distant or grazing walls fade to their average colour
  float dudc = side == 0 ? perp * (plane.y * rd.x - rd.y * plane.x) / rd.x : perp * (plane.x * rd.y - rd.x * plane.y) / rd.y;
  float foot = max(64.0 / lineH, 64.0 * abs(dudc) * 2.0 / ${VW}.0);
  vec3 c = mix(texel(id, vec2(wx, (s.y - top) / lineH)), base(id) * 0.9, smoothstep(0.25, 0.9, foot));
  if (side == 1) c *= 0.72;                                        // the Wolfenstein trick: y-side walls darker
  return mix(c, vec3(0.10, 0.10, 0.12), fog);
}
void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 q = abs(p - vec2(${VX + VW / 2}.0, ${VY + VH / 2}.0)) - vec2(${VW / 2 - 26}.0, ${VH / 2 - 26}.0);
  float box = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 26.0;
  vec3 bg = mix(vec3(0.05, 0.05, 0.09), vec3(0.08, 0.07, 0.13), p.y / uRes.y);
  if (box > 1.0) { outColor = vec4(bg, 1.0); return; }
  vec3 col = vec3(0.0);
  for (int k = 0; k < 4; k++) for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 s = p - vec2(${VX}.0, ${VY}.0) + (vec2(i, j) - 0.5) * 0.5;
    col += render(s, uTime + ((float(k) + 0.5) / 4.0 - 0.5) / 30.0);   // spread over the frame: motion blur
  }
  col /= 16.0;
  // the cursor: the column being cast glows, then cools down over 0.4 s
  float c = (p.x - ${VX}.0) / ${VW}.0, age = fract(uTime * 0.4 - c) * 2.5;
  float glow = exp(-age / 0.4), line = exp(-age / 0.06);
  col = col * (1.0 + 0.5 * glow) + vec3(0.28, 0.20, 0.02) * glow + vec3(1.0, 0.85, 0.3) * line * 0.35;
  outColor = vec4(mix(col, bg, clamp(box + 0.5, 0.0, 1.0)), 1.0);
}`,
  overlay(ctx, t, W, H) {
    const p = player(t), cu = cursor(t);
    // the column being cast, and its wall slice
    const camX = 2 * cu - 1, rx = p.dx + p.px * camX, ry = p.dy + p.py * camX, hit = cast(p, rx, ry);
    const lineH = VH / hit.perp, sx = VX + cu * VW, top = Math.max(VY + 6, VY + VH / 2 - lineH / 2), bot = Math.min(VY + VH - 6, VY + VH / 2 + lineH / 2);
    ctx.save();
    ctx.beginPath(); ctx.roundRect(VX, VY, VW, VH, 26); ctx.clip();
    ctx.strokeStyle = '#FFD84D'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(sx - 12, top); ctx.lineTo(sx, top); ctx.lineTo(sx, bot); ctx.lineTo(sx - 12, bot); ctx.stroke();
    ctx.restore();
    const tag = `column ${String(Math.round(cu * VW)).padStart(4, ' ')}   d ${hit.perp.toFixed(2)}  →  h = ${VH} / d = ${String(Math.round(lineH)).padStart(4, ' ')} px`;
    ctx.font = `700 24px ${FONT.mono}`;
    const tw = ctx.measureText(tag).width + 32, tx = VX + (VW - tw) / 2, ty = VY + VH - 64;
    ctx.fillStyle = 'rgba(14, 14, 22, 0.82)'; ctx.beginPath(); ctx.roundRect(tx, ty, tw, 44, 22); ctx.fill();
    ctx.fillStyle = '#FFD84D'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(tag, tx + 16, ty + 23);

    // the map: scrolls under the player, who stays at a fixed spot
    ctx.save();
    ctx.beginPath(); ctx.roundRect(MX, MY, MW, MH, 26); ctx.clip();
    ctx.fillStyle = '#12131C'; ctx.fillRect(MX, MY, MW, MH);
    const ox = MX + (MW - COLS * CS) / 2, py0 = MY + MH * 0.74;      // screen position of map point (x, y)
    const at = (x, y) => [ox + x * CS, py0 + (y - p.y) * CS];
    const j0 = Math.floor(p.y - (py0 - MY) / CS) - 1, j1 = Math.ceil(p.y + (MY + MH - py0) / CS) + 1;
    for (let j = j0; j <= j1; j++) for (let i = 0; i < COLS; i++) {   // walls solid, floor a faint checker
      const [x, y] = at(i, j), v = cell(i, j);
      ctx.fillStyle = v ? WALL[v] : (i + j) % 2 ? '#1D1F2D' : '#222433';
      ctx.fillRect(x, y, CS + 0.5, CS + 0.5);
    }
    // the fan: one ray per 40 columns, brighter for the ones cast in the last moments
    for (let k = 0; k <= 25; k++) {
      const c = k / 25, cx = 2 * c - 1, ax = p.dx + p.px * cx, ay = p.dy + p.py * cx, h = cast(p, ax, ay);
      const age = (((cu - c) % 1) + 1) % 1 * 2.5, glow = Math.exp(-age / 0.4);
      ctx.strokeStyle = `rgba(255, ${Math.round(200 + 30 * glow)}, ${Math.round(150 - 80 * glow)}, ${0.16 + 0.45 * glow})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(...at(p.x, p.y)); ctx.lineTo(...at(p.x + ax * h.d, p.y + ay * h.d)); ctx.stroke();
    }
    // the highlighted ray, its DDA crossings (cyan: vertical grid lines, pink: horizontal) and the wall it hits
    const [hx, hy] = at(hit.mx, hit.my);
    ctx.strokeStyle = '#FFD84D'; ctx.lineWidth = 5;
    ctx.strokeRect(hx + 3, hy + 3, CS - 6, CS - 6);
    ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(...at(p.x, p.y)); ctx.lineTo(...at(p.x + rx * hit.d, p.y + ry * hit.d)); ctx.stroke();
    hit.steps.forEach(([d, s]) => {
      ctx.fillStyle = s ? '#FF6FB5' : '#5CE1FF';
      ctx.beginPath(); ctx.arc(...at(p.x + rx * d, p.y + ry * d), 7, 0, TAU); ctx.fill();
    });
    // the player, the direction vector and the camera plane
    const [cx0, cy0] = at(p.x, p.y);
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(...at(p.x + p.dx - p.px, p.y + p.dy - p.py)); ctx.lineTo(...at(p.x + p.dx + p.px, p.y + p.dy + p.py)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx0, cy0); ctx.lineTo(...at(p.x + p.dx, p.y + p.dy)); ctx.stroke();
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(cx0, cy0, 13, 0, TAU); ctx.fill();
    ctx.fillStyle = '#E8384F'; ctx.beginPath(); ctx.arc(cx0, cy0, 8, 0, TAU); ctx.fill();
    ctx.restore();

    // captions
    ctx.font = `700 25px ${FONT.sans}`; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; ctx.textAlign = 'left';
    ctx.fillText('ONE RAY PER SCREEN COLUMN', MX + 4, MY - 22);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#5CE1FF'; ctx.fillText('● x-step', MX + MW - 150, MY - 22);
    ctx.fillStyle = '#FF6FB5'; ctx.fillText('● y-step', MX + MW - 4, MY - 22);
  },
};
