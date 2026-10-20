import {chromium} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir='reports/enostaven/safe-landing';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:execFileSync('which',['chromium'],{encoding:'utf8'}).trim(),headless:true,args:['--no-sandbox']});
const results=[];
async function setup(page,tenant,{noLanding=false,standalone=false}={}){
 if(standalone)await page.addInitScript(()=>Object.defineProperty(navigator,'standalone',{value:true}));
 await page.route('**/verification-only/enostaven/*.json',async r=>{
  const data=JSON.parse(await readFile(`verification-only/enostaven/${tenant==='melipu'?'meli-pu':'turizem-drobez'}-sl.json`,'utf8'));
  data.tourUrl=null;
  if(noLanding){data.heroUrl=null;data.livingGuideHeroUrl=null;}
  await r.fulfill({json:data});
 });
 await page.route('**/api/storage/img/**',async r=>r.fulfill({contentType:'image/jpeg',body:await readFile(`reports/enostaven/landing-correction/${tenant}-photo.jpg`)}));
}
try{
 for(const height of [844,920])for(const tenant of ['drobez','melipu'])for(const design of ['trend','bordo']){
  const page=await browser.newPage({viewport:{width:390,height}});
  await setup(page,tenant);
  const url=`http://127.0.0.1:80/__simple-fixture?tenant=${tenant}&palette=${design}&source=published&lang=sl`;
  await page.goto(url);await page.getByTestId('landing-flags').waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(2600);
  assert.equal(await page.getByTestId('button-return360').count(),0);
  let b=await page.getByTestId('button-open-guide').boundingBox();
  assert.equal(height-b.y-b.height,16);
  await page.screenshot({path:`${dir}/${tenant}-${design}-${height}.png`});
  // Model iPhone safe-area values without pretending this is a physical iPhone.
  await page.locator('.lg2-app').evaluate(el=>el.style.setProperty('--lg2-safe-bottom','34px'));
  b=await page.getByTestId('button-open-guide').boundingBox();assert.equal(height-b.y-b.height,50);
  await page.screenshot({path:`${dir}/${tenant}-${design}-${height}-safe34.png`});
  results.push({tenant,design,height,browserBottomGap:16,simulated34pxSafeAreaGap:50,landingHas360:false});
  await page.close();
 }
 for(const tenant of ['drobez','melipu'])for(const design of ['trend','bordo','modra','custom']){
  const page=await browser.newPage({viewport:{width:390,height:844}});await setup(page,tenant);
  await page.goto(`http://127.0.0.1:80/__simple-fixture/home?tenant=${tenant}&palette=${design}&color=%23246B54&source=published&lang=sl`);
  const button=page.getByTestId('button-return360');await button.waitFor();await page.evaluate(()=>document.fonts.ready);
  const metrics=await page.locator('.lgs-home-circle').evaluateAll(es=>es.map(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,border:getComputedStyle(el).border,color:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor,font:getComputedStyle(el).fontFamily})));
  assert.equal(metrics.length,2);for(const m of metrics){assert.equal(m.width,44);assert.equal(m.height,44);}assert.equal(metrics[0].border,metrics[1].border);
  assert.equal(metrics[0].color,'rgb(255, 255, 255)');
  if(design==='bordo')assert.equal(metrics[0].background,'rgb(178, 52, 118)');
  if(design==='modra')assert.equal(metrics[0].background,'rgb(52, 79, 178)');
  if(design==='custom')assert.equal(metrics[0].background,'rgb(36, 107, 84)');
  await page.screenshot({path:`${dir}/${tenant}-${design}-home.png`});
  await button.click();await page.waitForTimeout(1000);
  assert.equal(new URL(page.url()).pathname.replace(/\/$/,''),'/__simple-fixture');
  await page.getByTestId('button-open-guide').waitFor();
  assert.equal(await button.count(),0);
  results.push({tenant,design,controls:metrics,returnsToLanding:true});await page.close();
 }
 for(const design of ['trend','bordo']){
  const page=await browser.newPage({viewport:{width:390,height:920}});await setup(page,'drobez',{noLanding:true,standalone:true});
  await page.goto(`http://127.0.0.1:80/__simple-fixture/home?tenant=drobez&palette=${design}&source=published&lang=sl`);
  await page.getByTestId('button-simple-language').waitFor();assert.equal(await page.getByTestId('button-return360').count(),0);
  results.push({design,noConfiguredLandingHides360:true});await page.close();
 }
 for(const design of ['trend','bordo']){
  const page=await browser.newPage({viewport:{width:390,height:920}});
  await setup(page,'melipu',{standalone:true});
  await page.goto(`http://127.0.0.1:80/__simple-fixture?tenant=melipu&palette=${design}&source=published&lang=sl`);
  await page.getByTestId('button-open-guide').waitFor();
  await page.locator('.lg2-app').evaluate(el=>el.style.setProperty('--lg2-safe-bottom','34px'));
  const b=await page.getByTestId('button-open-guide').boundingBox();assert.equal(920-b.y-b.height,50);
  assert.equal(await page.evaluate(()=>navigator.standalone),true);
  results.push({design,simulatedStandalone:true,safeArea:34,buttonBottomGap:50});await page.close();
  const tour=await browser.newPage({viewport:{width:390,height:844}});
  // Validate the real configured iframe destination without pretending to test Kuula rendering.
  await tour.route('https://kuula.co/**',r=>r.abort());
  await tour.goto(`http://127.0.0.1:80/__simple-fixture/home?tenant=melipu&palette=${design}&source=published&lang=sl`);
  await tour.getByTestId('button-return360').click();
  const iframe=tour.locator('.lgs-hero iframe,.lg2-cover-tour iframe');
  await iframe.waitFor();
  assert.match(await iframe.getAttribute('src'),/kuula\.co\/share\/collection\/7T32z/);
  assert.equal(await tour.getByTestId('button-return360').count(),0);
  results.push({design,configuredVirtualWalkDestination:true,externalRenderingNotTested:true});await tour.close();
 }
 const paths=[];
 for(const [tenant,label] of [['melipu','Apartmaji'],['melipu','Vhodna vrata'],['drobez','Domači izdelki']]){
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.goto(`http://127.0.0.1:80/__simple-fixture/home?tenant=${tenant}&palette=bordo&lang=sl`);
  const tile=page.locator('.lgs-tile').filter({hasText:label});await tile.waitFor();await tile.scrollIntoViewIfNeeded();await page.evaluate(()=>document.fonts.ready);
  paths.push(await tile.locator('svg path').getAttribute('d'));
  await page.screenshot({path:`${dir}/icon-${paths.length}-viewport.png`});await tile.screenshot({path:`${dir}/icon-${paths.length}.png`});
  const metrics=await tile.evaluate(el=>({tile:el.getBoundingClientRect().toJSON(),icon:el.querySelector('svg').getBoundingClientRect().toJSON(),viewBox:el.querySelector('svg').getAttribute('viewBox')}));
  assert.equal(metrics.viewBox,'0 0 24 24');assert.ok(metrics.icon.height>30);
  results.push({label,...metrics});await page.close();
 }
 assert.equal(new Set(paths).size,3);
 await writeFile(`${dir}/measurements.json`,JSON.stringify(results,null,2));console.log('PASS: responsive safe area, 360 presence/navigation/palettes, distinct SVGs.');
}finally{await browser.close();}
