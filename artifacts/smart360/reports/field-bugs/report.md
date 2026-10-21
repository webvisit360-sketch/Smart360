# Smart360 field-bug report — SimpleDesign DEV fixture

**Scope:** `/__simple-fixture/home?tenant=melipu&palette=bordo`, viewport 390×844 and 390×920. No auth or database changes. Evidence was captured before fixes and again after the update. Only evidence/report files were added under this folder; no application source was edited.

> **Current status:** The first-run pull-to-close result below is historical. The post-restart retest in [`postfix/final-verification.md`](postfix/final-verification.md) supersedes it: the populated Program view closed to home on a valid true-touch pull.

## Pre-fix observations
- Meli Pu fixture rendered the home grid. Welcome entry opened a detail sheet; Offer opened a category sheet and nested item detail; Program opened its empty schedule; Announcements opened an empty layer; Weather opened with `Vreme trenutno ni na voljo.`. Weather back and announcement close returned to the home grid. Program back and simple detail back closed after the transition. A downward pull on the Welcome sheet returned to home.
- Welcome geometry at **390×844**: root 390×844; sheet x0,y193,w390,h573,bottom766; offset 0, minOffset 0; detail-scroll viewport 390×766, no overflow. At **390×920**: root 390×920; sheet x0,y193,w390,h649,bottom842; offset 0, minOffset 0; inner scroll 390×842, no overflow. The fixture's Welcome content is short, so it did not reproduce a long-content bottom-reachability failure.
- Meli Pu fixture sets `tourRecordingEnabled:false`; for the recorder test, the same DEV fixture was opened with `tenant=drobez` (fixture enables recording), without auth/database access.
- Injected `navigator.geolocation.watchPosition` in the Drobež recorder: accurate 5 m fixes at origin and ~25 m north yielded `2 / 2 · ±5 m`, distance `25 m`; a `101 m` accuracy fix yielded `3 / 2 · ±101 m`, left distance at 25 m, and displayed `GPS je nenatančen (nad 100 m). Razdalja se ne beleži. Pojdite na odprto in omogočite natančno lokacijo.` Permission error code 1 displayed `Dostop do lokacije je zavrnjen. Omogočite ga v nastavitvah brskalnika.` while the tour still showed `Tura teče` and the watch count was 1; after >25 s the stale-update warning appeared. MapLibre reported WebGL2 unavailable in the browser tool context, so map rendering itself was not validated.

## Post-fix verification (same pass)
- Welcome detail remains visible/reachable at both target heights; at 390×844 sheet is x0,y193,w390,h573 with minOffset -766 in one settled measurement; at 390×920 sheet is x0,y193,w390,h649,bottom842 with offset/minOffset 0. Call and Address rows are visible. A downward pull on Welcome closed to `/__simple-fixture/home` after the transition.
- Offer item bottom action is reachable: `Naročilo` bounds were x33,y761,w324,h52 at 390×920 and x33,y685,w324,h52 at 390×844. The offer item fixture has no scroll overflow, so the wheel attempt did not move scrollTop (0) and the CTA remained onscreen; long-content wheel reachability is therefore not exercised by this short fixture data.
- Program shows only the shell back control; the inner `program-detail-back` control is absent, so the duplicate arrow is suppressed.
- **Fail:** Program downward-pull-to-close did not close on a true touch-enabled 390×844 context. A timed touchstart/move/end from y=500 to y=750 reached `DIV.lg2-screen-scroll.lgp-root` while scrollTop was 0 (noninteractive target), but the URL remained `/__simple-fixture/c/c-explore-program` and Program stayed open. A screenshot/video and event log are saved in `postfix/`.
- Because this is a reproducible post-fix failure, testing stopped here per the test loop. Weather/Announcement pull-to-close and simple announcement-back behavior, and the post-fix GPS diagnostics/negative altitudeAccuracy normalization, remain unverified. Their pre-fix observations are above.

## Evidence files
- Pre-fix screenshots, measurements, and recordings: `reports/field-bugs/` (`measurements.json`, `before-home-melipu-390x844.png`, Welcome/Offer/GPS state PNGs, `detail-sheet-and-swipe.webm`, `gps-recorder-injected.webm`).
- Post-fix Program pull failure: `reports/field-bugs/postfix/program-before-touch-pull-390x844.png`, `program-after-touch-pull-390x844.png`, `program-touch-pull-failure.webm`, and `program-touch-pull.json`.
