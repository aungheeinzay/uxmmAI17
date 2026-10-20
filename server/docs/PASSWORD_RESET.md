# Forgot and reset password

## Request a reset

The frontend flow is login → `/forgot-password` → email link → `/reset-password`
→ backend password reset → login.

Send `POST /api/auth/forgot-password` with:

```json
{ "email": "seller@example.com" }
```

Existing, unknown and cooling-down accounts, and SMTP failures, receive the same
`200` response:

```json
{
  "success": true,
  "data": {
    "message": "If an account exists for this email, a password reset link has been sent."
  }
}
```

This endpoint supports both verified and unverified accounts. Resetting a password
does not verify an email; an unverified account must still complete verification.

## Email and frontend contract

Configure Nodemailer as described in [Email verification](EMAIL_VERIFICATION.md).
The email contains a ParcelOps AI reset button, plain-text link, 15-minute expiry
notice and a warning to ignore an unrequested reset. It never contains a password.

```text
https://your-frontend.example/reset-password#token=<token>
```

The frontend reads the fragment, removes it from the address bar, collects and
confirms a new password, then sends:

```json
{
  "token": "<43-character-base64url-token-from-email>",
  "newPassword": "example-new-password"
}
```

Use `POST /api/auth/reset-password`. Confirmation is checked by the frontend;
the backend contract accepts only `token` and `newPassword`. The password must
contain 8–128 characters. Unknown fields are rejected.

## Token and transaction behavior

Tokens are generated independently from sessions and verification tokens. Only
their SHA-256 hashes are stored. Each account has at most one reset token row.
Reissuing a token invalidates the old link, with a 60-second issuance cooldown.
The reset expiry is 15 minutes. Verification tokens cannot reset a password.

The backend derives the new password hash using the unchanged scrypt implementation.
Inside one database transaction it locks the account, consumes the unexpired token,
updates the password, invalidates reset tokens and deletes all account sessions.
Concurrent consumption can succeed only once. The reset does not issue a session.

Successful response:

```json
{
  "success": true,
  "data": { "message": "Password reset. Log in with your new password." }
}
```

Unknown, expired, replaced or consumed tokens return `400 INVALID_RESET_TOKEN`.
Malformed bodies or weak passwords return `400 VALIDATION_ERROR`. The old password
and all previous access/refresh tokens stop working after a successful reset.

## Security and delivery failures

Forgot-password and resend-verification share five requests per IP per 15 minutes,
plus the overall auth limit. Each purpose has a database-backed account cooldown.
SMTP failures invalidate only the failed token and return the generic response;
retry after one minute. Existing passwords and sessions remain unchanged until
a valid reset is consumed. No automatic mail retry queue is implemented.

Use HTTPS, trusted frontend URLs and pages without token analytics. Do not log
tokens, email bodies or passwords. Response bodies hide account existence, but
synchronous SMTP may produce timing differences. Reset emails are not sent during
automated tests; the transport is mocked.

## Manual checks

1. Verify an account and log in twice to create two sessions.
2. Request a reset using Postman and obtain the token from the email.
3. Submit the token and new password to `/api/auth/reset-password`.
4. Confirm both old access tokens and refresh tokens fail.
5. Confirm the old password fails and the new password logs in successfully.
6. Reuse the reset token: expect `400 INVALID_RESET_TOKEN`.
7. Test unknown email, cooldown, replaced links and expiry in a development database.

Frontend pages are documented here but are not implemented by this backend task.
