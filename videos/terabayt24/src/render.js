const { chromium } = require('/opt/node-tools/node_modules/playwright');
const { spawn } = require('child_process');
(async()=>{
  const [,,html,out,fps,dur]=process.argv;
  const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']}); const p=await b.newPage({viewport:{width:1080,height:1920}});
  await p.goto(html); await p.waitForFunction(()=>window.ready3d,null,{timeout:120000}); await p.evaluate(()=>document.fonts.ready);
  const ff=spawn('ffmpeg',['-v','error','-y','-f','image2pipe','-framerate',fps,'-i','-','-c:v','libx264','-preset','slow','-crf','14','-pix_fmt','yuv420p',out],{stdio:['pipe','inherit','inherit']});
  const N=Math.round(+fps*+dur); const t0=Date.now();
  for(let i=0;i<N;i++){ await p.evaluate(t=>render(t),i/+fps); const buf=await p.screenshot({type:'jpeg',quality:97}); if(!ff.stdin.write(buf)) await new Promise(r=>ff.stdin.once('drain',r)); if(i%120==0) console.log(i,N,((Date.now()-t0)/1000).toFixed(1)+'s'); }
  ff.stdin.end(); await new Promise(r=>ff.on('close',r)); await b.close();
})();
