import type { RequestHandler } from "express";
import type { Role } from "../generated/prisma/enums";
import { AppError } from "../lib/errors/app-error";

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(new AppError(401, "UNAUTHORIZED", "Authentication required."));
    if (!roles.includes(req.auth.role)) return next(new AppError(403, "FORBIDDEN", "Insufficient permissions."));
    next();
  };
}
