---
name: Creator Wikimedia photos
description: External API and matching constraints learned while validating Creator Commons discovery.
---

Commons imageinfo can return originals from `upload.wikimedia.org` but generated thumbnails from `thumb.wikimedia.org`; both are Wikimedia-owned, but only originals may be downloaded for approval.

**Why:** A strict original-host allowlist rejected a valid Logarska dolina P18 candidate because its thumbnail used Wikimedia's separate thumbnail host.

**How to apply:** Keep original downloads restricted to `upload.wikimedia.org`; allow `thumb.wikimedia.org` only for operator proposal previews. Never follow redirects.

Commons filenames can translate generic feature words while preserving the distinctive proper name, such as “Slap Rinka” versus “Rinka Waterfall”.

**Why:** Exact whole-name matching missed a valid nearby Rinka file even though the proper-name token and geofence matched.

**How to apply:** For low-confidence geosearch only, ignore a small multilingual set of generic feature words and require every remaining distinctive token inside the strict radius. Wikidata P18 remains the high-confidence path.