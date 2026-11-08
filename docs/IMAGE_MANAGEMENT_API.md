# Milestone 3 — product images

## Configuration

Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in the root ignored `.env` or backend secret manager. Get these from the Cloudinary Console API Keys page. Use a separate product environment for testing. Credentials are checked when upload/cleanup first runs; absent credentials return 503 `IMAGE_STORAGE_NOT_CONFIGURED`. No credentials or unsigned upload preset are supplied by this project.

`IMAGE_MAX_BYTES` defaults to 5242880 (5 MiB; configurable up to 20 MiB). `PRODUCT_MAX_IMAGES` defaults to 10 and may be reduced to 1–10, matching the database's ten-position constraint. Invalid limit configuration fails application creation. Sharp is the only added direct dependency; it already existed transitively in the lockfile.

The server calls Cloudinary's REST API with Node fetch and SHA-256 signed parameters, following the [official signature specification](https://cloudinary.com/documentation/authentication_signatures). Uploads use non-overwriting IDs `showroom/products/<database-product-id>/<random-UUID>`. Clients never supply an asset ID or URL. Cloudinary destroy requests include CDN invalidation; [Cloudinary notes that invalidation propagation is asynchronous](https://cloudinary.com/documentation/image_upload_api_reference).

## API

Every endpoint requires the existing owner session. All mutations require the configured Origin. Existing global rate limits apply; upload/replacement/cleanup additionally share 20 requests per minute per IP. All endpoints below begin with `/api/admin`.

| Method | Path | Body / result |
| --- | --- | --- |
| POST | `/products/:productId/images?alt=...` | Raw binary image; 201 `{ data: image }` |
| GET | `/products/:productId/images` | Ordered `{ data: images }` |
| PATCH | `/products/:productId/images/order` | `{ "imageIds": ["id1", "id2"] }`, complete permutation |
| PATCH | `/products/:productId/images/:imageId/primary` | `{}`, moves image to first position |
| POST | `/products/:productId/images/:imageId/replace?alt=...` | Raw binary image; 200 with `cleanup: "queued"` for old asset |
| DELETE | `/products/:productId/images/:imageId` | `{ "confirm": true }`; 202 `{ data: { detached: true, cleanup: "queued" } }` |
| POST | `/images/cleanup` | `{}`; processes up to 20 eligible tasks, returns completed/pending counts for that batch |

Upload one file per request. Upload several photos by repeating the upload call; this is not an atomic batch. Send `Content-Type: image/jpeg`, `image/png` or `image/webp`, with file bytes as the request body (not multipart, JSON/base64, or remote URLs). Filenames are not accepted or trusted. Alt text is optional, trimmed and capped at 500 characters.

Decoder validation requires genuine matching format, complete decodable content, a single frame and at most 25 million pixels. SVG, executables, misleading content types, unsupported/animated formats, truncated content and oversized input are rejected. Sharp decodes/re-encodes, strips metadata and appended payloads, applies EXIF orientation, and bounds dimensions to 3000×3000 without enlarging. Encoded output must also satisfy the byte limit. Product existence, archive/deletion state and image capacity are checked before remote upload and again under a product lock when attaching it.

Responses use existing structured error conventions: 401 unauthorized, 404 missing product/image, 409 capacity or archived-product conflict, 413 body too large, 422 invalid input/image, 503 missing Cloudinary configuration and 502 failed Cloudinary call. Provider error bodies and secrets never enter responses or logs.

## Model, ordering and replacement

The existing ProductImage gains nullable `format` and `bytes` (old records remain valid), plus `updatedAt`. Existing width, height, URL, alt text, public ID, product ID and creation timestamp are retained. New uploads populate all metadata. The primary indicator is **derived** as `isPrimary` from the first gallery position, avoiding contradictory stored flags. Empty galleries have no primary. Primary selection moves that image first and preserves the order of others.

Migration `20261102000200_image_management` adds metadata and the durable ImageCleanup table, and replaces the immediate unique position index with a deferred unique constraint. This permits complete reorder permutations atomically while preserving unique positions at commit. The existing position range 0–9 remains in force. No product, inventory, owner or session records are deleted or replaced.

Reorder requires every image ID for that product exactly once. Foreign, missing, duplicate and partial sets fail before writes. Product row locks serialize gallery edits and catalogue updates. Database failure rolls back the entire operation. Replacement uploads to a new UUID, then swaps metadata on the same image record at the same position. It never overwrites a live Cloudinary asset. The old asset is queued only in the successful replacement transaction.

Deletion detaches the record and compacts remaining positions transactionally, making the next image primary. Retries are idempotent and scoped to the supplied product. Deletion from archived/soft-deleted products is allowed explicitly; upload/reorder/replace are blocked. Product soft deletion itself retains gallery assets for record retention.

## Cleanup and recovery

Before upload, an ImageCleanup intent is committed with a 24-hour delay. Successful attachment consumes it in the same database transaction as the image write. Process crashes or upload timeouts leave durable recovery information. A known post-upload database failure makes the intent immediately eligible where possible; the original delayed task still exists if that scheduling update fails.

Replacement and deletion enqueue old assets in the same transaction that removes their references. Cleanup locks tasks, refuses deletion while any ProductImage references the public ID, validates the exact managed product namespace/UUID, and only then calls Cloudinary. Remote `not found` is success. Failures log only product identity and a generic message; tasks remain with exponential backoff from one minute up to one day. No client-provided identity can drive destruction. Legacy assets outside the managed namespace are deliberately retained for manual ownership review.

Run the bounded cleanup worker every minute using your hosting scheduler:

```powershell
npm run images:cleanup -w @showroom/api
```

It reads the root environment, processes at most 20 tasks, logs counts and exits nonzero on pending failures/configuration failure. Production can run the compiled entry `apps/api/dist/modules/images/cleanup.js`. Alternatively, the authenticated cleanup API processes a batch. No scheduler or deployment is configured by this milestone. Monitor the queue's age/attempts and increase run frequency for larger backlogs.

Deletion responses acknowledge database detachment and queued work, not completed cloud deletion. Replacement responses confirm the new image is attached but explicitly mark old-asset cleanup queued. There is no distributed transaction. A provider upload completing more than 24 hours after a timeout/terminated request could evade the delayed cleanup attempt; periodic provider inventory reconciliation is an operational follow-up, not implemented here. CDN invalidation and provider backups are also outside transaction guarantees. A lost upload response may cause a retry to create another image (bounded by capacity); callers should list the gallery before retrying an uncertain upload.

## Verification and boundaries

Automated tests use real PostgreSQL and real image decoding with a mocked ImageStorage adapter. Separate transport tests inspect signatures and simulate Cloudinary HTTP responses. No real Cloudinary account, upload or deletion was exercised. Supply real credentials and perform an upload/replace/delete smoke test plus CDN verification before production release.

Apply the migration using `npm run db:deploy`, generate with `npm run db:generate`, then run `npm test` with the existing isolated `SHOWROOM_TEST_DATABASE_URL`. Tests include rollback after an actual database constraint failure and concurrent upload capacity. See `VERIFICATION.md` for exact commands/results.

Frontend, category-image uploading, customer reference-image uploading, deployment, scheduled hosting jobs and full Cloudinary inventory reconciliation are outside this milestone. Recommended next milestone: collections and homepage CMS backend, including banner management, before frontend development.
