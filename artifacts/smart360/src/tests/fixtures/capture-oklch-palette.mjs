// Evidence (v3 sheet): real SimpleDesignFixture (custom palette, 390x844) beside the approved
// sheet card for all 14 samples; exact token + deltaE/ink/AA table comparison against the sheet;
// computed rendered icon/label/border/text colours; preset (bordo/modra) block hashes and their
// unchanged rendered look; self-contained comparison HTML. Run from artifacts/smart360 with the dev app on :80:
//   node --import tsx/esm src/tests/fixtures/capture-oklch-palette.mjs
import {chromium} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {contrastRatio,deriveSimplePaletteV3} from '../../pages/living-guide/simple/simple-palette.ts';
const out='reports/oklch-palette';await mkdir(out,{recursive:true});
const SHEET='../../attached_assets/barvna-izpeljava_1_1792836375569.html';
const PAL='src/pages/living-guide/simple/simple-palette.ts';
const sheet=await readFile(SHEET,'utf8');
const sha=(b)=>createHash('sha256').update(b).digest('hex');
const K=['tile1','tile15','tile2','bg','stroke','txt','tint'];
const hex=(c)=>{const m=c.match(/[\d.]+/g);if(!m)return c;const a=m.length>3?+m[3]:1;return '#'+m.slice(0,3).map(v=>Math.round(+v).toString(16).padStart(2,'0')).join('').toUpperCase()+(a<1?`@${a}`:'');};
// Sheet table rows + token cards, parsed from the sheet itself.
const rows=[...sheet.matchAll(/<tr><td>([^<]*)\((#[0-9A-F]{6})\)<\/td>((?:<td>[^<]*<\/td>)+)<\/tr>/g)].map(m=>({name:m[1].trim(),base:m[2],cells:[...m[3].matchAll(/<td>([^<]*)<\/td>/g)].map(x=>x[1]),
 toks:Object.fromEntries([...sheet.match(new RegExp(`<span><i>tile1</i> ${m[2]}</span>.*?</div>`))[0].matchAll(/<i>(\w+)<\/i> (#\w+)/g)].map(x=>[x[1],x[2]]))}));
if(rows.length!==14)throw new Error('expected 14 sheet rows, got '+rows.length);
const COLS=['deltaE','tileInk','outsideInk','ink/t15','ink/t2','ink/t1','txt/bg','tint/bg'];
// Preset blocks: byte hashes now vs git HEAD.
const src=await readFile(PAL,'utf8');
const block=(s,n)=>s.match(new RegExp(`export const ${n}: SimplePaletteTokens = \\{[\\s\\S]*?\\n\\};`))[0];
let head='';try{head=execFileSync('git',['show','HEAD:artifacts/smart360/'+PAL],{encoding:'utf8',cwd:'../..'});}catch{}
const presets=['BORDO','MODRA'].map(n=>({name:n,sha256:sha(block(src,n)),headSha256:head?sha(block(head,n)):null,identical:head?block(src,n)===block(head,n):null}));
const browser=await chromium.launch({executablePath:execFileSync('which',['chromium'],{encoding:'utf8'}).trim(),headless:true,args:['--no-sandbox']});
const sheetPage=await browser.newPage({viewport:{width:1460,height:900}});
await sheetPage.setContent(sheet);await sheetPage.evaluate(()=>document.fonts.ready);
const probe=()=>{const cs=(s)=>{const e=document.querySelector(s);return e?getComputedStyle(e):null;};
 const root=document.querySelector('[style*="--s-bg"]');const rs=getComputedStyle(root);const v={};
 for(const k of ['bg','tile1','tile15','tile2','stroke','txt','tint','adr','ink','small-opacity'])v[k]=rs.getPropertyValue('--s-'+k).trim().toUpperCase();
 const tile=cs('.lgs-tile'),svg=cs('.lgs-tile svg:not(.ln)'),ln=cs('.lgs-tile svg.ln'),b=cs('.lgs-tile b');
 const detail=document.querySelector('.lgs-tile svg [fill="currentColor"],.lgs-tile svg [stroke="currentColor"]');
 const rc=document.querySelector('.lgs-return360');
 return{vars:v,weatherSkin:document.querySelector('.lgs-home')?.getAttribute('data-weather-skin')||null,
  rendered:{iconFill:svg?.fill,iconColor:svg?.color,lineIconStroke:ln?.stroke,detailCurrentColor:detail?getComputedStyle(detail).color:null,
   label:b?.color,border:tile?.borderTopColor,tt:cs('.lgs-tt')?.color,sec:cs('.lgs-sec')?.color,tn:cs('.lgs-tn')?.color,foot:cs('.lgs-foot')?.color,
   return360:rc?getComputedStyle(rc).color:null,homeBg:cs('.lgs-home')?.backgroundImage+' '+cs('.lgs-home')?.backgroundColor},
  opacityText:[...document.querySelectorAll('body *')].filter(n=>[...n.childNodes].some(c=>c.nodeType===3&&c.textContent.trim())).map(n=>{
   let a=1;for(let p=n;p&&p!==document.documentElement;p=p.parentElement)a*=+getComputedStyle(p).opacity;return{cls:String(n.className||n.tagName),opacity:+a.toFixed(3)};}).filter(x=>x.opacity<1&&x.opacity>0)};};
const open=async(pal,color)=>{const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.goto(`http://127.0.0.1:80/__simple-fixture/home?tenant=drobez&palette=${pal}${color?`&color=${encodeURIComponent(color)}`:''}&lang=sl`);
 await page.getByTestId('screen-simple-home').waitFor();await page.evaluate(()=>document.fonts.ready);return page;};
// Presets: rendered look must keep white icons (no --s-ink).
for(const p of presets){const page=await open(p.name.toLowerCase());await page.screenshot({path:`${out}/preset-${p.name.toLowerCase()}-app.png`});
 p.probe=await page.evaluate(probe);p.whiteIcons=hex(p.probe.rendered.iconFill)==='#FFFFFF'&&p.probe.vars.ink==='';
 p.img=(await readFile(`${out}/preset-${p.name.toLowerCase()}-app.png`)).toString('base64');await page.close();}
const res=[];
for(const r of rows){const b=r.base,name=b.slice(1);
 const card=sheetPage.locator('.cell',{has:sheetPage.locator(`.toks span:has-text("${b}")`)}).first();
 await card.screenshot({path:`${out}/${name}-sheet.png`});
 const page=await open('custom',b);await page.screenshot({path:`${out}/${name}-app.png`});
 const got=await page.evaluate(probe);await page.close();
 const d=deriveSimplePaletteV3(b),p=d.tokens;
 const mine=[d.deltaE.toFixed(3),d.tileInk,d.outsideInk,...[[p.stroke,p.tile15],[p.stroke,p.tile2],[p.stroke,p.tile1],[p.txt,p.bg],[p.tint,p.bg]].map(([f,g])=>contrastRatio(f,g).toFixed(2))];
 const tokMatch=K.every(k=>r.toks[k]===p[k]&&got.vars[k]===p[k]);const tableMatch=mine.join()===r.cells.join();
 const R=got.rendered,ink=p.stroke;
 const asserts={iconFill:hex(R.iconFill)===ink,iconColor:hex(R.iconColor)===ink,detailCurrentColor:!R.detailCurrentColor||hex(R.detailCurrentColor)===ink,
  label:hex(R.label)===ink,border:hex(R.border)===ink,return360:!R.return360||hex(R.return360)===ink,
  tn:hex(R.tn)===p.tint,noOpacityText:got.opacityText.length===0};
 if(!got.weatherSkin){asserts.tt=hex(R.tt)===p.txt;asserts.sec=hex(R.sec)===p.txt;}
 const sheetPng=await readFile(`${out}/${name}-sheet.png`),appPng=await readFile(`${out}/${name}-app.png`);
 res.push({name:r.name,base:b,tokMatch,tableMatch,sheetRow:r.cells,mine,want:r.toks,vars:got.vars,weatherSkin:got.weatherSkin,rendered:Object.fromEntries(Object.entries(R).map(([k,v])=>[k,v&&k!=='homeBg'?hex(v):v])),
  asserts,allAsserts:Object.values(asserts).every(Boolean),opacityText:got.opacityText,sha256:{sheet:sha(sheetPng),app:sha(appPng)},img:{sheet:sheetPng.toString('base64'),app:appPng.toString('base64')}});
}
await browser.close();
const json={sheet:SHEET,sheetSha256:sha(sheet),presets:presets.map(({img,probe,...p})=>({...p,iconFill:hex(probe.rendered.iconFill),label:hex(probe.rendered.label)})),samples:res.map(({img,...r})=>r)};
await writeFile(`${out}/tokens.json`,JSON.stringify(json,null,1));
const sw=(c)=>`<span class="c"><i style="background:${c}"></i>${c}</span>`;const ok=(v)=>`<span class="${v?'ok':'bad'}">${v?'PASS':'FAIL'}</span>`;
const html=`<!doctype html><meta charset="utf-8"><title>OKLCH v3 sheet vs app</title><style>
body{font:13px ui-monospace,Menlo,monospace;background:#EEF0F3;color:#22262c;margin:24px}h1{font:900 20px sans-serif}h2{font:900 15px sans-serif;margin-top:28px}
.r{display:flex;gap:18px;align-items:flex-start;background:#F8F9FB;border-radius:10px;padding:14px;margin:14px 0}
.r img{display:block;border-radius:8px}.app{width:300px}.c{display:inline-flex;align-items:center;gap:4px;margin:2px 8px 2px 0}
.c i{width:14px;height:14px;border-radius:3px;display:inline-block;border:1px solid #0002}.ok{color:#1d6b3a;font-weight:700}.bad{color:#a8231c;font-weight:700}
table{border-collapse:collapse;margin-top:6px;background:#fff}td,th{padding:2px 8px;border-bottom:1px solid #e4e7ec;text-align:right}td:first-child,th:first-child{text-align:left}</style>
<h1>Barvna izpeljava v3 - sheet vs real app (390x844)</h1>
<p>Sheet ${SHEET} sha256 ${json.sheetSha256}.<br>Tokens ${res.filter(r=>r.tokMatch).length}/14, AA table ${res.filter(r=>r.tableMatch).length}/14, rendered colour asserts ${res.filter(r=>r.allAsserts).length}/14.</p>
<h2>Presets (byte-identical, white icons kept)</h2><table><tr><th>preset</th><th>sha256 now</th><th>sha256 HEAD</th><th>identical</th><th>rendered icon fill</th></tr>
${json.presets.map(p=>`<tr><td>${p.name}</td><td>${p.sha256}</td><td>${p.headSha256}</td><td>${ok(p.identical)}</td><td>${p.iconFill} ${ok(p.whiteIcons)}</td></tr>`).join('')}</table>
<div class="r">${presets.map(p=>`<div><img class="app" src="data:image/png;base64,${p.img}"><div>${p.name} (app)</div></div>`).join('')}</div>
<h2>AA table: sheet vs computed</h2><table><tr><th>base</th>${COLS.map(c=>`<th>${c}</th>`).join('')}<th></th></tr>
${res.map(r=>`<tr><td>${r.name} ${r.base}</td>${r.mine.map((v,i)=>`<td class="${v===r.sheetRow[i]?'':'bad'}">${v}${v===r.sheetRow[i]?'':' / '+r.sheetRow[i]}</td>`).join('')}<td>${ok(r.tableMatch)}</td></tr>`).join('')}</table>
<h2>Samples</h2>
${res.map(r=>`<div class="r"><div><img src="data:image/png;base64,${r.img.sheet}"><div>sheet</div></div><div><img class="app" src="data:image/png;base64,${r.img.app}"><div>app</div></div>
<div><b>${r.name} ${r.base}</b><br>tokens ${ok(r.tokMatch)} table ${ok(r.tableMatch)} rendered ${ok(r.allAsserts)}<br>${K.map(k=>`${k} ${sw(r.vars[k])}`).join('<br>')}
<table>${Object.entries(r.rendered).filter(([k])=>k!=='homeBg').map(([k,v])=>`<tr><td>${k}</td><td>${v??'-'}</td><td>${k in r.asserts?ok(r.asserts[k]):''}</td></tr>`).join('')}</table>
weather skin: ${r.weatherSkin??'none'}; opacity text: ${r.opacityText.length}</div></div>`).join('')}`;
await writeFile(`${out}/comparison.html`,html);
console.log(json.presets.map(p=>`${p.name} sha=${p.sha256.slice(0,16)} identical=${p.identical} white=${p.whiteIcons}`).join('\n'));
console.log(json.samples.map(r=>`${r.base} tok=${r.tokMatch} table=${r.tableMatch} rendered=${r.allAsserts} ${Object.entries(r.asserts).filter(([,v])=>!v).map(([k])=>k).join(',')} skin=${r.weatherSkin} app=${r.sha256.app.slice(0,12)}`).join('\n'));
