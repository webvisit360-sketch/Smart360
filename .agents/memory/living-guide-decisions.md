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

Every checkpoint report must include a “DELIBERATELY ABSENT IN THIS CHECKPOINT” section that distinguishes later-stage screens, buttons, and templates from defects.

**Why:** Without an explicit absence list, the owner could not tell planned scope boundaries from broken or missing UI.

**How to apply:** Name each intentionally absent surface and its scheduled checkpoint; for generic placeholders, state which specialized treatment or destination is still pending.

Living Guide touch feedback is haptic and visual only: `navigator.vibrate(6)` plus press scale `.97`; never initialize or request WebAudio, and never expose a sound toggle.

**Why:** On a real iPhone the synthesized mechanical click sounded like a beep, so the owner removed audio from the binding specification.

**How to apply:** Guest and tokens surfaces share haptic-only tap feedback. Verification must prove the first tap requests a 6 ms vibration and makes zero audio API requests.

The development Meli Pu tenant is a read-mostly production-content copy; refresh production only through read-only export and write solely to development in one guarded transaction.

**Why:** Template work must use the full realistic tenant tree, while production must never be mutated and development-only category keys must survive refreshes.

**How to apply:** Snapshot dev first; compare per-category counts and content hashes; sync guest tenant fields, sections, categories, items, media metadata, translations, and plurals. Preserve category keys and operational tenant fields, then require exact post-sync hashes.