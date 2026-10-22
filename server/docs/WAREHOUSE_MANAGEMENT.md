# Warehouse Management — Phase 4A

Implemented and verified on 2026-10-22. The existing Operator shell, receiving flow, assignment dialog and delivery state machine are preserved. Production UI uses database-backed APIs only.

## State definitions and scope

| Derived warehouse state | Database predicate | Meaning |
| --- | --- | --- |
| UNASSIGNED | PICKED_UP and no RiderAssignment | Received, awaiting Rider assignment |
| ASSIGNED | PICKED_UP and RiderAssignment exists | Assigned, awaiting dispatch |
| DISPATCHED | IN_TRANSIT or OUT_FOR_DELIVERY | Delivery tracking group |
| COMPLETED | DELIVERED | Historical delivery tracking group |
| EXCEPTION | FAILED | Delivery exception tracking group |

CREATED is incoming and has no warehouse state; CANCELLED also has no warehouse state. Both are excluded from warehouse lists/counts. The **receivedAwaitingDispatch** inventory count is exactly **unassigned + assignedAwaitingDispatch**. Dispatched, completed and exception totals are not counted as physically stored warehouse inventory. No shelf/rack, actual location, physical return, or movement is inferred.

Scope follows existing approved Operator behavior: all SME-owned orders in the current single delivery operation. There is no multi-company tenancy boundary in the current model. Overview scope is **ALL_TIME**, counting each order's current status across all creation dates; completed is the all-time current-DELIVERED total. Overview cards are intentionally independent of table filters. List createdDate filters the UTC order creation date, not receipt, dispatch or completion date.

## Express API

Both new endpoints require `requireAuth` and `requireRole("OPERATOR")`. Services also reject non-Operator actors. Existing resource/auth rules remain unchanged. Missing/invalid sessions return 401; SME/RIDER return 403 before warehouse access.

### GET /api/operator/warehouse/overview

No query parameters accepted. Example response illustrates an empty operation; production counts are never hardcoded:

```json
{
  "success": true,
  "data": {
    "scope": "ALL_TIME",
    "unassigned": 0,
    "assignedAwaitingDispatch": 0,
    "receivedAwaitingDispatch": 0,
    "dispatched": 0,
    "completed": 0,
    "exceptions": 0
  }
}
```

Five PostgreSQL count queries execute in one Prisma RepeatableRead transaction, providing a consistent overview snapshot. The active inventory sum is calculated from the two counted PICKED_UP groups. Counts are not derived from a loaded frontend page.

### GET /api/operator/warehouse/parcels

| Query | Contract |
| --- | --- |
| page | Integer 1–1000000, default 1 |
| pageSize | Integer 1–100, default 20 |
| search | Trimmed 1–120 characters; order code or recipient name substring, case insensitive |
| township | Trimmed 1–120 characters; exact match, case insensitive |
| warehouseState | One of the five states above; omit for all warehouse/tracking groups |
| createdDate | Valid UTC calendar date, YYYY-MM-DD |

Example: `/api/operator/warehouse/parcels?page=1&pageSize=20&warehouseState=UNASSIGNED&township=Tamwe&search=PO`.

```json
{
  "success": true,
  "data": {
    "orders": [],
    "pagination": { "page": 1, "pageSize": 20, "total": 0, "totalPages": 0 }
  }
}
```

Nonempty `orders` use the existing OperatorOrder fields plus `warehouseState` and nullable `assignment`. Assignment contains `id`, `riderId`, `assignedById`, `assignedAt`, and `rider: { id, fullName, phone }`. COD/weight remain exact decimal strings. Order status is returned alongside the derived state. No account, email, credential or session records are selected.

Search/date/township/state filters apply together in PostgreSQL before offset/limit/count. The list and count share a RepeatableRead snapshot and identical filters. Ordering is createdAt descending then id descending. Pagination totals count all matches, not the current page. Rider metadata is selected through the relation in the list operation; no per-order JavaScript lookup loop or whole-dataset client filtering is used.

The default list includes PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED and FAILED only. UNASSIGNED/ASSIGNED explicitly use assignment `is: null` / `isNot: null`. Unknown query keys, warehouse states, bad dates, status overrides, ownerId, operatorId and client roles return 400. Empty or out-of-range pages retain accurate pagination metadata.

### Reused GET /api/operator/orders/:id

Existing fields/history and assignment metadata are unchanged. Additive detail fields:

