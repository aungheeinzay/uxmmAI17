import { rateLimit } from "express-rate-limit";

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMITED", message: "Too many authentication attempts. Try again later." } },
});

// Shared instance preserves the combined resend/forgot-password quota.
export const emailRequestLimit = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: "draft-8", legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMITED", message: "Too many email requests. Try again later." } },
});
