import "dotenv/config";
import { parseArgs } from "node:util";
import { ProviderSetupError, seedProviders, setupTarget } from "./providers.setup";

async function main() {
  const { values } = parseArgs({ options: { name: { type: "string", multiple: true }, "confirm-target": { type: "string" }, "allow-remote-development": { type: "boolean", default: false } } });
  const target = setupTarget(process.env, values["confirm-target"], values["allow-remote-development"]);
  const { prisma } = await import("../config/prisma.js");
  try { console.log(JSON.stringify({ target: target.identity, ...await seedProviders(prisma, values.name ?? []) })); }
  finally { await prisma.$disconnect(); }
}
main().catch(error => {
  console.error(error instanceof ProviderSetupError ? error.message : "Provider seed refused or failed; no credentials are logged.");
  process.exitCode = 1;
});
