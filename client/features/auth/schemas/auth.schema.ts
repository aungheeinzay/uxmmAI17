import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(254, "Email must be 254 characters or fewer."),
  password: z.string().min(8, "Use at least 8 characters.").max(128, "Use no more than 128 characters."),
  confirmPassword: z.string().min(1, "Confirm your password."),
}).refine((values) => values.password === values.confirmPassword, {
  path: ["confirmPassword"], message: "Passwords do not match.",
});

export type RegisterFormValues = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: registerSchema.shape.email,
  password: z.string().min(1, "Enter your password.").max(128, "Use no more than 128 characters."),
}).strict();

export type LoginFormValues = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: registerSchema.shape.email });
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  newPassword: registerSchema.shape.password,
  confirmPassword: z.string().min(1, "Confirm your new password."),
}).refine((values) => values.newPassword === values.confirmPassword, {
  path: ["confirmPassword"], message: "Passwords do not match.",
});
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export const authUserSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(["SME", "OPERATOR", "RIDER"]),
  fullName: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().email().nullable().optional(),
  providerId: z.string().uuid().nullable().optional(),
  provider: z.object({ id: z.string().uuid(), name: z.string(), isActive: z.boolean() }).nullable().optional(),
});
