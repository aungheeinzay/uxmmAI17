import { loginSchema, registerSchema, refreshSchema, verifyEmailSchema, emailRequestSchema, resetPasswordSchema } from "./auth.validation";
import { profileExample } from "../users/user.openapi";
import { bearerSecurity, errorResponses, inputSchema, ref, requestBody, response, successSchema } from "../../lib/openapi";

const credentialsExample = { email: "user@example.com", password: "example-password-only" };
const loginForbidden = {
  description: "EMAIL_NOT_VERIFIED: verify the email before logging in. ACCOUNT_DEACTIVATED: the Rider was operationally deactivated by an Operator.",
  content: { "application/json": { schema: ref("Error"), examples: {
    emailNotVerified: { summary: "Email not verified", value: { success: false, error: { code: "EMAIL_NOT_VERIFIED", message: "Verify your email before logging in." } } },
    accountDeactivated: { summary: "Operationally deactivated Rider", value: { success: false, error: { code: "ACCOUNT_DEACTIVATED", message: "This Rider account is inactive. Contact your Operator." } } },
  } } },
};
const loginResponses = {
  ...errorResponses([400, 401, 429, 500], { 401: ["LOGIN_FAILED", "Invalid email or password."] }),
  403: loginForbidden,
};
const sessionExample = {
  user: { id: profileExample.id, email: credentialsExample.email, profile: profileExample },
  accessToken: "EXAMPLE_ACCESS_TOKEN", refreshToken: "EXAMPLE_REFRESH_TOKEN",
  tokenType: "bearer", expiresIn: 900, expiresAt: 1792455300,
};
export const authSchemas = {
  RegisterInput: inputSchema(registerSchema), LoginInput: inputSchema(loginSchema), RefreshInput: inputSchema(refreshSchema),
  VerifyEmailInput: inputSchema(verifyEmailSchema), EmailRequestInput: inputSchema(emailRequestSchema), ResetPasswordInput: inputSchema(resetPasswordSchema),
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
  Registration: { type: "object", required: ["confirmationRequired", "message"], properties: { confirmationRequired: { type: "boolean", enum: [true] }, message: { type: "string" } } },
};

const messageSchema = successSchema({ type: "object", required: ["message"], properties: { message: { type: "string" } } });
const emailPaths = {
  "/api/auth/verify-email": { post: {
    operationId: "verifyEmail", tags: ["Authentication"], summary: "Verify your email",
    description: "Consumes a single-use 15-minute verification token from the frontend email link. Does not start a session. Token must be 43 base64url characters.", security: [],
    requestBody: requestBody(ref("VerifyEmailInput"), { token: "EXAMPLE_VERIFICATION_TOKEN".padEnd(43, "_") }),
    responses: { 200: response("Email verified", messageSchema, { success: true, data: { message: "Email verified. You can now log in." } }), ...errorResponses([400, 429, 500], { 400: ["INVALID_VERIFICATION_TOKEN", "Invalid or expired verification token. Malformed request bodies return VALIDATION_ERROR or INVALID_JSON."] }) },
  } },
  "/api/auth/resend-verification": { post: {
    operationId: "resendVerification", tags: ["Authentication"], summary: "Resend verification email",
    description: "Generic response for unknown, verified, cooling-down accounts and delivery failures. One email per account per 60 seconds; old unused links are replaced. Shares a limit of 5 email requests per IP per 15 minutes with forgot-password.", security: [],
    requestBody: requestBody(ref("EmailRequestInput"), { email: "user@example.com" }),
    responses: { 200: response("Request accepted", messageSchema, { success: true, data: { message: "If this email belongs to an unverified account, a verification link has been sent." } }), ...errorResponses([400, 429, 500]) },
  } },
  "/api/auth/forgot-password": { post: {
    operationId: "forgotPassword", tags: ["Authentication"], summary: "Request a password reset",
    description: "Returns the same response for existing and unknown emails, cooldown and SMTP failure. Reset links expire after 15 minutes. One email per account per 60 seconds; old reset links are replaced. Shares a 5-per-IP/15-minute limit with resend-verification.", security: [],
    requestBody: requestBody(ref("EmailRequestInput"), { email: "user@example.com" }),
    responses: { 200: response("Request accepted", messageSchema, { success: true, data: { message: "If an account exists for this email, a password reset link has been sent." } }), ...errorResponses([400, 429, 500]) },
  } },
  "/api/auth/reset-password": { post: {
    operationId: "resetPassword", tags: ["Authentication"], summary: "Set a new password",
    description: "Requires a single-use 43-character base64url reset token and an 8?128 character new password. Atomically updates the password and revokes every session. Does not verify email or issue session tokens. Password confirmation belongs in the frontend.", security: [],
    requestBody: requestBody(ref("ResetPasswordInput"), { token: "EXAMPLE_RESET_TOKEN".padEnd(43, "_"), newPassword: "example-new-password-only" }),
    responses: { 200: response("Password reset; log in again", messageSchema, { success: true, data: { message: "Password reset. Log in with your new password." } }), ...errorResponses([400, 429, 500], { 400: ["INVALID_RESET_TOKEN", "Invalid or expired password reset token. Malformed request bodies return VALIDATION_ERROR or INVALID_JSON."] }) },
  } },
};

export const authPaths = {
  ...emailPaths,
  "/api/auth/register": { post: {
    operationId: "register", tags: ["Authentication"], summary: "Register and request email verification",
    description: "Creates a local account and SME profile. Emails are trimmed and lowercased; privileged roles and unknown fields are rejected. Email verification is required. Returns no session tokens; verification links expire after 15 minutes. If delivery fails after account creation, use resend-verification rather than register again. All auth endpoints share 30 requests per IP per 15 minutes.",
    security: [], requestBody: requestBody(ref("RegisterInput"), credentialsExample),
    responses: { 201: response("Verification email requested", successSchema(ref("Registration")), { success: true, data: { confirmationRequired: true, message: "Check your email to verify your account before logging in." } }), ...errorResponses([400, 409, 429, 500, 503], { 503: ["EMAIL_DELIVERY_FAILED", "Email delivery is unavailable. Request another link in a minute."] }) },
  } },
  "/api/auth/login": { post: {
    operationId: "login", tags: ["Authentication"], summary: "Log in",
    description: "Verifies credentials and requires a verified email before creating an independent session. Operationally deactivated Rider accounts are rejected until an Operator reactivates them. Passwords are case sensitive. Returns the same error for an unknown email or incorrect password.",
    security: [], requestBody: requestBody(ref("LoginInput"), credentialsExample),
    responses: { 200: response("Session created", successSchema(ref("Session")), { success: true, data: sessionExample }), ...loginResponses },
  } },
  "/api/auth/refresh": { post: {
    operationId: "refreshSession", tags: ["Authentication"], summary: "Rotate the session tokens",
    description: "Requires only the refresh token in the body and an email-verified, operationally active account. Atomically replaces both tokens and resets their lifetimes. Both old tokens stop working; serialize refresh requests and replace both stored tokens. Deactivation revokes existing sessions.",
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
