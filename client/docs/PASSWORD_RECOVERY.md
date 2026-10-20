# Password recovery

Implemented October 20, 2026. No dependencies, backend behavior, database schemas or migrations were changed. Recovery uses the existing public Express endpoints directly, consistent with Register and Email Verification. Login sessions continue to use the approved BFF.

## Structure

- `app/(auth)/forgot-password/page.tsx` and `reset-password/page.tsx`: thin Server Components with shadcn Card layout, route metadata, no-index and no-referrer policy.
- `features/auth/components/forgot-password-form.tsx`: email field, React Hook Form, validation, confirmation, pending/error feedback and back-to-login link.
- `features/auth/components/reset-password-form.tsx`: new password/confirmation fields, independent visibility controls, invalid-link recovery, pending/error/success feedback and login navigation.
- `features/auth/hooks/use-forgot-password.ts`: request state, synchronous duplicate lock and 60-second resend cooldown.
- `features/auth/hooks/use-reset-password.ts`: private link capture, reset submission, terminal/retryable errors, stale-session cleanup and navigation.
- `features/auth/schemas/auth.schema.ts`: email and reset-password Zod schemas and inferred form types.
- `features/auth/types/auth.types.ts`: reset request contract.
- `features/auth/api/auth.api.ts`: typed recovery functions, runtime response validation and safe error translation.
- `login-form.tsx`: adds the **Forgot password?** link without changing login behavior.

Flow: Page → feature form → custom hook → API service → existing API client → Express. Form data belongs to React Hook Form. Recovery introduces no new Zustand store and stores no passwords or tokens in shared state.

## Forgot password

`/forgot-password` accepts a trimmed valid email up to 254 characters. It POSTs only `{ email }` to `/api/auth/forgot-password`, normally at `http://localhost:4000` (configured through `NEXT_PUBLIC_API_BASE_URL`). The browser sends no cookies to this public endpoint.

The real backend returns HTTP 200 with `{ success: true, data: { message: string } }` for known and unknown emails, including delivery failures intentionally suppressed to avoid account disclosure. The UI therefore uses conditional confirmation: **If an account exists for this email, a password reset link has been requested.** It does not promise delivery or reveal account existence. Check spam and wait at least a minute before requesting another email.

The form disables submission during requests and for 60 seconds after an accepted request. Backend limits remain authoritative: five email requests per 15 minutes (shared with verification resend) and 30 total auth requests per 15 minutes. The backend also enforces a one-minute issuance cooldown. Field errors and request failures preserve the email.

## Reset password

The existing Nodemailer email points to `/reset-password#token=…`. The token is a 43-character base64url value. Tokens expire after 15 minutes, are single-use, and a new token supersedes an old one.

On mounting, a component-local link reader captures exactly one valid fragment token. A `useSyncExternalStore` subscription supplies only loading/ready/invalid snapshots, allowing stable server/client hydration while keeping the secret private in a closure. The fragment is removed from the current history entry. StrictMode resubscription retains the captured token rather than rereading the cleaned URL. No token is rendered as an input, serialized into HTML or placed in Zustand, browser storage, analytics or logs. The server-rendered page shows a neutral loading message. Missing, malformed or duplicate token parameters display recovery instructions without making a reset request.

Password validation reuses the backend-aligned registration policy: 8–128 characters, untrimmed, with matching required confirmation. The API serializes only `{ token, newPassword }` to `POST /api/auth/reset-password`; confirmation is never sent. Both password visibility buttons have accessible names and pressed states. A synchronous hook lock blocks simultaneous submissions.

Successful responses use `{ success: true, data: { message: string } }`. Express atomically consumes the reset token, updates the password hash and revokes all sessions for that account. Resetting does not verify the email or create a login session.

After success the frontend clears current Zustand identity and calls the existing BFF logout endpoint to expire this browser's stale HttpOnly session cookies. This also signs out an existing different account in the same browser if applicable. Cookie cleanup failure does not turn a completed password reset into a reported failure; Login's normal restoration clears revoked cookies once reachable. The UI clears the form/token, displays success, offers **Continue to sign in**, and automatically replaces navigation with `/login` after 2.5 seconds. The new password must be entered at login. No automatic authentication occurs.

