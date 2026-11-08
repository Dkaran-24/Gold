# Verification

## Try-on UI/UX redesign — 5 November 2026

121 regression tests passed (77 API, 44 frontend), as did TypeScript and both production builds. Photo, live-camera and owner screens passed all six requested viewport checks after correcting a hidden-file-input overflow. Category/search, live-mode product navigation, owner eligibility counts, saved mode settings and logout were browser-verified. No console errors were captured in these flows. Screenshots are available in [the redesign report](VIRTUAL_TRYON_REDESIGN.md). Real AI and physical-camera acceptance remain pending.

## Virtual try-on — 5 November 2026

77 API tests and 44 frontend tests passed. Prisma validation, isolated migration deployment, TypeScript checks, API build and Next.js production build passed. npm audit reported zero vulnerabilities. Customer/owner state and desktop/mobile overflow checks passed; screenshot capture was unavailable. No paid AI calls or physical-device AR validation were performed. See [test evidence and manual acceptance](VIRTUAL_TRYON_TESTING.md).

## Milestone 8 owner dashboard — 4 November 2026

| Check | Final result |
| --- | --- |
| Prisma schema validation | Passed; no schema or migration changes |
| TypeScript | API and frontend passed |
| Production builds | Prisma generation, API compilation and Next.js Webpack build passed; final frontend rebuild passed after confirmation-dialog refinements |
| Existing API regression suite | **59 passed**, 5 files, including 35 PostgreSQL integration cases; no skips |
| Frontend suite | **33 passed**: 14 storefront and 19 dashboard tests; no failures/skips |
| Additional local HTTP integration | **28 checks passed** through the real frontend proxy and API/database |
| Responsive geometry | **65 checks passed**, 13 views × 1440/1366/768/390/360px; no page-level horizontal overflow |
| Dependency audit | `npm audit --audit-level=low`: **0 vulnerabilities**; dependencies unchanged |

The existing cookie session is reused. Its path changed from `/api` to `/` so Next.js can guard `/admin`; login/logout clear the legacy cookie. Hashing, expiry, owner authorization, origin validation and production security attributes remain unchanged. Updated tests assert root/legacy paths and revocation. No new API endpoints, business rules, Prisma models, migrations, dependencies or operational data changes were introduced.

The 28 HTTP checks exercised anonymous route denial, login/protected SSR/origin rejection/logout, product/category operations and validation, duplicate SKU rejection, public projections, inventory/history, image upload/order/primary/replace/delete and actual image decoding, collection membership/order/archive, all nine CMS types and banners, private preview/atomic publication/invalid-reference rejection, enquiry search/status/priority/private notes, appointment approval/capacity conflict/reschedule/confirmation/rejection, soft deletion with retained history, and all eleven existing customer routes.

Actual browser checks included category creation/order, product creation/invalid weights/publication, inventory transitions/history, multiple image uploads and gallery operations, private notes/status changes, appointment rescheduling/confirmation, CMS section reordering/preview, mobile menu/search/empty state, confirmation cancellation/Escape and backend-protected category deletion. Production mode verified real unconfigured-Cloudinary 503 feedback, database-expired sessions redirecting to sign-in, re-login and logout. The final verification tab reported no browser console warnings/errors. Responsive evidence and screenshots are linked in [ADMIN_DASHBOARD_MILESTONE_8.md](ADMIN_DASHBOARD_MILESTONE_8.md).

All fixtures were clearly labelled QA. The dedicated test API retained real authorization, PostgreSQL, transactions and image processing while replacing only remote storage through the existing test seam. This does **not** verify a real Cloudinary account. The normal API was then used to verify its missing-credentials error. No remote asset mutation, messages, external deployment or purchase was performed.

Initial implementation checks exposed transient syntax/strict-type issues and stale Next.js route types after the storefront route-group move; these were corrected. The first HTTP fixture used a time outside the existing appointment slot alignment and was corrected. A rapid rerun hit the unchanged rate limiter; the harness now honors Retry-After with bounded retries. Native confirmation popups stalled browser automation, so the final UI uses an accessible in-page confirmation dialog, subsequently verified. These earlier attempts are not counted as passing runs. Node 22's experimental type-stripping/module-detection messages are test-runner warnings, not failed assertions.

Final guarded cleanup confirmed **zero owners, products, categories, collections, homepage sections/banners/versions, enquiries, appointments and availability records** in the isolated test database. Temporary API/frontend processes were stopped. The test database was shut down after verification. No operational records were used for destructive tests; no migrations or Docker volumes were reset. Screenshots intentionally show the removed QA records.

