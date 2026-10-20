# ParcelOps AI backend

Express, TypeScript, Prisma, and Supabase PostgreSQL. See [AUTH.md](AUTH.md) for
the database-backed authentication workflow and configuration.

## Start

Configure `server/.env` using `.env.example`, then run from `server`:

```powershell
npm install
npm run db:migrate
npm run dev
```

## Swagger UI

- UI: [http://localhost:3000/api/docs](http://localhost:3000/api/docs)
- OpenAPI 3.0 JSON: [http://localhost:3000/api/docs.json](http://localhost:3000/api/docs.json)
- Health: [http://localhost:3000/health](http://localhost:3000/health)

Use your configured port if it differs from 3000.

1. Expand **Authentication > POST /api/auth/register**, click **Try it out**, enter
   a new email/password, and click **Execute**. Registration returns a session.
   Use **POST /api/auth/login** for an existing account.
2. Copy the returned `data.accessToken`. Click **Authorize**, paste only the token
   without a `Bearer` prefix, and click **Authorize** in the dialog.
3. Try **Users > GET /api/users/me** or **PATCH /api/users/me**. Swagger UI adds the
   Bearer header automatically. Requests still pass through normal authentication.
4. To refresh, send `data.refreshToken` in the JSON body of **POST /api/auth/refresh**.
   Replace both stored tokens and update **Authorize** with the new access token.
5. Call **POST /api/auth/logout** to revoke the current session. Clear authorization
   in the UI afterward. Swagger does not automatically manage token rotation.

The API uses opaque tokens, not JWTs. Register, login, refresh, and health are public;
profile and logout endpoints require an access token. Examples contain dummy values.
Authorization is not persisted across page reloads. Avoid using production accounts
for interactive testing.

### Environment controls

Documentation is enabled outside production by default. Both the UI and JSON
endpoint are disabled when `NODE_ENV=production`, unless explicitly enabled:

```dotenv
ENABLE_API_DOCS=true
```

Set `ENABLE_API_DOCS=false` to disable documentation in any environment. Only the
literal strings `true` and `false` are accepted. Disabled documentation returns the
normal API 404 response. Enabling docs never bypasses API authorization or rate limits.

## Documentation structure

- `src/config/swagger.ts`: document assembly, Bearer scheme, health, and UI routes.
- `src/lib/openapi.ts`: shared request, response, error, and schema helpers.
- `src/modules/auth/auth.openapi.ts`: authentication paths and session responses.
- `src/modules/users/user.openapi.ts`: profile paths and response schemas.

Request schemas are generated from existing Zod schemas using `z.toJSONSchema`
with the OpenAPI 3.0 target. Response schemas describe the existing API responses.
Custom refinements that cannot be represented automatically need explicit schema
constraints; for example, profile updates add `minProperties: 1`.

For a future module, add its `*.openapi.ts` beside its router. Export its paths and
component schemas, then merge them into `src/config/swagger.ts` and register its
tag. Reuse the helpers and Error schema, use unique operation IDs, describe actual
status codes, and set `security: []` for public operations or Bearer security for
protected ones. Do not add documentation for endpoints before implementing them.

## Verification

```powershell
npm test
```

Builds TypeScript and runs authentication and documentation tests. Automated auth
tests mock persistence; they do not change the live database. Documentation tests
check paths, schemas, UI assets, public/protected access, and production restrictions.
