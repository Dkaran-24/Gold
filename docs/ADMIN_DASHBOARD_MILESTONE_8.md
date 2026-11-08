# Milestone 8 — owner dashboard

Implemented in the existing Next.js/Express/Prisma monorepo. No dependencies were installed, no database schema or migration changed, and no deployment or operational database mutation was performed. Verification uses the existing isolated PostgreSQL 18 cluster; the supplied PostgreSQL 17 Docker service was not exercised.

## Audit and implementation decisions

The audit covered the Prisma schema and all four migrations; authentication, middleware, routes, services and validation for catalogue, images, CMS and CRM; existing frontend components and API clients; and VERIFICATION, COLLECTIONS_API, HOMEPAGE_CMS_API, ENQUIRIES_API, APPOINTMENTS_API, CRM_WORKFLOW and FRONTEND_MILESTONE_7 documentation.

The implementation followed this order: protected owner shell; catalogue/images; collections/CMS; CRM/appointments/inventory; isolated regression and browser checks. Existing backend business rules remain authoritative.

The only backend integration change is the authentication cookie path: `/api` could not reach a server-rendered `/admin` route, so `showroom_session` now uses `/`. Login and logout also expire the legacy `/api` cookie. HttpOnly, SameSite=Lax, production Secure, eight-hour expiry, hashed database sessions, owner-slot checks, origin enforcement and rate limiting are unchanged. Tests verify both cookie paths and revocation.

Public routes moved into `(storefront)` without changing their URLs or page content. Their header/footer now belong to that group's layout. The root layout retains the document, metadata and global styles. Admin styles are scoped separately. Both the owner layout and every dashboard page validate the session against `/api/auth/me`, with uncached requests; shared-layout reuse therefore does not bypass the page guard. Client API calls handle 401 with a sign-in redirect, display safe 403/validation/conflict/rate-limit errors, and never automatically retry mutations. Focus/periodic session checks cover an idle open dashboard. No credential or CRM payload is stored in local storage.

## Dashboard routes

The allowlisted route dispatcher returns not-found for unsupported paths.

| Route | Function |
| --- | --- |
| `/admin/login` | Existing owner login; expired-session notice |
| `/admin` | Real product/enquiry/appointment totals and recent records |
| `/admin/products` | Search, category/publication/stock filters, sorting, pagination |
| `/admin/products/new` | Product creation with Zod and native field validation |
| `/admin/products/:id` | Specifications, SEO, publication, images, stock, history, archive/soft-delete |
| `/admin/categories` | Category list, visibility and display order |
| `/admin/categories/new`, `/admin/categories/:id` | Create/edit, HTTPS image URL, visibility, display order and safe deletion |
| `/admin/collections` | Collection list and ordering |
| `/admin/collections/new`, `/admin/collections/:id` | Metadata, managed images, membership/order, publication, public preview link and archive |
| `/admin/homepage` | Draft sections/banners, ordering and atomic publication |
| `/admin/homepage/sections/new`, `/admin/homepage/sections/:key` | All nine existing section types, references, text, images, visibility and scheduling |
| `/admin/homepage/banners/new`, `/admin/homepage/banners/:id` | Banner text, images, publication and schedule |
| `/admin/homepage/preview` | Backend-resolved private draft preview using storefront renderers |
| `/admin/enquiries`, `/admin/enquiries/:id` | Search/type/status/priority, detail, valid transitions, private notes/history/activity |
| `/admin/appointments`, `/admin/appointments/:id` | Requests, status/scheduled-date view, customer detail, supported actions, notes/history/activity |
| `/admin/appointments/availability` | Existing timezone, weekly hours, closures, duration, buffer, capacity and optional public WhatsApp configuration |
| `/admin/inventory` | Stock-filtered catalogue with product inventory/history links |
| `/admin/settings` | Explicitly pending Milestone 6, with link to available CRM configuration |

## Integrated APIs

All paths below begin with `/api`. Admin calls remain protected by the original backend owner middleware.

| Area | Existing APIs used |
| --- | --- |
| Authentication | POST `/auth/login`, GET `/auth/me`, POST `/auth/logout` |
| Products | GET/POST `/admin/products`; GET/PATCH/DELETE `/admin/products/:id`; PATCH `/:id/publication`, PATCH `/:id/inventory`, GET `/:id/inventory-history` |
| Categories | GET/POST `/admin/categories`; PATCH/DELETE `/admin/categories/:id` |
| Images | GET/POST `/admin/products/:id/images`; POST `/images/:imageId/replace`; PATCH `/images/order`, PATCH `/images/:imageId/primary`; DELETE `/images/:imageId`; POST `/admin/images/cleanup` |
| Collections | GET/POST `/admin/collections`; GET/PATCH/DELETE `/admin/collections/:id`; POST `/admin/collections/order`; POST `/:id/products`; DELETE `/:id/products/:productId`; PATCH `/:id/products/order` |
| Homepage | GET `/admin/homepage/draft`, GET `/preview`, POST `/publish`; POST/PATCH/DELETE sections and banners; POST their `/order` endpoints |
| CRM | GET `/admin/enquiries`, GET/PATCH `/:id`, GET/POST `/:id/notes`, GET `/:id/history`, GET `/:id/activity` |
| Appointments | GET `/admin/appointments`, GET `/:id`, POST `/:id/actions`, GET/POST `/:id/notes`, GET `/:id/history`, GET `/:id/activity` |
| Availability | GET/PUT `/admin/availability` |

