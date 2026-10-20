# RBAC and Rider invitations

## Authentication and authorization

Authentication identifies the account through an opaque access token. Authorization checks the current database-backed profile role. Zustand is UI state only and grants no permission.

| Role | Provisioning | Access in this milestone |
| --- | --- | --- |
| SME | Public registration, then email verification | Own profile; cannot invite Riders |
| OPERATOR | Trusted administrative database provisioning | Own profile and Rider invitations |
| RIDER | Operator invitation, then password activation | Own profile; cannot invite Riders |

All roles use the existing `/api/auth/login`, refresh, logout, and password recovery flows. Public registration always creates an SME; unknown fields such as `role` and `isAdmin` are rejected. Profile updates accept only name and phone. There is no public role assignment endpoint or Operator provisioning endpoint. A trusted administrator must provision Operators outside ordinary application APIs; no administrative UI or script is added here.

The older `AGENT.md` references Supabase Auth. This feature follows the approved task instead: Supabase hosts PostgreSQL only; existing scrypt passwords and opaque sessions remain in use.

## Middleware

`requireAuth` parses Bearer authorization. The authentication service rejects tokens outside the 43-character base64url format, hashes valid-format tokens with SHA-256, and loads the session with its account and current profile. Missing, unknown, expired, revoked, or unverified sessions return 401. No client role header is trusted.

`requireRole(...roles)` requires `req.auth`, returning 401 if absent and 403 if its database-backed role is not allowed. Invitation creation uses `requireAuth` followed by `requireRole("OPERATOR")`. The service also checks the role, and the repository rechecks the current inviting account before persistence.

## API contracts

All responses use `{ success: true, data: ... }` or `{ success: false, error: { code, message } }`. Responses have `Cache-Control: no-store`.

### POST /api/riders/invitations

Requires an Operator Bearer access token. Body:

```json
{ "email": "rider@example.com", "fullName": "Rider One" }
```

Email is trimmed and lowercased; full name is optional, trimmed, and limited to 120 characters. Unknown fields, including passwords and roles, are rejected. Success is 201 with `data.message` and `data.invitation` containing only `id`, `email`, `expiresAt`, and `status: "pending"`. There is no account until activation.

Existing accounts of any role and duplicate pending invitations return 409 `RIDER_INVITATION_CONFLICT`; roles are never overwritten. An expired or revoked invitation can be replaced by another authorized invitation request. Accepted invitation records cannot be replaced. Email failures revoke that token and return 503 `EMAIL_DELIVERY_FAILED`; invite again to retry.

Limits are 30 requests per IP and 10 per authenticated Operator per 15 minutes. The Operator quota also counts invalid/conflicting requests after authentication and authorization. Unauthorized requests count toward the IP limit.

### POST /api/riders/activate

Public endpoint accepting `{ "token": "<token from invitation email>", "password": "<chosen password>" }`. Placeholders are explanatory, not usable credentials. Tokens must be 43 base64url characters. Passwords use the existing 8–128-character policy. Password confirmation belongs to the frontend; no role field is accepted.

A valid invitation atomically creates a RIDER profile and account with the chosen scrypt password hash and `emailVerifiedAt` set. Possession of the delivered invitation proves control of the invited mailbox; no second verification email is required. Acceptance creates no session. Success is 200 with a message only; sign in using `/api/auth/login` afterward.

Invalid, expired, revoked, or consumed tokens return 400 `INVALID_INVITATION_TOKEN`. Malformed input returns 400 `VALIDATION_ERROR` (malformed JSON uses `INVALID_JSON`). A registration race that creates the email before activation returns 409 without changing that account or consuming the invitation. Rate limit: 20 attempts per IP per 15 minutes, including invalid tokens.

Other errors: 401 authentication required, 403 insufficient role, 429 `RATE_LIMITED`, 500 `INTERNAL_ERROR`. Internal database/provider details, hashes, and raw invitation tokens are never included in endpoint responses.

## Token, email, and database lifecycle

Each invitation uses a fresh `randomBytes(32)` base64url token. Only its SHA-256 hash is stored. It expires 24 hours after issuance and becomes unusable after acceptance or revocation. Tokens are separate from access, refresh, verification, and reset tokens.

Nodemailer uses the existing SMTP configuration, TLS behavior, and sender. Messages include ParcelOps AI branding, Operator/team context, an Activate Account link, expiry, and an ignore-if-unexpected notice in HTML and plain text. Links use only trusted `FRONTEND_URL` and `/activate-rider#token=...`; fragments keep tokens out of HTTP URLs and Referer headers. Tokens and passwords must not be logged.

