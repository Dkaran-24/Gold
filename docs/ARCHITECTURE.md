# Architecture and repository inspection

## Virtual try-on extension — 5 November 2026

The application now adds an Express in-process PostgreSQL-backed photo worker, private media storage, a replaceable Gemini adapter and browser-local MediaPipe/Three.js overlays. Four additive Prisma models hold settings, calibration, jobs and usage. Existing owner authentication and catalogue authorization are reused. See [try-on architecture](VIRTUAL_TRYON_ARCHITECTURE.md) for lifecycle, topology and deployment constraints; earlier milestone sections below describe their original scope.

## Baseline

The supplied workspace was empty on 2 November 2026. There were no source files, package manifests, installed project dependencies, repository instructions, environment files, or existing features to preserve. The machine provides Node.js 22.17.1, npm 10.9.2, Git 2.50.1, and the Docker CLI. Docker's engine was not running during initial inspection. PostgreSQL was absent from PATH; a later inspection found PostgreSQL 18 under Program Files, which was used for an isolated verification cluster.

## Target structure

```text
apps/
  web/                     Next.js App Router, React, TypeScript, Tailwind
    src/app/               Storefront route group and protected /admin routes
    src/components/        Accessible shared storefront components
    src/lib/               Typed API client, formatting, guest wishlist
  api/                     Express REST service, independent deployable
    src/                   Bootstrap, configuration, auth, errors
    src/modules/           Catalogue, inventory, CRM, CMS, uploads, reporting
packages/
  database/
    prisma/schema.prisma   PostgreSQL model and constraints
    prisma/migrations/     Versioned SQL migrations
    scripts/               One-time owner provisioning
docs/                      Architecture, implementation status, operations
```

Customer route, component and library directories are implemented in Milestone 7. Owner-admin screens are implemented in Milestone 8; reporting beyond existing API capabilities remains future work. Workspaces share Prisma's generated client without duplicating the schema. Strict TypeScript is enabled. The customer interface uses the existing React Hook Form, Zod, Lucide and Tailwind dependencies with purpose-built components; no UI kit or additional framework was installed.

## Customer frontend — Milestone 7

App Router server components render all customer pages and fetch only public Express projections. `src/lib/api.ts` centralizes fetch, timeout and safe errors; browser calls use the existing same-origin `/api` rewrite, while server calls use `API_INTERNAL_URL`. `server-api.ts` memoizes reads per React render and fetches with `no-store`, preserving live inventory, publication and CMS scheduling behavior. The frontend never imports Prisma or owner credentials. Database access in the web workspace exists only in guarded test helpers.

Small client components own menu/filter toggles, image/gallery fallback, the guest wishlist, and React Hook Form/Zod submissions. Wishlist storage contains at most 100 validated slugs and revalidates them through public detail APIs; withdrawn products remain removable. Storage failures fall back to tab memory with a notice. Form receipts remain in component state, with an explicit private-copy action and POST-only status lookup. Contact data and receipt tokens are never written to URL queries or persistent browser storage. Submission requests have no automatic retries because the existing API is not idempotent.

CMS rendering supports all nine existing section types and scheduled banners returned by the published-homepage API. About can reuse published EDITORIAL content. A missing snapshot uses truthful introductory copy and live catalogue queries; it does not seed products or invent business facts. Configurable WhatsApp/timezone come only from `/api/contact-options`. A broader settings endpoint, address/social links, anonymous reference uploads and public appointment slots do not exist; their UI capabilities remain deferred instead of being simulated.

Cloudinary images use Next image optimization through a restricted HTTPS hostname; other valid HTTPS category image URLs are rendered unoptimized in the browser. Responsive CMS images use `picture`/`getImageProps`, galleries expose labelled controls, and missing/broken images have fixed-ratio fallbacks. CSS provides the ivory/gold/brown visual system, serif headings, responsive grids and reduced-motion support. See `FRONTEND_MILESTONE_7.md` for file inventory, route/API mapping and actual verification.

## Persistence

Prisma 7 uses an explicit configuration file and PostgreSQL driver adapter. The foundation follows the [official Prisma 7 upgrade guidance](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7). Dependency versions are captured in the root lockfile.

