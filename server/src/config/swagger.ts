import type { Express } from "express";
import { riderManagementPaths, riderManagementSchemas } from "../modules/riders/management/rider-management.openapi";
import { riderProfilePaths, riderProfileSchemas } from "../modules/riders/profile/rider-profile.openapi";
import { providerPaths, providerSchemas } from "../modules/providers/provider.openapi";
import swaggerUi from "swagger-ui-express";
import { env } from "./env";
import { authPaths, authSchemas } from "../modules/auth/auth.openapi";
import { userPaths, userSchemas } from "../modules/users/user.openapi";
import { riderPaths, riderSchemas } from "../modules/riders/rider.openapi";
import { deliveryPaths, deliverySchemas } from "../modules/delivery/delivery.openapi";
import { orderPaths, orderSchemas } from "../modules/orders/order.openapi";
import { operatorPaths, operatorSchemas } from "../modules/operator/operator.openapi";
import { assignmentPaths, assignmentSchemas } from "../modules/assignments/assignment.openapi";
import { warehousePaths, warehouseSchemas } from "../modules/operator/warehouse/warehouse.openapi";
import { incidentPaths, incidentSchemas } from "../modules/incidents/incident.openapi";
import { reportPaths, reportSchemas } from "../modules/operator/reports/report.openapi";
import { errorSchema, response } from "../lib/openapi";

export const openApiDocument = {
  openapi: "3.0.3",
  info: { title: "ParcelOps AI API", version: "1.0.0", description: "Database-backed authentication and profiles. Use an opaque access token with Authorize; refresh tokens belong in the refresh request body." },
  servers: [{ url: "/", description: "Current server" }],
  tags: [
    { name: "Authentication" },
    { name: "Users" },
    { name: "Orders" },
    { name: "SME" },
    { name: "Operator" },
    { name: "Operator Warehouse" },
    { name: "Delivery Providers", description: "Operator-managed providers and fixed city fees; authenticated SME discovery." },
    { name: "Riders", description: "Rider invitations and activation. Riders are created only through an authenticated Operator invitation and activate through the existing email/password flow." },
    { name: "Rider Profile", description: "Authenticated Rider onboarding and vehicle details. Profile read/update stay reachable while onboarding is incomplete." },
    { name: "Rider Deliveries", description: "Authenticated Rider assignments and status transitions. Every delivery operation requires a completed Rider profile and delivery-provider membership; onboarding endpoints remain available while incomplete." },
    { name: "Rider Incidents", description: "Authenticated Rider incident reporting for damaged, broken or lost parcels. Only the assigned Rider may report; reporting never changes the order status." },
    { name: "Operator Incidents", description: "Provider-scoped incident review for Operators. Incidents are visible only within the authenticated Operator's delivery provider." },
    { name: "Delivery", description: "Authenticated SME delivery-provider and city catalog." },
    { name: "Health" },
  ],
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", description: "Enter only the opaque access token, without the Bearer prefix. This is not a JWT." } },
    schemas: { Error: errorSchema, ...providerSchemas, ...authSchemas, ...userSchemas, ...orderSchemas, ...riderSchemas, ...operatorSchemas, ...assignmentSchemas, ...warehouseSchemas, ...riderManagementSchemas, ...riderProfileSchemas, ...incidentSchemas, ...deliverySchemas, ...reportSchemas },
  },
  paths: {
    ...authPaths, ...userPaths, ...orderPaths, ...riderPaths, ...deliveryPaths, ...operatorPaths, ...assignmentPaths, ...warehousePaths, ...reportPaths,
    ...providerPaths,
    ...riderManagementPaths,
    ...riderProfilePaths,
    ...incidentPaths,
    "/health": { get: {
      operationId: "health", tags: ["Health"], summary: "Check server health",
      description: "Returns process availability; does not check the database.", security: [],
      responses: { 200: response("Server is running", { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["ok"] } } }, { status: "ok" }) },
    } },
  },
};

export function registerSwagger(app: Express) {
  if (!(env.ENABLE_API_DOCS ?? env.NODE_ENV !== "production")) return;
  app.get("/api/docs.json", (_req, res) => { res.json(openApiDocument); });
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(undefined, {
    customSiteTitle: "ParcelOps AI API",
    swaggerOptions: { url: "/api/docs.json", persistAuthorization: false, validatorUrl: null },
  }));
}
