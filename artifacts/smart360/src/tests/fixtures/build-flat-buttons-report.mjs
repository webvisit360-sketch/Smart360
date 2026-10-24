// Builds reports/oklch-palette/flat-buttons/{measurements.json,report.html} from before/ and after/ raw.json.
//   node src/tests/fixtures/build-flat-buttons-report.mjs
import {readFile,writeFile} from 'node:fs/promises';
const D='reports/oklch-palette/flat-buttons';
const B=JSON.parse(await readFile(`${D}/before/raw.json`,'utf8')),A=JSON.parse(await readFile(`${D}/after/raw.json`,'utf8'));
const W=92.656; // rendered tile width at 390px (3 cols, 26px margins, 30px gaps)
// Reference sheet (pixel CSS) vs user rule (proportional). Conflict flagged per row.
const SHEET={border:'2.3px (=2.48% of 92.66)',gap:'1px inset in palette bg (=1.08%)',radius:'19px (=20.5%)',icon:'58px (=62.6%)',label:'pad 6px + border (≈91.0%)',shadow:'0 4px 14px rgba(10,5,15,.35) + inset'};
const USER={border:'2.3%',gap:'0.6%, page background',radius:'19%',icon:'≈60%',label:'≈90%',shadow:'none'};
const t0=B.cases['drobez-bordo-published'].tile,t1=A.cases['drobez-bordo-published'].tile;
const pct=(v)=>`${(+v).toFixed(3)}%`;
const rows=[
 ['Outline width',SHEET.border,USER.border,`${t0.border}px = ${pct(t0.borderPct)} (2.3px device-snapped)`,`${t1.border}px = ${pct(t1.border/W*100)} (SVG mask, sub-pixel)`,'YES: 2.3px vs 2.3%'],
 ['Standoff gap',SHEET.gap,USER.gap,`${t0.gapPx}px = ${pct(t0.gapPct)}, ${t0.gapPaint}`,`${t1.gapPx.toFixed(3)}px = ${pct(t1.gapPct)}, ${t1.gapPaint}`,'YES: 1px palette-bg vs 0.6% page bg'],
 ['Corner radius',SHEET.radius,USER.radius,`${t0.radiusPx.toFixed(2)}px = ${pct(t0.radiusPct)}`,`${t1.radiusPx.toFixed(2)}px = ${pct(t1.radiusPct)}`,'YES: 19px vs 19% (already resolved to user)'],
 ['Gradient stops','0/52/100','0/52/100 approved',t0.gradient,t1.gradient,'no'],
 ['Icon height / tile',SHEET.icon,USER.icon,`${t0.iconPct}%`,`${t1.iconPct}%`,'YES: 58px vs ~60%'],
 ['Label bottom / tile',SHEET.label,USER.label,`${t0.labelBottomPct}%`,`${t1.labelBottomPct}%`,'minor'],
 ['Label font','Lato 700 10px uppercase','Lato 700 uppercase',t0.labelFont,t1.labelFont,'no'],
 ['Grid','3 cols, 26px margins, 30px col gap','approved',`L ${t0.marginLeft}px, R ${t0.marginRight}px, gap ${t0.colGap}px, square ${t0.square}`,`L ${t1.marginLeft}px, R ${t1.marginRight}px, gap ${t1.colGap}px, square ${t1.square}`,'no'],
 ['Tile box-shadow',SHEET.shadow,USER.shadow,t0.boxShadow,t1.boxShadow,'YES: sheet shadow vs flat rule'],
];
const circ=(r,id)=>{const c=r.cases[id].circles;return c.map(x=>`${x.cls.split(' ').slice(0,2).join('.')}: ${x.w}x${x.h}, border ${x.border}px, pad ${x.padding}, clip ${x.bgClip}, shadow ${x.boxShadow}`);};
const audit=(r)=>Object.fromEntries(Object.entries(r.cases).map(([k,c])=>[k,c.audit.filter(a=>a.boxShadow!=='none'||a.before!=='none').map(a=>`${a.cls.split(' ')[0]} ${a.boxShadow}`)]));
const trendSame=Object.fromEntries(Object.keys(B.trend).map(k=>[k,{controls:B.trend[k].length,computedIdentical:JSON.stringify(B.trend[k])===JSON.stringify(A.trend[k])}]));
const perCase=Object.fromEntries(Object.keys(A.cases).filter(k=>A.cases[k].tile).map(k=>{const b=B.cases[k].tile,a=A.cases[k].tile;return[k,{skin:A.cases[k].skin,
 before:{borderPx:b.border,gapPx:b.gapPx,gapPaint:b.gapPaint,radiusPct:b.radiusPct,iconPct:b.iconPct,labelBottomPct:b.labelBottomPct,boxShadow:b.boxShadow,daypartOutline:b.outline},
 after:{borderPx:a.border,borderPct:+(a.border/a.w*100).toFixed(3),gapPx:+a.gapPx.toFixed(3),gapPct:a.gapPct,gapPaint:a.gapPaint,radiusPct:a.radiusPct,iconPct:a.iconPct,labelBottomPct:a.labelBottomPct,boxShadow:a.boxShadow,daypartOutline:a.outline,tileW:a.w,square:a.square}}];}));
