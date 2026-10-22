import { z } from "zod";

export const myanmarMobilePhone = /^(?:09\d{7,9}|\+?959\d{7,9})$/;

export const createOrderApiSchema = z.object({
  recipientName: z.string().trim().min(1).max(120),
  phoneNumber: z.string().trim().transform((value, context) => {
    const normalized = value.replace(/[\s-]/g, "");
    if (!myanmarMobilePhone.test(normalized)) {
      context.addIssue({ code: "custom", message: "Phone number must use a supported Myanmar mobile format." });
      return z.NEVER;
    }
    return normalized;
  }),
  township: z.string().trim().min(1).max(120),
  deliveryAddress: z.string().trim().min(1).max(500),
  parcelWeight: z.coerce.number(),
  codAmount: z.string().trim(),
  senderName: z.string().trim().min(1).max(120),
  deliveryInstructions: z.string().trim().max(1000).optional().nullable(),
  operatorId: z.string().uuid().optional(),
  destinationCity: z.string().trim().min(1).max(120),
  deliveryProviderId: z.string().uuid(),
});

export type CreateOrderApiInput = z.infer<typeof createOrderApiSchema>;
