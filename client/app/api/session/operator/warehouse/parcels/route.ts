import type { NextRequest } from "next/server";
import { warehouseSession } from "@/features/operator/server/warehouse.session";
export function POST(request: NextRequest) { return warehouseSession(request, true); }
