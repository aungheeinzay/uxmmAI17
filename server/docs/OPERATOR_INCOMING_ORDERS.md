# Operator incoming orders and development seeder

The delivery-service contract below has been superseded by [Operator schema synchronization](OPERATOR_SCHEMA_SYNC.md). Current orders use nullable Operator profile relations, and the seeder requires `SEED_OPERATOR_ID` for an existing verified OPERATOR instead of a delivery service. No database mutations are required for an environment that already applied the two imported migrations.

## Architecture and scope

`operator.router → requireAuth / requireRole → controller → service → repository → shared Prisma → PostgreSQL`.
The module reads the existing `ParcelOrder` table, restricted to owners whose trusted profile role is SME.
It creates no duplicate tables and changes no schema, authentication, SME logic, or rider logic.
The subsequent [Operator Parcel Receiving feature](OPERATOR_PARCEL_RECEIVING.md) adds a separately authorized `PATCH /api/operator/orders/:id/receive`; the list/detail routes described here remain read-only.
Small shared-file changes register `/api/operator` in `src/app.ts` and add Swagger paths/schemas.
The existing staged package-lock change was preserved.

## API

Both routes require `Authorization: Bearer <opaque access token>` and a verified authenticated OPERATOR account.
Missing, invalid, expired or revoked sessions return 401; SME and RIDER return 403, regardless of client-supplied roles.
Responses use `{ success: true, data: ... }` and the existing standard error envelope. Responses set `Cache-Control: no-store`.

| Endpoint | Result |
| --- | --- |
| `GET /api/operator/orders` | `{ orders, pagination: { page, pageSize, total, totalPages } }` |
| `GET /api/operator/orders/:id` | One parcel, permitted seller identity, delivery service, and `statusEvents` |

Details accept UUID IDs only (not order codes). Invalid input returns 400; missing/non-SME-owned orders return 404.
No account/session/token objects are selected. Seller information is limited to id, fullName and phone; event actors to id and fullName.
Parcel weights and COD are decimal strings; `parcelWeightUnit` is `kg`.

| List query | Behavior |
| --- | --- |
| `page` | Integer 1–1,000,000; default 1 |
| `pageSize` | Integer 1–100; default 20 |
| `search` | Case-insensitive substring of order code OR recipient name, up to 120 characters |
| `township` | Case-insensitive exact match, up to 120 characters |
| `status` | One actual Prisma OrderStatus value |
| `createdDate` | Valid YYYY-MM-DD, UTC calendar day, inclusive start/exclusive next day |

Unknown query fields are rejected. Filters combine with AND, except the two search alternatives.
Without a status filter, all existing statuses are returned; use `status=CREATED` for newly incoming parcels.
The actual enum is CREATED, PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, FAILED, CANCELLED.
No PENDING, RECEIVED or ASSIGNED members were added.
Page and count use the same filters and a repeatable-read transaction. Ordering is `createdAt DESC, id DESC`.
History orders by `createdAt ASC, id ASC`. Empty results have totalPages 0.

## Development database and seeder safety

No existing separate development database has been verified. **The seeder was not run against any database.**
Do not use the current Supabase database for these fixtures. No schema migrations were run as part of this implementation.

Provision a separate local PostgreSQL instance/database named exactly `parcelops_dev` or `parcelops_test`.
Use a dedicated database user with access only to that database. Apply existing migrations to that database, then use existing supported provisioning flows to create a verified SME and an active delivery service there.
No existing seeding convention or database deployment classification exists in the repository.
For that reason the script deliberately refuses all remote hosts, including remote Supabase development projects.
It permits only localhost, 127.0.0.1 or IPv6 loopback, exact development/test database names, and optional `schema` / `sslmode` query parameters.
The operator must verify this local instance is separate and disposable; URL labels alone cannot prove deployment ownership.

Required environment variable names:

