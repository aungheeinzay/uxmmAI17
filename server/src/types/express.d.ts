import type { Role } from "../generated/prisma/enums";

declare global {
  namespace Express {
    interface Request {
      auth?: { id: string; email?: string; role: Role; accessToken: string };
    }
  }
}
export {};
