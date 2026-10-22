import type { Prisma } from "../../generated/prisma/client";
import type { Role } from "../../generated/prisma/enums";
export type OperatorActor = { id: string; role: Role };
export type ReceiveParcelRecord = { orderId: string; ownerId: string; actorId: string; note: string | null };
export type OperatorOrderRow = {
  deliveryFee?: Prisma.Decimal | null;
  destinationCity?: string | null;
  deliveryProviderId?: string | null;
  deliveryProvider?: { id: string; name: string } | null;
  parcelWeightKg: Prisma.Decimal;
  codAmount: Prisma.Decimal;
  incidents?: { id: string }[];
};
