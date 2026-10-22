# Rider Profile Onboarding

Status: implemented. The additive migration is applied to the configured development database; no existing data was reset or deleted.

## Scope

This phase covers **Company Riders (Delivery Service Agent)** only. Riders continue to be created through the existing Operator invitation/activation flow and sign in with the existing email/password authentication. Freelance Transport Agent onboarding, NRC/licence uploads, identity verification, background checks, signatures, GPS tracking and new delivery statuses are out of scope.

Completion is **not** identity verification, driver certification or online availability. The UI must not show a "Verified Account" badge.

## Data model

`Profile` remains the single source of identity:

- `fullName`
- `phone`
- `role`
- `providerId` / `provider` (server-controlled delivery provider membership)
- `account.email` (read-only)

A new 1:1 `RiderProfile` stores only vehicle/onboarding data:

| Column | Required | Notes |
| --- | --- | --- |
| `vehicle_type` | Yes for completion | `MOTORCYCLE`, `BICYCLE`, `CAR`, `VAN`, `ON_FOOT` |
| `vehicle_plate_number` | Conditional | Required for `MOTORCYCLE`, `CAR`, `VAN`; trimmed and upper-cased |
| `vehicle_model` | No | Optional |
| `vehicle_color` | No | Optional |
| `completed_at` | Server-managed | First completion timestamp; cleared when a save makes the profile incomplete |

Profile photo is optional and is represented by initials in this phase. No object storage or upload contract exists yet.

### Migration

`server/prisma/migrations/20261022100000_rider_vehicle_profiles/migration.sql` is additive:

- creates the `VehicleType` enum;
- creates `rider_profiles` with a unique `profile_id` FK to `profiles` (`ON DELETE CASCADE`, `ON UPDATE CASCADE`);
- enables RLS and revokes direct `anon`/`authenticated` access, matching the repository convention for new tables;
- does not alter, reset or truncate existing profiles, orders or assignments.

The migration was applied with `prisma migrate deploy` after confirming the target. It is additive, does not alter existing profiles, orders or assignments, and does not mark any Rider complete; completion is evaluated from persisted data. `prisma format`, `prisma validate`, `prisma generate` and `prisma migrate status` pass.

## Completion rules

`profileComplete` is derived on the server and is `true` only when all of the following hold:

1. The authenticated account role is `RIDER`.
2. `Profile.fullName` is non-empty after trimming.
3. `Profile.phone` is non-empty after trimming and at most 32 characters (current project phone rule; no invented format restriction).
4. `RiderProfile.vehicleType` is selected.
5. A plate number is present for `MOTORCYCLE`, `CAR` or `VAN`. `BICYCLE` and `ON_FOOT` do not require one.
6. `Profile.providerId` is configured.

`vehicleModel`, `vehicleColor` and profile photo never affect completion.

`missingFields` uses these names: `fullName`, `phone`, `vehicleType`, `vehiclePlateNumber`, `provider`.

The backend ignores or rejects client values for `role`, `providerId`, `profileComplete`, `completedAt`, `profileId`, `id` and verification state. `completedAt` is written and cleared only by the service during a profile save; it is never reported for an incomplete profile.

## API contracts

Both endpoints require a Rider Bearer access token and `RIDER` role. Through the Next.js BFF the browser calls HttpOnly-cookie routes instead.

### `GET /api/rider/profile`

Returns the authenticated Rider's persisted profile, even while incomplete, so onboarding can continue. `Cache-Control: no-store`.

```json
{
  "success": true,
  "data": {
    "fullName": "Example Rider",
    "phone": "09xxxxxxxxx",
    "email": "rider@example.com",
    "provider": { "id": "provider-uuid", "name": "Example Delivery Provider" },
    "vehicle": { "type": "MOTORCYCLE", "plateNumber": "ABC-123", "model": null, "color": null },
    "profileComplete": true,
    "missingFields": [],
    "completedAt": "2026-10-22T03:00:00.000Z"
  }
}
```

Missing provider membership is represented as `"provider": null` and `"provider"` in `missingFields`; this is a visible setup-required state, not a redirect error.

### `PATCH /api/rider/profile`

Strict body. All three required fields must be sent; optional vehicle fields may be omitted or blank.

```json
{
  "fullName": "Example Rider",
  "phone": "09xxxxxxxxx",
  "vehicleType": "MOTORCYCLE",
  "vehiclePlateNumber": "ABC-123",
  "vehicleModel": "Honda Wave",
  "vehicleColor": "Blue"
}
```

The server trims inputs, normalizes plate whitespace/case, updates only `req.auth.id`, recomputes completion and returns the same shape as `GET`. `400 VALIDATION_ERROR` covers missing required values, an unsupported vehicle type or a motor vehicle without a plate. Unknown fields are rejected.

Errors use the existing envelope:

```json
{ "success": false, "error": { "code": "RIDER_PROFILE_INCOMPLETE", "message": "..." } }
```

### Swagger

The generated API docs are available at `/api/docs` (JSON at `/api/docs.json`). Rider operations are grouped under:

- **Riders** — Operator invitation and public activation.
- **Rider Profile** — authenticated `GET`/`PATCH`, with completed, incomplete and provider-setup response examples.
- **Rider Deliveries** — authenticated assignment list, detail and status transition, with `403` examples for `FORBIDDEN`, `RIDER_PROVIDER_MEMBERSHIP_REQUIRED` and `RIDER_PROFILE_INCOMPLETE`.

