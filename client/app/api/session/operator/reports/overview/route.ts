import type { NextRequest } from "next/server";
import { reportsOverviewSession } from "@/features/operator/server/reports.session";

export function POST(request: NextRequest) {
  return reportsOverviewSession(request);
}
