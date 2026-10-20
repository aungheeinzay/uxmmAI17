import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth";
import { noStore } from "../../middleware/no-store";
import * as controller from "./user.controller";

export const userRouter = Router();
userRouter.use(noStore);
userRouter.use(requireAuth);
userRouter.get("/me", controller.me);
userRouter.patch("/me", controller.updateMe);
