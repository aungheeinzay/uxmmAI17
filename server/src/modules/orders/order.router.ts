import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth";
import { requireRole } from "../../middleware/require-role";
import * as controller from "./order.controller";

export const orderRouter = Router();
orderRouter.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
orderRouter.get("/", requireAuth, requireRole("SME"), controller.list);
orderRouter.post("/", requireAuth, requireRole("SME"), controller.create);
orderRouter.get("/:id/qr", requireAuth, requireRole("SME"), controller.qr);
orderRouter.get("/:id/status", requireAuth, requireRole("SME"), controller.status);
orderRouter.get("/:id", requireAuth, requireRole("SME"), controller.detail);
orderRouter.patch("/:id/status", requireAuth, requireRole("SME"), controller.updateStatus);
