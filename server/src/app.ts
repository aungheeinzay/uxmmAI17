import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { authRouter } from "./modules/auth/auth.router";
import { userRouter } from "./modules/users/user.router";
import { orderRouter } from "./modules/orders/order.router";
import { errorHandler } from "./lib/errors/error-handler";
import { registerSwagger } from "./config/swagger";

export const app = express();

app.disable("x-powered-by");
app.use(cors({
  origin: new URL(env.FRONTEND_URL).origin,
  methods: ["GET", "POST", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
}));
app.use(express.json({ limit: "16kb" }));
registerSwagger(app);

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/orders", orderRouter);
app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Route not found." } });
});
app.use(errorHandler);
