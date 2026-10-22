# Provider setup execution — 22 October 2026

Root cause: the membership schema and migration were already present, both provider
records existed, and profile/API rendering was correct. The verified Operator
"Aung heein zay Ahz" still had providerId=null. An additional unverified Operator
also existed and was not selected or modified.

Target inspected: development, aws-0-ap-south-1.pooler.supabase.com, database postgres.
Application traffic uses port 6543; migration traffic uses DIRECT_URL on port 5432.
Prisma migration status reported the database up to date. No migration was needed.

Executed from server, twice successfully:

```powershell
npm run seed:providers -- --name="Flash Deliver" --name="Ghost Deliver" --confirm-target=aws-0-ap-south-1.pooler.supabase.com:6543/postgres --allow-remote-development
```

Both executions returned the same existing IDs:

- Flash Deliver: `ad5baab8-aa17-4d7b-8288-ed7092494d3e`
- Ghost Deliver: `bdf2f625-348e-43e1-88f5-404bbd86ed1c`

The seed uses name upsert with update:{} and changes no existing activation,
pricing, order relationship, account or profile. No duplicate provider was created.

The user explicitly selected Flash Deliver. The provisioning CLI was then executed
with Operator ID `bfed9a7f-4db4-4104-87e3-57fcaed850bf` and Flash Deliver's existing ID.
The first invocation reported changed:true and the identical second invocation
reported changed:false, verifying idempotency. Profile service now returns:

```json
{
  "success": true,
  "data": {
    "providerId": "ad5baab8-aa17-4d7b-8288-ed7092494d3e",
    "provider": { "id": "ad5baab8-aa17-4d7b-8288-ed7092494d3e", "name": "Flash Deliver", "isActive": true }
  }
}
```

This is the membership excerpt from the real profile service response, not a new
HTTP endpoint. The My Delivery Provider service also returned Flash Deliver with its
existing active Mandalay price of 4000.00 MMK. No prices were added or overwritten.
Use OPERATOR_PROVIDER_PROVISIONING.md for the reusable provisioning command and guards.

Changed files for this setup request:

- `package.json`: seed:providers and operator:assign-provider scripts
- `src/seed/providers.setup.ts`: target guards, idempotent catalog seeding and conditional Serializable membership provisioning
- `src/seed/providers.run.ts`, `src/seed/operator-provider.run.ts`: CLI entry points
- `tests/provider-setup.test.cjs`: environment, seed idempotency, role/provider validation, repeat safety and reassignment refusal
- `docs/OPERATOR_PROVIDER_PROVISIONING.md` and this execution report

Backend TypeScript build, Prisma validation and all five new setup tests passed.
The full backend suite passed: 89 passed, 6 opt-in database tests skipped, 0 failed.
No frontend/API implementation was changed by this setup request. Existing
SME discovery, fee snapshots and Rider workflows remain covered by their regression
tests. The user subsequently authorized committing and pushing the related changes
to master, excluding unrelated existing worktree edits.
