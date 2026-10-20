import { asyncHandler } from "../../middleware/async-handler";
import { AppError } from "../../lib/errors/app-error";
import * as service from "./rider.service";
import { activateRiderSchema, inviteRiderSchema } from "./rider.validation";

export const invite = asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "UNAUTHORIZED", "Authentication required.");
  res.status(201).json({ success: true, data: await service.inviteRider(req.auth, inviteRiderSchema.parse(req.body)) });
});
export const activate = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.activateRider(activateRiderSchema.parse(req.body)) });
});
