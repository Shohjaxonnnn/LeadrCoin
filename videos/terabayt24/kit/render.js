// usage: node render.js <url> <out.mp4> <sfx.json> [fps] [snapshot times...]
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const { spawn } = require('child_process');
const fs = require('fs');
(async () => {
  const [, , url, out, sfxOut, fpsArg, ...snaps] = process.argv;
  const fps = +(fpsArg || 60);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  p.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await p.goto(url); await p.waitForFunction(() => window.READY, null, { timeout: 180000 });
  fs.writeFileSync(sfxOut, JSON.stringify(await p.evaluate(() => window.SFX)));
  const dur = await p.evaluate(() => window.TLEND);
  if (snaps.length) {
    for (const t of snaps) { await p.evaluate((t) => render(+t), t); await p.screenshot({ path: `${out}_${t}.png` }); }
    await b.close(); return;
  }
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const N = Math.round(fps * dur);
  for (let i = 0; i < N; i++) {
    await p.evaluate((t) => render(t), i / fps);
    const buf = await p.screenshot({ type: 'jpeg', quality: 97 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r)); await b.close();
  console.log('rendered', N, 'frames', dur, 's');
})();
