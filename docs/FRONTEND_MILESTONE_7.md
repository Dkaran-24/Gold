# Milestone 7 — Customer frontend

Verified on 3 November 2026. Implemented directly in the existing `apps/web` workspace. The Express authentication, business modules, Prisma schema and all four existing migrations were preserved. No dependency installation, architecture replacement, admin dashboard or deployment was performed.

## Inspection and integration boundaries

Inspected the original Next.js setup page, layout/styles, configuration, workspace dependencies, Prisma models, API routes/validators/public DTOs, and VERIFICATION, COLLECTIONS_API, HOMEPAGE_CMS_API, ENQUIRIES_API and APPOINTMENTS_API documentation before implementation.

Milestones 1–5 are present. Milestone 6 website-settings/account-recovery endpoints are not present. The only public showroom contact configuration is WhatsApp number and timezone from `/api/contact-options`. The frontend therefore does not fabricate an address, directions, opening hours, email address, social accounts, business history, awards, certifications, reviews or product records.

## Implemented pages

| Route | Functionality |
| --- | --- |
| `/` | Published CMS hero/sections/banners, categories, collections, featured/new-arrival jewellery, editorial/custom/appointment sections, conditional WhatsApp CTA and shared footer. With no published snapshot, truthful introductory copy and live catalogue queries provide an empty-capable fallback. |
| `/products` | Search by name/SKU/description; category, metal, availability, new-arrival and featured filters; supported sorting; 12-item pagination; public price/availability; collapsible mobile filters; collection navigation. URL parameters preserve selections between pages. |
| `/products/[slug]` | Public detail, image gallery and thumbnails, available specifications, SKU, price visibility, inventory state, wishlist, contextual product enquiry, configured WhatsApp, custom-design/appointment links and related pieces. Withdrawn/missing products render not-found. |
| `/collections` | Paginated published collections, covers, descriptions and bridal labels. |
| `/collections/[slug]` | Collection banner/description and its paginated, ordered public products. |
| `/wishlist` | Add/remove, persistent guest storage, cross-tab updates, live public eligibility checks, removable unavailable entries and storage-failure notice. Only validated slugs are stored; maximum 100 items. |
| `/about` | Published EDITORIAL content when present; otherwise truthful introductory copy and enquiry links. No invented showroom history. |
| `/contact` | General enquiry, conditional configured WhatsApp, visit request and receipt-status links. No fake address, directions or social links. |
| `/custom-jewellery` | Customer contact, jewellery type, design description, contact preference, consent, Zod validation and real submission receipt. |
| `/appointments` | Contact, preferred local date/time, purpose, visitors, optional note, consent and real request receipt. Explicitly REQUESTED, never represented as a confirmed reservation. |
| `/request-status` | Private reference/token POST lookup for enquiries and appointments, including safe status and requested/proposed/scheduled times. |

Root loading, error and not-found boundaries are included. Pages have meaningful metadata; products/collections use their actual SEO fields. Wishlist/status and unavailable records are not indexed. No invented public domain is used for canonical URLs.

## Components and implementation

- `site-header.tsx`, `site-footer.tsx`: shared identity, navigation, accessible mobile menu, search, wishlist count and contextual contact links.
- `cards.tsx`, `media.tsx`, `gallery.tsx`: product/collection cards, aspect-ratio fallbacks, Cloudinary image optimization, responsive CMS sources, labelled gallery controls and lazy loading.
- `home-sections.tsx`: all nine existing CMS types and published campaign banners. A real published snapshot controls its editorial sections; hidden sections are not replaced with default duplicates.
- `filter-panel.tsx`, `collection-select.tsx`: mobile filter disclosure/search focus and supported collection browsing.
- `wishlist-button.tsx`, `wishlist.tsx`: validated browser storage, memory fallback, live product revalidation, explicit rate-limit/offline states and removal.
- `request-forms.tsx`, `status-form.tsx`: React Hook Form/Zod, required-field semantics, field errors, pending states, consent, successful receipts and private lookup. All form elements declare POST so a failed/missing JavaScript handler cannot put customer details or tokens in a GET query.
- `ui.tsx`: breadcrumbs, section/page introductions, empty/error states, pagination and validated WhatsApp links.
- `lib/types.ts`, `api.ts`, `server-api.ts`, `catalogue.ts`, `forms.ts`: public response types, centralized requests, per-render deduplication, safe errors, formatting, query allowlists and request payload construction.

The design uses warm ivory, champagne/gold and dark brown with Georgia serif headings, system sans-serif body text, spacious responsive grids and reduced-motion support. No remote font download is required to build. Normal catalogue pages are server-rendered; only interaction boundaries are client components.

## Actual API endpoints integrated

