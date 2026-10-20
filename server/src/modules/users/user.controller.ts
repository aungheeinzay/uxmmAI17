import { asyncHandler } from "../../middleware/async-handler";
import * as service from "./user.service";
import { profileUpdateSchema } from "./user.validation";

export const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.getProfile(req.auth!.id) });
});
export const updateMe = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.updateProfile(req.auth!.id, profileUpdateSchema.parse(req.body)) });
});
