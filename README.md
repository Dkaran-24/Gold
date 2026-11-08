# Jewellery showroom platform

Owners preparing catalogue records can start with the [offline catalogue intake guide and blank templates](docs/catalogue-intake/README.md). Run the preflight against a private working copy before handing the batch to the catalogue reviewer.

The virtual fitting room and its owner workspace now use the redesigned editorial showroom UI, with consent-aware drag/drop, catalogue browsing and responsive camera controls. See the [UI redesign report and screenshots](docs/VIRTUAL_TRYON_REDESIGN.md).

Virtual jewellery try-on is implemented with private async photo jobs, a Gemini adapter tested with mocks, local camera overlays and owner controls. Real AI fidelity and physical-device AR acceptance remain pending. Both modes default to disabled. See the [delivery report](docs/VIRTUAL_TRYON_MILESTONE_REPORT.md), [setup](docs/VIRTUAL_TRYON_ENVIRONMENT.md) and [verification](docs/VIRTUAL_TRYON_TESTING.md).

Single-showroom Indian jewellery catalogue with a customer-facing Next.js website. Milestones 1–5 provide authentication, catalogue, product images, collections/CMS, enquiries, CRM and appointments; Milestone 7 connects the customer experience to those APIs. Milestone 8 adds the protected owner dashboard at `/admin`. Website settings/account recovery (Milestone 6) remain outstanding. See [owner dashboard delivery and verification](docs/ADMIN_DASHBOARD_MILESTONE_8.md). No checkout/payment gateway is included. See [frontend delivery and verification](docs/FRONTEND_MILESTONE_7.md), [implementation status](docs/IMPLEMENTATION_STATUS.md), [architecture](docs/ARCHITECTURE.md), and the [product/category API contract](docs/CATALOGUE_API.md).

## Prerequisites

- Node.js 22.16 or later (Node 22 LTS recommended) and npm.
- PostgreSQL 17, locally or managed. Docker Desktop can run the supplied local service.
- Cloudinary account and SMTP delivery credentials for later integration phases.

## Local setup (PowerShell)

Run from `C:\Users\ASUS\Desktop\shreeRam`:

```powershell
Copy-Item .env.example .env
```

Edit `.env`: set a unique `POSTGRES_PASSWORD`, update the matching password in `DATABASE_URL` (URL-encode special characters), and set the owner email and a unique password of at least 14 characters, no more than 72 UTF-8 bytes. Do not use `CHANGE_ME`. Keep production and local databases separate.

Start Docker Desktop, then:

```powershell
docker compose up -d database
npm install
npm run db:generate
npm run db:deploy
npm run db:owner
```

Remove `OWNER_PASSWORD` from `.env` after provisioning. Provisioning never resets or replaces an existing owner. Then run:

```powershell
npm run dev
```

Web: `http://localhost:3000`. API: `http://localhost:4000` (bound to loopback). `/api/health/live` checks process liveness. `/api/health/ready` checks both connectivity and an application table. The frontend proxies `/api/*` to the backend so the session cookie uses one browser origin.

The root environment file is loaded by both applications and migration/setup commands. Hosting can inject variables directly instead. `db:generate` and `db:validate` require a syntactically valid `DATABASE_URL` environment variable but do not connect to the database.

## Verification

```powershell
$env:DATABASE_URL = 'postgresql://validation:validation@localhost:5432/validation'
npm run db:validate
npm run db:generate
npm run typecheck
npm test
npm run build
```

The validation URL above is not a real account and is only for schema/client generation. Never use it as a configured operational database. Test results and limitations are recorded in `docs/VERIFICATION.md`.

PostgreSQL integration tests are opt-in with `SHOWROOM_TEST_DATABASE_URL`. They refuse connections other than the isolated `showroom_test` role on `127.0.0.1:55432`, require an already migrated database without an owner, and remove only their own fixture records. Without this variable, database integration tests are explicitly skipped.

The frontend uses Next.js's supported Webpack mode because the installed Windows Turbopack build failed to start its CSS worker, including outside the sandbox.

To edit the schema during development, use `npm run db:migrate`. Review generated SQL before applying it. Production deployment uses `npm run db:deploy`, never `migrate dev` or `db push`.

## API foundation

| Method | Endpoint | Access |
| --- | --- | --- |
| GET | `/api/health/live` | Public |
| GET | `/api/health/ready` | Public; no connection details disclosed |
| POST | `/api/auth/login` | Exact configured Origin, login rate limit |
| GET | `/api/auth/me` | Owner session |
| POST | `/api/auth/logout` | Owner session and exact Origin |
| GET | `/api/admin/setup-status` | Owner session |

Responses use `{ data: ... }` or `{ error: { code, message } }`; validation errors include field information. Login accepts `{ email, password }`. There is no public registration route. These are foundation endpoints, not the full requested API surface.

## Product/category backend verification

No new dependency installation or migration is needed for Milestone 2. Use the existing test cluster and run:

```powershell
$env:SHOWROOM_TEST_DATABASE_URL = 'postgresql://showroom_test@127.0.0.1:55432/postgres?schema=public'
npm test
npm run typecheck
npm run build
```

