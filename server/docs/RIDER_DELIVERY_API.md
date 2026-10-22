# Rider delivery and Operator assignment API — Phase 3A

> The current Rider list and provider-scoping contracts are defined in
> [OPERATOR_RIDER_MANAGEMENT.md](OPERATOR_RIDER_MANAGEMENT.md). The historical
> global Operator scope and Rider-list DTO in the Phase 3A notes below are superseded.

Implemented 2026-10-21; integrated with the frontend in Phase 3B. Swagger UI: `/api/docs`; JSON: `/api/docs.json`. Docs must be enabled by server configuration. Express uses the existing opaque Bearer authentication; the browser uses the approved HttpOnly-cookie BFF routes listed in the Phase 3B notes below.

## Workflow and model

SME creates CREATED → Operator receives PICKED_UP → Operator creates assignment (still PICKED_UP) → assigned Rider starts IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED or FAILED.

`RiderAssignment` maps to `rider_assignments`: UUID `id`, unique UUID `orderId` referencing `ParcelOrder`, UUID `riderId` referencing `Profile` through `AssignmentRider`, UUID `assignedById` referencing `Profile` through `AssignmentOperator`, and database-default `assignedAt` (`timestamptz(3)`). Rider lookup index: `(riderId, assignedAt)`. Foreign keys restrict deletion; orderId uniqueness enforces one permanent assignment per order. No reassignment and no ASSIGNED status. Shared role/status enums are unchanged.

## Endpoints

| Method | Path | Role | Success data |
| --- | --- | --- | --- |
| GET | `/api/operator/riders` | OPERATOR | `{ riders: AssignmentPerson[], pagination }` |
| POST | `/api/operator/assignments` | OPERATOR | `RiderAssignment` (201) |
| GET | `/api/operator/assignments` | OPERATOR | `{ assignments: RiderAssignment[], pagination }` |
| GET | `/api/rider/assignments` | RIDER | Own `{ assignments: RiderAssignment[], pagination }` |
| GET | `/api/rider/assignments/:id` | RIDER owner | Assignment with `order.statusEvents` |
| PATCH | `/api/rider/assignments/:id/status` | RIDER owner | Detail plus top-level `previousStatus` |

Successful responses use `{ "success": true, "data": ... }`; all GET/PATCH successes are 200, assignment creation is 201. Responses have `Cache-Control: no-store`.

All list endpoints accept only `page` (default 1, 1–1000000) and `pageSize` (default 20, 1–100). Pagination is `{ page, pageSize, total, totalPages }`; an empty result has totalPages 0. Assignment lists sort by assignedAt descending then id descending; eligible Riders sort by id ascending. There are no status/search filters in the new assignment endpoints. Unknown query/body fields are rejected.

Eligibility means profile role RIDER with an existing email-verified account. Invitation activation creates that account. Pending/expired/revoked invitations are not active Rider accounts. There is no disabled-account, availability, online, GPS, or workload flag in the current model; none is inferred. Invitation revocation is not an account-disabling mechanism.

## Operator example

POST `/api/operator/assignments` with authenticated OPERATOR:

```json
{
  "orderId": "660e8400-e29b-41d4-a716-446655440000",
  "riderId": "770e8400-e29b-41d4-a716-446655440000"
}
```

Example 201 response (fictional values; exact implemented field names):

```json
{
  "success": true,
  "data": {
    "id": "880e8400-e29b-41d4-a716-446655440000",
    "orderId": "660e8400-e29b-41d4-a716-446655440000",
    "riderId": "770e8400-e29b-41d4-a716-446655440000",
    "assignedById": "550e8400-e29b-41d4-a716-446655440000",
    "assignedAt": "2026-10-21T06:00:00.000Z",
    "rider": { "id": "770e8400-e29b-41d4-a716-446655440000", "fullName": "Fictional Rider", "phone": null },
    "assignedBy": { "id": "550e8400-e29b-41d4-a716-446655440000", "fullName": "Fictional Operator", "phone": null },
    "order": {
      "id": "660e8400-e29b-41d4-a716-446655440000",
      "orderCode": "PODEAD000000000001",
      "recipientName": "Fictional Recipient",
      "phoneNumber": "TEST-NOT-DIALABLE",
      "deliveryAddress": "Fictional test lane",
      "township": "Tamwe",
      "deliveryInstructions": null,
      "codAmount": "25000.5",
      "currency": "MMK",
      "status": "PICKED_UP"
    }
  }
}
```

