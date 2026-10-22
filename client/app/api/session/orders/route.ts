import { createOrderSession, ordersSession } from "@/features/auth/server/session";

export const GET = ordersSession;
export const POST = createOrderSession;
