---
name: Sticker print compatibility
description: Why the sticker signature gradient must be raster while QR and text remain vector.
---

Use an embedded lossless RGB gradient image at minimum 600 dpi for the Smart360 trak in sticker PDFs, not PDF shading.

**Why:** The owner reported that Photoshop and some print RIPs fail to render PDF vector gradient shading. A successful preview in one renderer is not sufficient print evidence.

**How to apply:** Preserve the physical strip geometry and exact tour-export stops. Verify full sticker renders with two independent PDF engines. Keep QR and text vector; this exception is only for the gradient strip.