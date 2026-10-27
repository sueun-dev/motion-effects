// Render effects to videos/NNN-slug.mp4 (1080x1920, 30 fps, 150 frames = 5 s, H.264) in headless Chrome.
//   node render.mjs                  -> every effect in effects/
//   node render.mjs 010 084 031-046  -> only these numbers (single numbers or ranges)
//   node render.mjs --jobs 3 ...     -> 3 effects side by side (default 2)
// Also writes previews/NNN-slug.webp (240 px animated preview for the README), check/NNN-slug.png
// (frames 0, 29, 64, 101, 137 side by side) and check/NNN-slug.json (motion numbers).
// The page (render.html + runner.js) posts each frame as a PNG to the small server here, which pipes it to ffmpeg.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegStatic from 'ffmpeg-static';

const ROOT = dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find(p => existsSync(p)) || 'google-chrome';
export const FFMPEG = process.env.FFMPEG || ffmpegStatic || 'ffmpeg'; // ffmpeg-static ships one with libx264 and libwebp
const STRIP = [0, 29, 64, 101, 137]; // uneven, so a 1.25 s or 2.5 s cycle does not look frozen in the strip
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json' };

export function run(cmd, args) {
  return new Promise((ok, bad) => spawn(cmd, args, { stdio: ['ignore', 'ignore', 'inherit'] })
    .on('close', c => (c === 0 ? ok() : bad(new Error(`${cmd.split('/').pop()} exit ${c}`)))));
}

// effect ids (file names without .js) matching the arguments: "010", "31-46"
export function pick(args) {
  const all = readdirSync(join(ROOT, 'effects')).filter(f => /^\d{3}-.+\.js$/.test(f)).map(f => f.slice(0, -3)).sort();
  if (!args.length) return all;
  const want = new Set();
  for (const a of args) {
    const [from, to = from] = a.split('-').map(Number);
    for (let n = from; n <= to; n++) want.add(n);
  }
  return all.filter(id => want.has(Number(id.slice(0, 3))));
}

const readBody = req => new Promise((ok, bad) => {
  const parts = [];
  req.on('data', d => parts.push(d)).on('end', () => ok(Buffer.concat(parts))).on('error', bad);
});

