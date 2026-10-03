# Seven-language verification — DEV only

## Passing checks

- Frontend and API TypeScript checks.
- Production frontend build (no publication).
- 72 focused frontend tests plus 2 snapshot/cache-registry tests.
- All seven native language names on a real disposable DEV tenant whose stored language list was only `sl`.
- FR/NL/HR selection, URL change, and reload persistence in the real browser.
- Real announcement API: blank new-language fields fall back to English.
- All seven cached payload variants present, each HTTP 200.
- Existing source dictionaries: 1,158 original-language entries retained verbatim; native-name/locale metadata moved to the registry. This is source evidence, not byte-identical rendered-screen proof.
- Desktop home/weather computed measurements found no horizontal overflow or clipped measured text.
- Synthetic fixture removed after verification, including polymorphic translation records.

## Screenshot evidence

The browser testing tool exposes capture IDs rather than local image paths.

| Locale | Home | Weather | Active SOS | Tour (initial fixture) | Real announcements |
|---|---|---|---|---|---|
| fr | 6ag8ns | ihdurb | upzyi6 | nd66wo | 6272mq |
| nl | 3n8zjs | nk0osv | hv2z6u | mu2c11 | afd4a1 |
| hr | bm8sbo | vpr3ci | 9zekg4 | i9l0y2 | jxyzzk |

Denied SOS: fr `4m0eyb`, nl `wcp63v`, hr `uj2gy2`.

The GPX fixture initially omitted its language prop; this was corrected. Updated
390×844 screenshots with localized location-waiting text are saved alongside this
report as `tour-fr.jpg`, `tour-nl.jpg`, and `tour-hr.jpg`.

## Unresolved acceptance evidence

- Cold offline navigation failed against Vite development modules despite warm
  payload/shell caches. The worker intentionally caches compiled assets, not Vite
  sources. A compiled-build browser verification has not been completed: the local
  browser could not launch because its shared-library dependencies are unavailable.
  Do not claim offline acceptance or infer a production failure from this result.
- Browser geolocation timed out even with emulated permission; starting a real
  recorded tour was not verified. Localized waiting, far-distance templates,
  weather warning and too-short-tour logic were checked by screenshots/unit tests.
- Full rendered-byte comparison of the four old languages was not performed.

No production publish, production SQL, tenant-content translation, or new mission.