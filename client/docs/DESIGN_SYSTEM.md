# SURFERTrack design system

Applied from the supplied `ds.jpg` reference. The user confirmed SURFERTrack as the visible frontend brand. Backend contracts, credentials, cookie names and workflows retain their existing identities.

Shared tokens live in `app/globals.css`: primary #0A63F5, navy #1B2F5A, indigo #3D51A3, red #EF4443, green #10B981, amber #F59E0B, info #3B82F6, primary text #111827, secondary text #6B7280, borders #E5E7EB, blue tint #E3EEFF and background #F8FAFC. White cards use restrained borders and shadows. The existing dark theme retains readable blue actions and status colors.

Inter is loaded with Next's font integration. Heading scale: 32/40, 28/36, 24/32, 20/28; body sizes retain 16/24, 14/20 and 12/16. Buttons use 10px radii, semibold labels and 44px/52px primary sizes. Compact variants remain available for dense controls. Disabled, focus, pressed, outline, secondary and danger states use shared primitives.

Order statuses are unchanged. Badges use tinted backgrounds, borders, a dot, and a check for delivered: transit blue, picked-up/delivered green, out-for-delivery amber, failed red, created/cancelled neutral. Existing text labels and unknown-status fallbacks are preserved. Accepted history events use connected timeline dots; no unrecorded future events are fabricated.

This update affects shared frontend styling, visible frontend branding, Operator sidebar, parcel cards and status/history presentation. It adds no API, database migration, permissions or business-rule changes.

Verification: 229 existing frontend tests passed; TypeScript, ESLint and production build passed. Browser visual verification was attempted, but the connected browser inventory was empty. Inspect the result in your running browser, especially mobile parcel cards and dense tables. No commit or push is included in this design update.
