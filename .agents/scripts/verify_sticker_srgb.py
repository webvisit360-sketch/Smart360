"""Actual Poppler and Ghostscript 600 dpi evidence; no PDF rewriting."""
from pathlib import Path
import subprocess, re, json, hashlib, html, base64
import fitz
from PIL import Image, ImageCms

root = Path(__file__).resolve().parents[2]
out = root / "reports/stickers-srgb"
icc = (root / "artifacts/api-server/assets/sRGB_IEC61966_2_1.icc").read_bytes()
results = {"engines": {
    "poppler": subprocess.run(["pdftoppm", "-v"], capture_output=True, text=True).stderr.strip(),
    "ghostscript": subprocess.check_output(["gs", "--version"], text=True).strip()
}, "stickers": []}
stops = [(0, (232,134,46)), (.30,(47,114,196)), (.55,(62,158,78)), (.80,(245,198,46)), (1,(232,134,46))]
for size, dims, strip in [("large",(72.5,110),(5.5,94.5,61.5,1.2)), ("small",(36.3,55),(2.8,48,30.7,.7))]:
    base = out / f"turizem-drobez-{size}"
    pdf = base.with_suffix(".pdf")
    doc = fitz.open(pdf)
    objects = "\n".join(f"{x} 0 obj\n{doc.xref_object(x)}\nendobj" for x in range(1,doc.xref_length()))
    base.with_suffix(".structure.txt").write_text(objects)
    image_list = subprocess.check_output(["pdfimages","-list",str(pdf)], text=True)
    base.with_suffix(".pdfimages.txt").write_text(image_list)
    assert not re.search(r"/(SMask|Mask|Group|Transparency|DeviceN|Shading)\b", objects)
    assert "/OutputIntents" in objects and "/DefaultRGB" in objects and "/ICCBased" in objects
    images = doc[0].get_images()
    assert len(images) == 1 and images[0][1] == 0 and images[0][5] == "DeviceRGB"
    profiles = [doc.xref_stream(x) for x in range(1,doc.xref_length()) if re.search(r"/N\s+3\b", doc.xref_object(x))]
    assert profiles == [icc], "DefaultRGB and output intent must share exact standard profile"
    actual_dims = [doc[0].rect.width*25.4/72,doc[0].rect.height*25.4/72]
    assert max(abs(a-b) for a,b in zip(actual_dims,dims)) < .001
    # Compare placement, typography and QR geometry with previous owner PDF.
    previous = fitz.open(root / f"reports/stickers-print-robust/turizem-drobez-{size}.pdf")
    def spans(d):
        return [(s["text"],s["size"],s["font"],s["color"],s["bbox"]) for b in d[0].get_text("dict")["blocks"] if b["type"]==0 for l in b["lines"] for s in l["spans"]]
    assert spans(doc) == spans(previous)
    assert doc[0].get_image_rects(images[0][0]) == previous[0].get_image_rects(previous[0].get_images()[0][0])
    assert doc[0].get_drawings() == previous[0].get_drawings()
    poppler = Path(str(base)+"-poppler-600dpi.png")
    ghost = Path(str(base)+"-ghostscript-600dpi.png")
    subprocess.run(["pdftoppm","-r","600","-singlefile","-png",str(pdf),str(poppler)[:-4]],check=True)
    subprocess.run(["gs","-dSAFER","-dBATCH","-dNOPAUSE","-sDEVICE=png16m","-r600",
                    "-dTextAlphaBits=4","-dGraphicsAlphaBits=4",
                    f"-sOutputFile={ghost}",str(pdf)],check=True,stdout=subprocess.DEVNULL)
    checks = {}
    for engine, image_path in [("Poppler",poppler),("Ghostscript",ghost)]:
        im = Image.open(image_path).convert("RGB")
        x,y,w,h = [v*600/25.4 for v in strip]
        samples=[]
        for at,rgb in stops:
            px=max(round(x)+1,min(round(x+w)-2,round(x+at*w)))
            got=im.getpixel((px,round(y+h/2)))
            assert max(abs(a-b) for a,b in zip(got,rgb)) <= 5, (engine,size,at,got,rgb)
            samples.append({"at":at,"rgb":got})
        for px in range(round(x)+1,round(x+w)-1):
            rgb=im.getpixel((px,round(y+h/2)))
            # Orange→blue crosses near-neutral RGB; low saturation is valid.
            at=(px-x)/w
            right=next(i for i in range(1,len(stops)) if at<=stops[i][0])
            a,ca=stops[right-1]; b,cb=stops[right]
            expected=[round(ca[c]+(cb[c]-ca[c])*(at-a)/(b-a)) for c in range(3)]
            assert max(abs(v-e) for v,e in zip(rgb,expected))<=5, (engine,"strip mismatch",px,rgb,expected)
        checks[engine]={"pixels":im.size,"strip_samples":samples,"continuous_strip":True}
    fallback = Path(str(base)+"-PRINT-600dpi.png")
    # Completely opaque, white-paper full-page raster; tag the preserved sRGB values.
    Image.open(poppler).convert("RGB").save(fallback,icc_profile=icc,dpi=(600,600))
    final=Image.open(fallback)
    assert final.mode=="RGB" and final.info["icc_profile"]==icc and "transparency" not in final.info
    results["stickers"].append({"size":size,"page_mm":actual_dims,"strip_mm":strip,"image":images[0],
        "no_masks_groups_transparency":True,"standard_srgb_profile_sha256":hashlib.sha256(icc).hexdigest(),
        "unchanged_text_qr_geometry":True,"renderers":checks,"fallback":fallback.name})
out.joinpath("verification.json").write_text(json.dumps(results,indent=2))
report = ['<!doctype html><html lang="sl"><meta charset="utf-8"><title>Nalepki — sRGB in dokazila za tisk</title><style>body{font:16px system-ui;margin:32px;color:#121a14}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f4f6f2;padding:16px}img{max-width:100%;height:auto}h2{margin-top:40px}</style><h1>Nalepki — dokazila za tisk</h1><p>Turizem Drobež. Poppler in Ghostscript, oba pri 600 dpi. PNG PRINT je neprosojen RGB z vdelanim standardnim sRGB-profilom in ločljivostjo 600 dpi. Fizičen tisk na Brotherju ni preverjen.</p>',
          "<h2>Rezultati</h2><pre>"+html.escape(json.dumps(results,indent=2))+"</pre>"]
for size in ("large","small"):
    for engine in ("poppler","ghostscript"):
        p=out/f"turizem-drobez-{size}-{engine}-600dpi.png"
        report.append(f'<h2>{size} — {engine} — 600 dpi</h2><p>Spodnji prikaz je pomanjšan za zaslon; vdelan je celoten 600-dpi izris.</p><img src="data:image/png;base64,{base64.b64encode(p.read_bytes()).decode()}">')
    for suffix in ("pdfimages.txt","structure.txt"):
        report.append(f"<details><summary>{size} — {suffix}</summary><pre>"+html.escape((out/f"turizem-drobez-{size}.{suffix}").read_text())+"</pre></details>")
out.joinpath("dokazila.html").write_text("\n".join(report)+"</html>")
print(json.dumps(results,indent=2))