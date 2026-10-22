import { z } from "zod";
import { asyncHandler } from "../../../middleware/async-handler";
import * as service from "./rider-management.service";
import { riderManagementQuerySchema, riderDetailQuerySchema } from "./rider-management.validation";
export const list = asyncHandler(async (req, res) => { res.json({ success: true, data: await service.list(req.auth!, riderManagementQuerySchema.parse(req.query)) }); });
export const overview = asyncHandler(async (req, res) => { z.object({}).strict().parse(req.query); res.json({ success: true, data: await service.overview(req.auth!) }); });
export const invitations = asyncHandler(async (req, res) => { res.json({ success: true, data: await service.invitations(req.auth!, riderDetailQuerySchema.parse(req.query)) }); });
export const detail = asyncHandler(async (req, res) => { res.json({ success: true, data: await service.detail(req.auth!, z.string().uuid().parse(req.params.riderId), riderDetailQuerySchema.parse(req.query)) }); });
