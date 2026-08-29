---
name: Living Guide decisions
description: Binding product and cutover decisions for the Smart360 guest-app rebuild.
---

The guest-app rebuild is reviewed in five parts. Stop after each part for staging review, verification evidence, and explicit approval before starting the next.

**Why:** The user approved this staged process to protect the live multi-tenant guest experience during a complete visual cutover.

**How to apply:** Finish and report one part at a time; do not begin the following part until the user accepts the current report.

Architecture #29 uses the newest attached virtual-tour prototype as the binding visual source when it conflicts with the accompanying architecture note. Its first checkpoint is limited to the cover and safe admin tour input; later home, card, and detail work remains gated.

**Why:** The owner explicitly prioritized the latest prototype and requested a report-and-stop checkpoint before broader Living Guide changes.

**How to apply:** Preserve the full-bleed, bottom-control-only cover contract and do not fold later checkpoint layouts into the initial virtual-tour work without approval.

The Architecture #29 bottom navigation has exactly five tenant-configured slots selected from Domov, Nastanitev, Ponudba, Okolica, Program, and Sporočila; Domov is permanently slot one. Camp defaults omit Ponudba, while Meli Pu defaults omit Program because it has no dated events.

**Why:** The owner requires predictable tenant-specific navigation without making a valid guide feature disappear when it is not one of the five primary slots.

**How to apply:** In the later bottom-navigation checkpoint, offer only features the tenant actually has, keep Domov first, and provide a visible in-guide route to the omitted valid feature. The checkpoint report must name that route for both defaults and include a screenshot of each entry point.

Virtual tours reuse the tenant’s canonical `tourUrl` field. Accept only a canonical HTTPS URL from approved providers; extract it server-side from plain URLs, iframe `src`, or script `data-*` values, and never persist or render pasted markup.

**Why:** The field is shared across guest modes, so malformed or historic markup must not become an iframe or outbound link in either mode.

**How to apply:** Keep server validation authoritative, mirror it defensively on every client render and preview, require exact embed path segments for path-restricted providers, and preserve the allowlist tests when modifying supported services.

The time themes use the guest device clock: Jutro 05:00–09:59, Dan 10:00–16:59, Večer 17:00–20:59, and Noč 21:00–04:59. The new system is scoped to `body[data-t]`; legacy `html[data-theme]` remains until cutover. Re-sync when the page becomes visible.

**Why:** Midnight through 04:59 being night is an explicit correction to the prototype.

**How to apply:** Treat these boundaries as binding in all Living Guide surfaces and tests.

Guest sign-in persists locally per tenant slug and does not introduce server-side guest authentication. Prices remain text, order flows never calculate totals, and orders show quantity plus the item's price text. Order capability defaults off.

**Why:** These choices preserve the current content model and avoid inventing numeric pricing or guest accounts.

**How to apply:** Do not add numeric price fields, aggregate amounts, or server guest-auth requirements while building Living Guide flows.

“New” notices are derived from publication time being under 72 hours, never stored. Event-specific UI activates only when event start data exists. Meli Pu uses five default tabs and no Program; Messages may remain visibly disabled until its checkpoint.

**Why:** The UI must reflect real content and avoid stored derived state or fabricated event/navigation features.

**How to apply:** Gate event templates on actual event dates, calculate notice freshness, and keep tab configuration tenant-driven.

Visual-parity evidence must use browser-computed styles from the complete prototype after its scripts initialize, with the intended time theme re-applied immediately before measurement.

**Why:** Prototype scripts can change the active theme, and CSS specificity can make an isolated source rule differ from the actual rendered value.

**How to apply:** Compare equivalent live/prototype DOM elements property by property; verify the prototype theme token first and trust the final computed cascade rather than a copied CSS fragment.

All shared Living Guide list rows use a 20px/750 title and a 16px subline. There is no intentional typographic distinction between the former near-row and sub-row variants.

**Why:** The owner confirmed that the previous 19px/15.5px variant was a prototype duplication error, not a separate component style.

**How to apply:** Keep the shared row component at 20px/750 and 16px everywhere, and include both values in future production parity tables.

