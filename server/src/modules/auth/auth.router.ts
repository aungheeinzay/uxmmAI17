import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { requireAuth } from "../../lib/middleware/require-auth";
import * as controller from "./auth.controller";

export const authRouter = Router();
authRouter.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
authRouter.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMITED", message: "Too many authentication attempts. Try again later." } },
}));
authRouter.post("/register", controller.register);
authRouter.post("/login", controller.login);
authRouter.post("/refresh", controller.refresh);
authRouter.post("/logout", requireAuth, controller.logout);
