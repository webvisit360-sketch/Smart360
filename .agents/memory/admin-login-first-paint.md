---
name: Admin login first paint
description: Keep public login independent from protected editor loading.
---
Login must not wait for protected admin/editor dependencies, and pending admin routes must show visible loading feedback.

**Why:** A cold browser reproduced a blank login while all requests succeeded: almost 1,900 development modules loaded before the form appeared around four seconds later. A null Suspense fallback hid this delay. Do not dismiss a white first paint as a testing artifact or assume a failed request.

**How to apply:** Verify cold first paint and reload, not only an already-warm profile. Check that editor/preview modules are not requested before login; keep errors distinguishable from loading.