Image uploads send raw JPEG/PNG/WebP bytes with the actual MIME type, not multipart forms. Multiple uploads are sequential, report partial success and refresh the gallery after a failure. UI limits come from the same environment settings as the API (default 5 MiB and 10 images). Backend decoding, sanitization, reference protection and cleanup remain unchanged. Category images use HTTPS URLs; collections and CMS select managed product-image IDs. There are no anonymous or standalone banner/category uploads.

Every reorder sends a complete permutation. Collection members and globally ordered collections are read across all pages before ordering. Category order uses the existing numeric `sortOrder` update rather than an invented bulk endpoint. Destructive actions use an in-page confirmation dialog with cancel/Escape support and keyboard focus containment.

## Honest metrics and API limits

- Product totals exclude soft-deleted records. Published means publication status, not a promise that a hidden category is public.
- Pending conversations mean CONTACTED, IN_PROGRESS or WAITING_FOR_CUSTOMER. New enquiries have a separate count.
- Pending appointments mean REQUESTED, PENDING or RESCHEDULE_PROPOSED. Upcoming means a future scheduled time in APPROVED or RESCHEDULE_PROPOSED; an existing confirmed time is retained during a proposal.
- The API has no global activity feed. Activity is available on individual enquiry/appointment records.
- Priority is not an enquiry query parameter. The dashboard exhausts the server's matching pages, then applies priority filtering and pagination locally. Scheduled-date views similarly read all matching appointments and compare the scheduled date in the configured showroom timezone. The API's `from`/`to` fields refer to submission dates; the dashboard does not misrepresent them as scheduled dates.
- These complete-result reads can be expensive for large datasets and encounter the existing 120-requests/minute process-local limiter. Errors are visible, with no fabricated totals or silently truncated results. Dedicated aggregate/priority/scheduled-date endpoints would require a separately approved backend milestone.
- Datetime inputs explicitly use the owner's device timezone and serialize to UTC. Confirmed/requested/proposed appointment details and date views use the configured showroom timezone. The backend alone validates opening hours, slot alignment, closures, capacity, duration and buffer. No booking is assumed before success.
- Draft collections have no public preview endpoint. The owner can review all memberships; public preview links are offered only for visible published collections. Archived collections cannot be restored through the existing API. Soft-deleted products cannot be restored in this UI.
- Product-private cost/supplier fields have no mutation contract and are not offered as editable fields. Legacy appointment states without a supported transition expose no invented action. Dashboard slug inputs are capped at 100 characters to remain compatible with existing public detail-route validation.

## Files created and modified

Created:

- `apps/web/src/app/(storefront)/layout.tsx` and its local not-found boundary.
- `apps/web/src/app/admin/{layout.tsx,error.tsx,admin.css,login/page.tsx}`.
- `apps/web/src/app/admin/(owner)/{layout.tsx,loading.tsx,not-found.tsx,[[...path]]/page.tsx}`.
- `apps/web/src/components/admin/{shell,login,ui,confirmation,form,catalogue,images,collections,cms,crm,overview}.tsx`.
- `apps/web/src/lib/admin/{api,model,fields,session}.ts`.
- `apps/web/tests/admin.test.mts`, `admin-fixture.mjs`, `admin-test-server.mjs`, `admin-integration.mjs`.
- This document and verification screenshots under `docs/screenshots/milestone-8/`.

Modified:

- `apps/api/src/auth.ts`, `app.test.ts`, `database.integration.test.ts` for the cookie-path integration fix and regression assertions.
- `apps/web/src/app/layout.tsx` to separate storefront/admin shells.
- Existing public page directories, page/loading/error files moved beneath `(storefront)`; their URL structure and page implementations are retained.
- README, IMPLEMENTATION_STATUS, ARCHITECTURE and VERIFICATION documentation.

No package manifest, lockfile, Prisma schema, migration, operational `.env` or business API route/service was changed.

## Verification

The automated baseline passed **59 API tests** and **33 frontend tests** (14 existing storefront tests plus 19 dashboard tests). An additional **28 isolated HTTP integration checks** passed through the real Next.js proxy, using the dashboard's form serializer and the real API/database.