The Operator list wraps these objects in `data.assignments`. Eligible Rider objects have only `id`, nullable `fullName`, nullable `phone`, with pagination alongside `data.riders`. Recipient fields are included in assignment results; no account credentials, email, or session information is selected.

Assignment requires an SME-owned PICKED_UP order and an eligible Rider. Actor identity always comes from the authenticated session. Sending assignedById, actorId, role, ownership fields, or a status is invalid. Assignment creates no status event and leaves order status unchanged. Operator, Rider and Order must share the Operator's persisted Provider. Operator assignment reads are similarly scoped; general receiving/list scope is otherwise unchanged.

## Rider frontend integration

1. Fetch GET `/api/rider/assignments?page=1&pageSize=20`; use **assignment `id`**, not orderId, for detail/status URLs.
2. The same assignment object shape appears in Rider and Operator lists. COD is an exact decimal string; do not interpret it as a delivery fee. Dates are ISO timestamps; format them for the intended locale.
3. Detail adds `order.statusEvents`, oldest first, with `{ id, previousStatus, status, note, createdAt, actor: { id, fullName } }`. History includes existing parcel events relevant to the assigned delivery, not just Rider-authored events. Phone, address, instructions, history notes, and COD are private operational data; do not expose them publicly.
4. Only render actions allowed by the current status below. Backend ownership and transition checks remain authoritative.
5. PATCH `/api/rider/assignments/:id/status` with one of these bodies:

```json
{ "status": "IN_TRANSIT" }
```

```json
{ "status": "FAILED", "note": "Recipient unavailable after delivery attempt" }
```

| Current status | Allowed next statuses |
| --- | --- |
| PICKED_UP | IN_TRANSIT |
| IN_TRANSIT | OUT_FOR_DELIVERY, FAILED |
| OUT_FOR_DELIVERY | DELIVERED, FAILED |
| CREATED, DELIVERED, FAILED, CANCELLED | None |

For FAILED, `note` is required and must have 3–1000 characters after trimming. For other statuses, an optional note must have 1–1000 characters after trimming. Null/blank notes, unknown fields, unsupported statuses, and invalid UUIDs return 400. DELIVERED, FAILED and CANCELLED are terminal. No cancellation/reassignment action is provided.

The PATCH response is the complete assignment detail with updated `order.status`, updated `order.statusEvents`, and top-level `previousStatus`. For example, starting delivery returns `previousStatus: "PICKED_UP"` and `order.status: "IN_TRANSIT"`. The appended event has those previous/current statuses, the supplied note or null, the authenticated Rider as actor, and a database-generated timestamp. Use the actual response and refresh list/detail data after success. On 409, refresh before offering another action; do not silently retry mutations.

Rider lists are always scoped to the authenticated Rider. Client-provided riderId is rejected. Missing and another Rider's detail/update both return 404, so the frontend must not infer another assignment's existence. Recipient data is only returned for the caller's own assignment. Operator order detail now adds nullable `assignment` with `id`, `riderId`, `assignedById`, `assignedAt`, and safe `rider` identity. Existing fields and Operator list shape remain unchanged.

## Error contract

```json
{ "success": false, "error": { "code": "ASSIGNMENT_NOT_FOUND", "message": "Assignment not found." } }
```

| HTTP | Codes / meaning |
| --- | --- |
| 400 | VALIDATION_ERROR or INVALID_JSON |
| 401 | UNAUTHORIZED: missing, invalid or expired Bearer session |
| 403 | FORBIDDEN: wrong authenticated role (existing unverified-account auth policy also applies) |
| 404 | ORDER_NOT_FOUND, RIDER_NOT_ELIGIBLE, or ASSIGNMENT_NOT_FOUND |
| 409 | ORDER_NOT_RECEIVED; ASSIGNMENT_CONFLICT for duplicate assignment, serialization conflict, or FK race; STATUS_TRANSITION_NOT_ALLOWED for invalid/concurrent Rider transition |
| 500 | INTERNAL_ERROR: safe generic service failure |

