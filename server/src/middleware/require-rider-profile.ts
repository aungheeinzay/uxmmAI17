import type { RequestHandler } from "express";
import { AppError } from "../lib/errors/app-error";
import { assertRiderProfileComplete } from "../modules/riders/profile/rider-profile.service";

// Delivery-operation boundary only. Profile completion, auth session and logout stay reachable.
export const requireCompleteRiderProfile: RequestHandler = async (req, _res, next) => {
  try {
    if (!req.auth) throw new AppError(401, "UNAUTHORIZED", "Authentication required.");
    if (req.auth.role !== "RIDER") throw new AppError(403, "FORBIDDEN", "Insufficient permissions.");
    await assertRiderProfileComplete(req.auth.id);
    next();
  } catch (error) {
    next(error);
  }
};
