// Evidence (v2 sheet): real SimpleDesignFixture (custom palette, 390x844) beside the approved
// sheet card for all 14 samples, token match, deltaE_OK, contrast minima incl. opacity text,
// and a self-contained comparison HTML. Run from artifacts/smart360 with the dev app on :80:
//   node --import tsx/esm src/tests/fixtures/capture-oklch-palette.mjs
import {chromium} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {contrastRatio,deltaEOK,deriveSimplePalette} from '../../pages/living-guide/simple/simple-palette.ts';
const out='reports/oklch-palette';await mkdir(out,{recursive:true});
const SHEET='../../attached_assets/barvna-izpeljava_1792834926623.html';
const sheet=await readFile(SHEET,'utf8');
const bases=['#48A1D4','#4C7060','#407075','#C03028','#E07B20','#93B021','#2E8B57','#1897B0','#2563EB','#7C3AED','#E85BA8','#F6DFCC','#101B2E','#8B8E93'];
const K=['tile1','tile15','tile2','bg','stroke','txt','tint'];
const blend=(fg,bg,a)=>'#'+[1,3,5].map(i=>Math.round(parseInt(fg.slice(i,i+2),16)*a+parseInt(bg.slice(i,i+2),16)*(1-a)).toString(16).padStart(2,'0')).join('').toUpperCase();
const sha=(b)=>createHash('sha256').update(b).digest('hex');
const browser=await chromium.launch({executablePath:execFileSync('which',['chromium'],{encoding:'utf8'}).trim(),headless:true,args:['--no-sandbox']});
const sheetPage=await browser.newPage({viewport:{width:1460,height:900}});
await sheetPage.setContent(sheet);await sheetPage.evaluate(()=>document.fonts.ready);
const res=[];
for(const b of bases){
 const name=b.slice(1);
 const card=sheetPage.locator('.cell',{has:sheetPage.locator(`.swc span:text-is("izbira#${name}"), .swc span:has-text("${b}")`)}).first();
 await card.screenshot({path:`${out}/${name}-sheet.png`});
 const sheetInfo=await card.evaluate(el=>{const o={};el.querySelectorAll('.toks span').forEach(s=>o[s.querySelector('i').textContent]=s.textContent.split(' ').pop());
  o.deltaE=el.querySelector('.de')?.textContent.replace(/[^\d.]/g,'');return o;});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.goto(`http://127.0.0.1:80/__simple-fixture/home?tenant=drobez&palette=custom&color=${encodeURIComponent(b)}&lang=sl`);
 await page.getByTestId('screen-simple-home').waitFor();await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:`${out}/${name}-app.png`});
 const got=await page.evaluate(()=>{const el=document.querySelector('[style*="--s-bg"]');const cs=getComputedStyle(el);const o={};
  for(const k of ['bg','tile1','tile15','tile2','stroke','txt','tint','adr'])o[k]=cs.getPropertyValue('--s-'+k).trim().toUpperCase();
  // every opacity-reduced text node rendered on the page (effective opacity incl. ancestors)
  o.opacityText=[...document.querySelectorAll('body *')].filter(n=>[...n.childNodes].some(c=>c.nodeType===3&&c.textContent.trim())).map(n=>{
   let a=1;for(let p=n;p&&p!==document.documentElement;p=p.parentElement)a*=+getComputedStyle(p).opacity;return{cls:n.className&&String(n.className),opacity:+a.toFixed(3)};}).filter(x=>x.opacity<1&&x.opacity>0);
  return o;});
 const p=deriveSimplePalette(b);
 const ops=[...new Set([0.85,...got.opacityText.map(x=>x.opacity)])];
 const pairs={'stroke/tile1':[p.stroke,p.tile1],'stroke/tile15':[p.stroke,p.tile15],'stroke/tile2':[p.stroke,p.tile2],'txt/bg':[p.txt,p.bg],'tint/bg':[p.tint,p.bg],'adr/bg':[p.adr,p.bg],
  ...Object.fromEntries(ops.map(a=>[`txt@${a}/bg`,[blend(p.txt,p.bg,a),p.bg]]))};
 const contrast=Object.fromEntries(Object.entries(pairs).map(([k,[f,g]])=>[k,+contrastRatio(f,g).toFixed(2)]));
 const sheetPng=await readFile(`${out}/${name}-sheet.png`),appPng=await readFile(`${out}/${name}-app.png`);
 res.push({base:b,match:K.every(k=>sheetInfo[k]===got[k]&&got[k]===p[k]),deltaE:deltaEOK(b,p.tile1).toFixed(3),sheetDeltaE:sheetInfo.deltaE,
  want:sheetInfo,got,contrast,min:Math.min(...Object.values(contrast)),sha256:{sheet:sha(sheetPng),app:sha(appPng)},
  img:{sheet:sheetPng.toString('base64'),app:appPng.toString('base64')}});
 await page.close();
}
await browser.close();
const json=res.map(({img,...r})=>r);
await writeFile(`${out}/tokens.json`,JSON.stringify(json,null,1));
const sw=(c)=>`<span class="c"><i style="background:${c}"></i>${c}</span>`;
const html=`<!doctype html><meta charset="utf-8"><title>OKLCH v2 sheet vs app</title><style>
body{font:13px ui-monospace,Menlo,monospace;background:#EEF0F3;color:#22262c;margin:24px}h1{font:900 20px sans-serif}
.r{display:flex;gap:18px;align-items:flex-start;background:#F8F9FB;border-radius:10px;padding:14px;margin:14px 0}
.r img{display:block;border-radius:8px}.app{width:300px}.c{display:inline-flex;align-items:center;gap:4px;margin:2px 8px 2px 0}
.c i{width:14px;height:14px;border-radius:3px;display:inline-block;border:1px solid #0002}.ok{color:#1d6b3a;font-weight:700}.bad{color:#a8231c;font-weight:700}
table{border-collapse:collapse;margin-top:6px}td{padding:1px 8px 1px 0}</style>
<h1>Barvna izpeljava v2 - sheet card vs real app (390x844)</h1><p>Sheet: ${SHEET} sha256 ${sha(sheet)}. ${json.filter(r=>r.match).length}/${json.length} match all seven tokens.</p>
${res.map(r=>`<div class="r"><div><img src="data:image/png;base64,${r.img.sheet}"><div>sheet</div></div><div><img class="app" src="data:image/png;base64,${r.img.app}"><div>app</div></div>
<div><b>${r.base}</b> <span class="${r.match?'ok':'bad'}">${r.match?'MATCH':'MISMATCH'}</span><br>deltaE_OK ${r.deltaE} (sheet ${r.sheetDeltaE})<br>${K.map(k=>`${k} ${sw(r.got[k])}`).join('<br>')}
<table>${Object.entries(r.contrast).map(([k,v])=>`<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>min ${r.min}</div></div>`).join('')}`;
await writeFile(`${out}/comparison.html`,html);
console.log(json.map(r=>`${r.base} match=${r.match} dE=${r.deltaE}/${r.sheetDeltaE} min=${r.min} op=${r.got.opacityText.map(x=>x.opacity).join(',')} app=${r.sha256.app.slice(0,12)}`).join('\n'));
