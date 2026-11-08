# Try-on overlay change — review package

8 November 2026. **Migration prepared, not applied. No database or Cloudinary mutations were performed.**

## Delivered code

The renderer initializes pixel-space camera bounds for every instance, independently of the reused canvas dimensions. This fixes reset, same-size photograph replacement and product-reselection projection failures. Each canvas has serialized render sessions; restarting aborts the previous session and waits for initialization cleanup. Cancellation releases models, textures, sprite materials, animation frames and abort listeners, including resources that finish loading after cancellation.

Camera resizing updates both drawing dimensions and projection bounds. Existing face/chin/shoulder positioning and calibration are reused. A piece whose rotated bounds extend beyond the photo is hidden with guidance instead of being moved onto an incorrect body region. Missing face/shoulder landmarks also hide the piece. Customer photo processing remains local. No storefront redesign was made.

The admin configuration now has a separate transparent PNG upload panel with a checkerboard preview, explicit actual-product confirmation, size/type guidance, replacement conflict protection, and confirmed removal. Gallery selection is no longer used for camera overlays. Legacy `overlayImageId` values and all existing gallery records/order remain untouched. The public fitting APIs use only a dedicated overlay whose product and jewellery type match; they never fall back to an opaque gallery image.

## Updated schema

The complete updated schema is `packages/database/prisma/schema.prisma`. The only addition inside the existing `ProductTryOnAsset` model is the optional inverse relation:

```prisma
  dedicatedOverlay TryOnOverlay?
```

This relation adds no column or data update to the existing table. The new model is:

```prisma
model TryOnOverlay {
  productId String @id
  configuration ProductTryOnAsset @relation(fields:[productId], references:[productId], onDelete:Restrict, onUpdate:Cascade)
  kind TryOnKind
  publicId String @unique
  url String
  format String @default("png")
  width Int
  height Int
  bytes Int
  validatedAt DateTime @db.Timestamptz(3)
  createdAt DateTime @default(now()) @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @db.Timestamptz(3)
}
```

Every addition explained:

- `productId`: primary key and foreign key to `ProductTryOnAsset.productId`. At most one dedicated overlay per product configuration. `ON DELETE RESTRICT` requires explicitly detaching the overlay before deleting its parent, avoiding silent storage orphaning. `ON UPDATE CASCADE` maintains the association if the key ever changes. Existing records are not modified.
- `configuration` and `dedicatedOverlay`: Prisma's two sides of the one-to-one relation, not additional SQL columns.
- `kind`: records the jewellery type validated at upload. The server rejects upload when it differs from the saved configuration; public previews also reject a mismatch after a later configuration change.
- `publicId`: unique Cloudinary asset identity. Supports safe replacement and attachment checks during cleanup.
- `url`: the HTTPS delivery URL returned by the existing Cloudinary storage adapter.
- `format`: defaults to `png`; upload validation only accepts real, nonanimated PNGs.
- `width`, `height`, `bytes`: sanitized output dimensions and size, derived by the server rather than accepted from the client.
- `validatedAt`: records when server-side transparency validation passed. It is not a certificate of product authenticity or visual fitting accuracy.
- `createdAt`: database creation timestamp, defaulting to the current time.
- `updatedAt`: Prisma-managed replacement timestamp. Both it and the other timestamps use millisecond precision with timezone.

No legacy column was removed, renamed, repurposed or backfilled. No gallery photograph is automatically promoted into the new table.

## Complete migration SQL — review only

File: `packages/database/prisma/migrations/20261108120000_add_try_on_overlay/migration.sql`

```sql
-- REVIEW ONLY: do not apply without separate approval.
-- Additive only: no backfill, no changes to ProductImage or ProductTryOnAsset rows.
CREATE TABLE "TryOnOverlay" (
    "productId" TEXT NOT NULL,
    "kind" "TryOnKind" NOT NULL,
    "publicId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'png',
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "bytes" INTEGER NOT NULL,
    "validatedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "TryOnOverlay_pkey" PRIMARY KEY ("productId")
);

CREATE UNIQUE INDEX "TryOnOverlay_publicId_key" ON "TryOnOverlay"("publicId");

ALTER TABLE "TryOnOverlay" ADD CONSTRAINT "TryOnOverlay_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "ProductTryOnAsset"("productId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

```

The SQL was compared with Prisma's schema-to-schema `migrate diff --script` output using local schema files only. The comparison required no database connection and generated the same table, index and foreign key. `prisma validate` passed. No migrate deploy/dev, db push, reset, seed or database-writing command was executed.

## Secure upload/replacement/cleanup

- Routes are owner-authenticated, same-origin protected, rate limited and no-store.
- `GET /api/admin/products/:id/try-on/overlay` returns the dedicated record or null. When the table is unavailable it returns HTTP 503 with `OVERLAY_SCHEMA_PENDING`, and the admin panel disables uploads and explains why.
- `POST` to the same path receives raw PNG bytes, `kind`, `expectedPublicId`, and explicit actual-product confirmation. Maximum input/output size is 5 MB. Existing secure image validation decodes and re-encodes the file, strips metadata/trailing payloads, rejects animated/mislabeled/invalid images, caps input at 25 million pixels and output at 3000 pixels per side.
- Extra validation requires dimensions of at least 32 × 32, at least 1% near-transparent pixels (alpha ≤ 8), and at least 1% substantially opaque pixels (alpha ≥ 200). It rejects opaque RGB/RGBA photos, empty transparent canvases and a token transparent pixel added to an opaque image.
- Transparency validation cannot prove that a cutout depicts the actual jewellery or that a bust has been removed correctly. The administrator must inspect it and confirm authenticity. No replacement jewellery was generated.
- Storage uses the existing authenticated Cloudinary adapter under `showroom/try-on-overlays/<productId>/<uuid>`. It creates no `ProductImage` records and never updates gallery positions or product fields.
- The existing `ImageCleanup` table holds durable upload intent before the external upload. Attachment occurs in a transaction after checking the product, saved kind and expected previous asset. Concurrent/stale replacements return a conflict rather than overwriting another administrator's upload.
- Old overlays and failed uploads are queued. Cleanup verifies the namespace and checks that a dedicated asset is not attached before destroying it. An uncertain commit never triggers immediate remote deletion. Cleanup failure retains the queue for retry.
- `DELETE` requires confirmation and the expected asset identity. It detaches only the dedicated overlay and queues its remote asset. Gallery photographs and legacy configuration references remain intact.

