# Implementation status

## Try-on UI/UX redesign — 5 November 2026

Implemented the editorial customer studio, photo upload/result styling, framed live-camera workspace, catalogue category/search rail and owner status/configuration redesign. Backend contracts, security, models and tracking logic remain unchanged. All 121 regression tests pass. Customer photo, camera and owner layouts fit 1440, 1366, 1024, 768, 390 and 360-pixel viewports. See [redesign verification, screenshots and limitations](VIRTUAL_TRYON_REDESIGN.md).

## Virtual try-on — 5 November 2026

IMPLEMENTED: private photo job API/worker and Gemini adapter, guest ownership/consent/retention, MediaPipe/Three.js earrings and necklace overlays, customer fitting room and owner eligibility/calibration/metrics. AUTOMATED-TESTED: 77 API and 44 frontend tests, Prisma validation/migrations, TypeScript and both builds; dependency audit found zero vulnerabilities. Real AI fidelity is BLOCKED pending provider access and genuine references/portraits; physical-camera calibration is MANUAL-TEST-PENDING. Modes default to disabled. See the [complete report](VIRTUAL_TRYON_MILESTONE_REPORT.md). Next milestone: real-provider and physical-device try-on acceptance.

Milestones 1–5 (foundation, catalogue, product images, collections/CMS, enquiries/CRM and appointments), the Milestone 7 customer frontend and Milestone 8 owner dashboard are implemented and verified within the available APIs. Milestone 6 website settings/account recovery is still absent. Genuine business content, real Cloudinary account operations and production deployment remain outstanding.

## Implemented foundation

- npm workspaces for Next.js, Express and a shared Prisma package.
- Strict TypeScript, Tailwind configuration and frontend API proxy.
- PostgreSQL schema with the 16 requested entities and supporting auth, private-cost, CMS, analytics and history models.
- Secure one-time owner provisioning without default credentials.
- Express security headers, exact-origin mutation checks, rate limits, safe structured errors and logging.
- Owner login, server-side session validation, session expiry and logout code.
- Process liveness and database/schema readiness endpoints.
- Customer storefront replaces the original setup page; health/readiness APIs remain intact.
- Environment example and local PostgreSQL Compose configuration.

## Not implemented yet

- Password reset delivery/consumption and owner profile UI.
- Broader website-settings REST modules and custom-jewellery fabrication/order workflows beyond enquiry intake.
- Customer reference-image handling and category/banner image uploading.
- Real-provider Cloudinary account verification; the dashboard upload flow is tested with the existing remote-storage test seam.
- Operational catalogue content, canonical-domain/sitemap configuration, newsletter consent UI and exports.
- PostgreSQL-backed end-to-end tests for remaining business modules and multi-browser accessibility/performance audits.
- Hosting, HTTPS, email delivery, managed database backups and production deployment.

See README for commands, `docs/VERIFICATION.md` for backend results and `docs/FRONTEND_MILESTONE_7.md` for storefront verification. The existing PostgreSQL integration suite covers authentication, catalogue, images, CMS and CRM. The customer frontend uses only the implemented public APIs.

## Milestone 2

- Owner product CRUD (safe soft deletion), publishing, archive and availability transitions.
- Category CRUD, image URL metadata, visibility, ordering and referentially safe deletion.
- Public lists/details with explicit field selection and hidden-price suppression.
- Search, filters, stable sorting, bounded pagination and date-derived new arrivals.
- Atomic audited mutations and row-locked inventory history, including initial inventory.
- Existing schema, authentication and dependencies preserved; no migration required.
- API contract: `docs/CATALOGUE_API.md`.

## Milestone 3

Product image uploads, decoding/size restrictions, gallery listing/order/primary selection, replacement, deletion and durable cleanup retries are implemented. Additive image migration and PostgreSQL tests are verified; Cloudinary is mocked in automated tests and real-account smoke testing remains outstanding. See `IMAGE_MANAGEMENT_API.md`. No frontend or deployment work was started.

## Milestone 4

Collection CRUD/archive, publication, associations and ordering; nine typed homepage sections; managed desktop/mobile image references; scheduled banners; private drafts/previews; atomic audited homepage snapshots and public content APIs are implemented. Existing backend modules are reused. Migration and tests are documented in `VERIFICATION.md`; API contracts are in `COLLECTIONS_API.md` and `HOMEPAGE_CMS_API.md`.

## Milestone 5

Product/general/custom/callback enquiries, immutable product snapshots, protected CRM search/filter/status/priority/notes/history, customer-safe receipt lookup, appointment requests/actions, configurable timezone/hours/closures/capacity and transactional conflict prevention are implemented. Duplicate submissions are retained. No showroom hours or contact number is invented. New history/notes/reference fields and availability model are additive. See VERIFICATION.md for exact checks and ENQUIRIES_API.md, APPOINTMENTS_API.md, CRM_WORKFLOW.md for behavior and limitations.

## Milestone 7

Eleven customer routes are implemented: homepage, catalogue/details, collections/details, wishlist, About, Contact, custom enquiries, appointment requests and private receipt lookup. Features include API search/filter/sort/pagination, published CMS sections, galleries, price privacy, availability, responsive navigation, browser-persisted wishlist, validated submissions, real receipts, loading/error/empty states and page metadata. No backend source, authentication, Prisma schema or migration changed; no dependencies were installed.

Verification: 59 backend tests plus 14 frontend tests passed; both application TypeScript checks and production builds passed. Browser tests exercised all five requested viewport widths and actual API submissions against the isolated PostgreSQL cluster. Disposable fixtures and submissions were removed. Detailed evidence and limitations are in `FRONTEND_MILESTONE_7.md`.

Next prerequisite: **Milestone 6 — Website settings and owner account recovery backend**, including editable showroom/address/about/social/SEO content and secure configured password recovery. Connect the new public settings contract to the existing customer pages afterward. The owner dashboard was subsequently implemented in Milestone 8 below. External messaging and deployment remain deferred.

## Milestone 8 — owner dashboard

Protected owner login/layout, real overview metrics, catalogue and images, categories, collections, all nine CMS section types/banners/atomic publication, enquiries/private notes, appointment actions/availability and inventory/history are implemented. Settings and recovery remain explicitly pending. The only backend integration change is the session cookie path plus legacy-cookie cleanup; no schema, migrations or business API contracts changed. See [complete routes, API map, file inventory and verification](ADMIN_DASHBOARD_MILESTONE_8.md).

**Exact next milestone: Milestone 6 — website settings and owner account recovery backend**, followed by connecting those verified contracts to the pending dashboard and customer surfaces. No deployment is authorized by this milestone.
