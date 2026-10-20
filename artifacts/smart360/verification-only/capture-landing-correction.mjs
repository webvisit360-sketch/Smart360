import {chromium} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir='reports/enostaven/landing-correction';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:execFileSync('which',['chromium'],{encoding:'utf8'}).trim(),headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const results=[];
try {
 for(const tenant of ['drobez','melipu']) for(const design of ['trend','bordo']){
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.route('**/verification-only/enostaven/*.json',async route=>{
   const data=JSON.parse(await readFile(`verification-only/enostaven/${tenant==='drobez'?'turizem-drobez':'meli-pu'}-sl.json`,'utf8'));
   data.tourUrl=null; // photo-mode evidence only; never persist this override
   await route.fulfill({json:data});
  });
  await page.route('**/api/storage/img/**',async route=>route.fulfill({contentType:'image/jpeg',body:await readFile(`${dir}/${tenant}-photo.jpg`)}));
  await page.goto(`http://127.0.0.1:80/__simple-fixture?tenant=${tenant}&palette=${design}&source=published&lang=sl`);
  await page.getByTestId('landing-flags').waitFor();
  await page.evaluate(()=>document.fonts.ready);
  await page.evaluate(async()=>{await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});
  await page.waitForTimeout(2600);
  const measurement=await page.evaluate(()=>{
   const rect=el=>el.getBoundingClientRect().toJSON();
   const flags=[...document.querySelectorAll('.lgs-flag')].map(el=>({code:el.getAttribute('aria-label'),selected:el.getAttribute('aria-pressed'),...rect(el),radius:getComputedStyle(el).borderRadius,border:getComputedStyle(el).borderColor,gap:getComputedStyle(el).padding,image:rect(el.querySelector('img'))}));
   const host=document.querySelector('.lg2-cover-mast,.lgs-land');
   return {flags,button:rect(document.querySelector('[data-testid="button-open-guide"]')),host:rect(host),caption:!!document.querySelector('.lgs-flags-lbl'),overlay:!!document.querySelector('.lgs-shade,.lg2-cover-veil'),media:document.querySelector('.lgs-hero iframe,.lg2-cover-tour iframe')?.getAttribute('src'),hostBackground:getComputedStyle(host).backgroundColor};
  });
  assert.equal(measurement.flags.length,7);
  for(const f of measurement.flags){assert.equal(f.width,44);assert.equal(f.height,44);assert.equal(f.radius,'50%');assert.equal(f.gap,'1px');}
  assert.equal(measurement.button.bottom,828);assert.equal(measurement.caption,false);assert.equal(measurement.overlay,false);
  assert.equal(measurement.flags.find(f=>f.code==='SL').bottom,Math.max(...measurement.flags.map(f=>f.bottom)));
  await page.screenshot({path:`${dir}/${tenant}-${design}.png`});
  await page.getByTestId('button-flag-en').click();
  assert.equal(await page.getByTestId('button-flag-en').getAttribute('aria-pressed'),'true');
  assert.equal(await page.getByTestId('button-flag-en').evaluate(el=>el.getBoundingClientRect().width),44);
  results.push({tenant,design,...measurement});
  await page.close();
 }
 await writeFile(`${dir}/measurements.json`,JSON.stringify(results,null,2));
 console.log('PASS: four 390×844 landings, bottom CTA, equal circles, no tint layer, language switching.');
} finally {await browser.close();}