Remaining limitations: Milestone 6 settings/account recovery is still pending; real provider credentials, genuine business content, production hosting/HTTPS/backups, PostgreSQL 17 Docker verification, broader accessibility/cross-browser/load testing and aggregate endpoints for large datasets remain outstanding. The existing process-local rate limit and complete-page reads for derived metrics/filters are documented, not bypassed. No unresolved test or build failure remains.

The sections below are historical milestone evidence.

## Milestone 7 customer frontend — 3 November 2026

- Implemented the customer website in the original Next.js workspace. Backend source, authentication, Prisma schema and migrations were unchanged; no dependencies installed.
- Final `npm test` against isolated PostgreSQL: **73 passed, no skips** — all 59 existing backend tests and 14 new frontend tests. `npm run typecheck` passed for both applications.
- `npm run build` passed Prisma client generation, API compilation and Next.js Webpack production build. The frontend was rebuilt successfully after final responsive, accessibility and form-privacy refinements.
- Actual browser submissions through the same-origin proxy persisted product/custom/general enquiries and an appointment request with consent and receipt-token hashes. Receipt lookup, catalogue/collection pagination, filtering, privacy, metadata and all 11 page routes passed the integration smoke helper.
- Browser QA covered 1440, 1366, 768, 390 and 360-pixel viewports; no horizontal overflow in checked homepage/footer, catalogue, gallery/detail, collection and form layouts. Wishlist persistence/withdrawal/removal, gallery fallback, validation, request-only appointment status, published CMS and offline/not-found states were checked.
- Clearly labelled temporary fixtures and test submissions were removed. No operational data, real messaging, provider uploads or deployment was created. Full file inventory, browser evidence, repeatable helper commands and backend capability gaps are in [FRONTEND_MILESTONE_7.md](FRONTEND_MILESTONE_7.md).

## Milestone 5 results — 3 November 2026

- Applied additive migration `20261102000400_crm` to the existing isolated PostgreSQL 18 cluster. No destructive reset or replacement of existing data occurred. Existing enum values were retained; nullable legacy reference/consent/token fields were not fabricated or backfilled.
- `npm test` with the isolated `SHOWROOM_TEST_DATABASE_URL`: **59 passed across 5 files, no skips**. Breakdown: 11 middleware/security, 6 image unit/transport, 3 CMS unit, 4 CRM unit and 35 PostgreSQL integration cases (10 new CRM cases). Existing authentication/catalogue/image/CMS regressions remain passing.
- Coverage includes all four enquiry types and duplicates, product snapshots, managed inspiration, malformed inputs, unique receipts, CRM search/status/date/pagination, transitions/history, priority audit, private notes, appointment requests and missing configuration, approval/rejection/proposal/confirmation/cancellation/completion/no-show, original time preservation, concurrent capacity enforcement, capacity 1 and 2, original-slot retention during rescheduling, real transaction rollback on invalid actor FK, customer receipt isolation/expiration and actual rate limiting.
- `npm run db:validate`: passed. `npm run typecheck`: API and web passed. `npm run build`: generated Prisma client, compiled API and completed frontend Webpack production build.
- `npm audit --json`: **0 vulnerabilities**, including zero critical/high/moderate/low. No dependencies installed or upgraded for this milestone.
- The initial interrupted attempt did not run because automatic approval review hit a usage limit. On resumption, the first verification attempt found the isolated database stopped; its integration suite failed setup and is not counted as passing. After restarting the cluster, migration and all 57 then-existing tests passed. Two additional edge-case cases brought the final total to 59, all passing in the final verification run.
- Source/configuration review found no introduced credentials or external provider calls. The workspace has no `.git`; Git diff review was unavailable, and Git was not initialized. No credentials or commits were created.
- No real Cloudinary, WhatsApp, email or SMS operations were tested or sent. Frontend source, admin/calendar UI and deployment were not started. Test fixtures were cleaned by the suite, and the temporary cluster was stopped after verification.

### Milestone 5 file inventory

Created: `apps/api/src/modules/crm/validation.ts`, `service.ts`, `routes.ts`, `validation.test.ts`, `integration-cases.ts`; `packages/database/prisma/migrations/20261102000400_crm/migration.sql`; `docs/ENQUIRIES_API.md`, `docs/APPOINTMENTS_API.md`, `docs/CRM_WORKFLOW.md`.

