import { loginSchema, registerSchema, refreshSchema } from "./auth.validation";
import { profileExample } from "../users/user.openapi";
import { bearerSecurity, errorResponses, inputSchema, ref, requestBody, response, successSchema } from "../../lib/openapi";

const credentialsExample = { email: "user@example.com", password: "example-password-only" };
const sessionExample = {
  user: { id: profileExample.id, email: credentialsExample.email, profile: profileExample },
  accessToken: "EXAMPLE_ACCESS_TOKEN", refreshToken: "EXAMPLE_REFRESH_TOKEN",
  tokenType: "bearer", expiresIn: 900, expiresAt: 1792455300,
};
export const authSchemas = {
  RegisterInput: inputSchema(registerSchema), LoginInput: inputSchema(loginSchema), RefreshInput: inputSchema(refreshSchema),
  Session: {
    type: "object", required: ["user", "accessToken", "refreshToken", "tokenType", "expiresIn", "expiresAt"],
    properties: {
      user: { type: "object", required: ["id", "email", "profile"], properties: {
        id: { type: "string", format: "uuid" }, email: { type: "string", format: "email" }, profile: ref("Profile"),
      } },
      accessToken: { type: "string", description: "Opaque access token. Valid for 15 minutes; not a JWT." },
      refreshToken: { type: "string", description: "Opaque body credential. Valid for 30 days after issue or rotation." },
      tokenType: { type: "string", enum: ["bearer"] }, expiresIn: { type: "integer", example: 900 },
      expiresAt: { type: "integer", description: "Access expiry as Unix seconds." },
    },
  },
  Registration: { allOf: [ref("Session"), { type: "object", required: ["confirmationRequired"], properties: { confirmationRequired: { type: "boolean", enum: [false] } } }] },
};
export const authPaths = {
  "/api/auth/register": { post: {
    operationId: "register", tags: ["Authentication"], summary: "Register and start a session",
    description: "Creates a local account and SME profile. Emails are trimmed and lowercased; privileged roles and unknown fields are rejected. Email confirmation is not required. All auth endpoints share 30 requests per IP per 15 minutes.",
    security: [], requestBody: requestBody(ref("RegisterInput"), credentialsExample),
    responses: { 201: response("Registered and logged in", successSchema(ref("Registration")), { success: true, data: { confirmationRequired: false, ...sessionExample } }), ...errorResponses([400, 409, 429, 500]) },
  } },
  "/api/auth/login": { post: {
    operationId: "login", tags: ["Authentication"], summary: "Log in",
    description: "Verifies credentials and creates an independent session. Passwords are case sensitive. Returns the same error for an unknown email or incorrect password.",
    security: [], requestBody: requestBody(ref("LoginInput"), credentialsExample),
    responses: { 200: response("Session created", successSchema(ref("Session")), { success: true, data: sessionExample }), ...errorResponses([400, 401, 429, 500], { 401: ["LOGIN_FAILED", "Invalid email or password."] }) },
  } },
  "/api/auth/refresh": { post: {
    operationId: "refreshSession", tags: ["Authentication"], summary: "Rotate the session tokens",
    description: "Requires only the refresh token in the body. Atomically replaces both tokens and resets their lifetimes. Both old tokens stop working; serialize refresh requests and replace both stored tokens.",
    security: [], requestBody: requestBody(ref("RefreshInput"), { refreshToken: "EXAMPLE_REFRESH_TOKEN" }),
    responses: { 200: response("Replacement session tokens", successSchema(ref("Session")), { success: true, data: sessionExample }), ...errorResponses([400, 401, 429, 500], { 401: ["INVALID_REFRESH_TOKEN", "Invalid or expired refresh token."] }) },
  } },
  "/api/auth/logout": { post: {
    operationId: "logout", tags: ["Authentication"], summary: "End the current session",
    description: "Requires an unexpired access token. Immediately revokes both tokens for this session. Other login sessions remain active. Discard tokens on the client.",
    security: bearerSecurity,
    responses: { 200: response("Session revoked", successSchema({ type: "object", required: ["message"], properties: { message: { type: "string" } } }), { success: true, data: { message: "Session ended." } }), ...errorResponses([400, 401, 429, 500], { 400: ["INVALID_JSON", "Invalid JSON body."] }) },
  } },
};
