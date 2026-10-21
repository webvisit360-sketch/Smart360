# Smart360 post-restart verification

**Run date:** 2026-10-21  
**Scope:** Smart360 Meli Pu DEV fixture, true touch input, 390×844 and 390×920. No application source, authentication, or database changes were made. Long content and a published weekly Program event were supplied through the existing DEV evidence fixture and browser-only response interception; an Announcement was supplied through browser-only interception of the guest API. The local GPS stub and test clock were restored/reset after diagnostics.

## Results

- **Welcome detail:** 35 test paragraphs plus the exact `KONEC PREIZKUSNE VSEBINE` marker were reached by repeated upward touch drags on body text at both 390×844 and 390×920. The marker and final Address row fit inside each viewport. The original short Welcome fixture had not reproduced the earlier long-content concern; no failure is claimed for that short fixture. Screenshot IDs: `jsc056` (844), `cqej1z` (920).
- **SUP offer:** The published `SUP — dnevni najem` detail’s long body was reached with text-only touch drags at 390×844 and 390×920. At 920 the end marker was at y485–512 and the still-visible `Naročilo` CTA at y761–813; the marker was above the CTA. Screenshot IDs: `hrw2y3` (844), `u2nr4o` (920). The 920 layout contains duplicate sheet-root nodes, so no max-scroll claim is made for this offer measurement.
- **Program event:** Browser-intercepted published data populated the actual weekly Program view with a daily event and a real event-detail layer, including time, location, age metadata, and the 35-paragraph body. At 390×844, four text-only upward touch drags reached the scroller maximum (1553); the marker and metadata were visible. At 390×920, four drags reached max scroll 1477; marker bounds were y641–663 and metadata y677–770. Screenshot IDs: `isj0vp` (844), `cq8tca` (920).
- **Announcement:** Browser-intercepted guest API data populated the actual Announcements layer/detail. Four upward text-only touch drags reached the end at each viewport. At 390×920 the layer was at max scroll 1711; a text-range measurement placed the exact marker at y820–837 and the validity row at y854–894, both fully visible. Screenshot IDs: `kg6v9b` (844), `ibu7ml` (920).
- **Program pull-to-close:** On the restarted build, the populated Program view closed to home after a true touch pull from a blank, noninteractive point at the top of `.lgp-root` (scrollTop 0). The final observation showed home present and ProgramView absent. A second valid close was captured on the populated view: touch began at (200,650) on blank root content and ended at y800; home was restored with ProgramView count 0 and home count 1. Screenshot ID: `oi82ef`.
- **Weather:** `skin=day` rendered populated forecast content: Izola, 23°, partly cloudy, 27°/14°, precipitation, wind, sunset, and hourly forecast. Screenshot ID: `eb7mym`.
- **Tour/GPS diagnostics:** The initial 25 m fix with `altitudeAccuracy:-1` was accepted (1/1). A 101 m fix was received but rejected with the poor-GPS warning. Geolocation denial (code 1) showed the permission alert while the tour remained active; a later accurate fix cleared it. Advancing the test clock 30 seconds showed the stale-fix warning while the tour stayed active. Real `Date.now` was restored and the tour was finished/reset; the recorder returned to idle with its short-tour notice. Stale-warning screenshot ID: `z97jhr`.

## Environment notes

- The tour map could not initialize because this browser context lacks WebGL2; the fallback text appeared, so map rendering itself was not validated.
- Multiple page resources returned 404 in browser logs; these did not prevent the tested interactions or content from rendering.
- Playwright `recordVideo` could not create a context because its packaged ffmpeg executable was missing. The requested close video was instead captured as 33 CDP screencast frames from the touch-enabled page and encoded with the available system ffmpeg. `ffprobe` verified VP9, 390×844, 2.75 s.

## Local evidence

- `program-pull-close-true-touch.webm` — true-touch Program pull-to-close clip.
- `program-pull-close-before.jpg` and `program-pull-close-after.jpg` — first and final CDP frames from that clip.
- Screenshot IDs above refer to the current browser-test observations. Earlier retained files and the historical first-run report are in the parent `field-bugs/` folder.

No application files were modified.
