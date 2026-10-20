"""Build a self-contained, downloadable evidence report from measured captures."""
import base64
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1] / "reports/enostaven"
measurements = json.loads((root / "measurements.json").read_text())
published = [r for r in measurements if r["source"] == "public snapshot"]
count = sum(len(r["tiles"]) for r in published)

def image(name, caption):
    data = base64.b64encode((root / name).read_bytes()).decode()
    return f'<figure><figcaption>{caption}</figcaption><img src="data:image/png;base64,{data}" alt="{caption}"></figure>'

parts = [f"""<!doctype html><html lang="sl"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Enostaven — izvedba in dokazila</title>
<style>body{{font:16px/1.55 system-ui,sans-serif;background:#f5f6f8;color:#18212b;margin:0}}
main{{max-width:1050px;margin:auto;padding:32px 24px}}h1,h2{{line-height:1.2}}h2{{margin-top:44px}}
.pair{{display:flex;gap:20px;flex-wrap:wrap}}figure{{margin:0 0 24px;max-width:390px;flex:1;min-width:250px}}
img{{width:100%;height:auto;border:1px solid #ccd3dd}}figcaption{{font-weight:700;margin:8px 0}}
.note{{padding:18px;background:#fff;border-left:4px solid #355578}}table{{border-collapse:collapse;width:100%;background:#fff}}
td,th{{padding:10px;border:1px solid #ccd3dd;text-align:left}}code{{font-size:14px}}small{{color:#536071}}</style>
<main><h1>Enostaven — izvedba in dokazila</h1>
<p><strong>Razvojno okolje. Ni objavljeno.</strong> Dokazila pri 390 × 844, Chromium, DPR 1.</p>
<div class="note">Dizajn Trend ostaja privzet. Enostaven uporablja isto objavljeno vsebino in obstoječe podstrani.
Fotografije, kategorije in ponudbe niso bile prepisane s primeri iz predlog.</div>
<h2>POVZETEK ZA LASTNIKA</h2>
<ul><li>Dodana izbira Trend / Enostaven ter bordo, modra in lastna RGB barva.</li>
<li>Enostaven ima en drseči pogled s skupinami Domov, Nastanitev, Ponudba, Okolica in Sporočila; brez spodnje navigacije.</li>
<li>Ploščice nastajajo iz vsebine in razpoložljivih funkcij. Enostaven se odpre brez identifikacije; naročilo/izposoja jo zahteva ob prvem začetku.</li>
<li>Enojna puščica s podstrani vrne na začetno mrežo. Snemalnik se ob vračanju skrije, ne odklopi.</li>
<li>Na vstopni strani obeh dizajnov je sedem pravih SVG zastav: SL spodaj, izbrana večja, JEZIK pod stolpcem.</li>
<li>Samostojni gostitelj lahko spreminja videz; concierge ne. Osnutek ostaja ločen od objavljenega posnetka.</li>
<li>V razvojno bazo so bila dodana samo tri odobrena nullable tekstovna polja, brez privzetih vrednosti ali podatkovnega prepisa.</li></ul>
<h2>Meritve in preverjanja</h2><table>
<tr><th>Preverjanje</th><th>Rezultat</th></tr>
<tr><td>Ploščica pri širini 390 px</td><td>92,65625 × 92,65625 px; tri v vrsti; razmika 30 / 19 px</td></tr>
<tr><td>Trije barvni prelivi</td><td>Točne barve predloge, postanki 0 / 52 / 100 %</td></tr>
<tr><td>Obroba</td><td>CSS 2,3 px; pri DPR 1 brskalnik izmeri 2 px, enako kot pri referenci</td></tr>
<tr><td>Napisi</td><td>Lato 700; naslov 900; preverjenih {count} napisov na dveh objavljenih posnetkih × sedem jezikov. Brez prelivanja ali več kot treh vrstic.</td></tr>
<tr><td>Zastave</td><td>52 × 38 px; izbrana 64 × 47 px. Vseh sedem ločeno vidnih; SL zadnja; takojšnja menjava jezika potrjena.</td></tr>
<tr><td>Trend začetni pogled</td><td>PNG pred/po je bajtno identičen ob istem času in položaju vrtiljaka. Vstopna stran je namerno spremenjena.</td></tr>
<tr><td>Prehodi</td><td>Zapiranje podrobnosti in Sporočil vrne na mrežo. Skuter → Naročilo odpre obstoječi identifikacijski obrazec pred oddajo.</td></tr>
<tr><td>Avtomatski pregledi</td><td>TypeScript uspešen; 13 namenskih testov uspešnih; backend HTTP preverjanje pravic, validacije in ločitve osnutek/objava uspešno.</td></tr></table>
<h2>Referenca in izvedba — pregled razlik</h2>
<p>Levo je izvirni HTML, katerega okvir je prilagojen širini 390 px; desno Enostaven z referenčno oblikovano testno vsebino.
Ne trdimo popolne slikovne enakosti: izrecne zahteve imajo prednost pri kvadratni obliki, 19-% zaobljenosti in belih piktogramih.
Izvirni HTML pri tej širini zaradi minimalne višine vsebine izriše prvo vrsto 92,65625 × 97 px, ima 19-px vogale in svetlo obarvane ikone.
Izvedba ohrani kvadrat; ikone po potrebi odstopijo prostor daljšim napisom.</p>"""]