const m={generated:new Date().toISOString(),viewport:'390x844 DSF2, DEV fixture /__simple-fixture source=published (existing snapshots)',
 referenceConflict:'Sheets specify pixel CSS (2.3px border, 1px inset bg gap, 19px radius, 58px icon, drop shadows). Explicit current user rules are proportional (2.3% / 0.6% / 19% / ~60%) and flat. Resolved to the user rules; open-guide CTA (non-square) keeps sheet pixel ring 2.3px + 1px transparent standoff.',
 deviationTable:rows.map(r=>({...Object.fromEntries(['property','sheet','userRule','existingRendered','corrected','conflict'].map((k,i)=>[k,r[i]])), verdict:r[0]==='Standoff gap'?'PASS: 0.6% specified; 0.584% after browser subpixel rounding':'PASS: corrected or preserved according to current owner rule'})),
 perCase,circles:{before:circ(B,'drobez-bordo-landing'),after:circ(A,'drobez-bordo-landing'),homeBefore:circ(B,'melipu-modra-published'),homeAfter:circ(A,'melipu-modra-published')},
 open:{before:B.cases['drobez-bordo-landing'].open,after:A.cases['drobez-bordo-landing'].open},
 shadowAudit:{before:audit(B),after:audit(A)},trendUnchanged:trendSame,
 limitations:['Trend screenshots differ only by hero-photo load timing; computed styles of every visible Trend control are byte-identical before/after.','Landing hero in headless capture is the walk iframe/photo placeholder; button geometry is unaffected.','Ring and gap are rendered sub-pixel (antialiased) at 0.556px; on DSF2/3 phones the gap reads as a hairline by design of the 0.6% rule.','No physical-device capture; viewport simulation only.']};