- `NODE_ENV` (`development` or `test`; explicitly required)
- `SEED_DATABASE_URL` (dedicated local development/test PostgreSQL connection)
- `ALLOW_DEV_SEED` (exactly `true`)
- `SEED_CONFIRM_TARGET` (exact `hostname:port/database`, e.g. `localhost:5432/parcelops_dev`)
- `SEED_SME_ID` (existing verified SME UUID in that database)
- `SEED_DELIVERY_SERVICE_ID` (existing active delivery-service UUID in that database)

Set these in the current terminal only. Do not commit credentials or edit production `.env` values.
`SEED_DATABASE_URL` is validated before the shared Prisma client is imported. The seed process sets its own `DATABASE_URL` to that validated target; the API's configuration file remains untouched.
The script reuses `src/config/prisma.ts`. Prisma's migration command separately uses `DIRECT_URL`; if preparing migrations, explicitly point `DIRECT_URL` to the same verified development database.

From the repository root, after setting the variables above:

```powershell
cd D:\uxmm\server
npm run seed:dev
```

There is no automatic seed on install, startup, migration or build. The script exits nonzero with a sanitized message if safety settings, ownership, verification, delivery service, or database access fail.
It creates ten fictional fixtures, with non-dialable `TEST-NOT-DIALABLE-*` contact strings, fictional Myanmar addresses, optional/ambiguous instructions, varied weights/COD and existing statuses.
These contact strings deliberately cannot be submitted as real phone numbers through the SME create API.
Fixtures use valid existing order-code format `PODEAD000000000001` through `PODEAD000000000010`, with deterministic SHA-256 QR identifiers.
They are initial fixture snapshots, not fabricated delivery histories; existing history is preserved on subsequent runs.
The seeder only reads profiles, accounts' verification timestamps and delivery-service availability, then inserts orders.
It never creates credentials, changes roles, deletes records or updates existing orders. Existing fixture codes are skipped, including operationally modified records. Concurrent uniqueness conflicts do not overwrite records.
If a run partially succeeds, rerun after correcting the development configuration; existing fixtures are skipped.

## Manual checks

1. Start the server with `npm run dev`. Open `/api/docs` and authorize using an existing OPERATOR access token.
2. Request `/api/operator/orders?page=1&pageSize=5&status=CREATED&search=PO`.
3. Request `/api/operator/orders/<returned UUID>`; check seller, decimal values and status history.
4. Repeat both requests without a token (401), with SME/RIDER tokens (403), and with malformed query/UUID (400).
5. Query a missing UUID (404). Verify `/api/orders` still rejects OPERATOR and retains SME ownership rules.
6. Only on the verified local development database, run the seed twice; second run skips all ten. Modify a fixture operationally and rerun; the modification must remain unchanged.

## Validation

`npm test` builds TypeScript and runs node:test. Current results: 26 passed, 0 failed, 2 database-dependent tests skipped (28 total).
Operator tests use real Express/auth middleware with mocked session storage and Prisma methods; no database is contacted.
They inspect repository projections, filters, ordering, repeatable-read isolation, pagination, safe serialization, role boundaries and history.
Seeder tests cover target restrictions, opt-in, owner verification/role, active service, fixture validity, idempotency and preservation of modifications.
The Swagger route inventory test now includes existing SME order routes and new Operator routes.
`prisma validate` passed. No backend ESLint configuration/script is present.
Actual database integration and fixture insertion remain unverified until a separate safe database is supplied.

## Security finding and next milestone

The existing SME `PATCH /api/orders/:id/status` checks ownership and valid transitions, but lets an SME owner advance CREATED → PICKED_UP → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED, or set FAILED along permitted transitions.
This is an operational authorization risk: shop owners can assert delivery outcomes. No changes were made to the SME module as requested.
Recommended minimal coordinated fix: restrict SME transitions to an explicitly agreed owner action such as CREATED → CANCELLED, and move operational transitions to role/assignment-protected Operator and Rider workflows.

Receiving is now implemented as documented in [Operator Parcel Receiving](OPERATOR_PARCEL_RECEIVING.md). Next milestone: coordinate the shared assignment schema/API with the Rider developer before implementing assignment. Warehouse changes, Rider delivery mutations, AI and enum changes remain outside this work.
