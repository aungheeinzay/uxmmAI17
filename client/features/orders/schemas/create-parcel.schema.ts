import { z } from "zod";

export const createParcelSchema = z.object({
  recipientName: z.string().trim().min(1, "Enter recipient name."),
  phoneNumber: z.string().trim().min(1, "Enter phone number."),
  city: z.string().min(1, "Select city."),
  township: z.string().min(1, "Select township."),
  deliveryAddress: z.string().trim().min(1, "Enter delivery address."),
  weight: z.coerce.number().min(0.1, "Enter weight."),
  codAmount: z.coerce.number().min(0, "Enter COD amount."),
  deliveryNote: z.string().trim().optional(),
});

export type CreateParcelFormValues = z.infer<typeof createParcelSchema>;
