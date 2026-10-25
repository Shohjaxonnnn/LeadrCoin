// usage: node tools/frames.js outdir t1 t2 ...
const { chromium } = require('playwright'); const path=require('path'); const fs=require('fs');
(async () => {
  const [,, outdir, ...ts] = process.argv; fs.mkdirSync(outdir,{recursive:true});
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  p.on('console', m => { if (m.type()==='error'||m.type()==='warning') console.log('[page]', m.text()); });
  p.on('pageerror', e => console.log('[pageerror]', e.message));
  await p.goto('file://' + path.resolve('index.html'));
  await p.evaluate(() => window.ready);
  for (const t of ts) { await p.evaluate(t => window.seek(+t), t); await p.screenshot({ path: `${outdir}/f_${String(t).padStart(5,'0')}.png` }); }
  await b.close();
})();
