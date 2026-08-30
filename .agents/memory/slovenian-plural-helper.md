---
name: Slovenian plural helper
description: Shared four-form rule for every Slovenian count displayed by Smart360.
---

All counted Slovenian nouns must use the shared four-form helper: final digit 1 uses `one`, 2 uses `two`, 3–4 use `few`, and everything else uses `other`; final two digits 11–14 always override to `other`.

**Why:** Two-form concatenation produces incorrect copy throughout the product, and tests covering only counts of five or more miss the defect. The owner explicitly requires 21/22 to follow their final digit while 11–14 remain exceptions.

**How to apply:** Pass all four noun forms to the shared helper and test 0, 1–5, 11–14, 21, and 22 whenever count formatting changes. Do not recreate suffix logic at call sites.