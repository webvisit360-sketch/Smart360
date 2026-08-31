---
name: Guide Creator product rule
description: Founding product principle, permanent access boundary, and intended workflow for the Smart360 Guide Creator.
---

Kreator vodnika is Smart360’s operator build instrument. While Smart360 is being completed before public launch, its placeholder navigation remains visible in the shared tenant console as part of the owner’s map of unfinished work. Once the screen is functional, the screen itself is permanently operator-only and must not be available to a host session.

**Why:** Smart360’s commercial premise is that the guide already stands when the host first signs in. Asking hosts to compile local lists commonly delays delivery for a month or prevents completion altogether.

**How to apply:** Keep all ten approved `admin-2030.html` navigation entries visible while their screens are being built; use placeholders rather than hiding unfinished destinations, because absent navigation causes planned work to be forgotten. The operator starts from one host address and builds roughly three quarters of the guide before requesting host input: structure, surroundings within about 15 km, excursions, cycling, hiking, museums, beaches, distances, descriptions, and translations. The remaining quarter is host-specific material—house rules, original texts, products, and rentable equipment—which either Smart360 or the host enters according to the host’s preference. Never expose a functional empty-guide setup workflow to a host.

The designed Creator is a resumable seven-step checklist: Osnovni podatki; Vaša nastanitev; Potrdite okolico; Ponudba in naročila; Program in obvestila (optional); Videz vodnika; Objava in QR kode. Its “N čaka” count in the surroundings step represents proposed places awaiting confirmation, not a general task count.

Creator is never a tenant-creation source. The operator creates a tenant in the admin first; Creator Step 1 then adopts the tenant whose cockpit is open, identified only by that cockpit tenant ID and never by name. Step 1 persists the confirmed coordinates, operator-entered address, resolved origin region, and creator-draft flag using existing tenant fields. Lookup-time feature identity and verification status are evidence shown in the interface, not persistent tenant fields. If an origin is already stored, show stored and resolved values and require explicit replacement confirmation.

**Why:** Two tenants may legitimately share a name. Name matching can silently adopt the wrong customer, while a second creation path produces duplicate tenant rows and split ownership.

**How to apply:** Keep tenant creation in the admin flow. Remove or reject any Creator endpoint that inserts tenants. Re-resolve submitted map links on the server, lock the cockpit tenant ID around the existing-origin guard/update, and test with two same-name tenants.