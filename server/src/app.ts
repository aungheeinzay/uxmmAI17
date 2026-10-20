import express from "express";
import { authRouter } from "./modules/auth/auth.router";
import { userRouter } from "./modules/users/user.router";
import { riderRouter } from "./modules/riders/rider.router";
import { errorHandler } from "./middleware/error-handler";
import { notFound } from "./middleware/not-found";
import { corsMiddleware, jsonBodyParser } from "./middleware/request";
import { registerSwagger } from "./config/swagger";

export const app = express();

app.disable("x-powered-by");
app.use(corsMiddleware);
app.use(jsonBodyParser);
registerSwagger(app);

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/riders", riderRouter);
app.use(notFound);
app.use(errorHandler);
