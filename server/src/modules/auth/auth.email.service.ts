import { createHash, randomBytes } from "node:crypto";
import { sendAccountEmail } from "../../lib/email/email.service";
import { AppError } from "../../lib/errors/app-error";
import * as repository from "./auth.repository";

export const tokenDigest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const verificationMessage =
  "If this email belongs to an unverified account, a verification link has been sent.";
export const resetMessage =
  "If an account exists for this email, a password reset link has been sent.";

export async function deliverToken(
  account: { id: string; email: string },
  purpose: repository.TokenPurpose,
) {
  const token = randomBytes(32).toString("base64url");
  const hash = tokenDigest(token);
  if (!(await repository.reserveEmailToken(account.id, purpose, hash))) return;
  try {
    await sendAccountEmail(account.email, purpose, token);
  } catch {
    await repository.invalidateFailedEmailToken(purpose, hash);
    throw new AppError(
      503,
      "EMAIL_DELIVERY_FAILED",
      "Email delivery is unavailable. Request another link in a minute.",
    );
  }
}

export async function resendVerification(email: string) {
  const account = await repository.findAccount(email.toLowerCase());
  if (account && !account.emailVerifiedAt) {
    try {
      await deliverToken(account, "verification");
    } catch (error) {
      if (
        !(error instanceof AppError && error.code === "EMAIL_DELIVERY_FAILED")
      )
        throw error;
    }
  }
  return { message: verificationMessage };
}

export async function forgotPassword(email: string) {
  const account = await repository.findAccount(email.toLowerCase());
  if (account) {
    try {
      await deliverToken(account, "password-reset");
    } catch (error) {
      if (
        !(error instanceof AppError && error.code === "EMAIL_DELIVERY_FAILED")
      )
        throw error;
    }
  }
  return { message: resetMessage };
}

export async function verifyEmail(token: string) {
  if (!(await repository.consumeVerificationToken(tokenDigest(token)))) {
    throw new AppError(
      400,
      "INVALID_VERIFICATION_TOKEN",
      "Invalid or expired verification token.",
    );
  }
  return { message: "Email verified. You can now log in." };
}
