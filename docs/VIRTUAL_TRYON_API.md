# Virtual try-on API

**IMPLEMENTED.** Paths below start with `/api`. JSON replies use `{data: ...}`; errors use the existing safe error envelope. All mutations require the existing exact allowed Origin. Admin routes require the existing owner session. All try-on responses use private/no-store cache headers.

| Method and path | Contract |
| --- | --- |
| GET /try-on/products | Eligible published pieces: id, name, SKU, slug. No private product fields. |
| GET /try-on/products/:id/config | Eligibility, enabled modes, kind, approved overlay/calibration, upload limit, retention, consentVersion and providerConfigured. Issues or refreshes the same anonymous HttpOnly ownership cookie. |
| POST /try-on/photo | Raw JPEG/PNG/WebP body. Strict query: productId, consent=true, consentVersion=tryon-photo-v1. Required Idempotency-Key UUID and guest cookie. Returns 202 with job DTO. |
| GET /try-on/jobs/:id | Owned, unexpired job DTO. Foreign/missing/expired jobs return 404. |
| POST /try-on/jobs/:id/retry | Empty JSON body. One explicit retry for eligible failed jobs. Returns 202; exhausted or interrupted jobs are rejected. |
| DELETE /try-on/jobs/:id | Empty body. Immediately revokes access, removes private files and metadata; 204. Repeated/expired deletion returns 404. |
| GET /try-on/jobs/:id/result | Requires owner cookie plus until and signature query parameters from the job DTO. Streams validated image; signature is valid for at most five minutes. |
| GET /admin/try-on/settings | Settings plus providerConfigured and selected model. No key. |
| PATCH /admin/try-on/settings | Strict nonempty partial settings payload; validates categories and records audit event. |
| GET /admin/try-on/analytics | total, succeeded, failed, queued, processing attempt counts. No customer images or job identifiers. |
| GET /admin/products/:id/try-on | Current product calibration or disabled defaults. |
| PATCH /admin/products/:id/try-on | Strict nonempty partial product settings; validates image belongs to this product and audits save. |

Job DTO: id, status (QUEUED/PROCESSING/COMPLETED/FAILED), expiresAt, errorCode, canRetry and resultUrl (null until completed). A signed URL is not sufficient without the guest cookie. Refresh the job DTO to renew a result link.

Settings: photoEnabled, arEnabled, eligibleCategoryIds (up to 500 unique IDs), maxUploadMb (1–20), retentionHours (1–72), dailyLimit (1–10,000). Initial modes are disabled and eligible categories empty.

Product settings: enabled, kind (EARRINGS or NECKLACE), overlayImageId (nullable), scale (0.1–3), offsetX/offsetY (-1–1), rotation (-180–180 degrees). Overlay must be the product's own PNG/WebP. Transparency and physical calibration require human review.

Admission/retry uses a 30-per-15-minute IP limit plus the global UTC-day attempt budget. Reusing an idempotency key for identical sanitized input returns the same job; different input returns 409. Validation errors return 422, unsupported content 415, oversized payload 413, daily/rate quota 429 and missing provider 503. Eligibility is checked again at dispatch and result access.
