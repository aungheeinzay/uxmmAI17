# Operator incoming parcels UI

Current schema synchronization: `deliveryService` has been retired. Responses now provide nullable `operatorId` and `operator` (`id`, `fullName`, `phone`). The table/detail view display Operator; legacy orders without one show `Not assigned`. References to delivery service/carrier below describe the earlier contract and are superseded by [the schema synchronization guide](../../server/docs/OPERATOR_SCHEMA_SYNC.md).

## Routes and architecture

- `/operator/parcels`: real SME parcel list, filters and server pagination.
- `/operator/parcels/[id]`: parcel details and returned status history; UUID identifiers only.
- `/operator`: recent five orders and accurate total from the unfiltered list endpoint.

Thin App Router pages compose feature components. Components use custom hooks, which call typed API functions. The API functions use the existing same-origin HttpOnly session transport. TanStack Query is not installed, so no new state/query dependencies were added.

`page → component → useOperatorOrders / useOperatorOrderDetails → operator-orders.api → /api/session/operator/orders[/detail] → Express`.

The session endpoints use POST, matching the existing same-origin JSON/origin checks, but forward **read-only GET** requests to:

- `GET /api/operator/orders`
- `GET /api/operator/orders/:id`

The existing SME `/api/orders` endpoint is never used for Operator reads.

### Browser session API reference

| Method and route | JSON request body | Upstream request |
| --- | --- | --- |
| `POST /api/session/operator/orders` | Optional `page`, `pageSize`, `search`, `status`, `township`, `createdDate`; `{}` uses defaults | `GET /api/operator/orders` with validated query parameters |
| `POST /api/session/operator/orders/detail` | `{ "id": "660e8400-e29b-41d4-a716-446655440000" }` | `GET /api/operator/orders/660e8400-e29b-41d4-a716-446655440000` |

These are Next.js session routes on the frontend origin, not Express routes. They require the existing HttpOnly session cookies, a matching `Origin` header and `Content-Type: application/json`. Browser callers use same-origin credentials; never send or store access tokens in browser code. Unknown request fields are rejected. Successful reads return HTTP 200 with the response contracts below.

List request body example:

```json
{
  "page": 1,
  "pageSize": 20,
  "search": "PO",
  "status": "CREATED",
  "township": "Tamwe",
  "createdDate": "2026-10-21"
}
```

Errors use `{ "success": false, "error": { "code": "...", "message": "..." } }`.
Expected statuses include 400 (invalid body/filter/UUID), 401 (missing or invalid session), 403 (wrong role or origin), 404 (missing parcel), 413 (oversized body), 415 (wrong content type), 502 (invalid upstream response) and 503 (upstream unavailable). Upstream HTTP failure statuses are preserved. Responses are private and non-cacheable; refreshed session cookies may be returned.

The Express GET endpoints are documented in backend Swagger at `/api/docs` and `/api/docs.json`. Frontend session POST routes are documented here because they run in Next.js rather than Express.

The only shared session addition is `withAuthenticatedSession`, a wrapper around the unchanged cookie authentication, rotation, response and error helpers. Existing login/logout/refresh/profile/invitation flows remain intact.

## Contract

The repository Operator OpenAPI definitions, validation, repository projection, service serialization and Prisma enum were inspected. Swagger and implementation agree.

Lists return `{ success: true, data: { orders, pagination: { page, pageSize, total, totalPages } } }`.
Each row includes UUID id, orderCode, ownerId, recipientName, phoneNumber, township, deliveryAddress, senderName, parcelWeight, parcelWeightUnit, codAmount, currency, status, createdAt, updatedAt, deliveryInstructions, owner and deliveryService.
`owner` exposes id, fullName and phone. `deliveryService` exposes id and name.
Details additionally return `statusEvents`, each with id, previousStatus, status, note, createdAt and actor (id/fullName).
Decimal values remain strings and are grouped without floating-point conversion. Dates display in Myanmar time (`Asia/Yangon`), with MMT labels; the backend date filter explicitly uses UTC.

Runtime Zod schemas validate both browser responses and session-route upstream responses. Unknown fields are stripped before returning data to the browser, including unexpected account/authentication fields. Status response values remain strings for safe display of future unknown statuses.
The current filter enum is CREATED, PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, FAILED, CANCELLED. CREATED is displayed as Created; it is never renamed Pending.

## Components and hooks

- `IncomingParcels`: URL filter state, request orchestration and pagination controls.
- `IncomingParcelsFilters`: labeled React Hook Form/Zod filter form with explicit Apply and Clear actions.
- `IncomingParcelsTable`: responsive horizontal scrolling, semantic headers/caption, decimal/date rendering, details links.
- `ParcelDetails`: recipient, address/instructions, seller/sender, parcel/COD, carrier, timestamps and status history.
- `ParcelStatusBadge`: actual backend labels with neutral fallback for unknown statuses.
- `ParcelRequestState`: loading, safe errors, retry and sign-in link where relevant.
- `OperatorRecentParcels`: latest page of five orders and backend total.
- `useOperatorResource`: local asynchronous state scoped to resource, authenticated identity and session revision. Late results are ignored after navigation/logout/identity changes, and previous results are hidden while a new request loads.

