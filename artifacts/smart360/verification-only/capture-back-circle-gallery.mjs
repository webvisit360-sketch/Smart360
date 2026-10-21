// VERIFICATION-ONLY: unified back circle evidence gallery (synthetic DEV fixture data).
// Uses the real LivingGuideGuestShell via /__simple-fixture?evidence=back-gallery.
// Output: reports/back-circle/gallery.html (self-contained, base64 screenshots).
import {chromium} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const dir='reports/back-circle';
await mkdir(dir,{recursive:true});
const base='http://127.0.0.1:80/__simple-fixture';
const designs=[
 {key:'bordo',q:'palette=bordo'},
 {key:'modra',q:'palette=modra'},
 {key:'custom',q:'palette=custom&color=%232E8B6A'},
 {key:'trend',q:'palette=trend'},
];
const ann=[{id:'ann-syn-1',tenantId:'fixture-drobez',titleSl:'SINTETIČNO: Zapora lokalne ceste',bodySl:'Sintetično obvestilo za dokazno galerijo. Cesta proti vasi je zaprta med 9. in 12. uro.',imageUrl:null,validFrom:'2020-01-01T00:00:00.000Z',validTo:null,createdAt:'2020-01-01T00:00:00.000Z'}];
const browser=await chromium.launch({executablePath:execFileSync('which',['chromium'],{encoding:'utf8'}).trim(),headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const shots=[];
const measure=page=>page.evaluate(()=>{
 const vis=el=>{const r=el.getBoundingClientRect();const cs=getComputedStyle(el);return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none'&&r.bottom>0&&r.top<innerHeight;};
 const backs=[...document.querySelectorAll('.lg-back-circle')].filter(vis).map(el=>{const r=el.getBoundingClientRect();const cs=getComputedStyle(el);const svg=el.querySelector('svg');return {testId:el.dataset.testid,x:r.x,y:r.y,w:r.width,h:r.height,radius:cs.borderRadius,border:`${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`,padding:cs.padding,background:cs.backgroundColor,backgroundImage:cs.backgroundImage,inset:cs.boxShadow,arrowColor:cs.color,arrowFill:svg?getComputedStyle(svg).fill:null,arrowSize:svg?`${svg.getBoundingClientRect().width}x${svg.getBoundingClientRect().height}`:null};});
 const refEl=[...document.querySelectorAll('.lgs-flag,.lgs-home-language')].find(vis);
 const ref=refEl?(()=>{const cs=getComputedStyle(refEl);const r=refEl.getBoundingClientRect();return {w:r.width,h:r.height,border:`${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`,padding:cs.padding};})():null;
 const oldStyle=[...document.querySelectorAll('use[href="#lg-i-bk"],.lgs-detail-back,.lg2-detail-back')].filter(vis).length;
 return {backs,ref,oldStyle};
});
try{
 for(const d of designs){
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.route('**/api/guest/*/announcements',r=>r.fulfill({json:{announcements:ann}}));
  const go=async(path,extra='')=>{await page.goto(`${base}${path}?tenant=drobez&${d.q}&lang=sl&evidence=back-gallery${extra}`);await page.evaluate(()=>document.fonts.ready);};
  const snap=async(view,note='')=>{await page.waitForTimeout(1600);const m=await measure(page);const file=`${dir}/${d.key}-${view}.png`;await page.screenshot({path:file});shots.push({design:d.key,view,file,note,...m});console.log(d.key,view,'backs',m.backs.length,m.backs[0]?.w,m.backs[0]?.background,'old',m.oldStyle);};
  const home=async(extra='')=>{await go('/home',extra);await page.locator('[data-testid="screen-simple-home"],[data-testid="screen-home"]').first().waitFor();await page.waitForTimeout(1200);};
  const tap=async(cat)=>{await page.evaluate(p=>{history.pushState(null,'',p+location.search);dispatchEvent(new PopStateEvent('popstate'));},`/__simple-fixture/c/${cat}`);await page.locator('.lg2-route-layer.on').waitFor({timeout:8000}).catch(()=>{});await page.waitForTimeout(600);};
  const row=async(text)=>{await page.locator('.lg2-route-layer').getByText(text,{exact:true}).last().click();};
  await home();await tap('c-explore-sights');await snap('category-list');
  await row('Znamenitosti');await snap('entry');
  await home();await tap('c-offer-prices');await page.waitForTimeout(900);await row('Ponudba s cenami');await snap('offer');
  await home();await tap('c-explore-program');await snap('program-list');
  await page.locator('[data-testid^="program-day-"]:has(.lgp-dot)').first().click();await page.waitForTimeout(400);await page.locator('[data-testid^="program-card-"]').first().click();await snap('program-detail');
  await home();
  const annBtn=d.key==='trend'?page.getByTestId('button-home-announcements'):page.getByTestId('tile-notices');
  if(await annBtn.count()){await annBtn.click();await page.getByTestId('announcements-layer').waitFor();await snap('announcement-list','SINTETIČNO obvestilo (API prestrežen v Playwright)');
   await page.getByTestId('card-announcement-ann-syn-1').click();await page.getByTestId('announcement-detail').waitFor();await snap('announcement-detail','SINTETIČNO');}
  else shots.push({design:d.key,view:'announcement',missing:true});
  await home();await page.getByTestId(d.key==='trend'?'nav-messages':'tile-messages').click();await snap('messages');
  if(d.key!=='trend'){await home();await page.getByTestId('tile-about').click();await snap('about');}
  await go('/home','&skin=day');await page.waitForTimeout(800);
  if(d.key==='trend'){await page.locator('.lg2-weather, [data-testid*="weather"]').first().scrollIntoViewIfNeeded().catch(()=>{});await snap('weather','Trend: vreme je kartica na domači strani (ni ločenega pogleda/nazaj)');}
  else{await page.getByTestId('tile-weather').click();await snap('weather','sintetično vreme (devWeather)');}
  await page.close();
 }
 await writeFile(`${dir}/measurements.json`,JSON.stringify(shots.map(({file,...s})=>({file,...s})),null,2));
 const rows=[];
 for(const s of shots){
  if(s.missing){rows.push(`<figure><figcaption><b>${s.design} · ${s.view}</b><br>MANJKA</figcaption></figure>`);continue;}
  const b64=(await readFile(s.file)).toString('base64');
  const b=s.backs[0];
  rows.push(`<figure><img src="data:image/png;base64,${b64}" width="390" height="844" alt="${s.design} ${s.view}"><figcaption><b>${s.design} · ${s.view}</b>${s.note?` <i>${s.note}</i>`:''}<br>vidnih kontrol nazaj: <b>${s.backs.length}</b> · stari slog: ${s.oldStyle}${b?`<br>${b.testId} @ ${b.x},${b.y} · ${b.w}×${b.h} · r ${b.radius}<br>rob ${b.border} · razmik ${b.padding}<br>polnilo ${b.background} · vstavek ${b.inset}<br>puščica ${b.arrowColor} fill ${b.arrowFill} ${b.arrowSize}`:''}${s.ref?`<br>ref zastavica: ${s.ref.w}×${s.ref.h} · ${s.ref.border} · ${s.ref.padding}`:''}</figcaption></figure>`);
 }
 const html=`<!doctype html><meta charset="utf-8"><title>Enoten krog Nazaj — galerija dokazov</title><style>body{font:13px/1.4 system-ui,sans-serif;background:#efe9e1;color:#2a2230;margin:24px}h1{font-size:22px}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(400px,1fr));gap:20px}figure{margin:0;background:#faf6f0;border:1px solid #d8cfc3;border-radius:12px;padding:8px}img{display:block;width:100%;height:auto;border-radius:6px}figcaption{margin-top:6px;font-family:ui-monospace,monospace;font-size:11px}</style><h1>Enoten krog Nazaj — Enostaven (bordo/modra/custom #2E8B6A) in Trend</h1><p>SINTETIČNI DEV podatki (/__simple-fixture?evidence=back-gallery), resnične komponente LivingGuideGuestShell, 390×844. Ustvarjeno ${new Date().toISOString()}.</p><div class="g">${rows.join('')}</div>`;
 await writeFile(`${dir}/gallery.html`,html);
 console.log('views',shots.length,'gallery',`${dir}/gallery.html`);
}finally{await browser.close();}
