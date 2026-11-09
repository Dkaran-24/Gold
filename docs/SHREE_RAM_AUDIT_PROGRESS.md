# Complete audit — investigation checkpoint

Date: 2026-11-09 (Asia/Calcutta)
Status: IN PROGRESS. This is not the final audit or a production certification.

## Safety
No source changes, migrations, database writes, environment edits, Cloudinary operations or infrastructure changes performed. This document is an audit artifact requested by the brief.
Do not start the API for inspection without reviewing its worker: server.ts starts background processing automatically. Successful login writes Session and AuditLog records; database integration tests create/delete fixtures. Those tests need separate approval.

## Checklist
- [x] Initial repository inventory and workspace manifests
- [x] Initial API composition, session authentication and server startup review
- [x] Route declaration and Prisma model inventory
- [x] Existing web unit tests rerun
- [ ] Complete every module/service and endpoint evidence matrix (including dynamically registered routes)
- [ ] Every frontend route and five requested viewports
- [ ] Safe customer journeys, validation, keyboard and interaction checks
- [ ] Full schema and live read-only migration/permissions verification
- [ ] OWASP security and dependency advisory review
- [ ] Cloudinary implementation and historical 403 evidence
- [ ] Dedicated overlay, local tracking and provider workflow review
- [ ] Admin source/UI review without creating sessions or exposing customer data
- [ ] Performance measurements, SEO and accessibility
- [ ] Remaining safe test suites, typechecks and build
- [ ] Deployment, AWS/DNS/SSL evidence and recovery procedures
- [ ] Privacy, retention and business workflow review
- [ ] Evidence-based scorecard, issue register and remediation roadmap
- [ ] Final report at docs/SHREE_RAM_JEWELLERS_COMPLETE_AUDIT_REPORT.md

## Verified initial architecture
npm workspace: apps/web (Next.js/React), apps/api (Express/TypeScript), packages/database (Prisma/PostgreSQL). Frontend server-api.ts wraps API requests with per-render React cache. Express composes auth, catalogue, CMS, CRM, images and try-on modules. API binds loopback. PostgreSQL local development is described in compose.yaml; this does not prove AWS deployment. Installed versions and deployed infrastructure still require fresh verification.

## Evidence and investigation leads
1. apps/api/src/app.ts:51-60: readiness checks SELECT 1 and WebsiteSetting.count only. It cannot prove every migration/required table exists. Validate missing TryOnOverlay behavior separately; do not treat healthy readiness as overlay readiness.
2. compose.yaml: ports sequence appears misindented. Syntax defect suspected, not parser-confirmed. Attempted parser unavailable (yaml module not installed); no package installed. Validate with existing Docker Compose or another already installed parser.
3. apps/api/src/auth.ts: random 32-byte session tokens, SHA-256 stored token digest, bcrypt comparison, eight-hour expiry, HttpOnly/SameSite=Lax cookie and Secure in production. requireOwner checks ownerSlot and expiry. These are positive source findings, not end-to-end authentication passes.
4. apps/api/src/app.ts: configured-origin mutation check, credentialed CORS, Helmet, rate limiting and request logging without query strings. Route-specific enforcement remains to inspect.
5. apps/api/src/database.integration.test.ts: accepts only explicit isolated loopback test cluster and writes fixtures. Not executed.
6. Previous 2026-11-08 database preflight found pending TryOnOverlay migration and inherited Dxtm privileges for anon/authenticated/service_role on new public tables. Backup was not taken. This is HISTORICAL evidence, not a current recheck. Migration remains prohibited by current audit instructions.

## Tests actually executed this phase
npm run test -w @showroom/web: 84 tests, 84 passed, 0 failed, 0 skipped, 0 cancelled. Node experimental type stripping/module-type warnings emitted. These unit results do not demonstrate real uploads, database operations, visual fitting or complete user journeys.
Backend tests, integration tests, browser matrix, current build/typecheck, Cloudinary mutation verification and deployment tests: NOT EXECUTED in this checkpoint. No current production-readiness score assigned.

## Next phase
Finish static endpoint/service review and classify read operations for side effects before browsing all routes. In parallel within the same audit, inspect safe test entrypoints before executing them. Preserve this checklist and evidence; do not create the final report while major areas remain unexamined.

# Continuation 2 — read-only investigation, 2026-11-09

This section preserves and supplements all prior evidence. No production-readiness verdict is assigned. Scope remains incomplete; entries below distinguish source-confirmed defects, live metadata observations and blocked checks.

## Actions and results
- Read catalogue routes/service, CMS routes/service, CRM routes/service, image routes/service/validation/Cloudinary adapter, try-on routes/settings/runtime/worker/provider/private storage/overlay validation, authentication configuration/error handling, renderer/tracking/lifetime, local fitting/photo/camera, admin dispatcher/session/API/overview, full Prisma schema, SEO/robots and public legal pages.
- Docker Compose was already installed. `docker compose -f compose.yaml config --no-interpolate --quiet` returned `yaml: line 1: did not find expected key`. It did not start containers or interpolate/print credentials. Prior suspected Compose issue is now parser-confirmed.
- Browser GET to http://localhost:3000 failed with ERR_CONNECTION_REFUSED. No forms submitted, sessions created, files uploaded or camera permissions requested. No API process started.
- Fresh database metadata check: configured project reference exactly ylosokalxxgtdlmzehwv, database postgres; connected with default_transaction_read_only=on, entered BEGIN READ ONLY, selected metadata, then ROLLBACK. No customer rows read. Restricted-network DNS failed initially; authorized network retry succeeded.
- Live history has five completed migrations (initial, image_management, cms, crm, tryon), no rollback timestamp on those entries. TryOnOverlay to_regclass returned NULL. 20261108120000_add_try_on_overlay is not recorded. Full drift comparison and rehash of all migration files remain outstanding.
- Live public-table default ACL for postgres still grants anon/authenticated/service_role Dxtm. Supabase-admin default ACL also contains broad grants. Actual exploitability through RPC/Data API is not established by this metadata alone.
- No backup created or recovery point verified. No migration applied. Earlier permission concern persists. Branch main/PRODUCTION remains owner-provided dashboard evidence, not independently verified by SQL.
- No additional tests executed in this continuation; prior 84/84 web unit result remains historical evidence from this audit, not proof of end-to-end business operations.

## Findings register

### AUD-001 — P2 — Invalid local Compose configuration (confirmed)
Affected: compose.yaml, ports block around lines 9–10.
Evidence: installed Docker Compose rejects YAML; list item is aligned at the database service level rather than under ports.
Cause: malformed indentation.
Business impact: local database setup and reproducible development onboarding fail.
Correction: repair indentation in a separately authorized remediation.
Verification required: config validation and isolated database startup after approval. Neither container startup nor correction performed.

### AUD-002 — P2 — Category filter lost when search is present (source-confirmed)
Affected: apps/api/src/modules/catalogue/routes.ts, list handler categoryFilter/filters object.
Evidence: categoryFilter supplies OR for category ID/slug; later q.search spread supplies another OR in the same object, replacing the first.
Cause: duplicate object property rather than separate AND predicates.
Business impact: customers can see products outside their selected category when searching; also affects admin list semantics.
Correction: compose category and search as separate AND clauses.
Verification required: read-only query comparison with a catalogue spanning multiple categories and unit regression of generated where clauses. No live reproduction performed.

