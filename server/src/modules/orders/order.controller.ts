import { asyncHandler } from "../../middleware/async-handler";
import * as service from "./order.service";
import {
  createOrderSchema,
  listOrdersQuerySchema,
  orderIdentifierSchema,
  updateOrderStatusSchema,
} from "./order.validation";

export const create = asyncHandler(async (req, res) => {
  const data = await service.createOrder(
    req.auth!.id,
    createOrderSchema.parse(req.body),
  );
  res.status(201).json({ success: true, data });
});

export const detail = asyncHandler(async (req, res) => {
  const data = await service.getOrder(
    req.auth!.id,
    orderIdentifierSchema.parse(req.params.id),
  );
  res.json({ success: true, data });
});

export const qr = asyncHandler(async (req, res) => {
  const data = await service.getOrderQr(
    req.auth!.id,
    orderIdentifierSchema.parse(req.params.id),
  );
  res.json({ success: true, data });
});

export const status = asyncHandler(async (req, res) => {
  const data = await service.getOrderStatus(req.auth!.id, orderIdentifierSchema.parse(req.params.id));
  res.json({ success: true, data });
});

export const list = asyncHandler(async (req, res) => {
  const data = await service.listOrders(
    req.auth!.id,
    listOrdersQuerySchema.parse(req.query),
  );
  res.json({ success: true, data });
});

export const dashboard = asyncHandler(async (req, res) => {
  const data = await service.getOrderDashboard(req.auth!.id);
  res.json({ success: true, data });
});

export const updateStatus = asyncHandler(async (req, res) => {
  const data = await service.updateOrderStatus(
    req.auth!.id,
    orderIdentifierSchema.parse(req.params.id),
    updateOrderStatusSchema.parse(req.body),
  );
  res.json({ success: true, data });
});
