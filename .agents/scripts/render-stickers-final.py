import fitz
import json
from pathlib import Path

root = Path("reports/stickers-final")
checks = []
for source in sorted(root.glob("*.pdf")):
    doc = fitz.open(source)
    page = doc[0]
    large = source.stem.endswith("-large")
    expected = (72.5, 110) if large else (36.3, 55)
    actual = [v * 25.4 / 72 for v in (page.rect.width, page.rect.height)]
    assert all(abs(a-b) < 0.001 for a,b in zip(actual,expected)), (source, actual)
    assert len(doc) == 1 and not page.get_images()
    page.get_pixmap(dpi=150).save(root / (source.stem + "-inspection.png"))
    spans = [span for block in page.get_text("dict")["blocks"] if "lines" in block for line in block["lines"] for span in line["spans"]]
    for span in spans:
        x0,y0,x1,y1 = span["bbox"]
        assert x0 >= 0 and y0 >= 0 and x1 <= page.rect.width and y1 <= page.rect.height, (source, span)
    checks.append({"file":source.name,"mediaBoxMm":actual,"imageCount":len(page.get_images()),"vectorDrawingCount":len(page.get_drawings()),"spans":spans})
(root / "geometry-verification.json").write_text(json.dumps(checks,ensure_ascii=False,indent=2))
print("PASS:", len(checks), "PDFs, exact trim, no raster images, all text within page.")