---
name: Living Guide decisions
description: Binding product and cutover decisions for the Smart360 guest-app rebuild.
---

The guest-app rebuild is reviewed in five parts. Stop after each part for staging review, verification evidence, and explicit approval before starting the next.

**Why:** The user approved this staged process to protect the live multi-tenant guest experience during a complete visual cutover.

**How to apply:** Finish and report one part at a time; do not begin the following part until the user accepts the current report.

The time themes use the guest device clock: Jutro 05:00–09:59, Dan 10:00–16:59, Večer 17:00–20:59, and Noč 21:00–04:59. The new system is scoped to `body[data-t]`; legacy `html[data-theme]` remains until cutover. Re-sync when the page becomes visible.

**Why:** Midnight through 04:59 being night is an explicit correction to the prototype.

**How to apply:** Treat these boundaries as binding in all Living Guide surfaces and tests.

Guest sign-in persists locally per tenant slug and does not introduce server-side guest authentication. Prices remain text, order flows never calculate totals, and orders show quantity plus the item's price text. Order capability defaults off.

**Why:** These choices preserve the current content model and avoid inventing numeric pricing or guest accounts.

**How to apply:** Do not add numeric price fields, aggregate amounts, or server guest-auth requirements while building Living Guide flows.

“New” notices are derived from publication time being under 72 hours, never stored. Event-specific UI activates only when event start data exists. Meli Pu starts with four configurable bottom tabs and no Program tab.

**Why:** The UI must reflect real content and avoid stored derived state or fabricated event/navigation features.

**How to apply:** Gate event templates on actual event dates, calculate notice freshness, and keep tab configuration tenant-driven.

Use the `guestUiMode` cutover flag with legacy as the default and a development-only Living Guide preview. Replace the admin cover preview before removing the legacy cover.

**Why:** The new guest shell must be introduced without breaking admin tools or live tenants.

**How to apply:** Keep new and legacy guest systems isolated until the final validated cutover.

Demo-only examples are allowed on the Living Guide tokens page. Parts 2–5 must never invent values in the real guest UI; if source data is missing, hide the dependent block.

**Why:** The guest guide must remain trustworthy and reflect only actual tenant content.

**How to apply:** Treat every real temperature, phone number, opening time, route fact, price, and similar value as optional source data; omit its UI when absent.

Every checkpoint report must include an exact development URL that was re-verified immediately before sending; derive its path from the registered artifact configuration, never from the artifact directory name.

**Why:** A guessed artifact-directory prefix produced a tenant-not-found URL even though the tenant and server were healthy.

**How to apply:** Run the complete 390 px checkpoint walk on the reported public URL, confirm the expected tenant API returns 200, and perform a final live reachability check just before reporting.

Living Guide language changes are stateful UI changes: they update the visible language and shareable `?lang=` value without a document navigation, while preserving the current route and scroll position.

**Why:** The legacy language helper performs a full `window.location.href` reload, which made the real mobile guide flash, remount, and lose the guest’s current screen.

**How to apply:** Keep the reload-based helper isolated to legacy themes. For Living Guide, retain the shell, update language state and URL history in place, keep prior same-tenant data during the language fetch, and verify the complete SL → EN → DE → IT → SL cycle on one scrolled detail page.

The Living Guide language picker belongs on the cover only; grid, explore, and detail screens must not add their own language trigger.

**Why:** The binding prototype and owner explicitly confirmed cover-only language placement.

**How to apply:** Preserve the cover picker and its in-place language behavior, but do not surface a separate language control after entering the guide.

Every checkpoint report must include a “DELIBERATELY ABSENT IN THIS CHECKPOINT” section that distinguishes later-stage screens, buttons, and templates from defects.

**Why:** Without an explicit absence list, the owner could not tell planned scope boundaries from broken or missing UI.

**How to apply:** Name each intentionally absent surface and its scheduled checkpoint; for generic placeholders, state which specialized treatment or destination is still pending.

Living Guide touch feedback is haptic and visual only: `navigator.vibrate(6)` plus press scale `.97`; never initialize or request WebAudio, and never expose a sound toggle.

**Why:** On a real iPhone the synthesized mechanical click sounded like a beep, so the owner removed audio from the binding specification.

**How to apply:** Guest and tokens surfaces share haptic-only tap feedback. Verification must prove the first tap requests a 6 ms vibration and makes zero audio API requests.

