# Operator database contract synchronization

The Operator Dashboard database failure was caused by local code expecting `orders.delivery_service_id` and `delivery_services` after the shared database had retired them.

Imported the SME developer's existing changes from `origin/server/feature/sme-owners`, commit `9e88ace`, into the working tree: the Prisma schema, order module, SME dashboard route, and migrations `20261021100000_assign_orders_to_operators` and `20261021120000_retire_delivery_services`. These changes are not yet on remote master. Existing Operator work is preserved; no merge/reset or database mutation was performed.

The two imported migration files match the checksums already recorded by the connected database. Do not rerun these manually or recreate the retired tables. Prisma Client was regenerated against the matching source schema.

## Current contract

- Orders expose nullable `operatorId` and nullable `operator: { id, fullName, phone }` in Operator list/details/receiving responses.
- `deliveryService` is no longer queried or required by the Operator API or frontend response schemas.
- Legacy orders may have no assigned Operator. The UI displays `Not assigned`; it does not substitute a fabricated provider.
- The list table and detail card now display Operator instead of Delivery service.
- The development seeder uses `SEED_OPERATOR_ID`, referencing an existing verified OPERATOR account, in place of `SEED_DELIVERY_SERVICE_ID`. Other safety/opt-in requirements are unchanged. It was not executed.
- The imported SME developer route is `GET /api/sme/dashboard`, requires an SME Bearer session, and is registered/documented using that developer's existing implementation and OpenAPI contract.
- Existing Operator route permissions and receiving lifecycle are unchanged. This synchronization does not introduce company isolation, Rider assignment or a fix to the separately owned SME status conflict.

## Verification

The actual Operator service list query was executed read-only against the configured database and succeeded, returning pagination with the new Operator fields. Only aggregate counts/checksum equality were logged; no customer data, tokens or credentials were printed.
Backend build, non-database regression tests, frontend tests, lint, type checking and production build are checked for this change. Database integration tests and all write operations remain excluded.

If a running server retained the previous generated Prisma module, restart `npm run dev` in `server`, then refresh `/operator` or `/operator/parcels`. Both the API and frontend must run the synchronized source; a stale deployment can still reject the new response shape.