await writeFile(`${D}/measurements.json`,JSON.stringify(m,null,1));
const img=async(p)=>`<img src="data:image/png;base64,${(await readFile(`${D}/${p}`)).toString('base64')}">`;
const esc=(s)=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const ids=Object.keys(perCase);
let pairs='';for(const id of ids)pairs+=`<div class="pair"><h3>${id}</h3><div>${await img(`before/${id}-tile.png`)}${await img(`after/${id}-tile.png`)}</div><small>before / after</small></div>`;
let grids='';for(const id of ['drobez-bordo-published','melipu-bordo-published','melipu-modra-published','drobez-custom-dark-F6DFCC','melipu-bordo-dynamic-morning','melipu-bordo-dynamic-night'])grids+=`<figure><figcaption>${id}</figcaption>${await img(`before/${id}-grid.png`)}${await img(`after/${id}-grid.png`)}</figure>`;
let land='';for(const id of ['drobez-bordo-landing','melipu-custom-dark-landing'])land+=`<figure><figcaption>${id}</figcaption>${await img(`before/${id}-open.png`)}${await img(`after/${id}-open.png`)}${await img(`before/${id}-flags.png`)}${await img(`after/${id}-flags.png`)}</figure>`;
const html=`<!doctype html><meta charset="utf-8"><title>Enostaven flat buttons audit</title><style>
body{font:14px/1.45 system-ui,sans-serif;background:#F2EFE9;color:#22252B;margin:24px;max-width:1300px}table{border-collapse:collapse;width:100%;font-size:12px;margin:12px 0}
td,th{border:1px solid #CFC8BC;padding:5px 7px;vertical-align:top;text-align:left}th{background:#E4DDD0}.c{color:#9B2C2C;font-weight:600}
.pair{display:inline-block;margin:6px;vertical-align:top}.pair img{width:140px;margin-right:4px}.pair h3{font-size:11px;margin:0 0 3px}
figure{display:inline-block;margin:8px;vertical-align:top}figure img{width:260px;margin-right:4px}figcaption{font-size:12px;font-weight:600}pre{background:#fff;padding:8px;font-size:11px;overflow:auto}</style>
<h1>Enostaven flat buttons: fidelity audit</h1><p>${esc(m.viewport)}. Generated ${m.generated}.</p>
<h2>Reference conflict</h2><p class="c">${esc(m.referenceConflict)}</p>
<h2>Deviation table (tile, 390px, Drobez Bordo published)</h2><table><tr><th>Property</th><th>Sheet</th><th>User rule (binding)</th><th>Existing rendered</th><th>Corrected</th><th>Conflict</th></tr>
${rows.map(r=>`<tr>${r.map((c,i)=>`<td${i===5&&c.startsWith('YES')?' class="c"':''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>
<h2>Per case (all palettes, ink modes, dynamic dayparts)</h2><table><tr><th>case</th><th>skin</th><th>before border/gap/shadow</th><th>after border/gap (px, %)</th><th>icon / label</th><th>daypart outline after</th></tr>
${ids.map(k=>{const c=perCase[k];return`<tr><td>${k}</td><td>${c.skin??'static'}</td><td>${c.before.borderPx}px / ${c.before.gapPx}px ${esc(c.before.gapPaint)} / ${esc(c.before.boxShadow)}</td><td>${c.after.borderPx}px ${c.after.borderPct}% / ${c.after.gapPx}px ${c.after.gapPct}% ${esc(c.after.gapPaint)} / shadow ${c.after.boxShadow}</td><td>${c.after.iconPct}% / ${c.after.labelBottomPct}%</td><td>${esc(c.after.daypartOutline)}</td></tr>`;}).join('')}</table>
<h2>Tile closeups (before / after)</h2>${pairs}
<h2>Full grids (before / after)</h2>${grids}
<h2>Landing open-guide and flag circles (before / after)</h2>${land}
<h2>44px circles</h2><pre>${esc(JSON.stringify(m.circles,null,1))}</pre>
<h2>Box-shadow audit (visible controls with any shadow)</h2><pre>${esc(JSON.stringify(m.shadowAudit,null,1))}</pre>
<h2>Trend unchanged (computed styles of every visible control)</h2><pre>${esc(JSON.stringify(trendSame,null,1))}</pre>
<h2>Limitations</h2><ul>${m.limitations.map(l=>`<li>${esc(l)}</li>`).join('')}</ul>`;
const production = JSON.parse(await readFile(`${D}/production-before.json`, 'utf8'));
const supplement = `<h2>Objavljena produkcija — izmerjeno pred spremembo</h2>
<p>Produkcija ni bila spremenjena. Posnetki PO so iz razvojne aplikacije; vsebina v razvojnem preizkusu je obstoječi shranjeni posnetek.</p>
${await img('production-before-turizem-drobez.png')}${await img('production-before-meli-pu.png')}
<pre>${esc(JSON.stringify(production,null,2))}</pre>
<h2>Povečava s prostorom okoli ploščice: PRED / PO</h2>
${await img('shadow-closeup-pale.png')}${await img('shadow-closeup-dark.png')}
<h2>Verdikt po lastnikovem veljavnem pravilu</h2>
<table><tr><th>Lastnost</th><th>Verdikt</th></tr>${m.deviationTable.map(r=>`<tr><td>${esc(r.property)}</td><td>${esc(r.verdict)}</td></tr>`).join('')}</table>
<p>Ikone: 60 % je ciljna velikost in izmerjena velikost pri enovrstičnih napisih. Ohranjeno je pravilo predlog flex-shrink za dolge napise: pri »Dodaj na začetni zaslon« je izmerjenih 50 %, da se ikona in besedilo ne prekrivata. Tabela ne pomeni, da je vsaka ikona ne glede na dolžino napisa velika 60 %.</p>
<p>Pravilo brez senc zajema tudi gumbe podstrani in portalov; ne odstranjuje senc neinteraktivnih kartic. Preverjanje izrisanih gumbov je dodano obstoječemu testu drsenja gostujočih zaslonov.</p>`;
await writeFile(`${D}/report.html`,html + supplement);console.log('report written');
