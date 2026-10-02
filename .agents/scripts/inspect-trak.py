import fitz
import json
from pathlib import Path

source = Path("reports/trak-signature")
if not source.exists():
    source = Path("reports/stickers-final")
output = Path("reports/trak-signature")
output.mkdir(parents=True, exist_ok=True)
checks = []
for size in ("large", "small"):
    with fitz.open(source / f"turizem-drobez-{size}.pdf") as pdf:
        page = pdf[0]
        page.get_pixmap(dpi=96).save(output / f"turizem-drobez-{size}-inspection.png")
        with fitz.open(Path("reports/stickers-final") / f"turizem-drobez-{size}.pdf") as previous:
            def text_geometry(p):
                return [block["lines"] for block in p.get_text("dict")["blocks"] if block["type"] == 0]
            assert text_geometry(page) == text_geometry(previous[0]), "Text geometry changed"
            old_paths = previous[0].get_drawings()
            # Previous grey hairline is the last filled vector path.
            assert len(old_paths) == 4
            assert page.get_drawings() == old_paths[:-1], "Background/QR geometry changed"
        checks.append({"size": size, "pagePoints": list(page.rect), "embeddedImages": len(page.get_images()),
                       "textGeometryUnchanged": True, "qrAndBackgroundPathsUnchanged": True})
        print(size, list(page.rect), "images", len(page.get_images()))
(output / "geometry-verification.json").write_text(json.dumps(checks, indent=2))