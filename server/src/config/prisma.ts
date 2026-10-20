import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { env } from "./env";

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  // Supabase connection setup can exceed Prisma's 2-second acquisition default.
  // Keep both limits bounded within the client's 30-second request timeout.
  transactionOptions: { maxWait: 10000, timeout: 15000 },
});
