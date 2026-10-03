"""Package owner SQL as plain files and a self-contained downloadable report."""
import base64
import hashlib
import html
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "artifacts/smart360/reports/legacy-translations"
DATA = ROOT / ".local/legacy-rollout"
manifest = json.loads((OUT / "manifest.json").read_text())
verification = json.loads((OUT / "dev-verification.json").read_text())
audit = json.loads((DATA / "format-audit.json").read_text())
production = json.loads((DATA / "production-recheck.json").read_text())
assert all(row["unchanged"] for row in production)
assert len(verification) == 4
for m in manifest:
    assert hashlib.sha256((OUT / (m["slug"] + ".sql")).read_bytes()).hexdigest() == m["sqlSha256"]
    v = next(v for v in verification if v["slug"] == m["slug"])
    assert v["first"] == m["expectedInsert"] and v["second"] == 0
    assert v["protectedBefore"] == v["protectedAfter"]
for name, value in [("format-audit.json", audit), ("production-recheck.json", production)]:
    (OUT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2))

lines = [
    "# POVZETEK ZA LASTNIKA",
    "",
    "## Rezultat",
    "",
    "Pripravljene so štiri samostojne SQL datoteke za lastnikovo izvedbo s psql.",
    "Produkcija je bila samo brana. Agent ni izvedel produkcijskih zapisov in ni sprožil objave.",
    "Skupaj 267 novih osnutkov: 89 en, 89 de in 89 it. Vir je izključno izvorno slovensko polje; brez angleškega nadomestnega vira.",
    "Obvestila niso vključena. Vse obstoječe vrstice, tudi prazne in zastarele, so ohranjene.",
    "",
    "| Nastanitev | Slovenska polja | EN: obstoječa / nova | DE: obstoječa / nova | IT: obstoječa / nova | Skupaj novih |",
    "|---|---:|---:|---:|---:|---:|",
]
for m in manifest:
    c = m["counts"]
    lines.append(f'| {m["slug"]} | {c["en"]["sourceFields"]} | ' +
                 " | ".join(f'{c[l]["existingSourceRows"]} / {c[l]["insert"]}' for l in ["en", "de", "it"]) +
                 f' | {m["expectedInsert"]} |')
lines += [
    "",
    "Obstoječa v tej tabeli pomeni vrstico za trenutni izvorni ključ, ne vseh zgodovinskih prevodnih vrstic.",
    "Skupne števce vseh vrstic po jezikih vsebuje manifest.json; vključujejo tudi stare ključe in izbrisano vsebino.",
    "MENINA ima 34 obstoječih vrstic na stari jezik, vendar le 33 pripada sedanjim 49 poljem. Zato potrebuje 16 novih na jezik.",
    "",
    "## Zastarele vrstice — brez sprememb",
    "",
    "| Nastanitev | Zastarele EN/DE/IT za trenutna polja | Vse zastarele EN/DE/IT, tudi stari ključi |",
    "|---|---|---|",
]
for m in manifest:
    c=m["counts"]
    lines.append(f'| {m["slug"]} | ' + "/".join(str(c[l]["stale"]) for l in ["en","de","it"]) + " | " +
                 "/".join(str(c[l]["staleAll"]) for l in ["en","de","it"]) + " |")
lines += [
    "",
    "Popolni seznami so v datotekah <nastanitev>-stale.json: jezik, model, record_id, polje, obstoječi prevod, trenutni vir in oznaka inCurrentSource.",
    "Zastarelost je ugotovljena iz shranjene oznake stale, ki jo uporablja admin; časovnega ali pomenskega odstopanja brez te oznake ne ugibamo.",
    "Ločena seznama source-empty in existing-blank po nastanitvi pojasnita izpuščene vire in zaščitene prazne prevode.",
    "",
    "## Pričakovani števci vseh šestih zavihkov",
    "",
    "| Nastanitev | EN | DE | IT | FR | NL | HR |",
    "|---|---|---|---|---|---|---|",
]
for m in manifest:
    n=m["counts"]["en"]["sourceFields"]
    assert all(m["counts"][l]["existingSourceRows"]+m["counts"][l]["insert"] == n for l in ["en","de","it","fr","nl","hr"])
    lines.append(f'| {m["slug"]} | ' + " | ".join([f"{n}/{n}"]*6) + " |")
