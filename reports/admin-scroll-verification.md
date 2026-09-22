# Admin scroll verification

Date: final post-fix browser pass, development preview only.  
Tenant: `Piknik prostor in kamp Gril` (existing populated tenant).  
All navigation was read-only. No publish, edit, approve, generate, email, or send
actions were performed.

## Results

`doc` is `documentElement.scrollHeight/clientHeight/maxScroll` after resetting
and scrolling the document to its maximum. `scroller` is the active content
scroller `scrollHeight/clientHeight/maxScroll`, after moving it to its maximum.
`gap` is the remaining space between the last visible real content and the
scroller bottom; ordinary short-page space or the normal inner bottom padding is
not treated as a failure.

| Area | Viewport | doc | scroller | gap | Header / preview |
|---|---:|---:|---:|---:|---|
| Tenant list `/admin` | 1440x900 | 5335/900/4435 | `admin-shell__scroll` 5335/5335/0 | 0 | Dashboard has no phone rail |
| Tenant list `/admin` | 1300x768 | 5335/768/4567 | `admin-shell__scroll` 5335/5335/0 | 0 | Dashboard has no phone rail |
| Pregled | 1440x900 | 900/900/0 | 820/820/0 | 359.5px | publish header y=5.6..55.6; preview x=1100..1440, y=80..900 |
| Pregled | 1300x768 | 768/768/0 | 688/688/0 | 208.75px | publish header y=5.6..55.6; preview x=960..1300, y=80..768 |
| Nastanitev | 1440x900 | 900/900/0 | 5972/820/5152 | 90.5px | header/preview unchanged |
| Nastanitev | 1300x768 | 768/768/0 | 5972/688/5284 | 90.5px | header/preview unchanged |
| Okolica | 1440x900 | 900/900/0 | 820/820/0 | 571.08px | header/preview unchanged |
| Okolica | 1300x768 | 768/768/0 | 688/688/0 | 374.66px | header/preview unchanged |
| Nastavitve | 1440x900 | 900/900/0 | 2387/820/1567 | 90px | header/preview unchanged |
| Nastavitve | 1300x768 | 768/768/0 | 2442/673/1769 | 105.5px | header/preview unchanged |
| Kreator vodnika | 1440x900 | 900/900/0 | 4005/820/3185 | 90.25px | header/preview unchanged |
| Kreator vodnika | 1300x768 | 768/768/0 | 4195/688/3507 | 90.25px | header/preview unchanged |

All tenant-page rows had no document phantom area (`doc maxScroll=0`).
When long inner panels were moved to their bottoms, the `Objavi spremembe`
header remained visible at the top and the phone preview remained in its right
rail.

## Kreator proposal queue

The queue was checked inside Kreator, not Naročila:

- `[data-testid="creator-proposal-queue"]` was present at both widths.
- 1300x768: x=280, y=55.25, width=633, height=426.
- 1440x900: x=280, y=207.25, width=773, height=406.
- Existing data was sufficient: `0 čaka · Ni bilo mogoče potrditi: 0` and
  `V tej izvedbi Kreatorja še ni predlogov.`
- The four bulk actions were disabled. No queue action was clicked.

## Accessibility label / source fix verification

After reload against the real restarted workflow, no diagnostic styles remained.
The shared source rule was live:

```text
.admin-tenant-scroll { position: relative; }
```

The existing absolute screen-reader label `Uredi` remained present. At both
tested sizes its computed position was `absolute`, and its offset parent was
the actual `admin-tenant-scroll` DIV (not `BODY`):

```text
admin-tenant-scroll flex-1 overflow-auto p-4 md:p-[30px]
```

The 90px inner padding was unchanged. The original document-tail case was
also rechecked by the final rows: document height stayed exactly equal to the
viewport at both sizes, including Nastanitev before/after values:

```text
Before fix: Nastanitev 1440x900 document 1094/900 (maxScroll 194);
            1300x768 document 1094/768 (maxScroll 326).
After fix:  Nastanitev 1440x900 document 900/900 (maxScroll 0);
            1300x768 document 768/768 (maxScroll 0).
Inner Nastanitev heights are unchanged by the fix:
            5972/820 at 1440x900, 5972/688 at 1300x768.
```

## Representative evidence

- `/admin` bottom at 1440x900: screenshot `ufw60x`.
- `/admin` bottom at 1300x768: screenshot `q0as9q`.
- Nastanitev bottom at 1440x900: screenshot `z9ee55`.
- Nastanitev bottom at 1300x768: screenshot `ay8csu`.
- Kreator queue at 1440x900: screenshot `zq8yvd`.

No production credentials or password account was read, created, replaced, or
enrolled. Only the authorized temporary development session was used.