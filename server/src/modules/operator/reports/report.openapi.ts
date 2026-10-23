import { bearerSecurity, errorResponses, ref, response, successSchema } from "../../../lib/openapi";

export const reportSchemas = {
  ReportOverview: { type: "object", required: ["period", "metrics", "volume", "statusBreakdown", "granularity", "unavailableMetrics"], properties: {
    period: { type: "object", required: ["start", "end", "timezone"], properties: { start: { type: "string", format: "date" }, end: { type: "string", format: "date" }, timezone: { type: "string" } } },
    metrics: { type: "object", required: ["totalParcels", "delivered", "failed", "successRate", "averageDeliveryHours"], properties: { totalParcels: { type: "integer" }, delivered: { type: "integer" }, failed: { type: "integer" }, successRate: { type: "number", nullable: true }, averageDeliveryHours: { type: "number", nullable: true } } },
    volume: { type: "array", items: { type: "object", required: ["date", "count"], properties: { date: { type: "string" }, count: { type: "integer" } } } },
    statusBreakdown: { type: "array", items: { type: "object", required: ["status", "count"], properties: { status: { type: "string" }, count: { type: "integer" } } } },
    granularity: { type: "string", enum: ["day", "week", "month"] },
    unavailableMetrics: { type: "object", properties: { averageDeliveryHours: { type: "string", nullable: true } } },
  } },
};

export const reportPaths = {
  "/api/operator/reports/overview": { get: {
    operationId: "operatorReportsOverview", tags: ["Operator"], summary: "Provider-scoped delivery analytics",
    security: bearerSecurity,
    parameters: [
      { in: "query", name: "startDate", required: true, schema: { type: "string", format: "date" } },
      { in: "query", name: "endDate", required: true, schema: { type: "string", format: "date" } },
      { in: "query", name: "granularity", required: false, schema: { type: "string", enum: ["day", "week", "month"] } },
    ],
    responses: { ...errorResponses([400, 401, 403, 409, 500], { 403: ["FORBIDDEN", "Only Operators may view reports."], 409: ["PROVIDER_MEMBERSHIP_REQUIRED", "Your delivery provider has not been configured."] }), 200: response("Provider-scoped analytics", successSchema(ref("ReportOverview"))) },
  } },
};