lines += [
    "",
    "Admin šteje prisotne vrstice, tudi zastarele; poln števec zato ne pomeni, da so zastareli prevodi osveženi. Njihove oznake ostanejo.",
    "Meli Pu ima 292 trenutnih slovenskih polj. Prejšnjih 295 je vključevalo tri polja z angleškim nadomestnim virom; ta niso predmet te dostave.",
    "FR/NL/HR so bili ob tem produkcijskem branju že prisotni za vsa trenutna polja; ta paket jih ne spreminja.",
    "Števci so preverjeni s trenutnim seznamom ključev admina na DEV kopijah in s produkcijskim inventarjem, ne s prijavljenim produkcijskim brskalnikom.",
    "",
    "## Varovalke",
    "",
    "- Ena transakcija na datoteko, INSERT-only in ON CONFLICT DO NOTHING.",
    "- Tabelni zaklepi varujejo preverjanje pred sočasnimi spremembami. Čakanje na zaklep največ 10 s, izvajanje stavka največ 60 s.",
    "- Kontrolna vsota izvora, vseh obstoječih prevodnih vrstic vseh jezikov (vključno z izbrisanimi potomci) in celotnih vrstic objavljenih posnetkov.",
    "- Predhodna in naknadna kontrola; vsako odstopanje prekine transakcijo.",
    "- Varno ponavljanje dovoljuje le nove ključe tega paketa z enako vrednostjo in stale=false. Drugačne vmes dodane vrstice povzročijo prekinitev, nikoli prepisovanja.",
    "- Preverjeno je tudi, da so po vnosu vsi predvideni prevodi prisotni in nespremenjeni.",
    "- NOTICE navede dejansko število vstavljenih vrstic in potrdi kontrolne vsote ter varno ponovitev.",
    "- Obstoječi sprožilec lahko označi osnutek kot spremenjen/operatorjev in posodobi njegov čas. To ni objava ali sprememba posnetka.",
    "",
    "## DEV dokazi",
    "",
    "| Nastanitev | Prva izvedba | Druga izvedba | Zaščitene kontrolne vsote |",
    "|---|---:|---:|---|",
]
for v in verification:
    lines.append(f'| {v["slug"]} | {v["first"]} | {v["second"]} | enake |')