### AUD-003 — P1 — Category image replacement can destroy an attached asset after uncertain commit (source-confirmed risk)
Affected: apps/api/src/modules/images/routes.ts, category upload transaction catch.
Evidence: remote upload precedes DB transaction; catch immediately destroys new publicId without checking whether the transaction committed. Old asset cleanup is best-effort without durable intent. Category deletion destroys remote asset before DB detachment.
Cause: category flow lacks the product/overlay durable cleanup and attachment-check protocol.
Business impact: broken category imagery after network/DB acknowledgement failure; orphaned assets and inconsistent state after failure/concurrent replacement.
Correction: adopt durable upload intent, locked attachment and deferred cleanup with reference checks.
Verification required: isolated mocked commit-acknowledgement loss, concurrent replacement and remote failure tests; real mutations REQUIRES APPROVAL.

### AUD-004 — P2 — CMS/category destroy endpoints claim success after failure (source-confirmed)
Affected: apps/api/src/modules/images/routes.ts, /api/admin/categories/image/destroy and /api/admin/cms/image/destroy.
Evidence: storage.destroy errors are caught/logged, then response always returns destroyed:true. Only prefix checks are performed; no current attachment check before destruction.
Cause: success response detached from provider outcome; no durable retry/reference guard.
Business impact: owner believes cleanup succeeded when it did not; deleting an attached asset can break published imagery. Owner authentication is present, so this is not evidence of unauthenticated deletion.
Correction: accurately report failure/pending cleanup, persist retries and protect attached assets including published CMS snapshots.
Verification required: mocked 403/timeout and attached-image cases; Cloudinary writes REQUIRES APPROVAL.

### AUD-005 — P1 — Dedicated overlay schema absent while application queries it (live metadata + source)
Affected: tryon/settings.ts productConfig; tryon/routes.ts products/studio-products; pending migration.
Evidence: live TryOnOverlay absent; those reads select dedicatedOverlay. Only admin overlay GET explicitly translates P2021 to OVERLAY_SCHEMA_PENDING; other reads can reach generic 500. Runtime effect depends on branch/config and query execution.
Cause: application/database release mismatch pending explicitly prohibited migration.
Business impact: fitting catalogue/configuration unavailable; neither real overlay upload nor actual fitting verified.
Correction: coordinated reviewed migration/release with permissions and backup prerequisites; gracefully expose pending schema state where needed. DO NOT apply in audit.
Verification required: read-only endpoint response when safe app runtime exists; isolated post-migration workflow and genuine product cutout fitting after approval.

### AUD-006 — P1 — Unsafe inherited privileges for proposed overlay table (live metadata)
Affected: postgres default privileges on public tables; proposed TryOnOverlay migration.
Evidence: anon/authenticated/service_role ACL Dxtm persists (TRUNCATE, REFERENCES, TRIGGER, MAINTAIN). Migration does not revoke these grants.
Cause: default grants inherited on table creation without explicit table access policy.
Business impact: excessive database-role privileges on new asset metadata; public HTTP exploitation is NOT demonstrated.
Correction: review explicit least-privilege grants/revokes, schema exposure and RPC access before any migration approval.
Verification required: effective schema/role privileges, exposed schemas/RPCs, restore-tested backup and refreshed preflight. No permission changes performed.

### AUD-007 — P2 — Readiness does not verify required overlay schema or worker health (source-confirmed)
Affected: apps/api/src/app.ts: readiness handler; server.ts; tryon/worker.ts.
Evidence: readiness runs SELECT 1 and WebsiteSetting.count only. Worker failure state is not included. Worker tick performs cleanup and job state changes regardless of audit intent.
Cause: limited health contract and unconditional worker startup.
Business impact: deployment can appear ready while try-on cannot function; starting the API during read-only audit would cause unauthorized side effects.
Correction: distinguish DB connectivity, schema compatibility and worker readiness; provide an explicitly non-mutating audit runtime.
Verification required: isolated missing-table/worker-failure tests and deployment health configuration. API startup REQUIRES APPROVAL under present restrictions.

### AUD-008 — P2 — Account recovery and general settings unimplemented (source-confirmed)
Affected: components/admin/overview.tsx SettingsPending; auth.ts.
Evidence: explicit disabled pending controls; auth router provides login/me/logout, not recovery. PasswordReset model alone does not implement recovery.
Cause: incomplete milestone.
Business impact: owner lockout recovery and ordinary business-profile editing depend on technical intervention.
Correction: separately design secure recovery and business-settings management.
Verification required: requirements and approved isolated end-to-end implementation tests; no account actions performed.

### AUD-009 — P2 — Privacy page lacks material processing details (source-confirmed content gap)
Affected: app/(storefront)/privacy/page.tsx; tryon/provider.ts/storage.ts; local-fitting.tsx.
Evidence: public policy is a short enquiry-use paragraph. Provider implementation sends portrait/reference bytes to Google and uses temporary server files; local studio processes photos on-device. Policy does not describe these distinct flows, cookies, retention or third-party processing.
Cause: minimal public policy not expanded alongside functionality.
Business impact: customers cannot understand all implemented processing from the policy page.
Correction: owner and legal review of actual active flows, retention and provider terms; accurate layered disclosures.
Verification required: review photo-try-on consent UI, active provider configuration and operational retention. No claim of legal noncompliance or compliance made.

### AUD-010 — P2 — Dashboard metric links do not match metric populations (source-confirmed)
Affected: components/admin/overview.tsx.
Evidence: pending conversations sum CONTACTED/IN_PROGRESS/WAITING_FOR_CUSTOMER but link filters IN_PROGRESS only; pending appointments count REQUESTED/PENDING/RESCHEDULE_PROPOSED but link filters REQUESTED only.
Cause: composite counters link to single-status filters.
Business impact: owner sees a count then an apparently inconsistent record list.
Correction: support corresponding multi-status filters or explicitly label narrower links.
Verification required: isolated dashboard fixtures and browser journey. No real customer data accessed.

## Positive controls examined (not end-to-end passes)
- Owner enforcement is present at catalogue/CMS/CRM admin-router boundary, all image routes and individual try-on admin routes. Frontend ownerSession verifies /auth/me server-side; it is not the sole authorization boundary.
- Public product select excludes ProductPrivate; unpublished/archived/deleted products and hidden categories are filtered.
- Product mutation row locks, audit records and transactional inventory history; CRM advisory locking/state transitions/capacity checks; CMS publication snapshots and reference validation.
- Product image and overlay flows persist cleanup intent before upload, use UUID namespaces and verify attachments before destruction. Overlay assets are separate from gallery ordering.
- Upload validation decodes/re-encodes raster images, strips metadata, caps bytes/pixels/dimensions and rejects mismatched MIME/animation/SVG. Overlay alpha threshold rejects fully opaque/empty images but cannot prove real product identity or reject every mostly opaque image; administrator review remains necessary.
- Cloudinary 403 handling explicitly reports missing permissions. ready() checks presence/shape only, not actual provider permissions. Historical create-permission failure is NOT verified resolved; uploads remain REQUIRES APPROVAL.
- Provider reference fetch restricts host/cloud/path and rejects redirects, bounds responses and timeouts. Guest job access combines hashed ownership cookie and expiring HMAC result grant. Generated design fidelity cannot be guaranteed by prompt text.
- Local photo path uses browser decoding/canvas, bounds image dimensions, revokes object URLs. Renderer uses per-instance camera dimensions, pixel projection, serialized cancellation, texture/material/model cleanup and rotated-bound hiding. Necklaces use face/chin plus both shoulders; earrings use paired face anchors. Lack of segmentation means hair/clothing occlusion is not modeled.
- Local camera requests video only; abort stops tracks; component unmount/visibility change triggers cleanup. These source observations do not verify device-level behavior or real fitting.

