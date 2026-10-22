import { asyncHandler } from "../../middleware/async-handler";
import * as service from "./provider.service";
import { createProviderSchema, updateProviderSchema, providerIdSchema, citySchema, priceSchema, providerQuerySchema } from "./provider.validation";
export const list = asyncHandler(async (req, res) => { res.json({ success: true, data: await service.list(req.auth!) }); });
export const create = asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await service.create(req.auth!, createProviderSchema.parse(req.body)) }); });
export const update = asyncHandler(async (req, res) => { res.json({ success: true, data: await service.update(req.auth!, providerIdSchema.parse(req.params.id), updateProviderSchema.parse(req.body)) }); });
export const putPrice = asyncHandler(async (req, res) => { res.json({ success: true, data: await service.putPrice(req.auth!, providerIdSchema.parse(req.params.id), citySchema.parse(req.params.city), priceSchema.parse(req.body)) }); });
export const available = asyncHandler(async (req, res) => { res.json({ success: true, data: await service.available(req.auth!, providerQuerySchema.parse(req.query).city) }); });
