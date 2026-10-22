import { profileUpdateSchema } from "./user.validation";
import { bearerSecurity, errorResponses, inputSchema, ref, requestBody, response, successSchema } from "../../lib/openapi";

export const profileExample = {
  id: "550e8400-e29b-41d4-a716-446655440000", fullName: null, phone: null, role: "SME",
  email: "shop@example.test", providerId: null, provider: null,
  createdAt: "2026-10-20T00:00:00.000Z", updatedAt: "2026-10-20T00:00:00.000Z",
};
export const userSchemas = {
  Profile: {
    type: "object", required: ["id", "fullName", "phone", "role", "email", "providerId", "provider", "createdAt", "updatedAt"], properties: {
      email: { type: "string", format: "email", nullable: true },
      providerId: { type: "string", format: "uuid", nullable: true, readOnly: true },
      provider: { type: "object", nullable: true, readOnly: true, required: ["id", "name", "isActive"], properties: { id: { type: "string", format: "uuid" }, name: { type: "string" }, isActive: { type: "boolean" } } },
      id: { type: "string", format: "uuid" },
      fullName: { type: "string", nullable: true, maxLength: 120 },
      phone: { type: "string", nullable: true, maxLength: 32 },
      role: { type: "string", enum: ["SME", "OPERATOR", "RIDER"] },
      createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" },
    },
  },
  // JSON Schema cannot express arbitrary refinements; minProperties documents this refinement.
  ProfileUpdate: { ...inputSchema(profileUpdateSchema), minProperties: 1 },
};
export const userPaths = {
  "/api/users/me": {
    get: {
      operationId: "getMyProfile", tags: ["Users"], summary: "Get your profile",
      description: "Returns only the authenticated account's profile. Identity and role come from the database.",
      security: bearerSecurity,
      responses: { 200: response("Current profile", successSchema(ref("Profile")), { success: true, data: profileExample }), ...errorResponses([401, 404, 500]) },
    },
    patch: {
      operationId: "updateMyProfile", tags: ["Users"], summary: "Update your profile",
      description: "Supply at least one of fullName or phone. Use null to clear a field. Identity, role, providerId and provider membership changes are rejected. Membership is read-only and requires controlled development provisioning.",
      security: bearerSecurity,
      requestBody: requestBody(ref("ProfileUpdate"), { fullName: "Example User", phone: "+959123456789" }),
      responses: { 200: response("Updated profile", successSchema(ref("Profile")), { success: true, data: { ...profileExample, fullName: "Example User", phone: "+959123456789" } }), ...errorResponses([400, 401, 500]) },
    },
  },
};