Use the `guestUiMode` cutover flag with legacy as the default and a development-only Living Guide preview. Replace the admin cover preview before removing the legacy cover.

**Why:** The new guest shell must be introduced without breaking admin tools or live tenants.

**How to apply:** Keep new and legacy guest systems isolated until the final validated cutover.

Demo-only examples are allowed on the Living Guide tokens page. Parts 2–5 must never invent values in the real guest UI; if source data is missing, hide the dependent block.

**Why:** The guest guide must remain trustworthy and reflect only actual tenant content.

**How to apply:** Treat every real temperature, phone number, opening time, route fact, price, and similar value as optional source data; omit its UI when absent.

A described place carries no phone or opening hours; an office may carry phone and hours but no place description.

**Why:** The owner requires content identity to stay coherent: city/attraction descriptions must not inherit operational data from an information office.

**How to apply:** When converting an office record into a described place, clear phone and every hours representation, update localized titles, and point Maps at the place centre rather than the office door.

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

The mandatory PART 5 production order test uses the explicit test name and note, then closes the order as rejected with the host note “Testno naročilo ob prehodu — brez ukrepanja”. It is not deleted during cutover; ordinary retention removes it after 90 days. A host-facing order-deletion control is deferred to Phase A order administration.

**Why:** The real production e-mail chain must be proven before guest launch, but the current product has no safe supported deletion capability and a cutover must not add one ad hoc.

**How to apply:** Do not claim the test order was deleted. Report the message delivery evidence and rejection status, and scope the deletion control to the existing future order-administration work.

Guest-host message retention is a strict privacy boundary: a device thread at or after its 90-day deadline is non-revivable. A later guest message deletes its expired history and starts a fresh thread; a host write to an expired thread is rejected.

**Why:** Extending an expired row would silently retain and expose a conversation beyond its promised deletion period.

**How to apply:** Enforce expiry inside each message write transaction, not only in the scheduled sweep or read filters. Preserve the tenant/device uniqueness invariant for the fresh thread, and test both concurrent guest sends and expired host writes.

Domov’s Today cards require a visible item title and an image, not a distance or duration. Their optional detail combines distance, duration, and a short item-text excerpt in that order; the section hides only when no eligible card exists. The fallback sources remain the five approved activity and heritage categories in every supported language.

**Why:** The owner found that the prior distance/duration gate hid all meaningful Meli Pu recommendations even though the content already had titles and photographs.

**How to apply:** Never use generic subtitles as the detail fallback. Match the approved categories across Slovenian, English, German, and Italian labels; exclude commercial and utility categories such as shops, pharmacies, fuel, and ATMs.

Okolica category groups are saved category data, never inferred from translated labels. The five group identities and their localized names are product-defined; empty groups do not render and the first populated group opens by default.

**Why:** Hosts must be able to reassign categories later without making guest grouping depend on mutable or translated category names.

**How to apply:** Preserve the five stable group keys and product order. Keep custom group creation, naming, and ordering out of this model unless the owner explicitly changes the product boundary.

Tenant-level guest Maps actions resolve an explicit HTTPS Maps link first, then a complete valid latitude/longitude pair, then the legacy map query/address fallback. Configured invalid or partial higher-priority data must block fallback, and Maps always opens outside the guide.

**Why:** Address search can resolve to a neighbouring property, so silently dropping to a lower-priority address sends guests to the wrong door.

**How to apply:** Keep property navigation separate from item-specific POI destinations. Preserve external `_blank`/noopener behavior across Living Guide and legacy guest surfaces.

Living Guide shows the full `logoUrl` only beside the welcome heading on Home’s white surface. It has no cover logo and no square Home mark. At both 402px and 390px, the logo is 56px high, proportional, capped at 120px wide, undecorated, and conditional.

**Why:** A coloured logo with its own type needs a calm background. Over the photograph it competes with the cover title and unpredictable image content; on the white welcome surface it reads deliberately.

**How to apply:** Use a single heading/logo row with 20px sides, 16px minimum gap, space-between/center alignment, a non-shrinking logo, and a truncating heading. Verify exact heading coordinates with and without the logo. Viber and Instagram remain part of the same approved identity/contact parity release.