Do not clear a valid session on a 500. Do not automatically retry a timeout/network error after mutation; fetch current data first because the transaction may have committed.

## Transactions and migration safety

Both mutations use Serializable transactions. Assignment reads eligibility and creates the unique order assignment in that transaction. Rider delivery reads by `(assignmentId, authenticatedRiderId)`, updates the order conditionally on previousStatus plus assignment identity/ownership, inserts history, and reads the response in one transaction. Zero updated rows or Prisma P2034 map to 409. Assignment P2002/P2034/P2003 map to stable 409. No automatic transaction retry can accidentally advance a second delivery step.

Migration: `prisma/migrations/20261021130000_rider_assignments/migration.sql`. It adds the table, unique order index, rider lookup index, restricted foreign keys, RLS, and revokes direct anon/authenticated access following repository conventions. **Applied in Phase 3B to the explicitly user-confirmed Supabase development target**: host `aws-0-ap-south-1.pooler.supabase.com`, database `postgres`, migration port 5432, runtime port 6543. Read-only inspection first verified nine completed prior migrations and no assignment table. `prisma migrate deploy` applied only the pending assignment migration; `prisma migrate status` then reported up to date. A live test verified the unique index, rider index, three foreign keys and RLS. No reset, db push, destructive migration SQL, or deletion of pre-existing records was performed.

For other environments, first verify the latest merged migration directory and the exact target and inspect migration history; do not assume the same deployment authorization applies elsewhere. Earlier migrations retain legacy delivery-service columns not modeled by the current Prisma schema; do not use a broad generated diff to remove that preserved data.

## Implementation files and checks

- `src/modules/assignments/assignment.{router,controller,service,repository,validation,openapi}.ts`: shared assignment domain with separate Operator/Rider HTTP surfaces.
- `src/app.ts`, `src/config/swagger.ts`: route and Swagger registration.
- `src/modules/operator/operator.repository.ts`, `operator.openapi.ts`: additive assignment monitoring field.
- `prisma/schema.prisma` and the new migration: model and constraints.
- `tests/assignments.test.cjs`, `assignments.database.test.cjs`, `swagger.test.cjs`: focused coverage, opt-in PostgreSQL verification, updated operation inventory.

Actual checks: `npx --no-install prisma generate`, `npx --no-install prisma validate`, and `npm --prefix server run build` passed. `npm --prefix server test`: **58 passed, 3 skipped, 0 failed** (61 total). The 19 focused HTTP/service/repository-double assignment tests cover roles, eligibility, strict input, status transitions, ownership, atomic rollback paths, duplicate/concurrent calls, safe projections and Swagger. `npm --prefix client test`: **161 passed across 12 files**, verifying existing frontend/session consumers without frontend changes in this phase. `git diff --check` passed.

The three skipped suites require database configuration (assignment/delivery, auth recovery, Rider activation). The new database suite is opt-in: it requires TEST_DATABASE_URL to point to a local database whose name ends `_test`, plus PARCELOPS_ASSIGNMENTS_DB_TEST=confirmed, and assumes the reviewed migration is already applied. It creates only UUID-scoped fictional fixtures and cleans up only those fixtures. **Mocked tests do not prove real PostgreSQL concurrency/constraint behavior.**

## Phase 3B integration and verification

### No eligible Rider acceptance update (2026-10-22)

No backend contract or eligibility rule changed. The Operator dialog uses an empty `riders` list with pagination.total 0 to explain **No riders available for assignment**, disables confirmation and offers refresh/Rider Management. Loading and service failures remain distinct from an empty eligible list. GET `/api/operator/riders` still lists verified RIDER accounts, not online/idle/capacity availability.

