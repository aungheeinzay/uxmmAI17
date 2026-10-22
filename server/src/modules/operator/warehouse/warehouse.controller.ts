import { asyncHandler } from "../../../middleware/async-handler";
import { warehouseOverviewQuerySchema, warehouseQuerySchema } from "./warehouse.validation";
import * as service from "./warehouse.service";
export const overview = asyncHandler(async (req, res) => {
  warehouseOverviewQuerySchema.parse(req.query);
  res.json({ success: true, data: await service.overview(req.auth!) });
});
export const parcels = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.parcels(req.auth!, warehouseQuerySchema.parse(req.query)) });
});
