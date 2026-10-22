# Controlled Operator membership setup (development only)

## CLI commands (preferred)

The provider seeder and membership CLI require NODE_ENV=development or test,
the exact configured DATABASE_URL target identity, and an additional remote flag
for an explicitly authorized remote development database. They always reject
production. Target confirmation contains only hostname:port/database, never credentials.
The configured application pooler uses port 6543; DIRECT_URL migration traffic uses
5432. Confirm the application DATABASE_URL identity when running these commands.

Run from `server`:

```powershell
npm run seed:providers -- --name="Flash Deliver" --name="Ghost Deliver" --confirm-target=aws-0-ap-south-1.pooler.supabase.com:6543/postgres --allow-remote-development
npm run operator:assign-provider -- --operator-id=<exact-operator-uuid> --provider-id=<selected-existing-provider-uuid> --confirm-target=aws-0-ap-south-1.pooler.supabase.com:6543/postgres --allow-remote-development
```

The provider names above match the records inspected on this development target.
For other environments, explicitly select the known provider names rather than
creating unnecessary example records. Seeding upserts by unique name with an empty
update, preserving activation, prices, IDs and order relationships. It creates no
accounts. Repeated execution is safe.

Assignment requires the exact IDs, a verified linked OPERATOR account/profile and
an existing Provider. It changes only that profile's providerId; roles and passwords
are untouched. Same-ID repeats report changed:false. Different existing membership
is refused. Reads and conditional writes run in a Serializable transaction.

On 22 October 2026, the seeder was executed twice and reused the existing Flash Deliver
and Ghost Deliver IDs without duplicates. After the user explicitly selected Flash
Deliver, the verified Operator was assigned to it using the CLI. The first invocation
reported changed:true; an identical second invocation reported changed:false.
The profile and My Delivery Provider service reads confirmed Flash Deliver and its
existing city pricing. No other account, pricing or historical order was changed.

## Manual development alternative

Prerequisite: inspect the target host/database and NODE_ENV and ensure the reviewed
membership migration is applied (it is now applied on the configured development
target). Restore the missing historical teammate migration file separately. Do not
run this procedure against production without explicit approval.
Use a trusted server-side database connection; never send credentials to a browser.

The following psql procedure assigns one verified existing Provider UUID to one
verified existing OPERATOR account/profile. Obtain both exact IDs from verified
development records. No IDs are hardcoded, no provider is created, and no role is
changed. Repeating the same assignment is allowed; reassigning an existing membership
to a different provider is refused and requires a separate reviewed procedure.

Connect to the explicitly verified **development** target with your normal secure
psql connection mechanism. Run with ON_ERROR_STOP so any failed validation aborts.
The prompts require only IDs, never passwords or tokens:

```sql
\set ON_ERROR_STOP on
\conninfo
\prompt 'Exact existing Operator account/profile UUID: ' operator_id
\prompt 'Exact existing Provider UUID: ' provider_id
BEGIN;
SELECT set_config('parcelops.operator_id', :'operator_id', true);
SELECT set_config('parcelops.provider_id', :'provider_id', true);
DO $$
DECLARE
  target_operator uuid := current_setting('parcelops.operator_id')::uuid;
  target_provider uuid := current_setting('parcelops.provider_id')::uuid;
  existing_provider uuid;
BEGIN
  SELECT p.provider_id INTO existing_provider
  FROM public.profiles p JOIN public.accounts a ON a.id = p.id
  WHERE p.id = target_operator AND p.role = 'OPERATOR'
    AND a.email_verified_at IS NOT NULL
  FOR UPDATE OF p;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Verified existing OPERATOR account/profile required';
  END IF;
  PERFORM id FROM public.legacy_delivery_services
    WHERE id = target_provider FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Existing Provider required'; END IF;
  IF existing_provider IS NOT NULL AND existing_provider <> target_provider THEN
    RAISE EXCEPTION 'Existing membership differs; reassignment refused';
  END IF;
  UPDATE public.profiles SET provider_id = target_provider, updated_at = now()
    WHERE id = target_operator AND role = 'OPERATOR';
END $$;
SELECT p.id, p.role, p.provider_id, d.name AS provider_name
FROM public.profiles p JOIN public.legacy_delivery_services d ON d.id = p.provider_id
WHERE p.id = current_setting('parcelops.operator_id')::uuid;
COMMIT;
```

Invalid UUIDs, unknown IDs, unverified/accountless profiles, SME/RIDER profiles or
conflicting memberships abort the transaction. If running interactively and an
error occurs, issue ROLLBACK before any further commands. An inactive existing
provider may be assigned, but it remains invisible to SME discovery until activated
through a separately controlled catalog process. There is no Operator catalog API.

After provisioning, refresh the Operator profile and My Delivery Provider page.
Membership is loaded from persisted data per request, so no new login is required.
No order, historical fee, assignment or status is modified by this procedure.
