# SME registration

## Structure and responsibilities

- `app/(auth)/register/page.tsx`: Server Component with metadata, responsive layout and the registration form.
- `features/auth/components/register-form.tsx`: shadcn UI, React Hook Form, accessible field errors and independent password visibility toggles.
- `features/auth/hooks/use-register.ts`: pending/success/error state, a synchronous ref lock against duplicate submissions, safe error feedback and navigation.
- `features/auth/schemas/auth.schema.ts`: Zod form validation and inferred form type.
- `features/auth/api/auth.api.ts`: typed registration request, runtime response validation and registration error messages.
- `features/auth/types/auth.types.ts`: request/response contracts.
- `lib/api-client.ts`: validated API base URL, JSON transport, timeout and HTTP error parsing.
- `app/(auth)/verification-pending/page.tsx`: check-inbox destination with an email-only resend form.
- `features/auth/components/resend-verification-form.tsx`: email validation, request button, pending/error feedback and cooldown display. Also appears below registration after duplicate-email or delivery-failure errors, prefilled with the submitted email.
- `features/auth/hooks/use-resend-verification.ts`: resend request state, duplicate-request lock and a 60-second cooldown after an accepted request.

Flow: page → form → useRegister → API service → API client → Express. No session or token is created or persisted by the frontend. Form values stay in React Hook Form and are preserved after errors. Successful registration keeps submissions locked while navigating with `router.replace`.

## Configuration

The default API origin is `http://localhost:4000`. To override it, set `NEXT_PUBLIC_API_BASE_URL` in `client/.env.local` and restart Next.js (rebuild for production). `.env.example` shows the setting. Only HTTP(S) URLs without credentials, query strings or fragments are accepted.

Requests go directly from the browser to Express; there is no Next.js proxy. Express CORS now allows the origin configured in `server/.env` as `FRONTEND_URL`, including OPTIONS preflight and Content-Type/Authorization headers. Set `FRONTEND_URL=http://localhost:3000` for the usual local frontend and restart Express after configuration changes. No cookies are sent. On another device, localhost refers to that device; configure a reachable backend URL and matching frontend origin.

## Validation and API contract

Email is trimmed, must be valid and at most 254 characters. Password must be 8–128 characters, matching `server/src/modules/auth/auth.validation.ts`; no invented complexity requirements. Confirmation is required and must match. Passwords are not trimmed.

`POST http://localhost:4000/api/auth/register`, JSON:

```json
{ "email": "seller@example.com", "password": "SecurePassword123!" }
```

Only these two fields are serialized. The backend assigns SME; the frontend sends no role, confirmation or verification flags.

Expected HTTP 201:

```json
{
  "success": true,
  "data": {
    "confirmationRequired": true,
    "message": "Check your email to verify your account before logging in."
  }
}
```

Only a validated confirmation-required response navigates to `/verification-pending`. No sensitive data appears in the URL. Express/Nodemailer owns email delivery.

Errors use `{ "success": false, "error": { "code": "...", "message": "..." } }`. The frontend parses status/code and displays its own safe messages rather than arbitrary server text:

- 400 `VALIDATION_ERROR`: review email/password.
- 409 `REGISTRATION_FAILED`: email already registered; use another email or check the earlier verification message. Other 409 codes receive a generic conflict message. This matches the current backend duplicate-account branch without changing its contract.
- 429 `RATE_LIMITED`: wait 15 minutes (current server limit: 30 auth requests per 15 minutes).
- 503 `EMAIL_DELIVERY_FAILED`: account already created; the UI offers the email-only resend form. The backend supports `POST /api/auth/resend-verification` with `{ "email": "..." }`; wait at least a minute before requesting another link.
- Other 5xx, invalid/non-JSON success: registration service temporarily unavailable; check inbox before retrying.
- Network/CORS: unable to connect; check inbox before retrying if previously submitted. Browsers do not expose enough detail to reliably distinguish CORS from a stopped server in fetch errors.
- 30-second timeout: server took too long; check inbox before retrying. Offline browser status and invalid API configuration have separate messages. No automatic retry.

## Verification

