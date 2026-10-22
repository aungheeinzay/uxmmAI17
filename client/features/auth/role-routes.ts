import type { AuthUser } from "./types/auth.types";
export type UserRole = AuthUser["role"];
export const roleRoutes = { SME: "/seller", OPERATOR: "/operator", RIDER: "/rider" } as const satisfies Record<UserRole, string>;
export const roleLabels = { SME: "Seller", OPERATOR: "Operator", RIDER: "Rider" } as const satisfies Record<UserRole, string>;