## Frontend route inventory (source-discovered; current browser execution BLOCKED)
Public: /, /products (search/filter/sort/pagination query variants), /products/[slug], /collections, /collections/[slug], /wishlist, /contact, /about, /custom-jewellery, /appointments, /request-status, /privacy, /terms, /try-on/[slug]. Metadata/resource routes: /robots.txt, /sitemap.xml, /icon.svg. Framework not-found/loading/error boundaries also exist.
Admin: /admin/login; /admin; /admin/products; /admin/products/[id or new]; /admin/inventory; /admin/categories; /admin/categories/[id or new]; /admin/collections; /admin/collections/[id or new]; /admin/homepage; /admin/homepage/preview; /admin/homepage/sections/[key or new]; /admin/homepage/banners/[id or new]; /admin/enquiries; /admin/enquiries/[id]; /admin/appointments; /admin/appointments/availability; /admin/appointments/[id]; /admin/try-on; /admin/settings. Unknown admin paths invoke notFound after owner verification.

## Endpoint coverage and safety classification
All routes mount under /api. Source-reviewed families: auth login/me/logout; catalogue public/admin products/categories (including by-slug, inventory-history, publication/inventory mutations); CMS collections/membership/order and homepage sections/banners/draft/preview/publish; public homepage/banners; CRM four enquiry types, appointments, receipt status, admin lists/details/notes/history/activity/actions/availability, contact-options; images product list/upload/replace/order/primary/delete/cleanup plus category/CMS assets; try-on config/products/studio-products/photo/jobs/status/result/retry/delete/settings/analytics/product configuration/overlay.
GET product config sets a guest cookie: avoid it under no-session-creation browser restriction. Receipt status uses POST even though its DB operation is read-only: not exercised under GET-only instructions. Every mutation, login/logout, submission, cleanup, provider dispatch and real upload is REQUIRES APPROVAL. Source review is not an endpoint contract test matrix; per-endpoint input/error/test mapping remains unfinished.

## Blocked and untested areas — do not silently treat as passed
- All current live page/interaction checks and requested five-viewports matrix: BLOCKED by localhost:3000 connection refusal. No development servers started.
- Admin authenticated browsing: REQUIRES APPROVAL for creating a session; real customer screens also need a privacy-safe inspection strategy.
- Database-writing tests, form submission, login/logout, image changes, camera/photo uploads/provider operations: REQUIRES APPROVAL; not performed.
- Genuine necklace cutout fitting and mobile camera stability: BLOCKED by absent overlay schema/assets and no permitted upload exercise.
- Cloudinary create/delete permission verification: REQUIRES APPROVAL for mutations. Error handler implementation is not proof of current permission state.
- Full database drift/constraints/effective access review, row-integrity aggregate checks, complete migration checksum comparison: NOT YET COMPLETED. Only metadata checks described above are current live evidence.
- Dependency advisory scan, complete OWASP/WCAG assessment, all admin components, all frontend source interactions, complete validation-module review, per-endpoint test matrix: NOT YET COMPLETED (not environmental blockers).
- Current build/typechecks, performance measurements, AWS/DNS/SSL/monitoring/backups and disaster recovery: NOT EXECUTED/NOT VERIFIED in this continuation.
- Do not create final audit report or readiness verdict from this checkpoint. Continue remaining safe source inspection and obtain a safe read-only runtime strategy before live UI coverage.

## Continuation 3 — 9 November 2026 — source, security and dependency review

This is an appended investigation checkpoint, not the final audit report. AUD-001 through AUD-010 and their original evidence above are preserved. No application, configuration, schema, catalogue, Cloudinary or infrastructure remediation was performed. No API/worker was started, customer form submitted, session created, provider job dispatched or database-writing test run. The dependency registry was queried read-only; no packages were installed or updated. Prior runtime evidence is historical evidence, not a fresh pass.

### AUD-001 additional evidence — exact Compose defect

`compose.yaml:10` contains `  -      "127.0.0.1:5433:5432"`, with its sequence marker aligned at two spaces instead of nested under `database.ports`. The next `volumes` mapping therefore cannot follow a valid database service mapping. The previously executed installed Docker parser reported `yaml: line 1: did not find expected key`; its reported line is not the location of the malformed port item. Recommended correction only: indent the sequence marker beneath `ports`, e.g. `      - "127.0.0.1:5433:5432"`, then repeat `docker compose -f compose.yaml config --no-interpolate --quiet`. Do not print interpolated configuration containing secrets. No edit or container startup performed.

### AUD-011 — P2 — Appointment proposal is incorrectly described as reserved

- Affected: `apps/web/src/components/status-form.tsx:15`; `apps/api/src/modules/crm/service.ts`, `appointmentAction` PROPOSE/CONFIRM branches; `components/admin/crm.tsx`, appointment workflow explanation.
- Evidence: public RESCHEDULE_PROPOSED text says “This slot is held tentatively pending your response.” The service validates the proposed time but reserves the new slot only at confirmation; the admin screen correctly says proposals alone do not reserve a new slot.
- Root cause: customer copy diverges from the booking state machine.
- Business impact: customers can believe a visit is reserved when another confirmation can consume capacity.
- Recommended correction: align customer language with the actual proposal/confirmation contract; a true temporary hold would require a separately designed, approved workflow.
- Verification required: isolated competing-booking fixture and all proposal/confirmation receipt states. Live submissions/actions REQUIRES APPROVAL.

### AUD-012 — P2 — Required custom jewellery type is not enforced

- Affected: `apps/web/src/lib/forms.ts:11,23`; `components/request-forms.tsx`, custom enquiry select and resolver; API `modules/crm/validation.ts:7`.
- Evidence: custom jewellery type is displayed as required, but the shared Zod schema accepts an empty trimmed string (`max(100)` with no minimum). The form uses `noValidate` and a Zod resolver. Payload construction simply omits the subject when the type is blank; the API permits that optional subject.
- Root cause: field requirement is not represented in the effective kind-specific schema.
- Business impact: incomplete design enquiries can reach the showroom despite the visible requirement.
- Recommended correction: agree whether the field is required and enforce that contract consistently in frontend validation and accepted API input.
- Verification required: blank/whitespace custom type and valid other enquiry kinds in pure validation tests, then an approved fixture submission. No submission performed.

### AUD-013 — P2 — New CMS/collection uploads are not keyboard operable

- Affected: `components/admin/cms.tsx:236-247`; `components/admin/collections.tsx:349` and corresponding hidden file inputs/product-source selects, under `apps/web/src`.
- Evidence: empty upload targets are clickable `div` elements with no tabIndex, button role or keyboard handler; their file inputs use `display:none`. The replacement button exists only after an image is present. Product-source selects have adjacent explanatory text but no associated label/aria-label.
- Root cause: custom upload presentation omits native control semantics.
- Business impact: keyboard-only owners cannot open the initial file picker from that target; assistive technology lacks a reliable select name.
- Recommended correction: use a named native button/label and properly associated select labels, retaining the existing design.
- Verification required: keyboard and screen-reader inspection with an empty fixture, without selecting/uploading a file; actual file submission requires approval. Source-level WCAG keyboard/name concern, not a complete WCAG verdict.

