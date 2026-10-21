import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth";
import { requireRole } from "../../middleware/require-role";
import * as controller from "./operator.controller";
export const operatorRouter = Router();
operatorRouter.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
operatorRouter.get("/orders", requireAuth, requireRole("OPERATOR"), controller.list);
operatorRouter.get("/orders/:id", requireAuth, requireRole("OPERATOR"), controller.detail);
operatorRouter.patch("/orders/:id/receive", requireAuth, requireRole("OPERATOR"), controller.receive);
