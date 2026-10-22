// Prisma's PostgreSQL adapter can surface a commit failure as DriverAdapterError
// rather than wrapping it in P2034. Only retry recognized serialization/deadlock errors.
export function isTransactionConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && error.code === "P2034") return true;
  if ("name" in error && error.name === "DriverAdapterError" && "cause" in error) {
    const cause = error.cause;
    return typeof cause === "object" && cause !== null && "kind" in cause && cause.kind === "TransactionWriteConflict";
  }
  return false;
}
