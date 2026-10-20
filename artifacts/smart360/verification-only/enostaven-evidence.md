# Enostaven — evidence

Development-only, no publication. Approved schema change: three nullable text
columns on tenants (guest_design, simple_palette, simple_base_color). No defaults,
backfills, or production database changes.

Reproducible browser evidence scripts:
- src/tests/fixtures/capture-enostaven.mjs: reference-shaped tenant layouts,
  all-seven-language real published snapshot label checks, binding HTML capture.
- src/tests/fixtures/verify-simple-final.mjs: both landing flag columns, immediate
  language switching, one visible category back control returning home.
- src/tests/fixtures/capture-trend-baseline.mjs: unchanged Trend home at identical
  time and carousel position, comparing the immutable baseline component copy.

Generated output: reports/enostaven (excluded from Git and deployment).
Published input snapshots: verification-only/enostaven (also excluded).
Those snapshots are read-only public GET responses for turizem-drobez and meli-pu,
all seven languages, from https://smart360.info/api/public/tenants/{slug}?lang={lang}.
The DEV fixture uses a synthetic slug, so it cannot submit into those tenants.

Confirmed:
- Trend home PNG bytes are identical after normalizing time and carousel position.
  Landing intentionally differs because both designs now use the flag column.
- Each 390px-wide grid tile is 92.65625px square, with 30px column gaps and
  19px row gaps. Browser rounds specified 2.3px borders to 2px at DPR1, equally
  in the reference. Three-stop palette values match exactly.
- Published category/runtime labels across both tenants × seven languages:
  no overflow and no label over three lines in the measured samples.
- SVG flags: unselected 52×38, selected 64×47, Slovenian last, caption below.
- Nested detail closes home; messages back closes home; rental CTA opens the
  existing required identification form before submission.
- Backend HTTP test: self-service appearance writes allowed; concierge writes
  forbidden; invalid values rejected; draft updates do not leak to guest snapshot;
  reviewed publication carries the fields. All writes were synthetic test data.
- TypeScript checks passed. 13 dedicated Enostaven unit tests passed.

Reference deviations are intentional and disclosed:
- Reference HTML's intrinsic minimum content makes its first row 92.65625×97px
  at 390px. Implementation follows the explicit square-tile requirement.
- Reference uses fixed 19px corners and pale pictograms; explicit instructions
  require 19% corners and white pictograms. Those written requirements win.
- Real published content is not the illustrative reference list; it is never
  replaced just to make a screenshot match.

Limitations:
- No physical iPhone/offline-install test performed in this change.
- Runtime message/order/announcement requests on the synthetic fixture slug
  return 404; no real sends or orders were submitted. Existing data flows remain
  in place; these screenshots are not proof of message/order delivery.
- Weather unavailable now renders an explicit localized status.
- The design implementation reported four pre-existing full-suite failures
  (content-editor-helpers, empty-category-row, Okolica search, distance headers).
  This work's focused checks passed; do not claim the entire suite is green.
