# Authentication

ParcelOps AI uses local email/password authentication with Prisma and PostgreSQL.
Supabase hosts the database only. Passwords use scrypt; application sessions use
opaque access and refresh tokens, not JWTs.

## Start

Configure database URLs and SMTP settings in `server/.env` using `.env.example`.
Run from `server`:

```powershell
npm install
npm run db:migrate
npm run dev
```

## Workflow

1. Register: `POST /api/auth/register` with email/password. Registration sends a
   verification email and returns `confirmationRequired: true`, without tokens.
2. Verify: submit the email link's token to `POST /api/auth/verify-email`.
3. Login: `POST /api/auth/login` with the same credentials. Unverified accounts
   receive `403 EMAIL_NOT_VERIFIED` after correct password verification.
4. Authenticate: send `Authorization: Bearer <accessToken>` to protected routes.
5. Refresh: POST the refresh token to `/api/auth/refresh`; replace both tokens.
6. Logout: POST `/api/auth/logout` with the current access token.

Access tokens last 15 minutes; refresh tokens last 30 days from issue or rotation.
Refresh replaces both tokens. Logout immediately revokes the current session.

For password recovery, POST email to `/api/auth/forgot-password`, then submit the
emailed reset token and `newPassword` to `/api/auth/reset-password`. A successful
reset revokes all sessions and requires login again. It does not verify email.

Verification and reset links expire after 15 minutes and can be consumed once.
Only token hashes are stored. Both link types point to frontend pages and put
the token in the URL fragment; frontend pages must POST it to the backend.

Existing accounts and sessions are preserved by the migration, but email verification
is required before login, refresh or protected access. Use resend-verification for
existing unverified accounts. No database reset is required.

## Detailed documentation

- [Architecture, workflows and migration policy](docs/AUTHENTICATION_FLOW.md)
- [Email verification, SMTP and manual testing](docs/EMAIL_VERIFICATION.md)
- [Password recovery and session revocation](docs/PASSWORD_RESET.md)
- [API contracts, errors, Postman and tests](docs/API_DOCUMENTATION.md)
- [Swagger UI and documentation structure](README.md#swagger-ui)

Swagger UI: `http://localhost:3000/api/docs`. OpenAPI JSON: `/api/docs.json`.

Run `npm test` for the build and mocked API tests. Set `TEST_DATABASE_URL` only for
a migrated development/test database to also run PostgreSQL integration tests.
