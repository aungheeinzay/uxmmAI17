import "dotenv/config";
import { parseArgs } from "node:util";
import { ProviderSetupError, assignProvider, setupTarget } from "./providers.setup";

async function main() {
  const { values } = parseArgs({ options: { "operator-id": { type: "string" }, "provider-id": { type: "string" }, "confirm-target": { type: "string" }, "allow-remote-development": { type: "boolean", default: false } } });
  const target = setupTarget(process.env, values["confirm-target"], values["allow-remote-development"]);
  const { prisma } = await import("../config/prisma.js");
  try { console.log(JSON.stringify({ target: target.identity, ...await assignProvider(prisma, values["operator-id"] ?? "", values["provider-id"] ?? "") })); }
  finally { await prisma.$disconnect(); }
}
main().catch(error => {
  console.error(error instanceof ProviderSetupError ? error.message : "Provider assignment refused or failed; inspect membership before retrying. No credentials are logged.");
  process.exitCode = 1;
});
