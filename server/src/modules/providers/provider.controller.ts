import { asyncHandler } from "../../middleware/async-handler";
import * as service from "./provider.service";
import { providerIdSchema, createCityPriceSchema, updateCityPriceSchema, providerQuerySchema } from "./provider.validation";
export const myProvider = asyncHandler(async (req, res) => { res.json({ success: true, data: await service.myProvider(req.auth!) }); });
export const cityPrices = asyncHandler(async (req, res) => { res.json({ success: true, data: await service.cityPrices(req.auth!) }); });
export const createPrice = asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await service.createPrice(req.auth!, createCityPriceSchema.parse(req.body)) }); });
export const updatePrice = asyncHandler(async (req, res) => { res.json({ success: true, data: await service.updatePrice(req.auth!, providerIdSchema.parse(req.params.priceId), updateCityPriceSchema.parse(req.body)) }); });
export const available = asyncHandler(async (req, res) => { res.json({ success: true, data: await service.available(req.auth!, providerQuerySchema.parse(req.query).city) }); });
