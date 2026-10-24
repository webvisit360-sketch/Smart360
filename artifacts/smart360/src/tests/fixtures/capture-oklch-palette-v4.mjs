// Evidence (v4 B ZIVO+): real SimpleDesignFixture at 390x844 beside the B crop of the READ-ONLY sheet
// attached_assets/barvna-izpeljava_2_1792841788636.html for all 8 picks (+ bordo/modra pass-through cards),
// exact token equality, rendered gradient/page probes, AA table, preset + template hashes.
// Run from artifacts/smart360 with dev app on :80:  node --import tsx/esm src/tests/fixtures/capture-oklch-palette-v4.mjs
import {chromium} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {BORDO,MODRA,contrastRatio,deriveSimplePaletteV4} from '../../pages/living-guide/simple/simple-palette.ts';
const out='reports/oklch-palette/v4';await mkdir(out,{recursive:true});
const SHEET='../../attached_assets/barvna-izpeljava_2_1792841788636.html',PAL='src/pages/living-guide/simple/simple-palette.ts';
const sheet=await readFile(SHEET,'utf8');const sha=(b)=>createHash('sha256').update(b).digest('hex');
const K=['tile1','tile15','tile2','bg','bg2','glow','stroke','txt','tint'];
const text=sheet.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
const cards=[...text.matchAll(/B · ŽIVO\+ .{0,90}?(tile1 (#\w{6}) tile15 #\w+ tile2 #\w+ bg #\w+ bg2 #\w+ glow #\w+ stroke #\w+ txt #\w+ tint #\w+)/g)].map(m=>({base:m[2],want:Object.fromEntries(m[1].match(/\w+ #\w+/g).map(x=>x.split(' ')))}));
if(cards.length!==10)throw new Error('cards '+cards.length);
// Presets: source block + serialized hashes now vs git HEAD.
const src=await readFile(PAL,'utf8');const head=execFileSync('git',['show','HEAD:artifacts/smart360/'+PAL],{encoding:'utf8',cwd:'../..'});
const block=(s,n)=>s.match(new RegExp(`export const ${n}: SimplePaletteTokens = \\{[\\s\\S]*?\\n\\};`))[0];
const presets=[['BORDO',BORDO],['MODRA',MODRA]].map(([n,o])=>({name:n,src:sha(block(src,n)),srcHead:sha(block(head,n)),ser:sha(JSON.stringify(o))}));
const tpl=execFileSync('bash',['-c','cd ../.. && for f in attached_assets/enostavna-*.html attached_assets/barvna-izpeljava_*.html; do [ -f "$f" ] && sha256sum "$f"; done; git status --porcelain -- attached_assets | wc -l'],{encoding:'utf8'});
const browser=await chromium.launch({executablePath:execFileSync('which',['chromium'],{encoding:'utf8'}).trim(),headless:true,args:['--no-sandbox']});
const sp=await browser.newPage({viewport:{width:1460,height:900}});await sp.setContent(sheet);
const open=async(pal,color)=>{const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.goto(`http://127.0.0.1:80/__simple-fixture/home?tenant=drobez&palette=${pal}${color?`&color=${encodeURIComponent(color)}`:''}&lang=sl`);
 await page.getByTestId('screen-simple-home').waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(300);return page;};
const probe=()=>{const g=(s)=>{const e=document.querySelector(s);return e?getComputedStyle(e):null};const root=document.querySelector('[style*="--s-bg"]');const rs=getComputedStyle(root);
 const v={};for(const k of ['bg','bg2','glow','tile1','tile15','tile2','stroke','txt','tint','ink','grad','page'])v[k]=rs.getPropertyValue('--s-'+k).trim();
 const t=g('.lgs-tile');return{vars:v,skin:document.querySelector('.lgs-home')?.getAttribute('data-weather-skin')||null,tileBg:t?.backgroundImage,tileShadow:t?.boxShadow,openShadow:g('.lgs-open')?.boxShadow??null,homeBg:g('.lgs-home')?.backgroundImage,rootBg:g('.lgs-root')?.backgroundImage,iconFill:g('.lgs-tile svg:not(.ln)')?.fill};};
const pres=[];for(const p of ['bordo','modra']){const page=await open(p);await page.screenshot({path:`${out}/preset-${p}-app.png`});const pr=await page.evaluate(probe);pres.push({p,pr,img:(await readFile(`${out}/preset-${p}-app.png`)).toString('base64')});await page.close();}
const res=[];
for(const c of cards){const n=c.base.slice(1);
 const cell=sp.locator('.cell',{has:sp.locator('.nm',{hasText:'B · '})}).filter({hasText:`glow`}).filter({has:sp.locator(`.toks span:has-text("${c.base}")`)}).first();
 await cell.screenshot({path:`${out}/${n}-sheetB.png`});
 const d=deriveSimplePaletteV4(c.base),p=d.tokens;const preset=c.base==='#B23476'||c.base==='#344FB2';
 let pr=null;if(!preset){const page=await open('custom',c.base);await page.screenshot({path:`${out}/${n}-app.png`});pr=await page.evaluate(probe);await page.close();}
 const aa={'stroke/tile15':contrastRatio(p.stroke,p.tile15),'stroke/tile2':contrastRatio(p.stroke,p.tile2),'stroke/tile1':contrastRatio(p.stroke,p.tile1),'stroke/glow':contrastRatio(p.stroke,p.glow),
  'txt/bg':contrastRatio(p.txt,p.bg),'tint/bg':contrastRatio(p.tint,p.bg),'txt/bg2':contrastRatio(p.txt,p.bg2),'tint/bg2':contrastRatio(p.tint,p.bg2)};
 const aaOk=Object.entries(aa).every(([k,v])=>v>=(/tile1$|glow/.test(k)?3:4.5));
 const tokEq=K.every(k=>c.want[k]===p[k]);const rendEq=pr?K.every(k=>pr.vars[k].toUpperCase()===p[k]):null;
 res.push({base:c.base,preset,tokEq,rendEq,mismatch:K.filter(k=>c.want[k]!==p[k]),tileInk:d.tileInk,outsideInk:d.outsideInk,aa:Object.fromEntries(Object.entries(aa).map(([k,v])=>[k,+v.toFixed(2)])),aaOk,probe:pr,
  img:{sheet:(await readFile(`${out}/${n}-sheetB.png`)).toString('base64'),app:pr?(await readFile(`${out}/${n}-app.png`)).toString('base64'):null}});}
await browser.close();
const summary={sheet:SHEET,sheetSha256:sha(sheet),tokenEq:`${res.filter(r=>r.tokEq).length}/${res.length}`,picksTokenEq:`${res.filter(r=>!r.preset&&r.tokEq).length}/8`,renderedEq:`${res.filter(r=>r.rendEq).length}/8`,aa:`${res.filter(r=>r.aaOk).length}/${res.length}`,
 minText:Math.min(...res.flatMap(r=>Object.entries(r.aa).filter(([k])=>!/tile1$|glow/.test(k)).map(([,v])=>v))),minIconGlow:Math.min(...res.flatMap(r=>[r.aa['stroke/tile1'],r.aa['stroke/glow']])),
 presets,presetRender:pres.map(({p,pr})=>({p,grad:pr.vars.grad,page:pr.vars.page,glow:pr.vars.glow,ink:pr.vars.ink,iconFill:pr.iconFill,tileBg:pr.tileBg,tileShadow:pr.tileShadow})),templates:tpl.trim(),
 inferred:['gamut test: gamma-encoded channel in [-0.0005,1.0005] (sheet says only "gamut mapping"; strict v3 test = 5/10 cards)','ink L walk accumulates floats (l+=step); v3 exact steps give #FF7A00 pale #FFFFFF txt/tint 4.51:1 vs sheet dark ink'],
 discrepancies:['sheet prose: dark outside ink -> page flat; pseudocode is contrast-driven. All 4 dark-ink B cards flat; off-sheet #FFFFFF/#FFFF00 keep AA-safe depth (pseudocode followed)']};
await writeFile(`${out}/v4-tokens.json`,JSON.stringify({summary,samples:res.map(({img,...r})=>r)},null,1));
const ok=(v)=>v?'<b style="color:#1d6b3a">PASS</b>':'<b style="color:#a8231c">FAIL</b>';const sw=(c)=>`<span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${c};border:1px solid #0003;vertical-align:-2px"></span> ${c}`;
await writeFile(`${out}/comparison-v4.html`,`<!doctype html><meta charset="utf-8"><title>Smart360 v4 B ZIVO+ evidence</title><style>body{font:13px ui-monospace,Menlo,monospace;background:#EEF0F3;color:#22262c;margin:24px}h1,h2{font-family:sans-serif}.r{display:flex;gap:18px;align-items:flex-start;background:#F8F9FB;border-radius:10px;padding:14px;margin:14px 0}img{border-radius:8px;display:block}table{border-collapse:collapse;background:#fff}td,th{padding:2px 8px;border-bottom:1px solid #e4e7ec;text-align:right}td:first-child{text-align:left}</style>
<h1>Barvna izpeljava v4 B ŽIVO+ — sheet B crop vs real app (390x844)</h1>
<p>Sheet sha256 ${summary.sheetSha256}. Token equality ${summary.tokenEq} (picks ${summary.picksTokenEq}); rendered CSS vars ${summary.renderedEq}; AA ${summary.aa}; min text ${summary.minText.toFixed(2)}, min icon/glow ${summary.minIconGlow.toFixed(2)}.</p>
<h2>Inferred (not specified by sheet)</h2><ul>${summary.inferred.map(x=>`<li>${x}</li>`).join('')}</ul><h2>Sheet discrepancy</h2><ul>${summary.discrepancies.map(x=>`<li>${x}</li>`).join('')}</ul>
<h2>AA table (text ≥4.5, icon/glow ≥3)</h2><table><tr><th>base</th>${Object.keys(res[0].aa).map(k=>`<th>${k}</th>`).join('')}<th>ink tile/out</th><th></th></tr>${res.map(r=>`<tr><td>${r.base}${r.preset?' (preset card)':''}</td>${Object.values(r.aa).map(v=>`<td>${v.toFixed(2)}</td>`).join('')}<td>${r.tileInk}/${r.outsideInk}</td><td>${ok(r.aaOk)}</td></tr>`).join('')}</table>
<h2>Presets (unchanged; derivation not applied)</h2><table><tr><th>preset</th><th>src sha now</th><th>src sha HEAD</th><th>serialized sha</th></tr>${presets.map(p=>`<tr><td>${p.name}</td><td>${p.src}</td><td>${p.srcHead} ${ok(p.src===p.srcHead)}</td><td>${p.ser}</td></tr>`).join('')}</table>
<pre>${JSON.stringify(summary.presetRender,null,1)}</pre><div class="r">${pres.map(x=>`<div><img width="300" src="data:image/png;base64,${x.img}">${x.p}</div>`).join('')}</div>
<h2>Templates</h2><pre>${summary.templates}</pre><h2>Samples</h2>
${res.map(r=>`<div class="r"><div><img src="data:image/png;base64,${r.img.sheet}">sheet B</div>${r.img.app?`<div><img width="300" src="data:image/png;base64,${r.img.app}">app 390x844</div>`:''}<div><b>${r.base}</b> tokens ${ok(r.tokEq)} ${r.rendEq===null?'(preset pass-through card: presets stay hand-tuned)':'rendered '+ok(r.rendEq)}<br>${K.map(k=>`${k} ${sw(deriveSimplePaletteV4(r.base).tokens[k])}`).join('<br>')}${r.probe?`<br>tile: ${r.probe.tileBg}<br>shadow: ${r.probe.tileShadow}<br>home: ${r.probe.homeBg} skin=${r.probe.skin}`:''}</div></div>`).join('')}`);
console.log(JSON.stringify({...summary,templates:undefined},null,1));console.log(res.map(r=>`${r.base} tok=${r.tokEq} rend=${r.rendEq} aa=${r.aaOk} ${r.mismatch.join(',')}`).join('\n'));console.log(summary.templates);