### BFF routes

- `POST /api/session/rider/profile` → `GET /api/rider/profile`
- `POST /api/session/rider/profile/update` → `PATCH /api/rider/profile`

Both reuse the existing HttpOnly session, origin/content-type checks and refresh rotation. Access tokens are never read by client JavaScript. The BFF preserves `RIDER_PROFILE_INCOMPLETE` and `RIDER_PROVIDER_MEMBERSHIP_REQUIRED` from Express.

## Delivery guard

`requireCompleteRiderProfile` runs **only** on:

- `GET /api/rider/assignments`
- `GET /api/rider/assignments/:id`
- `PATCH /api/rider/assignments/:id/status`

Behavior:

| State | Result |
| --- | --- |
| Rider profile complete | Request continues to the existing ownership/provider checks |
| Required fields missing | `403 RIDER_PROFILE_INCOMPLETE`, action message listing missing fields |
| Provider membership missing | `403 RIDER_PROVIDER_MEMBERSHIP_REQUIRED`, contact-Operator message |
| Profile READ/PATCH, auth session, logout | Not guarded and remain available |

The guard does not replace or weaken assignment ownership checks or the approved transition map:

- `PICKED_UP → IN_TRANSIT`
- `IN_TRANSIT → OUT_FOR_DELIVERY | FAILED`
- `OUT_FOR_DELIVERY → DELIVERED | FAILED`

No new status values were added.

## First-login flow

```text
Login succeeds
  -> GET current Rider profile through BFF
  -> profileComplete = true and provider present: /rider dashboard
  -> profileComplete = false and provider present: /rider/complete-profile
  -> provider = null: provider setup-required state, no redirect loop
  -> network/5xx: visible error + Retry, never treated as incomplete
```

The profile completion page is a separate route tree (`app/rider/complete-profile`) so the delivery gate never evaluates that page. This avoids `usePathname` and the dynamic-route/Suspense build issue. The gate runs in the `(dashboard)/rider` layout, so deep links to `/rider/assignments/[id]` are also protected.

`RoleGuard` continues to handle unauthenticated users (`/login`) and wrong roles (their own workspace). Profile save redirects only after the backend returns `profileComplete: true` with a provider.

## Mobile screen responsibilities

- **Complete Your Rider Profile** — initials avatar (optional photo), full name, phone, read-only email, read-only delivery provider, read-only service type "Delivery Service Agent", vehicle type, conditional plate, optional model/color, field errors, save/loaded/error states.
- **My Deliveries** — blue SURFERTrack header, Scan Parcel QR Code card, Active/Completed tabs, real assigned parcel cards with order code, recipient, address, status, assigned date and COD; loading, empty, error and refresh states.
- **Parcel details** — parcel code, recipient/contact, address/township, instructions, COD, current status, existing status history and backend-approved actions.
- **QR** — scanning and custody verification are not implemented. The card opens an honest "coming soon" dialog; it never claims a parcel was verified and manual navigation remains available.

## Manual verification

1. Confirm the target database and apply the migration only after approval.
2. Start Express and Next.js. Invite a Rider from an Operator linked to a delivery provider; activate and sign in.
3. Confirm the first login lands on `/rider/complete-profile`; the dashboard and delivery endpoints return `403 RIDER_PROFILE_INCOMPLETE`.
4. Save with a missing name, phone or vehicle type and confirm field errors.
5. Select `MOTORCYCLE`/`CAR`/`VAN` and confirm the plate is required; select `BICYCLE`/`ON_FOOT` and confirm it is not.
6. Save a valid profile and confirm redirect to `/rider`, real assigned data (no fabricated metrics) and Active/Completed filtering.
7. Remove the Rider's provider membership in a controlled test environment and confirm the setup-required state and `RIDER_PROVIDER_MEMBERSHIP_REQUIRED`, without redirect loops.
8. Open a delivery, run `PICKED_UP → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED`, and confirm history and disabled invalid actions. Test `FAILED` with the required reason.
9. Confirm login/logout/profile access still work for incomplete Riders, and that SME/Operator accounts cannot call Rider profile endpoints.
10. Open the QR card and confirm it states scanning is pending.

## Tests and known limitations

Verified locally:

- Server unit/HTTP tests: 111 passed, 0 failed, 7 skipped (database suites require a dedicated `TEST_DATABASE_URL` and confirmation variables).
- Client tests: 268 passed (includes Rider profile, gate, dashboard and existing delivery tests).
- `tsc`, Prisma validation/generation and production build results are recorded in the implementation report.

Known limitations:

- The migration is applied to the configured development database; deployment environments must run `prisma migrate deploy` as part of their normal release process.
- PostgreSQL constraint/concurrency tests remain skipped; in-memory doubles do not prove database behavior.
- Profile photo upload and identity documents are not implemented.
- QR scanning/custody verification is pending; the visual entry point is informational only.
- No new delivery statuses, Freelance onboarding, Admin dashboard or incident backend were added.
- A provider unlink performed outside the profile API is reflected as incomplete on GET; the stored timestamp is cleared on the next successful profile save.
