# ParcelOps AI — Backend Agent Rules

## 1. Role

Act as a senior backend engineer working on ParcelOps AI.

Follow the existing architecture, prioritize simple and secure solutions, and avoid overengineering.

This is a 48-hour AI-native Buildathon MVP.


## 2. Tech Stack

- Node.js
- Express.js
- TypeScript (strict mode)
- Prisma ORM
- Supabase PostgreSQL
- Supabase Authentication
- Zod
- OpenRouter API (future phase)

Do not introduce another ORM, database, or backend framework without explicit approval.

## 3. Mandatory Architecture

Use **Modular Monolith Architecture**.

Every business module must follow:

`Router → Middleware → Controller → Service → Repository → Prisma → PostgreSQL`

Separate HTTP concerns, business logic, and database access.

### Required Structure

```text
apps/server/
├── AGENTS.md
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── app.ts
│   ├── server.ts
│   ├── config/
│   │   ├── env.ts
│   │   ├── prisma.ts
│   │   └── supabase.ts
│   ├── lib/
│   │   ├── errors/
│   │   │   ├── app-error.ts
│   │   │   └── error-handler.ts
│   │   └── middleware/
│   │       ├── require-auth.ts
│   │       └── require-role.ts
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.router.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.validation.ts
│   │   └── users/
│   │       ├── user.router.ts
│   │       ├── user.controller.ts
│   │       ├── user.service.ts
│   │       ├── user.repository.ts
│   │       ├── user.validation.ts
│   │       └── user.types.ts
│   └── types/
│       └── express.d.ts
└── package.json
```

Adapt paths to the actual repository rather than duplicating existing files.

Do not create modules for unimplemented features.

## 4. Layer Responsibilities

### Router — `*.router.ts`

- Define REST endpoints.
- Apply middleware.
- Connect routes to controllers.
- No business logic or database queries.

### Controller — `*.controller.ts`

- Handle Express requests and responses.
- Validate request data using Zod.
- Call services.
- Return consistent HTTP responses.
- Never call Prisma or repositories directly.

### Service — `*.service.ts`

- Implement business rules and workflows.
- Enforce role and resource-level authorization.
- Coordinate repositories and external integrations.
- Throw application errors for expected failures.
- Never depend on Express Request or Response.
- Never execute Prisma queries directly.

### Repository — `*.repository.ts`

- Encapsulate Prisma database operations.
- Use the shared Prisma client.
- Handle queries, persistence and data mapping.
- Keep business rules out of repositories.
- Do not import controllers or HTTP middleware.

### Validation — `*.validation.ts`

- Define Zod request schemas.
- Export inferred input types where useful.
- Never perform database operations.

### Types — `*.types.ts`

- Define module-specific types and interfaces.
- Prefer Zod-inferred and Prisma-generated types when appropriate.
- Avoid duplicate type definitions.

## 5. Prisma ORM Rules

Prisma is the only ORM for application database operations.

- Use one shared Prisma client or the project's established Prisma adapter.
- Do not create a new Prisma client per HTTP request.
- Keep database access inside repository modules.
- Define application models in `prisma/schema.prisma`.
- Manage schema changes using Prisma migrations.
- Do not use `prisma db push` as the standard migration workflow.
- Do not reset or drop databases without explicit approval.
- Keep database credentials server-side.
- Use transactions for operations requiring atomicity.
- Use database constraints for important invariants.
- Select only necessary fields where practical.
- Avoid unnecessary raw SQL.
- Follow the installed Prisma version and its supported configuration conventions.

### Example

Correct:

```ts
// user.repository.ts
import { prisma } from "../../config/prisma.js";

export async function findUserById(id: string) {
  return prisma.profile.findUnique({
    where: { id },
  });
}
```

Incorrect:

```ts
// user.controller.ts
const user = await prisma.profile.findUnique({
  where: { id: req.params.id },
});
```

## 6. Supabase Integration Rules

Use Supabase for two separate responsibilities:

**Supabase Auth**
- User registration
- Login and identity verification
- Session/token management

**Supabase PostgreSQL + Prisma**
- User profiles
- Roles
- Application data
- Future orders and delivery records

Do not store user passwords in Prisma models.
## Role-Based Authorization Rules

Before implementing or modifying authentication,
authorization, orders, warehouse, rider assignments,
or delivery status workflows:

1. Read `./PERMISSIONS.md` completely.
2. Treat `PERMISSIONS.md` as the authoritative source
   for role permissions and order status transitions.
3. Enforce permissions in Express middleware and
   service-level business logic.
4. Never weaken existing authentication or authorization.
5. If the implementation conflicts with PERMISSIONS.md,
   report the conflict before changing shared contracts.
