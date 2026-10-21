import { createHash } from "node:crypto";
import { z } from "zod";
import type { PrismaClient } from "../generated/prisma/client";
import { OrderStatus } from "../generated/prisma/enums";

// Intentionally restricted to a separately provisioned local development/test database.
// Remote Supabase databases cannot be verified as non-production by this project.
export function seedSettings(values: NodeJS.ProcessEnv) {
  if (!["development", "test"].includes(values.NODE_ENV ?? "")) throw new Error("Seeding requires development or test mode.");
  const target = values.SEED_DATABASE_URL;
  if (!target) throw new Error("SEED_DATABASE_URL is required.");
  let url: URL;
  try { url = new URL(target); } catch { throw new Error("Invalid seed database target."); }
  const database = url.pathname.slice(1);
  if (!/^postgres(?:ql)?:$/.test(url.protocol)
    || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    || !/^parcelops_(dev|test)$/.test(database)
    || [...url.searchParams.keys()].some(key => !["sslmode", "schema"].includes(key))) {
    throw new Error("Only local parcelops_dev or parcelops_test databases are allowed; remote/production targets are refused.");
  }
  const identity = `${url.hostname}:${url.port || "5432"}/${database}`;
  if (values.ALLOW_DEV_SEED !== "true" || values.SEED_CONFIRM_TARGET !== identity) {
    throw new Error("Explicit ALLOW_DEV_SEED and matching SEED_CONFIRM_TARGET are required.");
  }
  return { target, ownerId: z.string().uuid().parse(values.SEED_SME_ID),
    operatorId: z.string().uuid().parse(values.SEED_OPERATOR_ID) };
}

export async function seedOrders(db: Pick<PrismaClient, "profile" | "account" | "parcelOrder">,
  settings: ReturnType<typeof seedSettings>) {
  const owner = await db.profile.findUnique({ where: { id: settings.ownerId },
    select: { role: true, account: { select: { emailVerifiedAt: true } } } });
  if (owner?.role !== "SME" || !owner.account?.emailVerifiedAt) {
    throw new Error("Seed owner must be an existing verified SME account.");
  }
  const operator = await db.account.findUnique({ where: { id: settings.operatorId }, select: { emailVerifiedAt: true, profile: { select: { role: true } } } });
  if (!operator?.emailVerifiedAt || operator.profile.role !== "OPERATOR") throw new Error("An existing verified development Operator account is required.");
  const townships = ["Tamwe", "Sanchaung", "Hlaing", "Bahan", "Dagon"];
  const statuses = [OrderStatus.CREATED, OrderStatus.CREATED, OrderStatus.CREATED,
    OrderStatus.CREATED, OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT,
    OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED, OrderStatus.FAILED, OrderStatus.CANCELLED];
  let created = 0;
  for (let index = 1; index <= 10; index++) {
    // Valid SME order-code format, reserved by convention for these fixtures.
    const orderCode = `PODEAD00000000${index.toString().padStart(4, "0")}`;
    const existing = await db.parcelOrder.findUnique({ where: { orderCode }, select: { id: true } });
    if (existing) continue;
    try {
      await db.parcelOrder.create({ data: {
        orderCode, qrIdentifier: createHash("sha256").update(`parcelops-dev:${orderCode}`).digest("hex"),
        ownerId: settings.ownerId, operatorId: settings.operatorId,
        recipientName: `FICTIONAL Recipient ${index}`, phoneNumber: `TEST-NOT-DIALABLE-${index}`,
        township: townships[(index - 1) % townships.length],
        deliveryAddress: `FICTIONAL TEST ONLY: Unit ${index}, Imaginary Lane, Yangon`,
        senderName: "FICTIONAL Development Shop", parcelWeightKg: (index * 0.25).toString(),
        codAmount: index % 2 ? "0" : String(index * 2500), currency: "MMK",
        deliveryInstructions: index % 3 === 0 ? null : index % 2 ? "TEST: near the imaginary blue gate; confirm which entrance" : "TEST: use the fictional side entrance",
        status: statuses[index - 1],
      } });
      created++;
    } catch (error) {
      // Concurrent seed runs may race; never update an existing fixture.
      if (!(typeof error === "object" && error !== null && "code" in error && error.code === "P2002")) throw error;
    }
  }
  return { created, skipped: 10 - created };
}
