import { z } from "zod";

export const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
export const bearerSecurity = [{ bearerAuth: [] }];
export const inputSchema = (schema: z.ZodType) => z.toJSONSchema(schema, { target: "openapi-3.0", io: "input" });
export const successSchema = (data: object) => ({
  type: "object", required: ["success", "data"],
  properties: { success: { type: "boolean", enum: [true] }, data },
});
export const response = (description: string, schema: object, example?: object) => ({
  description, content: { "application/json": { schema, ...(example ? { example } : {}) } },
});
export const requestBody = (schema: object, example: object, description?: string) => ({
  required: true, description, content: { "application/json": { schema, example } },
});
const errors: Record<number, [string, string]> = {
  400: ["VALIDATION_ERROR", "Invalid request data."],
  401: ["UNAUTHORIZED", "Invalid or expired access token."],
  404: ["PROFILE_NOT_FOUND", "Profile not found."],
  409: ["REGISTRATION_FAILED", "Unable to register with these details."],
  429: ["RATE_LIMITED", "Too many authentication attempts. Try again later."],
  500: ["INTERNAL_ERROR", "An unexpected error occurred."],
};
export function errorResponses(statuses: number[], overrides: Record<number, [string, string]> = {}) {
  return Object.fromEntries(statuses.map(status => {
    const [code, message] = overrides[status] ?? errors[status];
    const description = status === 400 && code === "VALIDATION_ERROR"
      ? "Invalid request data (VALIDATION_ERROR) or malformed JSON (INVALID_JSON)."
      : message;
    return [status, response(description, ref("Error"), { success: false, error: { code, message } })];
  }));
}
export const errorSchema = {
  type: "object", required: ["success", "error"], properties: {
    success: { type: "boolean", enum: [false] },
    error: { type: "object", required: ["code", "message"], properties: {
      code: { type: "string" }, message: { type: "string" },
    } },
  },
};
