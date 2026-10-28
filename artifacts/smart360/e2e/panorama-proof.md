# Spherical panorama verification (development only)

The isolated offline fixture server supports `offline-panorama-simple` and
`offline-panorama-trend`. It uses the real compiled guest app and service worker,
not production data or accounts. Its first house entry contains a sphere and a
partial panorama. The fixture's `/__fixture/transport` control must also be set
to `{ "down": true }` when testing offline: browser offline emulation alone may
leave service-worker fetches online.

The evidence images are intentionally excluded from Git and deployment:

- `generated-artifacts/panorama-360/alma.jpg`: the original 4096×2048 photographic
  example from https://pannellum.org/images/alma.jpg
- `generated-artifacts/panorama-360/partial.jpg`: a 4096×1024 centre crop (top 512)
  of that example, used only to demonstrate the flat fallback.

Photo credit: Matthew Petroff / Pannellum example panorama, CC BY-SA 3.0
(https://creativecommons.org/licenses/by-sa/3.0/).
The cropped derivative retains that license. Source license:
https://github.com/mpetroff/pannellum#license

The runtime library is Pannellum, MIT. Its full bundled copyright and permission
notice is available within the viewer under “Pannellum · MIT”; the demo photo
is not part of the guest application's assets or content.

The client suite's `panorama-sphere-browser.test.ts` is self-contained and uses a
synthetic SVG instead, so the suite needs no photograph download.