## Error handling

- Local Zod errors cover invalid email, password length and confirmation mismatch.
- HTTP 400 `VALIDATION_ERROR`: review the submitted fields.
- HTTP 400 `INVALID_RESET_TOKEN`: the link is expired, invalid, already used or replaced. The backend deliberately does not distinguish these cases. The frontend discards the token and links to `/forgot-password`.
- HTTP 429 `RATE_LIMITED`: wait 15 minutes before retrying.
- Offline/configuration errors: specific safe guidance.
- Network/timeout/server or malformed-response errors: confirmation is unavailable. For a reset, try the new password at login before retrying because the server may already have completed the change. The token and entered form values remain only in component memory for a retry.

The client never displays arbitrary backend error text. There are no automatic mutation retries. Reopening the original email link is necessary if the reset page is refreshed after its fragment is cleared; requesting another email invalidates the old link.

## Configuration and Windows cache workaround

Use the existing `.env.example` settings. Express `FRONTEND_URL` must point to the frontend origin used in email links, normally `http://localhost:3000`, and its CORS policy must allow that origin. SMTP and the database must be configured on Express.

The existing Windows EPERM failure on generated development manifests recurred during validation, and the old directory could not be renamed after stopping the frontend. `next.config.ts` now puts development output in the ignored `.next-local` directory. Production output remains `.next`. Next.js added matching type include paths to `tsconfig.json`. With the new directory, live recovery/login routes returned HTTP 200 without EPERM responses. No application data was removed and no antivirus settings were changed. The exact external lock owner was not identified.

## Checks and test coverage

Run from `client`:

```powershell
npm test
npm run build
npm run typecheck
npm run lint
```

`npm test` automatically builds the sibling Express server before importing its compiled integration fixtures. The suite has 72 passing tests; TypeScript, ESLint and the Next.js production build pass. Nine existing backend tests also pass.

`tests/password-recovery.test.tsx` tests email/password validation, known/unknown generic confirmation, loading/duplicate handling, cooldown, rate/network/server errors, missing/malformed/duplicate fragment parameters, StrictMode capture, SSR hydration, token privacy, password mismatch/visibility, exact request payload, success/session cleanup and manual/automatic login navigation.

`tests/session.integration.test.ts` also tests the real Express HTTP controllers and services for generic forgot-password responses, invalid/expired/used tokens, reset success, session revocation, old-password rejection and new-password login. Repositories and email delivery are fixture implementations in that test: no live database transactions or real SMTP delivery were exercised. Existing opt-in backend database tests require a separate `TEST_DATABASE_URL` and were not run against the development database.

Live smoke checks verified `/forgot-password`, `/reset-password` and `/login` return HTTP 200 and both recovery pages have no-referrer metadata. Browser visual/mobile checks and real-email delivery were not performed.

## Manual end-to-end test

1. Start Express on 4000 with SMTP/database configured and Next.js on 3000. Use a verified development test account and sign in once so session invalidation can be checked.
2. Open `/login`, select **Forgot password?**, and test blank/invalid email errors.
3. Submit the test account email. Expect generic confirmation; check inbox/spam. An unknown email should show the same confirmation. Do not deliberately exhaust live rate limits.
4. Open the latest reset email. Confirm the fragment disappears after capture and new-password fields appear. Try a short password and mismatched confirmation, then submit matching 8–128 character values.
5. Confirm success and navigation to `/login`. Sign in with the new password. The old password must fail; other sessions for the reset account must fail on their next authenticated request.
6. Reopen the used link: submission should offer a new reset request. Repeat with an expired/replaced link. A bare `/reset-password` should show missing-link recovery.
7. Check keyboard access to fields, toggles, submit and links. At mobile width check there is no horizontal overflow.
8. Use mocked tests for error/rate-limit cases, or stop Express to check recoverable connection feedback without exposing tokens in screenshots/logs.

Known limits: SMTP availability cannot be inferred from the generic forgot-password response; refresh after URL cleanup requires reopening the email; other tabs clear stale UI identity when they next check their session. The existing single-process BFF refresh coordination limit is unchanged. No additional authentication architecture was introduced.
