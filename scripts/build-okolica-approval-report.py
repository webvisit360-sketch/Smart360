"""Render the captured, read-only production audit and exact approval manifest."""
import html
import json
from collections import Counter
from pathlib import Path

root = Path(__file__).resolve().parents[1]
reports = root / "reports"
baseline = json.loads((reports / "okolica-production-baseline.json").read_text())
manifest = json.loads((reports / "okolica-production-plan.json").read_text())
skeleton = json.loads((reports / "okolica-shared-skeleton.json").read_text())
categories = {c["id"]: c for c in baseline["categories"]}
tenants = {t["id"]: t for t in baseline["tenants"]}
parts = []


def paragraph(text):
    parts.append("<p>" + html.escape(text) + "</p>")


def heading(text, level=2):
    parts.append(f"<h{level}>" + html.escape(text) + f"</h{level}>")


def table(headers, rows):
    parts.append("<table><thead><tr>" + "".join(
        "<th>" + html.escape(str(v)) + "</th>" for v in headers
    ) + "</tr></thead><tbody>")
    for row in rows:
        parts.append("<tr>" + "".join(
            "<td>" + html.escape(str(v)) + "</td>" for v in row
        ) + "</tr>")
    parts.append("</tbody></table>")


heading("Okolica: produkcijski pregled in predlog sprememb", 1)
paragraph("22. september 2026 — ZA ODOBRITEV, NI IZVEDENO. Produkcija je bila samo prebrana. "
          "Brez objave, produkcijskih zapisov, sprememb sheme ali pošiljanja e-pošte.")
paragraph("Pregled zajema vse tri produkcijske nastanitve in oba dela Okolice: "
          "Odkrij okolico (12 kategorij) ter Storitve v bližini (6 kategorij). "
          "Vse tri že imajo vseh 18 ključev, tudi ločeno Kolesarjenje. "
          "Host-created custom kategorije so izvzete; v zajetem stanju jih ni.")
paragraph("POMEMBNO: varen predlog še ne odpravi vseh odstopanj. Štiri stare kategorije "
          "ostanejo zaščitene zaradi vsebine ali povezanih predlogov v Kreatorju. "
          "Niso preimenovane v 'lastne kategorije' in niso prikrite. Za popolnoma enako "
          "strukturo je potrebna dodatna odločitev o njihovi vsebini oziroma predlogih.")

heading("Skupni cilj: natančna imena in vrstni red")
for section in skeleton:
    heading(section["names"]["sl"], 3)
    table(["Položaj (od 0)", "Ključ", "SL", "EN", "DE", "IT"], [
        [i, c["key"], *(c["names"][lang] for lang in ["sl", "en", "de", "it"])]
        for i, c in enumerate(section["categories"])
    ])
paragraph("Slovensko ime je osnovna oznaka kategorije; EN, DE in IT so prevodne vrstice. "
          "Morebitni obstoječi slovenski prevodni zapis se prav tako preveri. "
          "Ročna vidnost isVisible ostane nespremenjena.")

labels = {"label": "oznaka SL", "exploreGroup": "skupina", "position": "položaj",
          "icon": "ikona", "layout": "postavitev"}
for plan in manifest["plans"]:
    tenant = tenants[plan["tenantId"]]
    heading(tenant["name"] + " — " + tenant["slug"])
    paragraph("ID nastanitve: " + tenant["id"])
    paragraph(f"Manjkajoče kategorije: 0. Prisotnih: {plan['canonicalCategoriesPresent']}/18. "
              "Predvidene nove kategorije: 0. Predvideni premiki vnosov: 0.")
    sections = {s["id"] for s in baseline["sections"] if s["tenant_id"] == tenant["id"]}
    canonical_keys = {c["key"] for s in skeleton for c in s["categories"]}
    extras = [c for c in baseline["categories"]
              if c["section_id"] in sections and not c["deleted_at"]
              and c["key"] not in canonical_keys]
    if extras:
        table(["Dodatna/stara kategorija", "Ključ", "ID"], [
            [c["label"], c["key"], c["id"]] for c in extras
        ])
    else:
        paragraph("Dodatnih/starih kategorij, preimenovanih oznak ali drugih odstopanj ni. "
                  "Vse štiri jezikovne oznake in vrstni red ustrezajo ogrodju. Brez sprememb.")

    metadata = []
    translations = []
    archives = []
    for action in plan["actions"]:
        kind = action["type"]
        if kind == "update-category":
            changes = "; ".join(
                f"{labels.get(k, k)}: {action['before'][k]} → {v}"
                for k, v in action["after"].items() if action["before"][k] != v
            )
            metadata.append([action["key"], action["categoryId"], changes])
        elif kind == "upsert-category-translation":
            translations.append([action["key"], action["categoryId"], action["language"],
                                 action["before"]["value"] or "(manjka)", action["after"]["value"]])
        elif kind == "archive-empty-legacy-category":
            archives.append([action["key"], action["categoryId"],
                             "deleted_at: NULL → čas transakcije; brez fizičnega brisanja"])
    if metadata:
        heading("Predvidene spremembe kategorij", 3)
        table(["Ključ", "ID kategorije", "Točna sprememba"], metadata)
    if translations:
        heading("Predvidene jezikovne oznake", 3)
        table(["Ključ", "ID kategorije", "Jezik", "Prej", "Potem"], translations)
    if archives:
        heading("Predviden umik praznih starih kategorij", 3)
        table(["Ključ", "ID kategorije", "Točna sprememba"], archives)
        paragraph("Umik je dovoljen samo ob ponovnem preverjanju, da ni niti skritih ali "
                  "izbrisanih vnosov, priponk, predlogov Kreatorja ali drugih preverjanih "
                  "povezav. Če se stanje spremeni, se transakcija zavrne.")
    if plan["actions"]:
        paragraph("Oznaka neobjavljenih sprememb: hasUnpublishedChanges false → true. "
                  "Status objave, čas zadnje objave in objavljeni posnetek ostanejo nespremenjeni.")
    if plan["residualBlockedLegacy"]:
        heading("Zaščitene stare kategorije — ostanejo odprto odstopanje", 3)
        rows = []
        for cid in plan["residualBlockedLegacy"]:
            c = categories[cid]
            items = [i for i in baseline["items"] if i["categoryId"] == cid]
            proposals = [p for p in baseline["proposals"] if p["categoryId"] == cid]
            attachments = [a for a in baseline["attachments"] if a["category_id"] == cid]
            rows.append([c["label"], cid, len(items), len(attachments), len(proposals)])
        table(["Kategorija", "ID", "Vnosi", "Povezave vnosov", "Predlogi Kreatorja"], rows)
        paragraph("Njihove vsebine in povezave se ne spreminjajo. Kategorije se samo "
                  "razvrstijo za standardnim ogrodjem, kot je navedeno v tabeli sprememb.")
    hike_ids = {c["id"] for c in baseline["categories"]
                if c["section_id"] in sections and c["key"] == "hike"}
    if tenant["slug"] == "glamping-gril":
        heading("Pregled združene kategorije: vsi vnosi ostanejo na mestu", 3)
        table(["Vnos", "ID vnosa", "Odločitev"], [
            [i["title"], i["id"], "Ostane v Pohodništvu; ročni pregled (opis ni specifičen za kolesarjenje)"
             if i["title"] == "Golte" else "Ostane v Pohodništvu; opis navaja planinstvo/pohode"]
            for i in baseline["items"] if i["categoryId"] in hike_ids
        ])
        paragraph("Ni potrjenega kolesarskega vnosa za premik. Golte se ne premika na podlagi ugibanja.")
        heading("Zaščiteni vnosi v kategoriji Znamenitosti", 3)
        sights_ids = {c["id"] for c in extras if c["key"] == "sights"}
        table(["Vnos", "ID vnosa"], [
            [i["title"], i["id"]] for i in baseline["items"] if i["categoryId"] in sights_ids
        ])
    paragraph("Kontrolni odtis zajetega stanja: " + plan["sourceHash"])

