const { chromium } = require('playwright'); const path = require('path'); const serve = require('./serve');
(async () => {
  const srv = await serve(path.join(__dirname, '..'));
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  p.on('console', m => console.log('[page]', m.text())); p.on('pageerror', e => console.log('[err]', e.message));
  await p.goto(srv.url(process.argv[2])); await p.evaluate(() => window.ready);
  const info = await p.evaluate(() => { const gl = document.createElement('canvas').getContext('webgl2'); const d = gl && gl.getExtension('WEBGL_debug_renderer_info'); return gl ? gl.getParameter(d ? d.UNMASKED_RENDERER_WEBGL : gl.RENDERER) : 'no webgl2'; });
  console.log('renderer:', info);
  let t0 = Date.now();
  for (let i = 0; i < 10; i++) { await p.evaluate(t => window.seek(t), i / 10); await p.screenshot({ type: 'jpeg', quality: 90, path: i === 5 ? process.argv[3] : undefined }); }
  console.log('ms/frame (seek+screenshot):', (Date.now() - t0) / 10);
  await b.close(); srv.close();
})();
