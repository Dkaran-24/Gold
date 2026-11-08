# Virtual try-on security and privacy

**IMPLEMENTED; operational verification remains MANUAL-TEST-PENDING.**

- Reuses database-backed owner authorization and exact-origin mutation checks. Strict Zod schemas reject unknown payload fields. Public projections omit private catalogue fields.
- Anonymous ownership uses a 256-bit random HttpOnly, SameSite=Strict cookie scoped to /api/try-on, Secure in production. Its hash is stored with jobs. Reading configuration refreshes its 72-hour lifetime without changing ownership. Clearing cookies loses access; private files still expire.
- Photo consent is explicit and versioned. The API records consent version/time. JPEG, PNG and WebP are decoded, bounded and re-encoded; MIME mismatches, corrupt, animated and excessive-pixel inputs are rejected by the shared image validator. Original browser previews use temporary blob URLs.
- Input/output files use UUID names in a dedicated private directory, outside public/static output. File access goes through authenticated result routes. Local POSIX modes are 0700/0600; Windows deployments require an appropriate directory ACL. Do not back up or synchronize this directory with ordinary business content.
- Result access requires ownership, unexpired job, completion, current product eligibility and a short-lived HMAC signature. Responses are private/no-store and results use no-referrer. Deleting revokes access before physical cleanup; retention is enforced even before the sweep runs.
- Provider requests use a server-only key header, bounded responses, timeouts and no redirects. Catalogue reference URLs must match the configured Cloudinary account and managed product path. Prompt and model versions are recorded. Provider errors and image bytes are not logged. No key reaches the browser.
- Global attempt reservations are serialized in PostgreSQL. Idempotency avoids duplicate paid submissions after uncertain HTTP outcomes. A crash with unknown provider outcome is not automatically retried. Attempt limits are not monetary spending caps.
- Live camera frames/landmarks remain on-device. Camera permission follows an explicit Start action; tracks stop on cancellation, hiding the page and unmount. Models/WASM are served locally. No face-identification or biometric persistence is implemented.
- Owners receive usage totals and product configuration, never customer photos through the owner dashboard. Usage attempt IDs persist after job deletion for counts/quota; guest hashes, product snapshots, consent and media are removed with expired jobs.

## Before using real portraits

Verify provider terms, retention/data-use policy, project entitlement, billing limits and consent wording. Showroom deletion cannot guarantee removal of copies retained by an external provider, browser download or recipient of an explicit share. Google processing is disclosed before submission. No real portrait or paid generation was used in verification.

Run the worker on a monitored long-lived host with a private persistent volume, restrict disk access, exclude temporary photos from backups, and test cleanup after restart and storage failures. Multiple replicas need shared media storage and a shared rate-limit service for fleet-wide IP quotas. Cross-device guest access and account recovery for preview cookies are NOT IMPLEMENTED.