POST `/api/operator/assignments` already rejects missing/invalid riderId (400), and missing/wrong-role/unverified/accountless Riders (404 RIDER_NOT_ELIGIBLE), before inserting an assignment in the existing Serializable transaction. On failure, the order remains PICKED_UP, no history or assignment is created, and the warehouse relation filter continues classifying it UNASSIGNED. A failed selection can be retried later. Duplicate-assignment and trusted-actor protections are unchanged.

The BFF now preserves the already-documented RIDER_NOT_ELIGIBLE code, while continuing to suppress raw backend messages; UI renders its known safe validation text and refreshes eligible Riders after rejection. No schema, status, migration, Swagger or authentication architecture changes are included in this acceptance update.

Verification: backend default suite 72 passed/4 opt-in database tests skipped; frontend suite 229 passed. The separately enabled live database workflow passed with new missing-selection/ineligible-Rider checks, asserting no assignment row, unchanged PICKED_UP status and continued UNASSIGNED warehouse membership before a later successful assignment. Existing database records were not altered; only test-created fixtures were cleaned up. TypeScript, ESLint and production build passed.

`server/PERMISSIONS.md` is now present and was reviewed. The SME-owned status endpoint was minimally restricted to **CREATED → CANCELLED** in the service, preserving ownership, conditional writes and atomic history. Requests for operational transitions return 409; Swagger examples and tests reflect this policy. Public order creation and the existing SME response shapes are unchanged.

Operator GET `/api/operator/orders` now optionally accepts `unassigned=true` or `unassigned=false` (string query values). It filters the real assignment relation, not status inference. Use `status=PICKED_UP&unassigned=true` for assignment eligibility. Its list response shape is unchanged. Assignment and Rider APIs above are reused without new Express paths.

The browser sends POSTs through the existing same-origin session client. Fixed BFF routes independently verify trusted session roles, validate strict inputs, strip extra response fields, preserve cookie rotation, and never expose Bearer tokens:

| Browser BFF route | Input | Express target |
| --- | --- | --- |
| `/api/session/operator/riders` | `{ page, pageSize }` | GET `/api/operator/riders` |
| `/api/session/operator/assignments` | `{ page, pageSize }` | GET `/api/operator/assignments` |
| `/api/session/operator/assignments/create` | `{ orderId, riderId }` | POST `/api/operator/assignments` |
| `/api/session/rider/assignments` | `{ page, pageSize }` | GET `/api/rider/assignments` |
| `/api/session/rider/assignments/detail` | `{ id }` | GET `/api/rider/assignments/:id` |
| `/api/session/rider/assignments/status` | `{ id, status, note? }` | PATCH `/api/rider/assignments/:id/status` |

BFF success responses use HTTP 200 with the existing success/data envelope (Express assignment creation remains 201). Rider response ownership is also checked defensively at the BFF. The new UI lives at `/operator/assignments`, `/operator/monitoring`, `/rider`, and `/rider/assignments/:id`. Operator monitoring links to parcel detail/history with assignment metadata. Lists and details support explicit refresh; delivery resources and Operator parcel resources refetch on window focus. Updates in another tab become visible on return/refresh; there is no live push/GPS infrastructure.

Verification: standard backend suite **61 passed, 4 opt-in database tests skipped**; frontend suite **191 passed in 14 files**. The separately enabled `delivery-workflow.database.test.cjs` **passed against the confirmed development database**, using real HTTP authentication, SME creation, Operator receipt, concurrent assignment (one winner), ownership denial, real unique constraint rejection, aborted-transaction status/history rollback, concurrent delivery start (one winner), OUT_FOR_DELIVERY, DELIVERED, Operator detail/history/list monitoring, and SME cancellation. It removed only UUID-scoped fixtures created by that invocation. The default suite skips this live test unless both PARCELOPS_WORKFLOW_DB_TEST=confirmed and PARCELOPS_WORKFLOW_DB_HOST identify the authorized target. Other legacy opt-in database suites were not run.

Prisma validation, backend TypeScript build, frontend production build and ESLint passed. UI behavior was tested with Testing Library; live database workflow verification covers the API, not a browser-driven end-to-end run. No reassignment, availability/GPS, sockets, or session-architecture changes. No commit or push was performed.
