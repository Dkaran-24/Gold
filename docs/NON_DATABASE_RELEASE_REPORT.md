# Shree Ram Jewellers release verification

6 November 2026. The approved application changes passed local verification. Production acceptance depends on the database operator, verified business content, provider checks and launch review.

## Changes customers and owners will see

- **Owner saves.** An unreadable 2xx response now produces an uncertain-outcome message. The owner is asked to refresh the record before retrying. Valid empty reads, collection details with paginated members, and 204 responses remain supported.
- **Photo try-on.** If a previously saved preview cannot be checked, the studio keeps its identifier, offers a status retry and blocks a second upload. A confirmed missing or expired job releases the form. The preview accepts signed, same-origin result URLs on the expected route. A malformed link can be refreshed without starting another generation.
- **CMS images and owner privacy.** The picker uses public catalogue visibility to find products with images, then uses the owner API to select a managed image. A failed read offers retry. Owner and authentication responses carry `Cache-Control: private, no-store` on success and error paths.
- **Catalogue and contact.** A collection-filter outage preserves the product results and offers a retry with the current filters. The contact page can display owner-approved phone, email and social links. Those fields are empty pending verification. The confirmed address and existing WhatsApp source continue to serve their original purposes.
- **Search discovery.** Public pages use the supplied HTTPS domain. Pagination has distinct canonicals and filtered catalogue searches carry `noindex`. The sitemap reads published product and collection slugs, and returns a retryable 503 if its source is unavailable or inconsistent. The homepage change is a metadata export. Its layout, typography, colours and sections were preserved.
- **Policy review.** Privacy and Terms drafts reside under `docs/review/`. Publication requires owner approval. The launch checklist assigns acceptance evidence to the owner, engineering, hosting, provider and database operators.

## Verification results

| Check | Actual result |
|---|---|
| P1 ordering | The initial admin suite passed 24 tests and the try-on suites passed 16 before P2 work began. A later compatibility test covered paginated collection details. The final admin suite includes 27 tests. |
| Frontend suite | 66 passed, 0 failed, 0 skipped. |
| Non-database API suite | 33 passed across five files covering middleware, images, CMS validation, CRM validation and the mocked try-on provider. |
| TypeScript | Both workspaces passed `npm run typecheck`. |
| API production build | `npm run build -w @showroom/api` exited 0. |
| Next.js production build | Webpack build exited 0 in a source-only working copy. The route output includes static `/robots.txt` and dynamic `/sitemap.xml`. |
| Production HTTP checks | Eight groups passed using a loopback fixture. They covered error/empty/populated/CMS states, 11 navigation destinations, product actions, SEO responses, and filter retry. |
| Chromium interactions | Passed at 1440, 768 and 390 pixels. Existing results stayed visible through a collection outage. Retry preserved search, category, metal, sort and featured selections. Checks found no horizontal overflow on the exercised screens. |
| Preview recovery in Chromium | An uncertain job retained its saved ID and blocked upload. A malformed result was refreshed to a displayable image. A definitive 404 cleared the saved job and released the form. The fixture observed zero generation or generation-retry requests. |

The production frontend was built from a copy containing the web sources, assets, scripts and required compiler configuration. This keeps the repository's operational environment file out of the build and test working directory. A content comparison verified all 92 compared frontend inputs matched the workspace. The first build attempt encountered a sandbox write restriction on generated types. The completed build was also served for the HTTP and browser checks.

For the API suite, an initial npm wrapper invocation selected the guarded integration file and reported all 46 database cases skipped. The corrected command passed the five non-database files directly to Vitest. Supertest used loopback networking with mocked database methods. The storefront tests used isolated HTTP responses. No database session, provider operation or deployment was needed.

## Acceptance work remaining

- **Database and real journeys.** The 46 PostgreSQL integration cases and database-backed storefront and admin smoke scripts were excluded. After the separate restoration, the database operator and QA need to verify genuine catalogue loading, owner actions, receipt lookup and appointment persistence in approved staging.
- **Providers and devices.** Cloudinary account operations, Gemini access, image fidelity, billing, private storage cleanup under production conditions, and physical iOS/Android camera behaviour await acceptance.
- **Production environment.** Verify the live domain, HTTPS, trusted proxy topology, shared rate-limit behaviour under realistic traffic, monitoring and the database operator's backup/restore evidence. Full-catalogue reads in the fitting-room rail and full-record admin summaries remain scaling concerns. The single sitemap currently supports up to 50,000 total URLs and returns a retryable failure beyond that limit.
- **Owner inputs.** Confirm phone, email, social URLs, WhatsApp destination, opening hours, map URL and genuine catalogue/campaign imagery before publishing them. Review the operator identity, contact, retention, provider and business-term questions in both drafts.
- **Separately scoped features.** General owner-editable website settings, account recovery and automated notification delivery still require implementation and acceptance. No email service was configured during this batch.

