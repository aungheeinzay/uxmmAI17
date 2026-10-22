import { z } from "zod";
import { ApiError, postJson, postSessionJson } from "@/lib/api-client";
import { authUserSchema, type LoginFormValues } from "../schemas/auth.schema";
import type {
  RegisterRequest,
  RegisterResponse,
  ResetPasswordRequest,
} from "../types/auth.types";

const messageSchema = z.object({
  success: z.literal(true),
  data: z.object({ message: z.string() }),
});

export async function requestPasswordReset(email: string): Promise<void> {
  const result = messageSchema.safeParse(
    await postJson("/api/auth/forgot-password", { email }),
  );
  if (!result.success) throw new ApiError(502, "INVALID_RESPONSE");
}

export async function resetPassword({
  token,
  newPassword,
}: ResetPasswordRequest): Promise<void> {
  const result = messageSchema.safeParse(
    await postJson("/api/auth/reset-password", { token, newPassword }),
  );
  if (!result.success) throw new ApiError(502, "INVALID_RESPONSE");
}

export function passwordRecoveryErrorMessage(
  error: unknown,
  resetting = false,
): string {
  if (error instanceof ApiError) {
    if (error.code === "INVALID_RESET_TOKEN")
      return "This reset link has expired, was already used, or was replaced by a newer link. Request a new password reset email.";
    if (error.status === 429)
      return "Too many requests. Please wait 15 minutes before trying again.";
    if (error.status === 400)
      return resetting
        ? "Use a password between 8 and 128 characters and try again."
        : "Enter a valid email address.";
    if (error.code === "OFFLINE")
      return "You appear to be offline. Reconnect and try again.";
    if (error.code === "CONFIGURATION_ERROR")
      return "Password recovery is unavailable because of a website configuration problem. Please contact support.";
    if (resetting)
      return "We couldn’t confirm the password reset. Please try signing in with your new password before retrying this link.";
  }
  return "We couldn’t confirm your request. Check your inbox before trying again shortly.";
}

const sessionSchema = z.object({
  success: z.literal(true),
  data: z.object({ user: authUserSchema }),
});

export async function loginAccount(credentials: LoginFormValues) {
  const result = sessionSchema.safeParse(
    await postSessionJson("login", credentials),
  );
  if (!result.success) throw new ApiError(502, "INVALID_RESPONSE");
  return result.data.data.user;
}

export async function getCurrentUser() {
  const result = sessionSchema.safeParse(await postSessionJson("me"));
  if (!result.success) throw new ApiError(502, "INVALID_RESPONSE");
  return result.data.data.user;
}

export async function logoutAccount() {
  await postSessionJson("logout");
}

export function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "EMAIL_NOT_VERIFIED")
      return "Verify your email before signing in. You can request a new verification link below.";
    if (error.code === "ACCOUNT_DEACTIVATED")
      return "This Rider account is inactive. Contact your Operator to reactivate it.";
    if (error.status === 401)
      return "Your email or password is incorrect. Please try again.";
    if (error.status === 400)
      return "Check your email address and password.";
    if (error.status === 429)
      return "Too many sign-in attempts. Please wait 15 minutes and try again.";
    if (error.code === "OFFLINE")
      return "You appear to be offline. Reconnect and try again.";
    if (error.status === 403)
      return "This sign-in request was blocked. Refresh the page and try again.";
  }
  return "We couldn’t reach the sign-in service. Please try again shortly.";
}

const responseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    confirmationRequired: z.literal(true),
    message: z.string(),
  }),
});

export async function registerAccount({
  email,
  password,
}: RegisterRequest): Promise<RegisterResponse> {
  const result = responseSchema.safeParse(
    await postJson("/api/auth/register", { email, password }),
  );
  if (!result.success) throw new ApiError(502, "INVALID_RESPONSE");
  return result.data;
}

export async function resendVerification(email: string): Promise<void> {
  const schema = z.object({
    success: z.literal(true),
    data: z.object({ message: z.string() }),
  });
  const result = schema.safeParse(
    await postJson("/api/auth/resend-verification", { email }),
  );
  if (!result.success) throw new ApiError(502, "INVALID_RESPONSE");
}

export async function verifyEmail(token: string): Promise<void> {
  const schema = z.object({
    success: z.literal(true),
    data: z.object({ message: z.string() }),
  });
  const result = schema.safeParse(
    await postJson("/api/auth/verify-email", { token }),
  );
  if (!result.success) throw new ApiError(502, "INVALID_RESPONSE");
}

export function resendVerificationErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 429)
    return "Too many email requests. Please wait 15 minutes before requesting another link.";
  if (error instanceof ApiError && error.status === 400)
    return "Enter a valid email address.";
  return "We couldn’t confirm your request. Please check your connection and try again in a minute.";
}

export function registrationErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "EMAIL_DELIVERY_FAILED")
      return "Your account was created, but the verification email could not be sent. Request a new verification link below after one minute.";
    if (error.status === 400)
      return "Check your email and password and try again.";
    if (error.status === 409 && error.code === "REGISTRATION_FAILED")
      return "An account with this email already exists. If you haven’t verified it yet, request a new verification link below. If already verified, sign in with your original password.";
    if (error.status === 409)
      return "These details could not be used to create an account. Check them and try again.";
    if (error.status === 429)
      return "Too many attempts. Please wait 15 minutes before trying again.";
    if (error.code === "CONFIGURATION_ERROR")
      return "Registration is unavailable because of a website configuration problem. Please contact support.";
    if (error.code === "OFFLINE")
      return "You appear to be offline. Reconnect to the internet and try again.";
    if (error.code === "REQUEST_TIMEOUT")
      return "The server took too long to respond. Check your inbox for a verification email before trying again.";
    if (error.status === 0)
      return "We couldn’t connect to the registration service. Please try again shortly. If you already submitted this form, check your inbox for a verification email first.";
    if (error.status >= 500)
      return "The registration service is temporarily unavailable. Please try again later. If you already submitted this form, check your inbox first.";
  }
  return "Registration could not be confirmed. Check your inbox before retrying. If no email arrives, contact support.";
}
