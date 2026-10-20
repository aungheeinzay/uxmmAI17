import { app } from "./app";
import { env } from "./config/env";
import { prisma } from "./config/prisma";

const port = env.PORT;

const server = app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    server.close(() => { void prisma.$disconnect().then(() => process.exit(0)); });
  });
}
