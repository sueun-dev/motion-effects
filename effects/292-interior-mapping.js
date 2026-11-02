// Interior mapping: a tower's facade at dusk is one flat quad, yet every window shows a furnished room with depth.
// For each pixel the view ray meets the facade plane, finds which window cell it is in, and carries on into an
// imaginary box behind the glass (1 x 0.9 x 1 units): whichever of the back wall, side walls, floor or ceiling it
// reaches first is shaded there, and a furniture card halfway in (sofa, lamp, plant, shelf, desk) is drawn when the
// ray crosses it first. Each room picks its wallpaper, light (warm, cool or off) and blinds from a hash of its cell.
// The glass adds a Fresnel reflection of the sky. As the camera drifts the rooms shift behind their frames. A sweep
// then switches the trick off in a strip (flat glass) and outlines the facade's real geometry, two triangles, and a
// plan view below shows rays passing straight through the plane into rooms that are not there. 4 x 4 samples.
import { TAU, FONT, clamp, smoothstep, ease } from '../lib/util.js';

const X0 = -4.5, X1 = 9, Y1 = 27;                                 // the facade quad: x -4.5..9, y 0..27
function cam(t) {
  const a = t / 5 * TAU;
  return { pos: [2.4 + 0.8 * Math.sin(a), 1.7 + 0.2 * Math.sin(2 * a), 5.8 + 0.35 * Math.cos(a)], at: [-2.1 + 0.35 * Math.sin(a + 0.6), 5.4, 0] };
}
const sweep = t => ease.inOut(clamp((t - 2.5) / 2.0));            // 0..1: the "off" strip crosses the screen
const wire = t => smoothstep(2.4, 2.8, t) - smoothstep(4.3, 4.7, t);

