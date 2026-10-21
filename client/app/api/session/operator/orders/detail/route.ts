import type { NextRequest } from "next/server";
import { operatorOrdersSession } from "@/features/operator/server/operator-orders.session";
export function POST(request: NextRequest) { return operatorOrdersSession(request, true); }
