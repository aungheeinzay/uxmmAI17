import { postSessionJson } from "@/lib/api-client";

export async function createOrder(input: unknown) {
  return postSessionJson("orders", input);
}
