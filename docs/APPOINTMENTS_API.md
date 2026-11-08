# Appointment requests and availability — Milestone 5

## Public requests and privacy

POST `/api/appointments` with name, phone, `consent: true`, purpose and requestedAt. Optional fields: email, alternativeAt, visitors (integer 1–20, default 1), message (up to 5000 characters), productId and collectionId. References must be publicly eligible. Purposes are CONSULTATION, BRIDAL, CUSTOM, PRODUCT_VIEWING, PURCHASE and OTHER. Both date/time fields must be future ISO-8601 timestamps with an explicit offset or Z. A combined timestamp carries the customer's preferred date and time without ambiguous server-local interpretation.

Creation returns 201 with an unpredictable reference, one-time-disclosed secret token and safe summary. New records explicitly start REQUESTED with no confirmed time. Requests do not consume appointment capacity. Hours need not be configured to accept requests, and a customer may request an out-of-hours time; the owner must propose a valid alternative before confirming it.

POST `/api/appointments/status` with reference and token to view a safe status, requested/proposed/confirmed times, appointment end and explicitly customer-facing reason. It never returns customer contact details, private notes, owner IDs or operational audit data. The same receipt/token security, 90-day lookup lifetime and rate limits as enquiry lookup apply. No public list, database-ID lookup, cancellation or reschedule-confirmation route is exposed. Customers contact the showroom to accept changes; the owner records confirmation.

## Owner endpoints

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/admin/appointments` | Paginated search/filter list |
| GET | `/api/admin/appointments/:id` | Owner details, original/alternative/proposed/confirmed times |
| POST | `/api/admin/appointments/:id/actions` | Execute an explicit lifecycle action |
| POST | `/api/admin/appointments/:id/notes` | `{ "body": "Private note" }` |
| GET | `/api/admin/appointments/:id/notes` | Paginated private notes |
| GET | `/api/admin/appointments/:id/history` | Paginated status/time history |
| GET | `/api/admin/appointments/:id/activity` | Paginated audit activity |
| GET | `/api/admin/availability` | Configured model or null |
| PUT | `/api/admin/availability` | Replace scheduling rules; full validated configuration required |

Lists accept page/limit (1/24 defaults, max 100), search (name/phone/reference/purpose), status, inclusive from/to submission dates, and sort latest/oldest. History/notes/activity accept page/limit only. Every owner endpoint uses existing sessions and same-origin mutation protection.

Action payload: `{"action":"PROPOSE","time":"<future ISO timestamp>","reason":"Optional customer-facing explanation"}`. Only PROPOSE accepts time. REJECT and CANCEL require reason. Reasons are visible to the customer; put private comments in notes.

| Action | Allowed current states | Result |
| --- | --- | --- |
| APPROVE | REQUESTED, legacy PENDING | APPROVED at original requestedAt |
| REJECT | REQUESTED, PENDING, RESCHEDULE_PROPOSED | REJECTED; reason required |
| PROPOSE | REQUESTED, PENDING, APPROVED, RESCHEDULE_PROPOSED | RESCHEDULE_PROPOSED; future time required |
| CONFIRM | RESCHEDULE_PROPOSED | APPROVED at proposedAt after capacity check |
| CANCEL | REQUESTED, PENDING, APPROVED, RESCHEDULE_PROPOSED | CANCELLED; reason required |
| COMPLETE | APPROVED, after scheduled start | COMPLETED |
| NO_SHOW | APPROVED, after scheduled start | NO_SHOW |

Original requestedAt and alternativeAt are never rewritten. Every action appends a history row containing previous/next state, actor, original/proposed/scheduled/end times, reason and timestamp. Previously confirmed times remain in prior history. Proposed time does not reserve a new slot; an already confirmed original booking remains occupied until confirmation/rejection/cancellation. Completion/no-show cannot be recorded before the confirmed start. Rejected/cancelled records remain retained.

## Availability and transactional capacity

No business hours, capacity, timezone or showroom number is fabricated. With no configuration, GET availability returns null and approval/confirmation/proposal returns 503 AVAILABILITY_NOT_CONFIGURED. The owner supplies:

- timezone: valid IANA identifier, such as Asia/Kolkata.
- weekly: up to seven unique `{day, open, close}` entries; day 0 is Sunday and 6 Saturday; local times use HH:mm. Omitted days are closed. Overnight opening intervals are not supported.
- durationMinutes: 5–480; bufferMinutes: 0–120; capacity: 1–100 simultaneous appointments.
- closureDates: up to 366 YYYY-MM-DD dates in the showroom timezone, for unavailable/special closure days.
- whatsappNumber: optional configured number or null; no default.

Valid starts align to opening time plus multiples of duration+buffer. Appointments and their post-appointment buffer must finish within the same local operating day. UTC timestamps preserve instants; Intl converts to the configured timezone for rule checks. Confirmed records persist endsAt and occupiedUntil, so later configuration edits do not rewrite existing reservations.

Approval/confirmation, cancellation/rescheduling and configuration updates share a database transaction advisory lock. Capacity checks evaluate overlapping confirmed intervals (including buffer) with a sweep of starts/ends; simultaneous events process departures first. Capacity counts appointments, not visitor headcount. REQUESTED records do not hold capacity. An approved booking with a pending reschedule retains its old interval. A failed status/history/audit write rolls back the whole booking update.

Changing hours/capacity applies to later confirmations; existing reservations are not silently cancelled or moved, even if the new rules would disallow them. Owners must review such changes. Legacy confirmed bookings lacking occupiedUntil block new confirmations with LEGACY_BOOKING_REVIEW until reviewed; no duration is invented. Earlier RESCHEDULED enum records are preserved but need explicit operator review before using the new workflow.

No public available-slot listing is exposed yet. Customers submit preferences; the owner chooses configured slots. No payment holds, notification delivery, automatic customer acceptance, recurring appointments or automated no-show task is included.

## Persistence and verification

Additive migration `20261102000400_crm` extends Appointment and enums, adds appointment history/notes, extends enquiry history with actor references, introduces EnquiryImage and a singleton ShowroomAvailability model. Nullable consent/reference/token fields preserve legacy records without inventing consent or issuing access credentials. New APIs always populate these fields explicitly. Existing authentication/catalogue/image/CMS records are preserved.

See `VERIFICATION.md` for actual migration, test, build and audit results. Automated tests exercise concurrency, capacity 1 and 2, reschedule slot retention, closure/timezone rules, rollback, private notes, receipt isolation and prior-milestone regressions.
