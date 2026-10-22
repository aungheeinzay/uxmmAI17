import "dotenv/config";
import { seedOrders, seedSettings } from "./orders.seed";

async function main() {
  // Validate before importing the shared client, which reads DATABASE_URL.
  const settings = seedSettings(process.env);
  process.env.DATABASE_URL = settings.target;
  const { prisma } = await import("../config/prisma.js");
  try { console.log(await seedOrders(prisma, settings)); }
  finally { await prisma.$disconnect(); }
}
main().catch(() => {
  console.error("Development seed refused or failed. Check the documented safety settings, verified SME and active delivery service. No database credentials are logged.");
  process.exitCode = 1;
});