| Method | Endpoint | Use |
| --- | --- | --- |
| GET | `/api/homepage` | Published section/banner snapshot, live eligible references, About editorial |
| GET | `/api/categories` | Category browsing/filter choices; option lists traverse pagination |
| GET | `/api/products` | Catalogue, related products and fallback homepage selections |
| GET | `/api/products/:slug` | Details, metadata and wishlist revalidation |
| GET | `/api/collections` | Collection listing and collection choices |
| GET | `/api/collections/:slug` | Ordered, paginated collection products and metadata |
| GET | `/api/contact-options` | Configured WhatsApp/timezone or null |
| POST | `/api/enquiries/product` | Product enquiry with actual product ID; server snapshots name/SKU |
| POST | `/api/enquiries/general` | Contact enquiry |
| POST | `/api/enquiries/custom` | Custom enquiry; jewellery type maps to the supported subject field |
| POST | `/api/appointments` | Preferred appointment request with an explicit UTC timestamp |
| POST | `/api/enquiries/status` | Private customer receipt lookup |
| POST | `/api/appointments/status` | Private appointment receipt lookup |

Browser requests use the existing Next.js `/api` rewrite. Server reads use `API_INTERNAL_URL` and `cache: no-store`. No admin endpoints, authentication cookies or server secrets are read into client data. Receipt tokens stay in component memory and are copied only by an explicit user action. No automatic mutation retry occurs because the backend does not provide idempotency.

## Files created

Under `apps/web/src/app/`:

- `about/page.tsx`, `appointments/page.tsx`, `collections/page.tsx`, `collections/[slug]/page.tsx`
- `contact/page.tsx`, `custom-jewellery/page.tsx`, `products/page.tsx`, `products/[slug]/page.tsx`
- `request-status/page.tsx`, `wishlist/page.tsx`
- `loading.tsx`, `error.tsx`, `not-found.tsx`, `icon.svg`

Under `apps/web/src/components/`:

- `cards.tsx`, `collection-select.tsx`, `filter-panel.tsx`, `gallery.tsx`, `home-sections.tsx`
- `media.tsx`, `request-forms.tsx`, `site-footer.tsx`, `site-header.tsx`, `status-form.tsx`
- `ui.tsx`, `wishlist-button.tsx`, `wishlist.tsx`

Under `apps/web/src/lib/`: `api.ts`, `catalogue.ts`, `forms.ts`, `server-api.ts`, `types.ts`.

Tests: `apps/web/tests/storefront.test.mts`, `fixture.mjs`, `integration-smoke.mjs`.

Documentation: this report and the screenshots in `docs/screenshots/milestone-7/`. Next.js generated `apps/web/AGENTS.md` during its first dev run; its installed documentation guidance was read and retained.

## Files modified

- `apps/web/src/app/page.tsx`: replaced the foundation setup screen with the storefront.
- `apps/web/src/app/layout.tsx`: shared shell, metadata, skip link and live rendering.
- `apps/web/src/app/globals.css`: complete responsive design system.
- `apps/web/next.config.ts`: HTTPS Cloudinary image allowlist; original rewrite and configuration retained.
- `apps/web/package.json`: added the dependency-free frontend test command.
- `apps/web/next-env.d.ts`: refreshed automatically by Next.js type generation.
- `README.md`, `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION_STATUS.md`, `docs/VERIFICATION.md`: current frontend behavior, evidence and remaining dependencies.

No files under `apps/api/src` or `packages/database/prisma` were modified. There are no database/schema/migration changes and no new package dependencies. Build outputs and temporary fixture state remain ignored.

## Tests and results

| Check | Result |
| --- | --- |
| `npm run typecheck` | API and web passed |
| `npm test` with isolated `SHOWROOM_TEST_DATABASE_URL` | **73 passed, no skips: 59 existing backend + 14 frontend** |
| `npm run build` | Prisma client generation, API TypeScript build and Next.js Webpack production build passed |
| Final frontend typecheck/build after UI refinements | Passed; 11 customer route patterns plus not-found and icon generated |
| `tests/integration-smoke.mjs` against local production frontend and real Express/PostgreSQL | Passed: proxy, filtering, price/private-data protection, collection pagination, CMS, metadata, all 11 page routes and actual persisted browser submissions |
| Browser interaction checks | Passed scenarios below |

Frontend unit tests cover public query allowlisting, pagination preservation, private-price suppression, WhatsApp encoding/configuration, image/CTA safety, corrupt wishlist storage, contact/consent/email validation, supported custom/product request payloads, future appointment validation/time conversion, safe API errors and absence of automatic POST retries.

Actual browser checks used the in-app Chromium browser and the existing isolated PostgreSQL 18 cluster at `127.0.0.1:55432`. Temporary records were explicitly labelled QA, with 15 products (14 public), one category and one collection. A public Cloudinary demo flower image tested image delivery only; it was never represented as real jewellery. A deliberately missing image tested fallback. All fixtures and QA submissions were removed after verification.

Verified interactions:

1. Catalogue first/second page, exact search, gold filter and public-price sorting; 14 public pieces, no draft leakage.
2. Collection selection and collection page 2, with the same public-eligibility rules.
3. Product specifications, gallery switching, missing-image handling and related products.
4. Wishlist add, reload persistence, withdrawal detection and removal; mobile menu open/Escape-close.
5. Required-field errors and custom/product/general enquiries posted through the real same-origin proxy. PostgreSQL confirmed the correct types, product SKU snapshot, custom subject, consent and token hashes.
6. Receipt reference/token lookup returned RECEIVED without placing the token in a URL.
7. Past appointment time rejected; future local preference stored as the correct UTC instant, with REQUESTED status and no scheduled time.
8. Published CMS sections and About editorial, empty catalogue states, missing-product not-found/noindex and API-offline recoverable errors.
9. Production browser console had no warnings/errors during normal checked flows. The intentionally missing-image and withdrawn-product tests generated expected HTTP failures; these were handled without an unhandled application error.

Responsive checks used viewport widths **1440, 1366, 768, 390 and 360 pixels**. Homepage/footer, catalogue, product/gallery, collection details, custom enquiry and appointment forms had no horizontal overflow. Checks included DOM geometry, screenshots and actual mobile controls. The desktop browser's scrollbar reduces document client width by approximately 15 pixels; the viewport overrides used the exact requested dimensions. Keyboard menu dismissal, form labels/errors, focus behavior, skip link, reduced-motion CSS and alt/fallback semantics were reviewed. This is not a claim of a full automated WCAG audit or Safari/Firefox/device-lab coverage.

Final clean-data screenshots: [desktop homepage](screenshots/milestone-7/homepage-desktop.jpg), [desktop custom enquiry](screenshots/milestone-7/custom-enquiry-desktop.jpg), and [mobile custom enquiry](screenshots/milestone-7/custom-enquiry-mobile.jpg). The final mobile search check confirmed that the search icon expands the filter panel and focuses its input. Normal production browsing produced no console warnings/errors. Temporary preview/API processes and the isolated database were stopped after verification.

The first sandboxed production build was blocked by Windows EPERM while creating its output folder; it passed with normal workspace permissions. One initial frontend test expected a currency string without decimal places; the expectation was corrected to the intended INR currency format and all tests then passed. Node 22 emits experimental type-stripping/module-detection warnings for the dependency-free test runner; these are not application build or test failures.

## Repeating the browser integration checks

Use an empty, already migrated isolated test cluster, never the operational database. Start the existing API with `DATABASE_URL` pointing to that cluster and `WEB_ORIGIN=http://localhost:3000`, then serve the frontend at that exact origin.

```powershell
$env:SHOWROOM_TEST_DATABASE_URL = 'postgresql://showroom_test@127.0.0.1:55432/postgres'
node apps/web/tests/fixture.mjs seed
```

Exercise product/custom/general forms with the QA names in `integration-smoke.mjs`. Submit the appointment fixture with the script's documented local date/time (update that expected date when re-running after it has passed). `fixture.mjs withdraw` and `restore` test wishlist eligibility. Then:

```powershell
node apps/web/tests/fixture.mjs cms
node apps/web/tests/integration-smoke.mjs
node apps/web/tests/fixture.mjs clean
```

The smoke helper checks UI-submitted records; it is not a replacement for browser interaction. Fixture seeding refuses a nonempty catalogue/CMS/owner table and all helpers refuse non-isolated database addresses. Cleanup uses the recorded fixture IDs and explicit QA request names. No remote Cloudinary mutation or messaging is performed.

## Remaining limitations and exact next work

1. **Missing Milestone 6 settings contract:** configurable address, directions, social links, general phone/email, opening hours, dedicated About and global SEO settings cannot be integrated until their backend exists. About currently reuses a published EDITORIAL section; contact uses the existing nullable WhatsApp/timezone projection.
2. **Genuine business content:** no operational catalogue, jewellery photography, business contact configuration or published CMS copy was supplied. The UI is ready for those records, but the final empty database intentionally shows empty states and the decorative brand graphic instead of stock/fabricated products.
3. **Custom reference images:** anonymous uploads are unsupported. The custom API accepts only existing managed image IDs; public product gallery DTOs omit these IDs. The form therefore accepts a written description and explains how to mention reference photographs for follow-up.
4. **Collection filtering:** `/api/products` has no collection filter and collection details support only pagination. Choosing a collection opens its dedicated curated list; unsupported combined catalogue filters/sorts are not simulated client-side.
5. **Appointments and communication:** no public available-slot, customer cancellation or reschedule-acceptance endpoint exists. Requests require owner review. WhatsApp is only a configured deep link; no automated WhatsApp/email/SMS delivery or real provider-account operations were verified.
6. **Operational readiness:** guest wishlist is browser-local, JavaScript is required for interactive forms, and receipts cannot be recovered after loss. Production canonical-domain/sitemap, real-provider smoke tests, fuller accessibility/performance/cross-browser checks and deployment remain separate work. Existing process-local API rate limits also apply to server-rendered reads and should be reviewed with real traffic before hosting.

**Next prerequisite milestone: Milestone 6 — Website settings and owner account recovery backend.** Define and verify the public showroom/about/contact/social/SEO settings projection and secure configured recovery workflow, then connect those settings to these pages. The next frontend phase is the owner admin dashboard. Neither backend expansion, admin work nor deployment was started in this milestone.