Each Product is one physical piece, with globally unique SKU and slug. Decimal types preserve weights and money. ProductPrivate stores purchase costs, private making charges, supplier and internal notes separately. Future public product APIs must use explicit allowlisted projections; they must never serialize an entire Prisma product graph.

Category deletion is restricted while products reference it. Collections use an indexed many-to-many join. ProductImage positions determine gallery order and the primary image. Soft deletion preserves product history; inventory history prevents accidental hard deletion. A later audited purge workflow must deliberately resolve retention and Cloudinary cleanup before physical deletion.

InventoryHistory records actor, previous and next availability, timestamp and reason. Product availability updates and their history must commit together in a transaction. Arrival/expiry timestamps determine newness dynamically; expiry does not delete products. Publication and inventory availability are independent states.

Enquiry captures contact details as a submission snapshot, with optional Customer linkage; duplicate submissions remain separate records. EnquiryNote and EnquiryHistory preserve CRM context. New appointment API submissions explicitly use REQUESTED (the old database PENDING default remains for compatibility), keep original/alternative/proposed/confirmed times separately, and store UTC timestamps. Availability uses an owner-configured IANA showroom timezone. CustomRequest remains preserved; new custom enquiries use the unified Enquiry CRM with managed inspiration references.

Guest wishlists remain in browser storage. Customer and Wishlist tables reserve the requested schema without enabling customer authentication or public owner registration.

WebsiteSetting stores validated, versionable content documents. HomepageSection has visibility, ordering and content. Banner has active/scheduling controls. ProductView stores daily view counts, not sales. No revenue or bestseller metrics can be inferred from enquiries; merchandising should be described as popular/most enquired unless verified sales tracking is added.

## Authentication and trust boundaries

An owner is provisioned from environment variables with bcrypt cost 12. A constant unique owner slot plus a database check limits the database to one owner. No seed credentials are committed. Setup refuses to replace an existing owner.

Sessions use random 256-bit tokens; only SHA-256 hashes are stored. Session cookies are HTTP-only, same-site Lax, scoped to /api, and Secure in production. The API validates session existence and expiry for every protected request. Login rotates a browser's old session; logout removes the server record. PasswordReset has hashed, expiring, single-use token storage; its email and consumption routes are a subsequent implementation item.

Mutating routes require an exact configured Origin, including login. The web app proxies /api to Express so browser requests remain same-origin. Production must route both through one HTTPS origin and prevent direct public access to the internal API. If multiple API replicas are used, replace process-local rate limits with shared storage before deployment.

Structured logs omit cookies, request bodies, query strings, raw database errors, and customer content. Public errors are sanitized. Environment validation fails early on invalid required configuration; readiness checks distinguish missing database/schema from process liveness.

## External services

### Milestone 2 implementation

`apps/api/src/modules/catalogue/` contains strict request schemas, shared persistence/public-projection helpers and public/admin routers. Existing owner middleware protects the entire `/admin` branch. Product mutations use row-level locks inside Prisma transactions to keep previous/next inventory history consistent under concurrent writes. Creation, updates and category mutations also write audit records atomically. Public product reads use explicit allowlists and suppress enquiry-only prices before serialization; price filters/sorts exclude hidden prices. Product deletion is soft, preserving the existing inventory foreign keys and all history. The original schema and migration remain unchanged. See `CATALOGUE_API.md` for the complete contract.

PostgreSQL is required for persistent workflows. Cloudinary is the selected media provider; upload routes must verify file signatures, size and ownership, perform server-side signing, persist public IDs, and implement safe cleanup. No arbitrary client-supplied Cloudinary ID may be deleted. SMTP is required for password recovery. Unconfigured integrations must fail clearly rather than simulate success.

## Delivery phases and gates

### Milestone 5 implementation

`modules/crm` contains strict submission/administration schemas, safe receipt projections, status transitions, timezone/slot checks, transactional appointment actions and public/owner routes. Existing enquiry and appointment records are extended, not replaced. AppointmentHistory and AppointmentNote preserve actor/time context; EnquiryHistory gains an actor FK. ShowroomAvailability holds explicit weekly rules, closures and capacity. EnquiryImage references existing managed media.