lines += [
    "",
    "Izvedene so bile dostavljene datoteke s prilagojenimi identitetami in DEV osnovnimi kontrolnimi vsotami na neobjavljenih dokaznih kopijah.",
    "Uporabljen je PostgreSQL odjemalec na eni povezavi na datoteko, ne Replitov SQL urejevalnik.",
    "Vsi predhodno obstoječi DEV prevodi so bili primerjani pred/po in ostali enaki. Druga izvedba ni dodala ničesar.",
    "Negativni preizkus z namerno napačno pričakovano kontrolno vsoto je prekinil vsako datoteko brez sprememb prevodov.",
    "Ponovno produkcijsko branje po pripravi ima enake kontrolne vsote izvora, vseh prevodov in posnetkov kot začetni izvoz.",
    f'Preverjenih je {audit["units"]} enoličnih izvornih besedil × 3 jeziki: oznake HTML, prelomi, zaščiteni nadomestni znaki, številke in nepraznost.',
    "Imena in naslovi v namenskih poljih so ohranjeni dobesedno. Vse besedilo ni bilo neodvisno pregledano s strani človeškega prevajalca.",
    "",
    "## Izvedba za lastnika",
    "",
    "1. V lupini uporabite že delujočo varno produkcijsko povezavo. Povezovalnega niza ne lepite v poročila ali klepet.",
    "2. Za vsako datoteko posebej: psql -X -v ON_ERROR_STOP=1 -f <datoteka.sql>.",
    "   Ukaz predpostavlja, da vaša obstoječa nastavitev psql že izbere pravo produkcijsko bazo; brez nje ga ne izvajajte.",
    "3. Vrstni red: meli-pu.sql (72), camping-menina.sql (48), kamp-savinja.sql (72), turizem-drobez.sql (75).",
    "4. Ob napaki se ustavite. Ne odstranjujte varovalk, ne izvajajte po kosih in ne popravljajte kontrolnih vsot na roko.",
    "5. Varna ponovitev ob nespremenjenem zaščitenem stanju doda 0. Po spremembi izvora, obstoječih prevodov ali objavi je potrebna nova priprava.",
    "6. Lastnik pregleda osnutke; objava vsake nastanitve ostaja ločena lastnikova odločitev.",
    "",
    "SQL sam ne objavi ničesar. Agent se po dostavi ustavi.",
    "",
    "## Osnovne kontrolne vsote",
]
for m in manifest:
    lines += ["", f'### {m["slug"]}', "", *[f"- {k}: `{v}`" for k,v in m["baseline"].items()],f'- SHA-256 datoteke: `{m["sqlSha256"]}`']
text="\n".join(lines)+"\n"
(OUT/"POVZETEK-ZA-LASTNIKA.md").write_text(text)
downloads=[]
for p in sorted(OUT.iterdir()):
    if p.suffix not in [".sql",".json",".md"]: continue
    b64=base64.b64encode(p.read_bytes()).decode()
    downloads.append(f'<li><a download="{html.escape(p.name)}" href="data:application/octet-stream;base64,{b64}">{html.escape(p.name)}</a></li>')
details=[]
for m in manifest:
    rows=json.loads((OUT/(m["slug"]+"-stale.json")).read_text())
    cells="".join("<tr>"+"".join(f"<td>{html.escape(str(r.get(k,'')))}</td>" for k in ["lang","model","record_id","field","inCurrentSource","source","value"])+"</tr>" for r in rows)
    details.append(f'<details><summary>{html.escape(m["slug"])} — {len(rows)} zastarelih vrstic</summary><div class="scroll"><table><tr><th>Jezik</th><th>Model</th><th>ID</th><th>Polje</th><th>Trenutni ključ</th><th>Vir</th><th>Prevajanje</th></tr>{cells}</table></div></details>')
(OUT/"lastnik.html").write_text('<!doctype html><html lang="sl"><meta charset="utf-8"><title>Manjkajoči prevodi EN/DE/IT</title><style>body{font:16px/1.6 system-ui;max-width:1100px;margin:40px auto;padding:0 20px;color:#17202a}pre{white-space:pre-wrap;font:inherit}a{color:#075bb5}td,th{border:1px solid #ddd;padding:8px;vertical-align:top;min-width:100px}table{border-collapse:collapse}.scroll{overflow:auto}summary{cursor:pointer;font-weight:bold;margin:20px 0}</style><h1>POVZETEK ZA LASTNIKA</h1><h2>Prenos posameznih datotek</h2><ul>'+"".join(downloads)+"</ul><pre>"+html.escape(text)+"</pre><h2>Popolni seznami zastarelih vrstic</h2>"+"".join(details)+"</html>")
zip_path=OUT.parent/"legacy-prevodi-en-de-it.zip"
with ZipFile(zip_path,"w",ZIP_DEFLATED) as z:
    for p in sorted(OUT.iterdir()):
        if p.is_file():z.write(p,p.name)
print(json.dumps({"zip":str(zip_path.relative_to(ROOT)),"report":str((OUT/"lastnik.html").relative_to(ROOT)),"sqlFiles":4,"insertions":sum(m["expectedInsert"] for m in manifest)},ensure_ascii=False))