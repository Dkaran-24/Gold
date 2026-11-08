# Virtual try-on verification

**5 November 2026.** No paid provider call, real customer portrait or fabricated showroom preview was used.

| Check | Status and result |
| --- | --- |
| Prisma validate | AUTOMATED-TESTED: valid schema. |
| Migrations | AUTOMATED-TESTED: additive upgrade and fresh five-migration QA database; latest deploy check reports no pending migrations. Only isolated loopback test databases were used. |
| TypeScript | AUTOMATED-TESTED: both workspaces passed. |
| API suite | AUTOMATED-TESTED: 77 tests passed in six files, including seven mocked Gemini adapter tests and eleven try-on database cases. |
| Frontend suite | AUTOMATED-TESTED: 44 passed, including eleven camera/placement tests. |
| Production builds | AUTOMATED-TESTED: Prisma generation, Express TypeScript build and Next.js webpack production build passed. API rebuilt after the UTC worker correction. |
| Dependency audit | AUTOMATED-TESTED: npm audit reported zero vulnerabilities. |
| Browser smoke | Checked customer and owner pages at 1440×1000 and 390×844. Document widths were 1425 and 375 respectively, with no horizontal overflow. Missing-provider messaging disabled upload/generation; unsupported-camera state disabled start. Owner product calibration loaded; settings save persisted after reload; logout returned to login. |
| Screenshots | BLOCKED: browser screenshot capture returned unavailable. DOM/accessibility and geometry checks were performed; visual screenshot review is not claimed. |
| Genuine AI quality/latency/cost | BLOCKED: no Gemini credentials, genuine selected product references or consented portraits were supplied. Zero real generation calls. |
| Physical-device AR | MANUAL-TEST-PENDING: real tracking, alignment, camera switching, lighting, device performance and occlusion. The available browser exposed the unsupported-camera fallback. |

The integration suite covers current consent, decode/type/size validation, missing configuration, management authorization/origin checks, eligibility/calibration, guest renewal, ownership, idempotent admission, QUEUED→PROCESSING→COMPLETED, private signed results, failures/retry limits, expiry/cleanup, withdrawal, deletion during generation and global daily quota. It found a mismatch between the SQL clock and bound application timestamps in this Windows/PostgreSQL environment. Worker claims now use the same application timestamp as admission and access checks. Provider tests use injected transport; they do not contact Google. Frontend tests exercise unsupported/denied camera, start/stop/late permission, facing mode, face/shoulder placement, calibration, mirroring and smoothing using mocks.

## Reproduce automated verification

Use a dedicated clean test database in the existing isolated showroom_test cluster at 127.0.0.1:55432. The integration harness refuses other hosts/users/ports and a database with an existing owner. Never point it at a business database. Deploy migrations to that empty test database first.

```powershell
$env:SHOWROOM_TEST_DATABASE_URL='postgresql://showroom_test@127.0.0.1:55432/postgres'
npm run db:validate
npm run typecheck
npm test
npm run build
npm audit --audit-level=low
```

Without SHOWROOM_TEST_DATABASE_URL the database cases are skipped; that is not full verification. Loopback/network and generated-file permissions were necessary in the restricted execution environment. Initial EACCES/EPERM attempts were rerun successfully with the appropriate execution permissions. The final test log is in ignored `.local/tryon-tests.log`.

## Manual acceptance before real use

1. Configure an approved Gemini project, permitted image model, Cloudinary account and private persistent storage. Confirm provider data handling, spending controls and entitlement. Enable only reviewed categories/SKUs.
2. Upload genuine primary references and transparent cutouts for earrings and necklaces. Verify the overlay is genuinely transparent and belongs to the physical item; calibrate scale, offsets and rotation. Format validation does not prove transparency or fidelity.
3. With permission to process each portrait, run the matrix in the provider evaluation document. Measure identity/background preservation, stone count, settings, silhouette, scale, latency, failures and cost. Do not claim exact fidelity.
4. Verify consent-before-upload, failure recovery, retry limit, polling through reload, before/after display, download/share, deletion, foreign-cookie denial, expired links and retention after a process restart. Verify private files disappear from disk and are excluded from backups.
5. On physical Android Chrome, iOS Safari and desktop browsers, test permission denial/recovery, front/back switching, stop, navigation, backgrounding, dim light, missing face, turning head, cropped shoulders and thermal slowdown. Inspect network activity to confirm live frames/landmarks are not uploaded.
6. Repeat keyboard, screen-reader and visual layout review at desktop/mobile widths with genuine images. Exercise catalogue enquiries and existing owner workflows after enabling the feature. Leave modes disabled until acceptance passes.

The isolated browser database `tryon_browser_qa_04` contains clearly labelled synthetic QA records only, with no usable jewellery photograph. Both modes were disabled again after verification. Existing business data and operational environment files were not changed.

