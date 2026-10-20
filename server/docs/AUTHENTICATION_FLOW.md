# Authentication flow

ParcelOps AI uses Express, Zod, Prisma and Supabase-hosted PostgreSQL. Supabase
provides database hosting only. No Supabase Auth, OAuth, social login or JWT
application sessions are used.

## Architecture

Requests follow router → middleware → controller → service → repository → Prisma
→ PostgreSQL. Controllers validate bodies; services manage workflows; repositories
own all database queries. Nodemailer is isolated behind the email provider.

## Account lifecycle

1. `POST /api/auth/register` normalizes the email, hashes the password with the
   existing salted scrypt implementation and creates an account plus SME profile.
2. The account starts with `emailVerifiedAt: null`. The API sends a verification
   email and returns `confirmationRequired: true`, without access or refresh tokens.
3. The frontend submits the email token to `POST /api/auth/verify-email`.
4. Verification consumes the token and marks the email verified atomically.
5. `POST /api/auth/login` checks credentials, then verification, and issues tokens.
   Correct credentials for an unverified account return `403 EMAIL_NOT_VERIFIED`.

If registration creates an account but SMTP fails, it returns `503
EMAIL_DELIVERY_FAILED`. Keep the account and use resend-verification after the
60-second cooldown. Do not register again to recover.

## Session lifecycle

- Each login creates an independent `AuthSession`.
- Access tokens last 15 minutes; refresh tokens last 30 days from issue or rotation.
- Both are 32 random bytes encoded as base64url. Only SHA-256 hashes are stored.
- Refresh requires the refresh token in JSON and a verified account. It atomically
  replaces both tokens; serialize client refresh requests and retain the new pair.
- Logout requires a valid access token and deletes its session immediately.
- Password reset deletes every session for the account and requires a new login.
- Session creation checks the password hash again under the account lock, so a
  login checked before a concurrent reset cannot create a session with stale credentials.

## Authentication and authorization

`requireAuth` accepts `Authorization: Bearer <accessToken>`, loads the session and
account, checks token expiry and email verification, then attaches `req.auth`.
Unverified accounts cannot use existing access or refresh tokens.

`requireRole` checks the current profile role after authentication. Registration
always creates SME profiles; public requests cannot set OPERATOR or RIDER roles.
Services must still enforce ownership for individual resources.

## Models and migration

| Model | Purpose |
| --- | --- |
| Account | Unique normalized email, scrypt hash, nullable verification timestamp |
| Profile | Account details and trusted role |
| AuthSession | Hashed access/refresh tokens and their expiry |
| EmailVerificationToken | One hashed verification token per account |
| PasswordResetToken | One hashed reset token per account |

The verification migration adds a nullable timestamp and two tables. It does not
delete accounts, profiles or sessions, and does not change Supabase-managed tables.
Existing accounts start unverified because no prior mailbox verification was recorded.
Their sessions remain stored but cannot authorize requests until the account verifies.
After verification, an otherwise unexpired existing session can work again.

Verification and reset use separate tables so a reset token can never verify email.
Account-level database row locks serialize token replacement, consumption, password
changes and session creation. Token consumption is transactionally single-use.

## Limits and security

Use HTTPS and secure client token storage. The API returns JSON tokens and does
not set authentication cookies. Do not log passwords, tokens, or email bodies.
RLS is enabled and Supabase anon/authenticated table access is revoked; Prisma uses
a trusted backend role and does not inherit a user's JWT context.

Email verification is separate from password reset: a reset never marks email
verified. No password-change endpoint, all-device logout endpoint or OAuth is provided.
Expired token/session cleanup is not scheduled. Email delivery has no durable queue;
SMTP acceptance is not proof of inbox delivery. Public email-request responses are
generic, but synchronous SMTP can still create response-time differences.

Rate limiting is per process. Multiple replicas need a shared limiter. Configure
Express trust proxy only for the deployment's actual trusted proxy topology.

See [API reference](API_DOCUMENTATION.md), [verification](EMAIL_VERIFICATION.md),
and [password recovery](PASSWORD_RESET.md).
