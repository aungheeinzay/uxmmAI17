# Operator dashboard and profile settings

## Architecture and routes

Pages compose feature components; hooks manage interactions; typed API services use the existing transport and Express remains the authority. No additional dependencies, authentication provider or store were introduced.

The existing Operator layout retains `RoleGuard role="OPERATOR"` and now renders `OperatorLayout` instead of the shared minimal dashboard shell. Seller and Rider layouts and features are unchanged. Existing Rider Management page edits and its invitation form are preserved.

Routes:

| Route | Function |
| --- | --- |
| `/operator` | Overview with summary cards, recent incoming/unassigned sections, quick actions and activity status |
| `/operator/riders` | Existing Rider invitation feature |
| `/operator/settings` | Current profile and name/phone editing |
| `/operator/parcels` | Incoming Parcels placeholder |
| `/operator/warehouse` | Warehouse placeholder |
| `/operator/assignments` | Rider Assignment placeholder |
| `/operator/monitoring` | Delivery Monitoring placeholder |
| `/operator/reports` | Reports placeholder |

## Components and navigation

`features/operator/config/operator-navigation.ts` defines all navigation destinations and exact/descendant matching. The Dashboard item matches only `/operator`.

`OperatorSidebar` supplies brand navigation, accessible links and active `aria-current` indicators. `OperatorLayout` provides a collapsible desktop sidebar, current page header, skip link, content container, profile dropdown and the existing `useLogout` action. The mobile drawer uses the installed Radix Dialog with focus management, Escape dismissal, labelled controls and close-on-navigation. The profile dropdown uses installed Radix DropdownMenu. Existing shadcn Button, Card, Input, Label and Alert primitives and theme tokens are reused; no component library is added.

`OperatorDashboard` renders neutral disconnected states rather than invented parcel counts. Quick actions link to incoming parcels, Riders and assignments. `OperatorPlaceholder` supplies consistent Coming Soon pages. No operational APIs or business actions are implemented.

## Authorization and session handling

The existing guard verifies the backend identity before rendering protected content and revalidates on protected path changes. Anonymous users go to Login; SME and Rider users go to their allowed workspaces. Loading and session failure/retry states are preserved. Express must authorize all future operational endpoints independently of frontend guards.

Authentication cookies remain HttpOnly, SameSite Strict and scoped to `/api/session`. No token is exposed to client state or storage. Zustand continues to hold only the existing ephemeral profile identity/status. Logout uses the existing implementation and clears UI identity before revoking the backend session.

## Profile flow and API contract

The settings component reuses `useCurrentUser` for profile loading, error/retry and current backend identity. No duplicate profile fetch/store is added. The existing session restoration calls trusted `GET /api/users/me`.

The actual profile response supplies id, role, nullable fullName and phone. It does not include account email or verification status. Settings displays a read-only unavailable email field with an explanation, and read-only role/profile ID. The dropdown shows the returned name and Operator role. Email is not inferred from login input or persisted separately.

`features/profile/schemas/profile.schema.ts` matches backend update rules: optional nullable trimmed fullName (1-120 characters when non-null), phone (1-32 characters when non-null), strict allowed fields and at least one property. No phone-format rule is invented. The UI accepts blanks and the API service converts them to null to clear fields.

`ProfileSettingsForm` uses React Hook Form and Zod, accessible errors, pending/disabled state, save confirmation and safe API failure feedback. `useUpdateProfile` locks duplicate submissions, updates the existing store only if the same identity/session revision remains active, and returns the confirmed profile to reset form defaults. Late responses cannot restore a logged-out identity.

`features/profile/api/profile.api.ts` sends only name and phone through `POST /api/session/profile`. That fixed BFF operation reuses the existing origin/content-type validation, authentication, refresh rotation, bounded body and error/cookie helpers. It validates the payload, forwards authenticated `PATCH /api/users/me`, verifies returned identity/role, strips extra response fields and preserves rotated cookies on recoverable update errors. This self-profile operation preserves Express's existing permissions; the Operator page itself is role-protected.

Minimal shared extensions:

- `features/auth/server/express-auth.ts`: optional PATCH method; existing GET/POST defaults are preserved.
- `features/auth/server/session.ts`: fixed self-profile update operation using existing helpers.

No backend contracts, Prisma schema, token storage, cookie settings or authentication architecture were changed.

## Validation

Executed successfully:

- Frontend test suite: 109 tests across 9 files.
- ESLint.
- TypeScript checking (including production build type check).
- Next.js production build: all Operator routes and the fixed profile session endpoint generated.

New tests cover desktop collapse/active links, mobile drawer Escape dismissal, dropdown/logout, empty dashboard states, profile payloads/updates/validation/read-only fields, duplicate locks and stale responses. BFF tests cover authenticated PATCH, response filtering, anonymous/cross-site rejection, role/email injection, identity consistency and cookie preservation after refresh. Existing authorization, invitation, activation and session tests also pass.

Manual browser testing and live database profile persistence were not performed. Tests use simulated browser DOM and mocked HTTP or existing in-memory backend repositories.

## Manual verification

1. Start the configured Express and Next.js services and sign in as Operator. Confirm dashboard loading precedes rendering and all sidebar destinations load.
2. At desktop width collapse/expand the sidebar. At mobile width open the drawer, tab through links, press Escape, and select a route. Check focus return, active links and horizontal overflow.
3. Open profile dropdown and Settings. Confirm saved name/phone load, email/role are read-only and unavailable email is explained.
4. Save name/phone changes, clear fields, and refresh to verify database persistence. Check long values and network failures retain editable input and show feedback.
5. Invite a Rider through Rider Management and exercise the existing activation/login flow.
6. Sign out and revisit protected routes. Repeat as SME, Rider and anonymous visitors; confirm redirects without protected content flashing.

## Limits and future integration

Email/verification display requires a separately approved backend profile response extension. No email-change, role-change or image-upload flow exists. Overview metrics, lists and activity remain disconnected until parcel/assignment/reporting APIs are available; future feature hooks/API services should replace these explicit empty states while retaining Express authorization. Placeholder routes intentionally provide no operations.
