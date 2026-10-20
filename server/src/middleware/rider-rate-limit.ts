import { rateLimit } from "express-rate-limit";

const riderLimit = (count: number) => rateLimit({
  windowMs: 15 * 60 * 1000, limit: count, standardHeaders: "draft-8", legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMITED", message: "Too many rider requests. Try again in 15 minutes." } },
});

export const riderInvitationLimit = riderLimit(30);
export const riderActivationLimit = riderLimit(20);

// Mount after authentication and the Operator role check.
export const invitationPerOperator = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false,
  keyGenerator: req => req.auth!.id,
  message: { success: false, error: { code: "RATE_LIMITED", message: "Too many invitations. Try again in 15 minutes." } },
});
