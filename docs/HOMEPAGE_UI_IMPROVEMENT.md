# Homepage UI improvement and content readiness

5 November 2026. Frontend changes implemented; no deployment or database/configuration changes.

## Diagnosis before changes

The running API returned HTTP 500 for `/api/homepage`, `/api/categories`, `/api/collections`, `/api/products?featured=true&limit=4` and `/api/products?newArrival=true&limit=4`. A read-only connection using the existing root environment returned Prisma P1000 (database authentication rejected) for the configured local database on port 5432. Credentials were not printed or changed. Therefore the live inventory and publication state could not be established; a failed request is not evidence of an empty database.

The frontend handled these failures by placing the same shared “A little pause” component in every section. “Latest stories” refers to homepage CMS content, not an additional stories endpoint. The public response envelopes matched the existing frontend contracts in controlled rendering checks. The current incident is an unavailable backend/data connection, amplified by repetitive frontend error presentation; no response-shape bug was established.

## Changes

- Preserved ivory, champagne and brown styling, the existing logo/navigation/footer, serif typography and the headline “Some things become a part of you.”
- Replaced the oversized monogram artwork with a properly proportioned campaign image area. Existing published CMS desktop/mobile imagery remains authoritative; the unpublished default can reuse an actual featured-product image. When no suitable asset is accessible, the user-approved editorial placeholder states that a campaign photograph is pending. A small SR signature remains secondary.
- Added a showroom-visit CTA beside jewellery browsing. Existing appointment/enquiry flows remain unchanged.
- Added one live-content availability summary identifying failed sources, plus compact section-specific failure states and real page-retry links. Failures are not silently hidden or interpreted as empty successes.
- Kept separate polished empty states for successful responses with no categories, featured products, collections or arrivals. Existing route-level skeleton loading remains active and was observed during retry.
- Default sequence: hero, categories, featured jewellery, collections, new arrivals, brand story, custom jewellery, appointment and footer. Published owner CMS sections remain authoritative; the primary hero renders first and other published sections preserve their relative ordering.
- Product cards retain actual public catalogue images, category, name, approved price rules, availability and wishlist; added explicit details and product-enquiry links. Responsive image sizing and image-failure handling reuse the existing Media component.
- No reviews, ratings, certifications, product details, external imagery or business claims were invented.

## Files

Modified:

- `apps/web/src/app/(storefront)/page.tsx` — homepage composition, source availability and section order.
- `apps/web/src/components/home-sections.tsx` — image-ready hero, secondary CTA and small signature.
- `apps/web/src/components/cards.tsx` — product details/enquiry actions.
- `apps/web/src/app/globals.css` — shared hero/card presentation.

Created:

- `apps/web/src/app/(storefront)/homepage.css` — scoped spacing, availability and empty-state presentation.
- `apps/web/tests/homepage-render.mjs` — isolated production-render checks, with explicit test-only fixtures and no database writes.
- This report and screenshots in `docs/verification/homepage/`.

No database credentials, Prisma migrations, security configuration or production configuration were modified. No dependency was added.

## Verification

- `npm run typecheck`: passed for both applications.
- `npm test -w @showroom/web`: 44 tests passed, including public-price visibility, wishlist, request validation and existing frontend regression coverage.
- `npm run build`: Prisma client generation, backend TypeScript build and Next.js webpack production build passed. No migrations were run.
- `node apps/web/tests/homepage-render.mjs`: four scenario checks passed against an isolated loopback-only test upstream and built frontend: upstream failure, successful empty catalogue/default order, product card pricing/actions, and published CMS authority. These fixtures never enter the application database or runtime configuration files.
- Browser review used the actual failing backend, not fake success responses. Desktop/mobile screenshots show the honest placeholder and availability state. The retry action re-entered the existing loading UI. No browser console errors were captured during the reviewed homepage flow.
- No horizontal overflow at 1440, 1024, 768, 390 or 360 pixels; no broken image elements in the observed fallback state. Live-photo cropping and a populated real catalogue still need acceptance after backend/content restoration.

Screenshot evidence:

- [Desktop full page](verification/homepage/desktop.jpg)
- [Desktop hero](verification/homepage/desktop-hero.jpg)
- [Mobile full page](verification/homepage/mobile.jpg)
- [Mobile hero](verification/homepage/mobile-hero.jpg)

## Unresolved dependencies — separate from UI work

**Backend:** the configured database rejects authentication. Restoring the existing approved database connection is required before real categories/products/collections/CMS and WhatsApp contact settings can load. This UI task deliberately did not change credentials or database configuration. The live data is unknown, not declared empty.

**Content:** an approved campaign photograph is still required, as confirmed by the user. Supply/upload it through the existing CMS image workflow and publish the hero, with a mobile crop if needed. No stock or generated image was substituted. Review accessible genuine catalogue imagery and featured/new-arrival flags when the database connection is restored.

**Release acceptance:** verify the populated homepage with genuine photographs, published CMS ordering, product enquiries, wishlist and conditional prices after data access is restored. The existing unspecified canonical-domain metadata warning is unrelated to this task. Nothing was deployed.