The development Meli Pu tenant is a read-mostly production-content copy; refresh production only through read-only export and write solely to development in one guarded transaction.

**Why:** Template work must use the full realistic tenant tree, while production must never be mutated and development-only category keys must survive refreshes.

**How to apply:** Snapshot dev first; compare per-category counts and content hashes; sync guest tenant fields, sections, categories, items, media metadata, translations, and plurals. Preserve category keys and operational tenant fields, then require exact post-sync hashes.

Single-photo detail heroes follow the image’s natural full-width aspect. If that natural height is at most 89% of the viewport, use the whole full-bleed image; above 89%, cap at 89% with a contained image and same-image side blur. Multi-photo galleries instead use one fixed height: the median of every slide’s natural full-width height, clamped to 45–89% of the viewport. Gallery slides use cover cropping with their stored focal point and no blur.

**Why:** The owner’s “blur only when the sheet would no longer be visible” criterion remains binding for single photos, but they explicitly superseded per-slide adaptive gallery heights because swiping must never move the sheet.

**How to apply:** Reserve single and gallery heights before image paint from payload dimensions. For even gallery counts, average the two middle natural heights. Keep the integer result within ceil(45vh)–floor(89vh), disable gallery height transitions, and preserve snap/dots/sheet layout. Missing dimensions stay hidden until all required measurements exist. No-photo ambient heroes and grid/list thumbnails remain unchanged.

PART 4 ordering scope is fixed: SUP, olive oil, scooter, boat with skipper, and boat transport are orderable; late checkout is not. The allowlist counts category concepts, so every item variant in those five categories is orderable, including textual “Po dogovoru” offers. Pickup is at the host unless authored item text explicitly promises delivery. Skip the help/emergency ordering link.

**Why:** These are explicit launch decisions recorded before ordering implementation, and delivery or late-checkout promises must never be invented.

**How to apply:** Apply the allowlist to all rows in each approved category rather than choosing one representative variant; keep prices textual with no calculated totals, derive any delivery promise only from item text, and do not begin PART 4 before the Batch 4 owner review gate passes.

The development Meli Pu order recipient may use a staging placeholder, but PART 5 cutover is blocked until the owner replaces it with Meli Pu's real address through the tenant admin. The tenant recipient must never be hardcoded.

**Why:** A staging delivery address is suitable for controlled verification but must not receive real post-cutover tenant orders.

**How to apply:** Keep the staging value in tenant data only, make recipient replacement an explicit pre-publish checklist item, and require owner confirmation before sending any test to the real tenant address.

Browser machine translation is disabled for the guest app; Smart360’s own SL, EN, DE, and IT content is the only supported translation path.

**Why:** The owner explicitly prohibited browser translation after it produced mixed languages, invented labels, and a runtime stack-overflow incident while mutating guest DOM.

**How to apply:** Preserve document- and guest-root-level `notranslate` protection. Any observer-driven measurement must coalesce callbacks, avoid same-value state writes, and remain stable when extensions mutate text nodes.

Living Guide orders may use an optional host-managed tenant password, stored separately from Wi-Fi data. Raw values are write-only outside the server; guest/admin reads expose only whether one is configured. Matching trims both sides but remains case-sensitive. A successful password-protected order remembers the accepted value in slug-scoped browser storage; canonical idempotent retries keep their original outcome.

**Why:** The owner chose a simple manually shared gate and explicitly rejected Wi-Fi copying, GPS checks, daily PINs, and per-unit codes. They also required silent same-device prefill despite the normal sensitivity of browser storage.

**How to apply:** Never return, log, e-mail, clone, or store the password with an order. Apply rate limiting before rejecting a genuinely new intent, allow password-free ordering when unset, and reset the password to empty on tenant/template duplication.

PART 5 production content sync requires a separately approved row-level ledger and may touch only the listed category keys, order flags, media dimensions, and media links. Operational history, auth data, dev-only tenants, and storage objects are excluded.

**Why:** Production legitimately trails owner-edited development content, but a whole-database copy would overwrite live renewal, changelog, and authentication history.

**How to apply:** Recheck every old value and content hash before one atomic, allowlisted sync; abort on drift. Keep legacy image files in storage, avoid ordinary admin routes that add changelog rows, and re-lock any temporary production sync path immediately after verification.