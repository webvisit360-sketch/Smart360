---
name: Creator category remaps
description: Durable classification boundary for migrating broad Creator proposal buckets into the shared skeleton.
---

Classify a legacy proposal from its canonical proposal name while treating the
old broad bucket as authoritative fallback. Do not let resolved addresses,
nearby place wording, or incidental OSM metadata override the proposal's own
identity.

**Why:** Address text can contain names such as a valley or parking metadata
that falsely moves an eating place into natural heritage or a hiking proposal
into parking. The owner requires deterministic semantic categories without
changing proposal evidence.

**How to apply:** Refine only when the proposal name provides an explicit
signal (for example cycling, waterfall, museum, or event). Preserve broad
`food` as `culinary` and broad day-trip intent as `trips`; keep remaps
transactional, category-link-only, and idempotent.