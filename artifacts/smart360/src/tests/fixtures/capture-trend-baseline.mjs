import {chromium} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const stage=process.argv[2]||'before';
const out='reports/enostaven';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:execFileSync('which',['chromium'],{encoding:'utf8'}).trim(),headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
 await page.clock.install({time:new Date('2026-10-20T12:00:00Z')});
 await page.goto(`http://127.0.0.1:80/content-proof.html?lang=hr${stage==='before'?'&baseline=1':''}`);
 await page.getByTestId('button-open-guide').waitFor();
 await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:`${out}/trend-cover-${stage}.png`,animations:'disabled'});
 await page.getByTestId('button-open-guide').click();
  const later=page.locator('.lg2-later');
  if(await later.count())await later.click();
 await page.getByTestId('screen-home').waitFor();
 await page.waitForTimeout(1200);
  await page.mouse.move(389,843);
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));});
  await page.clock.pauseAt(new Date('2026-10-20T13:00:00Z'));
  await page.clock.runFor(500);
  await page.evaluate(()=>{for(const el of document.querySelectorAll('*'))if(el.scrollWidth>el.clientWidth){el.style.scrollBehavior='auto';el.style.scrollSnapType='none';el.scrollLeft=0;}});
 await page.screenshot({path:`${out}/trend-home-${stage}.png`,animations:'disabled'});
 await writeFile(`${out}/trend-home-${stage}.json`,JSON.stringify(await page.getByTestId('screen-home').evaluate(el=>({html:el.outerHTML,rect:el.getBoundingClientRect().toJSON()})),null,2));
}finally{await browser.close();}
