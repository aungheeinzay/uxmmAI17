# Delivery workflow integration — Phase 3B

## No eligible Rider edge case (2026-10-22)

Eligibility still means a RIDER profile with a linked email-verified account. It does not imply online presence, idle capacity, working hours or geographical availability. Existing GET `/api/operator/riders` and POST `/api/operator/assignments` contracts are reused through their existing cookie BFF routes; no new endpoint, schema or migration is needed.

The existing assignment dialog now distinguishes:

- Loading: loading indicator, disabled confirmation, no empty-state claim.
- Failed Rider lookup: safe error and retry, no empty-state claim.
- Empty successful result with total 0: **No riders available for assignment**, explaining that no eligible riders were found and the parcel remains unassigned with status PICKED_UP. Confirmation is disabled. **Refresh Riders** reloads page 1; **Rider Management** links to the existing invitation/activation workflow.
- An empty later page with a nonzero total: page-specific guidance instead of claiming there are no eligible Riders anywhere.
- Riders exist but none is selected: **Please select a rider**; submitting shows validation feedback and sends no assignment request.
- Selected Rider becomes ineligible: the existing 404 RIDER_NOT_ELIGIBLE code is preserved by the transport allowlist and translated to the backend's safe validation text, **An activated Rider account was not found.** The selection is cleared and eligible Riders reload. No success notice or optimistic assignment occurs.

Manual refresh and pagination clear stale selections. Submission also checks that the selected ID is in the current loaded eligible list. Backend eligibility remains authoritative and is rechecked transactionally; unsuccessful assignment leaves status PICKED_UP and creates no RiderAssignment, so the warehouse state stays UNASSIGNED. Operators may retry later.

Changed implementation files: `features/deliveries/components/assign-parcel-dialog.tsx`, `hooks/use-deliveries.ts`, `api/deliveries.api.ts`, and the known-code allowlist in `features/auth/server/express-auth.ts`. Authentication, cookie rotation, role checks and backend assignment business rules are unchanged. Tests are in `tests/no-eligible-riders.test.tsx`, `rider-eligibility-error.test.ts`, and expanded backend assignment/workflow tests. Swagger is unchanged because the backend contract is unchanged.

Verification for this update: frontend suite **229 passed across 18 files**; backend default suite **72 passed, 4 opt-in database suites skipped**. UI tests verify empty/loading/error states, no request without selection, refresh/retry recovery, successful later assignment, backend validation feedback and an unchanged UNASSIGNED warehouse row. Backend tests explicitly assert no assignment/status/history mutation after missing/ineligible Rider input and successful retry once eligible. The actual transport/BFF is tested for safe eligibility-code preservation without raw server-message exposure.

The separately enabled live database workflow test also **passed** on the previously confirmed development target. It now attempts missing selection and assignment to a new unverified Rider fixture, verifies 400/404 respectively, confirms zero assignment rows and unchanged PICKED_UP status, rechecks the real UNASSIGNED warehouse query, and then completes a successful assignment/delivery. Only fixtures allocated by that invocation were cleaned up. TypeScript, ESLint (no warnings), production build and diff checks passed. No browser-driven E2E was performed.

## Screens

- `/operator/assignments`: received parcels filtered by `status=PICKED_UP&unassigned=true`. Each parcel opens a Rider selection and explicit confirmation dialog. Eligible Riders are server-paginated. Assignment sends only orderId/riderId; the API response supplies the actual status, which remains PICKED_UP. Duplicate/conflicting assignments refresh the parcel list and retain useful feedback.
- `/operator/monitoring`: server-paginated assignments with parcel code, assigned Rider, actual current status and assignment timestamp. Details link to existing Operator parcel details showing Rider metadata and ordered status history. Back navigation returns to monitoring.
- `/rider`: the authenticated Rider's assignments, including completed deliveries. Cards include recipient/address, COD, status, assignment timestamp and details navigation.
- `/rider/assignments/:id`: recipient phone/address, instructions, exact COD string, status/history, and supported delivery actions. Confirmation is required. FAILED requires a trimmed 3–1000 character reason. Terminal/unsupported statuses offer no actions. Pending controls disable submission/cancellation; synchronous mutation locks prevent duplicate requests.

PICKED_UP → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED; failure is allowed only from IN_TRANSIT/OUT_FOR_DELIVERY. Backend rules remain authoritative.

## Architecture and contracts

Pages compose `features/deliveries/components`; hooks own fetching/mutations; typed services use the existing `postSessionJson`; fixed BFF handlers reuse `withAuthenticatedSession` and `expressAuth`. No new API client, auth implementation, dependencies or persistent sensitive state were added. React Hook Form/Zod validate selection and failure forms. Existing shadcn-style Dialog/Button/Label components are reused.

Browser POST BFF routes: operator/riders, operator/assignments, operator/assignments/create, rider/assignments, rider/assignments/detail, rider/assignments/status under `/api/session/`. Request bodies and Express contracts are listed in `server/docs/RIDER_DELIVERY_API.md`; Swagger documents Express routes at `/api/docs`. All list BFF requests use `{ page, pageSize }`; detail uses `{ id }`; create uses `{ orderId, riderId }`; status uses `{ id, status, note? }`.

Lists contain `assignments` or `riders` plus `{ page, pageSize, total, totalPages }`. Assignment detail adds `order.statusEvents`; status mutation adds top-level previousStatus. COD is a decimal string. Dates display in Myanmar time using existing helpers. Ownership is verified by Express queries and additionally checked on Rider BFF responses. Backend status values are displayed from real responses.

Operator/Rider layouts retain existing RoleGuard protection. BFF independently rejects wrong roles and strict input overrides; no client riderId establishes Rider identity. Cookies/Bearer credentials remain server-managed. 401 clears stale identity; 403, 404, 409, 429, network and service errors show safe feedback. 500/503 preserve valid sessions. A 409 refetches relevant data; no automatic mutation retry is performed.

Successful mutations notify mounted delivery and Operator parcel resources. Fresh navigation always fetches server data. Window focus and explicit refresh update monitoring after another user/tab changes delivery status. No fabricated availability, GPS, maps or statistics are shown.

## Verification and migration

- Frontend: 191 tests passed across 14 files; TypeScript, ESLint and production build passed.
- Backend: 61 passed, 4 database suites skipped by default. Separately enabled live delivery-workflow test passed against the explicitly confirmed Supabase development database, including creation through completion, ownership, uniqueness, concurrency, rollback/history and SME cancellation.
- Migration `20261021130000_rider_assignments` was applied only after the user's explicit target confirmation. All 10 migrations are up to date. No pre-existing records were deleted; only live-test fixtures were removed.
- SME operational status privileges were corrected to match `server/PERMISSIONS.md`: only own CREATED cancellation remains allowed. No SME UI rewrite was made.

No browser-driven end-to-end or visual QA was performed. UI interaction tests use mocked HTTP; the live workflow test verifies real Express/Prisma/PostgreSQL behavior. List pagination is local to each screen and resets on a fresh visit. Monitoring uses focus/manual refresh, not live push. No reassignment is supported. No commit or push was made.