for tenant, title in [("drobez", "Turizem Drobež"), ("melipu", "Apartmaji Meli Pu")]:
    for palette in ["bordo", "modra"]:
        parts.append(f"<h3>{title} — {palette}</h3><div class=pair>")
        parts.append(image(f"{tenant}-{palette}-reference.png", "Zavezujoča HTML referenca"))
        parts.append(image(f"{tenant}-{palette}.png", "Izvedba — referenčna testna vsebina"))
        parts.append("</div>")
parts.append("<h2>Lastna barva #246B54</h2><p>Temni odtenki ohranijo razmerje svetlosti bordo palete; svetli odtenki njeno relativno razdaljo do bele. Barvni odmik in razmerje nasičenosti sta deterministična.</p><div class=pair>")
parts += [image("drobez-custom.png", "Drobež — RGB"), image("melipu-custom.png", "Meli Pu — RGB"), "</div>"]
parts.append("<h2>Dejanska objavljena vsebina</h2><p>To sta razvojna izrisa javnih objavljenih posnetkov, ne spremembi objavljenih strani. Struktura je zato drugačna od ilustrativnih predlog. Vsebina se ni prilagajala za lepšo primerjavo.</p><div class=pair>")
parts += [image("drobez-published.png", "Drobež — objavljeni podatki"), image("melipu-published.png", "Meli Pu — objavljeni podatki"), "</div>"]
parts.append("<h2>Zastave in enojna vrnitev</h2><div class=pair>")
parts += [image("landing-bordo.png", "Enostaven — vstopna stran"), image("landing-trend.png", "Trend — vstopna stran"), image("category-single-back.png", "Ena puščica nazaj"), "</div>"]
parts.append("<h2>Trend pred / po</h2><p>Primerjana je nespremenjena izvorna kopija komponente in nova izvedba. Ura, naložene slike in položaj vrtiljaka so izenačeni. PNG datoteki sta identični.</p><div class=pair>")
parts += [image("trend-home-before.png", "Trend pred spremembo"), image("trend-home-after.png", "Trend po spremembi"), "</div>"]
parts.append("""<h2>Meje dokazil</h2><ul>
<li>To ni preizkus na fizičnem iPhonu in ni dokaz namestitve ali delovanja brez povezave na telefonu.</li>
<li>Testni slug nima pravega predala sporočil ali naročil; ti API zahtevki vračajo 404. Ni bilo oddanih naročil ali poslanih sporočil. Preverjen je vstop v identifikacijo, ne dostava.</li>
<li>Celotna zbirka testov ni zelena: izvajalec oblikovanja je poročal štiri že obstoječe napake pri urejevalniku vsebine, prazni kategoriji, iskanju Okolice in naslovih razdalj. Namenska preverjanja te spremembe so uspešna.</li>
<li>Produkcijska baza in objavljene nastavitve niso bile spreminjane. Nobena objava ni bila izvedena.</li></ul>
<p><small>Viri: uporabnikovi HTML predlogi; javni posnetki smart360.info; priložene meritve brskalnika. Lokalno vključeni pisavi Lato (OFL) in zastave flag-icons (MIT), z licencami.</small></p></main></html>""")
(root / "enostaven-porocilo.html").write_text("".join(parts))
print(root / "enostaven-porocilo.html")