### AUD-014 — P2 — Admin upload limit differs from API default

- Affected: `components/admin/cms.tsx:102`; `components/admin/collections.tsx:212`; `apps/api/src/modules/images/validation.ts:6`; image route raw-body limit.
- Evidence: both direct upload screens accept/advertise 10 MiB, while the shared image API defaults to 5 MiB via IMAGE_MAX_BYTES. The separate try-on overlay screen correctly advertises its own 5 MiB limit.
- Root cause: duplicated hardcoded frontend limits rather than a shared capability contract.
- Business impact: with default API settings, an apparently accepted 5–10 MiB image fails at the server after transfer.
- Recommended correction: expose/use the effective server limit and consistent units, or agree one common limit.
- Verification required: verify the actual deployed limit without exposing environment values, and approved boundary-byte tests. This is a confirmed default-contract mismatch, not a claim that the active environment necessarily uses the default.

### AUD-015 — P2 — Clearing optional editorial text silently preserves old text

- Affected: `components/admin/collections.tsx:634`; `components/admin/cms.tsx:774` and optional subtitle/description payload expressions; `apps/api/src/modules/cms/routes.ts:73-87,151-193`.
- Evidence: cleared description is serialized as `description.trim() || undefined`. JSON serialization removes that key. Collection PATCH applies only supplied fields; section/banner PATCH merges supplied values into the previous record.
- Root cause: empty text is treated as “not supplied” instead of an explicit clearing operation.
- Business impact: an owner can receive a successful save while unwanted old editorial text remains.
- Recommended correction: send the supported empty-string/null value for fields intentionally cleared and reserve omission for unchanged fields.
- Verification required: pure payload regression checks and an approved isolated edit/readback round trip. No records edited.

### AUD-016 — P3 — Enquiry receipt explanations use internal rather than public statuses

- Affected: `components/status-form.tsx:15`; `apps/api/src/modules/crm/service.ts:13` (`safeEnquiry`).
- Evidence: public DTO emits RECEIVED, IN_REVIEW or CLOSED; UI explanation branches test NEW, CONTACTED, IN_PROGRESS, WAITING_FOR_CUSTOMER and CONVERTED/CLOSED. The heading remains visible, but the received/in-review explanatory branches cannot match.
- Root cause: frontend explanatory copy is coupled to internal CRM states instead of the redacted public contract.
- Business impact: customers lose next-step guidance for most enquiries. Do not solve by exposing private workflow states without a deliberate privacy review.
- Recommended correction: map copy to the public DTO statuses.
- Verification required: render fixtures for all three public statuses; receipt POST against a service remains approval-gated.

### AUD-017 — P2 — Retention wording does not distinguish access expiry from physical purge

- Affected: `components/try-on/photo-try-on.tsx:168`; API `modules/tryon/runtime.ts:50,145-165`; `modules/tryon/storage.ts`; `docs/review/PRIVACY_POLICY_DRAFT.md`.
- Evidence: UI says showroom copies expire within configured hours. Access checks do reject expired jobs, but deleting stored files depends on the worker's cleanup/sweep, which can be offline or fail. The unpublished privacy draft correctly explains delayed physical cleanup; the public privacy page does not.
- Root cause: user-facing lifecycle wording is less precise than the implemented asynchronous deletion lifecycle.
- Business impact: customers may infer guaranteed physical deletion at the expiry time, including when the worker is down. External Google retention is also not controlled by showroom deletion.
- Recommended correction: distinguish access expiry, eventual showroom file purge and external-provider retention; approve actual provider/retention policy before publishing it.
- Verification required: isolated worker-outage/cleanup recovery and provider-account policy evidence. No real portraits, deletion or provider requests used.

### AUD-004 additional frontend evidence — published assets can be destroyed before saving

`components/admin/cms.tsx:157-166` and `components/admin/collections.tsx:267-276` invoke `POST admin/cms/image/destroy` immediately when Remove Image is clicked, before the enclosing editor saves or the homepage is republished. Thus the defect is reachable from ordinary editor controls, not just a handcrafted request. An asset still referenced by saved content or a published snapshot can disappear even if the editor is abandoned. Attachment-aware deferred cleanup must include snapshots and both desktop/mobile references. These actions were not executed. Original finding and severity remain preserved; destructive workflow impact merits prioritization alongside AUD-003.

### Per-endpoint static evidence matrix

Scope: every method/path registration in `app.ts`, `auth.ts` and the five `modules/*/routes.ts` files was inspected, including loop-generated paths. This is source evidence, **not** executed endpoint tests. All paths below begin `/api`. Legend: **P** anonymous/public; **O** database-backed owner session (`requireOwner`, ownerSlot=1 and unexpired hashed session); **G** guest ownership hash; **R** read without intentional persistent mutation; **W** writes or external effects, REQUIRES APPROVAL. A public GET can issue a cookie as explicitly noted. All live verification is BLOCKED until a safe runtime exists.

Inherited controls for every row: exact configured Origin required on non-GET/HEAD/OPTIONS; JSON body limit 100 KB; global 120/min process-local IP limiter; CORS allowlisted origin; Helmet on API responses. Owner/auth responses private/no-store. Errors centralized in `errors.ts`: Zod 422; invalid JSON 400; oversized body 413; explicit ApiError status/code; missing Prisma record 404; unique/FK/transaction conflicts 409; unexpected failure sanitized 500. These common errors apply to every row, alongside the row-specific outcomes. Endpoint schemas named below live in that module's validation/settings file or inline route definition. Owner rows additionally return 401 for missing/expired/non-owner sessions. No authenticated route relies solely on frontend protection.

Foundation (`app.ts`, `auth.ts`):

- GET `/health/live` — P/R; no input schema; process liveness only, 200.
- GET `/health/ready` — P/R; SELECT 1 plus WebsiteSetting.count; 503 on failure; AUD-007 coverage limitation.
- GET `/admin/setup-status` — O/R; counts products/categories/settings; no customer details.
- POST `/auth/login` — P/W; strict normalized email/password, bcrypt and 72-byte cap, 10 attempts/15 min; 401 generic credentials failure; rotates sessions/audits on success.
- GET `/auth/me` — O/R; allowlisted owner identity fields.
- POST `/auth/logout` — O/W; revokes session and clears current/legacy cookies; 204; no meaningful body fields consumed.

Catalogue (`modules/catalogue/routes.ts:14-157`):

- GET `/products` — P/R; strict listQuery, pagination/filter/range validation, public projection/visibility; admin-only publication filter rejected 422; AUD-002.
- GET `/admin/products` — O/R; same listQuery with admin publication filter, excludes soft-deleted records; AUD-002.
- GET `/categories` — P/R; strict pagination/search<=100, visible categories only.
- GET `/admin/categories` — O/R; same query, includes hidden categories.
- GET `/products/:slug` — P/R; bounded identifier, publicWhere/publicDto; missing/withdrawn 404.
- GET `/admin/products/by-slug/:slug` — O/R; bounded slug, not deleted, public projection plus publication; 404.
- GET `/admin/products/:id` — O/R; bounded id, privateDetails/images included only for owner; 404.
- POST `/admin/products` — O/W; strict product schema plus cross-field state rules; transaction creates inventory history/audit; 201, 409 FK/unique.
- PATCH `/admin/products/:id` — O/W; nonempty strict productPatch and merged state validation/locking; price hiding clears public price, archive forces draft.
- PATCH `/admin/products/:id/publication` — O/W; strict DRAFT/PUBLISHED enum, updateProduct business rules and row lock.
- PATCH `/admin/products/:id/inventory` — O/W; availability enum/reason<=1000, update/history/audit; archive forces draft.
- DELETE `/admin/products/:id` — O/W; literal confirm:true; soft deletion/archive/draft through updateProduct; 204.
- GET `/admin/products/:id/inventory-history` — O/R; id plus strict pageQuery; parent existence checked, paginated history; 404.
- POST `/admin/categories` — O/W; strict category schema, HTTPS image URL if supplied; transactional audit; 201/409.
- PATCH `/admin/categories/:id` — O/W; nonempty categoryPatch/id; audit, missing404/conflict409.
- DELETE `/admin/categories/:id` — O/W; confirm:true/id; FK protects referenced products including soft-deleted ones; 204/409.

