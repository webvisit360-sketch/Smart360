"""Apply reviewed language corrections and audit immutable source formatting."""
import json
import re
from pathlib import Path

root=Path(__file__).resolve().parents[3]
data=root/".local/legacy-rollout"
units=json.loads((data/"units.json").read_text())
corrections=[]
for u in units:
    p=data/"translated"/(u["id"]+".json")
    tr=json.loads(p.read_text())
    old=tr.copy()
    if u["field"]=="label" and u["text"]=="Vaše mesto":
        # Verified category key=pitch, section=stay: not a city.
        tr.update(en="Your pitch",de="Ihr Stellplatz",it="La vostra piazzola")
    if u["field"]=="title" and u["text"]=="A-frame":
        tr.update(en="A-frame",de="A-frame",it="A-frame")
    if "Kako do nas" in u["text"]:
        # Keep the Slovenian place names, in their nominative forms, not exonyms.
        for lang in ["en","de","it"]:
            for a,b in [("Izoli","Izola"),("Šaredom","Šared"),("Malijo","Malija"),("Malo Sevo","Mala Seva")]:
                tr[lang]=tr[lang].replace(a,b)
    if "Bernardinu" in u["text"]:
        for lang in ["en","de","it"]:tr[lang]=tr[lang].replace("Bernardinu","Bernardin")
    if "Meli Pu Ice Cream" in u["text"]:
        tr["en"]=tr["en"].replace("at midnight","after midnight")
        tr["de"]=tr["de"].replace("um Mitternacht","nach Mitternacht")
        tr["it"]=tr["it"].replace("a mezzanotte","dopo mezzanotte").replace("24 ore su 24","24 ore al giorno")
    if u["text"]=="Mir in gozdovi visoko nad Savinjsko dolino":
        tr.update(en="Peace and forests high above Savinjska dolina",
                  de="Ruhe und Wälder hoch über Savinjska dolina",
                  it="Pace e boschi in alto sopra Savinjska dolina")
    if old!=tr:
        corrections.append({"unit":u["id"],"field":u["field"]})
        p.write_text(json.dumps(tr,ensure_ascii=False))

pattern=r"<[^>]*>|\r\n|\n|\r|https?://[^\s<>]+|&(?:#\d+|#x[\da-f]+|\w+);|\{\{[^}]+\}\}|\$\{[^}]+\}|\{[A-Za-z_][\w.]*\}"
for u in units:
    tr=json.loads((data/"translated"/(u["id"]+".json")).read_text())
    for lang in ["en","de","it"]:
        text=tr[lang]
        assert text.strip(), (u["id"],lang,"empty")
        assert re.findall(pattern,text,re.I)==re.findall(pattern,u["text"],re.I),(u["id"],lang,"format")
        assert re.findall(r"\d+(?:[.,]\d+)?",text)==re.findall(r"\d+(?:[.,]\d+)?",u["text"]),(u["id"],lang,"numbers")
        assert not re.search(r"[\u0400-\u052f\u0530-\u058f\u4e00-\u9fff]",text),(u["id"],lang,"script")
        if u["field"] in ["name","address"]:assert text==u["text"],(u["id"],lang,"name/address")
        if "Password:" in u["text"]:
            # Guest Wi-Fi values must stay verbatim; never log their contents.
            values=re.findall(r": ([^<]+)</p>",u["text"])
            assert all(v in text for v in values),(u["id"],lang,"wifi value")
audit={"units":len(units),"languages":["en","de","it"],"formatting":"passed","numbers":"passed",
       "namesAndAddresses":"passed","wifiValues":"passed","nonLatinScript":"passed",
       "reviewedCorrections":corrections,"humanProfessionalReview":False}
(data/"format-audit.json").write_text(json.dumps(audit,indent=2))
print(json.dumps({k:v for k,v in audit.items() if k!="reviewedCorrections"}))