- `warehouseState`: derived group, or null for CREATED/CANCELLED.
- `receipt`: `{ receivedAt, receivedBy: { id, fullName } }` from the first recorded CREATED → PICKED_UP status event, or null. The UI labels this the **recorded receiving actor**: it never substitutes the order's chosen Operator or creation timestamp. Legacy actor role is not inferred.
- `failureNote`: note from the latest recorded FAILED history event, or null. Existing full status history remains visible.

No new detail endpoint or physical-location field was added. Receiving's response shape is preserved; subsequent detail reads include the derived metadata.

### Errors and Swagger

Warehouse reads return 400 validation failure, 401 unauthenticated, 403 wrong role, and safe generic 500 for unexpected backend failures. The BFF preserves received statuses, including upstream 503; it does not clear valid cookies on 500/503. Existing detail reads return 404 when missing. Warehouse reads do not introduce a mutation/409 workflow; existing assignment conflict responses remain authoritative. Responses are private/no-store through the existing transport.

Swagger at `/api/docs` and `/api/docs.json` registers both new operations under **Operator Warehouse**, with state definitions, query schemas, pagination, success examples, permissions and error responses. Operator detail documentation covers receipt/state/failure fields.

## Frontend integration

`/operator/warehouse` now composes Warehouse Management with live overview cards, URL-backed filters, server pagination and the existing horizontally scrollable parcel table. Columns show code/recipient, township/address, COD, order status, warehouse state, assigned Rider, creation time and context actions. The Operator dashboard reuses the overview component and replaces the old unavailable warehouse metrics/panel.

Actions reuse existing functionality:

- UNASSIGNED: Assign Rider links to `/operator/assignments?orderId=...&returnTo=...`, retaining the warehouse filter/page context. The assignment route validates the UUID and internal return path, loads that exact parcel even if it is not on page 1, and reuses the existing assignment dialog. A parcel already assigned or no longer PICKED_UP shows its actual state instead of an active assignment action.
- ASSIGNED: View Assignment opens existing parcel detail with Rider identity/date/history.
- DISPATCHED: View Delivery Status opens existing detail/history.
- COMPLETED: View Details opens existing detail/history.
- EXCEPTION: View Failure opens detail with the recorded failure note/history. No retry/reassignment is introduced.

Page → feature components → custom hooks → typed API service → existing same-origin cookie BFF → Express. New browser BFF endpoints use POST `/api/session/operator/warehouse/overview` with `{}` and POST `/api/session/operator/warehouse/parcels` with the list query object. They verify trusted OPERATOR identity, strict input, response schemas and count consistency; the server-held Bearer token never reaches client JavaScript. Auth/session architecture and SME/Rider workflows were not changed.

The existing `operator-parcels-changed` event refreshes overview/list after receiving or assignment and after Rider updates in the same active session. Manual **Refresh warehouse**, retry and window-focus refetch handle updates from separate Rider sessions/tabs. Dashboard counts use the same mechanism. Loading and refreshing messages are explicit; invalid-link, no-data, no-filter-matches, safe error/retry and auth states are supported. There are no WebSockets, polling, GPS or real-time claims. List and overview requests are separate snapshots and can briefly differ if another operation happens between them; refresh reconciles them.

## Database and migration status

### Availability repair (2026-10-22)

The reported SERVICE_UNAVAILABLE failure was reproduced as Prisma P2007: the actual `public.OrderStatus` enum lacked OUT_FOR_DELIVERY, although the original workflow migration was marked applied. Both overview and list predicates referenced this approved value, so PostgreSQL rejected them. Both configured runtime and migration connections showed the same drift.

Additive, idempotent migration `20261022010000_restore_out_for_delivery_status` restores OUT_FOR_DELIVERY after IN_TRANSIT with `ADD VALUE IF NOT EXISTS`. It was applied to the previously explicitly confirmed development target, preserving all existing records and enum values. There are now **11 applied migrations**. Real overview/list database reads succeeded after repair. The live workflow regression now checks the actual enum labels as well as migration history, so a marked-applied migration alone is no longer treated as proof that the required enum value exists.

The initial Phase 4A implementation needed no new schema or migration. Existing RiderAssignment uniqueness is preserved. The target is the previously explicitly confirmed Supabase development database: `aws-0-ap-south-1.pooler.supabase.com`, database `postgres`, migration port 5432/runtime port 6543. Initial read-only migration inspection reported 10 applied migrations, including `20261021130000_rider_assignments`; that history did not reveal the later-observed enum drift. The repair above brings the total to 11 applied migrations. No reset/drop/truncate or alteration of pre-existing parcel data was performed.

