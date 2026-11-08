# Enquiries API — Milestone 5

All responses follow `{ data }` / `{ error: { code, message } }`. Customer submissions return 201 only after the enquiry, initial history and audit entry commit. Every mutation requires the configured website Origin. No customer account is required.

## Public endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/enquiries/product` | Product enquiry; productId required |
| POST | `/api/enquiries/general` | General showroom enquiry |
| POST | `/api/enquiries/custom` | Custom design enquiry; optional managed imageIds |
| POST | `/api/enquiries/callback` | Callback request; optional callbackAt |
| POST | `/api/enquiries/status` | Customer-safe receipt lookup |
| GET | `/api/contact-options` | Configured showroom WhatsApp number/timezone, or null |

Submission fields: name (1–150 characters), phone (optional leading + followed by 8–15 digits starting nonzero), email (optional, valid address), message (1–5000), subject (optional, max 200), preferredContact (PHONE default, EMAIL or WHATSAPP), and `consent: true`. Email is required only when preferredContact is EMAIL. Choose the enquiry type through the endpoint; a `type` property in the body is rejected. Unknown fields, priority/status/owner IDs and client-supplied snapshots are rejected.

Product submissions require a publicly eligible product. SKU and name are captured server-side as snapshots; later rename/archive does not erase context. Callback times must be future ISO-8601 timestamps with Z or an explicit offset. Custom requests may reference up to five distinct existing ProductImage IDs belonging to public products. No external image URLs, Cloudinary IDs or anonymous uploads are accepted. Inspiration references have restrictive FKs. This milestone stores custom requests as Enquiry type CUSTOM, reusing the common CRM lifecycle; the earlier unused CustomRequest schema remains intact for future fabrication/order workflows.

Example general request:

```json
{
  "name": "Customer name",
  "phone": "+919876543210",
  "message": "I would like to discuss a jewellery design.",
  "preferredContact": "PHONE",
  "consent": true
}
```

The response includes a random UUID reference, a one-time-disclosed 256-bit receipt token, customer-safe status/summary and submission time. Store the receipt securely. Lookup requires `{"reference":"<uuid>","token":"<64 hex characters>"}` in the POST body. Only the token hash is persisted. Tokens expire for lookup 90 days after submission; lost tokens have no automated recovery route. Never put tokens in URLs, analytics or logs.

Public enquiry status is limited to RECEIVED, IN_REVIEW or CLOSED. SPAM/CONVERTED and other internal states are not disclosed. Responses contain no phone/email, customer message, owner IDs, priorities, notes, audit logs or database IDs. A wrong reference/token combination, an expired receipt or missing record returns the same 404. Malformed receipts return 422. There is no public list or database-ID lookup route.

Repeated identical submissions are stored as separate records with unique receipts; none are silently discarded. Submission retries are not idempotent. The future frontend should retain a successful receipt and avoid blind automatic retries after an uncertain response.

## Owner CRM

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/admin/enquiries` | Search/filter/paginated list |
| GET | `/api/admin/enquiries/:id` | Full details and managed inspiration references |
| PATCH | `/api/admin/enquiries/:id` | `{ "status": "CONTACTED", "priority": "HIGH" }`; either field optional |
| POST | `/api/admin/enquiries/:id/notes` | `{ "body": "Private note" }` |
| GET | `/api/admin/enquiries/:id/notes` | Paginated owner-authored notes |
| GET | `/api/admin/enquiries/:id/history` | Paginated immutable status transitions |
| GET | `/api/admin/enquiries/:id/activity` | Paginated audit activity |

List parameters: page/limit (defaults 1/24, maximum 100), search (customer name, phone, reference, product name/SKU or subject), type, status, from/to (inclusive submission timestamps), sort (latest/oldest). Sorting includes a stable ID tie-breaker. Invalid filters/ranges return 422. Notes/history/activity accept only page/limit and sort newest first. Priority values: LOW, NORMAL, HIGH, URGENT. Admin responses also omit receipt-token hashes.

Status transitions, priority audit, note authorship and privacy/retention guidance are documented in `CRM_WORKFLOW.md`. New status/history/note/audit writes commit transactionally under the CRM lock. Repeating an unchanged status does not add duplicate transition history.

## Abuse limits and WhatsApp readiness

All public enquiry and appointment submissions share 10 requests per 15 minutes per IP, including invalid submissions. Both status endpoints share 30 requests per minute per IP. Existing global limits also apply. Responses set Cache-Control: no-store; 429 errors are structured. Limits are process-local and require shared storage before multi-replica hosting.

`/api/contact-options` exposes only the owner-configured WhatsApp number and timezone from availability settings. No number is seeded. Customer-safe enquiry and appointment responses include structured summary data so a future frontend can construct a properly URL-encoded WhatsApp link. No message is sent and no WhatsApp provider is connected.
