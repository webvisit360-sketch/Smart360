"""Build the review-only Gril Znamenitosti split ledger.

This reads the captured production baseline and never connects to a database.
No row in the generated ledger is approved for execution.
"""
from __future__ import annotations

import hashlib
import html
import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASELINE_PATH = ROOT / "reports/okolica-production-baseline.json"
JSON_PATH = ROOT / "reports/gril-znamenitosti-mapping-review.json"
HTML_PATH = ROOT / "reports/gril-znamenitosti-mapping-review.html"

TENANT_ID = "177e633a-6030-4eca-8ce8-e0a0afdff599"
LEGACY_ID = "6ce78358-dba7-4149-98a1-cec89a1caca4"
CULTURE_ID = "3b505769-d918-4d0f-a184-81b5426dcd7e"
NATURE_ID = "3bc04303-576c-45f4-9b94-b4a491a94827"
TARGETS = {
    "culture": {"key": "culture", "label": "Kulturna dediščina", "categoryId": CULTURE_ID},
    "nature": {"key": "nature", "label": "Naravna dediščina", "categoryId": NATURE_ID},
}

# Item decisions are deliberately explicit. Center Rinka and Mozirski gaj are mixed.
ITEM_DECISIONS = {
    "097f6a52-0170-4e35-bede-c1724c92dd0e": ("nature", "Jama je po izrecnem pravilu naravna dediščina."),
    "3ac0cb9d-34ca-4f49-ab87-3c3f36a09270": ("nature", "Jezero je po izrecnem pravilu naravna dediščina."),
    "42399814-ec16-4994-9048-0cf7908f2016": ("culture", "Srednjeveški grad je kulturna dediščina."),
    "45090937-2e12-48d3-87a9-f1179f2f5e2c": (None, "Razstavno središče je hkrati posvečeno naravi in kulturni dediščini; odloči operater."),
    "603fda63-f4fc-4e53-8f0f-7eb977aeccf9": ("culture", "Muzej je po izrecnem pravilu kulturna dediščina."),
    "8f7b1ffa-7b13-441b-a7ba-a7dbc8a6bb88": ("nature", "Slap je po izrecnem pravilu naravna dediščina."),
    "98b050d9-ef6c-4613-b053-707725017055": ("nature", "Opis ga izrecno opredeli kot naravno ledeno tvorbo."),
    "b86fc640-92e4-4014-aada-8baa487b1311": ("nature", "Kraški izvir reke je naravna dediščina."),
    "c45a1ac0-c214-4e6f-9c5d-78f56e50ae90": ("culture", "Muzej je po izrecnem pravilu kulturna dediščina."),
    "d6ba8374-c11d-43b1-ace8-ba647dd2651b": ("culture", "Cerkev je po izrecnem pravilu kulturna dediščina."),
    "e0671a2b-1db4-4dfc-8584-176e951e1a0d": ("nature", "Jama je po izrecnem pravilu naravna dediščina."),
    "e9fae122-8743-4de6-aec9-0fa346d61938": ("culture", "Grad z muzejsko zbirko je kulturna dediščina."),
    "ecdf8726-e0a8-4f27-bb0e-d327444f07cc": ("nature", "Jama je po izrecnem pravilu naravna dediščina, tudi če je arheološko pomembna."),
    "fd9d941b-f143-4804-a865-38aed37df836": (None, "Park združuje cvetje, etnološke objekte in sprehajalne poti; odloči operater."),
}

NATURE_PREFIXES = ("Slap ", "Jama ", "Jezero ")
CULTURE_TERMS = (
    "cerkev", "muzej", "grad", "dvorec", "nekropola", "kartuzija",
    "samostan", "kapela", "most",
)
NATURE_TERMS = ("jama", "jezero", "ledenica", "izvir", "podzemlje", "macesen")
PROPOSAL_EXPLICIT = {
    "Matkov škaf": ("nature", "Povezan vnos ga opredeli kot naravno ledeno tvorbo."),
    "Potočka zijalka": ("nature", "Jama je po izrecnem pravilu naravna dediščina."),
    "Alpski vrt Golte": ("nature", "Alpski vrt je po jasnem imenu zbirka alpskega rastlinstva."),
    "Center Rinka": (None, "Povezan vnos je mešano naravno in kulturno razstavno središče."),
    "Mozirski gaj": (None, "Povezan vnos je mešan park cvetja in etnoloških objektov."),
    "Kmetija Bukovnik": (None, "Samo ime kmetije ne določi naravne ali kulturne dediščine."),
    "Razgledni stolp na Golteh": (None, "Samo ime razglednega stolpa ne zadošča za zanesljivo razvrstitev."),
}


