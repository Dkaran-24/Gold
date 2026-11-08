# Homepage CMS — Milestone 4

## Data and publishing workflow

HomepageSection and Banner are the mutable draft. HomepageVersion is an immutable JSON snapshot of those draft rows. There is no live homepage until the first successful publish; the public API returns `version: null`, empty sections and empty banners. No sample business content is seeded.

1. Create/edit sections and banners through owner endpoints.
2. Inspect `/api/admin/homepage/draft` for complete draft records, including inactive/scheduled content.
3. Inspect `/api/admin/homepage/preview` for the draft rendered using current visibility and schedule rules.
4. POST `{}` to `/api/admin/homepage/publish`. Every draft section and banner is revalidated, including inactive records and managed references. A new version and publishing audit record commit together.
5. `/api/homepage` reads the latest committed version, never the draft tables. A failed validation or database/audit operation leaves the previous version untouched.

CMS mutations and publishes serialize with a PostgreSQL transaction advisory lock. Public reads use a repeatable-read transaction, avoiding mixed database states while rendering a response. All CMS responses use `Cache-Control: no-store` so schedules and withdrawals are evaluated at request time.

## Endpoints

All `/api/admin` endpoints require the existing owner session; mutations also require configured Origin. Existing rate limits apply. Creation returns 201, successful changes 200 and deletion 204. Errors follow existing 401/404/409/422 conventions.

| Method | Path | Behavior |
| --- | --- | --- |
| POST | `/api/admin/homepage/sections` | Create section |
| GET | `/api/admin/homepage/sections` | Paginated draft section list |
| PATCH | `/api/admin/homepage/sections/:id` | Edit; enabled controls activation |
| DELETE | `/api/admin/homepage/sections/:id` | `{ "confirm": true }`; remove from draft only |
| POST | `/api/admin/homepage/sections/order` | `{ "ids": [...] }`; exact complete permutation |
| POST | `/api/admin/homepage/banners` | Create campaign banner |
| GET | `/api/admin/homepage/banners` | Paginated draft banner list with CURRENT/FUTURE/EXPIRED scheduleState |
| PATCH | `/api/admin/homepage/banners/:id` | Edit, activate/deactivate, publish/unpublish in draft |
| DELETE | `/api/admin/homepage/banners/:id` | `{ "confirm": true }`; remove from draft only |
| POST | `/api/admin/homepage/banners/order` | `{ "ids": [...] }`; exact complete permutation |
| GET | `/api/admin/homepage/draft` | Full draft for editing |
| GET | `/api/admin/homepage/preview` | Eligible draft content, owner only |
| POST | `/api/admin/homepage/publish` | `{}`; returns version and publishedAt |
| GET | `/api/homepage` | Current published homepage, version and timestamp |
| GET | `/api/banners` | Paginated currently eligible banners from the published snapshot |

Lists use page/limit (defaults 1/24; maximum limit 100) and return `{ data, pagination }`. Other responses use `{ data }`. Section IDs retain the existing schema name `key` in draft records; public sections expose it as `id`. Order endpoints take IDs, never positions. Unknown input fields and incomplete/duplicate/foreign order sets are rejected.

## Section fields and types

Every section requires type, internalName and heading. Optional fields: subtitle, description, ctaLabel, ctaPath, productId, collectionId, desktopImageId, mobileImageId, enabled, startsAt and endsAt. New sections default inactive. Position is assigned on creation; use the order endpoint to change it. Existing key/content fields are preserved internally; arbitrary content JSON cannot be submitted or leaked publicly.

| Type | Validation / resolved content |
| --- | --- |
| HERO | Desktop image required; optional mobile image and paired CTA |
| FEATURED_COLLECTIONS | Optional single collectionId, otherwise first 12 public collections in display order |
| NEW_ARRIVALS | Up to 12 eligible products with arrival <= now < expiry, newest first |
| FEATURED_PRODUCTS | Optional single productId, otherwise up to 12 public featured products, newest first |
| BRIDAL | Published, visible bridal collectionId required |
| PROMOTIONAL | Desktop image required; optional paired CTA |
| CUSTOM_JEWELLERY | CTA text and destination required |
| APPOINTMENT | CTA text and destination required |
| EDITORIAL | Nonempty description required |

Product references are accepted only on FEATURED_PRODUCTS; collection references only on FEATURED_COLLECTIONS/BRIDAL. References must be publicly eligible when saved and again on publish. Product lists with bespoke ordering can be represented by collections rather than arbitrary JSON arrays. Text is plain content, not trusted HTML; future frontend consumers must render/escape it as text.

CTA destinations must be relative website paths beginning with a single `/`; external protocols, protocol-relative URLs, backslashes and encoded slash/newline forms are rejected. Section CTA text and path must be supplied together.

## Banners and timezone

Banner fields: internalName, heading, subtitle, desktopImageId, mobileImageId, imageAlt, ctaLabel, ctaPath, active, publication, startsAt and endsAt. Desktop image, imageAlt and CTA text/path are required. Mobile image is optional. New banners default inactive and DRAFT; set `active: true` and `publication: "PUBLISHED"` and publish the homepage to expose them. Banner edits never bypass the homepage publishing boundary.

Dates accept ISO-8601 strings with explicit offset or Z; PostgreSQL stores timestamptz/UTC. For an Indian 10:00 start, clients can submit `2026-11-10T10:00:00+05:30`. Public eligibility is active AND PUBLISHED AND start <= now AND end > now. Null start means no lower bound; null end means no expiry. If both dates exist, end must be strictly later. Expiry is enforced at read time without a cron job. Section schedules use the same inclusive-start/exclusive-end rule with enabled status.

## Images and live reference safety

Image IDs refer to the existing ProductImage system, not arbitrary external URLs. Collection covers/banners and draft section/banner desktop/mobile references have restrictive FKs; an image still referenced by draft CMS or a collection cannot be deleted. Detach the CMS reference first. No Cloudinary rewrite or second upload mechanism is added.

Snapshots freeze text, layout, scheduling and reference IDs, not catalogue/media contents. Public rendering resolves referenced images and products with current visibility rules. Withdrawing a product/collection suppresses its dependent content immediately; missing desktop images suppress the section/banner, while missing mobile images return null. Collections and product feeds remain live. Replacing an image through the existing image API updates every reference to that image ID. Previous snapshots are retained, but may render differently after independent catalogue/image changes; snapshots are not media backups.

Removing an image reference from the draft can allow later image deletion even if an old snapshot references it; public resolution safely omits that content. There is no snapshot rollback endpoint, slug redirect history, standalone CMS-media uploader or history retention job in this milestone. Legacy draft rows remain stored and may need explicit migration to valid typed content/managed images before publishing.

## Verification and next milestone

Use the existing environment and isolated test cluster, then run `npm run db:generate`, `npm run db:deploy`, `npm test` (with SHOWROOM_TEST_DATABASE_URL), `npm run db:validate`, `npm run typecheck`, `npm run build`, and `npm audit`. The new migration is `20261102000300_cms`.

Tests exercise scheduling boundaries, CTA safety, type rules, collection operations, references, ordering, activation, preview authorization, atomic publishing, draft isolation and preservation of the old version after failed publication. Existing authentication, catalogue and image tests remain in the same suite. Cloudinary is still mocked; no real-account verification is claimed.

Recommended next milestone: **Customer enquiry and appointment backend** — validated contact/product enquiries, callback requests, appointment requests with owner approval/rescheduling, CRM statuses/notes and PostgreSQL integration tests. Frontend and deployment remain deferred.