## Changed files

- Backend `src/modules/operator/warehouse/warehouse.{state,validation,repository,service,controller,openapi}.ts`: state derivation, strict queries, database reads/aggregations, role enforcement, API and Swagger.
- Backend `src/modules/operator/operator.{router,repository,service,openapi}.ts`: route registration, reuse of safe parcel projection/serialization, additive detail metadata/docs. `src/config/swagger.ts`: schema/path/tag registration.
- Frontend `features/operator/{api/warehouse.api.ts,hooks/use-warehouse.ts,server/warehouse.session.ts,types/warehouse.types.ts}` and two `app/api/session/operator/warehouse/*/route.ts` files: typed integration using existing transport.
- Frontend `warehouse-management.tsx`, `warehouse-overview.tsx`, `warehouse-filters.tsx`, existing parcel table/detail/request-state/dashboard/resource hook and order types/API: UI, safe refresh states and errors.
- Existing Operator assignment route/component: exact selected-parcel context and safe warehouse return link, reusing existing mutation logic. Existing warehouse page now composes WarehouseManagement.
- Tests: `server/tests/warehouse.test.cjs`, `swagger.test.cjs`, expanded `delivery-workflow.database.test.cjs`; `client/tests/warehouse.test.tsx`, `warehouse-session.test.ts`, updated dashboard expectation in `operator.test.tsx`.

## Verification

- Backend default suite: **71 passed, 4 opt-in database suites skipped, 0 failed** (75 total). New warehouse tests cover roles, classifications, exclusions, aggregation predicates/isolation, relational filters, combined search/date/township filters, pagination totals, safe projections, empty data, strict input, and receipt/failure availability.
- Frontend suite: **219 passed across 16 files**. Covers actual overview rendering, URL requests, pagination, context actions, Rider identity, safe errors/retry, loading/refresh events, selected assignment context, receipt/failure detail, strict BFF role/input checks, response sanitization and service-error session preservation, plus existing Operator/Rider/SME/session regressions.
- Separately enabled **real database workflow test passed** against the confirmed development target: SME creation (CREATED excluded) → receipt (UNASSIGNED) → assignment (ASSIGNED, still PICKED_UP) → Rider start/out-for-delivery (DISPATCHED) → completion (COMPLETED). It verified filtered warehouse results at each step, active-inventory count increase on receipt/decrease on completion, persisted relation-based counts, CANCELLED exclusion, ownership, uniqueness/concurrent write protection and rollback/history integrity. Only UUID-scoped fixtures created by that test were cleaned up; pre-existing records were untouched.
- Frontend TypeScript, ESLint, backend TypeScript build, Prisma validation and the production frontend build all passed. `git diff --check` passed.
- Swagger serving/ref/schema inventory tests passed with the new operations. UI tests use Testing Library; the database-backed E2E is HTTP/API driven, not browser driven. No visual browser QA was performed.

## Manual test steps and limitations

1. Sign in as Operator and open Warehouse Management; confirm all-time scope labels and distinguish the awaiting-dispatch total from delivery tracking totals.
2. Create an SME order; it appears in Incoming Parcels and not in Warehouse Management. Receive it as Operator; refresh warehouse and locate it as UNASSIGNED.
3. Apply state/search/township/date filters and page-size/page navigation. Overview cards should remain unfiltered; list totals must follow filters.
4. Click Assign Rider on that row, select an activated Rider and explicitly confirm. The exact parcel and warehouse return context should be preserved. Return/refocus warehouse: the row is ASSIGNED and Rider name is visible.
5. In a Rider session, start delivery and mark out for delivery. Refresh/refocus Operator warehouse: the row is DISPATCHED and no longer counted awaiting dispatch.
6. Complete delivery; warehouse group becomes COMPLETED, reflected in the historical count. Alternatively use a different parcel to report FAILED with a meaningful reason, then inspect View Failure/history.
7. Try wrong-role access, empty/no-match filters, invalid URLs and temporary service failure. No warehouse-wide data should be available to SME/RIDER; 500/503 must preserve valid sessions.

Counts have no date-range scope beyond all-time; only parcel-list createdDate is supported. Actual location, returns, reassignment, shelf/rack data and multi-company tenancy remain outside this MVP. Legacy records without receipt history show unavailable receipt metadata rather than inferred timestamps. List data is loaded on demand; large deployments may need query/index tuning based on measured query plans. No unrelated SME/Rider business rules, roles or migrations were changed. No commit or push was made.