Modified: `packages/database/prisma/schema.prisma`, `apps/api/src/app.ts`, `apps/api/src/database.integration.test.ts`, `README.md`, `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION_STATUS.md`, and this report. No changes to existing authentication, catalogue, CMS or image-service implementations were required.

## Milestone 4 results

- Migration `20261102000300_cms` generated from the existing test schema, inspected, and successfully applied to isolated PostgreSQL 18. No destructive reset, replacement of authentication tables, or product/image deletion was performed. Membership positions are normalized deterministically before deferred ordering constraints are installed.
- `npm test` with `SHOWROOM_TEST_DATABASE_URL`: **45 tests passed across 4 files, no skips**. Breakdown: 11 security/middleware tests, 6 image unit/transport tests, 3 CMS unit tests, and 25 PostgreSQL integration cases (including 5 new CMS cases). Existing auth/catalogue/image coverage remains passing.
- CMS coverage: collection creation/duplicate slugs, slug changes, duplicate/invalid memberships, ordering/removal, publication/archive filtering, section type/reference validation (including unpublished products), managed desktop/mobile images, FK protection, activation, banner schedules and order, private previews, public draft isolation, successful publish, validation failure and actual audit-FK transaction rollback preserving the prior version.
- `npm run db:validate`: passed. `npm run typecheck`: both applications passed. `npm run build`: client generation, API compile and frontend Webpack production build passed.
- `npm audit --json`: **zero vulnerabilities**. No dependencies added or reinstalled.
- Initial integration tests exposed Prisma's inability to deserialize the void result of an advisory-lock SELECT through queryRaw. The lock now uses executeRaw; the full suite subsequently passed twice.
- No Cloudinary real-account calls were made. The existing image tests continue to mock Cloudinary. No secrets were added; this milestone needs no new environment variables.
- The workspace has no Git repository, so Git diff/commit inspection is not available. Source/migration review was performed directly. No commits were made.
- Frontend source and deployment were not started. The test cluster was stopped after final verification.

### Milestone 4 files

Created: `apps/api/src/modules/cms/validation.ts`, `service.ts`, `routes.ts`, `validation.test.ts`, `integration-cases.ts`; `packages/database/prisma/migrations/20261102000300_cms/migration.sql`; `docs/COLLECTIONS_API.md`; `docs/HOMEPAGE_CMS_API.md`.

Modified: `packages/database/prisma/schema.prisma`, `apps/api/src/app.ts`, `apps/api/src/database.integration.test.ts`, `apps/api/tsconfig.json`, `README.md`, `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION_STATUS.md`, and this verification report. Existing catalogue, image and authentication implementations were not rewritten or modified.

## Milestone 3 results

- Applied `20261102000200_image_management` successfully to the existing isolated PostgreSQL 18 cluster with `npm run db:deploy`. No destructive reset was used.
- `npm test` with `SHOWROOM_TEST_DATABASE_URL`: **37 passed, 3 files, no skips** (11 existing middleware/security, 6 image unit/transport, 20 PostgreSQL integration cases). All earlier authentication/catalogue tests remain passing.
- Image coverage: genuine JPEG/PNG/WebP decoding; corrupt/unsupported/mismatched and oversized inputs; missing configuration; unauthorized/missing/archived products; capacity and concurrent uploads; isolation; gallery order and primary selection; duplicate/partial/foreign IDs; real database rollback; replacement failure preserving old records; deletion retries; queued cleanup/provider failures and recovery.
- `npm run db:validate`, client generation, `npm run typecheck`, API production compilation and frontend production build all passed. After final backend consistency changes, all 37 tests, type checks and API build passed again.
- `npm audit --json`: **0 vulnerabilities** (0 critical/high/moderate/low). Sharp was added as a direct API dependency; no blanket dependency reinstallation occurred.
- Cloudinary requests were mocked. No real Cloudinary credentials, remote uploads, deletes or CDN invalidation were tested.
- Inspected the modified source and environment example for credentials; no actual credentials were introduced. Test-only strings exist solely in mocked transport tests. The directory has no `.git` repository, so Git diff/commit-history verification is unavailable; `git diff --stat` confirmed that limitation.
- Temporary database fixture records were cleaned by tests; the isolated database was stopped afterwards. No frontend source or deployment work was started.

### Milestone 3 file inventory