CMS (`modules/cms/routes.ts:35-204`):

- GET `/collections` — P/R; strict pageQuery; visibleCollection/publicCollection projection; public image/reference resolution.
- GET `/admin/collections` — O/R; strict pageQuery; owner collection records.
- GET `/collections/:id` — P/R; path value interpreted as slug, pageQuery; visible collection and public products; 404.
- GET `/admin/collections/:id` — O/R; actual id/pageQuery; collection products paginated; 404.
- POST `/admin/collections` — O/W; strict collectionInput, safe generated or supplied slug, refs validation; 201.
- PATCH `/admin/collections/:id` — O/W; nonempty partial collectionInput, merged refs, existence; 404/422/409.
- DELETE `/admin/collections/:id` — O/W; confirm:true, archive/hide/draft; 204.
- POST `/admin/collections/:id/products` — O/W; productId only, nondeleted/nonarchived product, collection existence; 201/422/409.
- DELETE `/admin/collections/:id/products/:productId` — O/W; empty body/id validation, existing collection; 204, removal is idempotent.
- PATCH `/admin/collections/:id/products/order` — O/W; orderInput ids and exact membership permutation; rejects missing/duplicate/foreign members.
- POST `/admin/collections/order` — O/W; orderInput and complete nonarchived collection permutation.
- GET `/admin/homepage/sections` — O/R; pageQuery; draft sections and computed schedule state.
- GET `/admin/homepage/banners` — O/R; pageQuery; draft banners and schedule state.
- POST `/admin/homepage/sections` — O/W; strict sectionInput, sectionRules, schedule and refs; 201/422.
- POST `/admin/homepage/banners` — O/W; strict bannerInput, image/CTA/alt/schedule/refs; 201/422.
- POST `/admin/homepage/sections/order` — O/W; ids exact section-key permutation.
- POST `/admin/homepage/banners/order` — O/W; ids exact banner-id permutation.
- PATCH `/admin/homepage/sections/:id` — O/W; path is section key; nonempty partial schema merged with old content, full rules/refs rechecked; 404/422.
- PATCH `/admin/homepage/banners/:id` — O/W; nonempty partial schema merged with old record; schedule/image/refs rechecked; 404/422.
- DELETE `/admin/homepage/sections/:id` — O/W; confirm:true and bounded section key; 204/404.
- DELETE `/admin/homepage/banners/:id` — O/W; confirm:true/id; 204/404.
- GET `/admin/homepage/draft` — O/R; repeatable-read draft snapshot.
- GET `/admin/homepage/preview` — O/R; repeatable-read draft render with reference visibility rules.
- POST `/admin/homepage/publish` — O/W; empty strict body; validated atomic publication snapshot.
- GET `/homepage` — P/R; published snapshot only, current visibility/scheduling applied.
- GET `/banners` — P/R; strict pageQuery; slices published homepage banners.

CRM (`modules/crm/routes.ts:22-85`):

- POST `/enquiries/product` — P/W; strict enquiryInput, route selects type, productId required and public product checked; consent/contact/message; 201, 422.
- POST `/enquiries/general` — P/W; strict general enquiry; disallows productId/callback/image references for wrong kind; 201.
- POST `/enquiries/custom` — P/W; strict custom enquiry; <=5 unique managed inspiration ids and reference checks; subject optional; 201; AUD-012.
- POST `/enquiries/callback` — P/W; strict callback enquiry and optional future callback time; 201.
- POST `/appointments` — P/W; strict appointmentInput, future offset datetime, visitors1–20, consent/contact and referenced catalogue checks; 201. Request is not a reservation.
- POST `/enquiries/status` — P/R but POST is not permitted in this audit; UUID reference + 64hex token hash, age<=90 days, redacted safeEnquiry; generic404 on mismatch; 30/min.
- POST `/appointments/status` — P/R but approval-gated POST; same receipt contract and safeAppointment; generic404; 30/min.
- GET `/admin/enquiries` — O/R; strict listInput, status enum/type/date range/search<=200, token hashes removed.
- GET `/admin/appointments` — O/R; listInput with appointment status enum; enquiry-only type rejected422; hashes removed.
- GET `/admin/enquiries/:id` — O/R; bounded id, redact hash, includes owner-only message/inspiration; 404.
- GET `/admin/appointments/:id` — O/R; bounded id, redact hash; 404.
- POST `/admin/enquiries/:id/notes` — O/W; noteInput body1–5000; parent checked, note+audit transaction; 201.
- POST `/admin/appointments/:id/notes` — O/W; same note/parent/audit contract; 201.
- GET `/admin/enquiries/:id/notes` — O/R; parent/id/pageQuery, private paginated notes.
- GET `/admin/enquiries/:id/history` — O/R; parent/id/pageQuery, paginated state history.
- GET `/admin/enquiries/:id/activity` — O/R; parent/id/pageQuery, audit constrained to entity and id.
- GET `/admin/appointments/:id/notes` — O/R; parent/id/pageQuery, private paginated notes.
- GET `/admin/appointments/:id/history` — O/R; parent/id/pageQuery, paginated state history.
- GET `/admin/appointments/:id/activity` — O/R; parent/id/pageQuery, entity-constrained audit.
- PATCH `/admin/enquiries/:id` — O/W; nonempty strict status/priority enums; allowed transition validation and atomic history/audit; 404/422.
- POST `/admin/appointments/:id/actions` — O/W; actionInput, PROPOSE requires time, CANCEL/REJECT require public reason; state/capacity/hours/closure locks; business conflicts; AUD-011.
- GET `/admin/availability` — O/R; singleton may legitimately return null.
- PUT `/admin/availability` — O/W; timezone, unique weekday/hours, duration/buffer/capacity bounds, ISO closure dates, optional phone; locked upsert/audit.
- GET `/contact-options` — P/R; only public WhatsApp number/timezone, nullable when unconfigured.

All five public CRM submission endpoints share 10/15min limiter. No email dispatch exists in these handlers. Duplicate transport retry is not deduplicated: frontend warns about uncertain outcomes and does not auto-retry; a committed request with lost receipt remains a recovery limitation requiring an approved isolated test.

Images (`modules/images/routes.ts`, mounted at `/api/admin`; O for every entry):