Living Guide Home screenshots must be captured only after the four-second Smart360 splash is gone, with the real welcome heading and host logo asserted visible; the exact saved disk file must then be opened before presentation.

**Why:** A browser-state screenshot once showed Home correctly while the separately exported evidence file still contained the timed splash, so presenting it falsely claimed evidence for host-logo placement.

**How to apply:** Use a fresh page, wait more than four seconds after load, assert the Home screen and localized welcome heading in the DOM, save to a new path, then inspect that path itself—not only a tester screenshot ID.

Authenticated preview screenshots must never require the owner's real operator password. Serve the unchanged production bundle in isolation and stub only the protected preview responses needed by the screen.

**Why:** The operator credential opens every tenant and is intentionally known by one person only. Moving it into process-readable storage weakens that boundary even when the store itself is protected.

**How to apply:** Prefer a fixture-backed protected preview with no session or credential. Keep HTML, JavaScript, CSS, and DOM untouched; use a development-only credential only as an explicitly approved fallback.

Kuula presentation is normalized only at render time: force `logo=-1`, `info=0`, `fs=0`, `vr=0`, `gyro=0`, `thumbs=-1`, and `pause=0`; preserve the stored URL, tour identity, autorotate, and unknown parameters. Every guest renderer and the admin preview must use the same helper and delegate no fullscreen, XR, gyroscope, or accelerometer permissions.

**Why:** The owner live-tested that `thumbs=0` replaces thumbnails with arrows while `thumbs=-1` removes navigation entirely. Kuula’s player gate confirms `pause=0` hides its sharp pause/play square without disabling gentle autorotation. Tilt-to-look feels like a fault when a phone moves.

**How to apply:** Keep drag as the only manual panorama movement, keep configured autorotation alive, and test both URL normalization and an inventory of all active tour iframe surfaces whenever the policy changes.
## Named Maps query (2026-08-23)
POI Maps link priority: pasted place link > named search "<title>, <SHORT address>" > labelled coords `q=lat,lng(title)` > text search. The named query MUST use `shortMapsQuery` (maps-href.ts) — never the raw Nominatim display name.
**Why:** Full display names carry "Upravna enota / Unità amministrativa", bilingual duplicates and postcodes; long queries make Google return nothing or the wrong place — same defect, different cause.
**How to apply:** Any new surface building a search query from `resolvedAddress` goes through `shortMapsQuery`; tests assert ≤130 chars and no administrative fragments.

## External-link policy (approved via blank-tab bugfix)
Links the OS hands to a native app (Google Maps URLs, wa.me, viber://, tel:) must be plain same-tab anchors — never window.open, never target="_blank". On iOS, window.open created a tab that the Maps/WhatsApp app then orphaned, stranding guests on a blank page. Regular website links keep target="_blank" + noopener (they render real content, so no blank tab). openExternalMapsUrl was deliberately deleted; do not reintroduce a window.open helper for guest links.
**How to apply:** any new guest-facing external link: app-handoff → bare `<a href>`; website → `<a target="_blank" rel="noopener noreferrer">`.

## Real-sun themes (Aug 2026)
Themes follow NOAA-computed sun times at the tenant's coordinates (civil dawn/dusk −6°, sunrise/sunset zenith 90.833°); noc=dusk→dawn, jutro=dawn→sunrise+90, dan=…→sunset−90, vecer=…→dusk. SunCalc's simplified algorithm is 1–2 min off the owner's binding reference table — only NOAA matches to the minute.
**Seam rule:** solar times are computed per UTC day, so theme + next-boundary MUST come from one resolver that merges UTC day −1/0/+1 boundaries (resolveSunWindow); a single-day lookup mis-themes eastern longitudes. Null (no coords, polar day/night) → fixed-hour fallback, never crash.

Grouped-list detail returns are verified by strict DOM identity: retain the live source list, its selected group, exact scroll offset, and image node references while detail is open.

**Why:** Visual image comparison hid list remounts, while an automation click on an off-screen first card caused a false scroll-reset failure by scrolling it into view before detail opened.

**How to apply:** Open an already-visible card without test-runner auto-scroll, wait until the detail layer is fully removed, then compare the same scroller’s exact numeric offset and each retained image with strict object identity.
