import type { Express } from "express";
import { riderManagementPaths, riderManagementSchemas } from "../modules/riders/management/rider-management.openapi";
import { providerPaths, providerSchemas } from "../modules/providers/provider.openapi";
import swaggerUi from "swagger-ui-express";
import { env } from "./env";
import { authPaths, authSchemas } from "../modules/auth/auth.openapi";
import { userPaths, userSchemas } from "../modules/users/user.openapi";
import { riderPaths, riderSchemas } from "../modules/riders/rider.openapi";
import { orderPaths, orderSchemas } from "../modules/orders/order.openapi";
import { operatorPaths, operatorSchemas } from "../modules/operator/operator.openapi";
import { assignmentPaths, assignmentSchemas } from "../modules/assignments/assignment.openapi";
import { warehousePaths, warehouseSchemas } from "../modules/operator/warehouse/warehouse.openapi";
import { errorSchema, response } from "../lib/openapi";

export const openApiDocument = {
  openapi: "3.0.3",
  info: { title: "ParcelOps AI API", version: "1.0.0", description: "Database-backed authentication and profiles. Use an opaque access token with Authorize; refresh tokens belong in the refresh request body." },
  servers: [{ url: "/", description: "Current server" }],
  tags: [{ name: "Authentication" }, { name: "Users" }, { name: "Orders" }, { name: "SME" }, { name: "Operator" }, { name: "Operator Warehouse" }, { name: "Delivery Providers", description: "Operator-managed providers and fixed city fees; authenticated SME discovery." }, { name: "Riders" }, { name: "Rider Deliveries" }, { name: "Health" }],
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", description: "Enter only the opaque access token, without the Bearer prefix. This is not a JWT." } },
    schemas: { Error: errorSchema, ...providerSchemas, ...authSchemas, ...userSchemas, ...orderSchemas, ...riderSchemas, ...operatorSchemas, ...assignmentSchemas, ...warehouseSchemas, ...riderManagementSchemas },
  },
  paths: {
    ...authPaths, ...userPaths, ...orderPaths, ...riderPaths, ...operatorPaths, ...assignmentPaths, ...warehousePaths,
    ...providerPaths,
    ...riderManagementPaths,
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
