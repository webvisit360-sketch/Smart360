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