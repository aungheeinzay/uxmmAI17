import { asyncHandler } from "../../../middleware/async-handler";
import * as service from "./report.service";
import { reportQuerySchema } from "./report.validation";

export const overview = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.overview(req.auth!, reportQuerySchema.parse(req.query)) });
});
