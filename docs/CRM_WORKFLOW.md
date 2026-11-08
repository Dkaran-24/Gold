# CRM workflow, security and operations

## Enquiry lifecycle

The owner changes statuses with PATCH; invalid transitions return 409 without altering history.

| Current | Allowed next |
| --- | --- |
| NEW | CONTACTED, IN_PROGRESS, CLOSED, SPAM |
| CONTACTED | IN_PROGRESS, WAITING_FOR_CUSTOMER, CONVERTED, CLOSED, SPAM |
| IN_PROGRESS | CONTACTED, WAITING_FOR_CUSTOMER, CONVERTED, CLOSED, SPAM |
| WAITING_FOR_CUSTOMER | CONTACTED, IN_PROGRESS, CONVERTED, CLOSED, SPAM |
| CONVERTED or CLOSED | IN_PROGRESS (explicit reopen) |
| SPAM | NEW |

Legacy INTERESTED can move to IN_PROGRESS/CONVERTED/CLOSED; FOLLOW_UP to IN_PROGRESS/WAITING_FOR_CUSTOMER/CLOSED; NOT_INTERESTED to IN_PROGRESS. Legacy enum values and history remain intact. Converted is a CRM label, not verified revenue or a payment record. Priorities are LOW/NORMAL/HIGH/URGENT. Repeating the current status is idempotent and creates no extra history.

Initial submission creates an initial history row (actor null, representing customer submission). Owner transitions record actor IDs and previous/new status. Priority changes are recorded in audit metadata. Notes are append-only, authored and timestamped. Creation, status/priority changes, notes, appointment actions and availability updates are audited. Audits never copy full messages, notes, phone numbers, emails or receipt tokens.

## Security boundaries

- Existing owner sessions, origin checks, input limits, rate limits and safe errors are reused. No public registration or replacement auth system exists.
- Inputs use strict Zod schemas; customer requests cannot assign CRM state, priority, owner, references, token hashes or source.
- Public references are random UUIDs. Lookup additionally requires a separately generated 256-bit token whose SHA-256 hash is stored. Raw tokens are returned only on successful creation, never logged or returned by owner endpoints. Submit both fields in a POST body. Lookup expires 90 days after submission.
- Wrong token/reference combinations and missing/expired records return the same generic 404. There is no public CRM list or database-ID lookup. Customer-safe projections omit PII, private notes and audit/owner information; enquiry status is deliberately simplified.
- All CRM responses use no-store. Both frontend and hosting must avoid caching receipt responses and must not place receipt tokens in URLs, telemetry or shared documents.
- Public submissions: 10 per 15 minutes per IP shared across enquiries/appointments; status lookups: 30 per minute shared across both types. Invalid attempts count too. Process-local counters require shared storage before multiple API replicas. CAPTCHA/OTP and contact-number ownership verification are not implemented.
- Phone numbers receive format validation, not ownership verification. Consent records permission to contact about the request, not newsletter consent. No customer accounts or automatic customer-table merging by phone are created.

## Retention proposal for owner review

This is an operational proposal, not an automatically enforced or legally approved retention policy. Review closed/non-converted enquiries and completed/cancelled appointments after 12 months; consider removing personal contact details and free-text content once no longer needed. Review spam sooner (for example, after 30 days). Keep only justified minimal audit metadata and business records that the owner has separately determined must be retained. Align backups with the approved retention period.

This milestone does not expose destructive CRM deletion or run a retention scheduler. A future approved purge/anonymization workflow should transactionally remove child notes/history/inspiration links as appropriate, revoke token hashes and cover backup retention. Managed image links can prevent image deletion until removed. Legacy records retain null consent/reference/token values; no consent is retroactively assumed.

## Configuration and operations

Availability starts unconfigured. The owner must explicitly enter timezone, days, hours, duration, buffer, capacity and closures before approvals can proceed. GET `/api/contact-options` returns a WhatsApp number only after owner configuration; summaries support a future frontend link without sending messages. No WhatsApp, SMTP, SMS or payment provider calls are made.

Receipt loss requires contacting the showroom; there is no automated token recovery endpoint. Duplicate submissions remain separate and are visible in CRM search; automatic deduplication and idempotency keys are not implemented. Public cancellation and customer-confirmation endpoints are deferred; the owner records requests after communicating with the customer.

Migration/test commands are in README. Recommended next milestone: website settings and owner account recovery backend, including validated showroom/about/contact/SEO content and secure email-based recovery behind explicit delivery configuration, before customer/admin frontend work.
