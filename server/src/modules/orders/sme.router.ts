import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth";
import { requireRole } from "../../middleware/require-role";
import * as controller from "./order.controller";

export const smeRouter = Router();
smeRouter.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
smeRouter.get("/dashboard", requireAuth, requireRole("SME"), controller.dashboard);