# Login and browser sessions

Implemented October 20, 2026, using the approved Next.js BFF design. Express remains the authority for credentials, verification, sessions and permissions. Existing register/resend/verify requests still go directly to Express.

## Files and responsibilities

- `app/(auth)/login/page.tsx`: server-rendered page composition and metadata.
- `features/auth/components/login-form.tsx`: shadcn UI, React Hook Form, field errors, password visibility and unverified-email resend form.
- `features/auth/hooks/use-login.ts`: submission lock, loading/error states, updating user state and fixed `/account` navigation.
- `features/auth/hooks/use-current-user.ts`: deduplicated restoration through the BFF and stale-result protection.
- `features/auth/hooks/use-logout.ts`: clears identity, revokes the server session and handles retryable logout failures.
- `features/auth/api/auth.api.ts`: typed browser login/current-user/logout functions and safe messages.
- `features/auth/schemas/auth.schema.ts`: login validation and trusted-profile response schema.
- `stores/auth.store.ts`: minimal, non-persisted Zustand user/status and a revision counter to ignore stale responses.
- `features/auth/server/express-auth.ts`: server-only HTTP transport and response validation for Express.
- `features/auth/server/session.ts`: origin/content-type guards, HttpOnly cookies, restoration, refresh coordination and logout.
- `app/api/session/{login,me,refresh,logout}/route.ts`: POST-only same-origin BFF endpoints. The default Node runtime is used; explicit runtime configuration conflicts with this project's Cache Components setting.
- `app/account/page.tsx`, `features/auth/components/account-panel.tsx`: temporary signed-in status and logout destination, without dashboard functionality.

## Configuration and deployment

