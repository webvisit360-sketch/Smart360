Viewport: 390x844
Slow profile during navigation: 500 ms latency; 400 kbps download (51,200 bytes/s CDP); same upload.
Cold fixture load: unthrottled; visible home controls confirmed before throttling.
Category flow: Plaže list (30 rows), Lokacija 30 — ZADNJA LOKACIJA. List scroll before detail: 2535 px. After back: scrollTop 0 px (expected restoration near 2535).
Category screencast frames captured: 4187; video frames sampled every 20.

Offer flow: published source meli-pu-sl.json (isPublished=true); SUP deska list → SUP — dnevni najem (25 € / dan) → SUP deska list. Final heading and both list rows visible; list remained at top. Timestamped frames captured: 2976; sampled: 855 (target 20 fps).

Announcements: synthetic response intercepted for /api/guest/__simple-fixture/announcements; two active rows. List → Obvestilo navigacijski test detail → list; title/body and both cards verified; API server remained stopped. Timestamped frames: 1073; sampled 310 at target 20 fps.

No-HOME-GRID audit: immediate transition captures showed HOME GRID as the visible content on category detail entry (with the detail sheet moving in) and on published offer item entry (the detail existed in the accessibility snapshot while the screenshot showed HOME GRID). Settled detail/list states later displayed correctly. This violates the strict no-HOME-GRID-foreground invariant during transitions.
Weather: opened `Vreme` modal (fixture said unavailable); `Nazaj` closed directly to `/__simple-fixture/home?lang=sl`, with no intermediate list/detail.
Program optional audit: published `Dogodki` tile opened the `Program` panel for 19.–25. oktober; selected day showed “Ta dan ni programa.” Existing published event category items have null `eventStart` and `eventSchedule`, so no event-list→detail→list item was available to exercise.
Environment: API workflow remained stopped; DB not accessed/mutated. Several unrelated resource requests returned HTTP 502 and some published images appeared as broken-image placeholders. Playwright bundled ffmpeg was unavailable; CDP screencasts were encoded with system ffmpeg. No app source changes.
Videos: category-navigation.mp4, offers-navigation.mp4, announcements-navigation.mp4.
