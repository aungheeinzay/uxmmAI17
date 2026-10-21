# ParcelOps AI Swagger API guide

Use this guide to test the Express backend through Swagger UI. All examples are illustrative; replace placeholder tokens and credentials locally. The API uses opaque access/refresh tokens, not JWTs or Supabase Auth.

## Start the backend and open Swagger

From the repository root:

```powershell
cd server
npm install
npm run dev
```

The current local backend port is `4000`, configured by `PORT` in `server/.env`.

| Resource | Local URL |
| --- | --- |
| Swagger UI | http://localhost:4000/api/docs |
| OpenAPI JSON | http://localhost:4000/api/docs.json |
| Health check | http://localhost:4000/health |

If `PORT` changes, use that port in these URLs. These are backend URLs; the Next.js frontend runs separately. Swagger sends requests to the backend serving the documentation.

Swagger is enabled by default outside production. `ENABLE_API_DOCS=true` explicitly enables it, including in production; `ENABLE_API_DOCS=false` disables it. Restart the backend after changing configuration.

Database access must be configured for database-backed operations. Email workflows also require `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, and the trusted `FRONTEND_URL`. Keep database and SMTP credentials in the server environment, never in Swagger request bodies.

## Send a request

1. Expand the endpoint under Authentication, Users, Orders, Operator, Riders, or Health.
2. Click **Try it out**.
3. Replace the example body with your test values. JSON keys and string values require double quotes; do not include comments or trailing commas.
4. Click **Execute**.
5. Read the HTTP status and response body under **Server response**. The listed example responses are documentation, not results from your request.

JSON bodies use `Content-Type: application/json`. Unknown body fields are rejected by validated endpoints. For example, public registration does not accept `role` or `isAdmin`.

## Authenticate in Swagger

All three roles sign in through `POST /api/auth/login`. Its response includes:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "<account-id>",
      "email": "<account-email>",
      "profile": { "role": "SME" }
    },
    "accessToken": "<access-token>",
    "refreshToken": "<refresh-token>",
    "tokenType": "bearer",
    "expiresIn": 900,
    "expiresAt": 0
  }
}
```

This abbreviated example omits profile fields; placeholders and `expiresAt: 0` are not usable credentials or actual expiry values.

Copy **`data.accessToken`**, click **Authorize**, paste only the token, and confirm authorization. Do not type `Bearer ` before it: Swagger adds that prefix automatically. Protected requests then carry `Authorization: Bearer <access-token>`.

Access tokens last 15 minutes. Refresh tokens last 30 days after issuance or rotation. Store them only in your private testing session. Swagger authorization is not persisted across reloads. Switching accounts requires replacing the authorized access token; calling login alone does not update Swagger's authorization.

| Role | How it is provisioned | Can invite Riders? |
| --- | --- | --- |
| SME | Public registration and email verification | No |
| OPERATOR | Trusted administrative provisioning outside public APIs | Yes |
| RIDER | Operator invitation and activation | No |

The current role comes from the database. Editing a JSON role field, frontend store, or custom role header cannot grant permissions.

## Endpoint reference

| Method | Endpoint | Authorization | Success |
| --- | --- | --- | --- |
| GET | `/health` | Public | 200; process is running |
| POST | `/api/auth/register` | Public | 201; verification required |
| POST | `/api/auth/verify-email` | Public; email token in body | 200; email verified |
| POST | `/api/auth/resend-verification` | Public | 200; generic acknowledgment |
| POST | `/api/auth/login` | Public | 200; access/refresh session |
| POST | `/api/auth/refresh` | Refresh token in body | 200; replacement session |
| POST | `/api/auth/logout` | Bearer access token | 200; current session revoked |
| POST | `/api/auth/forgot-password` | Public | 200; generic acknowledgment |
| POST | `/api/auth/reset-password` | Public; reset token in body | 200; password changed |
| GET | `/api/users/me` | Bearer access token | 200; own profile |
| PATCH | `/api/users/me` | Bearer access token | 200; updated own profile |
| POST | `/api/riders/invitations` | OPERATOR Bearer access token | 201; invitation sent |
| POST | `/api/riders/activate` | Public; invitation token in body | 200; Rider account activated |

### SME registration and email verification

Call `POST /api/auth/register` with an inbox you control:

```json
{ "email": "seller@example.com", "password": "example-password-only" }
```