Local defaults in `.env.example`:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
EXPRESS_API_URL=http://localhost:4000
APP_ORIGIN=http://localhost:3000
```

`EXPRESS_API_URL` is server-only. `APP_ORIGIN` must match the exact browser-facing frontend origin, including port. Production must use HTTPS with the correct public origin and a trusted HTTPS/private upstream deployment. Session cookies use Secure in production, so an HTTP production deployment cannot support these sessions. Cookies are host-only, with no cross-domain cookie requirement because browsers call Next.js at their own origin. Do not expose the BFF through arbitrary untrusted hosts. Restart Next.js after changing environment settings.

The current refresh coordinator supports **one long-running Next.js Node process**. Before deploying multiple replicas or serverless workers, replace it with reviewed shared coordination/session infrastructure. A process restart during a rotation race may require signing in again. In-memory coordination is not represented as distributed locking.

Express's current IP authentication rate limiter sees the BFF server's upstream IP, so the 30-per-15-minute budget is shared by proxied callers. Production needs a reviewed trusted-proxy/client-IP rate-limit deployment; this implementation does not spoof forwarding headers or change backend trust settings.

## API contracts and flow

1. The login form validates a trimmed valid email (maximum 254 characters) and required password (1–128 characters). Unlike registration, login does not impose a new minimum of eight on an existing password.
2. Browser `POST /api/session/login` submits `{ email, password }` as same-origin JSON. The BFF revalidates and calls Express `POST /api/auth/login`.
3. Express returns `{ success: true, data: { user: { id, email, profile }, accessToken, refreshToken, tokenType, expiresIn, expiresAt } }`. The BFF validates tokens and ID, then uses the access token to request `/api/users/me`, checking identity consistency.
4. Browser JSON receives only `{ success: true, data: { user: { id, role, fullName, phone } } }`. The current `/me` contract does not return account email; the store uses the authoritative profile fields instead of inventing an email field or another identity cookie.
5. Access and refresh tokens become host-only HttpOnly cookies, `parcelops_access` (up to 900 seconds) and `parcelops_refresh` (30 days), scoped to `/api/session`, with SameSite=Strict and Secure in production. Tokens and passwords never enter Zustand, localStorage, sessionStorage, public cookies, URL parameters or client-facing response JSON.
6. All roles currently navigate to the approved temporary `/account` page. Seller/operator/rider dashboards do not exist. No arbitrary return URL is accepted.

The store is for UI only; the `/account` HTML shell is public and contains no user data. Its client component requests the authenticated profile before rendering identity. Express enforces all authorization. No authenticated server-rendered content is cached in that shell.

## Restoration, rotation and logout

On mounting login or account UI, `useCurrentUser` calls `POST /api/session/me`. Restoration deduplicates simultaneous requests, clears stale user data while checking, and ignores responses invalidated by another account action. A valid access cookie calls Express `/api/users/me`; an absent/expired access cookie uses the refresh cookie to call `/api/auth/refresh`, validates the current profile, then updates both cookies. `POST /api/session/refresh` uses the same flow and rotates only when needed.

Concurrent refresh calls in one Node process share a promise keyed by a SHA-256 digest of the old refresh token. Successful results are retained for ten seconds so requests carrying pre-rotation cookies receive the same replacement. Entries are bounded and cleaned up. The current profile is still checked with Express before returning each result, including after logout. Rotation is not retried automatically after an ambiguous upstream network failure; a later invalid-session response signs the user out.

Unrecoverable 401 responses delete both cookies and clear UI identity. An upstream outage clears visible identity and offers retry rather than asserting that the credentials are wrong. Profile restoration happens on page mount/reload and explicit retry, not a background polling timer.

Logout calls the authenticated Express logout endpoint (refreshing first if access expired) and clears both cookies after confirmed revocation. Already invalid sessions are treated as signed out. If Express is unreachable, cookies are retained to allow revocation retry, visible user data is cleared, and the user sees a retry message. No authenticated API requests are issued directly by the browser.

## Security and errors

- Every BFF POST requires the configured exact Origin, JSON Content-Type and no `Sec-Fetch-Site: cross-site`. Requests with missing origins are rejected. Restoration is POST because it may rotate cookies.
- BFF responses use `Cache-Control: private, no-store`, `Pragma: no-cache` and `X-Content-Type-Options: nosniff`. Upstream requests use no-store and reject redirects.
- Invalid credentials produce a generic email/password message. `EMAIL_NOT_VERIFIED` offers the existing prefilled resend form. Validation, rate limiting, blocked requests and connectivity failures have separate feedback. Arbitrary backend error text is not displayed.
- State changes are not GET endpoints. Browser JSON never contains refresh or access tokens. Client roles cannot grant backend permissions.

## Testing and results

From the repository root, build the server first because integration tests import its compiled modules:

```powershell
npm --prefix server run build
npm --prefix client test
npm --prefix client run build
npm --prefix client run typecheck
npm --prefix client run lint
```

Stop the frontend dev process before production builds on Windows if generated manifests become locked. Avoid running typecheck while Next.js is regenerating route types. A frontend restart resolved the observed development EPERM failures during this task; an attempted cache-directory rename was denied and no cache removal was required.

Results: 53 frontend/integration tests pass, TypeScript and ESLint pass, and both Next.js and Express builds pass. Nine existing backend tests also pass. `tests/login.test.tsx` covers form validation, pending state, duplicate submission, errors, verification recovery, restoration, stale responses and logout. `tests/session.integration.test.ts` runs eight tests against a real ephemeral HTTP Express server with real controllers/services/password hashing/role middleware and in-memory repository fixtures. It verifies cookies, token non-disclosure, CSRF, invalid sessions, expired access, concurrent rotation, replay rejection, logout and role restrictions. No production account records, SMTP mail or database state are used by these tests.

Live smoke checks against the running frontend on port 3000 and Express on 4000: `/login`, `/account`, `/register`, `/verify-email` return 200; BFF restoration without cookies returns 401 `UNAUTHORIZED`; an intentionally nonexistent login returns 401 `LOGIN_FAILED`; sensitive responses carry private/no-store headers. A successful sign-in using an existing live database account was not tested because no test credentials were supplied. Mobile/browser visual checks were not performed.

## Manual verification

1. Start Express on 4000 and Next.js dev on 3000. Use a verified test account created through register/verify.
2. Open `/login`. Try blank fields, invalid email and wrong password, then the valid credentials. Expect `/account` with the trusted role.
3. Inspect Network: browser requests target `/api/session/*`; response JSON has only profile data. In Application/Cookies, confirm HttpOnly, SameSite and path; no tokens should appear in local/session storage or Zustand.
4. Reload `/account`: identity should restore. Delete only the access cookie and reload: the server should rotate the refresh token and replace both cookies. Do not copy tokens into URLs or logs.
5. Sign out, then reload `/account`: it should redirect to `/login`. Old tokens must no longer authenticate.
6. Use an unverified account: login should show a prefilled **Send verification link** form. Use a new verification email and sign in again.
7. Stop Express and try login/restoration/logout: expect connection/retry feedback. Restart Express and retry.
8. Check at mobile and desktop widths and navigate labels, inputs, toggle and submit with the keyboard.

Known limits: no dashboards, password recovery UI or distributed refresh coordination. Existing dependency audit findings in shadcn/ESLint chains remain outside this feature. Existing backend rules referencing Supabase Auth predate its custom opaque-token implementation; this feature follows the actual custom-auth contracts and the approved task instructions.
