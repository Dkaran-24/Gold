# Milestone 2: catalogue API

All routes return `{ data }` on success except DELETE (204). Lists also return `pagination: { page, limit, total, pages }`. Validation errors are 422, unauthenticated requests 401, missing records 404, and duplicate keys/referenced categories 409. Existing exact-Origin checks apply to every mutation. Admin routes reuse the existing owner session cookie.

## Routes

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/products` | Public catalogue |
| GET | `/api/products/:slug` | Public details |
| GET | `/api/categories` | Visible categories |
| GET | `/api/admin/products` | Owner catalogue including drafts and archived items |
| POST | `/api/admin/products` | Create physical item and initial inventory history |
| GET | `/api/admin/products/:id` | Owner details, images and private information |
| PATCH | `/api/admin/products/:id` | Partial update; omitted fields stay unchanged |
| DELETE | `/api/admin/products/:id` | Soft deletion, unpublish and archive; requires `{ "confirm": true }` |
| PATCH | `/api/admin/products/:id/publication` | `{ "publication": "PUBLISHED" }` or `DRAFT` |
| PATCH | `/api/admin/products/:id/inventory` | `{ "availability": "RESERVED", "reason": "Customer reservation" }` |
| GET | `/api/admin/products/:id/inventory-history` | Paginated history, including soft-deleted products |
| GET | `/api/admin/categories` | All categories |
| POST | `/api/admin/categories` | Create category |
| PATCH | `/api/admin/categories/:id` | Partial category update |
| DELETE | `/api/admin/categories/:id` | Delete empty category; requires `{ "confirm": true }` |

## Product creation

```json
{
  "name": "22K floral pendant",
  "sku": "PENDANT-0001",
  "slug": "22k-floral-pendant-0001",
  "description": "A floral pendant in yellow gold.",
  "categoryId": "ID_RETURNED_BY_CATEGORY_API",
  "metal": "GOLD",
  "purity": "22K",
  "grossWeight": 10.125,
  "netWeight": 9.5,
  "enquiryOnly": true
}
```

Required fields: name, SKU, slug, categoryId, metal, purity, grossWeight and netWeight. Metal is GOLD, SILVER, PLATINUM or MIXED. SKU and slug are unique. Slugs contain lowercase letters, numbers and single hyphens. Requests reject unknown fields, including private costs, IDs and deletion timestamps.

Optional fields: description, stoneWeight, stoneDetails, diamondDetails, gemstoneDetails, hallmark, huid, publicPrice, publicMakingCharge, enquiryOnly, availability, publication, featured, exclusive, arrivalDate, newUntil, seoTitle and seoDescription. Money accepts nonnegative JSON numbers with up to two decimal places; weights accept three decimal places. Responses serialize Prisma decimals as strings to preserve precision. Net weight cannot exceed gross weight. `enquiryOnly: false` requires publicPrice.

Newness is derived from arrivalDate <= current time < newUntil. Supply offset-aware ISO timestamps; clear newUntil to remove new-arrival status. Expiry never deletes a product. Public responses include computed `newArrival`.

Publication defaults to DRAFT. Availability defaults to AVAILABLE and also supports RESERVED, SOLD and ARCHIVED. Archiving through an update automatically unpublishes; restoring availability does not republish. Archived products cannot be published. Soft deletion retains the SKU, product data, audit records and inventory history, removes the product from normal owner/public reads, and prevents further editing. No hard-delete or restore-deleted endpoint is included.

## Queries

Product lists accept `page` (default 1), `limit` (default 24, maximum 100), `search` (case-insensitive name/SKU/description), `categoryId`, `metal`, `purity`, `availability`, `featured`, `newArrival`, `minPrice`, `maxPrice`, `minWeight`, `maxWeight` and `sort`. Boolean query values must be `true` or `false`. Weight filters use gross weight. Sort values: latest (default), oldest, name, price-asc, price-desc. ID provides a deterministic sorting tie-breaker. Only admin lists accept `publication`.

Price filtering and sorting exclude enquiry-only products, so hidden prices cannot be inferred from ordering or counts. Public responses never expose privateDetails, internal cost data, inventory history, publication/deletion metadata or image storage IDs. Enquiry-only public prices and making charges return null. Public listings/details require a published, nondeleted, nonarchived product in a visible category. RESERVED and SOLD items remain visible with their actual availability.

Categories accept name, slug, description, imageUrl (HTTPS or null), visible and sortOrder. Image URLs are stored as metadata only; the API does not download or upload images. Cloudinary ownership and uploads are explicitly deferred. Category lists accept page, limit and search and sort by sortOrder then ID.

Category deletion is protected by the existing foreign key, including products that are archived or soft-deleted. Reassign editable products with their categoryId update before deleting an empty category. A category containing retained soft-deleted products must be kept (it may be hidden). No cascade deletes or automatic reassignment are performed.

## Transactions and verification

Creation writes the product, initial history and audit record atomically. Updates lock the existing product row with parameterized `SELECT ... FOR UPDATE`, validate the merged state, and commit the product, actual status transition and audit together. Repeating the same inventory status does not add misleading history. Category mutations are audited in the same transaction. Existing models and SQL constraints suffice: no schema change or migration is needed.

The PostgreSQL integration suite covers creation, duplicates, validation, updates, permissions, publication, private-field/price exclusion, inventory transitions and concurrent writes, preserved deletion history, category management, search, pagination, sorting and dynamic new-arrival expiry. See `VERIFICATION.md` for results.

## Next milestone

Milestone 3 — Cloudinary image-management backend: server-side authenticated uploads, signature/type/size checks, at most ten product images, primary/order/replace/remove operations, ownership validation, cleanup and integration tests. No Cloudinary or frontend implementation is part of Milestone 2.
