// Shared helpers for effects. Everything is a pure function of its inputs, so frame i always looks the same.
export const W = 1080, H = 1920, FPS = 30, DUR = 5, FRAMES = 150;
export const TAU = Math.PI * 2;

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const fract = x => x - Math.floor(x);
export const smoothstep = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
// 0..1 over the 5-second loop; sin(phase(t) * TAU) returns to its start value at t = 5
export const phase = t => t / DUR;
// 0..1 inside a window [a, b] of seconds (before a: 0, after b: 1)
export const span = (t, a, b) => clamp((t - a) / (b - a));

export const ease = {
  in: k => k * k * k,
  out: k => 1 - (1 - k) ** 3,
  inOut: k => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2),
  outBack: k => 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2,
  outElastic: k => (k <= 0 ? 0 : k >= 1 ? 1 : 2 ** (-10 * k) * Math.sin((k * 10 - 0.75) * (TAU / 3)) + 1),
  outBounce: k => {
    const n = 7.5625, d = 2.75;
    if (k < 1 / d) return n * k * k;
    if (k < 2 / d) return n * (k -= 1.5 / d) * k + 0.75;
    if (k < 2.5 / d) return n * (k -= 2.25 / d) * k + 0.9375;
    return n * (k -= 2.625 / d) * k + 0.984375;
  },
};

// seeded random numbers (mulberry32): const r = rng(7); r() -> 0..1
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// 3D gradient noise, about -1..1. For a looping field, move through it on a circle: noise3(x, y, ...loop(t, r))
const PERM = (() => {
  const r = rng(1337), p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  return [...p, ...p];
})();
const grad = (h, x, y, z) => {
  const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
};
const fade = k => k * k * k * (k * (k * 6 - 15) + 10);
export function noise3(x, y, z = 0) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z);
  const A = PERM[X] + Y, AA = PERM[A] + Z, AB = PERM[A + 1] + Z, B = PERM[X + 1] + Y, BA = PERM[B] + Z, BB = PERM[B + 1] + Z;
  return lerp(
    lerp(lerp(grad(PERM[AA] & 15, x, y, z), grad(PERM[BA] & 15, x - 1, y, z), u),
      lerp(grad(PERM[AB] & 15, x, y - 1, z), grad(PERM[BB] & 15, x - 1, y - 1, z), u), v),
    lerp(lerp(grad(PERM[AA + 1] & 15, x, y, z - 1), grad(PERM[BA + 1] & 15, x - 1, y, z - 1), u),
      lerp(grad(PERM[AB + 1] & 15, x, y - 1, z - 1), grad(PERM[BB + 1] & 15, x - 1, y - 1, z - 1), u), v), w);
}
export const fbm3 = (x, y, z = 0, oct = 4) => {
  let s = 0, a = 0.5;
  for (let i = 0; i < oct; i++) { s += a * noise3(x, y, z); x *= 2; y *= 2; z *= 2; a *= 0.5; }
  return s;
};
// a point on a circle of radius r that goes round once every 5 seconds: [dx, dy]
export const loop = (t, r = 1) => [r * Math.cos(phase(t) * TAU), r * Math.sin(phase(t) * TAU)];

export const hsl = (h, s, l, a = 1) => `hsla(${h}, ${s}%, ${l}%, ${a})`;

// a canvas the same size as the frame (or w x h) for off-screen drawing
export function canvas(w = W, h = H) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// text fonts installed on this Mac (no web fonts, so nothing has to download)
export const FONT = {
  sans: '"Helvetica Neue", "Apple SD Gothic Neo", sans-serif',
  ko: '"Apple SD Gothic Neo", sans-serif',
  display: '"Futura", "Helvetica Neue", sans-serif',
  black: '"Arial Black", "Helvetica Neue", sans-serif',
  serif: '"Didot", "Bodoni 72", serif',
  mono: '"Menlo", monospace',
};
