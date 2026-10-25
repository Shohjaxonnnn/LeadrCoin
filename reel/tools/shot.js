const { chromium } = require('playwright');
(async () => {
  const [,, url, out, w, h] = process.argv;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +w||1080, height: +h||1920 } });
  await p.goto('file://' + require('path').resolve(url)); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
  await p.screenshot({ path: out, fullPage: true }); await b.close();
})();