6. Update tests and Swagger documentation when
   implementing approved permission changes.

These rules apply to SME, OPERATOR, and RIDER modules.
### Identity and Profiles

- Supabase Auth manages `auth.users`.
- Prisma manages application profiles in `public.profiles`.
- Profile IDs must correspond to Supabase Auth user IDs.
- Public registration must assign the `SME` role.
- Never accept privileged roles from public registration payloads.
- Create profiles through one secure, clearly documented provisioning mechanism.
- Handle email confirmation, missing sessions, retries and partial registration failures.
- Avoid duplicate profile creation paths.

Do not let users modify their roles through profile update APIs.

### Supabase RLS and Prisma

Important: Prisma database connections do not automatically inherit the authenticated Supabase user's JWT context.

Do not assume Supabase RLS policies automatically restrict Prisma queries to the requesting user.

Enforce authentication, roles and resource ownership explicitly in backend services and queries.

Keep RLS enabled and define appropriate policies for any supported direct Supabase client access.

Use least-privilege database credentials wherever practical and explain any necessary elevated access.

## 7. Authentication and Authorization

Application roles:

- `SME`
- `OPERATOR`
- `RIDER`

Implement:

- `requireAuth`
- `requireRole(...roles)`

### Authentication Rules

- Verify Supabase access tokens using a supported secure method.
- Reject missing, invalid or expired tokens.
- Load application roles from trusted backend data.
- Attach typed user information to the request.
- Never trust unverified JWT payloads.

### Authorization Rules

- SME can access only their own resources.
- Operator can access permitted operational resources.
- Rider can access only assigned deliveries.
- Always verify resource ownership or assignment.
- Never rely on frontend authorization alone.
- Never expose a public role modification endpoint.

Use:

- `401` for unauthenticated requests.
- `403` for insufficient permissions.
- `404` where hiding resource existence is appropriate.

## 8. Validation and Error Handling

Use Zod for external request validation.

Use centralized error handling.

Standard successful response:

```json
{
  "success": true,
  "data": {}
}
```

Standard error response:

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission."
  }
}
```

Never leak internal errors, database connection strings, passwords, secrets or access tokens.

## 9. TypeScript and Naming Conventions

Use strict TypeScript.

Naming conventions:

- `user.controller.ts`
- `user.service.ts`
- `user.repository.ts`
- `user.router.ts`
- `user.validation.ts`
- `user.types.ts`

Rules:

- Avoid `any`.
- Prefer small, focused functions.
- Use async/await.
- Use consistent ESM imports where configured.
- Prefer explicit service return types for public contracts.
- Avoid circular dependencies.
- Follow existing project conventions.

## 10. Cross-Module Communication

Modules must not access another module's repository directly.

Preferred flow:

`OrderService → UserService → UserRepository`

Not:

`OrderService → UserRepository`

Keep cross-module dependencies minimal and avoid circular imports.

Shared infrastructure belongs in `config/` or `lib/`.

## 11. AI Integration Rules

AI features will be implemented later.

When implemented:

- Keep AI API keys on the server.
- Access OpenRouter through a dedicated backend integration.
- Validate AI outputs with Zod.
- Treat customer messages and AI outputs as untrusted data.
- Do not let AI automatically create, cancel or modify orders without appropriate user confirmation.
- Handle AI timeouts, rate limits and failures gracefully.
- Never fabricate tracking information.

Do not implement AI features during Phase 1.

## 12. Current Scope — Phase 1

Only implement:

- Project configuration
- Prisma setup and database migration
- Supabase Auth integration
- User profile management
- Authentication middleware
- Role authorization middleware
- Centralized error handling
- Auth-related API endpoints
- Tests

Do not implement:

- Orders
- Dispatch
- Rider delivery operations
- AI extraction
- Notifications
- Reports

## 13. Codex Execution Rules

Before coding:

1. Read root `AGENTS.md` if available.
2. Read this backend `AGENTS.md`.
3. Inspect existing source code.
4. Identify affected modules.
5. Present a concise implementation plan.
6. Ask for approval if architecture, schema or authentication design must change.

During coding:

- Follow the defined dependency direction.
- Modify only related files.
- Avoid unnecessary packages.
- Preserve existing working code.
- Do not edit secret environment files.
- Do not change migrations without reviewing their impact.

After coding:

1. Summarize changed files.
2. Run TypeScript checks.
3. Run relevant tests.
4. Report actual results.
5. Explain how to test the feature.
6. State unresolved risks or assumptions.

Never claim tests passed unless they were executed.

## 14. Final Rule

**Controllers handle HTTP. Services handle business logic. Repositories handle Prisma. Supabase Auth handles identity.**

Keep the backend simple, modular, secure and maintainable.

Do not expand beyond the approved milestone.