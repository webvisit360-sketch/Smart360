import {chromium} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:execFileSync('which',['chromium'],{encoding:'utf8'}).trim(),headless:true,args:['--no-sandbox']});
const out='reports/enostaven';const result={};
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 for(const palette of ['bordo','trend']){
  await page.goto(`http://127.0.0.1:80/__simple-fixture?tenant=melipu&palette=${palette}&source=published&lang=sl`);
  await page.getByTestId('landing-flags').waitFor();
  await page.evaluate(()=>document.fonts.ready);
  const flags=await page.locator('.lgs-flag').evaluateAll(els=>els.map(el=>({code:el.getAttribute('aria-label'),selected:el.getAttribute('aria-pressed'),button:el.getBoundingClientRect().toJSON(),image:el.querySelector('img').getBoundingClientRect().toJSON()})));
  assert.equal(flags.length,7);
  for(const f of flags){assert.equal(f.button.height,44);assert.equal(f.button.width,44);assert.ok(f.image.height<f.button.height);}
  const sl=flags.find(f=>f.code==='SL');assert.equal(Math.max(...flags.map(f=>f.image.bottom)),sl.image.bottom);
  const caption=await page.locator('.lgs-flags-lbl').boundingBox();assert.equal(caption,null);
  await page.screenshot({path:`${out}/landing-${palette}.png`});
  await page.getByTestId('button-flag-en').click();
  assert.equal(await page.getByTestId('button-flag-en').getAttribute('aria-pressed'),'true');
  result[palette]={flags,caption,immediateLanguageChange:true};
 }
 await page.goto('http://127.0.0.1:80/__simple-fixture/home?tenant=melipu&palette=bordo&source=published&lang=sl');
 await page.getByTestId('screen-simple-home').waitFor();
 await page.locator('.lgs-tile').filter({hasText:'Apartmaji'}).click();
 await page.waitForTimeout(900);
 const links=page.locator('[data-testid="screen-detail"] button');
 // The one explicit simple back control exists even on categories without a hero image.
 const back=page.getByTestId('button-simple-detail-back');
 await back.waitFor();assert.equal(await back.count(),1);
 await page.screenshot({path:`${out}/category-single-back.png`});
 await back.click();await page.waitForTimeout(1200);
 assert.ok(new URL(page.url()).pathname.endsWith('/home'));
 await page.getByTestId('screen-simple-home').waitFor();
 result.back={singleVisibleControl:true,returnsHome:true};
 await writeFile(`${out}/final-interactions.json`,JSON.stringify(result,null,2));
 console.log('PASS: both landing flag layouts, immediate language switching, single back to home');
}finally{await browser.close();}
