# Host onboarding backend contract

All routes are JSON under `/api`. Host routes require an authenticated host session scoped to its own tenant. Owner routes require owner authentication. All errors use `{ "message": "<Slovenian text>" }`.

## Session gate

`GET /admin/host/session` adds:

```json
{
  "authenticated": true,
  "onboardingRequired": true
}
```

`onboardingRequired` is true only when an onboarding draft exists for that host/tenant and its current round is not submitted. Existing hosts without a draft are never gated. A welcome-invite activation initializes the first draft; owner open/reopen can gate an existing host explicitly.

## Host endpoints

- `GET /admin/host/onboarding` → current draft, shared explore categories in canonical order, staged photos, and status.
- `PATCH /admin/host/onboarding` → autosave one or more fields; body includes the last received `revision` and the editable `data` patch below. Omitted keys are unchanged; supplied arrays replace that draft array.
- `POST /admin/host/onboarding/save` → explicit save; same body and optimistic-revision semantics as PATCH.
- `POST /admin/host/onboarding/photos/upload-url` with `{ "fileName", "contentType", "size" }` → `{ "uploadUrl", "objectPath", "photoId" }`. Images only; max 20 draft photos. Client PUTs bytes directly to the signed URL.
- `POST /admin/host/onboarding/photos/:photoId/complete` → enforces the API MIME allowlist, verifies the real staged-object byte size, decodes the image with Sharp, strips metadata by re-encoding, and marks it ready. The signed upload key ends in `<photoId>.raw`; completion writes the private immutable `<photoId>.sanitized.jpg` key (which is never signed), conditionally moves the DB pointer, and deletes the exact raw object. MIME is intentionally enforced at runtime rather than by a database constraint.
- `DELETE /admin/host/onboarding/photos/:photoId` → removes the draft reference (submitted/review photos cannot be removed by host).
- `GET /admin/host/onboarding/photos/:photoId` → authenticated host thumbnail/preview stream for the host's own staged photo.
- `POST /admin/host/onboarding/submit` always requires `{ "round": 1 }`. For a first submission, `revision` is required and `data` is optional; omitted data submits the persisted draft at that revision. For an immutable already-submitted round replay, only `round` is required and any `revision`/`data` are ignored. Replay resolves the requested tenant/host/round even after a newer round exists, and never remaps data or sends another e-mail.

Autosave/save request example:

```json
{ "revision": 4, "data": { "guestPhone": "+386 ..." } }
```

Each successful write atomically increments and returns `revision`. A stale revision receives HTTP 409 with `{ "message": "Osnutek je bil medtem spremenjen. Osvežite obrazec in poskusite znova.", "currentRevision": 5 }`; the server never silently overwrites a newer tab.

Editable data:

```json
{
  "data": {
    "accommodationName": "string",
    "address": "string",
    "guestPhone": "string",
    "guestEmail": "string",
    "website": "string",
    "checkInFrom": "HH:MM",
    "checkOutUntil": "HH:MM",
    "contacts": [{ "id": "client-stable-id", "name": "string", "phone": "string" }],
    "wifiName": "string",
    "wifiPassword": "string",
    "houseRulesParking": "verbatim string",
    "offers": [{ "id": "client-stable-id", "name": "string", "price": "string" }],
    "recommendations": [{ "id": "client-stable-id", "categoryId": "canonical-category-id", "name": "string" }],
    "events": [{ "id": "client-stable-id", "name": "string", "date": "YYYY-MM-DD", "time": "HH:MM" }]
  }
}
```

GET response:

```json
{
  "id": "uuid",
  "tenantId": "uuid",
  "round": 1,
  "revision": 4,
  "status": "draft|submitted",
  "data": {},
  "categories": [{ "id": "string", "name": "string", "order": 0 }],
  "photos": [{ "id": "uuid", "fileName": "string", "contentType": "image/jpeg", "size": 123, "status": "uploading|ready|submitted" }],
  "updatedAt": "ISO timestamp",
  "submittedAt": null
}
```

## Owner endpoints

- `GET /admin/tenants/:id/host/onboarding` → exact owner read-only response below.
- `POST /admin/tenants/:id/host/onboarding/open` → creates round 1 only if no round exists.
- `POST /admin/tenants/:id/host/onboarding/reopen` → creates a new draft round; previous submitted round remains immutable. Idempotency key accepted as `Idempotency-Key`.
- `GET /admin/tenants/:id/host/onboarding/photos/:photoId` → authenticated staged-photo stream for review.

Owner GET response:

```json
{
  "tenantId": "uuid",
  "tenantName": "string",
  "rounds": [{
    "id": "uuid",
    "round": 1,
    "revision": 7,
    "status": "draft|submitted",
    "data": {},
    "targetReview": [{
       "target": "tenant.name|tenant.address|tenant.phone|tenant.email|tenant.wifiSsid|tenant.wifiPass|contact.website|contact.people|item.check|item.house|item.park|offer",
      "hostValue": "string or structured value",
      "operatorValue": "string or structured value or null",
      "resolution": "filled_blank|suggestion|unchanged",
      "suggestionVisible": true
    }],
    "recommendations": [{ "categoryKey": "shops", "name": "string", "proposalId": "uuid|null" }],
    "events": [{ "id": "uuid", "name": "string", "date": "YYYY-MM-DD", "time": "HH:MM", "status": "pending" }],
    "photos": [{ "id": "uuid", "fileName": "string", "contentType": "image/jpeg", "size": 123, "status": "uploading|ready|submitted", "previewUrl": "/api/admin/tenants/uuid/host/onboarding/photos/uuid" }],
    "notification": { "status": "pending|sending|sent|failed", "recipient": "info@webvisit360.com", "providerMessageId": null, "error": null, "attemptedAt": null },
    "createdAt": "ISO timestamp",
    "updatedAt": "ISO timestamp",
    "submittedAt": null
  }]
}
```

`targetReview` is the operator-visible conflict/suggestion ledger. Seeded name changes remain visible as suggestions; blank canonical targets may be draft-filled. Website and contact people are independent fields on the canonical contact item, so one occupied field never blocks the other blank field. The combined house-rules/parking text is copied verbatim to each blank canonical target and reviewed independently; it is never parsed into invented parking facts. Events always expose the exact host-provided date and time.

## Submit behavior

Submission locks the current round, is idempotent for that round, preserves already populated operator target fields and records host values as visible suggestions, fills only blank draft targets, never publishes, admits Creator proposals through `src/lib/hostOnboardingCreator.ts`, protects staged-photo references for review, and records exactly one durable operator-notification attempt addressed to `info@webvisit360.com`. Email delivery runs after commit.

Creator adapter expected export:

```ts
export async function enqueueHostRecommendations(
  tx: unknown,
  input: {
    tenantId: string;
    submissionId: string;
    recommendations: Array<{ categoryKey: string; name: string }>;
  },
): Promise<{ proposalIds: string[] }>;

export function getHostOnboardingCategories(): Array<{ key: string; label: string }>;
```

Events retain their host-provided date and time in the immutable onboarding submission/review data. The backend does not invent or alter either value.