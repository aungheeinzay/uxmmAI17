import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth";
import { requireRole } from "../../middleware/require-role";
import { noStore } from "../../middleware/no-store";
import * as controller from "./delivery.controller";

export const deliveryRouter = Router();
deliveryRouter.use(noStore);
deliveryRouter.get("/services", requireAuth, requireRole("SME"), controller.listServices);
deliveryRouter.get("/cities", requireAuth, requireRole("SME"), controller.listCities);
