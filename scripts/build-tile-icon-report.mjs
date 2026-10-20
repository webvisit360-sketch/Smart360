import { readFileSync, writeFileSync } from "node:fs";
const dir = "artifacts/smart360/reports/enostaven/icon-library";
const measurements = JSON.parse(readFileSync(`${dir}/measurements.json`, "utf8"));
const esc = value => String(value).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const image = (file, title) => `<figure><img alt="${esc(title)}" src="data:image/png;base64,${readFileSync(`${dir}/${file}.png`).toString("base64")}"><figcaption>${esc(title)} — 390 × 844</figcaption></figure>`;
const gallery = [
  ["melipu-home", "Meli Pu — začetek mreže"],
  ["melipu-offer-start", "Meli Pu — Ponudba"],
  ["melipu-explore-start", "Meli Pu — Okolica, začetek"],
  ["melipu-explore-end", "Meli Pu — Okolica, nadaljevanje"],
  ["melipu-services-end", "Meli Pu — Storitve"],
  ["drobez-home", "Drobež — začetek mreže"],
  ["drobez-offer-start", "Drobež — Ponudba"],
  ["drobez-services-end", "Drobež — Okolica in Storitve"],
  ["admin-picker", "Dejanski urejevalnik kategorije — vseh 50 ikon"],
  ["admin-selected", "Ročna izbira Pizzerias za kategorijo Breakfast"],
  ["fallback-offer", "Sintetično neznano ime — voziček v Ponudbi"],
  ["fallback-explore", "Sintetično neznano ime — pin v Okolici"],
].map(([file, title]) => image(file, title)).join("");
const rows = measurements.filter(m => m.rows).flatMap(m => m.rows.map(r =>
  `<tr><td>${esc(m.tenant)}</td><td>${esc(r.group)}</td><td>${esc(r.label)}</td><td>${esc(r.icon)}</td><td>${r.width.toFixed(1)} × ${r.height.toFixed(1)}</td><td>${r.iconWidth.toFixed(1)} × ${r.iconHeight.toFixed(1)}</td></tr>`
)).join("");
writeFileSync(`${dir}/porocilo.html`, `<!doctype html><html lang="sl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Smart360 — knjižnica ikon</title>
<style>body{font:16px/1.55 system-ui,sans-serif;margin:0 auto;padding:28px;max-width:1280px;color:#20302d;background:#f6f7f8}h1,h2{line-height:1.2}.note{padding:20px;background:white;border:1px solid #ccd7d3;border-radius:12px}.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:22px}figure{margin:0}img{width:100%;max-width:390px;height:auto;border:1px solid #cbd3cf;border-radius:10px}figcaption{font-size:14px;margin:8px 0 20px}table{border-collapse:collapse;width:100%;background:white;font-size:13px}td,th{padding:8px;border:1px solid #ddd;text-align:left}.table{overflow:auto}code{overflow-wrap:anywhere}</style>
<h1>POVZETEK ZA LASTNIKA — knjižnica ikon</h1>
<p>Izvedeno v razvojnem okolju. Brez objave aplikacije, spremembe sheme baze ali spremembe vsebine pravih nastanitev.</p>
<ul><li>Vseh <strong>50 SVG-jev</strong> je prepisanih iz zavezujočega kataloga, brez prerisovanja. Obstoječa velikost prostora za ikone in detajli currentColor so ohranjeni.</li>
<li>Ujemanje po nazivu: sedem jezikov, neobčutljivo na velikost črk in naglase, podnizi; daljše ujemanje ima prednost. Dodane so sopomenke za obstoječe nazive (npr. Kulinarika, Skuter, Zunanji fitnes, Ladijski prevoz, Bolnišnica).</li>
<li>Hiking uporablja pohodnika, Map pin. Neznana imena še vedno dobijo rezervno ikono: pin v Okolici/Storitvah, voziček v Ponudbi.</li>
<li>Iskalni izbirnik vsebuje vseh 50 vnosov. Ročna izbira se shrani v obstoječe polje kategorije in ima prednost. »Samodejno po imenu« odstrani ročno prednost.</li>
<li>Na prikazanih skupinah Ponudba, Okolica in Storitve: <strong>27 različnih ikon pri Meli Pu in 16 pri Drobežu</strong>. Trditev ne velja za poljubne druge hišne kategorije ali namerno enake ročne izbire.</li></ul>
<h2>Preverjanja</h2><ul>
<li>Celotna spletna testna zbirka: 424/424 uspešnih; po zadnji razširitvi sopomenk ponovno uspešni vsi štirje testi kataloga. TypeScript in pregled presledkov uspešna.</li>
<li>Resnični API-test na sintetičnih, po testu odstranjenih zapisih: shranjevanje in branje iz baze, samodejna ponastavitev, nespremenjen javni posnetek pred objavo, samostojni gostitelj dovoljen, concierge gostitelj zavrnjen (403), operater dovoljen.</li>
<li>Brskalnik: izbirnik, iskanje, ročna izbira, zahteva za shranjevanje, ponovno odprtje s shranjeno izbiro in ponastavitev; dokaz rezervnih ikon na neznanih imenih. Meritve in posnetki 390 × 844.</li></ul>
<div class="note"><strong>Meje dokazil in razlika v viru</strong><p>Gre za razvojni Chromium pri zahtevani velikosti, ne fizični iPhone ali živo produkcijo. Meli Pu uporablja trenutni javni posnetek razvojnega okolja. Drobežev razvojni javni naslov vrača 404, zato prikaz uporablja predhodno zajeti javni posnetek Drobeževe vsebine z novo kodo.</p>
<p>Posnetek urejevalnika prikazuje pravi komponenti urejevalnika, vendar s sintetičnim zapisom in prestreženim transportom, brez prijave v lastnikov račun. Pravo shranjevanje in pravice so preverjene ločeno z API-testom.</p>
<p>Katalog za Breakfast vsebuje <strong>skodelico brez rogljička</strong>. Uporabljen je njegov točni SVG, ne izmišljena dopolnitev. Kulturna dediščina uporablja kataloško stavbo, Naravna dediščina kataloško goro. Pictograma Hiking/Pohodi in Map/Zemljevid sta namerni kataloški sopomenki.</p></div>
<h2>Posnetki zaslona</h2><div class="gallery">${gallery}</div>
<h2>Izmerjene ploščice</h2><p>Dimenzije so v CSS-pikslih. Vse ikone ohranijo viewBox 0 0 24 24. Imena in velikosti izhajajo iz dejansko izrisanih ploščic.</p><div class="table"><table><thead><tr><th>Nastanitev</th><th>Skupina</th><th>Naziv</th><th>Ikona</th><th>Ploščica</th><th>SVG</th></tr></thead><tbody>${rows}</tbody></table></div>
<p><strong>Nič ni objavljeno. Poročilo zaključuje delo.</strong></p></html>`);
console.log(`${dir}/porocilo.html`);
