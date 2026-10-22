import type { NextRequest } from "next/server";
import { receiveParcelSession } from "@/features/operator/server/operator-orders.session";
export function POST(request: NextRequest) { return receiveParcelSession(request); }
