# Living Guide guest radius audit

**Acceptance status: UNVERIFIED — IPHONE REFILM PENDING.** The clipping diagnosis was rejected. Hero height is now deterministic from stored dimensions or a fixed fallback; only the owner's new iPhone recording can accept the opening fix.

Audit scope:

- `living-guide-guest.css`
- `living-guide-tokens.css`
- 90 selector groups with a radius declaration
- “Clips” means the same element establishes an `overflow: hidden|clip` or non-`none` `clip-path`.

The table records the final values. Rows marked **remedy** did not clip before this fix.

## Findings

### Incorrect or unstable clipping

| Surface | Radius | Before | Resolution |
|---|---:|---|---|
| `.lg2-app .v--det > .lg2-view` | 30 px top corners | No matching child clip; the transformed parent alone clipped | **Remedy:** matching 30 px radius and rounded `clip-path` on the direct view child. The transformed parent keeps the shadow. |
| `.lg2-detail-sheet` | 28 px top corners | Radius existed, but the panel did not establish its own clipping surface | **Remedy:** matching standard and WebKit rounded `clip-path`. This preserves the inner hero/panel boundary during ancestor transforms. |
| `.lg2-detail-sheet--solo` | 0 | Inherits the normal detail panel rule | Explicitly resets both clip paths to `none`; solo sheets remain square. |

### Parent/child radius review

- `.lg2-app .v--det` and its direct `.lg2-view` now use coincident 30 px top radii. There is no border between them, so equal radii are correct.
- `.lg2-detail-sheet` uses 28 px while the route uses 30 px, but these edges are not coincident: the panel starts over the lower hero boundary. The “child radius = parent radius − border” formula does not apply.
- `.lg2-photo-card`, `.lg2-pcard`, `.lg2-hcard`, and token `.lg-cardp` deliberately clip square image children at the parent edge. The child does not paint an independent rounded border, so a child radius is unnecessary.
- `.lg2-sub-icon` deliberately clips its child content at 16 px.
- Guest `.lg2-seg`/button uses 15/12 px with a 3 px inset. Token `.lg-seg`/button uses 14/11 px with a 3 px inset. Both are geometrically consistent; the 1 px border is outside the button’s inset edge.
- Token `.lg-theme-switch`/button uses 17/12 px with a 5 px inset and a 1 px parent border. This is consistent.
- `.lg2-msg--h` and `.lg2-msg--g` change one lower corner from the base 20 px to 7 px intentionally to form chat tails.
- No remaining coincident parent/child border edge violates `child radius = parent inner radius`.

## Exhaustive inventory: guest shell