## Verification results

- Frontend suite: **84 passed**, no failures. Includes **6 new renderer/projection/lifecycle tests**.
- API suite: **74 passed**, no failures; **46 database integration tests skipped**. The database test connection was explicitly removed for these runs.
- Three additional tests execute the actual renderer with deterministic MediaPipe and WebGL adapters: repeated same-size fittings, missing face/shoulder landmarks, and cleanup after texture-loading failure. Combined renderer-specific additions: **9 passing tests**. These are code-level tests, not a real-camera or real-necklace visual accuracy claim.
- Upload tests cover actual PNG alpha preservation; opaque, empty, token-alpha, mislabeled and oversized rejection; product/type conflicts; replacement and removal; durable cleanup after uncertain saves; and protection of attached media.
- Route tests cover authentication, wrong-origin rejection, required confirmation and missing-migration messaging. Public catalogue tests verify no legacy-gallery fallback and no mismatched-type overlay exposure.
- API and frontend TypeScript checks passed.
- Prisma schema validation passed; Prisma client generation succeeded locally without applying SQL.
- Production build passed. The first build encountered a Windows output-directory permission error; retrying with appropriate filesystem access passed. API compilation, Next.js compilation, TypeScript and page generation completed.

## Admin workflow screenshots

These show the **actual production upload component** in an isolated browser harness. The request adapter stores fixture state in memory; PNG validation uses the production validator. There is no database or Cloudinary connection. A clearly labelled geometric test PNG is used, not a real jewellery product or a fabricated successful fitting.

- `docs/verification/overlay-workflow/admin-empty.jpg`: empty dedicated overlay state.
- `docs/verification/overlay-workflow/admin-selected-png.jpg`: local transparency preview and confirmation before upload.
- `docs/verification/overlay-workflow/admin-saved-fixture.jpg`: accepted in-memory fixture with replacement/removal controls.
- `docs/verification/overlay-workflow/admin-opaque-rejected.jpg`: server rejects an opaque PNG replacement and retains the saved fixture.
- `docs/verification/overlay-workflow/admin-mobile-preview.jpg`: 390px mobile preview. No horizontal overflow was observed.

Browser checks exercised upload, opaque replacement rejection, refresh and confirmed removal. The isolated preview server was stopped afterwards. Its temporary helpers and generated fixtures remain under ignored `.local/` only; no test route was added to the storefront.

## Modified and created files

Modified:

1. `packages/database/prisma/schema.prisma`
2. `apps/api/src/app.ts`
3. `apps/api/src/modules/images/service.ts`
4. `apps/api/src/modules/tryon/routes.ts`
5. `apps/api/src/modules/tryon/settings.ts`
6. `apps/api/src/modules/tryon/studio.test.ts`
7. `apps/api/src/modules/tryon/integration-cases.ts` — future isolated integration fixture updated; not executed.
8. `apps/web/src/components/admin/try-on.tsx`
9. `apps/web/src/lib/try-on/renderer.ts`

Created:

10. `packages/database/prisma/migrations/20261108120000_add_try_on_overlay/migration.sql`
11. `apps/api/src/modules/tryon/overlay.ts`
12. `apps/api/src/modules/tryon/overlay.test.ts`
13. `apps/api/src/modules/tryon/overlay-routes.test.ts`
14. `apps/api/src/modules/tryon/renderer.test.ts`
15. `apps/web/src/components/admin/try-on-overlay.tsx`
16. `apps/web/src/lib/try-on/render-state.ts`
17. `apps/web/tests/try-on-renderer.test.mts`
18. This report and the five screenshots listed above.

Generated Prisma client and build outputs were refreshed locally; they are not database changes.

## Pending approval and remaining blockers

**Stop point reached: the migration remains unapplied.** Deploying the new overlay-backed API before applying the approved migration would leave its new-table queries unavailable. Review SQL first and coordinate a separately authorized migration/application rollout. Do not use the existing cleanup job for real new-overlay records until the matching cleanup code is deployed.

Pending checks requiring an applied migration on an approved isolated database:

- Real foreign-key/unique constraints and transactional rollback behavior.
- Persistence across upload, replacement, stale concurrent requests, removal and process restart.
- Cleanup queue row-lock coordination and recovery after uncertain commits.
- Full authenticated admin/gallery invariance and catalogue availability integration.
- The 46 existing database integration cases, including the updated try-on fixture.

Also pending: real Cloudinary upload/replacement/cleanup verification, an administrator-supplied accurate transparent cutout of the actual necklace, its calibration, and visual fitting on a suitable non-personal test photograph and real devices. No real necklace-fitting screenshot is supplied because that outcome has not been achieved or verified. The provider configuration remains unchanged; local fittings do not require Gemini.