Migration `20261021000000_rider_invitations` adds `public.rider_invitations`: UUID ID, unique email, optional full name, unique token hash, inviting account foreign key, expiry, accepted/revoked timestamps, and creation time. One record per normalized email is retained; replacement overwrites expired/revoked issuance metadata rather than creating history. Indexes cover inviter and expiry. Foreign-key deletion is restricted to retain attribution; remove invitations before deleting their inviting account. Existing data is unchanged. RLS is enabled and Supabase `anon`/`authenticated` table access is revoked; access is through the backend database role.

Unique email constraints protect concurrent initial invitations and account creation. Replacements use conditional updates matching the old hash and eligible state. Activation conditionally marks an unexpired, unrevoked, unaccepted invitation as accepted and creates its account/profile in one transaction. Competing activations cannot both claim it. Any account creation failure rolls back acceptance. Failed delivery invalidation matches only the failed token, preserving newer replacements.

Apply the reviewed additive migration with `npm run db:migrate` from `server`, then run `npm run prisma:generate`. Do not reset the database. As with the previous migrations, the SQL expects Supabase's `anon` and `authenticated` database roles; a standalone test PostgreSQL database needs those roles provisioned before applying migrations.

## Swagger and manual end-to-end verification

Start the backend and open `/api/docs` (enabled by default outside production; `ENABLE_API_DOCS=true` enables it explicitly). OpenAPI JSON is at `/api/docs.json`.

1. Use a trusted administratively provisioned, verified OPERATOR account. Call `/api/auth/login` with its credentials.
2. Copy its opaque access token securely into Swagger's Authorize dialog. Do not add a second Bearer prefix or persist the token in shared files.
3. Call `/api/riders/invitations` with a fresh Rider email and optional name. Expect 201; confirm SMTP delivery. No token appears in the API response.
4. Open the invitation link and inspect its fragment locally. The `/activate-rider` frontend page is not implemented by this backend task. For API-only verification, submit the fragment token and your chosen password to `/api/riders/activate` using Swagger or a local API client. Do not paste the token into shared logs or screenshots.
5. Expect activation success, then call the existing login endpoint with the Rider credentials. Activation itself must not issue access/refresh tokens.
6. Authorize with the Rider access token and GET `/api/users/me`; confirm `data.role` is `RIDER`. Confirm Rider invitation creation returns 403.
7. Login as an SME, authorize with its token, and confirm invitation creation also returns 403. Without a token, expect 401.
8. Reuse the activation token and expect 400 `INVALID_INVITATION_TOKEN`. Try inviting an existing SME/Operator email and expect 409 without a role change.
9. Submit `role` or `isAdmin` in public registration, or `role` in PATCH `/api/users/me`; expect validation rejection. Confirm no public role escalation route exists.

Frontend consumers must read the current role from `/api/users/me`. Intended destinations remain SME → `/seller`, OPERATOR → `/operator`, RIDER → `/rider`. This backend change does not add those pages or alter the current `/account` login destination. A future activation page should remove the token fragment, keep it only in memory, ask for password confirmation, POST activation, then navigate to `/login`.

## Automated verification

`npm test` builds TypeScript and runs ordinary HTTP/service tests with mocked repositories and email. Tests cover authentication, trusted roles, normalization, pending invitations, hash-only storage, activation, replay/expiry/revocation, validation, role protection, provider failure, rate limits, and Swagger.

Database tests require explicit `TEST_DATABASE_URL` pointing to a migrated development/test PostgreSQL database. Set that variable securely and run `npm test` or `node --test tests/riders.database.test.cjs` after building. They mock Nodemailer, create uniquely prefixed fixtures, exercise real transactions, concurrent invitations/activation, verified Rider login/logout, replacement, rollback, and delivery failure, then remove only those fixtures. They are skipped without opt-in. Never use a production database for integration tests. A forced process termination may require manual removal of that run's `rider-test-` fixtures, invitations first.

## Known limitations

- No activation frontend, dashboards, invitation listing/revoke/resend APIs, team/tenant model, or dispatch features are included. Revocation timestamps are enforced, but setting one currently requires trusted administrative database access.
- Operator permissions are global in this MVP; no operational tenant scope exists. No Rider listing or management endpoint is exposed.
- Rate limiting uses per-process memory. Multiple instances need a shared limiter store and correctly configured trusted proxy handling. HTTP authentication traffic also requires deployment-level abuse controls.
- Email delivery and database writes cannot form one atomic transaction. SMTP acceptance does not guarantee inbox delivery. Failure revokes the invitation when cleanup succeeds; a database outage during cleanup can leave it pending until administrative revocation or expiry. A durable outbox is not implemented.
- Invitation replacement retains only the latest issuance metadata. There is no immutable audit history or automatic cleanup job.
- A pending invitation does not reserve an email against public SME registration. Activation rejects any resulting account conflict and does not convert that account.
- Invitation issuance checks the current Operator role; already-issued invitations remain valid after later changes to the inviter's role unless explicitly revoked.
- Use HTTPS for frontend/backend deployment. Backend credentials must remain server-side; RLS does not replace application authorization for privileged Prisma connections.