def proposal_decision(name: str) -> tuple[str | None, str]:
    if name in PROPOSAL_EXPLICIT:
        return PROPOSAL_EXPLICIT[name]
    lower = name.casefold()
    if name.startswith(NATURE_PREFIXES) or any(term in lower for term in NATURE_TERMS):
        return "nature", "Ime jasno označuje naravni pojav oziroma naravno znamenitost."
    if any(term in lower for term in CULTURE_TERMS):
        return "culture", "Ime jasno označuje cerkev, muzej, grad ali drugo kulturno zgrajeno dediščino."
    raise AssertionError(f"Proposal needs an explicit review decision: {name}")


raw = BASELINE_PATH.read_bytes()
baseline = json.loads(raw)
baseline_sha = hashlib.sha256(raw).hexdigest()
items = [row for row in baseline["items"] if row.get("categoryId") == LEGACY_ID]
proposals = [row for row in baseline["proposals"] if row.get("categoryId") == LEGACY_ID]
assert len(items) == 14
assert len(proposals) == 63
assert set(ITEM_DECISIONS) == {row["id"] for row in items}

item_by_id = {row["id"]: row for row in items}
materializations = defaultdict(list)
for row in baseline["materializations"]:
    if row.get("proposalId"):
        materializations[row["proposalId"]].append({
            "itemId": row["itemId"],
            "isActive": row["active"],
        })
attachments = defaultdict(list)
for row in baseline["attachments"]:
    if row.get("source_proposal_id"):
        attachments[row["source_proposal_id"]].append({
            "attachmentId": row["id"],
            "itemId": row["item_id"],
        })

item_rows = []
for row in sorted(items, key=lambda value: (value["title"], value["id"])):
    decision, reason = ITEM_DECISIONS[row["id"]]
    item_rows.append({
        "itemId": row["id"],
        "title": row["title"],
        "body": row["body"],
        "isVisible": row["isVisible"],
        "deletedAt": row["deletedAt"],
        "currentCategoryId": LEGACY_ID,
        "target": TARGETS.get(decision),
        "decision": decision or "operator_decides",
        "reason": reason,
        "approvalState": "REVIEW_ONLY_NOT_APPROVED",
    })

proposal_rows = []
conflicts = []
for row in sorted(proposals, key=lambda value: (value["proposedName"], value["status"], value["id"])):
    decision, reason = proposal_decision(row["proposedName"])
    linked = {}
    for link in materializations[row["id"]] + attachments[row["id"]]:
        linked[link["itemId"]] = item_by_id.get(link["itemId"])
    linked_ids = sorted(linked)
    linked_decisions = {
        ITEM_DECISIONS[item_id][0] for item_id in linked_ids if item_id in ITEM_DECISIONS
    }
    if linked_decisions and linked_decisions != {decision}:
        conflicts.append({
            "proposalId": row["id"],
            "proposalDecision": decision or "operator_decides",
            "linkedItemIds": linked_ids,
            "linkedItemDecisions": sorted(value or "operator_decides" for value in linked_decisions),
        })
    proposal_rows.append({
        "proposalId": row["id"],
        "status": row["status"],
        "proposedName": row["proposedName"],
        "resolvedName": row["resolvedName"],
        "currentCategoryId": LEGACY_ID,
        "materializations": sorted(materializations[row["id"]], key=lambda value: value["itemId"]),
        "attachments": sorted(attachments[row["id"]], key=lambda value: value["itemId"]),
        "linkedItemIds": linked_ids,
        "target": TARGETS.get(decision),
        "decision": decision or "operator_decides",
        "reason": reason,
        "approvalState": "REVIEW_ONLY_NOT_APPROVED",
    })

assert not conflicts, conflicts
assert sum(len(row["materializations"]) for row in proposal_rows) == 14
assert sum(len(row["attachments"]) for row in proposal_rows) == 14
item_counts = Counter(row["decision"] for row in item_rows)
proposal_counts = Counter(row["decision"] for row in proposal_rows)

ledger = {
    "status": "REVIEW_ONLY_NOT_APPROVED_NOT_EXECUTABLE",
    "tenant": {"id": TENANT_ID, "slug": "glamping-gril", "name": "Glamping Gril"},
    "source": {
        "path": "reports/okolica-production-baseline.json",
        "sha256": baseline_sha,
        "legacyCategory": {"id": LEGACY_ID, "key": "sights", "label": "Znamenitosti"},
    },
    "targets": TARGETS,
    "safety": {
        "databaseWrites": False,
        "applicationCodeChanges": False,
        "publication": False,
        "instruction": "Operator-decides rows remain in the legacy category and prevent its retirement.",
        "relationshipRule": "Every linked proposal uses the same decision as its materialized/attached item.",
    },
    "counts": {
        "items": {"total": len(item_rows), **dict(sorted(item_counts.items()))},
        "proposals": {"total": len(proposal_rows), **dict(sorted(proposal_counts.items()))},
        "proposalStatuses": dict(sorted(Counter(row["status"] for row in proposal_rows).items())),
        "activeMaterializations": sum(
            link["isActive"] for row in proposal_rows for link in row["materializations"]
        ),
        "attachments": sum(len(row["attachments"]) for row in proposal_rows),
        "classificationConflicts": len(conflicts),
    },
    "items": item_rows,
    "proposals": proposal_rows,
    "conflicts": conflicts,
}
canonical = json.dumps(ledger, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
ledger["mappingSha256"] = hashlib.sha256(canonical).hexdigest()
JSON_PATH.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + "\n")


