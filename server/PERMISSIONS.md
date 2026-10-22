# ParcelOps AI — Role-Based Authorization & Order Lifecycle Rules

## 1. Mandatory Authorization Policy

This section defines the approved authorization policy for ParcelOps AI.

All backend developers and AI coding agents MUST follow these rules when implementing or modifying SME, OPERATOR, RIDER, Orders, Warehouse, and Delivery modules.

Before changing order statuses, role permissions, assignment relationships, or related APIs, inspect this policy and the existing Prisma schema.

Never weaken authorization to make an endpoint work.

## 2. Application Roles

The application has exactly three roles:

- `SME` — Online shop owner
- `OPERATOR` — Delivery operations manager
- `RIDER` — Delivery personnel

All roles use the existing authentication system.

Public registration creates `SME` accounts only.

Operators are provisioned through a trusted administrative process.

Riders are created exclusively through authenticated Operator invitations and activate their accounts through secure email links.

Never allow users to select or modify their own roles.

## 3. Permission Matrix

| Action | SME | OPERATOR | RIDER |
|---|---|---|---|
| Create order | Allowed | Denied | Denied |
| View own orders | Allowed | Allowed through operational scope | Assigned only |
| View incoming orders | Denied | Allowed | Denied |
| Cancel own CREATED order | Allowed | Denied by default | Denied |
| Receive parcel | Denied | Allowed | Denied |
| Manage warehouse | Denied | Allowed | Denied |
| Invite rider | Denied | Allowed | Denied |
| Assign parcel to rider | Denied | Allowed | Denied |
| View own assigned parcels | Denied | Allowed | Allowed |
| Start delivery | Denied | Denied | Allowed for assigned parcels |
| Mark parcel delivered | Denied | Denied | Allowed for assigned parcels |
| Mark delivery failed | Denied | Exception workflow only | Allowed for assigned parcels |
| Monitor operational deliveries | Denied | Allowed | Denied |
| Change application roles | Denied | Denied | Denied |

Operators must not automatically receive system-administrator privileges.

## 4. Order Status Enum

The existing Swagger/OpenAPI contract defines these statuses:

- `CREATED`
- `PICKED_UP`
- `IN_TRANSIT`
- `OUT_FOR_DELIVERY`
- `DELIVERED`
- `FAILED`
- `CANCELLED`

Do not invent `PENDING`, `RECEIVED`, `ASSIGNED`, or `COMPLETED` as Prisma enum values.

Any new status requires team approval and coordinated schema/API changes.

## 5. Approved Status Transition Ownership

### SME

Allowed:

`CREATED → CANCELLED`

Only for the SME's own order.

SME cannot set:

- PICKED_UP
- IN_TRANSIT
- OUT_FOR_DELIVERY
- DELIVERED
- FAILED

### OPERATOR

Allowed:

`CREATED → PICKED_UP`

For the MVP, `PICKED_UP` represents the Operator-confirmed parcel receipt into the delivery operation.

The Operator must not mark parcels DELIVERED through ordinary receiving or assignment APIs.

### RIDER

Allowed only after verifying an active assignment to the authenticated Rider:

`PICKED_UP → IN_TRANSIT`

`IN_TRANSIT → OUT_FOR_DELIVERY`

`OUT_FOR_DELIVERY → DELIVERED`

Failure paths:

`IN_TRANSIT → FAILED`

`OUT_FOR_DELIVERY → FAILED`

An Operator must assign the Rider before the Rider can start delivery.

### Terminal Statuses

These are terminal:

- DELIVERED
- FAILED
- CANCELLED

Ordinary APIs must reject further status changes after terminal states.

Rider confirmation of DELIVERED completes the order automatically. No additional Operator confirmation is required.

## 6. Assignment Rules

Rider assignment is a separate business operation.

Do not represent rider assignment by inventing an `ASSIGNED` order status.

A Rider assignment must identify:

- Order
- Rider
- Assigning Operator
- Assignment timestamp

Enforce these invariants:

1. Only OPERATOR can assign Riders.
2. Only eligible, active RIDER accounts can receive assignments.
3. Only parcels received into the delivery operation may be assigned.
4. A parcel must not have multiple active assignments.
5. Rider access must be restricted to their own active assignments.
6. Duplicate or conflicting assignments must be rejected.
7. Assignment and related operational state changes must be transactionally consistent.
8. Do not allow a Rider to claim arbitrary warehouse parcels.

### Provider-scoped Rider management and assignments (approved 22 October 2026)

