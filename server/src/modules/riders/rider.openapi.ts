import { activateRiderSchema, inviteRiderSchema } from "./rider.validation";
import { bearerSecurity, errorResponses, inputSchema, ref, requestBody, response, successSchema } from "../../lib/openapi";

export const riderSchemas = {
  InviteRiderInput: inputSchema(inviteRiderSchema), ActivateRiderInput: inputSchema(activateRiderSchema),
  RiderInvitationResult: successSchema({
    type: "object", required: ["message", "invitation"], properties: {
      message: { type: "string" }, invitation: { type: "object", required: ["id", "email", "expiresAt", "status"], properties: {
        id: { type: "string", format: "uuid" }, email: { type: "string", format: "email" },
        expiresAt: { type: "string", format: "date-time" }, status: { type: "string", enum: ["pending"] },
      } },
    },
  }),
  RiderActivationResult: successSchema({ type: "object", required: ["message"], properties: { message: { type: "string" } } }),
};
const conflicts: Record<number, [string, string]> = {
  409: ["RIDER_INVITATION_CONFLICT", "RIDER_INVITATION_CONFLICT: account/pending invitation exists or invitation belongs to another provider. PROVIDER_MEMBERSHIP_REQUIRED: configure the inviting Operator provider first."],
};
export const riderPaths = {
  "/api/riders/invitations": { post: {
    operationId: "inviteRider", tags: ["Riders"], summary: "Invite a Rider (OPERATOR only)", security: bearerSecurity,
    description: "Creates a pending invitation, not an account. Only a verified Operator with configured provider membership may invite. The provider is captured from the persisted profile, never request input. Missing membership returns 409 PROVIDER_MEMBERSHIP_REQUIRED. Existing accounts and pending duplicates return 409. Email contains a single-use 24-hour token in /activate-rider#token=... at the configured frontend origin. Raw tokens are never returned. Expired/revoked invitations can be replaced only within the same captured provider (legacy unscoped records only by their original inviter). Limits: 10 requests per Operator and 30 per IP per 15 minutes. Delivery failure revokes the token and returns 503; retry by inviting again. No public resend, revoke or role-change endpoint.",
    requestBody: requestBody(ref("InviteRiderInput"), { email: "rider@example.com", fullName: "Rider One" }),
    responses: {
      201: response("Invitation sent", ref("RiderInvitationResult")),
      ...errorResponses([400, 401, 403, 409, 429, 500, 503], { ...conflicts,
        403: ["FORBIDDEN", "Only Operators may invite Riders."],
        503: ["EMAIL_DELIVERY_FAILED", "Invitation delivery failed. You may try inviting this email again."],
      }),
    },
  } },
  "/api/riders/activate": { post: {
    operationId: "activateRider", tags: ["Riders"], summary: "Activate an invited Rider account", security: [],
    description: "Public token-protected password setup. Frontend reads the fragment token, removes it from the URL, and POSTs it with an 8–128-character password; confirmation is frontend-only. Atomically creates a RIDER account/profile with the captured invitation provider (legacy unscoped invitations resolve the verified inviter membership at activation), confirms the invited email, and consumes the invitation. Does not create a session. Sign in through /api/auth/login afterward. Invalid, expired, revoked or consumed tokens return 400. If an account was created after invitation issuance, returns 409 without changing its role. Limit: 20 requests per IP per 15 minutes. Activation page is a separate frontend task.",
    requestBody: { required: true, content: { "application/json": { schema: ref("ActivateRiderInput") } } },
    responses: {
      200: response("Rider activated; sign in next", ref("RiderActivationResult"), { success: true, data: { message: "Rider account activated. You can now sign in." } }),
      ...errorResponses([400, 409, 429, 500], { ...conflicts, 400: ["INVALID_INVITATION_TOKEN", "Invalid, expired, revoked or already used invitation. Invalid request bodies return VALIDATION_ERROR or INVALID_JSON."] }),
    },
  } },
};
