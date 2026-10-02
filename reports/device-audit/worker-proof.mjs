import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
const dir = 'reports/device-audit/';
const payload = await readFile(dir+'published.json');
const manifest = await readFile(dir+'manifest-before.json');
const results = [];
for (const variant of ['before', 'after']) {
  const worker = await readFile(dir+`sw-${variant}.js`);
  let stalled = false;
  const server = createServer(async (req,res) => {
    const path = req.url.split('?')[0];
    if (path.endsWith('/sw.js')) {
      res.writeHead(200, {'Content-Type':'text/javascript', 'Service-Worker-Allowed':'/turizem-drobez/'}); res.end(worker);
    } else if (path.endsWith('/manifest.webmanifest')) {
      res.writeHead(200, {'Content-Type':'application/manifest+json'}); res.end(manifest);
    } else if (path === '/api/public/tenants/turizem-drobez') {
      res.writeHead(200, {'Content-Type':'application/json'}); res.end(payload);
    } else if (path.startsWith('/brand/')) {
      try { const img=await readFile('artifacts/smart360/public'+path); res.writeHead(200, {'Content-Type':'image/png'});res.end(img); }
      catch {res.writeHead(404);res.end();}
    } else if (path === '/assets/proof.js') {
      stalled = true; // Deliberately never complete the shell dependency response.
    } else {
      res.writeHead(200, {'Content-Type':'text/html'});
      res.end(`<link rel="manifest" href="/api/public/tenants/turizem-drobez/manifest.webmanifest"><script type="module" src="/assets/proof.js"></script><h1>Worker activation proof</h1><script>
      navigator.serviceWorker.register('/api/public/tenants/turizem-drobez/sw.js',{scope:'/turizem-drobez/'}).then(()=>navigator.serviceWorker.ready).then(r=>r.active.postMessage({type:'LG_OFFLINE_INIT',slug:'turizem-drobez',lang:'sl'}));
      </script>`);
    }
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const profile=await mkdtemp(tmpdir()+'/worker-proof-');
  const context=await chromium.launchPersistentContext(profile,{headless:true,executablePath:'/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium',args:['--no-sandbox']});
  const page=await context.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/turizem-drobez/`,{waitUntil:'commit'});
  await page.waitForTimeout(4000);
  const state=await page.evaluate(async()=>{
    const r=await navigator.serviceWorker.getRegistration();
    return {secureContext:isSecureContext,controller:!!navigator.serviceWorker.controller,installing:r?.installing?.state,active:r?.active?.state};
  });
  const cdp=await context.newCDPSession(page);
  results.push({variant,stalled,state,installability:await cdp.send('Page.getInstallabilityErrors')});
  await context.close();
  server.closeAllConnections(); await new Promise(r=>server.close(r));
  await rm(profile,{recursive:true,force:true});
}
await writeFile(dir+'worker-proof.json',JSON.stringify({environment:'Desktop Chromium, persistent profile, localhost trustworthy origin, real generated worker + production snapshot, deliberately stalled shell request; NOT Android/WebAPK or full app offline proof',results},null,2));
console.log(JSON.stringify(results,null,2));
if(results[0].state.active || results[1].state.active !== 'activated' || !results[1].state.controller) process.exitCode=1;