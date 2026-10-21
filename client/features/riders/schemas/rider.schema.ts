import { z } from "zod";
import { registerSchema } from "@/features/auth/schemas/auth.schema";
export const inviteRiderSchema = z.object({ email: registerSchema.shape.email, fullName: z.string().trim().max(120, "Use no more than 120 characters.") }).strict();
export type InviteRiderValues = z.infer<typeof inviteRiderSchema>;
export const invitationRequestSchema = inviteRiderSchema.transform(({ email, fullName }) => ({ email, ...(fullName ? { fullName } : {}) }));
