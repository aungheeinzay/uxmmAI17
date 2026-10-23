import { Router } from "express";
import { requireAuth } from "../../../middleware/require-auth";
import { requireRole } from "../../../middleware/require-role";
import * as controller from "./report.controller";

export const reportRouter = Router();
reportRouter.get("/overview", requireAuth, requireRole("OPERATOR"), controller.overview);