Operator management reads and assignment operations resolve the current persisted
Profile.providerId. RIDER profiles use the same membership relation. Operators may
list/detail only Riders in their own Provider, and may assign only verified Riders
and Orders whose deliveryProviderId matches that Provider. Null membership is not
eligible. An Operator with no membership cannot invite or assign Riders. Invitation
membership is captured server-side, never selected through a normal request body.
Normal profile updates cannot change roles or provider membership. Existing Riders
require controlled provisioning with independently verified exact IDs; never infer
membership from historical assignments. A Rider's existing own-assignment access and
approved transition rules remain unchanged. Workload describes tasks only and does
not impose capacity, presence or shift rules. See docs/OPERATOR_RIDER_MANAGEMENT.md.

The shared assignment schema and API contract require coordination with the Rider developer before implementation.

## 7. Authentication and Authorization Middleware

Use the existing middleware:

```ts
requireAuth
requireRole
```

Example:

```ts
router.patch(
  "/orders/:id/receive",
  requireAuth,
  requireRole("OPERATOR"),
  controller.receiveParcel
);
```

Requirements:

- Missing/invalid session: 401.
- Valid session with insufficient role: 403.
- Invalid status transition: 409.
- Missing resource: 404.
- Unauthorized resource ownership must not expose private order existence.

Do not trust roles, account IDs, assignment ownership, or actor IDs supplied by clients.

Always obtain the authenticated identity from trusted server-side session data.

## 8. Resource-Level Authorization

Role checking alone is insufficient.

### SME

Database queries must be scoped to the authenticated SME's own orders.

### OPERATOR

May access orders within the authorized delivery operation.

Do not assume Operator access grants unlimited access across independent delivery companies if multi-tenant boundaries are introduced.

### RIDER

May view and update only orders assigned to the authenticated Rider.

Enforce assignment ownership inside the Service/Repository layers.

Never rely exclusively on frontend filtering.

## 9. Status Update Integrity

Every accepted status transition must:

1. Verify the authenticated user.
2. Check role permission.
3. Check resource ownership or assignment.
4. Validate the current status.
5. Validate the requested transition.
6. Update the order atomically.
7. Create an `order_status_events` history record.
8. Record the trusted actor and timestamp.
9. Prevent concurrent updates from silently overwriting each other.

Do not accept actor IDs or timestamps from the frontend.

Use Prisma transactions and optimistic concurrency checks where appropriate.

## 10. Existing SME Status Endpoint

Existing route:

`PATCH /api/orders/:id/status`

The previous implementation allowed SME owners to advance parcels through operational delivery statuses.

This conflicts with the approved permission policy.

The SME developer must restrict the endpoint to:

`CREATED → CANCELLED`

Do not remove ownership checks.

Coordinate this change with the SME developer and update Swagger/tests accordingly.

## 11. Module Ownership and Team Collaboration

Developers are working concurrently.

- SME developer owns SME order creation and cancellation.
- Operator developer owns receiving, warehouse operations, and rider assignment.
- Rider developer owns assigned delivery status updates.

Do not modify another developer's module without coordination.

Shared Prisma schema, status enums, migrations, and assignment contracts must be approved and synchronized across the team.

Do not perform destructive migrations or seed production databases.

## 12. Required Tests

Every relevant implementation must verify:

- Unauthenticated requests return 401.
- Wrong-role requests return 403.
- SME cannot change operational statuses.
- Operator can receive eligible parcels.
- Operator cannot mark delivery completed through normal APIs.
- Rider cannot access unassigned parcels.
- Rider cannot access another Rider's assignments.
- Rider cannot deliver a parcel before assignment.
- Valid status transitions succeed.
- Invalid status transitions return 409.
- Terminal statuses cannot be changed.
- Concurrent updates do not corrupt order state.
- Status history records the authenticated actor.

## 13. API Documentation

Swagger/OpenAPI must reflect the implemented role permissions and state transitions.

Never document unimplemented endpoints as available.

When existing API behavior conflicts with this policy:

1. Report the conflict.
2. Identify the owning module.
3. Propose the smallest safe correction.
4. Coordinate with the responsible developer.
5. Update the implementation, tests, and documentation together.

## 14. Final Engineering Principle

Authentication establishes identity.

Role-based authorization determines which operations a user can perform.

Resource-level authorization determines which specific orders and assignments a user may access.

State-transition validation determines whether the requested operation is valid at the current stage of delivery.

All four checks are mandatory where applicable.
