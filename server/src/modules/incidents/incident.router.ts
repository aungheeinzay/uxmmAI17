import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth";
import { requireRole } from "../../middleware/require-role";
import { requireCompleteRiderProfile } from "../../middleware/require-rider-profile";
import { noStore } from "../../middleware/no-store";
import * as controller from "./incident.controller";

// Reporting an incident is a delivery operation: the same completed-profile guard applies.
export const riderIncidentRouter = Router();
riderIncidentRouter.use(noStore);
riderIncidentRouter.post("/", requireAuth, requireRole("RIDER"), requireCompleteRiderProfile, controller.create);
riderIncidentRouter.get("/", requireAuth, requireRole("RIDER"), requireCompleteRiderProfile, controller.riderList);
riderIncidentRouter.get("/:id", requireAuth, requireRole("RIDER"), requireCompleteRiderProfile, controller.riderDetail);

// Operator review is always scoped to the authenticated Operator's provider in the service.
export const operatorIncidentRouter = Router();
operatorIncidentRouter.use(noStore);
operatorIncidentRouter.get("/", requireAuth, requireRole("OPERATOR"), controller.operatorList);
operatorIncidentRouter.get("/:id", requireAuth, requireRole("OPERATOR"), controller.operatorDetail);
operatorIncidentRouter.patch("/:id/review", requireAuth, requireRole("OPERATOR"), controller.review);
