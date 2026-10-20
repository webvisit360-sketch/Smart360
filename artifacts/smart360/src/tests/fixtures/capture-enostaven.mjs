import {chromium} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const out='reports/enostaven';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:execFileSync('which',['chromium'],{encoding:'utf8'}).trim(),headless:true,args:['--no-sandbox']});
const results=[];
const metrics=()=>[...document.querySelectorAll('.lgs-tile')].map(el=>{
 const b=el.querySelector('b'),s=el.querySelector('svg'),r=el.getBoundingClientRect(),l=b.getBoundingClientRect(),cs=getComputedStyle(el),bs=getComputedStyle(b);
 return {label:b.textContent,width:r.width,height:r.height,icon:s.getBoundingClientRect().height,labelHeight:l.height,lines:l.height/parseFloat(bs.lineHeight),labelSize:bs.fontSize,overflow:b.scrollHeight>b.clientHeight+1||l.bottom>r.bottom-3||l.right>r.right-2,border:cs.borderWidth,radius:cs.borderRadius,gradient:cs.backgroundImage};
});
try{
 for(const tenant of ['drobez','melipu']){
  for(const palette of ['bordo','modra','custom']){
   const page=await browser.newPage({viewport:{width:390,height:844}});
   await page.goto(`http://127.0.0.1:80/__simple-fixture/home?tenant=${tenant}&palette=${palette}&color=%23246B54&lang=sl`);
   await page.getByTestId('screen-simple-home').waitFor();await page.evaluate(()=>document.fonts.ready);
   await page.screenshot({path:`${out}/${tenant}-${palette}.png`});
   results.push({tenant,palette,source:'reference-shaped fixture',tiles:await page.evaluate(metrics)});
   await page.close();
  }
  for(const lang of ['sl','en','de','it','fr','nl','hr']){
   const page=await browser.newPage({viewport:{width:390,height:844}});
   await page.goto(`http://127.0.0.1:80/__simple-fixture/home?tenant=${tenant}&palette=bordo&source=published&lang=${lang}`);
   await page.getByTestId('screen-simple-home').waitFor();await page.evaluate(()=>document.fonts.ready);
   if(lang==='sl')await page.screenshot({path:`${out}/${tenant}-published.png`});
   results.push({tenant,lang,source:'public snapshot',tiles:await page.evaluate(metrics)});
   await page.close();
  }
 }
 for(const [tenant,file] of [['drobez','0_enostavna-koncni_1792527950636.html'],['melipu','enostavna-melipu_1792526887122.html']]){
  for(const palette of ['bordo','modra']){
   const page=await browser.newPage({viewport:{width:390,height:844}});
   await page.setContent(await readFile(`../../attached_assets/${file}`,'utf8'));
   await page.evaluate(palette=>{
    const selected=[...document.querySelectorAll(`.phone.pal-${palette}`)].find(el=>el.querySelector('.top'));
    document.body.replaceChildren(selected);document.body.style.cssText='margin:0;padding:0;display:block;background:white';
    selected.style.cssText='width:390px;border-radius:0;box-shadow:none';
   },palette);
   await page.evaluate(()=>document.fonts.ready);
   await page.screenshot({path:`${out}/${tenant}-${palette}-reference.png`});
   results.push({tenant,palette,source:'binding HTML at 390px',tiles:await page.locator('.tile').evaluateAll(els=>els.map(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,border:getComputedStyle(el).borderWidth,icon:el.querySelector('svg').getBoundingClientRect().height})))});
   await page.close();
  }
 }
 await writeFile(`${out}/measurements.json`,JSON.stringify(results,null,2));
 console.log('Overflow:',results.flatMap(r=>(r.tiles??[]).filter(t=>t.overflow||t.lines>3.1).map(t=>({tenant:r.tenant,lang:r.lang,...t}))));
}finally{await browser.close();}
