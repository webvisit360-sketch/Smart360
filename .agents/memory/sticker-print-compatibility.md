---
name: Sticker print compatibility
description: Why the sticker signature gradient must be raster while QR and text remain vector.
---

Use an embedded lossless, fully opaque RGB gradient image at minimum 600 dpi for the Smart360 trak in sticker PDFs, not PDF shading. Explicitly define standard sRGB for image/page RGB and the output intent; exclude soft masks and transparency groups.

**Why:** The owner reported that Photoshop and some print RIPs fail to render PDF vector gradient shading. The raster-only revision also failed to print its color strip through Photoshop on a Brother DCP-T510W, while black printed. Do not infer that opacity or profiles were the proven cause, or claim the physical printer is fixed from software previews.

**How to apply:** Preserve the physical strip geometry and exact tour-export stops. Verify full sticker renders at 600 dpi with Poppler AND Ghostscript, retaining structure/image dumps. Supply opaque full-sticker sRGB PNG fallbacks for direct printing. Keep QR and text vector in PDFs; this exception is only for the gradient strip.