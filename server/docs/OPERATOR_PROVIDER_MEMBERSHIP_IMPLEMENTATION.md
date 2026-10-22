# Operator provider membership correction — 22 October 2026

## Result

Operators now manage city pricing for their persisted provider membership. Provider
creation/name/state editing routes and UI are removed. Existing provider records,
SME discovery, order fee snapshots and delivery lifecycle are preserved. No ADMIN role.

## Changed files

- `prisma/schema.prisma` and `prisma/migrations/20261022030000_operator_provider_membership/migration.sql`
- `src/app.ts`
- `src/modules/providers/provider.validation.ts`, `provider.repository.ts`, `provider.service.ts`, `provider.controller.ts`, `provider.router.ts`, `provider.openapi.ts`
- `src/modules/users/user.repository.ts`, `user.service.ts`, `user.openapi.ts`
- `tests/provider-membership.test.cjs`, `provider-pricing.test.cjs`, `provider-pricing.database.test.cjs`, `swagger.test.cjs`, `auth.test.cjs`
- `tests/membership-login.database.test.cjs` (live login/profile/refresh regression)
- `docs/DELIVERY_PROVIDER_PRICING_API.md`, `OPERATOR_PROVIDER_PROVISIONING.md`, this report and the superseded implementation report notice
- `../client/features/auth/schemas/auth.schema.ts`, `types/auth.types.ts`, `server/express-auth.ts`
- `../client/features/operator/types/provider.types.ts`, `api/providers.api.ts`, `server/providers.session.ts`, `components/delivery-providers.tsx`
- `../client/features/profile/components/profile-settings-form.tsx`
- `../client/tests/providers.test.tsx`, `providers-session.test.ts`

## Data and authorization

Profile.providerId is a nullable UUID mapped to profiles.provider_id; the named
OperatorProvider relation links it to the reused DeliveryProvider model. The FK
restricts deletion; an index supports membership lookups and a database check
restricts non-null membership to OPERATOR profiles. Existing users remain null.

GET my-provider returns only the current Operator's provider and its prices, or
provider:null. Other pricing operations require membership and return actionable
409 PROVIDER_MEMBERSHIP_REQUIRED when absent. Service role checks use both the
authenticated role and persisted Profile role. Membership reads and mutations
execute together in Serializable transactions; updates filter by priceId AND
persisted providerId. Cross-provider price IDs return 404. Concurrent changes
return 409 PRICING_CONFLICT. City uniqueness remains database protected.

GET/PATCH users/me now include email and read-only providerId/provider information.
Only account.email is selected; account objects/secrets are excluded. Ordinary
profile PATCH retains its strict fullName/phone allowlist. Service writes also
explicitly select those editable fields. Operators without membership can log in.

The UI displays My Delivery Provider, a read-only provider name/state, city prices,
an add/edit form and per-city activate/deactivate actions. Missing membership shows
the exact setup-required message and no mutation form. The profile shows actual
account email and read-only provider name. No provider selector or provider creation.

## Current APIs

- GET `/api/operator/my-provider`
- GET `/api/operator/my-provider/city-prices`
- POST `/api/operator/my-provider/city-prices`
- PATCH `/api/operator/my-provider/city-prices/:priceId`
- GET `/api/delivery-providers?city=...` (SME discovery unchanged)

Old Operator catalog endpoints are removed from both routing and Swagger.
See [DELIVERY_PROVIDER_PRICING_API.md](DELIVERY_PROVIDER_PRICING_API.md) for exact bodies,
responses, normalization, pricing and snapshot rules.

## Migration and provisioning status

Membership migration is **applied**. The inspected target is the
configured development Supabase PostgreSQL host
aws-0-ap-south-1.pooler.supabase.com, database postgres. Migration status reports
an applied `20261022120000_remove_out_for_delivery_status` absent from the local
history. This was verified by a read-only _prisma_migrations query. The current
database enum does include OUT_FOR_DELIVERY; no status migration was altered.
The initial decision to defer the membership migration broke sign-in because Prisma
authentication/profile queries selected the new column before it existed. After
the user reported this failure, the development target and absent column were
verified, and prisma migrate deploy successfully applied only the reviewed additive
membership migration. No reset, historical migration rewrite or existing membership
assignment was performed. Restore the missing teammate file separately; it did not
prevent additive deployment. Do not deploy this code to other targets before applying
the membership migration there.

[OPERATOR_PROVIDER_PROVISIONING.md](OPERATOR_PROVIDER_PROVISIONING.md) provides an
explicit development-only psql transaction requiring exact Operator and Provider
UUIDs. It validates existing verified OPERATOR accounts and providers, refuses
SME/RIDER profiles and conflicting reassignment, and updates one profile only.
The original manual procedure was not executed. Subsequently, the user selected
Flash Deliver for the verified Operator, and the new controlled CLI assigned that
membership and verified repeat safety. See PROVIDER_SETUP_EXECUTION.md for the
actual execution and resulting profile response.

## Checks and limitations

Prisma validation/client generation and backend/frontend TypeScript passed.
Final backend full suite: 84 passed, 5 opt-in database tests skipped, 0 failed,
including the missing-membership login regression. Frontend full suite: 243 passed
across 20 files. ESLint and the Next.js production build passed. An earlier
unescaped-apostrophe lint issue was corrected before those successful checks.
Repository mutation writes were additionally allowlisted to prevent providerId
changes even from non-HTTP callers, with a regression test. A fresh backend build
and all 15 targeted membership/pricing/Swagger tests passed after that final change.
`git diff --check` passed.
Existing Rider fixture duplicate-key warnings remain unrelated to this change.

After applying the membership migration, live development database verification
passed for scoped pricing/snapshots/concurrency, the complete receiving/assignment/
Rider delivery workflow, and real login/profile/refresh for a verified Operator with
null membership. All three live checks passed and removed only their isolated
fixtures. The new login regression initially had an invalid test fixture create
argument; that fixture was corrected and its live rerun passed. No real account
credentials, profiles or memberships were changed. Historical migration-file
reconciliation remains separate from the now-successful additive deployment.

No SME Create Order form, Rider screen or unrelated existing worktree changes were
overwritten. The user subsequently authorized committing and pushing the completed
membership, provisioning and Swagger changes to master; unrelated worktree edits
are excluded.