The HTTP checks cover anonymous dashboard redirects, authenticated server rendering, origin enforcement, cookie migration/logout, product creation/update/duplicate SKU/invalid values/public visibility, protected category deletion, inventory/history, image processing and management, collection membership/order/archive, all nine CMS types, banner/preview/order/atomic publish and invalid-reference rejection, enquiry search/status/priority/private notes, appointment configuration/approval/conflicts/proposal/confirmation/rejection, soft deletion with history, and all eleven existing customer routes.

Browser verification uses disposable `QA M8` records. The upload tests run the real image pipeline with only the remote storage transport replaced through the existing `createApp` test seam; no real Cloudinary asset was uploaded or deleted. The public demo image returned by that test transport is explicitly QA material, not showroom photography. The test server is a separate guarded entry point and is never loaded by either application.

Responsive geometry checks covered thirteen dashboard views at **1440, 1366, 768, 390 and 360 pixels**: overview, products, product edit, CMS list, CRM detail, availability, categories, collections, collection edit, section edit, appointments, pending settings and login. All **65 checks** had no document-level horizontal overflow. Tables intentionally scroll inside their bounded regions. Browser checks also exercised mobile menu navigation, search/empty results, category creation/order, invalid product weight, product creation/publication/inventory, multiple image uploads/primary/order/replace/delete, CRM transition/private note, appointment proposal/confirmation, CMS ordering and resolved preview.

The first integration run correctly rejected a test appointment outside the configured slot alignment; the fixture was corrected to the existing 40-minute interval. A rapid rerun encountered the existing rate limit; the test helper now honors Retry-After. No business rule or limiter was weakened. A browser automation timeout on native confirmation popups led to replacing them with the accessible in-page confirmation dialog. Temporary TypeScript errors during implementation and stale generated route types after moving route groups were corrected before successful builds.

Final production browser checks also passed dialog cancellation/Escape, protected category deletion with a visible 409 message, actual unconfigured-Cloudinary 503 handling, session expiration via database expiry, re-login and logout. Browser error/warning logs for the final verification tab were empty. Screenshots contain clearly labelled QA records that were subsequently removed: [desktop overview](screenshots/milestone-8/overview-desktop.jpg), [mobile overview](screenshots/milestone-8/overview-mobile.jpg), [mobile login](screenshots/milestone-8/login-mobile.jpg). Geometry results are saved in [responsive-checks.json](screenshots/milestone-8/responsive-checks.json). See VERIFICATION.md for the final command results and cleanup confirmation. This is not a claim of a full WCAG, cross-browser, load, production-provider or deployed-security audit.

## Reproduce locally

For an already configured developer database and provisioned owner, run from the repository root:

```powershell
npm run dev
```

Open `http://localhost:3000/admin/login` and use the existing provisioned owner. Use the exact configured `WEB_ORIGIN` for mutation requests. Do not replace `.env` or reprovision an existing owner. If no owner has ever been provisioned, follow the existing README's one-time `npm run db:owner` instructions.

Build and serve:

```powershell
npm run build
# Terminal 1
npm run start -w @showroom/api
# Terminal 2
npm run start -w @showroom/web
```

For isolated verification only, start the existing migrated loopback test cluster, then:

```powershell
$env:SHOWROOM_TEST_DATABASE_URL = 'postgresql://showroom_test@127.0.0.1:55432/postgres'
npm test
node apps/web/tests/admin-fixture.mjs seed
$env:SHOWROOM_QA_STORAGE = 'explicit-test-double'
node apps/web/tests/admin-test-server.mjs
# Separate terminal: run the frontend at http://localhost:3000.
# Separate terminal, with SHOWROOM_TEST_DATABASE_URL set:
node --experimental-strip-types apps/web/tests/admin-integration.mjs
```

The fixture refuses a nonempty database or any other database address/role. QA credentials are random and kept only in ignored `.local/admin-fixture.json`. The integration script leaves labelled records for UI checks. After those checks, `node apps/web/tests/admin-fixture.mjs expire` expires only QA sessions; `node apps/web/tests/admin-fixture.mjs clean` verifies ownership/labels and removes only the isolated fixture records. Stop the QA processes afterward. Never run the fixture tools against an operational database.

## Remaining work and exact next milestone

**Milestone 6 — website settings and owner account recovery backend.** Define, implement and verify the public/private showroom settings contracts and secure configured recovery workflow, then connect the pending admin settings and customer contact/About/SEO surfaces.

Real Cloudinary credentials/account smoke tests, genuine catalogue/CMS/contact information, production HTTPS/hosting, backups, canonical-domain/sitemap configuration, provider delivery and broader accessibility/performance testing remain outstanding. No WhatsApp automation, AI try-on, checkout, deployment, purchase, fabricated operational records or recovery claims were introduced.
