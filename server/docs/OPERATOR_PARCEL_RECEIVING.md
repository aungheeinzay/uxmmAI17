# Operator parcel receiving

The current response uses nullable `operatorId` and `operator` instead of a delivery-service/carrier relation. See [schema synchronization](OPERATOR_SCHEMA_SYNC.md). Receiving authorization and transactional status/history behavior are unchanged.

## Endpoint

`PATCH /api/operator/orders/:id/receive`

Requires a verified opaque Bearer session with trusted role OPERATOR. SME and RIDER callers are forbidden. The service independently checks the supplied trusted actor's role, in addition to router middleware.
The UUID identifies an SME-owned order within the existing single-operation scope. No assignment or warehouse schema is added.
Only `CREATED → PICKED_UP` is allowed. PICKED_UP means Operator-confirmed parcel receipt for this MVP, not Rider delivery completion.

Request body is optional. When provided, it must be a JSON object containing only an optional `note` (trimmed, at most 1000 characters, nullable). Empty/blank notes are stored as null.

```http
PATCH /api/operator/orders/660e8400-e29b-41d4-a716-446655440000/receive
Authorization: Bearer <operator-access-token>
Content-Type: application/json

{"note":"Parcel received at intake desk."}
```

The example UUID is illustrative. Use a real CREATED parcel UUID from the Operator list endpoint.
Status, actorId, ownerId, role and timestamps cannot be provided; strict Zod validation rejects them. The authenticated session supplies the actor, and the database supplies the history timestamp.

## Responses

200 returns `{ "success": true, "data": { ...operatorOrderDetail, "previousStatus": "CREATED" } }`.
The parcel has `status: "PICKED_UP"`, unchanged owner, permitted seller/carrier information, decimal string weight/COD, and updated `statusEvents` history including the receiving event. It uses the same safe projection as Operator details. No auth/account secrets are selected. Responses set `Cache-Control: no-store`.

| HTTP | Code / meaning |
| --- | --- |
| 400 | VALIDATION_ERROR: invalid UUID, unknown fields, invalid body/note |
| 401 | UNAUTHORIZED: missing, malformed, expired or invalid session |
| 403 | FORBIDDEN: authenticated caller is not OPERATOR |
| 404 | ORDER_NOT_FOUND: absent or outside SME-order scope |
| 409 | STATUS_TRANSITION_NOT_ALLOWED: any status other than CREATED, including a repeated receive and all terminal states |
| 409 | STATUS_UPDATE_CONFLICT: status, owner or SME-order scope changed after initial validation |
| 500 | INTERNAL_ERROR: transaction/history/database failure; internal details are not exposed |

Errors use `{ success: false, error: { code, message } }`. Repeated receiving is rejected rather than treated as a second success. If a request's outcome is uncertain, refresh parcel details before retrying.

## Architecture and atomicity

`operatorRouter → requireAuth → requireRole("OPERATOR") → receive controller → receiveParcel service → receiveCreatedOrder repository → shared Prisma`.

1. Controller validates the UUID and note, and obtains the actor from `req.auth`.
2. Service checks OPERATOR role, performs a scoped lookup, returns 404 for absent/out-of-scope parcels, and rejects any status except CREATED with 409.
3. Repository opens a Prisma transaction. Its conditional update requires the exact order ID, the previously read owner ID, SME owner role and current CREATED status. The only mutation is `status = PICKED_UP`.
4. A zero-row update returns a conflict without adding history. A successful update creates exactly one `OrderStatusEvent` with CREATED, PICKED_UP, trusted actor and optional note.
5. The updated detail/history is read within the same transaction. History insertion or final-read failure rejects the callback and rolls back the write. No error is swallowed inside the transaction.

Two receiving requests cannot both satisfy the CREATED predicate after one succeeds. Concurrent SME cancellation or ownership/scope changes cannot be silently overwritten. This follows PostgreSQL conditional-update behavior; no database isolation claim is based solely on mocked tests.

No SME or Rider module, schema, migration, role enum or authentication flow was changed.

## Tests and manual verification

`tests/operator-receiving.test.cjs` contains 13 tests exercising the actual router, middleware, controller, service and repository with mocked session lookup and a transactional in-memory Prisma double. It checks:

- Missing/invalid/expired sessions, wrong-role rejection, and service-level role checks.
- Successful receipt, exact compare-and-swap predicates, trusted actor, note and timestamp handling.
- Client status/actor/owner/role/timestamp injection and invalid UUID/input rejection.
- Missing/out-of-scope orders; rejection of every non-CREATED state and all terminal states.
- Duplicate and concurrent receiving, with one winner and one history event.
- Status/owner/scope races, history-write failure and post-write read failure.
- Swagger security, input schema and response statuses.

Safe full regression command, from `server`, excluding both database integration files explicitly:

```powershell
npm run build
node --test tests/auth.test.cjs tests/cors.test.cjs tests/operator.test.cjs tests/operator-receiving.test.cjs tests/riders.test.cjs tests/seed.test.cjs tests/swagger.test.cjs
```

Results: 39 passed, 0 failed. TypeScript build and Prisma schema validation passed. No backend ESLint script is configured.
Database integration tests were not run; actual PostgreSQL rollback/concurrent execution remains to be verified on a separately confirmed test database. The in-memory tests establish callback/error propagation and intended conditional-write behavior, not deployed database correctness.

For manual testing on an explicitly approved development database only:

1. Start Express; open `/api/docs` and authorize as OPERATOR.
2. List `/api/operator/orders?status=CREATED` and select a development parcel UUID.
3. Execute the PATCH once. Check status PICKED_UP and the history event's actor/note/time through GET details.
4. Execute again: expect 409 and no extra event.
5. Verify SME/RIDER tokens return 403 and missing tokens return 401.

## Remaining security blockers and scope

The existing SME status endpoint still allows operational transitions and delivery outcomes. This separately owned violation is unchanged by approval; exclusive role ownership across the whole backend remains blocked until the SME developer restricts it to own-order CREATED → CANCELLED.
There is no company/tenant relationship in the existing schema. Receiving uses the same single-operation SME-order scope as Operator reads; it is not suitable for independently isolated delivery companies without coordinated scope/schema work.
The policy currently exists as `server/PERMESSIONS.md`, although instructions reference `PERMISSIONS.md`. The approved existing policy was followed; instruction files were not renamed or edited.
The earlier AGENT.md phase/auth descriptions also remain inconsistent with implemented orders/local opaque authentication; this feature follows the explicit receiving approval and existing auth system.

This change adds the backend receiving API only. It does not add a frontend receiving button, Next.js session mutation route, Rider assignment, warehouse operations or delivery status updates.
