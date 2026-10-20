# Rider invitations and role-based navigation

## Structure and ownership

- `app/(dashboard)/{seller,operator,rider}`: thin pages and protected layouts; Operator Rider Management is `/operator/riders`.
- `features/auth/role-routes.ts`: typed allowlist: SME -> `/seller`, OPERATOR -> `/operator`, RIDER -> `/rider`.
- `features/auth/components/{role-guard,dashboard-shell}.tsx`: loading, session verification, role redirect, navigation, profile information and existing logout.
- `features/riders/{schemas,api,hooks,components}`: invitation validation, typed API integration, mutation orchestration and shadcn form.
- `features/auth/hooks/use-activate-rider.ts` and `components/rider-activation-form.tsx`: activation lifecycle and password setup, composed by `/activate-rider`.
- `app/api/session/riders/invitations/route.ts`: fixed invitation operation within the existing HttpOnly session boundary.

Pages compose features; forms use React Hook Form and Zod; hooks orchestrate requests; API modules handle transport. No new dependencies or authentication systems are introduced. TanStack Query is not installed, so hooks follow the existing ref-lock/state convention.

## Session and authorization

Login and already-authenticated login visitors navigate using the backend profile role, never URL redirect parameters. The existing `/api/users/me` response has profile id, role, name and phone, not email; the frontend preserves that contract.

Existing HttpOnly, SameSite Strict cookies remain scoped to `/api/session`. Page requests cannot read these cookies, so layouts use the existing POST session verification mechanism rather than expanding cookie scope. Protected content stays hidden until verification completes for the current pathname. The guard revalidates on protected navigation, including after refresh, and provides retry UI for service outages. Zustand holds only ephemeral UI identity and status; no credentials or invitation tokens are persisted. A previously populated store does not bypass the guard's backend check.

The new fixed BFF operation uses the existing origin/content-type guards, backend profile lookup, refresh rotation, bounded body validation and error handling. It forwards a server-held bearer token only to `POST /api/riders/invitations`, rejects non-Operators and injected fields, validates and strips response data, and preserves rotated cookies on invitation errors. Express still enforces `requireAuth` and `requireRole("OPERATOR")`. Frontend guards provide navigation UX and must not be used to authorize future data endpoints. Never place protected backend data in unguarded page output.

## Invitation workflow

1. Sign in as an Operator and open Rider Management.
2. Enter email and an optional full name (maximum 120 characters).
3. `useInviteRider` calls `rider.api.ts`; blank names are omitted and role is never submitted.
4. The BFF forwards the authenticated request to Express. Successful invitations return a safe confirmation and reset the form.
5. Express sends a single-use, 24-hour activation link. Tokens are never exposed by invitation API responses.

The form prevents simultaneous submissions. Feedback distinguishes invalid input, expired session (401), forbidden role (403), duplicate account/invitation (409), rate limits (429), delivery failure and connection errors. Uncertain network outcomes prompt checking with the Rider before retrying.

## Activation workflow

The email links to `/activate-rider#token=...`. The hook reads exactly one correctly formatted fragment token and immediately removes the fragment with `history.replaceState`. It retains the token only in its mounted private link reader, never Zustand, localStorage or logs. The page supplies `no-referrer` metadata and disables indexing.

The form reuses the existing password schema (8-128 characters plus matching confirmation). `useActivateRider` submits `{ token, password }` to public `POST /api/riders/activate` through the existing public API client. Express determines the RIDER role. Invalid, expired, revoked and used invitations require a new link. Success clears the in-memory secret, shows feedback and redirects to `/login` after 2.5 seconds; the user may continue immediately. Activation does not create a session or sign out another currently authenticated account.

## Manual testing

Run the backend and frontend with their existing configuration. Set `APP_ORIGIN`, `EXPRESS_API_URL`, `NEXT_PUBLIC_API_BASE_URL`, the backend frontend origin and SMTP settings consistently. Apply the existing rider invitation migration before testing against a database. Use existing provisioning to obtain a verified Operator; public registration must not grant Operator privileges.

1. Sign in separately as SME, Operator and Rider; confirm the three dashboard destinations.
2. As Operator, invite a fresh email, verify optional name behavior and form reset; inspect the received email.
3. Submit invalid email, an existing account and a duplicate pending invitation. Check validation/conflict feedback. Throttle a request and confirm the button remains disabled while pending.
4. Open the received link. Confirm the fragment disappears, mismatched passwords fail locally and a matching password activates successfully and returns to Login.
5. Sign in with the new Rider credentials; confirm `/rider` and RIDER profile information.
6. Try used, expired, revoked, malformed and missing tokens. Confirm safe feedback and no automatic login.
7. Refresh each workspace; loading must precede workspace rendering. Visit other roles' routes and nested Operator routes, both signed in and signed out. Confirm redirects and no protected content flash.
8. Repeat invitation calls without authentication and with SME/Rider credentials against Express; expect 401/403. Try an injected role and cross-origin BFF submission; expect rejection.
9. Expire access credentials while retaining a valid refresh session; verify restoration and invitation retry, including conflict responses. Disconnect the backend and verify session retry UI.

## Automated verification and limits

Frontend tests cover login destinations, backend identity revalidation despite stale UI state, anonymous/role route restrictions, form validation, duplicate request locks, safe invitation payloads, token scrubbing, activation feedback and BFF authorization/output filtering. Existing backend rider tests exercise real Express controllers/middleware with in-memory repositories, including invitation -> activation behavior, expiry, role rules and quotas.

Production build, lint and TypeScript checks are available via npm scripts. Real SMTP delivery, live database migration/transactions and the complete browser/email/database workflow require the configured services and manual checks above. Dashboard shells intentionally do not implement parcel, warehouse, assignment or AI features. Removing the fragment means refreshing an unfinished activation page requires reopening the original email link. Current backend APIs do not support invitation listing, revocation or resend UI.
