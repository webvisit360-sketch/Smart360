---
name: Archivo print weights
description: Verify font metadata rather than filenames when embedding print typography.
---

Do not treat a generically named Archivo TTF as regular weight. The project's legacy `Archivo.ttf` identifies itself as SemiBold (600); muted, non-bold print copy needs a verified medium or regular instance.

**Why:** Font inspection during the two-size sticker work exposed this mismatch; silently using the legacy file would make the owner's explicitly non-bold slogan semibold.

**How to apply:** Check the actual font weight metadata for any new PDF typography. Generate static instances from the official Archivo variable font when needed, retaining its OFL license.