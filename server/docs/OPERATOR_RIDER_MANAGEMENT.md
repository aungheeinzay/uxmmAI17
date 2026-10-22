# Provider-scoped Rider Management

Implemented 22 October 2026. The existing `/operator/riders` page now provides
provider-scoped Rider/workload cards, searchable/filterable pagination, Rider details,
assigned parcels and history, pending invitations, and the existing invitation form.
All data comes from Express/PostgreSQL. This is workload reporting, not GPS tracking,
WebSocket presence, online/shift status, capacity management or physical availability.

## Membership and migration

Profile.providerId is reused for both OPERATOR and RIDER profiles. No new membership
table, role or provider catalog was introduced. The historical Prisma relation name
OperatorProvider is retained for compatibility even though it now includes Riders.

Migration `20261022040000_rider_provider_membership` was reviewed and applied to the
verified configured development Supabase PostgreSQL target:
`aws-0-ap-south-1.pooler.supabase.com`, database `postgres` (DIRECT_URL port 5432).
It replaces the Operator-only membership check with OPERATOR-or-RIDER, adds nullable
RiderInvitation.providerId with restrictive FK and an index, and changes no statuses.
No reset, truncation, business-data deletion, profile backfill or order rewrite.
Existing activated Riders and invitations remain valid with null providerId.

Invitation creation resolves the verified inviting Operator's provider from the
database in the reservation transaction. Missing membership returns 409. Provider
IDs are never accepted in invitation or assignment bodies. New invitations retain
their captured provider at activation even if the inviter later changes membership.
An expired/revoked invitation cannot be taken over by a different provider; legacy
unscoped records can be replaced only by their original inviter. Existing account
emails cannot be converted or have roles changed by an invitation.

Legacy unscoped pending invitations resolve provider membership at activation from
the original verified OPERATOR inviter's persisted profile. Without a valid inviter
membership they remain invalid for activation; no account is created. Successful
activation records the resolved provider on both invitation and new RIDER profile.
Legacy pending invitations are excluded from provider pending lists until scoped.
Activation still hashes the chosen password, confirms the invited email, atomically
consumes the token and creates no session. Bounded serialization retries preserve
single-account creation and invalid-token behavior for a concurrently consumed token.

## Existing Rider provisioning

Riders with null providerId are excluded from provider lists and assignment choices.
Their existing accounts and their own assigned-delivery access remain intact. During
the development inspection, **3 existing Rider profiles had no membership**. None
were assigned automatically; completed assignments were not used as membership proof.

After independently validating the exact Rider and correct existing Provider, run
from `server` against an explicitly approved development target:

```powershell
npm run rider:assign-provider -- --rider-id=<verified-existing-rider-uuid> --provider-id=<correct-existing-provider-uuid> --confirm-target=aws-0-ap-south-1.pooler.supabase.com:6543/postgres --allow-remote-development
```

This reuses the controlled provisioning guards: explicit development/test mode,
exact target identity, explicit remote-development authorization, exact UUIDs,
verified existing RIDER account and existing Provider. SME/OPERATOR profiles are
refused by the Rider command. Only the selected providerId changes; same-ID repeats
are safe and reassignment from another non-null provider is refused. No roles,
passwords, invitations, orders or assignments are rewritten. Production is refused.
No actual existing Rider provisioning was executed by this feature change.

## Workload rules and counting scope

| API workload | UI label | Rule |
| --- | --- | --- |
| AVAILABLE | No Active Tasks | No PICKED_UP/IN_TRANSIT/OUT_FOR_DELIVERY assignments |
| HAS_ASSIGNED_TASKS | Assigned / Waiting | At least one PICKED_UP and no in-progress delivery |
| DELIVERING | Delivering | At least one IN_TRANSIT or OUT_FOR_DELIVERY; takes precedence |

`assignedTaskCount` counts PICKED_UP. `inProgressDeliveryCount` counts IN_TRANSIT plus
OUT_FOR_DELIVERY. `activeAssignedTaskCount` is their sum. `completedDeliveryCount`
counts all-time DELIVERED assignments for this provider; it is not a date-window or
current-page metric. FAILED and CANCELLED are neither active nor delivered counts.
There is no additional capacity restriction for DELIVERING Riders.

All Rider records must belong to the Operator's persisted provider. Workload counts
and detail assignments additionally require the order.deliveryProviderId to match.
Historical cross-provider or legacy orders with unknown provider are excluded from
management counts/details; no records are deleted. Rider own-assignment access still
uses authenticated riderId, preserving historical delivery access.

List/search/workload filters apply in PostgreSQL before pagination. Three grouped
queries count page Rider tasks (pending, in-progress, delivered), avoiding per-Rider
queries. Overview uses four aggregate counts over provider-scoped predicates. Each
management response runs in a RepeatableRead transaction for a consistent snapshot.

## Express APIs

All management reads use requireAuth + requireRole("OPERATOR") and recheck persisted
role/provider membership. Authentication is the existing opaque Bearer access token.
Responses retain `{ "success": true, "data": ... }`. Errors retain
`{ "success": false, "error": { "code": "...", "message": "..." } }`.

| GET route | Result data |
| --- | --- |
| `/api/operator/riders` | `{ riders: ManagedRider[], pagination }` (extended existing route) |
| `/api/operator/riders/overview` | `{ totalRiders, available, assigned, delivering }` |
| `/api/operator/riders/invitations` | `{ invitations: PendingInvitation[], pagination }` |
| `/api/operator/riders/:riderId` | `{ rider: ManagedRider, assignments: RiderTask[], pagination }` |

