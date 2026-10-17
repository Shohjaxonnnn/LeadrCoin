// Renders index.html frame by frame in headless Chromium and encodes a 1080x1920 MP4.
// usage: node render.mjs <audio-source.mp4> <out.mp4> [--stills 0.5,4.6,...] [--from s --to s]
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const [audio, out] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('console', m => console.log('[page]', m.text()));
page.on('pageerror', e => { console.error('[page error]', e); process.exit(1); });
await page.goto('file://' + path.join(here, 'index.html') + '?render=1');
await page.evaluate(() => window.ready);
const { FPS, DURATION } = await page.evaluate(() => ({ FPS: SCENE.FPS, DURATION: SCENE.DURATION }));

const stills = opt('--stills');
if (stills) {
  mkdirSync(out, { recursive: true });
  for (const s of stills.split(',').map(Number)) {
    const url = await page.evaluate(t => window.frameData(t, 'image/png'), s);
    writeFileSync(path.join(out, `still_${s.toFixed(2)}.png`), Buffer.from(url.split(',')[1], 'base64'));
  }
  await browser.close();
  process.exit(0);
}

const from = parseFloat(opt('--from') ?? 0), to = parseFloat(opt('--to') ?? DURATION);
const ff = spawn('ffmpeg', [
  '-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
  ...(audio ? ['-ss', String(from), '-t', String(to - from), '-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k'] : []),
  '-vf', 'noise=alls=2:allf=t,format=yuv420p',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-maxrate', '12M', '-bufsize', '24M', '-profile:v', 'high', '-r', String(FPS),
  '-movflags', '+faststart', '-shortest', out,
], { stdio: ['pipe', 'inherit', 'inherit'] });

const n0 = Math.round(from * FPS), n1 = Math.round(to * FPS);
const t0 = Date.now();
for (let f = n0; f < n1; f++) {
  const url = await page.evaluate(t => window.frameData(t, 'image/jpeg', 0.96), f / FPS);
  const buf = Buffer.from(url.split(',')[1], 'base64');
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (f % 30 === 0) process.stdout.write(`\rframe ${f}/${n1}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await browser.close();
console.log(`\ndone → ${out}`);
