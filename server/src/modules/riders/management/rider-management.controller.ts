import { z } from "zod";
import { asyncHandler } from "../../../middleware/async-handler";
import * as service from "./rider-management.service";
import { emptyBodySchema, operatorRiderUpdateSchema, riderManagementQuerySchema, riderDetailQuerySchema } from "./rider-management.validation";
const riderId = (value: unknown) => z.string().uuid().parse(value);
export const list = asyncHandler(async (req, res) => { res.json({ success: true, data: await service.list(req.auth!, riderManagementQuerySchema.parse(req.query)) }); });
export const overview = asyncHandler(async (req, res) => { z.object({}).strict().parse(req.query); res.json({ success: true, data: await service.overview(req.auth!) }); });
export const invitations = asyncHandler(async (req, res) => { res.json({ success: true, data: await service.invitations(req.auth!, riderDetailQuerySchema.parse(req.query)) }); });
export const detail = asyncHandler(async (req, res) => { res.json({ success: true, data: await service.detail(req.auth!, riderId(req.params.riderId), riderDetailQuerySchema.parse(req.query)) }); });
export const update = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.update(req.auth!, riderId(req.params.riderId), operatorRiderUpdateSchema.parse(req.body)) });
});
export const deactivate = asyncHandler(async (req, res) => {
  emptyBodySchema.parse(req.body ?? {});
  res.json({ success: true, data: await service.deactivate(req.auth!, riderId(req.params.riderId)) });
});
export const reactivate = asyncHandler(async (req, res) => {
  emptyBodySchema.parse(req.body ?? {});
  res.json({ success: true, data: await service.reactivate(req.auth!, riderId(req.params.riderId)) });
});
