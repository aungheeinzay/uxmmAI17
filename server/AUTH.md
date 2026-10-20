# Authentication workflow and API

For interactive endpoint documentation and Bearer authorization, see the
[Swagger UI setup in README.md](README.md#swagger-ui).

The API handles authentication through Express, Prisma, and PostgreSQL hosted on
Supabase. It manages its own accounts and sessions. Supabase Auth, Supabase API
keys, and JWT secrets are not required. Tokens are opaque random strings, not JWTs.

## Setup

Run commands from `server`. If `.env` does not exist, copy `.env.example` and replace
the placeholders with your connection strings from Supabase's Connect dialog.

```dotenv
NODE_ENV=development
PORT=3000
DATABASE_URL="postgresql://postgres.PROJECT_REF:ENCODED_PASSWORD@POOLER_HOST:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.PROJECT_REF:ENCODED_PASSWORD@POOLER_HOST:5432/postgres"
```

Both URLs must target the same database. URL-encode special characters in passwords
and omit placeholder square brackets. A reachable direct database URI can also be
used for `DIRECT_URL`.

| Variable | Used by |
| --- | --- |
| `DATABASE_URL` | Prisma Client at runtime |
| `DIRECT_URL` | Prisma CLI through `prisma.config.ts` |
| `PORT` | HTTP server; defaults to `3000` |
| `NODE_ENV` | Environment; defaults to `development` |

```powershell
npm install
npm run db:migrate
npm run dev
```

The default API address is `http://localhost:3000`. The server loads `server/.env`;
`.env.example` is a reference template.

## Request architecture

```mermaid
flowchart LR
    Client --> Router
    Router --> Middleware
    Middleware --> Controller
    Controller --> Service
    Service --> Repository
    Repository --> Prisma
    Prisma --> PostgreSQL
```

Routers define endpoints and middleware. Controllers validate JSON with Zod and
format responses. Services handle authentication rules, passwords, and tokens.
Repositories perform database operations through the shared Prisma Client.

## Authentication workflow

### 1. Register

1. Send an email and password to `POST /api/auth/register`.
2. Validation requires a valid email and an 8–128 character password. Extra fields,
   including `role`, are rejected.
3. The service trims and lowercases the email and hashes the password with scrypt.
4. Prisma creates the account and its `SME` profile atomically with a shared UUID.
5. The service generates access and refresh tokens and creates a session containing
   their hashes and expiry dates.
6. The API returns `201` with the user and tokens. The user is logged in immediately;
   `confirmationRequired` is `false`.

A duplicate email returns `409 REGISTRATION_FAILED`. Session creation happens after
account creation. If account creation succeeds but session creation fails, recover
by logging in rather than registering again.

### 2. Log in

1. Send credentials to `POST /api/auth/login`.
2. The service finds the normalized email and verifies the password hash.
3. Incorrect credentials return the generic `401 LOGIN_FAILED` response.
4. A successful login creates an independent session and returns its token pair.

### 3. Access a protected endpoint

Send this header:

```http
Authorization: Bearer <accessToken>
```

`requireAuth` hashes the token, looks up its session, checks access expiry, and loads
the account and current profile role. It attaches the ID, email, role, and access
token to `req.auth`. Missing, malformed, unknown, expired, or revoked tokens return
`401` before the controller runs.

`/api/users/me` uses the authenticated account ID. Privileged routes can apply
`requireRole("OPERATOR")` after `requireAuth`; insufficient permissions return
`403 FORBIDDEN`. Services must also check resource ownership where applicable.

### 4. Refresh the session

1. Send the refresh token to `POST /api/auth/refresh`. No access token is required.
2. The repository checks the token hash and refresh expiry in a transaction.
3. A conditional update replaces both token hashes and both expiry dates. Only
   one request can successfully rotate a given refresh token.
4. The response contains the new pair. Both previous tokens stop working.

Replace both stored tokens together and send only one refresh request at a time.
An invalid, expired, or previously rotated token returns
`401 INVALID_REFRESH_TOKEN`; return the client to login.

### 5. Log out

Call `POST /api/auth/logout` with a valid access token. The backend deletes that
session, immediately revoking its access and refresh tokens. Discard the tokens
on the client. Other login sessions remain active.

An expired access token cannot call logout. Refresh first if possible, then log out.

## Token lifecycle

| Property | Access token | Refresh token |
| --- | --- | --- |
| Purpose | Protected requests | Obtain a new token pair |
| Lifetime | 15 minutes | 30 days after issue or rotation |
| Sent in | Authorization header | JSON request body |
| Stored in database | SHA-256 digest | SHA-256 digest |
| Invalidated by | Expiry, refresh, logout | Expiry, refresh, logout |

Tokens contain 32 random bytes encoded as base64url. Raw tokens are returned to the
client and are not stored in PostgreSQL. `expiresIn` is the access lifetime in
seconds (`900`); `expiresAt` is the access expiry as a Unix timestamp in seconds.

## Endpoint reference

Use `Content-Type: application/json` for request bodies.

| Method | Endpoint | JSON body | Access token | Success |
| --- | --- | --- | --- | --- |
| POST | `/api/auth/register` | `{ "email": "you@example.com", "password": "example-password" }` | No | 201 |
| POST | `/api/auth/login` | Same credential fields | No | 200 |
| POST | `/api/auth/refresh` | `{ "refreshToken": "..." }` | No | 200 |
| POST | `/api/auth/logout` | None | Required | 200 |
| GET | `/api/users/me` | None | Required | 200 |
| PATCH | `/api/users/me` | `{ "fullName": "Your Name", "phone": "+959123456789" }` | Required | 200 |

Validation:

- Email: valid format, maximum 254 characters; trimmed and normalized to lowercase.
- Registration password: 8–128 characters. Login password: 1–128 characters.
  Passwords are case sensitive and are not trimmed.
- Refresh token: 1–8192 characters.
- Profile update: at least one of `fullName` or `phone`. Either may be `null` to
  clear it. Non-null values are trimmed; name length is 1–120 and phone is 1–32.
- Unknown body fields are rejected. These endpoints cannot change identity or role.

### Responses

Registration returns this shape. Login and refresh omit `confirmationRequired`.
Tokens and timestamps below are illustrative.

```json
{
  "success": true,
  "data": {
    "confirmationRequired": false,
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "you@example.com",
      "profile": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "fullName": null,
        "phone": null,
        "role": "SME",
        "createdAt": "2026-10-20T00:00:00.000Z",
        "updatedAt": "2026-10-20T00:00:00.000Z"
      }
    },
    "accessToken": "<access-token>",
    "refreshToken": "<refresh-token>",
    "tokenType": "bearer",
    "expiresIn": 900,
    "expiresAt": 1792455300
  }
}
```

Profile endpoints return the profile directly inside `data`. Logout returns:

```json
{ "success": true, "data": { "message": "Session ended." } }
```

Errors use a consistent envelope:

```json
{
  "success": false,
  "error": {
    "code": "LOGIN_FAILED",
    "message": "Invalid email or password."
  }
}
```

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Invalid, missing, or unexpected body field |
| 400 | `INVALID_JSON` | Malformed JSON |
| 401 | `LOGIN_FAILED` | Incorrect credentials |
| 401 | `UNAUTHORIZED` | Missing, invalid, expired, or revoked access token |
| 401 | `INVALID_REFRESH_TOKEN` | Invalid, expired, or previously rotated refresh token |
| 403 | `FORBIDDEN` | Role does not permit the operation |
| 404 | `PROFILE_NOT_FOUND` | Profile lookup found no profile |
| 409 | `REGISTRATION_FAILED` | Account email already exists |
| 429 | `RATE_LIMITED` | Auth request limit exceeded |
| 500 | `INTERNAL_ERROR` | Unexpected server or database failure |

All auth endpoints share a limit of 30 requests per IP per 15 minutes, including
refresh and logout. Auth and profile routes return `Cache-Control: no-store`.

## Manual test with PowerShell

Start the server and open another terminal. Use a new email for registration;
use `/api/auth/login` instead for an existing account.

```powershell
$apiBase = "http://localhost:3000"
$credentials = @{ email = "you@example.com"; password = "example-password" } | ConvertTo-Json

# Register and retain the token pair.
$request = @{
  Method = "Post"
  Uri = "$apiBase/api/auth/register"
  ContentType = "application/json"
  Body = $credentials
}
$authResult = Invoke-RestMethod @request
$tokens = $authResult.data

# Read the authenticated profile.
$authHeaders = @{ Authorization = "Bearer $($tokens.accessToken)" }
Invoke-RestMethod -Uri "$apiBase/api/users/me" -Headers $authHeaders

# Replace both tokens after refresh.
$request.Uri = "$apiBase/api/auth/refresh"
$request.Body = @{ refreshToken = $tokens.refreshToken } | ConvertTo-Json
$refreshResult = Invoke-RestMethod @request
$tokens = $refreshResult.data

# Revoke the current session.
$authHeaders = @{ Authorization = "Bearer $($tokens.accessToken)" }
Invoke-RestMethod -Method Post -Uri "$apiBase/api/auth/logout" -Headers $authHeaders
```

Confirm that a profile request with the old access token fails after refresh and
that both tokens fail after logout.

## Database and source files

| Model | Table | Responsibility |
| --- | --- | --- |
| `Profile` | `profiles` | User details and trusted role |
| `Account` | `accounts` | Unique email and password hash; ID references profile |
| `AuthSession` | `auth_sessions` | Account reference, token hashes, expiry dates |

Deleting a profile cascades to its account and sessions. Multiple sessions per
account are supported. Passwords use scrypt with a random 16-byte salt, `N=32768`,
`r=8`, `p=3`, and a 64-byte derived key. Verification uses timing-safe comparison.
Password hashes and token hashes are not returned in API responses.

- [Routes](src/modules/auth/auth.router.ts)
- [Controllers](src/modules/auth/auth.controller.ts)
- [Validation](src/modules/auth/auth.validation.ts)
- [Service](src/modules/auth/auth.service.ts)
- [Repository](src/modules/auth/auth.repository.ts)
- [Password hashing](src/modules/auth/auth.password.ts)
- [Authentication middleware](src/lib/middleware/require-auth.ts)
- [Role middleware](src/lib/middleware/require-role.ts)
- [Prisma schema](prisma/schema.prisma)

## Verification and current limits

```powershell
npm test
```

This builds TypeScript and runs workflow and password tests with mocked persistence.
It does not test the live database. Use the manual workflow above against a
development database for integration verification.

Email confirmation, password reset, password changes, and logout from all devices
are not implemented. Existing Supabase Auth passwords and sessions are not converted
to local accounts. The local-auth migration preserves existing profiles and removes
their foreign key to `auth.users`. The historical initial migration still depends on
Supabase's `auth.users`, `anon`, and `authenticated`, so fresh migration setup expects
a Supabase PostgreSQL database.

Migrations enable RLS and revoke direct access from Supabase's `anon` and
`authenticated` roles. Prisma uses a trusted backend connection and does not inherit
user JWT context. Enforce resource ownership in backend services. Keep credentials
server-side, use HTTPS, and avoid logging tokens. The API returns JSON tokens and
does not set authentication cookies; client applications must choose secure storage.

Expired session cleanup is not automatic. Maintenance can remove sessions after
their refresh expiry. Multiple replicas need a shared rate-limit store. Deployments
behind a proxy must configure Express `trust proxy` for their actual topology.