From `client`, run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

`tests/register.test.tsx` uses Vitest, jsdom and Testing Library with mocked fetch/navigation. It checks empty/invalid input, password boundaries and mismatch, exact request fields, error statuses, mail failure semantics, malformed responses, network failure, retained values, pending disabled state, duplicate submission locking, successful navigation, keyboard focus and visibility toggles. No real accounts or emails are created by automated tests.

Manual test:

1. Start the configured Express server on port 4000 with database/migrations and SMTP ready. Configure its CORS policy for the frontend origin.
2. Run `npm run dev` in `client`; open `http://localhost:3000/register`.
3. Submit blank fields, an invalid email, a short password and mismatched confirmation. Check field feedback and keyboard focus.
4. Use a fresh real email and matching 8–128 character password. Check the pending state and Network tab: one POST containing only email/password.
5. Confirm HTTP 201 leads to `/verification-pending`, then check the delivered email.
6. Repeat with the same email to check conflict feedback. Disconnect the API to check network feedback and retained values. Use mocked tests for rate limits and delivery failures rather than deliberately exhausting the live service.
7. At 375px and desktop widths, check for horizontal overflow, readable text, usable toggles and submit controls. Tab through all fields and buttons; activate toggles with Space and submit with Enter.

## Limits

Login is now implemented separately; see `LOGIN_FEATURE.md` for its approved BFF session design. The pending page does not verify the visitor's registration status. CORS configuration, live SMTP delivery and database availability are backend prerequisites. Registration itself still does not create a session.

## Email link destination

`/verify-email` now renders `VerifyEmailPanel` using `useVerifyEmail`. Selecting **Verify my email** reads the token from the email URL fragment and POSTs only `{ token }` to `/api/auth/verify-email`. The fragment is removed from the current history entry on submission; retryable tokens are kept only in component memory. No session is created. Successful verification displays confirmation and a link to `/login`. Missing/invalid/expired/used tokens offer resend recovery; connection failures allow retry. Refreshing after the fragment has been cleared requires reopening the original email link. Four mocked tests cover success, StrictMode/duplicate submission, missing/expired tokens and network retry.

The Windows EPERM rename failure involved generated `.next/dev` manifests. The frontend development processes were stopped, and that cache was renamed to `.next/dev-backup-verification` before restarting. `/verify-email` returned HTTP 200 afterward. The exact external lock owner was not determined; if it recurs, check for concurrent Next.js processes or antivirus/indexer locks on the generated cache.

## Returning unverified users

Submitting registration for an existing email still returns 409; the frontend then displays a prefilled resend form. The user explicitly selects **Send verification link**. They may also open `/verification-pending` and enter their registered email without a password. No new account is created and the original password is unchanged.

The resend endpoint returns `{ "success": true, "data": { "message": "..." } }`. It deliberately does not disclose whether an account exists, is verified, is within cooldown, or encountered SMTP failure. The UI therefore confirms the request conditionally rather than guaranteeing delivery. Verified accounts receive no new link. The backend limits email requests to five per 15 minutes and token creation to once a minute; the UI also disables resend for 60 seconds after an accepted request. Newly issued links replace older tokens and expire after 15 minutes.

Recovery checks: all 31 frontend tests, TypeScript, ESLint and production build pass. Added tests cover duplicate-email resend with prefilled email, email-only payload, cooldown, delivery-failure recovery, input validation and rate-limit feedback. No live email was sent during testing.

## Implementation check results

Initial implementation checks on October 20, 2026 passed: mocked tests, TypeScript, ESLint and the Next.js production build. Tests now also cover server-rendered hydration, specific error messages, timeouts and invalid API configuration. Backend `tests/cors.test.cjs` checks registration preflight, readable validation responses and origin restrictions. Live registration/SMTP delivery and visual mobile/desktop browser checks were not performed. Keyboard focus and password toggle activation were tested in jsdom. `npm audit` reports nine high-severity findings in existing shadcn/ESLint dependency chains; resolving them requires separate dependency maintenance. The added test tooling uses Vitest 5 and Node 24 types, matching the installed Node 24 runtime.
