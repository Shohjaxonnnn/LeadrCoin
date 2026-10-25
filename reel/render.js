// Deterministic frame-by-frame renderer: Playwright (seek + screenshot) -> ffmpeg.
// usage: node render.js <out.mp4> [fps=60] [audio.wav] [t0=0] [t1=DURATION]
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const path = require('path'); const fs = require('fs'); const os = require('os');

const [,, OUT = 'out/reel.mp4', FPS_ = '60', AUDIO = '', T0_ = '0', T1_ = ''] = process.argv;
const FPS = +FPS_; const WORKERS = Math.min(4, os.cpus().length);

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'reel-')); fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const probe = await chromium.launch(); const pp = await probe.newPage({ viewport: { width: 1080, height: 1920 } });
  await pp.goto('file://' + path.resolve('index.html')); await pp.evaluate(() => window.ready);
  const DUR = await pp.evaluate(() => window.DURATION); await probe.close();
  const t0 = +T0_, t1 = T1_ ? +T1_ : DUR;
  const f0 = Math.round(t0 * FPS), f1 = Math.round(t1 * FPS), total = f1 - f0;
  const per = Math.ceil(total / WORKERS);
  console.log(`frames ${f0}..${f1} (${total}) @${FPS}fps, ${WORKERS} workers`);
  const started = Date.now(); let done = 0;

  const jobs = Array.from({ length: WORKERS }, (_, w) => (async () => {
    const a = f0 + w * per, b = Math.min(f1, a + per); if (a >= b) return null;
    const chunk = path.join(tmp, `c${w}.mp4`);
    const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '15',
      '-g', String(FPS), '-keyint_min', String(FPS), '-sc_threshold', '0', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', chunk],
      { stdio: ['pipe', 'inherit', 'inherit'] });
    const closed = new Promise(r => ff.on('close', r));
    const br = await chromium.launch(); const pg = await br.newPage({ viewport: { width: 1080, height: 1920 } });
    await pg.goto('file://' + path.resolve('index.html')); await pg.evaluate(() => window.ready);
    for (let f = a; f < b; f++) {
      await pg.evaluate(t => window.seek(t), f / FPS);
      const buf = await pg.screenshot({ type: 'jpeg', quality: 96 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (++done % 60 === 0) { const s = (Date.now() - started) / 1000; process.stdout.write(`\r${done}/${total}  ${(done / s).toFixed(1)} fps  eta ${((total - done) / (done / s)).toFixed(0)}s   `); }
    }
    ff.stdin.end(); await closed; await br.close(); return chunk;
  })());
  const chunks = (await Promise.all(jobs)).filter(Boolean);
  console.log('\nconcat…');
  const list = path.join(tmp, 'list.txt'); fs.writeFileSync(list, chunks.map(c => `file '${c}'`).join('\n'));
  const args = ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list];
  // final pass: delivery-size encode (chunks are near-lossless) + loudness-normalised audio
  if (AUDIO) args.push('-i', AUDIO);
  args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-maxrate', '14M', '-bufsize', '28M', '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-r', String(FPS));
  if (AUDIO) args.push('-af', 'loudnorm=I=-14:TP=-1.5:LRA=9', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest');
  args.push('-movflags', '+faststart', OUT);
  execFileSync('ffmpeg', args, { stdio: 'inherit' });
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('done →', OUT, ((Date.now() - started) / 1000).toFixed(0) + 's');
})();
