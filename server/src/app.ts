import express from "express";
import { providerAdminRouter, providerRouter } from "./modules/providers/provider.router";
import { authRouter } from "./modules/auth/auth.router";
import { userRouter } from "./modules/users/user.router";
import { orderRouter } from "./modules/orders/order.router";
import { smeRouter } from "./modules/orders/sme.router";
import { operatorRouter } from "./modules/operator/operator.router";
import { riderRouter } from "./modules/riders/rider.router";
import { riderProfileRouter } from "./modules/riders/profile/rider-profile.router";
import { operatorAssignmentRouter, riderDeliveryRouter } from "./modules/assignments/assignment.router";
import { operatorIncidentRouter, riderIncidentRouter } from "./modules/incidents/incident.router";
import { deliveryRouter } from "./modules/delivery/delivery.router";
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
app.use("/api/sme", smeRouter);
app.use("/api/orders", orderRouter);
app.use("/api/operator", operatorRouter);
app.use("/api/operator/my-provider", providerAdminRouter);
app.use("/api/delivery-providers", providerRouter);
app.use("/api/operator", operatorAssignmentRouter);
app.use("/api/rider/profile", riderProfileRouter);
app.use("/api/rider/incidents", riderIncidentRouter);
app.use("/api/rider", riderDeliveryRouter);
app.use("/api/operator/incidents", operatorIncidentRouter);
app.use("/api/riders", riderRouter);
app.use("/api/delivery", deliveryRouter);
app.use(notFound);
app.use(errorHandler);