List parameters: page (default 1, max 1000000), pageSize (default 20, max 100), search
(trimmed 1–120 characters, name/email/phone, case-insensitive), workload (one of the
three enum values), eligible (optional literal `true` for verified linked accounts).
The assignment dialog's existing BFF route now adds eligible=true so unverified or
accountless profiles are never offered for assignment. Dashboard default lists all
provider RIDER profiles and labels their account state separately.
Pending and detail routes accept page/pageSize only. Overview accepts no query fields.
Unknown filters, providerId overrides, malformed UUIDs and invalid bounds return 400.

Pagination is `{ page, pageSize, total, totalPages }`; empty results have totalPages=0.
Riders sort by fullName then id. Assignments sort newest assignedAt/id first. Pending
invitations sort newest createdAt/id first. Counts are independent of page size.

Example ManagedRider:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "fullName": "Example Rider",
  "email": "rider@example.test",
  "phone": null,
  "providerId": "770e8400-e29b-41d4-a716-446655440000",
  "provider": { "id": "770e8400-e29b-41d4-a716-446655440000", "name": "Flash Deliver" },
  "accountStatus": "ACTIVATED",
  "workload": "DELIVERING",
  "assignedTaskCount": 1,
  "inProgressDeliveryCount": 2,
  "activeAssignedTaskCount": 3,
  "completedDeliveryCount": 8
}
```

accountStatus is ACTIVATED (email verified), UNVERIFIED, or NO_ACCOUNT. Account email
and phone are returned only to authorized Operators in the same provider. Passwords,
session data, invitation token hashes and raw tokens are never selected for reads.
PendingInvitation contains only id, fullName, email, createdAt and expiresAt, and is
unaccepted/unrevoked/unexpired with a captured matching provider. Invitees have no
Rider profile yet and are never counted in Rider totals. Overview includes existing
unverified/accountless RIDER profiles, not unactivated invitations.

RiderTask contains assignment id/orderId/assignedAt and order `{ id, orderCode,
recipientName, township, destinationCity, status, statusEvents }`. Each order includes
its latest 20 recorded history entries (newest first), each with id, previousStatus,
status, note and createdAt. Assignment pagination includes all delivery statuses,
while the Rider workload summary counts the entire provider-scoped history.

## Assignment and invitation compatibility

POST `/api/riders/invitations` retains `{ email, fullName? }` and the existing email
and public activation flow. Provider is server-resolved. Unknown providerId/role
fields are rejected. POST `/api/riders/activate` retains `{ token, password }`.

POST `/api/operator/assignments` retains `{ orderId, riderId }`. The persisted
Operator, Rider and target Order must share a provider. Eligibility also requires a
verified RIDER account and a PICKED_UP SME-owned order without an existing assignment.
Unique orderId, Serializable transaction, trusted assignedById, unchanged status and
atomicity remain. Operator assignment reads are now similarly provider-scoped.
SME Order creation, price snapshots, Rider transition rules and Rider own-assignment
routes are unchanged. Existing general receiving/order/warehouse read scope is not
expanded or redesigned by this feature; the new scope covers Rider management and
Operator assignment operations.

## Errors

| Status/code | Meaning |
| --- | --- |
| 400 VALIDATION_ERROR / INVALID_JSON | Invalid UUID, filters, bounds, body or unsupported providerId |
| 401 UNAUTHORIZED | Missing/expired session |
| 403 FORBIDDEN | Wrong role or persisted Operator role changed |
| 409 PROVIDER_MEMBERSHIP_REQUIRED | Operator setup required; no invitation or assignment is made |
| 404 RIDER_NOT_FOUND | Rider is missing or outside provider |
| 404 RIDER_NOT_ELIGIBLE | Assignment Rider is unverified, unconfigured or another provider |
| 404 ORDER_NOT_FOUND | Assignment parcel is missing or another provider |
| 409 ORDER_NOT_RECEIVED / ASSIGNMENT_CONFLICT | Existing assignment/state race or non-received parcel |
| 409 RIDER_INVITATION_CONFLICT | Existing account, pending invite, foreign-provider invitation or concurrent invite conflict |
| 400 INVALID_INVITATION_TOKEN | Expired/revoked/consumed token or legacy inviter without valid membership |
| 503 EMAIL_DELIVERY_FAILED | Invitation revoked after email failure; safe retry remains available |

## Frontend and refresh

The dashboard uses a fixed HttpOnly-cookie BFF route POST
`/api/session/operator/rider-management`. Strict action=list accepts query and
invitationPage and combines list/overview/pending reads; action=detail accepts id/page.
The browser never supplies authorization provider IDs or handles access tokens.
The BFF validates response DTOs, strips extras and checks detail Rider IDs.
Existing assignment BFF routes remain compatible. Invitation success refreshes
Operator data and preserves success feedback. Assignment/delivery events, focus and
manual Refresh reload workload. Other sessions appear on the next refresh; there is
no polling or promise of real-time tracking.

The current shell/sidebar/branding are preserved. Loading, refreshing, empty provider,
no matching search/filter, backend error/retry and missing membership are distinct.
Missing membership hides the invitation form and displays the setup-required error.
Details show provider identity, contact information, delivered summary and paginated
parcels/history. No Rider account administration or provider selector was added.

## Verification and changed areas

Changed areas: schema/migration; rider invitation repository/service; new
`modules/riders/management` repository/service/controller/validation/OpenAPI; existing
assignment repository/service/router/OpenAPI; Swagger registration; controlled Rider
provisioning CLI and tests; `/operator/riders` page; new Rider management DTOs, API,
BFF adapter, UI and tests; existing invitation feedback and resource error mapping.
Unrelated pre-existing UI edits are preserved. No commit or push was made.

Tests and final counts are recorded after the last verification pass below.
Opt-in live database fixtures use unique IDs and clean up only their own records.
No real invitation emails are sent by tests (mail is intercepted).
