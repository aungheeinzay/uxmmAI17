import { z } from "zod";

export const incidentTypes = ["DAMAGED", "BROKEN", "LOST"] as const;
export const incidentStatuses = ["OPEN", "REVIEWED"] as const;
export type IncidentType = (typeof incidentTypes)[number];
export type IncidentStatus = (typeof incidentStatuses)[number];

export const incidentTypeLabels: Record<IncidentType, string> = {
  DAMAGED: "Damaged", BROKEN: "Broken", LOST: "Lost",
};
export const incidentStatusLabels: Record<IncidentStatus, string> = {
  OPEN: "Unresolved", REVIEWED: "Reviewed",
};

const person = z.object({ id: z.string().uuid(), fullName: z.string().nullable(), phone: z.string().nullable() });
export const incidentSchema = z.object({
  id: z.string().uuid(), orderId: z.string().uuid(), riderId: z.string().uuid(),
  assignmentId: z.string().uuid().nullable(), providerId: z.string().uuid(),
  type: z.enum(incidentTypes), reason: z.string(), description: z.string(),
  status: z.enum(incidentStatuses), reviewedAt: z.iso.datetime().nullable(),
  reviewedById: z.string().uuid().nullable(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(),
  rider: person, reviewedBy: person.nullable(),
  order: z.object({
    id: z.string().uuid(), orderCode: z.string(), recipientName: z.string(), township: z.string(),
    deliveryAddress: z.string(), status: z.string(), deliveryProviderId: z.string().uuid().nullable(),
  }),
});
export const incidentListSchema = z.object({
  incidents: z.array(incidentSchema),
  pagination: z.object({
    page: z.number().int().positive(), pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(), totalPages: z.number().int().nonnegative(),
  }),
});

export const incidentQuerySchema = z.object({
  page: z.number().int().min(1).max(1000000).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  status: z.enum(incidentStatuses).optional(),
}).strict();

// Mirrors the Express rules; the backend remains authoritative.
export const reportIncidentSchema = z.object({
  assignmentId: z.string().uuid(),
  type: z.enum(incidentTypes),
  reason: z.string().trim().min(3, "Enter a reason of at least 3 characters.").max(200, "Use no more than 200 characters."),
  description: z.string().trim().min(1, "Enter a short description.").max(1000, "Use no more than 1000 characters."),
}).strict();

export const reviewIncidentSchema = z.object({ id: z.string().uuid(), status: z.literal("REVIEWED") }).strict();

export type Incident = z.infer<typeof incidentSchema>;
export type IncidentList = z.infer<typeof incidentListSchema>;
export type IncidentQuery = z.infer<typeof incidentQuerySchema>;
export type ReportIncidentValues = z.infer<typeof reportIncidentSchema>;
export type ReviewIncidentInput = z.infer<typeof reviewIncidentSchema>;