Use your own test email and password. Registration always creates an SME and returns `confirmationRequired: true`, without session tokens. New passwords must contain 8 to 128 characters. Emails are trimmed and lowercased; passwords are not trimmed.

Open the verification email. The configured frontend link has this form:

```text
<FRONTEND_URL>/verify-email#token=<verification-token>
```

For API-only testing, copy the token after `#token=` locally and call `POST /api/auth/verify-email`:

```json
{ "token": "<verification-token-from-email>" }
```

Verification tokens are 43 base64url characters, expire after 15 minutes, and can be used once. Verification does not create a session. Sign in next.

To request another email, call `POST /api/auth/resend-verification`:

```json
{ "email": "seller@example.com" }
```

Wait at least 60 seconds between emails for the same account. A new issuance replaces the previous unused link. The acknowledgment is generic for unknown, already verified, cooling-down accounts, and delivery failures; a 200 does not prove delivery.

### Login, current profile, and profile changes

Call `POST /api/auth/login` with the verified account's email and password. Login accepts passwords of 1 to 128 characters to support existing credentials. Correct credentials for an unverified account return 403 `EMAIL_NOT_VERIFIED`.

Authorize using the returned access token. Execute `GET /api/users/me`. The profile is returned directly in `data`; check `data.role` for `SME`, `OPERATOR`, or `RIDER`.

Call `PATCH /api/users/me` to edit the signed-in account:

```json
{ "fullName": "Example Seller", "phone": "+959123456789" }
```

Supply at least one of `fullName` or `phone`. Use `null` to clear either field. Names are limited to 120 characters and phones to 32; non-null values cannot be empty after trimming. Role, email, and identity changes are rejected.

### Refresh and logout

Call `POST /api/auth/refresh` with the latest refresh token:

```json
{ "refreshToken": "<latest-refresh-token>" }
```

Refresh returns new access and refresh tokens. Both old tokens stop working. Save both replacements and update Swagger's **Authorize** value with the new access token. Avoid simultaneous refresh requests.

Call `POST /api/auth/logout` with a valid, unexpired access token. No request body is required. This revokes that session's access and refresh tokens; other login sessions remain active. Clear Swagger's saved authorization afterward. Removing Swagger authorization by itself does not revoke a server session.

### Password recovery

Call `POST /api/auth/forgot-password`:

```json
{ "email": "seller@example.com" }
```

The response is generic, including for unknown emails, cooldown, and delivery failures. If delivered, the email contains `<FRONTEND_URL>/reset-password#token=<reset-token>`.

Call `POST /api/auth/reset-password`:

```json
{ "token": "<reset-token-from-email>", "newPassword": "example-new-password-only" }
```

The reset token expires after 15 minutes and is single-use. The password must contain 8 to 128 characters. Success revokes every existing session for the account. It does not verify email or start a new session. Sign in again with the new password.

### Operator invites a Rider

Sign in with an existing verified OPERATOR account and replace Swagger authorization with that Operator's access token. There is no public Operator registration or role promotion endpoint.

Call `POST /api/riders/invitations`:

```json
{ "email": "rider@example.com", "fullName": "Rider One" }
```

`fullName` is optional. Do not submit a password or role. Expected response structure:

```json
{
  "success": true,
  "data": {
    "invitation": {
      "id": "<invitation-id>",
      "email": "rider@example.com",
      "expiresAt": "<ISO-8601-expiry>",
      "status": "pending"
    },
    "message": "Rider invitation sent."
  }
}
```

No account is created yet and no raw token is returned. Existing account emails of any role and duplicate pending invitations return 409 `RIDER_INVITATION_CONFLICT`. Expired or revoked invitations can be replaced by submitting another authorized invitation. Email failure returns 503 and revokes the undelivered token when database cleanup succeeds; retry invitation creation.

### Rider activation and login

The invitation email link has this form:

```text
<FRONTEND_URL>/activate-rider#token=<invitation-token>
```

The activation frontend page is not implemented in this backend milestone. Test through Swagger by taking the token from the email fragment and calling the public `POST /api/riders/activate` endpoint:

```json
{ "token": "<invitation-token-from-email>", "password": "example-rider-password-only" }
```

The Rider chooses the password; the Operator must not choose or distribute it. The token expires after 24 hours, must be 43 base64url characters, and is single-use. Activation creates a verified RIDER account and profile atomically. The successful response contains only a message and does not issue session tokens.