Created under `apps/api/src/modules/images/`: `cloudinary.ts`, `validation.ts`, `service.ts`, `routes.ts`, `cleanup.ts`, `images.test.ts`, `integration-cases.ts`.

Also created: `packages/database/prisma/migrations/20261102000200_image_management/migration.sql`, `docs/IMAGE_MANAGEMENT_API.md`.

Modified: `apps/api/src/app.ts`, `apps/api/src/modules/catalogue/service.ts` (public primary indicator only), `apps/api/src/database.integration.test.ts`, `apps/api/package.json`, `apps/api/tsconfig.json`, `package-lock.json`, `packages/database/prisma/schema.prisma`, `.env.example`, `README.md`, `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION_STATUS.md`, and this verification record.

## Milestone 2 results

- `npm test` with `SHOWROOM_TEST_DATABASE_URL` pointing to the existing isolated PostgreSQL 18 cluster: **23 passed** (11 middleware/security tests and 12 database integration tests), no skips.
- `npm run typecheck`: API and web passed.
- `npm run build`: Prisma generation, API compilation and Next.js Webpack production build all passed.
- No dependency installation, schema alteration or migration was needed. Existing authentication tests still pass.
- New coverage includes product creation and duplicate SKUs, strict and merged-state validation, updates, every admin route's authentication requirement, publication, public field/price privacy, inventory transitions and concurrent requests, soft deletion with retained history, category image metadata/visibility/order/deletion, filtering, pagination, sorting and new-arrival expiry.
- Testing found that Zod creation defaults survived `.partial()` and reset omitted update fields. Explicit optional schemas now remove those defaults; regression tests pass.
- The existing isolated cluster was reused, fixture records cleaned up, and the cluster shut down after verification. No operational data was touched.
- Cloudinary and frontend work were not started. The remaining work and exact next milestone are documented in `IMPLEMENTATION_STATUS.md` and `CATALOGUE_API.md`.

The following section records the earlier foundation verification and its limits at that time.

## Passed

| Check | Result |
| --- | --- |
| Prisma schema validation | Passed with Prisma 7.10.1 |
| Prisma client generation | Passed |
| Initial SQL migration | Generated and successfully applied to isolated PostgreSQL 18 |
| Strict TypeScript | API and web passed |
| API tests | 15 passed: 11 isolated security/middleware tests and 4 PostgreSQL integration tests |
| API production compilation | Passed |
| Next.js production build | Passed with Webpack; root setup page and not-found route generated |
| Dependency audit | 0 vulnerabilities after updating dependencies; audit reflects the registry at installation time |

PostgreSQL integration exercised actual CLI owner provisioning, incorrect-password rejection, successful login, hashed persisted session tokens, authenticated reads, logout and session revocation. Database tests also exercised the single-owner constraint, SKU uniqueness, category foreign-key protection, weight validation, and the image-position limit. Test-created records were removed after the run.

The temporary cluster lives in ignored `.local/postgres-test`, listens only on `127.0.0.1:55432`, and uses a test-only role. It was shut down after verification. It contains no showroom data or configured owner and is not an operational database. Its local trust authentication is for this disposable verification cluster only; production and developer operational databases require passwords.

## Issues resolved during verification

- Restricted DNS initially prevented npm installation and Prisma engine downloads. Installation and generation succeeded with network access.
- The initial dependency audit flagged vulnerable package versions. Prisma was updated to 7.10.1 with its PostgreSQL driver adapter and configuration file; Zod and Vitest were updated to patched versions. The refreshed audit reported zero vulnerabilities.
- Restricted loopback networking prevented Supertest from connecting to its own server. Tests passed with local network access.
- Turbopack failed to start a CSS worker on this Windows host, including outside the sandbox. The web package now explicitly uses supported Webpack mode for dev/build, which compiled successfully.
- Oversized JSON requests now return a structured 413 error rather than a generic server error.

## Not verified / not yet available

- Business REST modules, customer catalogue, admin dashboard, image uploads, password recovery delivery, and related end-to-end workflows remain to be implemented.
- No responsive or accessibility browser QA has been performed on the setup screen.
- No Cloudinary, SMTP, production database, domain, HTTPS deployment, backup restore, or public hosting has been configured or verified.
- Local database verification used PostgreSQL 18; the supplied Docker Compose PostgreSQL 17 service was not exercised because Docker Desktop's engine was stopped.

This evidence supports the foundation milestone only. It does not establish completion or production readiness of the full requested platform.
