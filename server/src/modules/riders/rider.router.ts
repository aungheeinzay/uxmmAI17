import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth";
import { requireRole } from "../../middleware/require-role";
import { noStore } from "../../middleware/no-store";
import { riderInvitationLimit, riderActivationLimit, invitationPerOperator } from "../../middleware/rider-rate-limit";
import * as controller from "./rider.controller";

export const riderRouter = Router();
riderRouter.use(noStore);
riderRouter.post("/invitations", riderInvitationLimit, requireAuth, requireRole("OPERATOR"), invitationPerOperator, controller.invite);
riderRouter.post("/activate", riderActivationLimit, controller.activate);
