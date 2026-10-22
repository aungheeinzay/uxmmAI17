import { asyncHandler } from "../../middleware/async-handler";
import { AppError } from "../../lib/errors/app-error";
import * as service from "./delivery.service";
import { deliveryServicesQuerySchema } from "./delivery.validation";

export const listServices = asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "UNAUTHORIZED", "Authentication required.");
  const { city } = deliveryServicesQuerySchema.parse(req.query);
  res.json({ success: true, data: await service.listDeliveryServices(city) });
});

export const listCities = asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "UNAUTHORIZED", "Authentication required.");
  res.json({ success: true, data: await service.listDeliveryCities() });
});
