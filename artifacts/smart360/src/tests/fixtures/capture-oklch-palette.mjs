// Evidence: real SimpleDesignFixture (custom palette) beside the approved sheet card.
import {chromium} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const out='reports/oklch-palette';await mkdir(out,{recursive:true});
const sheet=await readFile('../../attached_assets/barvna-izpeljava_1792832744103.html','utf8');
const bases=['#407075','#C03028','#E07B20','#93B021','#2E8B57','#1897B0','#2563EB','#7C3AED','#E85BA8','#F6DFCC','#101B2E','#8B8E93','#4C7060'];
const K=['tile1','tile15','tile2','bg','stroke','txt','tint'];
const browser=await chromium.launch({executablePath:execFileSync('which',['chromium'],{encoding:'utf8'}).trim(),headless:true,args:['--no-sandbox']});
const sheetPage=await browser.newPage({viewport:{width:1460,height:900}});
await sheetPage.setContent(sheet);await sheetPage.evaluate(()=>document.fonts.ready);
const res=[];
for(const b of bases){
 const name=b.slice(1);
 const card=sheetPage.locator('.cell',{has:sheetPage.locator(`.toks b:text-is("osnova ${b}")`)}).first();
 let want=null;
 if(await card.count()){await card.screenshot({path:`${out}/${name}-sheet.png`});
  want=await card.evaluate(el=>{const o={};el.querySelectorAll('.toks span').forEach(s=>o[s.querySelector('i').textContent]=s.textContent.split(' ').pop());return o;});}
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.goto(`http://127.0.0.1:80/__simple-fixture/home?tenant=drobez&palette=custom&color=${encodeURIComponent(b)}&lang=sl`);
 await page.getByTestId('screen-simple-home').waitFor();await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:`${out}/${name}-app.png`});
 const got=await page.evaluate(()=>{const el=document.querySelector('[style*="--s-bg"]');const cs=getComputedStyle(el);const o={};
  for(const k of ['bg','tile1','tile15','tile2','stroke','txt','tint','adr'])o[k]=cs.getPropertyValue('--s-'+k).trim().toUpperCase();
  const f=document.querySelector('.lgs-foot');o.footColor=f&&getComputedStyle(f).color;o.footOpacity=f&&getComputedStyle(f).opacity;return o;});
 res.push({base:b,match:want?K.every(k=>want[k]===got[k]):'not in sheet (production base)',want,got});
 await page.close();
}
await browser.close();
await writeFile(`${out}/tokens.json`,JSON.stringify(res,null,1));
console.log(res.map(r=>r.base+' '+r.match+' foot '+r.got.footColor+' op '+r.got.footOpacity).join('\n'));
