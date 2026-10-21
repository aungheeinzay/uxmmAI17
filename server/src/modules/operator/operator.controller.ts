import { asyncHandler } from "../../middleware/async-handler";
import * as service from "./operator.service";
import { operatorOrderIdSchema, operatorOrdersQuerySchema, receiveParcelSchema } from "./operator.validation";
import { AppError } from "../../lib/errors/app-error";
export const list = asyncHandler(async (req, res) => {
  const data = await service.listOrders(operatorOrdersQuerySchema.parse(req.query));
  res.json({ success: true, data });
});
export const detail = asyncHandler(async (req, res) => {
  const data = await service.getOrder(operatorOrderIdSchema.parse(req.params.id));
  res.json({ success: true, data });
});
export const receive = asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "UNAUTHORIZED", "Authentication required.");
  const data = await service.receiveParcel(req.auth, operatorOrderIdSchema.parse(req.params.id), receiveParcelSchema.parse(req.body ?? {}));
  res.json({ success: true, data });
});
