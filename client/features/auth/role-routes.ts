import type { AuthUser } from "./types/auth.types";
export type UserRole = AuthUser["role"];
export const roleRoutes = { SME: "/seller", OPERATOR: "/operator", RIDER: "/rider" } as const satisfies Record<UserRole, string>;