- GET `/admin/products/:productId/images` — O/R; id/product existence, gallery order and limits.
- POST `/admin/products/:productId/images` — O/W; raw JPEG/PNG/WebP byte cap, strict alt query<=500, decode/re-encode/type/pixel/animation validation, product lock and image count; 201.
- POST `/admin/products/:productId/images/:imageId/replace` — O/W; same validation plus scoped image id, durable cleanup; 200 with queued cleanup.
- PATCH `/admin/products/:productId/images/order` — O/W; strict imageIds<=10 plus exact service membership/order checks.
- PATCH `/admin/products/:productId/images/:imageId/primary` — O/W; strict empty body, scoped image; reorders primary.
- DELETE `/admin/products/:productId/images/:imageId` — O/W; confirm:true, service references/ownership checks; 202 detached/cleanup queued.
- POST `/admin/images/cleanup` — O/W; strict empty body, destroys queued remote assets; never a read-only health check.
- POST `/admin/categories/image` — O/W; validated binary, draft UUID namespace, external upload; 201; AUD-003/004.
- POST `/admin/categories/:categoryId/image` — O/W; category exists unless `new`, validated binary, upload+DB association; 201; AUD-003.
- DELETE `/admin/categories/:categoryId/image` — O/W; category/id, remote destruction then DB detach; AUD-003; no confirm body schema.
- POST `/admin/categories/image/destroy` — O/W; strict publicId<=300 and category prefix; AUD-004 false success/attachment gap.
- POST `/admin/cms/image` — O/W; validated binary, slot enum sections/banners/collections/general, UUID namespace; 201; no DB association yet.
- POST `/admin/cms/image/destroy` — O/W; strict publicId<=300 and CMS prefix; AUD-004 false success/attachment gap.

Binary upload/replace/cleanup/category/CMS mutations additionally use 20/min limiter. Cloudinary integration maps missing provider configuration and permission failures to explicit errors, but the destroy handlers above swallow some failures. Credentials-present checks do not demonstrate live upload permissions.

Try-on (`modules/tryon/routes.ts`, `settings.ts`, `runtime.ts`, `overlay.ts`):

- GET `/try-on/products/:id/config` — P/read plus **guest-cookie issuance/refresh**, forbidden to exercise under no-session rule; bounded product id/current eligibility/providerConfigured; AUD-005.
- GET `/try-on/products` — P/R; configured eligible categories, published enabled pieces and dedicated overlay projection; AUD-005.
- GET `/try-on/studio-products` — P/R; page1–10000, 24-item pagination; arEnabled gate, valid dedicated overlay and catalogue visibility; AUD-005.
- POST `/try-on/photo` — G/W; strict createInput with consent/product, UUID idempotency-key, allowed raw MIME/byte cap, decoded image validation; eligibility409/provider503/quota errors; 202 job. Transaction reserves global attempt and records consent.
- GET `/try-on/jobs/:id` — G/R; UUID and ownerHash/unexpired/notdeleted job; inaccessible404; private DTO/signature.
- POST `/try-on/jobs/:id/retry` — G/W; strict empty body, ownership and retryable state/quota; 202; paid-job potential.
- DELETE `/try-on/jobs/:id` — G/W; strict empty body, UUID/ownership; access revocation/cleanup; 204.
- GET `/try-on/jobs/:id/result` — G/R; UUID, strict until/signature query, HMAC, ownership, expiry, completion and current eligibility; private binary/no-referrer. Not an anonymous share URL.
- GET `/admin/try-on/settings` — O/R; settings plus provider status, no secret key.
- PATCH `/admin/try-on/settings` — O/W; nonempty partial settingsInput merged/revalidated; existing category ids, quota/upload/retention bounds; advisory lock/audit.
- GET `/admin/try-on/analytics` — O/R; status aggregates only; no customer portraits.
- GET `/admin/products/:id/try-on` — O/R; existing nondeleted product, assetInput projection/defaults; 404.
- PATCH `/admin/products/:id/try-on` — O/W; nonempty partial assetInput, row lock, merged validation, eligible references and kind/calibration bounds; 404/422.
- GET `/admin/products/:id/try-on/overlay` — O/R; product exists; dedicated row or null; missing table explicitly503 OVERLAY_SCHEMA_PENDING.
- POST `/admin/products/:id/try-on/overlay` — O/W; PNG raw<=5MiB, kind enum, expectedPublicId concurrency guard, representsActualProduct=true, decoded transparency validation; genuine identity still requires owner review; 201; separate gallery-safe association and durable cleanup intent.
- DELETE `/admin/products/:id/try-on/overlay` — O/W; confirm:true and expectedPublicId; scoped detach and queued cleanup; stale replacement rejected; no gallery deletion.

Photo/retry and overlay mutations have an additional try-on limiter. Dynamic verification for **each** row still needs its valid response, invalid schema, unauthenticated/expired/wrong principal where applicable, missing/foreign id, timeout/storage failure and transaction conflict cases. Associated source tests: `app.test.ts`; catalogue/catalogue.test.ts + integration-cases.ts; cms/validation.test.ts + integration-cases.ts; crm/validation.test.ts + integration-cases.ts; images/images.test.ts + integration-cases.ts; tryon/provider.test.ts, overlay.test.ts, overlay-routes.test.ts, worker.test.ts, renderer.test.ts, studio.test.ts and integration-cases.ts. Presence of a suite is not evidence that every listed endpoint branch is covered or passed.

### OWASP coverage — static assessment across every category

