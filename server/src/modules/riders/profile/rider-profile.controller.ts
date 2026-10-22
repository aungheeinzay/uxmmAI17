import { asyncHandler } from "../../../middleware/async-handler";
import * as service from "./rider-profile.service";
import { riderProfileUpdateSchema } from "./rider-profile.validation";

export const get = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.getRiderProfile(req.auth!) });
});

export const update = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.updateRiderProfile(req.auth!, riderProfileUpdateSchema.parse(req.body)) });
});
