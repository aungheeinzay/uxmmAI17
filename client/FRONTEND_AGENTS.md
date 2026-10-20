# ParcelOps AI — Frontend Agent Rules

> **Scope:** `apps/web/**`  
> **Purpose:** Mandatory instructions for Codex and developers working on the Next.js frontend.  
> **Reference:** https://www.patterns.dev/react/  
> **Priority:** Working, secure, maintainable code over pattern-driven complexity.

## 1. Stack and boundaries

- Next.js App Router, React, TypeScript (`strict`), Tailwind CSS, shadcn/ui, Lucide icons.
- Express REST API is the backend and source of business decisions.
- Use Zod + React Hook Form for interactive forms.
- Prefer TanStack Query for client-side remote data and mutations **when installed/approved**.
- Use Zustand **only when shared client-side state warrants it**, not as the default.
- Do not introduce Auth.js, Supabase Auth, a second API backend, or a new state/UI library without approval.
- Read root `AGENTS.md` and this file before changing code. Preserve existing conventions.

## 2. Feature-first architecture

```text
apps/web/
├── AGENTS.md
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   ├── verify-email/page.tsx
│   │   │   ├── forgot-password/page.tsx
│   │   │   └── reset-password/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── seller/
│   │   │   ├── operator/
│   │   │   └── rider/
│   │   ├── layout.tsx
│   │   └── providers.tsx
│   ├── components/
│   │   ├── ui/                 # shadcn/ui generated primitives
│   │   └── shared/             # truly cross-feature UI
│   ├── features/
│   │   ├── auth/
│   │   │   ├── api/auth.api.ts
│   │   │   ├── components/login-form.tsx
│   │   │   ├── components/register-form.tsx
│   │   │   ├── hooks/use-login.ts
│   │   │   ├── hooks/use-register.ts
│   │   │   ├── schemas/auth.schema.ts
│   │   │   └── types/auth.types.ts
│   │   ├── orders/
│   │   └── dispatch/
│   ├── lib/
│   │   ├── api-client.ts
│   │   ├── query-client.ts       # only if using TanStack Query
│   │   └── utils.ts
│   └── stores/                    # only if Zustand is truly needed
```

Adapt to the actual repository (with or without `src/`). Do not create empty folders, placeholder modules, or unnecessary `index.ts` barrels.

- `app/`: routing, route-level metadata, layout, server/client boundaries; keep `page.tsx` thin.
- `features/<domain>/api/`: typed network functions; no React imports.
- `features/<domain>/hooks/`: orchestration, mutations, UI behavior; no JSX.
- `features/<domain>/components/`: feature-specific UI.
- `features/<domain>/schemas/`: Zod schemas.
- `components/ui/`: shadcn primitives; keep changes deliberate and minimal.
- `components/shared/`: only reusable cross-domain components.
- `lib/`: cross-cutting utilities and API transport; **not** a dumping ground for business logic.

## 3. Component design principles

- Use functional components and composition by default.
- Each component has a coherent single responsibility.
- Prefer explicit, typed props and small, focused components.
- Separate data orchestration from presentational UI when this meaningfully improves readability/testing.
- Use custom hooks to encapsulate repeated or nontrivial stateful behavior.
- Keep ordinary local UI state in `useState`, not global stores.
- Avoid premature abstractions, prop drilling workarounds that hide ownership, and giant `page.tsx` files.
- Do not force every component into a container/presentational split.
- Use Server Components by default; add `"use client"` only at the smallest necessary interactive boundary.
- Never import server-only secrets/modules into Client Components.

## 4. Pattern selection (informed by patterns.dev/react)

| Pattern | Default guidance | ParcelOps example |
| --- | --- | --- |
| **Custom Hooks / Hooks Pattern** | **Preferred** for reusable stateful behavior | `useLogin`, `useRegister`, `useOrders` |
| **Container/Presentational** | Preferred for complex data-driven UI | `OrdersContainer` + `OrdersTable` |
| **Compound Components** | Use for cohesive, multi-part reusable UI | shadcn Dialog, Tabs, Sheet |
| **Render Props** | Use **selectively** when the caller must control rendering of shared behavior | reusable interaction/selection controller |
| **HOC** | Avoid by default; use only for a specific justified cross-cutting requirement | uncommon |
| **Composition** | Default for composing reusable components | dashboard layouts, cards, forms |

Do **not** use render props simply to demonstrate the pattern. A hook or plain composition is usually simpler.

Reference pages:
- https://www.patterns.dev/react/
- https://www.patterns.dev/react/hooks-pattern/
- https://www.patterns.dev/react/container-presentational-pattern/
- https://www.patterns.dev/react/compound-pattern/
- https://www.patterns.dev/react/render-props-pattern/
- https://www.patterns.dev/react/hoc-pattern/

Treat these as design references, not mandatory templates. Prefer modern React and Next.js conventions when older examples conflict with them.

## 5. Authentication feature contract

The existing **Express backend owns authentication**:
- Email/password registration and login
- Email verification and resend
- Forgot/reset password
- Opaque access/refresh tokens, refresh rotation, logout
- `SME`, `OPERATOR`, `RIDER` authorization

Do **not** implement a second authentication/session system in Next.js.

For login and registration:
1. `auth.api.ts` owns typed HTTP functions: `login`, `register`, etc.
2. `auth.schema.ts` owns Zod form schemas.
3. `use-login.ts`, `use-register.ts` own mutations, server-error translation, and successful navigation/invalidation as appropriate.
4. `login-form.tsx`, `register-form.tsx` own form markup and user interaction.
5. `page.tsx` composes the feature and page layout.

