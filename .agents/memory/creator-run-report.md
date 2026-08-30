---
name: Creator run report
description: Required evidence output and distance-model direction for the next Creator stage.
---

Every Creator run must finish by producing its own report covering proposed places, machine-confirmed places, unconfirmed places with reasons, operator rejections, missing photographs, and cost.

**Why:** The first real model-assisted run must be judged from explicit evidence rather than subjective impressions.

The controlled Camping MENINA C1 evidence boundary permits exactly four durable runs. Earlier runs remain immutable, and no proposal may be approved or materialized automatically.

**Why:** The owner requires each expensive production run to remain auditable and explicitly bounded.

Creator prompt history has three distinct states: machine failures have no influence; machine-confirmed canonical names are listed as already in the guide; human rejections are hard blocks.

**Why:** A machine miss is evidence about the verifier, not the place, while machine success is trustworthy guide state that prevents wasting later model slots. Only a person’s rejection is durable negative editorial evidence.

**How to apply:** Exclude unresolved names from prompts, include confirmed canonical names as already present, and pass human-rejected names as forbidden. Preserve unresolved evidence and never permit a fifth run without explicit approval.

Run reports and proposal rows must show the model’s inclusion reason. Beyond-near proposals must expose same-category alternatives, including unresolved alternatives with unknown proximity.

**Why:** Mapping quality is systematically stronger for famous distant landmarks than small local places, so sieve refusals can bias a guide outward. Hiding unrouteable losses repeats that bias in the evidence layer.

**How to apply:** Group unresolved proposals by category. Sort measured proximity first, but never omit unresolved rows without coordinates or infer distance from a locality. Label those exactly “razdalja neznana — sito ni potrdilo kraja”; keep route failures distinct.

Generic-type grammar and place retrieval are separate sieve stages. Phrase-aware matching can only recover a proposal when Nominatim returned candidate evidence; it cannot repair a `no-results` lookup by itself.

**Why:** Run-three evidence showed that correct Slovenian category phrases frequently produced empty candidate sets. Expanding identity matching alone therefore recovered none of those rows, including the campsite’s namesake Menina planina.

**How to apply:** Keep longest-first, OSM-type-corroborated multi-word matching, but measure zero-candidate losses separately. Any future retrieval retry that strips a generic phrase requires explicit approval and must preserve the two-attempt ceiling.

Dropping Nominatim's `layer` filter is not an adequate replacement for bounded Overpass retrieval.

**Why:** A controlled replay of 23 zero-candidate MENINA losses without `layer` restored results for only five names, and the unchanged local gate resolved zero. The restored set was mostly settlements blocked by design; the other 18 still returned nothing.

**How to apply:** Keep the layerless result as diagnostic evidence only. Use bounded near-ring enumeration for local discovery rather than broadening global Nominatim behavior without a separately designed settlement policy.

Infrastructure failure is never editorial rejection.

**Why:** Timeouts, rate limits, routing failures, and unreachable services say nothing about whether a place belongs in a guide.

**How to apply:** Keep affected proposals unresolved and available for manual confirmation. Never add infrastructure-failed names to rejection prompts or durable editorial blocklists.