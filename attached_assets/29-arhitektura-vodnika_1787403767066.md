# INSTRUCTION #29 — Guide architecture v2 (cover, Domov, Sporočila, Zemljevid)

Binding reference: the UPDATED `prototip-2030.html`, delivered with this
instruction. Replace your reference copy first. The prototype wins over this
text, as always (single exception remains the C1 night-hours rule).

Why this exists: the guide is currently organised around CONTENT (a grid of
categories). It must be organised around TIME and ACTION — what is happening
now, what the guest needs in the next minute. This was learned from a
competitor guide built on years of real camp operation, and it is the single
biggest gap in our product.

Deliver in gated checkpoints, one report each, and WAIT for approval between
them. Established format: re-verified public URL, build id, per-item
verification, DELIBERATELY ABSENT section. Production DB read-only except
where a checkpoint explicitly says otherwise. Never invent content.

---

## CHECKPOINT 1 — Cover: virtual tour or photo

1. The cover is a FULL-BLEED stage: the tour/photo fills the screen edge to
   edge. No border, no inset, no shadow frame — the owner rejected all three
   explicitly.
2. When the tenant has a virtual tour configured, an iframe fills the stage:
   `allow="xr-spatial-tracking; gyroscope; accelerometer; fullscreen"`,
   `allowfullscreen`, `scrolling="no"`. Otherwise the tenant's hero photo.
3. **Nothing of ours may sit in the top region.** Third-party tours draw the
   host's logo top-left and their own controls top-right. Our elements live
   only at the bottom: the tenant name block above, and one row containing
   search (fab), "Odpri vodnik" (flex) and the language chip — exactly as in
   the prototype (`.cbar`).
4. **Pointer discipline**: every overlay is `pointer-events:none` except the
   three controls themselves, so drag/gyro gestures reach the tour. Verify by
   dragging over the name block and confirming the panorama rotates.
5. The sign-in sheet must NOT open automatically on load. The cover stays
   open until the guest presses "Odpri vodnik"; the sheet rises then, and
   only on first use. Afterwards the button goes straight to Domov.
6. The cover remains reachable later from the Domov quick button "360° ogled".

### Admin field (this checkpoint includes admin work)

The host must be able to put EITHER a normal photo OR a virtual tour on the
cover, from Kuula or any other platform.

- One field, "Virtualni sprehod", accepting a paste of ANY of: a full
  `<iframe …>` snippet, a `<script … data-*>` embed snippet, or a plain URL.
- The server EXTRACTS the target URL from the paste and stores only that URL.
  **Never store or render pasted third-party HTML verbatim** — that would be
  an XSS hole. We always render our own iframe around the extracted URL.
- Validate the extracted URL against an allowlist of known providers
  (kuula.co, matterport.com, momento360.com, google.com/maps/embed,
  youtube.com/embed, vimeo.com, plus any the owner adds later). Anything else
  is rejected with a plain message naming what is allowed.
- Enforce https. Strip credentials, and reject javascript:/data: schemes.
- Show a live preview in the admin, and a clear note that the tour's own logo
  and buttons are controlled in that provider's settings, not here.
- If both a photo and a tour exist, the tour wins on the cover; the photo
  stays as the fallback and is used wherever a cover image is needed
  (previews, cards).

Verify: paste each of the three input shapes for the same Kuula collection
and show all three resolve to the same stored URL; paste a hostile snippet
(e.g. `<iframe src="javascript:alert(1)">` and an unknown domain) and show
both are rejected; screenshots of the cover with a tour and with a photo.

## CHECKPOINT 2 — Domov: a real home screen

Today "Domov" in the bottom bar returns to the cover. That is wrong: there is
no home. Build `v-home` per the prototype:

1. Greeting strip with the guest's unit (as today, shared with the grid).
2. **Quick buttons**, per-tenant configurable, defaulting to: WiFi, 360°
   ogled, Obvestila (with a live dot when unread), Sporočila, Zemljevid.
   A button whose feature the tenant does not have is not rendered.
3. **"Danes"** — a horizontal, snapping row of what is happening now:
   - events starting in the next hours ("čez 40 minut"),
   - facilities with live status ("odprto še 2 h"),
   - notices published in the last 72 h ("novo").
   Sorted by immediacy. If the tenant has no events, the row falls back to
   notices and featured offers. If there is nothing at all, the whole
   section is hidden — never an empty frame.
4. **"Za vas"** — offers, surroundings, accommodation entry cards.
5. The quiet "Pomoč in nujni primeri" link at the bottom.
6. Search (magnifier) in the Domov header, filtering item and category
   titles in the current language.

Verify: Domov for a tenant WITH events and for Meli Pu (no events) —
screenshots of both, proving the fallback and that nothing renders empty.

## CHECKPOINT 3 — Sporočila (guest ↔ host)

1. Guest writes a message from the guide; the host answers from the portal.
   Not a full chat product: one thread per device per tenant, newest last.
2. Host notification follows the ORDER rule exactly: e-mail is only a bell
   ("new message — open your portal"), with a per-tenant toggle; all work
   happens in the portal.
3. Device-scoped like orders (no login for guests), 90-day deletion, rate
   limiting, no personal data beyond what the guest types.
4. Localised SL/EN/DE/IT. Empty state is a friendly line, never "Brez
   rezultatov".

Verify: a real message round trip on staging with screenshots from both
sides, plus the retention and rate-limit proofs in the established form.

## CHECKPOINT 4 — Zemljevid objekta + configurable bottom bar

1. **Zemljevid**: the host uploads one or more site-plan images (camp layout,
   floor plans, walking/biking maps). Guest view: pinch-zoom and pan, with a
   caption per image. Hidden entirely when the tenant has none.
2. **Bottom bar**: five slots, configured per tenant from the candidates
   Domov · Nastanitev · Ponudba · Okolica · Program · Sporočila. Domov is
   always slot 1. Report the resulting default for a camp-type tenant and for
   Meli Pu, and let the owner change them in the admin.

Verify: screenshots of the map viewer and of two tenants with different bars.

---

## Standing rules

- Design stays inside the established CGP: existing tokens, type scale,
  glass controls, rounded geometry. Do not introduce new colours, new fonts
  or new component shapes — the owner will reject anything that drifts.
- Whole images, never cropped or blurred, per the 89% hero rule.
- Re-verify the public URL immediately before every report; include build id.
- Anything not done is reported as NOT DONE with the reason.

## DELIBERATELY ABSENT

- Push notifications, WhatsApp/Telegram — deferred by owner decision.
- Automatic distances — later phase, free services only.
- Tenant self-service accounts and the host portal rebuild — instruction #28,
  which follows this one.