def esc(value: object) -> str:
    return html.escape("" if value is None else str(value))


def target_label(row: dict) -> str:
    return row["target"]["label"] if row["target"] else "ODLOČI OPERATER"


item_table = "".join(
    "<tr><td>{}</td><td><code>{}</code></td><td>{}</td><td>{}</td></tr>".format(
        esc(row["title"]), esc(row["itemId"]), esc(target_label(row)), esc(row["reason"])
    )
    for row in item_rows
)
proposal_table = "".join(
    "<tr><td>{}</td><td>{}</td><td>{}</td><td><code>{}</code></td><td>{}</td><td>{}</td><td>{}</td></tr>".format(
        esc(row["proposedName"]), esc(row["resolvedName"] or "—"), esc(row["status"]),
        esc(row["proposalId"]), esc(", ".join(row["linkedItemIds"]) or "—"),
        esc(target_label(row)), esc(row["reason"])
    )
    for row in proposal_rows
)
document = f"""<!doctype html><html lang="sl"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Gril Znamenitosti — predlog razdelitve</title>
<style>
body{{font:14px/1.45 system-ui,sans-serif;color:#17352b;max-width:1500px;margin:35px auto;padding:0 22px}}
h1{{font-size:30px}} h2{{margin-top:38px;border-top:2px solid #227153;padding-top:14px}}
.warning{{background:#fff3cd;border:1px solid #e2bd55;padding:14px;font-weight:700}}
table{{width:100%;border-collapse:collapse;margin:14px 0;font-size:12px}}
td,th{{border:1px solid #d3ded9;padding:7px;text-align:left;vertical-align:top;overflow-wrap:anywhere}}
th{{background:#eaf4ee}} tr:nth-child(even){{background:#fafcfb}} code{{font-size:11px}}
</style><body>
<h1>Gril: Znamenitosti — predlog razdelitve</h1>
<p class="warning">SAMO ZA PREGLED. NI ODOBRENO, NI IZVEDENO IN NI IZVRŠLJIV PRODUKCIJSKI NAČRT.</p>
<p>Predlog uporablja samo zajeti naslov/opis in izrecno pravilo lastnika:
cerkev, muzej in spomeniška oziroma zgrajena dediščina → Kulturna dediščina;
slap, jama, jezero in gora oziroma jasen naravni pojav → Naravna dediščina.
Nejasni zapisi ostanejo nedotaknjeni v stari kategoriji.</p>
<p><b>Vnosi:</b> {len(item_rows)} skupaj; kulturna {item_counts["culture"]},
naravna {item_counts["nature"]}, odloči operater {item_counts["operator_decides"]}.
<b>Predlogi Kreatorja:</b> {len(proposal_rows)} skupaj; kulturna {proposal_counts["culture"]},
naravna {proposal_counts["nature"]}, odloči operater {proposal_counts["operator_decides"]}.
Povezave: 14 aktivnih materializacij in 14 priponk; konfliktov med povezanim vnosom
in predlogom: 0.</p>
<h2>14 vnosov</h2>
<table><thead><tr><th>Vnos</th><th>ID</th><th>Predlagani cilj</th><th>Razlog</th></tr></thead>
<tbody>{item_table}</tbody></table>
<h2>Vseh 63 predlogov Kreatorja</h2>
<p>Status se ne spreminja; tabela vključuje tudi zavrnjene in nadomeščene predloge.</p>
<table><thead><tr><th>Predlagano ime</th><th>Razrešeno ime</th><th>Status</th><th>ID predloga</th>
<th>Povezani vnosi</th><th>Predlagani cilj</th><th>Razlog</th></tr></thead>
<tbody>{proposal_table}</tbody></table>
<h2>Kontrolni odtisi</h2>
<p>Zajeto stanje SHA-256: <code>{baseline_sha}</code><br>
Predlog razvrstitve SHA-256: <code>{ledger["mappingSha256"]}</code></p>
<p>Stara kategorija se ne sme umakniti, dokler lastnik ne odloči o vseh vrsticah
»ODLOČI OPERATER« in dokler prihodnji izvajalnik ne preveri nespremenjenega izvornega stanja.</p>
</body></html>"""
HTML_PATH.write_text(document)
print(json.dumps({
    "json": str(JSON_PATH.relative_to(ROOT)),
    "html": str(HTML_PATH.relative_to(ROOT)),
    "baselineSha256": baseline_sha,
    "mappingSha256": ledger["mappingSha256"],
    "itemCounts": item_counts,
    "proposalCounts": proposal_counts,
}, ensure_ascii=False, default=dict))