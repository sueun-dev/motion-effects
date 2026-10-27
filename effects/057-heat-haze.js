// Heat haze (displacement): the texture lookup of a desert road is pushed sideways by noise that rises up the screen.
// The noise is periodic in y (read on a cylinder), so it can scroll upward forever and still loop every 5 seconds.
const HZ = 1060; // horizon
let picture = null;

function paint(W, H) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 0, HZ);
  sky.addColorStop(0, '#3F7FC4'); sky.addColorStop(0.6, '#9CC6E4'); sky.addColorStop(1, '#F7DDB2');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, HZ);
  const sun = ctx.createRadialGradient(W * 0.7, 560, 40, W * 0.7, 560, 420);
  sun.addColorStop(0, 'rgba(255, 252, 235, 1)'); sun.addColorStop(0.25, 'rgba(255, 240, 200, 0.6)'); sun.addColorStop(1, 'rgba(255, 240, 200, 0)');
  ctx.fillStyle = sun; ctx.fillRect(0, 0, W, HZ);
  // flat-topped mesas on the horizon
  ctx.fillStyle = '#C98466';
  for (const [x, w, h] of [[-40, 300, 120], [210, 160, 70], [640, 260, 150], [880, 240, 90]]) {
    ctx.beginPath(); ctx.moveTo(x, HZ); ctx.lineTo(x + 40, HZ - h); ctx.lineTo(x + w - 40, HZ - h); ctx.lineTo(x + w, HZ); ctx.fill();
  }
  const sand = ctx.createLinearGradient(0, HZ, 0, H);
  sand.addColorStop(0, '#E9B982'); sand.addColorStop(1, '#C98A55');
  ctx.fillStyle = sand; ctx.fillRect(0, HZ, W, H - HZ);
  // the road and its markings in perspective: screen y = HZ + 620 / z
  const cx = W / 2, road = z => HZ + 860 / z;
  const asphalt = ctx.createLinearGradient(0, HZ, 0, H);
  asphalt.addColorStop(0, '#B9C9D6'); asphalt.addColorStop(0.08, '#6A6870'); asphalt.addColorStop(1, '#3B3A42');
  ctx.fillStyle = asphalt;
  ctx.beginPath(); ctx.moveTo(cx - 4, HZ); ctx.lineTo(cx + 4, HZ); ctx.lineTo(cx + 820, H); ctx.lineTo(cx - 820, H); ctx.fill();
  ctx.fillStyle = '#F1E9D8';
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(cx + s * 3, HZ); ctx.lineTo(cx + s * 760, H); ctx.lineTo(cx + s * 715, H); ctx.fill();
  }
  ctx.fillStyle = '#F2C230';
  for (let z = 0.75; z < 40; z *= 1.32) {
    const y0 = road(z), y1 = road(z * 1.14);
    const w0 = 16 / z, w1 = 16 / (z * 1.14);
    ctx.beginPath(); ctx.moveTo(cx - w0, y0); ctx.lineTo(cx + w0, y0); ctx.lineTo(cx + w1, y1); ctx.lineTo(cx - w1, y1); ctx.fill();
  }
  // telephone poles along the right side
  ctx.strokeStyle = '#4A3328'; ctx.lineCap = 'round';
  let prev = null;
  for (let z = 1.3; z < 30; z *= 1.45) {
    const x = cx + 1100 / z, yb = road(z), h = 1300 / z;
    ctx.lineWidth = Math.max(2, 28 / z);
    ctx.beginPath(); ctx.moveTo(x, yb); ctx.lineTo(x, yb - h); ctx.moveTo(x - 160 / z, yb - h * 0.92); ctx.lineTo(x + 160 / z, yb - h * 0.92); ctx.stroke();
    if (prev) {
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.quadraticCurveTo((prev[0] + x) / 2, (prev[1] + yb - h * 0.92) / 2 + 30 / z, x, yb - h * 0.92); ctx.stroke();
    }
    prev = [x, yb - h * 0.92];
  }
  return c;
}

export default {
  name: 'Heat Haze',
  ko: '아지랑이 왜곡',
  tex(ctx, t, W, H) {
    picture ||= paint(W, H);
    ctx.drawImage(picture, 0, 0);
  },
  uniforms: () => ({ uHorizon: 1 - HZ / 1920 }),
  frag: `
uniform float uHorizon;
// noise that repeats every P in y and moves up n periods per loop (k: frequency in x, y)
float rising(vec2 p, vec2 k, float P, float n) {
  float th = TAU * (p.y / P - n * uPhase), R = k.y * P / TAU;
  return snoise(vec3(p.x * k.x, R * cos(th), R * sin(th)));
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = gl_FragCoord.xy / uRes.x;
  float hy = uHorizon * uRes.y / uRes.x;                       // horizon height in the same units
  float amp = 0.35 + 1.0 * exp(-pow((p.y - hy) / 0.18, 2.0)); // strongest just above the hot road
  amp *= smoothstep(1.75, 1.1, p.y);
  vec2 d = vec2(rising(p, vec2(9.0, 16.0), 0.8, 1.0) + 0.5 * rising(p + 4.0, vec2(20.0, 32.0), 0.4, 3.0),
                0.6 * rising(p + 9.0, vec2(9.0, 14.0), 0.8, 1.0));
  vec3 col = texture(uTex, uv + d * amp * vec2(0.008, 0.0045)).rgb;
  col += vec3(1.0, 0.85, 0.6) * 0.05 * amp * (0.5 + 0.5 * d.x);   // a faint warm shimmer
  outColor = vec4(col, 1.0);
}`,
};
