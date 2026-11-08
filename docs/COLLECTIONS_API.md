# Collections API — Milestone 4

Collections reuse Collection and CollectionProduct. A product can belong to multiple collections; their composite primary key rejects duplicate membership. New collection fields: publication (DRAFT/PUBLISHED), archivedAt, seoTitle, seoDescription, coverImageId and bannerImageId. Image references point to existing ProductImage records with restrictive foreign keys. Legacy URL fields are preserved in the database but cannot be written through these APIs and are not used publicly.

## Endpoints

| Method | Path | Input / behavior |
| --- | --- | --- |
| POST | `/api/admin/collections` | Create; name and unique slug required |
| GET | `/api/admin/collections` | Paginated list including archived/draft records |
| GET | `/api/admin/collections/:id` | Details and paginated ordered product membership |
| PATCH | `/api/admin/collections/:id` | Details, slug, publication, visibility, bridal flag or image associations |
| DELETE | `/api/admin/collections/:id` | `{ "confirm": true }`; archive, hide and unpublish, 204 |
| POST | `/api/admin/collections/order` | `{ "ids": [...] }`; all nonarchived collection IDs in desired order |
| POST | `/api/admin/collections/:id/products` | `{ "productId": "..." }`; append association, 201 |
| DELETE | `/api/admin/collections/:id/products/:productId` | `{}`; remove membership, idempotent 204 |
| PATCH | `/api/admin/collections/:id/products/order` | `{ "ids": [...] }`; all member product IDs exactly once |
| GET | `/api/collections` | Paginated published/visible/nonarchived collections |
| GET | `/api/collections/:slug` | Published details and paginated eligible products |

List/detail queries accept page (default 1) and limit (default 24, maximum 100). Responses use `{ data, pagination }`; mutations use `{ data }` except 204 deletes. Ordering is display position then stable ID. Invalid input is 422, missing records 404, duplicates/references 409, unauthenticated requests 401.

## Fields and publication

Create/PATCH fields: name, slug, description, coverImageId, bannerImageId, seoTitle, seoDescription, bridal, visible and publication. Name/slug are required on creation. Nullable references and SEO fields may be cleared. Slugs are lowercase alphanumeric words separated by hyphens. Changes retain the collection ID and all membership; the previous slug stops resolving (redirect aliases are not implemented). Publication defaults to DRAFT. Publish/unpublish through PATCH with `publication: "PUBLISHED"` or `"DRAFT"`.

Images must already belong to a publicly eligible product. Upload them using the existing Milestone 3 endpoints; no new uploader or external URL input exists. Cover/banner images are optional. Archiving preserves products and images and blocks further collection edits; restoration is not exposed in this milestone.

Draft products may be attached to collections so the owner can prepare membership. Deleted/archived products cannot be added. Public membership always rechecks product publication, soft deletion, availability and category visibility, using the existing catalogue allowlist and hidden-price suppression. Unpublished and archived collections never appear publicly.

All association/order mutations run transactionally under a shared CMS advisory lock. Deferred uniqueness on collectionId/position permits safe permutations; invalid, missing or duplicate reorder IDs fail atomically. Create, update, archive and homepage publishing write audit records. Existing authentication, same-origin mutation checks, rate limiting and safe error handling remain in force.

## Migration and verification

Migration `20261102000300_cms` extends existing records and adds indexes/FKs without deleting products, owners or image data. Existing collection memberships are assigned deterministic dense positions before adding the ordering constraint. PostgreSQL tests cover creation, duplicate slug/membership, safe slug update, add/remove/reorder, publication, public product filtering and archive preservation. See `VERIFICATION.md` for final results.
