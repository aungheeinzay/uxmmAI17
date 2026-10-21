# ParcelOps AI API reference

Use the backend port configured by `PORT` in `server/.env` (currently `4000` locally).
Local base URL: `http://localhost:4000`. Bodies use `Content-Type: application/json`.

For step-by-step Swagger instructions, see [Swagger API guide](SWAGGER_API_GUIDE.md).

Swagger UI: `/api/docs`. OpenAPI JSON: `/api/docs.json`. Both are enabled outside
production by default; set `ENABLE_API_DOCS=true` to explicitly enable production docs.
Click Authorize and paste only the opaque access token, without a Bearer prefix.

## Endpoints

| Method | Path | Body | Authentication | Success |
| --- | --- | --- | --- | --- |
| POST | `/api/auth/register` | `{ "email": "seller@example.com", "password": "example-password" }` | Public | 201; confirmation required, no tokens |
| POST | `/api/auth/login` | Same credential fields | Public | 200; session |
| POST | `/api/auth/verify-email` | `{ "token": "<email-token>" }` | Public | 200; verified message |
| POST | `/api/auth/resend-verification` | `{ "email": "seller@example.com" }` | Public | 200; generic message |
| POST | `/api/auth/forgot-password` | `{ "email": "seller@example.com" }` | Public | 200; generic message |
| POST | `/api/auth/reset-password` | `{ "token": "<reset-token>", "newPassword": "example-new-password" }` | Public | 200; password reset message |
| POST | `/api/auth/refresh` | `{ "refreshToken": "<refresh-token>" }` | Refresh credential in body | 200; replacement session |
| POST | `/api/auth/logout` | None | Bearer access token | 200; session ended message |
| GET | `/api/users/me` | None | Bearer access token | 200; profile |
| PATCH | `/api/users/me` | `{ "fullName": "Example User", "phone": "+959123456789" }` | Bearer access token | 200; updated profile |
| POST | `/api/riders/invitations` | `{ "email": "rider@example.com", "fullName": "Rider One" }` | OPERATOR Bearer access token | 201; pending invitation, no raw token |
| POST | `/api/riders/activate` | `{ "token": "<invitation-token>", "password": "<chosen-password>" }` | Public, invitation token required | 200; activated message, no session |
| GET | `/health` | None | Public | 200; `{ "status": "ok" }` |

Public does not mean unrestricted: auth endpoints are rate limited. All POST bodies
use strict Zod schemas and reject unknown fields. Email is trimmed, lowercased and
limited to 254 characters. New passwords are 8–128 characters; login accepts 1–128.
Passwords are not trimmed. Email verification/reset tokens are 43 base64url characters.
Refresh tokens accept 1–8192 characters. Profile updates require at least one known
field; name and phone are nullable, with non-null lengths 1–120 and 1–32 respectively.

## Response contracts

Registration returns no session:

```json
{
  "success": true,
  "data": {
    "confirmationRequired": true,
    "message": "Check your email to verify your account before logging in."
  }
}
```

Login and refresh return:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "seller@example.com",
      "profile": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "fullName": null,
        "phone": null,
        "role": "SME",
        "createdAt": "2026-10-20T00:00:00.000Z",
        "updatedAt": "2026-10-20T00:00:00.000Z"
      }
    },
    "accessToken": "EXAMPLE_ACCESS_TOKEN",
    "refreshToken": "EXAMPLE_REFRESH_TOKEN",
    "tokenType": "bearer",
    "expiresIn": 900,
    "expiresAt": 1792455300
  }
}
```

The tokens and timestamps above are illustrative. Profile endpoints return the
profile directly as `data`. Message endpoints return `{ "success": true, "data":
{ "message": "..." } }`. Exact verification/reset messages and generic public-email
responses are documented in [verification](EMAIL_VERIFICATION.md) and
[password reset](PASSWORD_RESET.md). Logout's message is `Session ended.`.

Error envelope:

```json
{ "success": false, "error": { "code": "EMAIL_NOT_VERIFIED", "message": "Verify your email before logging in." } }
```

| Status/code | Applies to |
| --- | --- |
| 400 `VALIDATION_ERROR` | Invalid body fields on body-accepting endpoints |
| 400 `INVALID_JSON` | Malformed JSON |
| 400 `INVALID_VERIFICATION_TOKEN` | Invalid, expired or used verification token |
| 400 `INVALID_RESET_TOKEN` | Invalid, expired or used reset token |
| 400 `INVALID_INVITATION_TOKEN` | Invalid, expired, revoked or used Rider invitation |
| 401 `LOGIN_FAILED` | Invalid credentials, or credentials changed during login |
| 401 `UNAUTHORIZED` | Protected route lacks a valid token or account is unverified |
| 401 `INVALID_REFRESH_TOKEN` | Invalid/revoked/expired refresh token or unverified account |
| 403 `EMAIL_NOT_VERIFIED` | Login with correct credentials before verification |
| 403 `FORBIDDEN` | Non-Operator attempts to invite a Rider |
| 409 `REGISTRATION_FAILED` | Duplicate account email |
| 409 `RIDER_INVITATION_CONFLICT` | Existing account or pending invitation; account created before activation |
| 429 `RATE_LIMITED` | Overall auth or email-request rate limit |
| 503 `EMAIL_DELIVERY_FAILED` | Registration or Rider invitation email could not be delivered |
| 500 `INTERNAL_ERROR` | Unexpected server/database failure |
| 404 `PROFILE_NOT_FOUND` | Profile read found no profile |

`requireRole` enforces OPERATOR-only Rider invitation creation; current profile
endpoints only require authentication. Profile updates cannot set role or identity.
Resend and forgot-password hide SMTP failures behind their generic 200 response.

Rider invitations expire after 24 hours. Activation creates a verified RIDER account
atomically and never changes an existing account's role. See the
[RBAC and Rider invitation guide](RBAC_AND_RIDER_INVITATIONS.md) for details.

## Postman workflow

1. Register with a new email. Expect confirmation required without tokens.
2. Obtain the token from the verification email fragment and POST `{ "token": "..." }`
   to `/api/auth/verify-email`.
3. POST credentials to `/api/auth/login`. Copy `data.accessToken`.
4. GET `/api/users/me`; choose Authorization → Bearer Token and paste it.
5. POST `data.refreshToken` to `/api/auth/refresh`. Replace both stored tokens.
6. POST `/api/auth/logout` with the newest access token to revoke that session.
7. For recovery, POST email to forgot-password, then POST token/newPassword to
   reset-password. Log in again; old sessions are revoked.

## Testing

`npm test` builds TypeScript and runs mocked API/Swagger tests; database integration
tests are skipped unless `TEST_DATABASE_URL` explicitly points to a migrated
development/test database. Never use a production database for integration tests.

```powershell
$env:TEST_DATABASE_URL = "<development-database-uri>"
npm test
Remove-Item Env:TEST_DATABASE_URL
```

Integration tests use unique temporary accounts and remove only those accounts.
Nodemailer is mocked: no real emails are sent. They exercise expiry, replay,
concurrent token consumption, cooldowns, SMTP failure recovery, legacy account
guards and session revocation against PostgreSQL. Configure real SMTP and frontend
pages separately for manual delivery and browser testing.
