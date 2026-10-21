import { z } from "zod";

export const inviteRiderSchema = z.object({
  email: z.string().trim().email().max(254),
  fullName: z.string().trim().min(1).max(120).optional(),
}).strict();
export const activateRiderSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  password: z.string().min(8).max(128),
}).strict();
