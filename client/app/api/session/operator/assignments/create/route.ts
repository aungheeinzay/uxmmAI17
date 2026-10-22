import type { NextRequest } from "next/server";
import { deliveriesSession } from "@/features/deliveries/server/deliveries.session";
export function POST(request: NextRequest) { return deliveriesSession(request, "create"); }
