// Flat Enostaven buttons evidence. Run from artifacts/smart360 with the dev app on :80:
//   node src/tests/fixtures/capture-flat-buttons.mjs before|after
// Writes screenshots + raw.json under reports/oklch-palette/flat-buttons/<phase>/.
// Real LivingGuideGuestShell via the DEV fixture; source=published uses the existing
// published snapshots (verification-only/enostaven/*.json). No DB, no accounts.
import {chromium} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const phase=process.argv[2];if(!['before','after'].includes(phase))throw new Error('phase before|after');
const out=`reports/oklch-palette/flat-buttons/${phase}`;await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:execFileSync('which',['chromium'],{encoding:'utf8'}).trim(),headless:true,args:['--no-sandbox']});
const BASE='http://127.0.0.1:80/__simple-fixture';
const CASES=[
 {id:'drobez-bordo-published',q:'tenant=drobez&palette=bordo&source=published'},
 {id:'melipu-bordo-published',q:'tenant=melipu&palette=bordo&source=published'},
 {id:'melipu-modra-published',q:'tenant=melipu&palette=modra&source=published'},
 {id:'drobez-custom-pale-2563EB',q:'tenant=drobez&palette=custom&color=%232563EB&source=published'},
 {id:'drobez-custom-dark-F6DFCC',q:'tenant=drobez&palette=custom&color=%23F6DFCC&source=published'},
 {id:'melipu-custom-dark-93B021',q:'tenant=melipu&palette=custom&color=%2393B021&source=published'},
 ...['morning','day','evening','night'].map(s=>({id:`melipu-bordo-dynamic-${s}`,q:`tenant=melipu&palette=bordo&skin=${s}&source=published`})),
 {id:'drobez-custom-dark-F6DFCC-dynamic-day',q:'tenant=drobez&palette=custom&color=%23F6DFCC&skin=day&source=published'},
];
const probe=()=>{
 const px=(v)=>parseFloat(v)||0;
 const desc=(el)=>{if(!el)return null;const s=getComputedStyle(el),r=el.getBoundingClientRect(),b=getComputedStyle(el,'::before');
  return{cls:String(el.className.baseVal??el.className),w:+r.width.toFixed(3),h:+r.height.toFixed(3),x:+r.x.toFixed(2),y:+r.y.toFixed(2),
   border:px(s.borderTopWidth),borderColor:s.borderTopColor,radius:s.borderTopLeftRadius,radiusPx:px(s.borderTopLeftRadius)*(s.borderTopLeftRadius.includes('%')?r.width/100:1),
   padding:s.padding,boxShadow:s.boxShadow,outline:`${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor} off ${s.outlineOffset}`,
   bgImage:s.backgroundImage,bgColor:s.backgroundColor,bgClip:s.backgroundClip,filter:s.filter,
   before:b.content&&b.content!=='none'?{inset:`${b.top} ${b.left}`,radius:b.borderTopLeftRadius,bgImage:b.backgroundImage,boxShadow:b.boxShadow}:null};};
 const tile=document.querySelector('.lgs-tile');let t=null;
 if(tile){const r=tile.getBoundingClientRect(),svg=tile.querySelector('svg').getBoundingClientRect(),lb=tile.querySelector('b').getBoundingClientRect(),
  grid=tile.parentElement.getBoundingClientRect(),tiles=[...tile.parentElement.children].map(e=>e.getBoundingClientRect()),d=desc(tile);
  const pseudo=getComputedStyle(tile,'::after');const masked=pseudo.content&&pseudo.content!=='none';
  if(masked)d.border=+(r.width*0.023).toFixed(3); // ring = SVG mask 23/1000 of tile width
  const gapPx=masked?parseFloat(pseudo.top)-d.border:+(/0px 0px 0px ([\d.]+)px inset/.exec(d.boxShadow)?.[1]??0);
  d.gapPaint=masked?'transparent (page/dynamic background)':(d.boxShadow.includes('inset')?'palette --s-bg (inset shadow)':'none');
  t={...d,gapPx:+gapPx,borderPct:+(d.border/r.width*100).toFixed(3),gapPct:+(gapPx/r.width*100).toFixed(3),radiusPct:+(d.radiusPx/r.width*100).toFixed(3),
   iconPct:+(svg.height/r.height*100).toFixed(2),labelBottomPct:+((lb.bottom-r.top)/r.height*100).toFixed(2),
   labelFont:(()=>{const s=getComputedStyle(tile.querySelector('b'));return `${s.fontFamily.split(',')[0]} ${s.fontWeight} ${s.fontSize} ${s.textTransform}`;})(),
   gradient:masked?pseudo.backgroundImage:getComputedStyle(tile).backgroundImage,
   marginLeft:+(r.left-grid.left).toFixed(2),marginRight:+(window.innerWidth-tiles[2]?.right).toFixed(2),colGap:+(tiles[1]?.left-tiles[0]?.right).toFixed(2),
   square:Math.abs(r.width-r.height)<0.5};}
 const root=document.querySelector('.lg2-app');
 const audit=[...document.querySelectorAll('button,a,[role=button],.lgs-tile,.lgs-flag,.lgs-open,.lg-back-circle,.lgs-home-circle')].filter(e=>e.getBoundingClientRect().width>0)
  .map(e=>({cls:String(e.className.baseVal??e.className).slice(0,80),testid:e.dataset.testid||null,boxShadow:getComputedStyle(e).boxShadow,before:getComputedStyle(e,'::before').boxShadow,w:Math.round(e.getBoundingClientRect().width),h:Math.round(e.getBoundingClientRect().height)}));
 return{simple:!!root?.classList.contains('lgs-root'),skin:document.querySelector('.lgs-home')?.dataset.weatherSkin??null,tile:t,
  circles:[...document.querySelectorAll('.lgs-home-circle,.lg-back-circle,.lgs-flag')].slice(0,4).map(desc),open:desc(document.querySelector('.lgs-open')),audit};};
