# Email verification

## Flow and frontend contract

Register → verification-pending page → email link → `/verify-email` frontend page
→ `POST /api/auth/verify-email` → login.

Registration returns `201`:

```json
{
  "success": true,
  "data": {
    "confirmationRequired": true,
    "message": "Check your email to verify your account before logging in."
  }
}
```

No application session is issued. Show a pending page with a resend action.
Email links use the configured frontend origin and this shape:

```text
https://your-frontend.example/verify-email#token=<token>
```

The token is in the URL fragment, keeping it out of HTTP request URLs and Referer
headers. The frontend reads it with `new URLSearchParams(location.hash.slice(1))`,
removes it with `history.replaceState`, and submits `{ "token": "..." }` as JSON.
Do not send the fragment to analytics or load third-party scripts on token pages.
Frontend pages are not included in this backend implementation.

## Token lifecycle

Tokens contain 32 cryptographically random bytes, encoded as 43 base64url characters.
Only a SHA-256 hash is stored. Links expire 15 minutes after issue. Verification
atomically consumes the token and updates `emailVerifiedAt`. Expired, unknown and
reused tokens return `400 INVALID_VERIFICATION_TOKEN`; malformed bodies return
`400 VALIDATION_ERROR`.

The success response contains `data.message: "Email verified. You can now log in."`.
Verification never automatically logs the user in.

## Resend

Send `POST /api/auth/resend-verification` with `{ "email": "seller@example.com" }`.
The response is always a generic `200` for unknown, verified, cooling-down accounts
and SMTP delivery failures:

```json
{
  "success": true,
  "data": {
    "message": "If this email belongs to an unverified account, a verification link has been sent."
  }
}
```

One token row per account prevents duplicate active tokens. A new issuance replaces
the previous token. A database-backed 60-second cooldown prevents concurrent resends.
Resend and forgot-password also share five requests per IP per 15 minutes, in
addition to the overall auth limit of 30 per IP per 15 minutes.

## SMTP setup

Add real values to your untracked `server/.env`:

```dotenv
FRONTEND_URL=http://localhost:3001
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=sender@example.com
SMTP_PASSWORD=YOUR_GMAIL_APP_PASSWORD
SMTP_FROM=sender@example.com
```

For Gmail use an App Password, never a normal Gmail password. Use an authorized
sender address. `SMTP_FROM` must be an email address without a display-name wrapper.
Port 465 uses TLS immediately; other ports require STARTTLS. Certificate checks
remain enabled. Use an HTTPS FRONTEND_URL in production. Links always use this
trusted configuration, never request Host headers.

SMTP settings may be omitted to allow non-email routes to start. Missing settings
cause delivery failure when an email is requested. Invalid configured values fail
Zod validation. Restart the backend after changing environment variables.

`config/mail.ts` provides a reusable transport. `lib/email/email.service.ts` builds
trusted links and sends messages; `email.templates.ts` produces simple ParcelOps AI
HTML and plain-text alternatives with action, expiry, and security notices.

On delivery failure, the token is expired without clearing its cooldown. Registration
returns a generic `503 EMAIL_DELIVERY_FAILED`; resend hides delivery failures behind
the generic response. The account remains recoverable by resending after one minute.
There is no automatic retry queue.

## Manual checks

1. Configure SMTP and a frontend verification page, migrate and start the backend.
2. Register a new email in Postman. Confirm no access/refresh tokens are returned.
3. Try login: correct credentials return `403 EMAIL_NOT_VERIFIED`.
4. Obtain the token from the received email. POST it to `/api/auth/verify-email`.
5. Login again: it returns the existing application session format.
6. Reuse the verification token: it returns `400 INVALID_VERIFICATION_TOKEN`.
7. Test resend on another pending account after 60 seconds. Its previous link fails.
8. A token older than 15 minutes fails. Do not modify production rows for this check.
