---
name: Smart360 photo pipeline
description: How tenant photos are stored/served (object storage, two widths) and idempotent seed conventions.
---

- Photos live in object storage at `media/<slug>/<620|1400>/<name>.jpg`; served via public API route `/api/storage/img/<slug>/<file>?w=620|1400` (frontend helper `imgSrc()` in `pages/guest/img.ts` appends `w`). Tiles/thumbs 620 q65, gallery/lightbox 1400 q75; sharp `.rotate()` for EXIF, never upscale, never store originals.
- **Why:** design package mandates two widths and server-side resize; browsers must share-cache these, so the route force-sets `Cache-Control: public … immutable` (template `downloadObject` would otherwise emit `private` because objects lack ACL metadata).
- First media row (position 0) IS the tile image — no separate tile field. Upload endpoint allocates position atomically inside the INSERT (subquery max+1) to avoid parallel-upload collisions.
- Seed `scripts/seed-melipu-photos.mjs` is idempotent (deletes+reinserts media per item); matches categories by `categories.key` (added column) falling back to label; sections got `image_url` for mediterran big cards. Two labels differ from slike.json (`Kultura`→`Kulturna dediščina`, `Narava`→`Naravna dediščina`) — keys are already backfilled, future seeds match on key.
- wifi/check/ice photos are intentional stand-ins — do not replace with stock.