Public receipts combine random UUID references with separate 256-bit tokens; only token hashes persist. Customer status projections omit contact details and internal CRM information. Public submission/status rate limits supplement the existing global limiter. CRM changes, booking approval/rescheduling and availability updates share a transaction advisory lock; confirmed intervals persist their duration/buffer and capacity is checked before committing state/history/audit together. Missing configuration blocks approvals while allowing pending requests. No external communication or automatic retention task is introduced. API/operational details are in ENQUIRIES_API.md, APPOINTMENTS_API.md and CRM_WORKFLOW.md.

### Milestone 4 implementation

`modules/cms` owns collection management, typed section/banner validation, scheduling, reference resolution and homepage publishing. Collection, CollectionProduct, Banner and HomepageSection are extended in place with explicit managed-image FKs and publication metadata. HomepageVersion stores immutable draft snapshots; its newest committed row is the current homepage, so no partial pointer update can leak a draft. Snapshot creation and publishing audit commit together. CMS mutation advisory locks serialize edits/publishes; repeatable-read public transactions resolve current eligible catalogue/media references using the existing safe product projection. Section and membership ordering constraints are deferred to transaction commit. Images referenced by draft records are protected against deletion; historical snapshot references are resolved safely at read time. Full behavior and limitations are in `COLLECTIONS_API.md` and `HOMEPAGE_CMS_API.md`.

### Milestone 3 implementation

`modules/images` separates decoding/limits, Cloudinary signed REST transport, transactional gallery operations, routes and a bounded cleanup CLI. ProductImage is extended rather than duplicated. Position uniqueness is deferred until commit for atomic permutations; primary remains derived from ordering. ImageCleanup journals pre-upload intentions and post-detachment deletions. Product locks enforce concurrent capacity and reorder consistency. The remote call occurs before the short attachment transaction; compensating cleanup is durable and retried independently. See `IMAGE_MANAGEMENT_API.md` for operating requirements and limits of cross-service consistency.

The original implementation sequence below is historical; see the milestone sections for current completion and deferred settings/recovery/reporting work.

1. Inspect repository; establish workspaces, schema, initial SQL migration, secure owner provisioning, environment template and operations guide.
2. Implement and test authentication/recovery, public catalogue projections, product/category/collection CRUD, inventory transactions, Cloudinary handling, CMS, customer submissions, CRM and reports. Verify against PostgreSQL before proceeding to customer workflows.
3. Build the premium responsive customer experience using real API data, including search/filter/pagination, gallery, wishlist, enquiries, custom requests and appointments.
4. Build the owner dashboard and complete editorial, product, inventory, CRM and reporting workflows.
5. Test cross-application publishing, uploads, new-arrival expiry, inventory transitions and submissions.
6. Validate security, responsive layout, accessibility, error states, query behavior and performance with realistic data.
7. Configure and verify real hosting, HTTPS, email, Cloudinary, backups/restoration, migrations and owner access before declaring production readiness.

## Owner dashboard — Milestone 8

The root document is shared. `(storefront)/layout.tsx` retains the existing customer shell; `admin/(owner)/layout.tsx` supplies the independent owner shell. An allowlisted catch-all page maps supported admin URLs to management modules and checks the database-backed session on every server navigation. A React render cache deduplicates that check within the request, without cross-request caching. `src/lib/admin/session.ts` is server-only; the client API module uses only the existing same-origin proxy and owner endpoints.

The HttpOnly session cookie now has Path=/ so Next.js can validate `/admin` requests against `/api/auth/me`. Login/logout expire the former Path=/api cookie. Tokens, database hashes, expiry, owner authorization, exact-origin mutation checks and production Secure/SameSite settings are unchanged. Neither authentication nor database access is reimplemented in the frontend.

Shared field definitions serialize native forms through Zod into existing strict API payloads. Managed image selection uses existing product image IDs; binary upload/replace stays in the existing image service. In-page confirmation dialogs protect destructive operations. Owner API state is held in memory, fetched with no-store and discarded on expiry; no owner data enters guest storage or public server-fetch modules.

Priority filtering and scheduled-date/overview calculations exhaust all matching pages because dedicated aggregate/filter endpoints do not exist. This is accurate for the fetched result but can be expensive at scale; the unchanged API rate limits remain a documented operational constraint. CMS preview uses the private backend resolver, and publishing remains its atomic snapshot operation. No new API, Prisma model, migration, dependency or service was introduced.
