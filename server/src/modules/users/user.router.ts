import { Router } from "express";
import { requireAuth } from "../../lib/middleware/require-auth";
import * as controller from "./user.controller";

export const userRouter = Router();
userRouter.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
userRouter.use(requireAuth);
userRouter.get("/me", controller.me);
userRouter.patch("/me", controller.updateMe);
