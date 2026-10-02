"""Read-only independent PDF evidence: Poppler and MuPDF, both at 600 dpi."""
import hashlib
import json
import math
import re
import subprocess
import time
from pathlib import Path

import fitz

ROOT = Path("/home/runner/workspace")
OUT = ROOT / "reports/stickers-print-robust"
DPI = 600
SCALE = DPI / 72
MM = DPI / 25.4
STOPS = [(0, (232, 134, 46)), (.30, (47, 114, 196)),
         (.55, (62, 158, 78)), (.80, (245, 198, 46)), (1, (232, 134, 46))]


def ready():
    for size in ("large", "small"):
        p = OUT / f"turizem-drobez-{size}.pdf"
        if not p.exists():
            return False
        try:
            with fitz.open(p) as doc:
                if len(doc) != 1 or len(doc[0].get_images()) != 1:
                    return False
                if any("/ShadingType" in doc.xref_object(x) for x in range(1, doc.xref_length())):
                    return False
        except Exception:
            return False
    return True


def pixel(pix, x, y):
    return tuple(pix.pixel(x, y)[:3])


def colored(rgb):
    # Orange→blue interpolation legitimately crosses low-saturation colors.
    # Test pigment/nonwhite coverage, not saturation.
    return min(rgb) < 240


def inspect_pixels(path, geometry):
    pix = fitz.Pixmap(str(path))
    x0, y0, width, height = geometry
    center_x = round((x0 + width / 2) * MM)
    rows = [y for y in range(max(0, int(y0 * MM) - 5), min(pix.height, int((y0 + height) * MM) + 6))
            if colored(pixel(pix, center_x, y))]
    mid_y = round((y0 + height / 2) * MM)
    columns = [x for x in range(pix.width) if colored(pixel(pix, x, mid_y))]
    assert rows and columns, f"Missing strip pixels in {path}"
    samples = []
    for fraction, expected in STOPS:
        x = min(columns[-1] - 1, max(columns[0] + 1, round((x0 + width * fraction) * MM)))
        actual = pixel(pix, x, mid_y)
        error = max(abs(a - b) for a, b in zip(actual, expected))
        samples.append({"stop": fraction, "pixel": [x, mid_y], "expected_rgb": expected,
                        "actual_rgb": actual, "max_channel_error": error, "pass": error <= 5})
    # Every column through the strip midline must be visibly colored.
    full_width = all(colored(pixel(pix, x, mid_y)) for x in range(columns[0], columns[-1] + 1))
    bbox = [columns[0], rows[0], columns[-1] + 1, rows[-1] + 1]
    expected_bbox = [x0 * MM, y0 * MM, (x0 + width) * MM, (y0 + height) * MM]
    delta = [a - b for a, b in zip(bbox, expected_bbox)]
    return {"png": str(path), "dimensions_px": [pix.width, pix.height],
            "strip_pixel_bbox_exclusive": bbox, "expected_prior_geometry_bbox_px": expected_bbox,
            "edge_delta_px": delta, "strip_height_px": len(rows),
            "strip_width_px": len(columns), "continuous_full_rule_width": full_width,
            "stop_samples": samples,
            "pass": full_width and max(map(abs, delta)) <= 1.5 and all(s["pass"] for s in samples)}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    deadline = time.monotonic() + 240
    while not ready():
        if time.monotonic() >= deadline:
            raise RuntimeError("Final raster-strip PDFs are not ready; old/shading PDFs were NOT verified.")
        time.sleep(3)
    versions = {"poppler": subprocess.run(["pdftoppm", "-v"], capture_output=True, text=True).stderr.splitlines()[0],
                "mupdf": fitz.__doc__.strip(), "python_binding": fitz.VersionBind}
    results = {"dpi": DPI, "independent_engines": versions, "files": {}}
    for size in ("large", "small"):
        pdf = OUT / f"turizem-drobez-{size}.pdf"
        before = hashlib.sha256(pdf.read_bytes()).hexdigest()
        doc = fitz.open(pdf)
        page = doc[0]
        geometry = (5.5, 94.5, 61.5, 1.2) if size == "large" else (2.8, 48, 30.7, .7)
        mupdf = OUT / f"turizem-drobez-{size}-mupdf-600dpi.png"
        poppler = OUT / f"turizem-drobez-{size}-poppler-600dpi.png"
        page.get_pixmap(dpi=DPI, colorspace=fitz.csRGB, alpha=False).save(mupdf)
        subprocess.run(["pdftoppm", "-r", str(DPI), "-png", "-singlefile", str(pdf), str(poppler.with_suffix(""))], check=True)
        image = page.get_images(full=True)[0]
        image_rect = page.get_image_rects(image[0])[0]
        all_objects = "\n".join(doc.xref_object(x) for x in range(1, doc.xref_length()))
        shadings = len(re.findall(r"/ShadingType\b", all_objects))
        streams = b"\n".join(doc.xref_stream(x) for x in page.get_contents())
        shading_operators = bool(re.search(rb"(?<!\S)sh(?!\S)", streams))
        text = [{"text": span["text"], "rgb_hex": f'{span["color"]:06X}', "bbox_pt": span["bbox"]}
                for block in page.get_text("dict")["blocks"] if block["type"] == 0
                for line in block["lines"] for span in line["spans"]]
        text_pass = bool(text) and all(s["rgb_hex"] == "121A14" for s in text)
        bounds_pass = all(page.rect.contains(fitz.Rect(s["bbox_pt"])) for s in text)
        expected_dims = [math.ceil(geometry[2] * MM), math.ceil(geometry[3] * MM)]
        image_pass = image[5] == "DeviceRGB" and image[4] == 8 and image[1] == 0 and list(image[2:4]) == expected_dims
        actual_geometry = [image_rect.x0 / (72 / 25.4), image_rect.y0 / (72 / 25.4),
                           image_rect.width / (72 / 25.4), image_rect.height / (72 / 25.4)]
        geometry_pass = max(abs(a - b) for a, b in zip(actual_geometry, geometry)) < .001
        prior = ROOT / f"reports/stickers-final/turizem-drobez-{size}.pdf"
        prior_doc = fitz.open(prior)
        prior_shades = [{"kind": kind, "bbox_pt": list(bbox)} for kind, bbox in prior_doc[0].get_bboxlog() if "shade" in kind]
        archived_rules = [list(bbox) for kind, bbox in prior_doc[0].get_bboxlog()
                          if kind == "fill-path" and abs(bbox[1] - geometry[1] * 72 / 25.4) < .01]
        engines = {"MuPDF": inspect_pixels(mupdf, geometry), "Poppler": inspect_pixels(poppler, geometry)}
        assert before == hashlib.sha256(pdf.read_bytes()).hexdigest(), "PDF changed during verification"
        item = {"pdf": str(pdf), "sha256": before, "pages": len(doc), "page_size_pt": list(page.rect),
                "archived_older_pre_gradient_pdf": str(prior), "archived_shading_bounds": prior_shades,
                "archived_older_rule_bbox_pt": archived_rules,
                "comparison_baseline": "Immediate pre-change guideStickers.ts read by verifier: inset 5.5/2.8mm; ruleY 94.5/48mm; height 1.2/0.7mm; width 61.5/30.7mm. Archived stickers-final predates that gradient and has thinner 0.3/0.15mm rules.",
                "raster_resolution_policy": "ceil(mm / 25.4 * 600) in each dimension: at least 600dpi; actual effective DPI disclosed",
                "prior_rule_geometry_mm_xywh": geometry, "actual_image_geometry_mm_xywh": actual_geometry,
                "geometry_unchanged": geometry_pass, "shading_objects": shadings,
                "shading_paint_operator": shading_operators, "image_count": len(page.get_images(full=True)),
                "image_rgb_8bit_no_smask_600dpi_pass": image_pass, "image_dimensions_px": list(image[2:4]),
                "image_effective_dpi": [image[2] / image_rect.width * 72, image[3] / image_rect.height * 72],
                "text": text, "all_text_121A14": text_pass, "all_text_boxes_inside_page": bounds_pass,
                "renders": engines}
        item["pass"] = image_pass and geometry_pass and not shadings and not shading_operators and text_pass and bounds_pass and all(e["pass"] for e in engines.values())
        results["files"][size] = item
    results["pass"] = all(v["pass"] for v in results["files"].values())
    output = OUT / "independent-verification.json"
    output.write_text(json.dumps(results, indent=2) + "\n")
    print(json.dumps({"report": str(output), "pass": results["pass"], "engines": versions}, indent=2))
    if not results["pass"]:
        raise RuntimeError("Verification failed; inspect evidence JSON")


if __name__ == "__main__":
    main()