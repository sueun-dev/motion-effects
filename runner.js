// Runs in the page (render.html?fx=010-grainy-gradient): draws the effect frame by frame, adds the label,
// and posts every frame as a PNG to render.mjs, which pipes it to ffmpeg. Frame i is drawn at t = i / 30.
import * as THREE from 'three';
import { W, H, FPS, FRAMES, FONT } from './lib/util.js';
import { GLSL } from './lib/glsl.js';

const post = (path, body) => fetch(path, { method: 'POST', body });

const id = new URLSearchParams(location.search).get('fx');
const fx = (await import(`./effects/${id}.js`)).default;
const out = document.getElementById('out');
const ctx = out.getContext('2d', { willReadFrequently: true }); // stats read every frame back
const stage = document.createElement('canvas'); // the effect draws here; the label goes on top in `out`
stage.width = W; stage.height = H;

const draw = fx.draw ? await canvas2d() : fx.frag ? shader() : fx.three ? await scene3d() : null;
if (!draw) throw new Error(`${id}: export default needs draw, frag or three`);
await document.fonts.ready;

const stats = makeStats();
for (let i = 0; i < FRAMES; i++) {
  const t = i / FPS;
  await draw(t);
  ctx.drawImage(stage, 0, 0);
  if (fx.overlay) { ctx.save(); fx.overlay(ctx, t, W, H); ctx.restore(); }
  stats.add(ctx);
  label(id.slice(0, 3), fx.name, fx.ko);
  const png = await new Promise(ok => out.toBlob(ok, 'image/png'));
  await post(`/frame?i=${i}`, png);
}
await post('/done', JSON.stringify(stats.result()));

// draw(ctx, t, W, H): plain canvas 2D. The canvas is not cleared between frames, so paint the whole frame.
async function canvas2d() {
  const c = stage.getContext('2d');
  if (fx.setup) await fx.setup(c, W, H);
  return t => { c.save(); fx.draw(c, t, W, H); c.restore(); };
}

// frag: a full-screen fragment shader (GLSL above is put in front). tex(ctx, t, W, H) draws a canvas
// that the shader reads as uTex; uniforms(t) returns extra uniforms { uName: number | [x, y(, z, w)] }.
function shader() {
  const gl = stage.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false });
  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`${id} shader: ${gl.getShaderInfoLog(s)}`);
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, '#version 300 es\nvoid main() { vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2.0 - 1.0, 0, 1); }'));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, GLSL + fx.frag));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`${id} link: ${gl.getProgramInfoLog(prog)}`);
  gl.useProgram(prog);
  gl.viewport(0, 0, W, H);
  const loc = name => gl.getUniformLocation(prog, name);
  let tex2d = null, texCtx = null;
  if (fx.tex) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    texCtx = c.getContext('2d', { willReadFrequently: false });
    tex2d = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex2d);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  }
  return t => {
    if (fx.tex) {
      texCtx.save(); fx.tex(texCtx, t, W, H); texCtx.restore();
      gl.bindTexture(gl.TEXTURE_2D, tex2d);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texCtx.canvas);
      gl.uniform1i(loc('uTex'), 0);
    }
    gl.uniform1f(loc('uTime'), t);
    gl.uniform1f(loc('uPhase'), t / 5);
    gl.uniform2f(loc('uRes'), W, H);
    for (const [name, v] of Object.entries(fx.uniforms ? fx.uniforms(t) : {})) {
      const a = [v].flat();
      gl[`uniform${a.length}fv`](loc(name), a);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
}

// three(renderer, W, H) returns { scene, camera, update(t) } (or render(t) to draw it yourself, e.g. post-processing)
async function scene3d() {
  const renderer = new THREE.WebGLRenderer({ canvas: stage, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  const s = await fx.three(renderer, W, H);
  return async t => {
    if (s.update) await s.update(t);
    if (s.render) s.render(t); else renderer.render(s.scene, s.camera);
  };
}

// small pill at the top: "010  Grainy Gradient" / "그레이니 그라디언트"
function label(num, name, ko) {
  ctx.save();
  const f1 = `700 40px ${FONT.sans}`, f2 = `500 30px ${FONT.ko}`;
  ctx.font = f1; const wNum = ctx.measureText(num + '  ').width, wName = ctx.measureText(name).width;
  ctx.font = f2; const wKo = ctx.measureText(ko).width;
  const w = Math.max(wNum + wName, wKo) + 68, h = 108, x = (W - w) / 2, y = 112;
  ctx.fillStyle = 'rgba(10, 10, 16, 0.62)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 30); ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.textBaseline = 'alphabetic';
  ctx.font = f1;
  const x1 = (W - wNum - wName) / 2;
  ctx.fillStyle = '#A99BFF'; ctx.fillText(num, x1, y + 50);
  ctx.fillStyle = '#FFFFFF'; ctx.fillText(name, x1 + wNum, y + 50);
  ctx.font = f2; ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
  ctx.fillText(ko, (W - wKo) / 2, y + 90);
  ctx.restore();
}

// Per-frame numbers for render.mjs, from every pixel below the label (rows 260 .. 1920), at full resolution
// (no down-scaling, which would alias fine moving detail into fake flicker):
//   contrast - spatial std of the frame's grey (near 0 = blank)
//   d1       - mean |frame - previous frame| (how much moves)
//   flips    - share of pixels whose change reverses direction from one frame to the next (up, then down):
//              per-frame static, flicker and z-fighting do this everywhere, smooth motion hardly anywhere
//   seam     - |last frame - first frame| (next to d1: about 1 = loops seamlessly)
function makeStats() {
  const top = 260, n = W * (H - top);
  let prev = null, prevDelta = null, first = null;
  const contrast = [], d1 = [], flips = [];
  return {
    add(src) {
      const px = src.getImageData(0, top, W, H - top).data, L = new Float32Array(n);
      let sum = 0, sq = 0;
      for (let i = 0; i < n; i++) {
        const v = 0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2];
        L[i] = v; sum += v; sq += v * v;
      }
      contrast.push(Math.sqrt(Math.max(0, sq / n - (sum / n) ** 2)));
      if (prev) {
        const delta = new Float32Array(n);
        let s = 0, f = 0;
        for (let i = 0; i < n; i++) {
          delta[i] = L[i] - prev[i];
          s += Math.abs(delta[i]);
          if (prevDelta && Math.abs(delta[i]) > 2 && Math.abs(prevDelta[i]) > 2 && delta[i] * prevDelta[i] < 0) f++;
        }
        d1.push(s / n);
        if (prevDelta) flips.push(f / n);
        prevDelta = delta;
      }
      if (!first) first = L;
      prev = L;
    },
    result() {
      let s = 0; for (let i = 0; i < n; i++) s += Math.abs(first[i] - prev[i]);
      return { contrast, d1, flips, seam: s / n };
    },
  };
}