export default {
  name: 'Interior Mapping',
  ko: '인테리어 매핑',
  uniforms(t) {
    const c = cam(t);
    return { uPos: c.pos, uAt: c.at, uStrip: [-260 + 1600 * sweep(t)], uWire: [wire(t)] };
  },
  frag: `
uniform vec3 uPos, uAt; uniform float uStrip, uWire;
const float RW = 1.0, FH = 0.9, D = 1.0, X0 = ${X0.toFixed(1)}, X1 = ${X1.toFixed(1)}, Y1 = ${Y1.toFixed(1)};
vec3 sky(vec3 d) {
  float y = clamp(d.y * 1.4 + 0.15, 0.0, 1.0);
  vec3 c = mix(vec3(0.98, 0.58, 0.38), vec3(0.42, 0.3, 0.55), smoothstep(0.0, 0.45, y));
  return mix(c, vec3(0.08, 0.09, 0.22), smoothstep(0.4, 1.0, y));
}
float box(vec2 p, vec2 a, vec2 b) { return step(a.x, p.x) * step(p.x, b.x) * step(a.y, p.y) * step(p.y, b.y); }
float disc(vec2 p, vec2 c, float r) { return step(length(p - c), r); }
// a flat cut-out of furniture on the card halfway into the room (q in room units, 0..1 x 0..0.9)
float furniture(vec2 q, float k) {
  if (k < 0.2) return max(max(box(q, vec2(0.18, 0.0), vec2(0.82, 0.2)), box(q, vec2(0.2, 0.0), vec2(0.8, 0.36))),          // sofa
                          max(box(q, vec2(0.15, 0.0), vec2(0.22, 0.26)), box(q, vec2(0.78, 0.0), vec2(0.85, 0.26))));
  if (k < 0.4) return max(max(box(q, vec2(0.7, 0.0), vec2(0.72, 0.5)), box(q, vec2(0.62, 0.5), vec2(0.8, 0.62))),           // floor lamp + table
                          box(q, vec2(0.1, 0.0), vec2(0.5, 0.18)));
  if (k < 0.6) return max(box(q, vec2(0.36, 0.0), vec2(0.5, 0.14)), max(disc(q, vec2(0.43, 0.3), 0.13),                     // plant
                          max(disc(q, vec2(0.33, 0.38), 0.09), disc(q, vec2(0.52, 0.4), 0.1))));
  if (k < 0.8) return box(q, vec2(0.12, 0.0), vec2(0.5, 0.68));                                                             // shelf
  return max(max(box(q, vec2(0.2, 0.28), vec2(0.8, 0.31)), box(q, vec2(0.42, 0.33), vec2(0.62, 0.47))),                       // desk + screen
             max(box(q, vec2(0.24, 0.0), vec2(0.27, 0.28)), box(q, vec2(0.73, 0.0), vec2(0.76, 0.28))));
}
// the imaginary room behind cell id, entered at local point e (x 0..RW, y 0..FH, z 0) along rd
vec3 room(vec2 id, vec3 e, vec3 rd) {
  float h = hash12(id), h2 = hash12(id + 17.3), h3 = hash12(id + 41.7), h4 = hash12(id + 5.1);
  vec3 wall = h2 < 0.2 ? vec3(0.86, 0.78, 0.64) : h2 < 0.4 ? vec3(0.56, 0.66, 0.54) : h2 < 0.6 ? vec3(0.8, 0.52, 0.4) : h2 < 0.8 ? vec3(0.52, 0.6, 0.7) : vec3(0.9, 0.88, 0.84);
  vec3 lamp = h < 0.5 ? vec3(1.0, 0.7, 0.42) : h < 0.68 ? vec3(1.0, 0.85, 0.65) : h < 0.78 ? vec3(0.55, 0.72, 1.0) : vec3(0.0);
  float tb = -D / rd.z, tx = rd.x > 0.0 ? (RW - e.x) / rd.x : -e.x / rd.x, ty = rd.y > 0.0 ? (FH - e.y) / rd.y : -e.y / rd.y;
  float t = min(tb, min(tx, ty));
  vec3 p = e + rd * t, c;
  if (t == tb) {                                                            // back wall, with a picture
    c = wall;
    vec2 f = p.xy - vec2(0.5 * RW, 0.56);
    if (abs(f.x) < 0.16 && abs(f.y) < 0.11) c = abs(f.x) < 0.14 && abs(f.y) < 0.09 ? mix(vec3(0.2, 0.35, 0.5), vec3(0.85, 0.6, 0.3), h3) : vec3(0.15);
  } else if (t == tx) c = wall * 0.72;                                      // side wall
  else if (rd.y < 0.0) c = mix(vec3(0.42, 0.27, 0.16), vec3(0.5, 0.34, 0.2), step(0.5, fract(p.z * 7.0)));   // floor boards
  else c = vec3(0.86, 0.85, 0.82);                                          // ceiling
  float glow = 0.55 + 0.9 * exp(-6.0 * length(p - vec3(0.5 * RW, FH, -0.5 * D)));   // the ceiling lamp lights its surroundings
  vec3 lit = lamp * glow + vec3(0.05, 0.05, 0.08);
  float tf = -0.55 * D / rd.z;                                              // the furniture card
  if (tf < t) {
    vec2 q = (e + rd * tf).xy;
    if (furniture(q, h4) > 0.5) { c = mix(vec3(0.16, 0.13, 0.12), vec3(0.32, 0.25, 0.2), h3); lit *= 0.9; }
  }
  return c * lit;
}
vec3 shade(vec3 ro, vec3 rd, vec2 frag) {
  if (rd.z >= -1e-4) return sky(rd);
  float t = -ro.z / rd.z;
  vec3 p = ro + rd * t;
  if (p.x < X0 || p.x > X1 || p.y > Y1) return sky(rd);
  if (p.y < 0.0) return vec3(0.03, 0.03, 0.05);
  vec2 id = floor(vec2(p.x / RW, p.y / FH)), f = vec2(p.x / RW, p.y / FH) - id;
  float haze = smoothstep(6.0, 30.0, t);
  vec3 c;
  bool win = f.x > 0.07 && f.x < 0.93 && f.y > 0.14 && f.y < 0.86;
  if (win) {
    vec3 e = vec3(f.x * RW, f.y * FH, 0.0);
    bool off = abs(frag.x - uStrip) < 130.0;                                 // inside the strip: no interior, just glass
    vec3 inside = off ? vec3(0.07, 0.08, 0.1) : room(id, e, rd);
    float blind = hash12(id + 9.9) < 0.3 ? 0.25 + 0.5 * hash12(id + 3.3) : 0.0;   // some blinds half down
    if (!off && f.y > 0.86 - blind * 0.72) inside = mix(inside, vec3(0.95, 0.88, 0.75) * (0.25 + 0.75 * max(inside.r, inside.g)) * (0.85 + 0.15 * step(0.5, fract(f.y * 40.0))), 0.85);
    float fr = 0.04 + 0.96 * pow(1.0 - abs(rd.z), 5.0);
    c = mix(inside, sky(reflect(rd, vec3(0, 0, 1))), fr);
    if (abs(f.x - 0.5) < 0.012) c = vec3(0.18, 0.19, 0.22);                // centre mullion
  } else {
    bool frame = f.x > 0.05 && f.x < 0.95 && f.y > 0.12 && f.y < 0.88;
    c = frame ? vec3(0.32, 0.33, 0.36) : vec3(0.1, 0.11, 0.14) * (0.85 + 0.15 * step(0.5, fract(p.y / FH * 2.0)));
    c *= 0.7 + 0.5 * sky(reflect(rd, vec3(0, 0, 1))).r * 0.6;
  }
  // the facade's real geometry: its outline and the diagonal that splits it into two triangles
  if (uWire > 0.0) {
    vec2 a = vec2(X0, 0.0), b = vec2(X1, Y1), q = p.xy - a, ab = b - a;
    float dDiag = abs(q.x * ab.y - q.y * ab.x) / length(ab), dEdge = min(abs(p.x - X0), min(abs(p.x - X1), abs(p.y - Y1)));
    float px = t / 1000.0;                                                  // about one pixel at this distance
    c = mix(c, vec3(0.35, 0.95, 1.0), uWire * smoothstep(3.5 * px, 2.0 * px, min(dDiag, dEdge)));
  }
  return mix(c, sky(rd), haze * 0.6);
}
void main() {
  vec3 fw = normalize(uAt - uPos), rt = normalize(cross(fw, vec3(0, 1, 0))), up = cross(rt, fw);
  vec3 col = vec3(0.0);
  for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) {
    vec2 fc = gl_FragCoord.xy + (vec2(i, j) + 0.5) / 4.0 - 0.5;
    vec2 uv = (fc - 0.5 * uRes) / uRes.y;
    col += shade(uPos, normalize(fw * 0.85 + uv.x * rt + uv.y * up), vec2(fc.x, uRes.y - fc.y));
  }
  col /= 16.0;
  float s = abs(gl_FragCoord.x - uStrip);                                   // the strip's edges
  col = mix(col, vec3(0.35, 0.95, 1.0), 0.8 * smoothstep(3.0, 0.0, abs(s - 130.0)) * step(0.0, uStrip + 200.0) * step(uStrip, uRes.x + 200.0));
  outColor = vec4(pow(clamp(col, 0.0, 1.0), vec3(0.95)) + grain(gl_FragCoord.xy) / 255.0, 1.0);
}`,
  // the plan view: the facade is a line; the rooms (dashed) exist only in the shader
  overlay(ctx, t, W, H) {
    const c = cam(t), x0 = 40, y0 = 1540, w = 1000, h = 340;
    ctx.fillStyle = 'rgba(10, 10, 22, 0.8)'; ctx.beginPath(); ctx.roundRect(x0, y0, w, h, 26); ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; ctx.font = `600 22px ${FONT.sans}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('PLAN VIEW', x0 + 28, y0 + 42);
    const S = 34, ox = x0 + 640, oz = y0 + 96;                          // world x -> right, world z (out of the facade) -> down
    const P = (x, z) => [ox + (x - 0.5) * S, oz + z * S];
    ctx.save(); ctx.beginPath(); ctx.rect(x0 + 10, y0 + 56, w - 20, h - 66); ctx.clip();
    ctx.setLineDash([7, 7]); ctx.strokeStyle = 'rgba(255, 210, 150, 0.45)'; ctx.lineWidth = 2;
    for (let i = -8; i <= 8; i++) { const [a, b] = P(i, -1); ctx.strokeRect(a, b, S, S); }
    ctx.setLineDash([]);
    const [fa, fb] = P(-9, 0), [fc] = P(9, 0);
    ctx.strokeStyle = '#7FE7FF'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(fa, fb); ctx.lineTo(fc, fb); ctx.stroke();
    // rays from the camera through the plane, on into the imaginary rooms
    const [cx, cz] = P(c.pos[0] + 0.5, c.pos[2]);
    for (const tx of [-2.6, -1.3, 0.1]) {
      const dx = tx - c.pos[0], dz = -c.pos[2];
      let k = 1 + 1 / c.pos[2];                                           // to the back wall (z = -1) ...
      const ex = c.pos[0] + dx * 1, cell = Math.floor(ex);
      const kSide = dx < 0 ? (cell - c.pos[0]) / dx : (cell + 1 - c.pos[0]) / dx;
      k = Math.min(k, kSide);                                             // ... or a side wall, whichever comes first
      const [hx, hz] = P(c.pos[0] + dx * k + 0.5, c.pos[2] + dz * k), [px2, pz2] = P(ex + 0.5, 0);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(cx, cz); ctx.lineTo(px2, pz2); ctx.stroke();
      ctx.setLineDash([6, 6]); ctx.strokeStyle = '#FFD27A';
      ctx.beginPath(); ctx.moveTo(px2, pz2); ctx.lineTo(hx, hz); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#FFD27A'; ctx.beginPath(); ctx.arc(hx, hz, 5, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(cx, cz, 9, 0, TAU); ctx.fill();
    ctx.font = `600 20px ${FONT.sans}`; ctx.textAlign = 'left'; ctx.fillText('camera', cx + 18, cz + 7);
    ctx.restore();
    ctx.font = `600 21px ${FONT.sans}`; ctx.fillStyle = '#7FE7FF'; ctx.fillText('facade: one flat plane', x0 + 28, y0 + h - 58);
    ctx.fillStyle = '#FFD27A'; ctx.fillText('rooms: only in the shader', x0 + 28, y0 + h - 26);
    // the sweep's caption
    const k = wire(t);
    if (k > 0) {
      ctx.globalAlpha = k;
      ctx.fillStyle = 'rgba(10, 10, 22, 0.78)'; ctx.beginPath(); ctx.roundRect(40, 1440, 520, 76, 20); ctx.fill();
      ctx.fillStyle = '#7FE7FF'; ctx.font = `700 30px ${FONT.sans}`; ctx.fillText('1 QUAD · 2 TRIANGLES', 66, 1490);
      ctx.globalAlpha = 1;
    }
  },
};
