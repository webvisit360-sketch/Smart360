"""Package prepared owner-console SQL and verification evidence. No DB access."""
from pathlib import Path
import json, csv, hashlib, re, shutil, html, base64, zipfile

root = Path(__file__).resolve().parents[3]
work = root / ".local/translation-rollout"
out = root / "artifacts/smart360/reports/seven-languages/content"
manifest = json.loads((out / "manifest.json").read_text())
inventory = json.loads((work / "inventory.json").read_text())
units = {u["id"]:u for u in json.loads((work/"units.json").read_text())}
audit=[]
for unit in units.values():
    row=json.loads((work/"translated"/(unit["id"]+".json")).read_text())
    for lang in ["fr","nl","hr"]:
        pattern=r"<[^>]*>|\r\n|\n|\r|\{\{[^}]+\}\}|\$\{[^}]+\}"
        assert re.findall(pattern,unit["text"])==re.findall(pattern,row[lang]),unit["id"]
        assert row[lang].strip()
        audit.append({"unit":unit["id"],"language":lang,"formatting":"identical","nonempty":True})
(out/"format-audit.json").write_text(json.dumps(audit,indent=2))
for name in ["dev-verification.json","owner-sql-dev-verification.json","production-compatibility.txt"]:
    shutil.copyfile(work/name,out/name)
evidence=[]
for m in manifest:
    slug=m["slug"]
    before=json.loads(list(csv.DictReader((work/f"{slug}-baseline.csv").open()))[0]["evidence"])
    after=json.loads(list(csv.DictReader((work/f"{slug}-after.csv").open()))[0]["evidence"])
    assert before==after
    evidence.append({"slug":slug,"before":before,"after":after,"unchanged":True})
    m["sqlFileSha256"]=hashlib.sha256((out/f"{slug}.sql").read_bytes()).hexdigest()
(out/"manifest.json").write_text(json.dumps(manifest,indent=2))
(out/"production-before-after.json").write_text(json.dumps(evidence,indent=2))

report="""# POVZETEK ZA LASTNIKA

## Rezultat

Pripravljene so štiri popolne SQL datoteke za lastniško produkcijsko konzolo.
Agent jih NI izvedel v produkciji in NI sprožil objave.
Vsebujejo samo INSERT manjkajočih osnutkov fr/nl/hr; ON CONFLICT DO NOTHING
ohrani tudi obstoječe prazne vrstice. Obvestila in objavljeni posnetki niso spremenjeni.

| Nastanitev | FR | NL | HR | Skupaj |
|---|---:|---:|---:|---:|
"""
for m in manifest:
    report+=f"| {m['slug']} | {m['counts']['fr']} | {m['counts']['nl']} | {m['counts']['hr']} | {sum(m['counts'].values())} |\n"
report+="""
Skupaj: 2.181 novih prevodnih vrstic, 727 na jezik.
Prevedeni so obstoječi naslovi, oznake kategorij, opisi, alineje, opombe
in enote cen, vključno s skrito aktivno vsebino. Izbrisana vsebina ni vključena.
Lastna imena se lahko namenoma pojavijo enaka v vseh jezikih.

## Izpuščena polja

"""
for m in manifest:
    report+=f"- {m['slug']}: {m['skipped']} praznih polj brez slovenskega in angleškega vira; {m['englishFallback']} polja z angleškim virom. Popoln seznam: {m['slug']}-skipped.json.\n"
