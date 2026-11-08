# Virtual try-on delivery report

**5 November 2026 — implementation completed within the available local environment; not production-ready.**

| Area | Status |
| --- | --- |
| Photo workflow | IMPLEMENTED / AUTOMATED-TESTED: strict consented upload, private async jobs, polling, ownership, idempotency, retries, signed results, deletion and retention. |
| Gemini adapter | IMPLEMENTED / AUTOMATED-TESTED with mock transport. Real entitlement, generation quality, latency and cost are BLOCKED pending credentials, genuine references and consented portraits. |
| Camera AR | IMPLEMENTED for MediaPipe/Three.js 2D earrings and necklaces; placement and camera lifecycle AUTOMATED-TESTED. Physical accuracy/performance MANUAL-TEST-PENDING. |
| Customer experience | IMPLEMENTED: product entry, eligible piece selector, separate photo/live controls, consent, comparison, download/share, enquiry link and approximation disclaimer. |
| Owner controls | IMPLEMENTED: mode/category eligibility, product cutout selection/calibration, upload/retention/daily limits and aggregate attempt metrics. Existing owner authentication reused. |
| Verification | 77 API + 44 frontend tests passed; TypeScript, Prisma validation, both builds and isolated migrations passed; npm audit: 0 vulnerabilities. Browser state/geometry checks passed; screenshot capture unavailable. |
| Excluded features | NOT IMPLEMENTED: rings/bangles, GLB/3D fitting, cross-device preview recovery, distributed media storage, deployment/billing, exact size/weight prediction. |

## Created files

- `apps/api/src/modules/tryon/`: `provider.ts`, `provider.test.ts`, `settings.ts`, `storage.ts`, `runtime.ts`, `routes.ts`, `integration-cases.ts`.
- `packages/database/prisma/migrations/20261104000100_tryon/migration.sql`.
- `apps/web/src/lib/try-on/`: `types.ts`, `client.ts`, `camera.ts`, `tracking.ts`, `renderer.ts`.
- `apps/web/src/components/try-on/`: `entry.tsx`, `studio.tsx`, `photo-try-on.tsx`, `live-camera.tsx`.
- `apps/web/src/app/(storefront)/try-on/[slug]/`: `page.tsx`, `try-on.css`.
- `apps/web/src/components/admin/try-on.tsx`, `apps/web/tests/try-on.test.mts`, `apps/web/scripts/prepare-tryon-assets.mjs`.
- `apps/web/public/try-on/models/`: face and lite-pose model assets plus provenance README. WASM files are copied from the pinned dependency during predev/prebuild and ignored as generated output.
- `docs/VIRTUAL_TRYON_IMPLEMENTATION.md`, `docs/VIRTUAL_TRYON_ENVIRONMENT.md`, `docs/VIRTUAL_TRYON_TESTING.md`.

## Modified files

- API application/router and lifecycle: `apps/api/src/app.ts`, `server.ts`, `database.integration.test.ts`.
- `packages/database/prisma/schema.prisma`: four new models, category join and additive relationships/enums; existing authentication data unchanged.
- Storefront product detail page; admin owner catch-all page, `components/admin/shell.tsx` and `app/admin/admin.css` for entry/navigation/layout.
- `apps/web/package.json`, root `package-lock.json`, `.gitignore`, `.env.example`.
- README; implementation status, architecture and verification documents; the try-on architecture, API, security and milestone report documents. The historical provider evaluation is annotated with current status and remains the real-image acceptance procedure.

There is no Git metadata in this workspace, so this inventory records implementation ownership rather than a Git diff. No architecture replacement, application reinstall, deployment or paid call was performed.

## Database and APIs

The additive migration creates TryOnConfiguration, ProductTryOnAsset, TryOnJob and TryOnUsage, plus category eligibility relationships and constraints. It was verified on isolated databases only. All twelve API operations and their validation/authentication contracts are listed in [API documentation](VIRTUAL_TRYON_API.md). Existing catalogue/authentication APIs remain in use.

## Setup, limitations and next milestone

Follow [environment and local commands](VIRTUAL_TRYON_ENVIRONMENT.md), [implementation](VIRTUAL_TRYON_IMPLEMENTATION.md), [architecture](VIRTUAL_TRYON_ARCHITECTURE.md), [security](VIRTUAL_TRYON_SECURITY.md) and [tests/manual checklist](VIRTUAL_TRYON_TESTING.md). Missing external setup includes Gemini access, real Cloudinary references/cutouts and an operational private storage volume. These were deliberately not fabricated or enabled.

**Exact next milestone: real-provider and physical-device try-on acceptance.** Configure approved services and genuine assets; run the consented photo fidelity matrix and Android/iOS/desktop AR calibration, privacy, expiry and performance checks. Keep features disabled until acceptance. Milestone 6 settings/account recovery also remains separate outstanding project work.

