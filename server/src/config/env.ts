import { config } from "dotenv";
import { resolve } from "node:path";
import { z } from "zod";

config({ path: resolve(__dirname, "../../.env"), quiet: true });

const configuredValue = z.string().trim().min(1).refine(
  value => !/YOUR_|\[[^\]]*\]/i.test(value),
  "Replace the placeholder with your project's value",
);

const result = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  ENABLE_API_DOCS: z.enum(["true", "false"]).transform(value => value === "true").optional(),
  DATABASE_URL: configuredValue.pipe(z.url({ protocol: /^postgres(?:ql)?$/ })),
}).safeParse(process.env);

if (!result.success) {
  throw new Error(`Invalid environment variables in server/.env: ${result.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ")}. See server/.env.example for required settings.`);
}

export const env = result.data;
