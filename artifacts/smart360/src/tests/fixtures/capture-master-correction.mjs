// Master-correction evidence (template-exact scaled geometry, outer drop shadows removed).
//   node src/tests/fixtures/capture-master-correction.mjs before|after
// Templates are opened READ-ONLY via file:// (never written). App = dev fixture on :80,
// source=published snapshots. Writes reports/oklch-palette/master-correction/<phase>/.
import {chromium} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const phase=process.argv[2];if(!['before','after'].includes(phase))throw new Error('phase before|after');
const out=`reports/oklch-palette/master-correction/${phase}`;await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:execFileSync('which',['chromium'],{encoding:'utf8'}).trim(),headless:true,args:['--no-sandbox']});
const TPL={drobez:resolve('../../attached_assets/0_enostavna-koncni_1792527950636.html'),melipu:resolve('../../attached_assets/enostavna-melipu_1792526887122.html')};
const probe=(phoneSel)=>{
  const phone=document.querySelector(phoneSel);const pw=phone.getBoundingClientRect().width;
  const tile=phone.querySelector('.tile,.lgs-tile');const s=getComputedStyle(tile),r=tile.getBoundingClientRect();
  const grid=tile.parentElement,gs=getComputedStyle(grid),gr=grid.getBoundingClientRect();
  const kids=[...grid.children].map(e=>e.getBoundingClientRect());
  const svg=tile.querySelector('svg').getBoundingClientRect();
  const sec=phone.querySelector('.sec,.lgs-sec');const ss=getComputedStyle(sec);
  const inset=/inset/.test(s.boxShadow)?+(/(?:^|,\s*)(?:rgba?\([^)]*\)\s*)?0px 0px 0px ([\d.]+)px inset/.exec(s.boxShadow)?.[1]??0):0;
  const outer=s.boxShadow.split(/,(?![^(]*\))/).filter(x=>x.trim()!=='none'&&!/inset/.test(x)).join(',')||'none';
  const open=document.querySelector('.open,.lgs-open');
  return{phoneW:+pw.toFixed(3),tileW:+r.width.toFixed(3),tileH:+r.height.toFixed(3),border:parseFloat(s.borderTopWidth),insetGap:inset,
    radius:parseFloat(s.borderTopLeftRadius),icon:+svg.width.toFixed(3),padT:parseFloat(s.paddingTop),padX:parseFloat(s.paddingLeft),padB:parseFloat(s.paddingBottom),
    colGap:+(kids[1].left-kids[0].right).toFixed(3),rowGap:kids[3]?+(kids[3].top-kids[0].bottom).toFixed(3):parseFloat(gs.rowGap),
    gridMarginL:+(kids[0].left-phone.getBoundingClientRect().left).toFixed(3),secMarginL:parseFloat(ss.marginLeft),secMarginT:parseFloat(ss.marginTop),
    outerShadow:outer,boxShadow:s.boxShadow,openShadow:open?getComputedStyle(open).boxShadow:null};
};
const raw={phase,viewport:'390x844',template:{},app:{}};
for(const [k,f] of Object.entries(TPL)){
  const ctx=await browser.newContext({viewport:{width:460,height:900},deviceScaleFactor:2});const p=await ctx.newPage();
  await p.goto('file://'+f);await p.waitForTimeout(800);
  // in-memory id on the 2nd phone (home, bordo) for selection; the file on disk is never written
  await p.evaluate(()=>{document.querySelectorAll('.phone')[1].id='m-home';});
  raw.template[k]=await p.evaluate(probe,'#m-home');
  const b=await p.locator('#m-home').boundingBox();
  await p.screenshot({fullPage:true,path:`${out}/template-${k}-home.png`,clip:{x:b.x,y:b.y,width:b.width,height:Math.min(b.height,844)}});
  await ctx.close();
}
for(const k of ['drobez','melipu']){
  const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});const p=await ctx.newPage();
  await p.goto(`http://127.0.0.1:80/__simple-fixture/home?tenant=${k}&palette=bordo&source=published&lang=sl`);
  await p.locator('.lgs-tile').first().waitFor({timeout:30000});await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(600);
  raw.app[k]=await p.evaluate(probe,'.lgs-home');
  await p.screenshot({path:`${out}/app-${k}-home-390x844.png`});
  await p.locator('.lgs-tile').first().screenshot({path:`${out}/app-${k}-tile.png`});
  const lp=await ctx.newPage();await lp.goto(`http://127.0.0.1:80/__simple-fixture?tenant=${k}&palette=bordo&source=published&lang=sl`);
  await lp.locator('.lgs-open').waitFor({timeout:30000});await lp.waitForTimeout(600);
  raw.app[k].landingOpenShadow=await lp.evaluate(()=>getComputedStyle(document.querySelector('.lgs-open')).boxShadow);
  raw.app[k].landingFlagShadow=await lp.evaluate(()=>getComputedStyle(document.querySelector('.lgs-flag')).boxShadow);
  await lp.screenshot({path:`${out}/app-${k}-landing-390x844.png`});
  await ctx.close();
}
await writeFile(`${out}/raw.json`,JSON.stringify(raw,null,1));await browser.close();console.log(JSON.stringify(raw,null,1));
