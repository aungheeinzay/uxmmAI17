import { Router } from "express";
import { requireAuth } from "../../../middleware/require-auth";
import { requireRole } from "../../../middleware/require-role";
import { noStore } from "../../../middleware/no-store";
import * as controller from "./rider-profile.controller";

export const riderProfileRouter = Router();
riderProfileRouter.use(noStore);
// Profile completion must stay reachable while a Rider is incomplete.
riderProfileRouter.get("/", requireAuth, requireRole("RIDER"), controller.get);
riderProfileRouter.patch("/", requireAuth, requireRole("RIDER"), controller.update);
