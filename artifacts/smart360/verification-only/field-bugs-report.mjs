import { readFile, writeFile } from "node:fs/promises";
const dir = "reports/field-bugs";
const image = async (file, caption) => `<figure><img src="data:image/${file.endsWith(".jpg") ? "jpeg" : "png"};base64,${(await readFile(`${dir}/${file}`)).toString("base64")}"><figcaption>${caption}</figcaption></figure>`;
const evidence = await Promise.all([
  image("welcome-detail-390x844.png","Pred spremembo: kratek vnos. Na njem napake nismo reproducirali."),
  image("postfix/program-pull-close-before.jpg","Program pred potezo – kader iz posnetka."),
  image("postfix/program-pull-close-after.jpg","Po potezi – vrnitev na mrežo."),
  image("gps-accurate-movement-390x844.png","Začetna simulacija GPS: nen ničelna razdalja 25 m (pred popravkom)."),
]);
const detailed = (await readFile(`${dir}/postfix/final-verification.md`,"utf8")).replaceAll("&","&amp;").replaceAll("<","&lt;");
await writeFile(`${dir}/porocilo.html`, `<!doctype html><html lang="sl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Tri terenske napake – poročilo</title><style>body{font:16px/1.6 system-ui;max-width:1050px;margin:auto;padding:24px;background:#f5f6f7;color:#202631}h1,h2{line-height:1.2}table{border-collapse:collapse;width:100%}td,th{padding:10px;border:1px solid #bbb;text-align:left}.images{display:flex;flex-wrap:wrap;gap:18px}figure{margin:0;width:300px}img{width:100%}figcaption{font-size:13px}pre{white-space:pre-wrap;font:13px/1.5 monospace}</style>
<h1>POVZETEK ZA LASTNIKA</h1><p>Razvojno okolje, 21. 10. 2026. <strong>Brez objave in brez sprememb baze.</strong></p>
<h2>1. Dosegljiv konec vsebine</h2><p>Popravljena omejitev premika lista glede na dejansko vidni del zaslona, krčenje vsebinskega okvirja in spodnji odmik z varnim območjem. Dolga vsebina je bila z več zaporednimi potezami na dotik dosegljiva pri 390 × 844 in 390 × 920: vnos, ponudba, dogodek in obvestilo.</p><p><strong>Omejitev dokaza »prej/potem«:</strong> prvotni kratki testni primer ni pokazal nedosegljivega konca. Priloženi začetni posnetek zato ni dokaz reprodukcije napake. Končna posnetka dolge vsebine sta prikazana v pogovoru; podrobne meritve so spodaj.</p>
<h2>2. En gumb nazaj in poteg navzdol</h2><table><tr><th>Vrsta</th><th>Lastnik gumba / pregled</th></tr>
<tr><td>Vnos</td><td>Zunanji okvir podrobnosti; poteza zapre list.</td></tr>
<tr><td>Ponudba</td><td>Zunanji okvir; naročilni gumb ostaja ločen in dosegljiv.</td></tr>
<tr><td>Obvestilo</td><td>En gumb obvestila; v Enostaven vrne na mrežo, ne v seznam.</td></tr>
<tr><td>Tura</td><td>Zunanji okvir pri podrobnosti poti; snemalnik ima svoj en gumb. GPS preizkušen v snemalniku; zemljevid zaradi manjkajočega WebGL2 ni potrjen.</td></tr>
<tr><td>Program</td><td>Zunanji okvir; podvojeni notranji gumb skrit v Enostaven. Poteg z vrha preverjen in posnet.</td></tr>
<tr><td>Vreme</td><td>En gumb v vremenskem listu; dodan poteg z vrha, preverjen prikaz podatkov.</td></tr></table>
<p>Podrobni pregled spodaj loči izvedene interakcije od pregleda kode. Posnetek poteze je priložen posebej.</p>
<h2>3. GPS in statistika</h2><p>Simulacija dobrega signala je že pred spremembo pokazala 25 m, zato splošna regresija snemalnika Enostaven ni dokazana. Odpravljena je zavrnitev sicer veljavne vodoravne lokacije zaradi neveljavnih neobveznih podatkov o višini. Prag nad 100 m ostaja: takšna točka ne povečuje razdalje.</p>
<p>Nova vrstica <strong>GPS prejeto / sprejeto · ± n m</strong> omogoča diagnozo na telefonu. Opozorila razlikujejo slab signal, zavrnjeno točko, zavrnjeno dovoljenje ter več kot 25 sekund brez posodobitve. Besedila so v vseh sedmih jezikih. Preizkušeni so bili sprejem točke z altitudeAccuracy −1, zavrnitev 101 m, zavrnjeno dovoljenje, okrevanje in opozorilo ob zastalem toku podatkov.</p>
<p><strong>Fizični iPhone ni bil testiran.</strong> iOS-ovo ustavljanje lokacije ob zaklepu, razlike med nameščeno PWA in zavihkom ter dejansko stanje dovoljenja pri gostitelju ostajajo nepotrjeni. Ni trditve, da brskalniški test dokazuje delovanje v ozadju. Za razlago na telefonu: če števec prejetih točk miruje, brskalnik ne dostavlja posodobitev; če raste samo prvi števec, točke zavrača filter, opozorilo pa pojasni razlog.</p>
<h2>Preverjanje</h2><p>424/424 testov uspešnih; končni TypeScript pregled uspešen. Razvojni strežnik deluje. Testni podatki in GPS so bili sintetični; brez sprememb pravih nastanitev.</p>
<div class="images">${evidence.join("")}</div><h2>Podrobni zapis preverjanja</h2><pre>${detailed}</pre></html>`);