No tokens or parcel responses are persisted in localStorage or Zustand. Zustand continues to hold only the existing session identity. There is no shared parcel data cache.

## Filters and pagination

Query keys match the backend exactly:

| Parameter | Meaning |
| --- | --- |
| `page` | 1–1,000,000; default 1 |
| `pageSize` | 1–100; default 20; UI offers 10/20/50/100 |
| `search` | Case-insensitive substring of order code or recipient name, max 120 characters |
| `status` | One supported status; omitted for all statuses |
| `township` | Case-insensitive exact match, max 120 characters |
| `createdDate` | Valid UTC calendar date, YYYY-MM-DD |

Filters and pagination are stored in the URL. Applying/clearing filters or changing page size resets to page 1. Back/forward navigation restores the URL state and form. There is no client-side slicing or invented total. Apply submits search explicitly, so typing does not generate requests.
Invalid URL parameters show a reset action without fetching parcels. Detail links retain a validated internal return path so Back to Parcels restores filters/page. Dates use the backend's newest-first ordering; details render the returned oldest-first history.

## Authorization and errors

The Operator layout RoleGuard verifies backend identity when the protected layout opens. Switching child routes preserves the mounted sidebar/header and does not restart session restoration; protected API reads continue to enforce authentication and roles. Anonymous visitors go to `/login`; SME/RIDER are redirected to their own dashboards. New dynamic details use Suspense boundaries required by the installed Next.js Cache Components configuration; no authorization checks were relaxed.
The session routes additionally require a trusted OPERATOR profile before forwarding. Express remains the permission authority. Both session and upstream requests bypass caching. Session rotation is preserved on success and recoverable errors; invalid sessions clear cookies. Tokens stay server-side.

The UI handles loading, empty results, 400 invalid input, 401 session expiry, 403 permission failure, 404 missing parcels, malformed response contracts and network/service errors. It offers retry without displaying raw upstream errors. Optional seller names/phone, instructions and empty status history have explicit fallbacks.
Warehouse, assignment, problem/delivery metrics and activity retain unavailable states because no accurate source exists. Profile Settings and Rider Invitation are preserved. There are no receiving, assignment, status mutation or warehouse controls.

## Setup and manual checks

Use existing server/client environment configuration (`EXPRESS_API_URL`, `APP_ORIGIN`, database/auth settings); no new variables are required. The server defaults to port 4000 in this integration. `APP_ORIGIN` must match the actual frontend origin for the existing session guard.

1. Start Express and Next.js using each package's `npm run dev`. Sign in through the existing login UI with a verified OPERATOR account.
2. Visit `/operator/parcels`. Check order, recipient, township, seller, carrier, COD, status and created date against `/api/docs` or `/api/docs.json`.
3. Apply search/status/township/UTC date filters. Check the URL and backend results. Navigate pages and change rows per page; counts come from the backend.
4. Open View details. Check the full address, recipient phone, instructions, weight, COD, seller/sender, carrier, timestamps and history. Use Back to Parcels; the previous query/page should be restored.
5. Navigate back/forward in the browser. Check filter form values match the current URL. Test at mobile width: the shell remains responsive and wide tables scroll within their container.
6. Visit `/operator` and compare recent orders/total with the unfiltered Operator API. Unsupported metrics must remain unavailable.
7. Check empty search results, a missing UUID, malformed filters, a disconnected backend and session expiry. Retry should work after recovery.
8. Verify anonymous users go to Login and SME/RIDER cannot view Operator parcels. Verify Profile Settings, Rider Management and sending invitations still work.

## Automated validation and limitations

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed, including the new dynamic detail and session routes.
- `npm test -- --reporter=dot`: 135 tests passed across 11 files, including existing Rider Invitation/session regression tests and legacy parcels without assigned Operators.
- Tests cover API contract validation, server forwarding and secret stripping, real session wrapper role restrictions/rotation, list/details rendering, filters/page requests, loading/empty/error states, exact decimal and Myanmar date formatting, unknown statuses, late logout responses and RoleGuard redirects.

Tests use mocked Operator data/upstream transport; this implementation did not seed, migrate or mutate any database. No live authenticated browser visual walkthrough was performed. Real data requires an existing verified Operator session and configured Express/database service.
Filters are explicitly applied rather than debounced. All statuses are shown by default, labeled in the UI; select Created to narrow to new parcels. There is no frontend implementation of receiving, assignment or status transitions. Backend schema, permissions, SME logic and rider delivery logic were not changed by this frontend task.