| Selector | Radius | Clips |
|---|---|---|
| `.lg2-app .v--det` | `30px 30px 0 0` | Yes |
| `.lg2-app .v--det > .lg2-view` | `30px 30px 0 0` | Yes — remedy |
| `.lg2-held-surface[data-lg-held-detail="true"]` | `30px 30px 0 0` | No |
| `.lg2-fab` | `14px` | No |
| `.lg2-cbar .lg2-fab` | `20px` | No |
| `.lg2-cbar button.lg2-language` | `20px` | No |
| `.lg2-cover .lg2-open-guide` | `20px` | No |
| `.lg2-welcome-sheet` | `34px 34px 0 0` | No |
| `.lg2-grabber` | `2px` | No |
| `.lg2-field` | `15px` | No |
| `.lg2-primary-button` | `16px` | No |
| `[data-living-guide] .lg2-language-options button` | `18px` | No |
| `.lg2-language-code` | `12px` | No |
| `.lg2-greeting` | `16px` | No |
| `.lg2-greeting-icon` | `12px` | No |
| `.lg2-orders-entry` | `16px` | No |
| `.lg2-orders-entry-icon` | `12px` | No |
| `.lg2-tour-return` | `16px` | No |
| `.lg2-tour-return > span` | `12px` | No |
| `.lg2-photo-card, .lg2-utility-card` | `22px` | Yes |
| `.lg2-photo-card img` | `0` | No |
| `.lg2-utility-icon` | `13px` | No |
| `.lg2-gallery-dots i` | `50%` | No |
| `.lg2-detail-back` | `14px` | No |
| `.lg2-detail-sheet` | `28px 28px 0 0` | Yes — remedy |
| `.lg2-detail-sheet--solo` | `0` | No — explicit reset |
| `.lg2-facts` | `18px` | No |
| `.lg2-rule-row` | `18px` | No |
| `.lg2-rule-icon` | `13px` | No |
| `.lg2-bottom-nav button::before` | `0 0 3px 3px` | No |
| `.lg2-wifi-row` | `16px` | No |
| `.lg2-wifi-copy` | `11px` | No |
| `.lg2-qr` | `20px` | No |
| `.lg2-seg` | `15px` | No |
| `.lg2-seg button` | `12px` | No |
| `.lg2-sub-icon` | `16px` | Yes |
| `.lg2-list-thumb` | `16px` | No |
| `.lg2-notice-thumb` | `13px` | No |
| `.lg2-new` | `999px` | No |
| `[data-living-guide] .lg2-chip` | `999px` | No |
| `.lg2-gtabs button` | `999px` | No |
| `.lg2-pcard` | `24px` | Yes |
| `.lg2-pcard-meta i` | `50%` | No |
| `.lg2-step-number` | `50%` | No |
| `.lg2-bell` | `14px` | No |
| `.lg2-bell--dot::after` | `50%` | No |
| `.lg2-contact-list .lg2-sub-icon, .lg2-search-results .lg2-sub-icon` | `13px` | No |
| `.lg2-search-field` | `17px` | No |
| `.lg2-order-dock-inner` | `20px` | No |
| `.lg2-qty-btn` | `50%` | No |
| `.lg2-my-orders-row` | `16px` | No |
| `.lg2-my-orders-status` | `10px` | No |
| `.lg2-my-orders-note` | `12px` | No |
| `.lg2-hhero-fab` | `15px` | No |
| `.lg2-hsheet` | `28px 28px 0 0` | No |
| `.lg2-hqbar .lg2-q` | `20px` | No |
| `.lg2-hqbar .lg2-qd` | `50%` | No |
| `.lg2-hcard` | `24px` | Yes |
| `.lg2-hcard .tx em` | `8px` | No |
| `.lg2-msg` | `20px` | No |
| `.lg2-msg--h` | lower-left `7px` | No |
| `.lg2-msg--g` | lower-right `7px` | No |
| `.lg2-msgbar input` | `16px` | No |
| `.lg2-msgbar button` | `16px` | No |

## Exhaustive inventory: shared token stylesheet

| Selector | Radius | Clips |
|---|---|---|
| `[data-living-guide] .lg-stars i` | `50%` | No |
| `[data-living-guide] .lg-clock` | `999px` | No |
| `[data-living-guide] .lg-theme-switch` | `17px` | No |
| `[data-living-guide] .lg-theme-switch button` | `12px` | No |
| `[data-living-guide] .lg-section` | `28px` | No |
| `[data-living-guide] .lg-cardp` | `22px` | Yes |
| `[data-living-guide] .lg-live` | `50%` | No |
| `[data-living-guide] .lg-ut` | `22px` | No |
| `[data-living-guide] .lg-icon-box, [data-living-guide] .lg-sub-icon` | `13px` | No |
| `[data-living-guide] .lg-sheet` | `28px` | No |
| `[data-living-guide] .lg-grab` | `2px` | No |
| `[data-living-guide] .lg-facts` | `18px` | No |
| `[data-living-guide] .lg-chip, [data-living-guide] .lg-pill` | `999px` | No |
| `[data-living-guide] .lg-step-number` | `50%` | No |
| `[data-living-guide] .lg-rule-icon` | `13px` | No |
| `[data-living-guide] .lg-rule--warning` | `16px` | No |
| `[data-living-guide] .lg-seg` | `14px` | No |
| `[data-living-guide] .lg-seg button` | `11px` | No |
| `[data-living-guide] .lg-wifi-copy` | `11px` | No |
| `[data-living-guide] .lg-qr` | `18px` | No |
| `[data-living-guide] .lg-notice-thumb` | `13px` | No |
| `[data-living-guide] .lg-new` | `999px` | No |
| `[data-living-guide] .lg-btn` | `16px` | No |
| `[data-living-guide] .lg-theme-sample` | `20px` | No |
| `[data-living-guide] .lg-swatch` | `10px` | No |
| `[data-living-guide] .lg-token-table-wrap` | `20px` | No |