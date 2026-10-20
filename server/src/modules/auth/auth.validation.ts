import { z } from "zod";

const credentials = {
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
};
export const loginSchema = z.object(credentials).strict();
export const registerSchema = z.object({ ...credentials, password: z.string().min(8).max(128) }).strict();
export const refreshSchema = z.object({ refreshToken: z.string().min(1).max(8192) }).strict();
const emailToken = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const verifyEmailSchema = z.object({ token: emailToken }).strict();
export const emailRequestSchema = z.object({ email: credentials.email }).strict();
export const resetPasswordSchema = z.object({ token: emailToken, newPassword: z.string().min(8).max(128) }).strict();
