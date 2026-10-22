# Operator receiving and warehouse

Phase 3B update: assignment and delivery screens are now connected; see `DELIVERY_WORKFLOW_INTEGRATION.md`. `server/PERMISSIONS.md` is now present and reviewed. The assignment migration has been applied to the explicitly confirmed development target and a live API/database workflow test passed. The limitations below describe the earlier Phase 2 verification state; the Phase 3B document records current results. Assignment eligibility now uses `status=PICKED_UP&unassigned=true`, backed by the real assignment relation; PICKED_UP alone still does not establish assignment state.

## Receiving flow

`/operator/parcels` and `/operator/parcels/[id]` offer **Confirm Received** only for CREATED parcels. The dashboard's shared recent-parcels table also supports receipt. The confirmation dialog names the parcel code and recipient, explains physical receipt, and requires explicit confirmation. Cancel makes no request. Pending submission disables confirmation and cancellation and blocks dismissal. A synchronous hook lock prevents repeated submissions before React rerenders.

The API's returned status is validated and used in feedback; the frontend does not assume successful receipt means a hardcoded status. After success, mounted Operator list, detail, and dashboard queries refetch. A persistent page notice survives the table/detail loading state. Newly mounted views always fetch current API data; there is no persistent parcel cache.

## Warehouse page

`/operator/warehouse` displays **Received Parcels**, using the existing list UI with a forced `status=PICKED_UP` query. URL status values cannot broaden this list. It displays code, recipient, township, delivery address, seller/sender, COD, current status, creation date in Myanmar time, and detail navigation. The detail back link preserves warehouse filters and pagination.

Search (code or recipient), exact township, UTC creation date, page, and page size use server filtering and pagination. Status is fixed and disabled in the warehouse form. Clear filters resets pagination; the next request remains PICKED_UP. Loading, safe errors with retry, and empty states reuse the incoming-parcels components. A dashboard quick action opens the queue.

PICKED_UP means received into delivery operations for this MVP. **Accurate unassigned parcel detection requires assignment data.** It does not prove a parcel is unassigned. No assignment records or warehouse statistics are fabricated; existing unavailable dashboard statistics remain unavailable.

## Architecture and API

Page → feature component → custom hook → API service → existing session bridge → Express.

- `ReceiveParcelDialog` composes the shadcn-style Radix dialog primitive and existing Button.
- `useReceiveParcel` owns the mutation, typed result, pending state, safe errors, and refresh notifications. TanStack Query is not installed, so the existing custom-hook approach is retained.
- `useOperatorResource` subscribes to `operator-parcels-changed`; it cancels application of stale effect results and scopes requests to the current authenticated identity.
- `ReceiptFeedback` subscribes to transient receipt feedback so a list refetch does not erase success/conflict messages. Notifications and refresh events contain no credentials and are not persisted.
- `operator-orders.api.ts` uses the existing same-origin `postSessionJson` transport.
- Browser POST `/api/session/operator/orders/receive` accepts strictly `{ id: UUID }`. The feature-specific server handler reuses `withAuthenticatedSession`, verifies OPERATOR, and forwards PATCH `/api/operator/orders/:id/receive` with `{}` and the server-held access token. No client actor, role, or ownership fields are forwarded.
- The success contract is `{ success: true, data: OperatorOrderDetail & { previousStatus: "CREATED" } }`; both boundaries validate it and verify the returned ID. Additional unexpected response fields are stripped.
- GET `/api/operator/orders` and GET `/api/operator/orders/:id` remain behind the existing session bridge. List responses contain `orders` and `pagination` with `page`, `pageSize`, `total`, and `totalPages`.

Contracts were inspected in `server/src/modules/operator/` (router, controller, validation, service, repository, and OpenAPI) and the Swagger registration. Supported query names are `page`, `pageSize`, `search`, `township`, `status`, and `createdDate`.

## Authorization and errors

The existing Operator layout/RoleGuard protects both routes: anonymous visitors go to login; SME and RIDER visitors are redirected away. The session bridge independently checks trusted backend role data. Express remains authoritative for role checks, CREATED eligibility, atomic conditional status update, conflict protection, and history insertion. No shared authentication, permissions, schema, or backend transition code changed.

Receiving translates 401, 403, 404, 409, 429, service failures, and network failures into safe messages without server stack traces. A 401 clears stale UI identity through the existing auth store. A 409 explains concurrent status changes and refreshes mounted parcel data. A 500/503 does not clear identity or valid cookies. Failed requests are not automatically retried; after an uncertain response, refresh the parcel before retrying.

## Verification (2026-10-21)

- `npm --prefix client test`: **12 files, 161 tests passed**, including the existing auth, Operator dashboard, rider invitation, and profile regressions. Its pretest also compiles the backend.
- Targeted receiving/warehouse suite: **20 tests passed**. Covers confirmation/cancel, non-CREATED actions, duplicate lock, pending controls, typed status, 401/403/404/409/429/500/503 and network handling, detail refresh on success/conflict, warehouse filter override, address rendering, pagination, applying filters, and details return navigation.
- Session-boundary tests cover fixed PATCH forwarding, strict identity-free input, anonymous/wrong-role/cross-origin rejection, response stripping, and preservation of HTTP failure statuses/cookies.
- `npm --prefix client run typecheck`: passed.
- `npm --prefix client run lint`: passed.
- `npm --prefix client run build`: passed, including warehouse and receiving session routes.

## Limitations

- `server/PERMISSIONS.md` is absent from the repository; root AGENTS.md is also absent. Existing enforcement and OpenAPI were inspected without changing backend rules.
- The local live `/api/docs` endpoint was unreachable during inspection. Repository OpenAPI definitions are the verified contract source.
- No live database/end-to-end receipt testing or visual browser QA was performed. UI tests use mocked API data; existing session integration tests use in-memory repositories.
- Refresh events update mounted views in the current tab. Other tabs/operators see current data on refresh/navigation; live push updates are outside scope.
- Assignment data and reliable unassigned counts remain unavailable. No rider assignment, SME/Rider module, Prisma schema/migration, shared role, or session implementation changes are included.