Example dependency flow:

```text
app/(auth)/login/page.tsx
  └── features/auth/components/login-form.tsx
        └── features/auth/hooks/use-login.ts
              └── features/auth/api/auth.api.ts
                    └── lib/api-client.ts
                          └── Express API
```

Example hook shape (adapt imports/API contracts to real code):

```ts
export function useLogin() {
  return useMutation({
    mutationFn: login,
    // Only perform side effects justified by the agreed session contract.
  });
}
```

Never invent API shapes; inspect Swagger/OpenAPI or backend contracts first.

### Token/session security — mandatory decision before auth UI

The current backend documents JSON opaque access/refresh tokens. **Do not persist a refresh token or access token in Zustand persist or localStorage by default.** Before production-facing auth implementation, agree on a secure session transport design, preferably a reviewed HttpOnly cookie/BFF strategy with SameSite, Secure and CSRF protections where relevant. A Next.js route handler may proxy Express only if explicitly approved; do not introduce such a proxy silently.

- Avoid logging or exposing credentials and tokens.
- Don't put tokens in URL query strings.
- Redirects must use allowlisted internal destinations.
- Frontend route checks improve UX; **Express is the authorization authority**.
- Client role information is for rendering, not granting permissions.
- Handle unauthenticated/expired/refresh-failed cases consistently.
- Never make the browser authenticate by accessing Prisma or the database directly.

## 6. Data fetching and state ownership

| State | Owner |
| --- | --- |
| Order lists, delivery statuses, user profiles | Server / TanStack Query if client-fetched |
| Form values/errors | React Hook Form + Zod |
| Simple toggles, dialog visibility | Local `useState` or shadcn controls |
| Shareable filters, pagination | URL search params when appropriate |
| Complex shared, ephemeral UI state | Zustand only if justified |
| Auth permissions and data ownership | Express backend |

- Never duplicate an entire server response in Zustand.
- Prefer query invalidation/refetch after successful mutations.
- Use stable query keys scoped by authenticated identity where needed.
- Do not hydrate one user's sensitive cached data into another user's session.
- Do not store derived state when it can be computed from existing state.

## 7. shadcn/ui and styling rules

- Reuse existing shadcn/ui primitives (Button, Input, Form/Field, Dialog, Sheet, Table, Badge, Select, Skeleton, Alert, etc.).
- Follow the installed shadcn/ui and Tailwind versions and project setup, not outdated examples.
- Compose feature components around primitives; do not rewrite primitive components for each feature.
- Use Tailwind utilities, CSS variables, semantic design tokens, and the `cn()` helper where appropriate.
- Provide accessible labels, keyboard support, focus states, loading/disabled states, validation errors, and responsive layouts.
- Use consistent spacing, typography, and responsive behavior across SME, Operator and Rider views.
- Prioritize operational clarity over decorative animation.

## 8. API integration and errors

- Keep the API base URL in validated configuration.
- Use typed request and response contracts; don't invent field names.
- Centralize network error handling and HTTP status parsing.
- Display safe, actionable messages for common `400`, `401`, `403`, `404`, `409`, `429`, and `5xx` responses.
- Use `AbortSignal` when appropriate for cancelable requests.
- Never import Prisma, repositories, or backend-only modules into frontend components.
- Validate untrusted browser input; don't treat frontend Zod validation as a substitute for backend validation.

## 9. Feature examples and naming

Prefer descriptive kebab-case filenames:
- `login-form.tsx`, `register-form.tsx`, `orders-table.tsx`
- `use-login.ts`, `use-register.ts`, `use-orders.ts`
- `auth.api.ts`, `order.api.ts`
- `auth.schema.ts`, `order.schema.ts`

Use named exports for shared components/functions where practical; respect Next.js-required default exports for pages/layouts.

No magic role strings scattered through JSX. Prefer shared typed role constants or domain types aligned with backend contracts.

## 10. Quality and performance

- Keep Next.js Server Components server-side when feasible.
- Add Suspense/loading boundaries where helpful.
- Include meaningful loading, error, empty, success, and pending states.
- Avoid unnecessary effects for derived state and render-time calculations.
- Do not add `memo`, `useMemo`, or `useCallback` without a demonstrated need.
- Prevent duplicate form submissions.
- Confirm destructive operations.
- Keep UI responsive and usable at mobile widths, especially Rider screens.
- Don't overbuild a design system for the Buildathon.

## 11. Tests and completion checks

For meaningful features, test:
- Zod valid/invalid input
- Form submission and disabled/pending behavior
- API success/error handling
- Route/auth UX behavior
- Data ownership assumptions (verified by backend tests, not UI-only)
- A11y basics and keyboard interactions

Run available lint, TypeScript check, build, and relevant tests. Report the actual results; never claim checks passed if not executed.

## 12. Codex working agreement

**Before changes:** Inspect existing code, root `AGENTS.md`, this file, installed dependencies, and real Swagger/backend contracts. Briefly identify the affected feature and chosen pattern.

**During changes:** Modify only related files. Follow feature boundaries. Implement simple code first. Add a custom hook when it provides meaningful separation. Don't add Zustand, render props, HOCs, or dependencies without a specific need.

**After changes:** Summarize files changed, chosen pattern, API assumptions, tests executed, and remaining limitations.

For architecture changes, auth session handling changes, significant dependencies, and changes to backend contracts: propose the approach and request approval first.

## Final rule

**Pages compose features. Components render UI. Hooks orchestrate interaction. API modules talk to Express. Express owns business rules and authorization.**

Use patterns to reduce complexity — never to demonstrate complexity.