async function renderOne(id) {
  const t0 = Date.now();
  const tmp = mkdtempSync(join(tmpdir(), 'motion-fx-')); // Chrome profile + the strip frames
  const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-i', '-',
    '-vf', 'scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart',
    join(ROOT, 'videos', `${id}.mp4`)], { stdio: ['pipe', 'ignore', 'inherit'] });
  const encoded = new Promise((ok, bad) => ff.on('close', c => (c === 0 ? ok() : bad(new Error(`ffmpeg exit ${c}`)))));

  let next = 0, last = Date.now(), finish;
  const result = new Promise(ok => (finish = ok));
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'POST') {
      const body = await readBody(req);
      last = Date.now();
      if (url.pathname === '/frame') {
        const i = Number(url.searchParams.get('i'));
        if (i !== next) finish({ error: `frame ${i} arrived, expected ${next}` });
        next++;
        if (STRIP.includes(i)) writeFileSync(join(tmp, `s${STRIP.indexOf(i)}.png`), body);
        if (!ff.stdin.write(body)) await new Promise(r => ff.stdin.once('drain', r));
      } else if (url.pathname === '/done') finish({ stats: JSON.parse(body) });
      else finish({ error: body.toString() });
      return res.end('ok');
    }
    const file = resolve(ROOT, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(ROOT + sep) || !existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(readFileSync(file));
  }).listen(0, '127.0.0.1');
  await new Promise(ok => server.on('listening', ok));

  const chrome = spawn(CHROME, ['--headless=new', `--user-data-dir=${join(tmp, 'profile')}`,
    '--window-size=1080,1920', '--force-device-scale-factor=1', '--hide-scrollbars', '--no-first-run',
    '--no-default-browser-check', ...(process.platform === 'darwin' ? ['--use-angle=metal'] : []),
    '--enable-gpu', '--ignore-gpu-blocklist', '--force-color-profile=srgb',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    `http://127.0.0.1:${server.address().port}/render.html?fx=${id}`], { stdio: 'ignore' });
  const watchdog = setInterval(() => { if (Date.now() - last > 90000) finish({ error: 'no frame for 90 s' }); }, 1000);
  const r = await result;
  clearInterval(watchdog);
  chrome.kill('SIGKILL');
  server.close();
  ff.stdin.end();
  const cleanup = () => { try { rmSync(tmp, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 }); } catch { /* temp dir */ } };
  if (r.error) { ff.kill('SIGKILL'); cleanup(); throw new Error(`${id}: ${r.error.split('\n').slice(0, 4).join(' | ')}`); }
  await encoded;
  await run(FFMPEG, ['-y', '-loglevel', 'error', '-i', join(ROOT, 'videos', `${id}.mp4`), '-vf', 'fps=15,scale=240:-2:flags=lanczos',
    '-c:v', 'libwebp_anim', '-lossless', '0', '-quality', '55', '-compression_level', '6', '-loop', '0', join(ROOT, 'previews', `${id}.webp`)]);

  const ins = STRIP.flatMap((_, k) => ['-i', join(tmp, `s${k}.png`)]);
  const graph = STRIP.map((_, k) => `[${k}]scale=360:640[v${k}]`).join(';') + ';' + STRIP.map((_, k) => `[v${k}]`).join('') + `hstack=inputs=${STRIP.length}`;
  await run(FFMPEG, ['-y', '-loglevel', 'error', ...ins, '-filter_complex', graph, join(ROOT, 'check', `${id}.png`)]);
  cleanup();
  const s = summarize(r.stats);
  writeFileSync(join(ROOT, 'check', `${id}.json`), JSON.stringify({ id, ...s }, null, 1) + '\n');
  console.log(`${id}  ${((Date.now() - t0) / 1000).toFixed(0)}s  motion ${s.motion} flicker ${s.flicker}%/${s.flickerMax}% seam ${s.seam} contrast ${s.contrastMin}${s.warn.length ? '  WARN: ' + s.warn.join('; ') : ''}`);
}

// motion: mean grey change per frame (0..255); flicker: % of pixels whose change reverses direction between
// frames (per-frame static, strobing or z-fighting), mean and worst frame; seam: last->first change / motion (about 1 = seamless loop)
function summarize({ contrast, d1, flips, seam }) {
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const r2 = x => Math.round(x * 100) / 100;
  const m1 = mean(d1), top = Math.max(...d1);
  const flicker = mean(flips) * 100, flickerMax = Math.max(...flips) * 100;
  const warn = [];
  if (Math.min(...contrast) < 3) warn.push(`blank frame(s): ${contrast.filter(c => c < 3).length}`);
  if (m1 < 0.05) warn.push('almost no motion');
  if (flicker > 3 || flickerMax > 10) warn.push('flicker: pixels flip up/down between frames (static, strobe or z-fighting?)');
  if (top > 6 * m1 && top > 8) warn.push(`jump at frame ${d1.indexOf(top) + 1}`);
  return { motion: r2(m1), motionMax: r2(top), flicker: r2(flicker), flickerMax: r2(flickerMax), seam: r2(seam / (m1 || 1e-9)), contrastMin: r2(Math.min(...contrast)), warn };
}

async function main() {
  const args = process.argv.slice(2);
  let jobs = 2;
  const j = args.indexOf('--jobs');
  if (j >= 0) { jobs = Number(args[j + 1]); args.splice(j, 2); }
  const ids = pick(args);
  if (!ids.length) throw new Error('no effect matches ' + args.join(' '));
  mkdirSync(join(ROOT, 'videos'), { recursive: true });
  mkdirSync(join(ROOT, 'previews'), { recursive: true });
  mkdirSync(join(ROOT, 'check'), { recursive: true });
  const queue = [...ids], failed = [];
  await Promise.all(Array.from({ length: Math.min(jobs, ids.length) }, async () => {
    while (queue.length) {
      const id = queue.shift();
      try { await renderOne(id); } catch (e) { failed.push(id); console.error('FAIL', e.message); }
    }
  }));
  if (failed.length) { console.error(`${failed.length} failed: ${failed.join(' ')}`); process.exit(1); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e.message || e); process.exit(1); });