The cluster must be running and migrated, and `DATABASE_URL` must be configured for client generation during build. Integration tests provision a temporary owner and clean up their own records. Do not point them at an operational database. All 23 tests (including 12 PostgreSQL tests) passed for this milestone. API paths, fields, filtering, delete confirmation and examples are documented in [CATALOGUE_API.md](docs/CATALOGUE_API.md). Next milestone: Cloudinary image-management backend.

## Product image backend (Milestone 3)

Apply the additive migration with `npm run db:deploy` and regenerate the client with `npm run db:generate`. Configure the three server-only Cloudinary variables in `.env.example`; no real credentials are included. Default limits are 5 MiB/file and 10 images/product. Uploads accept raw JPEG, PNG and WebP bodies through owner-protected endpoints.

See [IMAGE_MANAGEMENT_API.md](docs/IMAGE_MANAGEMENT_API.md) for endpoints, validation, ordering, replacement and consistency limitations. Schedule `npm run images:cleanup -w @showroom/api` to retry durable cleanup tasks. Automated integration tests mock Cloudinary and do not establish real account connectivity. No frontend changes or deployment are included.

## Collections and homepage CMS (Milestone 4)

No new dependencies are needed. Apply `20261102000300_cms` with `npm run db:deploy` and run `npm run db:generate`. Existing products, images, authentication and inventory records are preserved. See [collections endpoints](docs/COLLECTIONS_API.md) and [homepage workflow](docs/HOMEPAGE_CMS_API.md).

Homepage sections/banners are drafts until the owner publishes atomically. Public APIs filter UTC schedules and live catalogue visibility. Managed image IDs reuse the existing upload system; no arbitrary image URLs are accepted. Unit and real-PostgreSQL tests cover draft isolation and failed-publish rollback. No frontend, deployment, or real Cloudinary account operations were started.

## Enquiries, CRM and appointments (Milestone 5)

Apply additive migration `20261102000400_crm` with `npm run db:deploy`, then run `npm run db:generate`. No new dependency or environment secret is required. All prior data and enum values are preserved. New submissions receive a reference plus private receipt token; lookup requires both. Configure availability through the owner API before approving visits—no opening hours or WhatsApp number is seeded.

See [enquiry endpoints](docs/ENQUIRIES_API.md), [appointment and capacity rules](docs/APPOINTMENTS_API.md), and [CRM/privacy workflow](docs/CRM_WORKFLOW.md). Run the existing full test command with the isolated SHOWROOM_TEST_DATABASE_URL, plus schema validation, TypeScript, builds and audit as before. Custom enquiries reference existing managed images; anonymous image uploads and external messaging are not added.

## Customer website (Milestone 7)

The existing `npm run dev` command serves the customer website at `http://localhost:3000`. Use this exact hostname when `WEB_ORIGIN=http://localhost:3000`; an alternate hostname will not pass the API's existing mutation-origin check. `API_INTERNAL_URL` remains server-only. No new dependency, schema change or migration is needed for the frontend.

Routes: `/`, `/products`, `/products/[slug]`, `/collections`, `/collections/[slug]`, `/wishlist`, `/about`, `/contact`, `/custom-jewellery`, `/appointments`, and `/request-status`. The site uses published API content, validates forms with React Hook Form/Zod, and stores guest wishlist slugs in the browser. Collection selection opens its curated product list; catalogue search/sorting are not applied to unsupported collection endpoints.

Until genuine catalogue images and CMS content are published, the site shows empty states and a decorative brand graphic. WhatsApp appears only when configured through the existing availability API. No address, directions, social links, opening hours, reviews or business history are invented. The absent broader settings API and anonymous reference-image uploads are documented in [FRONTEND_MILESTONE_7.md](docs/FRONTEND_MILESTONE_7.md).

Appointment submissions are requests, not confirmed bookings. Customer receipts include a private token shown once, which the customer may copy to check status for up to 90 days. The frontend does not persist contact details or receipt tokens in browser storage and does not automatically retry submissions.

Run `npm run test -w @showroom/web` for 14 frontend unit tests using Node's built-in test runner; `npm test` runs these alongside the API suite. No test framework was added. Browser fixture and integration-smoke instructions are in the milestone report; those helpers explicitly refuse operational database URLs.

## Deployment prerequisites

Do not deploy this milestone as a finished showroom. Complete and test the remaining modules first.

- Provision managed PostgreSQL; require encrypted connections, least-privilege runtime access, managed backups and a tested restore procedure.
- Set `NODE_ENV=production`, an HTTPS `WEB_ORIGIN`, and the server-only `API_INTERNAL_URL`. Keep the backend private behind a trusted same-origin reverse proxy. `TRUST_PROXY=true` assumes exactly one trusted proxy; adapt to the actual topology rather than trusting arbitrary forwarded headers.
- Supply Cloudinary and SMTP secrets to the backend only. No secret may use a `NEXT_PUBLIC_` prefix.
- Run `npm ci`, generate the client, apply reviewed migrations, run tests and build. Provision the owner once from temporary environment secrets.
- Launch the API and Next.js as supervised services. The API binds to loopback; container hosting needs an explicitly reviewed bind-address change and private networking.
- Verify login/logout/recovery, cookies, upload limits, deletion cleanup, enquiries, appointments, CMS publishing, backups and restore using the real deployment.
- Configure shared rate-limit storage before adding multiple API replicas.
- Set up monitoring for readiness, error rate, storage quotas, database capacity and backup failures.

No domain, remote service, credentials, production records or public deployment has been created.
