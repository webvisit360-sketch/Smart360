// Builds reports/oklch-palette/master-correction/index.html (self-contained, base64 images).
import {readFile,writeFile,readdir} from 'node:fs/promises';
const dir='reports/oklch-palette/master-correction';
const B=JSON.parse(await readFile(`${dir}/before/raw.json`,'utf8')),A=JSON.parse(await readFile(`${dir}/after/raw.json`,'utf8'));
const hashes=await readFile(`${dir}/hashes.txt`,'utf8').catch(()=>'');
const ROWS=[['border','Obroba (snapped)',2.3],['insetGap','Notranja reža (inset)',1],['radius','Radij',19],['icon','Ikona',58],['padT','Padding zgoraj',10],['padX','Padding levo/desno',5],['padB','Padding spodaj',6],['colGap','Razmik stolpcev',30],['rowGap','Razmik vrstic',19],['gridMarginL','Rob mreže',26],['secMarginT','Naslov sekcije zgoraj',20],['tileW','Širina ploščice',94.667],['tileH','Višina ploščice',null]];
const f=(v)=>typeof v==='number'?(+v.toFixed(3)).toString():String(v);
let html=`<!doctype html><meta charset="utf-8"><title>Enostaven — popravek po masterju</title><style>body{font:14px/1.45 system-ui;margin:24px;background:#F4F6F2;color:#121A14}table{border-collapse:collapse;margin:12px 0}td,th{border:1px solid #ccd;padding:4px 8px;text-align:right}th{background:#e8ebe6}td:first-child{text-align:left}.ok{color:#157347;font-weight:700}.imgs{display:flex;gap:16px;flex-wrap:wrap}.imgs figure{margin:0}img{width:390px;border:1px solid #ccd}code{font-size:12px}</style>
<h1>Enostaven — anatomija po masterju, skalirana na širino telefona</h1>
<p>Master = 396px telefon (READ ONLY). Cilj = master px × (širina aplikacije / 396). Edino novo odstopanje: odstranjena ZUNANJA senca; inset ostane. Odobreni prejšnji popravki: kvadratne ploščice, prilagodljivo črnilo v3, 44px krogi.</p><pre>${hashes}</pre>`;
for(const k of ['drobez','melipu']){
  const t=A.template[k],a=A.app[k],b=B.app[k],s=a.phoneW/t.phoneW;
  html+=`<h2>${k} · bordo · 390×844 (faktor ${s.toFixed(5)})</h2><table><tr><th>Mera</th><th>Master izmerjeno @${t.phoneW}px</th><th>Skaliran cilj @${a.phoneW}px</th><th>Aplikacija PREJ</th><th>Aplikacija POTEM</th><th>Δ potem−cilj</th></tr>`;
  for(const [key,label,spec] of ROWS){const tgt=key==='tileH'?a.tileW:(key==='border'?t.border*s:(spec==null?t[key]*s:(key==='tileW'?(a.phoneW-2*26*s-2*30*s)/3:spec*s)));
    const d=typeof a[key]==='number'?a[key]-tgt:NaN;const okb=key==='border'?a[key]===t.border:Math.abs(d)<0.05;
    html+=`<tr><td>${label}${spec?` (${spec}px)`:''}</td><td>${f(t[key])}</td><td>${f(tgt)}</td><td>${f(b[key])}</td><td>${f(a[key])}</td><td class="${okb?'ok':''}">${isNaN(d)?'':f(d)}${okb?' ✓':''}</td></tr>`;}
  html+=`<tr><td>box-shadow ploščice</td><td><code>${t.boxShadow}</code></td><td><code>samo inset</code></td><td><code>${b.boxShadow}</code></td><td><code>${a.boxShadow}</code></td><td></td></tr>
  <tr><td>box-shadow Odpri vodnik</td><td><code>${t.openShadow}</code></td><td><code>samo inset</code></td><td><code>${b.landingOpenShadow}</code></td><td><code>${a.landingOpenShadow}</code></td><td></td></tr>
  <tr><td>box-shadow zastava 44px</td><td>—</td><td><code>none</code></td><td><code>${b.landingFlagShadow}</code></td><td><code>${a.landingFlagShadow}</code></td><td></td></tr></table>
  <p>Opomba: master ploščica je ${t.tileH}px visoka (vsebina razširi aspect-ratio); aplikacija ohrani odobreno kvadratno ploščico. Obroba 2.3px se v obeh izriše kot ${t.border}px (zaokroževanje brskalnika).</p><div class="imgs">`;
  for(const [p,n,c] of [['after',`template-${k}-home.png`,'Master (izrisan, 396px)'],['before',`app-${k}-home-390x844.png`,'Aplikacija PREJ'],['after',`app-${k}-home-390x844.png`,'Aplikacija POTEM'],['after',`app-${k}-landing-390x844.png`,'Vstopna POTEM']])
    html+=`<figure><img src="data:image/png;base64,${(await readFile(`${dir}/${p}/${n}`)).toString('base64')}"><figcaption>${c}</figcaption></figure>`;
  html+='</div>';
}
await writeFile(`${dir}/index.html`,html);console.log('ok',(await readdir(dir)));
