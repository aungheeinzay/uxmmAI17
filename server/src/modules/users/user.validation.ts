import { z } from "zod";

export const profileUpdateSchema = z.object({
  fullName: z.string().trim().min(1).max(120).nullable().optional(),
  phone: z.string().trim().min(1).max(32).nullable().optional(),
}).strict().refine(data => Object.keys(data).length > 0);
