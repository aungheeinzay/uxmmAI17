import { z } from "zod";

// The catalog stores lowercase, trimmed city names.
export const deliveryServicesQuerySchema = z.object({
  city: z.string().trim().min(1).max(120).transform(value => value.toLowerCase()),
}).strict();