Log in through `/api/auth/login` with the activated Rider's credentials. Replace Swagger authorization with the Rider access token, then GET `/api/users/me` and confirm `data.role` is `RIDER`.

Confirm these negative cases:

| Test | Expected result |
| --- | --- |
| Create invitation without Bearer token | 401 `UNAUTHORIZED` |
| Create invitation with SME or RIDER token | 403 `FORBIDDEN` |
| Invite an existing SME, OPERATOR, or RIDER email | 409 `RIDER_INVITATION_CONFLICT`; role unchanged |
| Invite an email with a pending invitation | 409 `RIDER_INVITATION_CONFLICT` |
| Reuse an activated invitation | 400 `INVALID_INVITATION_TOKEN` |
| Use an expired, revoked, or unknown invitation | 400 `INVALID_INVITATION_TOKEN` |
| Submit `role` during registration or profile update | 400 `VALIDATION_ERROR` |

## Error responses and troubleshooting

Errors use this structure:

```json
{ "success": false, "error": { "code": "UNAUTHORIZED", "message": "Invalid or expired access token." } }
```

| Status / code | Meaning and next step |
| --- | --- |
| 400 `VALIDATION_ERROR` | Check required keys, unknown fields, token format, and field lengths. Placeholder token examples must be replaced. |
| 400 `INVALID_JSON` | Correct malformed JSON. |
| 400 `INVALID_VERIFICATION_TOKEN` | Verification link expired, was consumed, or was replaced. Request a new email if still unverified. |
| 400 `INVALID_RESET_TOKEN` | Reset link expired, was consumed, or was replaced. Request a new reset email. |
| 400 `INVALID_INVITATION_TOKEN` | Invitation is invalid, expired, revoked, or used. If already activated, sign in. |
| 401 `LOGIN_FAILED` | Credentials are invalid, or changed during login. |
| 401 `UNAUTHORIZED` | Authorize with a current access token. A refresh token cannot be used as Bearer authorization. |
| 401 `INVALID_REFRESH_TOKEN` | Refresh token expired, was revoked, or was replaced; sign in again. |
| 403 `EMAIL_NOT_VERIFIED` | Verify the account email before login. |
| 403 `FORBIDDEN` | Current role cannot perform this operation. For Rider invitations, sign in as an Operator. |
| 409 `REGISTRATION_FAILED` | Account email already exists; use login or recovery. |
| 409 `RIDER_INVITATION_CONFLICT` | Existing account or pending invitation; do not attempt automatic role conversion. |
| 404 `PROFILE_NOT_FOUND` | Authenticated account's profile was not found. |
| 404 `NOT_FOUND` | Check the backend URL and route path. Documentation routes may be disabled. |
| 429 `RATE_LIMITED` | Wait for the 15-minute window to reset; inspect rate-limit response headers. |
| 503 `EMAIL_DELIVERY_FAILED` | Check server SMTP settings. After failed registration, wait a minute and resend verification; after failed invitation, retry invitation creation. |
| 500 `INTERNAL_ERROR` | Backend/database failure; check server connectivity and migration state. It does not necessarily mean incorrect credentials. |

If Swagger cannot connect, check the backend process, `PORT`, and `/health`. The health endpoint confirms the process is running; it does not test PostgreSQL or SMTP. If a protected call fails after login, ensure Swagger authorization contains the latest access token for the intended account.

## Rate limits

| Scope | Limit per 15 minutes |
| --- | --- |
| All `/api/auth/*` requests, combined | 30 per IP |
| Resend verification and forgot password, combined | 5 per IP, also subject to the auth limit |
| Rider invitation requests | 30 per IP |
| Authenticated, authorized Operator invitation requests | 10 per Operator, also subject to the invitation IP limit |
| Rider activation requests | 20 per IP |

Verification and password reset issuance additionally enforce a 60-second cooldown per account and purpose. Rider invitations have no resend endpoint; duplicate pending invitations return 409. Failed requests also consume applicable request quotas. Limiters are in memory per server process.

## Related documents

- [Complete API reference](API_DOCUMENTATION.md)
- [RBAC and Rider invitations](RBAC_AND_RIDER_INVITATIONS.md)
- [Email verification](EMAIL_VERIFICATION.md)
- [Password recovery](PASSWORD_RESET.md)

The Express endpoints above return raw session tokens for direct API testing. The separate Next.js `/api/session/*` boundary uses HttpOnly cookies and a different response contract; it is not part of this Swagger document.
