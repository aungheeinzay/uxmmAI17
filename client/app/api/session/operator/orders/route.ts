import { operatorOrdersSession } from "@/features/operator/server/operator-orders.session";
import type { NextRequest } from "next/server";
export function POST(request: NextRequest) { return operatorOrdersSession(request); }
