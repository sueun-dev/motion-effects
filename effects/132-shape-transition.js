// Geometric transition: four edges - a zigzag of triangles, a row of half circles and two straight lines - rise up
// the screen one after another, each on its own smoothstep curve; the colour bands between them sweep A away for B.
import { W, H, span, lerp, smoothstep, canvas } from '../lib/util.js';
import { landscape, city } from '../lib/scenes.js';

const A = canvas(), B = canvas();
city(B.getContext('2d'), W, H);
const P = 180, AMP = 130;                         // width and height of one triangle / half circle
const BANDS = ['#FFC93C', '#FF5E5B', '#5B3FD9']; // colours between edge 0-1, 1-2 and 2-3
const KINDS = ['zigzag', 'circles', 'line', 'line'];

// A holds, A->B (0.5-2.0 s), B holds, B->A (3.0-4.5 s), A holds: frame 150 = frame 0
const stage = t => (t < 2.5 ? [A, B, span(t, 0.5, 2.0)] : [B, A, span(t, 3.0, 4.5)]);

// everything above an edge at height y (the edge is walked right to left; the shapes point up)
function above(kind, y) {
  const p = new Path2D();
  p.moveTo(-20, -400); p.lineTo(W + 20, -400);
  if (kind === 'zigzag') {
    for (let i = 0, x = W + P; x >= -P; i++, x -= P / 2) p.lineTo(x, i % 2 ? y - AMP : y);
  } else if (kind === 'circles') {
    p.lineTo(W + P, y);
    for (let x = W + P / 2; x >= -P; x -= P) p.arc(x, y, P / 2, 0, Math.PI, true);
  } else {
    p.lineTo(W + 20, y - 60); p.lineTo(-20, y + 60); // a slight tilt
  }
  p.lineTo(-20, y); p.closePath();
  return p;
}

export default {
  name: 'Shape Transition',
  ko: '도형 트랜지션',
  draw(ctx, t, W, H) {
    landscape(A.getContext('2d'), W, H, t);
    const [from, to, p] = stage(t);
    const ys = KINDS.map((_, j) => lerp(H + AMP + 80, -AMP - 80, smoothstep(0.1 * j, 0.1 * j + 0.7, p)));
    ctx.drawImage(to, 0, 0);
    for (let j = 3; j >= 1; j--) { ctx.fillStyle = BANDS[j - 1]; ctx.fill(above(KINDS[j], ys[j])); }
    ctx.save();
    ctx.clip(above(KINDS[0], ys[0]));
    ctx.drawImage(from, 0, 0);
    ctx.restore();
  },
};
