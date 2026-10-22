import { z } from "zod";
import { IncidentStatus, IncidentType } from "../../generated/prisma/enums";

export const incidentIdSchema = z.string().uuid();

// The Rider never supplies orderId/riderId/providerId; those are derived server-side
// from the authenticated identity and the assignment owner check.
export const createIncidentSchema = z.object({
  assignmentId: z.string().uuid(),
  type: z.enum(IncidentType),
  reason: z.string().trim().min(3, "Enter a reason of at least 3 characters.").max(200, "Use no more than 200 characters."),
  description: z.string().trim().min(1, "Enter a short description.").max(1000, "Use no more than 1000 characters."),
}).strict();

export const incidentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(IncidentStatus).optional(),
}).strict();

export const reviewIncidentSchema = z.object({ status: z.literal(IncidentStatus.REVIEWED) }).strict();

export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;
export type IncidentQuery = z.infer<typeof incidentQuerySchema>;
export type ReviewIncidentInput = z.infer<typeof reviewIncidentSchema>;
