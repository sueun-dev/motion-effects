// Contact sheet: one (or more) frames of every videos/NNN-slug.mp4, tiled, numbered.
//   node sheet.mjs                                   -> contact-sheet.jpg (frame at 1.2 s, mid-transition for 127-137; 12 columns)
//   node sheet.mjs 021-046 --at 0.5,2.5,4.5 --cols 9 --out check/review.jpg
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FFMPEG, pick, run } from './render.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const FONT = '/System/Library/Fonts/Helvetica.ttc';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i < 0 ? def : args.splice(i, 2)[1]; };
const at = opt('--at', '1.2').split(',').map(Number);
const cols = Number(opt('--cols', 12));
const width = Number(opt('--width', 200));
const out = join(ROOT, opt('--out', 'contact-sheet.jpg'));
const ids = pick(args).filter(id => existsSync(join(ROOT, 'videos', `${id}.mp4`)));
if (!ids.length) throw new Error('no rendered effects match');

const tmp = mkdtempSync(join(tmpdir(), 'motion-sheet-'));
const jobs = ids.flatMap(id => at.map(s => ({ id, s })));
let next = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (next < jobs.length) {
    const k = next++, { id, s } = jobs[k];
    const text = join(tmp, `${k}.txt`);
    writeFileSync(text, id.slice(0, 3));
    await run(FFMPEG, ['-y', '-loglevel', 'error', '-ss', String(s), '-i', join(ROOT, 'videos', `${id}.mp4`), '-frames:v', '1',
      '-vf', `scale=${width}:-2,drawtext=fontfile=${FONT}:textfile=${text}:fontsize=${Math.round(width / 7)}:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=6:x=8:y=h-th-12`,
      join(tmp, `${String(k).padStart(4, '0')}.png`)]);
  }
}));
const rows = Math.ceil(jobs.length / cols);
await run(FFMPEG, ['-y', '-loglevel', 'error', '-i', join(tmp, '%04d.png'),
  '-vf', `tile=${cols}x${rows}:padding=4:margin=4:color=0x111111`, '-frames:v', '1', '-q:v', '3', out]);
rmSync(tmp, { recursive: true, force: true });
console.log(`wrote ${out} (${ids.length} effects, ${cols}x${rows})`);