## File inventory

Maintained source, tests and documentation follow. Compiler output and isolated test-build artifacts are excluded.

### API code and regressions

- [apps/api/src/app.ts](<../apps/api/src/app.ts>)
- [apps/api/src/modules/cms/routes.ts](<../apps/api/src/modules/cms/routes.ts>)
- [apps/api/src/modules/crm/routes.ts](<../apps/api/src/modules/crm/routes.ts>)
- [apps/api/src/app.test.ts](<../apps/api/src/app.test.ts>)

### Admin and try-on

- [apps/web/src/lib/admin/api.ts](<../apps/web/src/lib/admin/api.ts>)
- [apps/web/src/components/admin/form.tsx](<../apps/web/src/components/admin/form.tsx>)
- [apps/web/src/components/try-on/photo-try-on.tsx](<../apps/web/src/components/try-on/photo-try-on.tsx>)
- [apps/web/src/lib/try-on/recovery.ts](<../apps/web/src/lib/try-on/recovery.ts>) (new)
- [apps/web/src/lib/try-on/client.ts](<../apps/web/src/lib/try-on/client.ts>)

### Storefront and search discovery

- [apps/web/src/lib/showroom-details.ts](<../apps/web/src/lib/showroom-details.ts>)
- [apps/web/src/lib/seo.ts](<../apps/web/src/lib/seo.ts>) (new)
- [apps/web/src/app/layout.tsx](<../apps/web/src/app/layout.tsx>)
- [apps/web/src/app/robots.ts](<../apps/web/src/app/robots.ts>) (new)
- [apps/web/src/app/sitemap.xml/route.ts](<../apps/web/src/app/sitemap.xml/route.ts>) (new)
- [apps/web/src/app/(storefront)/page.tsx](<../apps/web/src/app/(storefront)/page.tsx>)
- [apps/web/src/app/(storefront)/about/page.tsx](<../apps/web/src/app/(storefront)/about/page.tsx>)
- [apps/web/src/app/(storefront)/appointments/page.tsx](<../apps/web/src/app/(storefront)/appointments/page.tsx>)
- [apps/web/src/app/(storefront)/contact/page.tsx](<../apps/web/src/app/(storefront)/contact/page.tsx>)
- [apps/web/src/app/(storefront)/custom-jewellery/page.tsx](<../apps/web/src/app/(storefront)/custom-jewellery/page.tsx>)
- [apps/web/src/app/(storefront)/products/page.tsx](<../apps/web/src/app/(storefront)/products/page.tsx>)
- [apps/web/src/app/(storefront)/products/[slug]/page.tsx](<../apps/web/src/app/(storefront)/products/[slug]/page.tsx>)
- [apps/web/src/app/(storefront)/collections/page.tsx](<../apps/web/src/app/(storefront)/collections/page.tsx>)
- [apps/web/src/app/(storefront)/collections/[slug]/page.tsx](<../apps/web/src/app/(storefront)/collections/[slug]/page.tsx>)

### Web verification

- [apps/web/tests/admin.test.mts](<../apps/web/tests/admin.test.mts>)
- [apps/web/tests/try-on-recovery.test.mts](<../apps/web/tests/try-on-recovery.test.mts>) (new)
- [apps/web/tests/try-on-result.test.mts](<../apps/web/tests/try-on-result.test.mts>) (new)
- [apps/web/tests/showroom.test.mts](<../apps/web/tests/showroom.test.mts>)
- [apps/web/tests/seo.test.mts](<../apps/web/tests/seo.test.mts>) (new)
- [apps/web/tests/homepage-render.mjs](<../apps/web/tests/homepage-render.mjs>)
- [apps/web/tests/release-browser.mjs](<../apps/web/tests/release-browser.mjs>) (new)

### Review documents

- [docs/review/PRIVACY_POLICY_DRAFT.md](<../docs/review/PRIVACY_POLICY_DRAFT.md>) (new)
- [docs/review/TERMS_DRAFT.md](<../docs/review/TERMS_DRAFT.md>) (new)
- [docs/PRODUCTION_LAUNCH_CHECKLIST.md](<../docs/PRODUCTION_LAUNCH_CHECKLIST.md>) (new)
- [docs/NON_DATABASE_RELEASE_REPORT.md](<../docs/NON_DATABASE_RELEASE_REPORT.md>) (new)

