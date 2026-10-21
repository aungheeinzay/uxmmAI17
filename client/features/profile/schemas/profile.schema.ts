import { z } from "zod";
// Matches Express: trim, nullable fields, name <=120, phone <=32; no phone-format restriction.
export const profileUpdateSchema = z.object({ fullName: z.string().trim().min(1).max(120).nullable().optional(), phone: z.string().trim().min(1).max(32).nullable().optional() }).strict().refine((value) => Object.keys(value).length > 0);
export const profileFormSchema = z.object({ fullName: z.string().trim().max(120, "Use no more than 120 characters."), phone: z.string().trim().max(32, "Use no more than 32 characters.") }).strict();
export type ProfileFormValues = z.infer<typeof profileFormSchema>;