report+="""
- Obstoječih fr/nl/hr vrstic ob izvozu: 0. SQL jih ob kasnejšem trčenju ohrani.
- MENINA nima aktivnih vnosov; njene prazne kategorije so prevedene, novih vnosov ni.
- V vseh štirih nastanitvah ni izpolnjenih eventSchedule.locationText/ageText (Termin)
  ali producerNote. Praznih vrednosti nismo izmišljali; vključene so v sezname izpustov.
- Pri Meli Pu je bilo iz obsega izločenih 47 starih angleških odstavčnih aliasov:
  niso manjkajoča polja, temveč podvojitve obstoječega slovenskega HTML-opisa.
  Končni obseg je 295 polj/jezik, ne začetnih 342.
- Trije angleški viri Meli Pu so: naslov Entrance gate in opisa dveh apartmajev.
- Naslovi URL, koordinate, ure, cene, trajanje, razdalje in geometrija GPX niso prevajani.

## Varovalke in dokazila

- Produkcija je bila samo brana. production-before-after.json vsebuje enake kontrolne
  vsote pred/po delu za slovenski izvor, vse vrstice sl/en/de/it in objavljeni posnetek.
- Slovenščina je praviloma v izvornih tabelah: nič vrstic lang=sl NE pomeni nič
  slovenskega besedila. Varuje jo dodatna kontrolna vsota source.
- Vsaka SQL datoteka pred vnosom preveri te kontrolne vsote, nato še enkrat po njem.
  Če so se spremenile, transakcija odpove brez vnosa; datoteko je treba osvežiti.
- SQL uporablja kratke tabelne zaklepe (čakanje največ 10 s, izvedba največ 60 s).
  Izvedite eno datoteko naenkrat; ob napaki ne odstranjujte varovalk.
- Obstoječi produkcijski sprožilec sam označi osnutek kot spremenjen/operatorjev
  in posodobi njegov čas. To je pričakovan stranski učinek INSERT, ne objava.
- DEV: štiri nove neobjavljene kopije, nove identitete, brez računov in gesel.
  Dodanih 2.181 novih prevodov poleg 2.133 nespremenjenih starih prevodov.
  Ponovljeni INSERT je dodal 0 vrstic. Prejšnji DEV prevodi so ostali enaki.
- Produkcijske datoteke so bile preverjene tudi na DEV kopijah, z zamenjanimi
  identitetami in DEV kontrolnimi vsotami: vsaka je dodala 0 vrstic ob ponovitvi
  in ohranila zaščitene kontrolne vsote. To NI produkcijska izvedba.
- 454 enoličnih izvornih besedil × 3 jeziki je prestalo avtomatsko preverjanje
  nepraznih prevodov ter enakih oznak HTML, prelomov in predlog. Celovit strokovni
  človeški jezikovni pregled vseh besedil ni bil izveden.
- Backend TypeScript preverjanje je uspešno.

## Vrstni red

1. Lastnik izvede štiri .sql datoteke v produkcijski SQL konzoli, vsako v celoti.
   Pri nespremenjenem stanju so pričakovani vnosi 885 / 147 / 573 / 576.
   Ponovitev pred spremembami izvorov/objav doda 0 vrstic.
2. Preveri se, da je objavljena različica kode s podporo sedmim jezikom.
   Če še ni, jo lastnik objavi posebej; ta dostava objave ne sproži.
3. Lastnik posebej pregleda osnutek vsake nastanitve in potrdi objavo njene vsebine.
   Sam SQL in sama objava kode ne nadomestita te potrditve.

Produkcijska baza že sprejema oznake fr/nl/hr: lang je text brez jezikovnega CHECK
ali enum. Zato SQL ne potrebuje predhodne objave kode ali spremembe sheme.
Živi javni zahtevek za Drobež z ?lang=fr je vrnil HTTP 200, a stari posnetek še
vsebuje štiri jezike in slovenske naslove. HTTP 200 torej ni dokaz objavljenih
francoskih vsebinskih prevodov.

## Omejitve slikovnih dokazil

Slike so DEV dokazi resničnih komponent Living Guide z gostujočimi projekcijami
novih neobjavljenih DEV kopij, ne produkcijske slike in ne dokaz prijave.
Samostojni DEV prikaz bere te projekcije iz datotek; normalna avtentikacija in
transport gostujočega API-ja nista predmet tega preverjanja.
Kopije vsebujejo le odobreni izbor stolpcev; ne dokazujejo celotne vizualne
identičnosti produkciji (npr. barve, razdalje, obvestila in vreme).
Vreme, obvestila ter naročanje niso bili ustvarjeni ali preizkušeni.
Morebitna preostala slovenska besedila vmesnika niso del SQL vsebinskih prevodov.

## Kontrolne vsote

"""
for e in evidence:
    report+=f"\n### {e['slug']}\n\nPred = po:\n\n- slovenski izvor: `{e['before']['source']}`\n"
    for lang,v in e["before"]["legacy"].items():
        report+=f"- {lang}: {v['count']} vrstic, `{v['md5']}`\n"
    report+=f"- objavljeni posnetek: `{e['before']['snapshot']}`\n"
if (out/"browser-verification.md").exists():
    report+="\n## Brskalniško preverjanje\n\n"+(out/"browser-verification.md").read_text()
(out/"POVZETEK-ZA-LASTNIKA.md").write_text(report)
links=""
for m in manifest:
    name=m["slug"]+".sql"
    data=base64.b64encode((out/name).read_bytes()).decode()
    links+=f'<p><a download="{name}" href="data:application/sql;base64,{data}">Prenesi {name}</a></p>'
images=""
for p in sorted(out.glob("*.jpg")):
    data=base64.b64encode(p.read_bytes()).decode()
    images+=f'<figure><figcaption>{html.escape(p.stem)} — DEV</figcaption><img src="data:image/jpeg;base64,{data}" alt="{html.escape(p.stem)}"></figure>'
page=f'<!doctype html><html lang="sl"><meta charset="utf-8"><title>POVZETEK ZA LASTNIKA</title><style>body{{font:16px system-ui;max-width:1100px;margin:40px auto;padding:20px}}pre{{white-space:pre-wrap;line-height:1.55}}a{{color:#075a73}}.images{{display:flex;flex-wrap:wrap;gap:20px}}figure{{margin:0;width:260px}}img{{width:100%}}</style><h1>Prevodi vsebine: FR / NL / HR</h1>{links}<pre>{html.escape(report)}</pre><div class="images">{images}</div></html>'
(out/"lastnik.html").write_text(page)
with zipfile.ZipFile(out.parent/"prevodi-fr-nl-hr.zip","w",zipfile.ZIP_DEFLATED) as z:
    for p in out.iterdir():
        if p.is_file():z.write(p,p.name)
print("Packaged",len(list(out.glob("*.jpg"))),"screenshots")