Reference taxonomy: [OWASP Top 10:2025](https://top10.owasp.org/2025/0x00_2025-Introduction/) and [OWASP API Security Top 10:2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/). This is a complete category-oriented source assessment, not a penetration-test certificate. No exploit probes were sent.

- **A01 Broken Access Control:** owner router/individual guards, public projections, receipt hashes, guest ownership/result grants reviewed. AUD-006 database privileges unresolved. Actual proxy/cache cross-user isolation and effective DB-role reachability require isolated verification.
- **A02 Security Misconfiguration:** exact Origin, CORS, API Helmet, secure production cookies and trust-proxy setting reviewed. AUD-001/005/007 remain. Next config has no storefront security-header policy; API Helmet does not establish document-response CSP/HSTS. Edge policy unknown, so this is an unverified deployment control rather than proof live headers are missing.
- **A03 Software Supply Chain Failures:** lockfile/manifests, local WASM preparation lifecycle, advisory/outdated analysis below. No dependency updates. No repository CI workflow was found at `.github`; build provenance, branch/release protection, secret scanning and artifact attestation are unverified outside this checkout.
- **A04 Cryptographic Failures:** random 256-bit session/receipt/guest tokens, SHA-256 stored hashes, bcrypt password verification, HMAC expiring result grants; server-only provider key. TLS termination, DB TLS policy, disk/backup encryption, Windows private-media ACL and secret rotation are deployment checks, not proven by code or POSIX mode arguments.
- **A05 Injection:** strict Zod payloads, parameterized Prisma/tagged raw SQL, React text rendering and relative CTA validation examined; no unsafe raw SQL/eval/HTML injection sink found in the inspected application paths. This is not proof all possible input combinations are safe. Stored CMS URLs, real proxy normalization and malformed parser inputs need fixture testing.
- **A06 Insecure Design:** booking locks/state transitions, quotas, idempotent photo generation and no automatic paid retry after unknown outcome reviewed. AUD-003/004/011/012/017 and missing recovery AUD-008 remain. CRM submission lost-response recovery lacks idempotency; shared global photo attempt quota is not a monetary/provider spending limit.
- **A07 Authentication Failures:** owner-only provisioned account, generic login errors/dummy bcrypt, rotating expiring sessions and login limiter. Recovery absent AUD-008; no MFA flow found. IP limits are per process, and forwarded-IP trust must match the real proxy. Login/logout/session-creation tests need explicit approval.
- **A08 Software or Data Integrity Failures:** transaction/audit pairing, CMS snapshots/ref checks, image decoding and upload cleanup intent reviewed. AUD-003/004 exceptions compromise asset lifecycle integrity. Transparency checks cannot establish product authenticity. Package provenance and backup restore integrity unverified.
- **A09 Security Logging and Alerting Failures:** request IDs/path-only logging, generic unexpected-error type, audit records and worker first-failure/recovery logs reviewed. Useful minimization exists, but no deployed alert destination, log retention or tested escalation evidence. Category rollback logging passes a raw remote error object (`images/routes.ts:73`): check its possible contents using sanitized fixtures before claiming all provider errors are redacted.
- **A10 Mishandling of Exceptional Conditions:** shared safe errors, UI cancellation/timeouts, no mutation auto-retry, provider time/byte bounds and worker overlap guard reviewed. AUD-003/004/005/007, uncertain upload/commit outcomes, worker cleanup outage and inaccessible receipts remain targeted failure-test needs.

API-specific crosswalk: API1 object access → owner/guest/receipt checks; API2 authentication → auth above; API3 property authorization → strict schemas/public allowlists; API4 resource consumption → body/pixel/time/page/rate limits but unbounded whole-catalogue client fetches and process-local limit caveats; API5 function authorization → complete endpoint matrix; API6 sensitive business flows → enquiry spam, capacity and generation quotas; API7 SSRF → provider reference restricted to configured Cloudinary managed path with no redirects and bounded fetch, Next image hostname broader than one cloud account; API8 misconfiguration → proxy/header/DB/default ACL; API9 inventory → route/method inventory above and historical documentation discrepancies; API10 unsafe API consumption → provider metadata/result validation, Cloudinary failure handling including AUD-003/004. Every category has a recorded control/gap; runtime attacks and infrastructure verification remain blocked, not passed.

### Frontend, admin, validation, SEO and accessibility coverage

The previously discovered route inventory remains authoritative. This continuation traced all component families and route entry points; large CMS/catalogue components were inspected by interaction and payload sections rather than pretending a line-by-line browser execution. Reviewed families: header/footer/navigation; cards/home sections/media/gallery; filters/collection navigation/wishlist; enquiry/appointment/status forms; showroom/business details; local fitting/live camera/AI photo/studio selection; admin login/shell/session, overview, shared editor/fields/confirmation/table/loading/pagination, catalogue/category/inventory/images, collections/CMS, CRM/availability, try-on settings and separate overlay upload. `made-for-you-experience.tsx` is also present but `/custom-jewellery` currently renders the virtual studio; do not assume that older bespoke component is the active customer route.

- Public forms have bounded contact/message fields, consent, resolver errors, disabled submission and focused receipt; backend remains authoritative. Appointment local date conversion/showroom timezone exists; timezone/DST and native validation need real browser fixtures. Status lookup keeps reference/token out of URLs and persistent storage; token Copy writes the user's clipboard only on explicit interaction.
- Admin generic forms validate numeric ranges/steps, enum selections, weight/price/date rules and CTA paths. Availability validates timezone/hours and relies on server for all schedule constraints. Product/gallery destructive actions and overlay removal have confirmation. Custom collection/CMS editors have the gaps above; their uploads happen immediately rather than as part of a final save transaction.
- Admin loading aborts requests on resource change; auth is rechecked by shell; API helper validates response envelope and warns about uncertain mutations. Confirmation dialog has alertdialog semantics, focus trapping/Escape/restoration. Modal inertness, browser back/unsaved changes and rapid concurrent interactions still require fixture review.
- Gallery has previous/next/thumb selection and fallback, but no implemented image zoom was found in that component. Wishlist caps at100 slugs, falls back to memory and revalidates public visibility; cross-tab behavior needs browser checks. No simulated checkout/payment or customer account capability should be inferred from reserved schema models.
- SEO: metadata/canonical/title/description checked at route entry points; product detail has Open Graph image/title. Collection metadata is simpler; global Twitter/Open Graph defaults and Product/LocalBusiness JSON-LD were not found. These are enrichment opportunities, not demonstrated indexing failures. Sitemap fully paginates public products/collections, fails503 rather than publishing a partial list, and caps at50,000; more URLs need a sitemap index. Canonical origin is hardcoded to `https://shreeramjewellers.store`.
- Admin, wishlist, status and per-product try-on noindex policies exist. `/custom-jewellery` is indexable and has local-fitting metadata. robots rules are discovery hints, not authorization. Staging-wide noindex is not configured by environment in the inspected source: minimum deployment check is to prevent staging discovery at the host. Draft-product fallback is owner-authenticated; its metadata branch does not explicitly set noindex for an authenticated draft preview. This does not demonstrate public draft disclosure; check authenticated HTML/cache isolation separately.
- Accessibility controls found: `lang=en-IN`, storefront main/skip link, breadcrumb navigation/current page, semantic form labels, image alternatives, alert/status regions, keyboard-visible focus, table column scope, gallery/wishlist pressed states, dropdown `:focus-within`, responsive and reduced-motion CSS. AUD-013 is confirmed. Bespoke smooth-scroll handlers do not themselves move focus; inspect if that component becomes routed. Contrast, target sizes, zoom/reflow, heading order under every CMS arrangement, screen-reader announcements and mobile menu/modal traversal have no current measured pass.

### Performance evidence and measurement limits

Source risks: root `app/layout.tsx` forces dynamic rendering and API calls use no-store; this preserves live visibility but makes browsing sensitive to API latency. CMS public collection lists resolve each collection, creating query fan-out. Admin overview/priority/scheduled-date/CMS image-source selectors exhaust pages client-side (`lib/admin/api.ts:allRecords`, `components/admin/crm.tsx`); `try-on/jewellery-rail.tsx:20-29` downloads every public product page to find eligible IDs; wishlist loads each saved product. These patterns scale with catalogue/CRM size and can hit the 120/min shared IP limit, especially server rendering behind one origin. Recommended later work: measured query profiling, bounded server-side aggregates/filtering and caching that respects publication/privacy. No optimization implemented.

Positive source observations: responsive next/image-derived Cloudinary delivery, dimensions/aspect ratios/fallbacks and lazy loading; abort/timeouts for many reads; on-device model/render lifecycle cleanup. Large model/WASM/Three resources and local decode memory cost need measurements on real low-memory phones. No current LCP/INP/CLS, TTFB, bundle-size, FPS, heap, API percentile latency, query plans or load-capacity numbers were measured. Historical screenshots and unit tests cannot supply those numbers. Full-build execution was not used as a substitute for profiling.

### Dependency analysis — installed tools, no updates

`npm audit --json --ignore-scripts` completed against the registry with exit0: **0 known reported vulnerabilities** (info/low/moderate/high/critical all0); dependency metadata total499, prod278/dev186/optional112/peer31/peerOptional0 (categories overlap; do not sum). Initial restricted-network attempt failed ENOTFOUND; the authorized network retry succeeded. This is an advisory snapshot, not proof of absence of vulnerabilities or supply-chain compromise.

`npm outdated --json` network retry completed exit1, which indicates outdated entries rather than a failed inspection. Initial restricted-network attempt separately ended ENOTFOUND. Current → wanted → latest reported:

- @hookform/resolvers 5.9.2 → 5.9.2 → 7.0.5
- @tailwindcss/postcss 4.3.3 → 4.3.5 → 4.3.5
- @types/node 22.20.5 → 22.20.5 → 26.6.6
- @types/supertest 6.0.3 → 6.0.3 → 7.2.1
- concurrently 9.2.5 → 9.2.5 → 10.0.7
- dotenv 16.6.1 → 16.6.1 → 18.0.10 (API and database workspace)
- dotenv-cli 8.0.0 → 8.0.0 → 11.1.0
- express-rate-limit 8.7.2 → 8.7.3 → 8.7.3
- lucide-react 0.468.0 → 0.468.0 → 1.70.0
- next 16.4.4 → 16.4.5 → 16.4.5
- pino 9.14.0 → 9.14.0 → 10.4.0
- pino-http 10.5.0 → 10.5.0 → 11.0.0
- supertest 7.3.1 → 7.3.2 → 7.3.2
- tailwindcss 4.3.3 → 4.3.5 → 4.3.5
- typescript 5.9.3 → 5.9.3 → 7.0.2

No automatic upgrade recommendation: stage compatible updates with release review and tests; major versions and Node type/runtime alignment need separate decisions. No npm audit fix, install, update or lockfile mutation performed.

### Deployment, domain, SSL, monitoring and backup documentation

Reviewed README, `docs/ARCHITECTURE.md`, `PRODUCTION_LAUNCH_CHECKLIST.md`, `VIRTUAL_TRYON_SECURITY.md`, `VIRTUAL_TRYON_ENVIRONMENT.md`, Next configuration and Compose. Available repository infrastructure is the local PostgreSQL Compose definition; no `.github` workflow directory or Terraform/Dockerfile/nginx deployment definition was found in the inspected repository search. This does not establish what exists outside the repository. No AWS connection, DNS lookup/change, production HTTP probe or certificate operation performed.

Launch checklist explicitly leaves domain control/HTTPS redirects/certificate renewal, process supervision/private API routing, trusted proxy chain, shared limits, encrypted backup+isolated restore, monitoring/alert delivery, rollback and privacy approval open. Documentation is not evidence these controls run. No recovery point or successful restore is verified. Private portrait directory is supposed to be outside ordinary backups/sync; actual host ACLs/exclusions require operator evidence. Environment documentation includes deployment/start commands that would mutate the DB/start the worker: none were followed. Historic “implemented” headings do not override their manual-test-pending caveats or current AUD-005/006.

### Privacy reconciliation (extends AUD-009 and AUD-017)

Local `/custom-jewellery` photo fitting and camera tracking keep portraits/landmarks in the browser; overlay/model downloads are distinct from portrait uploads. Per-product AI mode sends a sanitized portrait and selected catalogue photograph to Google only following Generate/consent, stores private server input/result, uses a guest cookie and tab job id, and can export/share at the user's direction. Public gallery/overlays use Cloudinary; wishlist uses localStorage; status token is kept private/in memory; CRM consent/history and usage accounting persist separately from private photos. No automatic customer email sender was found in the inspected CRM path.

The AI interface discloses Google, but the short published privacy page still does not describe this complete processing. The existing review draft accurately distinguishes lookup lifetime from CRM retention and expiry from physical cleanup, but has unresolved owner/provider/contact/retention placeholders and is **not published policy**. Provider configuration does not prove account entitlement, processing location, no-training terms or retention; these need owner/provider documents. No external provider compliance verdict is made.

### Existing tests — execution safety and coverage limitations

- **Already executed in earlier checkpoint:** frontend pure unit suite84 passed,0failed,0skipped. Kept as prior evidence; not falsely reported as rerun now. Unit suites cover storefront/forms/API helpers, admin payloads/pagination, SEO, showroom/CRM logic, renderer/recovery/local-photo/result helpers. They do not establish real GPU/camera fitting or actual backend persistence.
- **Safe candidates without real services:** explicit API catalogue/catalogue.test.ts, cms/validation.test.ts, crm/validation.test.ts call validators/pure business helpers; provider.test.ts uses injected fake fetch; images/overlay tests use synthetic image buffers/mocks; renderer/studio tests inspect fixtures/source/geometry. Check exact import graph and temporary-file destinations before each selected run. No broad `npm test` was launched because it also discovers the database suite.
- **Mock route tests:** app.test.ts/overlay-routes.test.ts construct createApp with fake DB/storage and Supertest; they are not real API deployment tests. Supertest can bind an ephemeral listener and sends mutation requests to mocks. Under the present explicit no-API/no-session testing restriction, leave these unexecuted until a clearly approved isolated mock harness is agreed.
- **Worker tests:** worker.test.ts uses fake runtime/timers; operational worker must never be started during this audit. Scheduler simulation is different from a real tick, cleanup or provider dispatch. Current continuation did not run either.
- **REQUIRES APPROVAL:** `apps/api/src/database.integration.test.ts` and imported module integration-cases create/update/delete fixtures and authenticate. SHOWROOM_TEST_DATABASE_URL gating is not permission to run them. Overlay integration additionally requires the missing table in an isolated approved database.
- **REQUIRES APPROVAL:** web `fixture.mjs`, `admin-fixture.mjs`, `integration-smoke.mjs`, `admin-integration.mjs` use database/session/mutation flows. Do not inspect private credential manifests as evidence or execute fixtures against the active Supabase project.
- **BLOCKED runtime harness:** `admin-test-server.mjs` uses a real DB despite fake media storage; `homepage-render.mjs` starts a fixture upstream and Next process; `release-browser.mjs` starts a scenario server/browser and posts in-memory scenario results. These are not permitted GET-only inspection of an already running safe site. Minimum setup: explicitly approved disposable mock-only server, no database/provider credentials, no worker import/start, documented intercepts and non-personal fixtures.
- **Not executed this continuation:** production build/typecheck, browser/accessibility/performance tests, DB integration, live Cloudinary permissions, provider generation, mobile hardware camera and actual transparent-necklace visual fitting. Build scripts also copy WASM/generated artifacts; do not infer runtime success from historical builds. No screenshot is offered as current proof.

### Outstanding checks and handoff

Static endpoint registration/auth/input/error mapping, OWASP category mapping, component interaction/payload review, metadata/semantic scan, dependency registry analysis and deployment/privacy documentation review are now recorded above. This does not claim exhaustive proof of every code path or complete security/accessibility compliance. No new runtime evidence supersedes previous live database observations: TryOnOverlay remains last-observed absent; default privileges remain unresolved; migration not applied by this audit.

Remaining **BLOCKED**: live pages and responsive/keyboard/screen-reader checks, actual response headers/cookies/cache isolation, endpoint negative/concurrency tests, real necklace fit, provider/Cloudinary permission and failure exercises, measured performance, deployed AWS/DNS/SSL/alert/backup/restore evidence. Minimum safe runtime: isolated approved fixture environment, workers disabled by design, no production/provider credentials, synthetic media/data, and explicit per-action authorization for any writes. Existing API startup cannot be used as a harmless preview.

Remaining **read-only database work not yet completed**, carried forward rather than disguised as a pass: complete effective privileges/exposed-schema/RPC reachability, live constraint/index/schema drift and migration checksums, catalogue preservation aggregates, independently verifiable recovery evidence. No new database connection or backup was made in this continuation. Production and development labels must not be inferred from a project name alone.

Checkpoint updated only. **STOP: no remediation, migration, final audit report or production-readiness verdict.**