heading("Razvojno preverjanje in nova nastanitev")
paragraph("Predlog je preverjen z enotskimi testi in s preizkusom na začasni razvojni "
          "nastanitvi, pripravljeni iz kopije zajetega Grila z novimi ID-ji. Preverjeno: "
          "ohranitev vnosov, položajev vnosov, povezav, medijev in objavljenega posnetka; "
          "ponovitev brez dodatnih sprememb; zavrnitev zastarelega predloga in povrnitev transakcije. "
          "Začasni podatki se odstranijo. Obstoječe razvojne nastanitve se ne usklajujejo.")
paragraph("V razvojnem programu sta popravljena običajno ustvarjanje in kopiranje nastanitve: "
          "nova nastanitev se najprej pripravi iz trenutnega skupnega ogrodja. Preverjene "
          "so vse tri vrste nastanitev. Lastne kategorije gostiteljev ostanejo dodatki. "
          "Prazne stare kategorije se pri kopiranju ne prenašajo. Kopiranje vsebine iz "
          "neusklajene kategorije z vnosi se jasno zavrne in razveljavi celotno novo kopijo "
          "namesto izgube vsebine ali ponovitve stare strukture.")
paragraph("Izvajalnik za produkcijo NI priklopljen na zagon, API ali objavo. Predlog "
          "ne ustvarja manjkajočih kategorij v obstoječih nastanitvah, ker v tem produkcijskem "
          "zajemu ne manjka nobena; če bi se stanje do odobritve spremenilo, je potreben nov pregled. "
          "Vsebinske spremembe bi ostale osnutek do ločene odobrene objave.")

heading("Meja odobritve")
paragraph("Za odločitev so pripravljene samo zgoraj izpisane spremembe. Noben vnos se ne "
          "izbriše, prepiše ali premakne. Nobena napolnjena oziroma povezana kategorija se "
          "ne umakne. Popolna strukturna enotnost ostaja blokirana pri štirih navedenih "
          "starih kategorijah in ni predstavljena kot opravljena.")
paragraph("Strojno berljivi, neposredno iz preverjenega načrtovalnika ustvarjeni seznam: "
          "reports/okolica-production-plan.json. Zajeto stanje: reports/okolica-production-baseline.json.")
paragraph("STOP: čakanje na odobritev lastnika. Brez objave.")

css = """body{font:15px/1.5 system-ui,sans-serif;color:#183329;max-width:1250px;margin:40px auto;padding:0 24px}
h1{font-size:30px}h2{margin-top:44px;border-top:2px solid #176a48;padding-top:18px}h3{margin-top:28px}
table{width:100%;border-collapse:collapse;font-size:13px;margin:18px 0;overflow-wrap:anywhere}
td,th{border:1px solid #d4ded8;padding:9px;text-align:left;vertical-align:top}th{background:#edf5ef}
tr:nth-child(even){background:#fafcfb}p{max-width:1050px}@media print{body{margin:0;max-width:none}h2{break-before:auto}tr{break-inside:avoid}}"""
document = "<!doctype html><html lang='sl'><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Okolica — predlog za odobritev</title><style>" + css + "</style><body>" + "".join(parts) + "</body></html>"
(reports / "okolica-predlog-za-odobritev.html").write_text(document)
print("Created reports/okolica-predlog-za-odobritev.html")
print(Counter(action["type"] for plan in manifest["plans"] for action in plan["actions"]))