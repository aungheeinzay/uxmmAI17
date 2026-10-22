import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth";
import { requireRole } from "../../middleware/require-role";
import * as controller from "./assignment.controller";

export const operatorAssignmentRouter = Router();
operatorAssignmentRouter.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
operatorAssignmentRouter.get("/riders", requireAuth, requireRole("OPERATOR"), controller.eligibleRiders);
operatorAssignmentRouter.get("/assignments", requireAuth, requireRole("OPERATOR"), controller.operatorList);
operatorAssignmentRouter.post("/assignments", requireAuth, requireRole("OPERATOR"), controller.create);
export const riderDeliveryRouter = Router();
riderDeliveryRouter.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
riderDeliveryRouter.get("/assignments", requireAuth, requireRole("RIDER"), controller.riderList);
riderDeliveryRouter.get("/assignments/:id", requireAuth, requireRole("RIDER"), controller.riderDetail);
riderDeliveryRouter.patch("/assignments/:id/status", requireAuth, requireRole("RIDER"), controller.updateStatus);