const go=async(url,ready,dsf=2)=>{const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:dsf});const p=await ctx.newPage();
 await p.goto(url);await p.locator(ready).first().waitFor({timeout:20000});await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(600);return p;};
const raw={phase,capturedAt:new Date().toISOString(),viewport:'390x844',cases:{},trend:{}};
for(const c of CASES){const p=await go(`${BASE}/home?${c.q}&lang=sl`,'.lgs-tile');
 await p.screenshot({path:`${out}/${c.id}-grid.png`});
 await p.locator('.lgs-tile').first().screenshot({path:`${out}/${c.id}-tile.png`});
 const ctrl=p.locator('.lgs-home-controls');if(await ctrl.count())await ctrl.screenshot({path:`${out}/${c.id}-circles.png`});
 raw.cases[c.id]={q:c.q,...await p.evaluate(probe)};await p.context().close();}
for(const [id,q] of [['drobez-bordo-landing','tenant=drobez&palette=bordo&source=published'],['melipu-custom-dark-landing','tenant=melipu&palette=custom&color=%23F6DFCC&source=published']]){
 const p=await go(`${BASE}?${q}&lang=sl`,'.lgs-open');await p.screenshot({path:`${out}/${id}.png`});
 await p.locator('.lgs-open').screenshot({path:`${out}/${id}-open.png`});await p.locator('.lgs-flags').screenshot({path:`${out}/${id}-flags.png`});
 raw.cases[id]={q,...await p.evaluate(probe)};await p.context().close();}
// Trend baseline: every computed style of every visible control, home + landing.
const trendProbe=()=>{const K=['boxShadow','border','borderRadius','background','backgroundClip','padding','outline','color','width','height','filter','transform'];
 return[...document.querySelectorAll('button,a,[role=button],.lgs-flag,.lg-back-circle,.lgs-home-circle,.lg2-cover *')].filter(e=>e.getBoundingClientRect().width>0).map(e=>{const s=getComputedStyle(e);
  return Object.fromEntries([['cls',String(e.className.baseVal??e.className).slice(0,80)],...K.map(k=>[k,s[k]])]);});};
for(const [id,url,ready] of [['trend-home-drobez',`${BASE}/home?tenant=drobez&palette=trend&source=published&lang=sl`,'.lgs-home-controls, .lg2-app'],
 ['trend-landing-drobez',`${BASE}?tenant=drobez&palette=trend&source=published&lang=sl`,'.lgs-flags'],
 ['trend-home-melipu',`${BASE}/home?tenant=melipu&palette=trend&source=published&lang=sl`,'.lg2-app']]){
 const p=await go(url,ready);await p.waitForTimeout(800);await p.screenshot({path:`${out}/${id}.png`});raw.trend[id]=await p.evaluate(trendProbe);await p.context().close();}
await writeFile(`${out}/raw.json`,JSON.stringify(raw,null,1));await browser.close();
console.log('ok',out,Object.keys(raw.cases).length,'cases');
